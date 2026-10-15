package com.fraergod.fraerapp.game;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@EnableScheduling
@ConditionalOnProperty(name="app.telegram.notifications-enabled",havingValue="true")
class TelegramNotificationWorker {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate transactions;
 private final TelegramNoticeClient client;
 TelegramNotificationWorker(JdbcTemplate jdbc,PlatformTransactionManager manager,TelegramNoticeClient client) {
  this.jdbc=jdbc;this.transactions=new TransactionTemplate(manager);this.client=client;
 }
 @Scheduled(fixedDelayString="${app.telegram.notification-poll-ms:5000}",initialDelayString="${app.telegram.notification-poll-ms:5000}")
 void deliverPending() {
  var ids=jdbc.query("""
    select id from account_notifications where telegram_status='pending' and telegram_next_attempt_at<=current_timestamp
    order by telegram_next_attempt_at,created_at,id limit 20
    """,(rs,n)->rs.getString(1));
  for(String id:ids) {
   var notice=transactions.execute(tx -> {
    var notices=jdbc.query("""
     select user_id,telegram_attempts from account_notifications
     where id=? and telegram_status='pending' and telegram_next_attempt_at<=current_timestamp for update
     """,(rs,n)->new Pending(rs.getString(1),rs.getInt(2)+1),id);
    if(notices.isEmpty()) return null;
    var claimed=notices.get(0);
    jdbc.update("update account_notifications set telegram_attempts=?,telegram_next_attempt_at=? where id=?",claimed.attempts(),Timestamp.from(Instant.now().plusSeconds(60)),id);
    return claimed;
   });
   if(notice==null) continue;
   // Recheck current presentation after claiming; a deleted notice is not resurrected.
   var messages=jdbc.query("select n.kind,"+AccountService.NOTICE_MESSAGE+" "+AccountService.NOTICE_JOINS+" where n.id=?",(rs,n)->{
    String message=rs.getString(2);
    return "story".equals(rs.getString(1)) ? "Новые сцены в истории «"+message+"»" : message;
   },id);
   if(messages.isEmpty()) continue;
   TelegramNoticeClient.Result result;
   try { result=client.send(id,notice.userId(),messages.get(0)); }
   catch(RuntimeException ex) { result=new TelegramNoticeClient.Result("retry",30); }
   if("sent".equals(result.status()) || "skipped".equals(result.status())) {
    jdbc.update("update account_notifications set telegram_status=? where id=? and telegram_attempts=?",result.status(),id,notice.attempts());
   } else {
    long delay=Math.max(Math.min(3600,30L << Math.min(notice.attempts()-1,7)),result.retryAfter());
    // Bound malformed internal responses without overflowing timestamps.
    delay=Math.min(delay,604800);
    jdbc.update("update account_notifications set telegram_next_attempt_at=? where id=? and telegram_attempts=?",Timestamp.from(Instant.now().plusSeconds(delay)),id,notice.attempts());
   }
  }
 }
 private record Pending(String userId,int attempts) {}
}
