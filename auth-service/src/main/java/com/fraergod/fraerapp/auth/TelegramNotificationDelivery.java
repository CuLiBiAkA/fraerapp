package com.fraergod.fraerapp.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Objects;
import java.sql.Timestamp;
import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Internal service endpoint. Never accepts a caller-supplied Telegram chat ID. */
@RestController
@ConditionalOnProperty(name="auth.telegram.notifications-enabled",havingValue="true")
class TelegramNotificationDelivery {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate transactions;
 private final TelegramNotificationTransport transport;
 private final String secret, policyVersion, publicBase;
 TelegramNotificationDelivery(JdbcTemplate jdbc, PlatformTransactionManager manager, TelegramNotificationTransport transport,
   @Value("${auth.telegram.notification-secret:}") String secret,
   @Value("${auth.privacy-policy-version}") String policyVersion,
   @Value("${auth.public-base-url:}") String publicBase) {
  if(secret.length()<32) throw new IllegalArgumentException("Telegram notification service secret must contain at least 32 characters");
  var base=java.net.URI.create(publicBase);
  if(!"https".equals(base.getScheme()) || base.getHost()==null || base.getRawQuery()!=null || base.getRawFragment()!=null || base.getUserInfo()!=null)
   throw new IllegalArgumentException("Telegram notifications require an HTTPS public base URL");
  this.jdbc=jdbc; this.transactions=new TransactionTemplate(manager); this.transport=transport;
  this.secret=secret; this.policyVersion=policyVersion; this.publicBase=publicBase.replaceAll("/+$", "");
 }
 record Notice(@NotBlank @Size(max=36) String id,@NotBlank @Size(max=36) String userId,@NotBlank @Size(max=2100) String message) {}

 @PostMapping("/internal/telegram/notifications")
 TelegramNotificationTransport.Result deliver(@RequestHeader(name="X-Notification-Secret",required=false) String supplied,
   @Valid @RequestBody Notice notice) {
  if(supplied==null || !MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))
   throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Invalid service credential");
  var recipients=jdbc.query("""
     select t.telegram_chat_id,t.notifications_enabled,u.email,u.blocked_at
     from telegram_identities t join users u on u.id=t.user_id where t.user_id=?
     """,(rs,n)->new Recipient(rs.getLong(1),rs.getBoolean(2),rs.getString(3),rs.getObject(4)!=null),notice.userId());
  if(recipients.isEmpty()) return new TelegramNotificationTransport.Result("skipped",0);
  var recipient=recipients.get(0);
  boolean consent=jdbc.queryForObject("""
     select count(*) from personal_data_consents where email=? and policy_version=?
     and source='telegram_explicit' and revoked_at is null
     """,Integer.class,recipient.email(),policyVersion)>0;
  if(!recipient.enabled() || recipient.blocked() || !consent) return new TelegramNotificationTransport.Result("skipped",0);
  try {
   transactions.executeWithoutResult(tx -> jdbc.update("insert into telegram_notification_receipts(notification_id,user_id) values (?,?)",notice.id(),notice.userId()));
  } catch(DuplicateKeyException alreadyQueued) { /* Read the durable delivery state below. */ }
  Integer attempt=transactions.execute(tx -> {
   var receipt=jdbc.queryForMap("select user_id,status,attempt,lease_until from telegram_notification_receipts where notification_id=? for update",notice.id());
   if(!Objects.equals(receipt.get("user_id"),notice.userId())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Notification identity mismatch");
   if("sent".equals(receipt.get("status"))) return -1;
   if(jdbc.queryForObject("select count(*) from telegram_notification_receipts where notification_id=? and lease_until>current_timestamp",Integer.class,notice.id())>0) return 0;
   int next=((Number)receipt.get("attempt")).intValue()+1;
   jdbc.update("update telegram_notification_receipts set status='sending',attempt=?,lease_until=? where notification_id=?",next,Timestamp.from(Instant.now().plusSeconds(30)),notice.id());
   return next;
  });
  if(attempt==-1) return new TelegramNotificationTransport.Result("sent",0);
  if(attempt==0) return new TelegramNotificationTransport.Result("retry",30);
  // The committed lease serializes requests without blocking login, preferences or deletion.
  var result=transport.send(recipient.chatId(),"FraerApp\n\n"+notice.message()+"\n\n"+publicBase+"/?panel=account");
  if("sent".equals(result.status())) {
   jdbc.update("update telegram_notification_receipts set status='sent',delivered_at=current_timestamp where notification_id=? and attempt=?",notice.id(),attempt);
  } else {
   jdbc.update("update telegram_notification_receipts set status='pending',lease_until=current_timestamp where notification_id=? and attempt=?",notice.id(),attempt);
  }
  return result;
 }
 private record Recipient(long chatId,boolean enabled,String email,boolean blocked) {}
}
