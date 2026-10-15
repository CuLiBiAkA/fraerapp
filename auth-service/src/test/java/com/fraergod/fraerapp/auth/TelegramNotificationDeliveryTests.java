package com.fraergod.fraerapp.auth;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.web.server.ResponseStatusException;

class TelegramNotificationDeliveryTests {
 JdbcTemplate jdbc;
 TelegramNotificationDelivery delivery;
 AtomicInteger sends;
 String secret = "a".repeat(32);
 TelegramNotificationTransport.Result result;
 @BeforeEach void setup() {
  var ds = new DriverManagerDataSource("jdbc:h2:mem:tg-"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
  jdbc = new JdbcTemplate(ds);
  jdbc.execute("create table users(id varchar(36) primary key,email varchar(255),blocked_at timestamp with time zone)");
  jdbc.execute("create table telegram_identities(user_id varchar(36),telegram_chat_id bigint,notifications_enabled boolean)");
  jdbc.execute("create table personal_data_consents(email varchar(255),policy_version varchar(32),source varchar(32),revoked_at timestamp with time zone)");
  jdbc.execute("create table telegram_notification_receipts(notification_id varchar(36) primary key,user_id varchar(36),status varchar(16) default 'pending',attempt integer default 0,lease_until timestamp with time zone default current_timestamp,delivered_at timestamp with time zone)");
  jdbc.update("insert into users values ('reader','reader@example.test',null)");
  jdbc.update("insert into telegram_identities values ('reader',67890,true)");
  jdbc.update("insert into personal_data_consents values ('reader@example.test','current','telegram_explicit',null)");
  sends = new AtomicInteger(); result = new TelegramNotificationTransport.Result("sent",0);
  delivery = new TelegramNotificationDelivery(jdbc,new DataSourceTransactionManager(ds),(chat,text)->{
   assertThat(chat).isEqualTo(67890); assertThat(text).contains("Сообщение", "https://example.test/?panel=account");
   sends.incrementAndGet(); return result;
  }, secret,"current","https://example.test");
 }
 TelegramNotificationDelivery.Notice notice() { return new TelegramNotificationDelivery.Notice("notice-1","reader","Сообщение"); }
 @Test void rejectsWrongAndMissingServiceSecret() {
  for(String value:Arrays.asList(null,"", "wrong")) assertThatThrownBy(()->delivery.deliver(value,notice())).isInstanceOf(ResponseStatusException.class);
  assertThat(sends.get()).isZero();
 }
 @Test void httpEndpointValidatesCredentialAndPayload() throws Exception {
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(delivery).build();
  var request=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/internal/telegram/notifications")
   .header("X-Notification-Secret",secret).contentType("application/json")
   .content("{\"id\":\"notice-1\",\"userId\":\"reader\",\"message\":\"Сообщение\"}");
  mvc.perform(request).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value("sent"));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/internal/telegram/notifications")
   .header("X-Notification-Secret",secret).contentType("application/json").content("{\"id\":\"x\",\"userId\":\"reader\",\"message\":\"\"}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  assertThat(sends.get()).isEqualTo(1);
 }
 @Test void duplicateRequestAfterSuccessDoesNotSendAgain() {
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("sent");
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("sent");
  assertThat(sends.get()).isEqualTo(1);
 }
 @Test void slowSendDoesNotLockIdentityAndConcurrentDeliveryUsesLease() throws Exception {
  var started=new java.util.concurrent.CountDownLatch(1);
  var release=new java.util.concurrent.CountDownLatch(1);
  var slow=new TelegramNotificationDelivery(jdbc,new DataSourceTransactionManager(jdbc.getDataSource()),(chat,text)->{
   sends.incrementAndGet();started.countDown();
   try {if(!release.await(5,java.util.concurrent.TimeUnit.SECONDS))throw new AssertionError("send not released");}
   catch(InterruptedException ex){throw new AssertionError(ex);}
   return result;
  },secret,"current","https://example.test");
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   var first=executor.submit(()->slow.deliver(secret,notice()));
   assertThat(started.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
   executor.submit(()->jdbc.update("update telegram_identities set notifications_enabled=true")).get(1,java.util.concurrent.TimeUnit.SECONDS);
   assertThat(executor.submit(()->slow.deliver(secret,notice())).get(1,java.util.concurrent.TimeUnit.SECONDS).status()).isEqualTo("retry");
   assertThat(sends.get()).isEqualTo(1);
   release.countDown();assertThat(first.get(2,java.util.concurrent.TimeUnit.SECONDS).status()).isEqualTo("sent");
  } finally {release.countDown();executor.shutdownNow();}
 }
 @Test void transientFailureCanRetryAndHonorsTelegramDelay() {
  result = new TelegramNotificationTransport.Result("retry",120);
  assertThat(delivery.deliver(secret,notice()).retryAfter()).isEqualTo(120);
  result = new TelegramNotificationTransport.Result("sent",0);
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("sent");
  assertThat(sends.get()).isEqualTo(2);
 }
 @Test void disabledBlockedUnlinkedOrRevokedUsersAreSkipped() {
  jdbc.update("update telegram_identities set notifications_enabled=false");
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("skipped");
  jdbc.update("update telegram_identities set notifications_enabled=true");
  jdbc.update("update users set blocked_at=current_timestamp");
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("skipped");
  jdbc.update("update users set blocked_at=null");
  jdbc.update("update personal_data_consents set revoked_at=current_timestamp");
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("skipped");
  jdbc.update("delete from telegram_identities");
  assertThat(delivery.deliver(secret,notice()).status()).isEqualTo("skipped");
  assertThat(sends.get()).isZero();
 }
}
