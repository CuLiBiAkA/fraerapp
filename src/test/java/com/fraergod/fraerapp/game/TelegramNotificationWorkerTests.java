package com.fraergod.fraerapp.game;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;

class TelegramNotificationWorkerTests {
 JdbcTemplate jdbc;
 TelegramNotificationWorker worker;
 AtomicInteger sends;
 TelegramNoticeClient.Result result;
 @BeforeEach void setup() {
  var ds=new DriverManagerDataSource("jdbc:h2:mem:notice-"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa", "");
  jdbc=new JdbcTemplate(ds);
  jdbc.execute("create table account_notifications(id varchar(36) primary key,user_id varchar(36),kind varchar(16),message varchar(2000),story_id varchar(36),collection_id varchar(36),created_at timestamp with time zone default current_timestamp)");
  jdbc.execute("create table stories(id varchar(36),status varchar(16),visibility varchar(16))");
  jdbc.execute("create table work_collections(id varchar(36),visibility varchar(16),published_revision integer)");
  jdbc.update("insert into account_notifications(id,user_id,kind,message) values ('old','reader','story','old')");
  new ResourceDatabasePopulator(new ClassPathResource("db/migration/V24__telegram_notification_delivery.sql")).execute(ds);
  sends=new AtomicInteger(); result=new TelegramNoticeClient.Result("sent",0);
  worker=new TelegramNotificationWorker(jdbc,new DataSourceTransactionManager(ds),(id,user,message)->{sends.incrementAndGet();return result;});
 }
 void add(String kind) { jdbc.update("insert into account_notifications(id,user_id,kind,message) values (?,?,?,?)",kind,"reader",kind,"same site text"); }
 @Test void deliversAllExistingKindsOnceButNotHistoricalNotices() {
  for(String kind:List.of("story","chapter","moderation","admin")) add(kind);
  worker.deliverPending(); worker.deliverPending();
  assertThat(sends.get()).isEqualTo(4);
  assertThat(jdbc.queryForObject("select telegram_status from account_notifications where id='old'",String.class)).isEqualTo("skipped");
 }
 @Test void transientFailureIsRetainedAndRetriedAfterDelay() {
  add("story"); result=new TelegramNoticeClient.Result("retry",120);
  worker.deliverPending(); worker.deliverPending(); assertThat(sends.get()).isEqualTo(1);
  assertThat(jdbc.queryForObject("select telegram_status from account_notifications where id='story'",String.class)).isEqualTo("pending");
  jdbc.update("update account_notifications set telegram_next_attempt_at=current_timestamp");
  result=new TelegramNoticeClient.Result("sent",0); worker.deliverPending(); assertThat(sends.get()).isEqualTo(2);
 }
 @Test void skippedRecipientAndDeletedNoticeAreNotRetried() {
  add("story"); add("admin"); jdbc.update("delete from account_notifications where id='admin'");
  result=new TelegramNoticeClient.Result("skipped",0); worker.deliverPending(); worker.deliverPending();
  assertThat(sends.get()).isEqualTo(1);
 }
 @Test void deliveryUsesSiteVisibilityMaskAndExplainsStoryUpdate() {
  add("story");
  jdbc.update("update account_notifications set story_id='hidden',message='Private title' where id='story'");
  var texts=new ArrayList<String>();
  var checked=new TelegramNotificationWorker(jdbc,new DataSourceTransactionManager(jdbc.getDataSource()),(id,user,text)->{
   texts.add(text);return new TelegramNoticeClient.Result("sent",0);
  });
  checked.deliverPending();
  assertThat(texts).containsExactly("Новые сцены в истории «История временно недоступна»");
  assertThat(texts.get(0)).doesNotContain("Private title");
 }
 @Test void slowSendDoesNotBlockDeletionOrAllowASecondClaim() throws Exception {
  add("admin");
  var started=new java.util.concurrent.CountDownLatch(1);
  var release=new java.util.concurrent.CountDownLatch(1);
  var slow=new TelegramNotificationWorker(jdbc,new DataSourceTransactionManager(jdbc.getDataSource()),(id,user,text)->{
   sends.incrementAndGet();started.countDown();
   try {if(!release.await(5,java.util.concurrent.TimeUnit.SECONDS))throw new AssertionError("send not released");}
   catch(InterruptedException ex){throw new AssertionError(ex);}
   return result;
  });
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   var first=executor.submit(slow::deliverPending);
   assertThat(started.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
   executor.submit(slow::deliverPending).get(1,java.util.concurrent.TimeUnit.SECONDS);
   executor.submit(()->jdbc.update("delete from account_notifications where id='admin'")).get(1,java.util.concurrent.TimeUnit.SECONDS);
   release.countDown();first.get(2,java.util.concurrent.TimeUnit.SECONDS);
   assertThat(sends.get()).isEqualTo(1);
   assertThat(jdbc.queryForObject("select count(*) from account_notifications where id='admin'",Integer.class)).isZero();
  } finally {release.countDown();executor.shutdownNow();}
 }
}
