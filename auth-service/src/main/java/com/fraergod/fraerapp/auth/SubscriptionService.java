package com.fraergod.fraerapp.auth;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Auth-owned test checkout. Browser assertions never represent real payments. */
@Service
class SubscriptionService {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate transactions;
 private final boolean mockEnabled;
 SubscriptionService(JdbcTemplate jdbc,@Value("${auth.subscription.mock-enabled:true}") boolean mockEnabled){
  this.jdbc=jdbc;this.mockEnabled=mockEnabled;
  transactions=new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
 }
 record Plan(String id,int months,String mode,boolean checkoutEnabled,long priceMinor,long chargeMinor,String currency){}
 record Subscription(String planId,String status,Instant startedAt,Instant expiresAt,Instant revokedAt,int version){}
 record Order(String id,String status,long priceMinor,long amountMinor,String currency,Instant createdAt,Instant periodEnd){}
 record Event(String action,String reason,String actorId,String actorLabel,Instant createdAt){}
 record Account(Plan plan,Subscription subscription,boolean manualAuthor,boolean authorAccess,List<Order> orders,List<Event> events){}
 record Subscriber(String userId,String email,boolean blocked,boolean manualAuthor,Subscription subscription){}
 record Page(int page,int size,long totalElements,int totalPages,List<Subscriber> items,Map<String,Long> counts){}
 Plan plan(){return new Plan("author-monthly",1,"test",mockEnabled,13900,0,"RUB");}
 private Timestamp stamp(Instant time){return Timestamp.from(time);}
 private Instant instant(Timestamp time){return time==null?null:time.toInstant();}
 private Subscription subscription(String userId){
  return jdbc.query("select * from author_subscriptions where user_id=?",(r,n)->{
   Instant end=r.getTimestamp("expires_at").toInstant(),revoked=instant(r.getTimestamp("revoked_at"));
   return new Subscription(r.getString("plan_id"),revoked!=null?"revoked":end.isAfter(Instant.now())?"active":"expired",r.getTimestamp("started_at").toInstant(),end,revoked,r.getInt("version"));
  },userId).stream().findFirst().orElse(null);
 }
 private boolean manualAuthor(String userId){return jdbc.queryForObject("select count(*) from user_roles where user_id=? and role_name in ('author','admin')",Long.class,userId)>0;}
 Account account(String userId){return account(userId,false);}
 Account adminAccount(String userId){return account(userId,true);}
 private Account account(String userId,boolean admin){
  Subscription current=subscription(userId);boolean manual=manualAuthor(userId);
  var orders=jdbc.query("select * from subscription_orders where user_id=? order by created_at desc,id desc limit 100",(r,n)->new Order(r.getString("id"),r.getString("status"),r.getLong("price_minor"),r.getLong("amount_minor"),r.getString("currency"),r.getTimestamp("created_at").toInstant(),r.getTimestamp("period_end").toInstant()),userId);
  var events=jdbc.query("select e.*,u.email as actor_email from subscription_events e left join users u on u.id=e.actor_id where e.user_id=? order by e.created_at desc,e.id desc limit 100",(r,n)->new Event(r.getString("action"),r.getString("reason"),admin?r.getString("actor_id"):null,admin?r.getString("actor_email"):null,r.getTimestamp("created_at").toInstant()),userId);
  return new Account(plan(),current,manual,manual||(current!=null&&"active".equals(current.status())),orders,events);
 }
 private void lockUser(String userId,boolean allowBlocked){
  var users=jdbc.queryForList("select blocked_at from users where id=? for update",userId);
  if(users.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
  if(!allowBlocked&&users.get(0).get("blocked_at")!=null)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"User is blocked");
 }
 Account checkout(String userId,String planId,String requestId,boolean confirmed){
  if(!mockEnabled)throw new ResponseStatusException(HttpStatus.CONFLICT,"Test checkout is disabled");
  if(!plan().id().equals(planId)||!confirmed||requestId==null||!requestId.matches("[0-9a-fA-F-]{36}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid checkout request");
  try{UUID.fromString(requestId);}catch(IllegalArgumentException invalid){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid checkout request");}
  return transactions.execute(tx->{
   lockUser(userId,false);
   if(jdbc.queryForObject("select count(*) from subscription_orders where user_id=? and request_id=?",Long.class,userId,requestId)>0)return account(userId);
   Instant now=Instant.now();Subscription current=subscription(userId);
   boolean renewing=current!=null&&"active".equals(current.status());
   Instant end=(renewing?current.expiresAt():now).atZone(ZoneOffset.UTC).plusMonths(plan().months()).toInstant();
   if(current==null)jdbc.update("insert into author_subscriptions(user_id,plan_id,started_at,expires_at,version) values (?,?,?,?,1)",userId,planId,stamp(now),stamp(end));
   else jdbc.update("update author_subscriptions set started_at=?,expires_at=?,revoked_at=null,version=version+1 where user_id=?",stamp(renewing?current.startedAt():now),stamp(end),userId);
   jdbc.update("insert into subscription_orders(id,user_id,request_id,plan_id,status,price_minor,amount_minor,currency,created_at,period_end) values (?,?,?,?,'test_succeeded',?,0,'RUB',?,?)",UUID.randomUUID().toString(),userId,requestId,planId,plan().priceMinor(),stamp(now),stamp(end));
   jdbc.update("delete from author_access_requests where user_id=?",userId);
   event(userId,userId,renewing?"test_renewed":"test_activated","Test checkout; no payment collected");
   return account(userId);
  });
 }
 Account revoke(String userId,String actorId,int version,String reason){
  if(reason==null||reason.trim().isEmpty()||reason.trim().length()>500)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A reason of 1 to 500 characters is required");
  return transactions.execute(tx->{
   lockUser(userId,true);Subscription current=subscription(userId);
   if(current==null||current.version()!=version||!"active".equals(current.status()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Subscription changed; refresh it first");
   revokeForRole(userId,actorId,reason.trim());return adminAccount(userId);
  });
 }
 // Caller holds the user row lock, including AuthStore's existing role transaction.
 void revokeForRole(String userId,String actorId,String reason){
  int changed=jdbc.update("update author_subscriptions set revoked_at=?,version=version+1 where user_id=? and revoked_at is null and expires_at>?",stamp(Instant.now()),userId,stamp(Instant.now()));
  if(changed>0)event(userId,actorId,"revoked",reason);
 }
 private void event(String userId,String actor,String action,String reason){jdbc.update("insert into subscription_events(id,user_id,actor_id,action,reason,created_at) values (?,?,?,?,?,?)",UUID.randomUUID().toString(),userId,actor,action,reason,stamp(Instant.now()));}
 Page list(int page,int size,String query,String status){
  if(!List.of("all","active","expired","revoked").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid subscription filter");
  int safeSize=Math.max(1,Math.min(100,size));String search="%"+(query==null?"":query.trim().toLowerCase(Locale.ROOT))+"%";
  String state="case when s.revoked_at is not null then 'revoked' when s.expires_at>current_timestamp then 'active' else 'expired' end";
  String source=" from author_subscriptions s join users u on u.id=s.user_id";
  String filter=" where lower(u.email) like ? and (?='all' or ("+state+")=?)";
  long total=jdbc.queryForObject("select count(*)"+source+filter,Long.class,search,status,status);int pages=(int)Math.ceil((double)total/safeSize),safePage=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  var items=jdbc.query("select u.id,u.email,u.blocked_at"+source+filter+" order by s.expires_at desc,u.id limit ? offset ?",(r,n)->new Subscriber(r.getString(1),r.getString(2),r.getTimestamp(3)!=null,manualAuthor(r.getString(1)),subscription(r.getString(1))),search,status,status,safeSize,safePage*safeSize);
  Map<String,Long> counts=new LinkedHashMap<>();for(String key:List.of("active","expired","revoked"))counts.put(key,jdbc.queryForObject("select count(*)"+source+" where ("+state+")=?",Long.class,key));
  return new Page(safePage,safeSize,total,pages,items,counts);
 }
}
