package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class AccountService {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate transactions;
 AccountService(JdbcTemplate jdbc, PlatformTransactionManager manager) { this.jdbc=jdbc;this.transactions=new TransactionTemplate(manager); }
 record Notice(String id, String kind, String message, String slug, String storyId, Integer revision, String reviewerId, String createdAt, boolean unread) {}
 record Account(String avatar, long unreadCount, List<Notice> notifications) {}
 @Transactional(readOnly=true)
 Account get(String userId) {
  String avatar=jdbc.query("select avatar from account_preferences where user_id=?", (r,n)->r.getString(1), userId).stream().findFirst().orElse("fairy");
  List<Notice> notices=jdbc.query("""
   select n.id,n.kind,case when n.kind='story' and s.id is null then 'История временно недоступна' else n.message end,s.published_slug,n.created_at,n.read_at,n.story_id,n.revision,n.reviewer_id
   from account_notifications n left join stories s on s.id=n.story_id and s.status='PUBLISHED' and s.visibility='public'
   where n.user_id=? order by case when n.read_at is null then 0 else 1 end,n.created_at desc,n.id desc limit 100
   """,(r,n)->new Notice(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getString(7),(Integer)r.getObject(8),r.getString(9),r.getTimestamp(5).toInstant().toString(),r.getTimestamp(6)==null),userId);
  long unread=jdbc.queryForObject("select count(*) from account_notifications where user_id=? and read_at is null",Long.class,userId);
  return new Account(avatar,unread,notices);
 }
 void avatar(String userId,String avatar) {
  try {
   transactions.executeWithoutResult(tx -> {
    if (jdbc.update("update account_preferences set avatar=? where user_id=?",avatar,userId)==0)
     jdbc.update("insert into account_preferences(user_id,avatar) values (?,?)",userId,avatar);
   });
  } catch (DuplicateKeyException concurrentFirstSelection) {
   // Retry only after the failed insert transaction has rolled back.
   transactions.executeWithoutResult(tx -> jdbc.update("update account_preferences set avatar=? where user_id=?",avatar,userId));
  }
 }
 @Transactional
 void read(String userId,String id) { jdbc.update("update account_notifications set read_at=current_timestamp where user_id=? and id=? and read_at is null",userId,id); }
 @Transactional
 void message(String userId,String message) { jdbc.update("insert into account_notifications(id,user_id,kind,message) values (?,?,'admin',?)",UUID.randomUUID().toString(),userId,message); }
 @Transactional
 void published(String storyId,String title) {
  // The story row lock also serializes repeat publication and prevents duplicate notices.
  jdbc.queryForList("select id from stories where id=? for update",storyId);
  Set<String> old=new HashSet<>(jdbc.query("select scene_key from story_release_scenes where story_id=?",(r,n)->r.getString(1),storyId));
  List<String> current=jdbc.query("select scene_key from scenes where story_id=?",(r,n)->r.getString(1),storyId);
  if (!old.isEmpty() && current.stream().anyMatch(key->!old.contains(key))) {
   for (String user:jdbc.query("select user_id from story_favorites where story_id=?",(r,n)->r.getString(1),storyId))
    jdbc.update("insert into account_notifications(id,user_id,kind,message,story_id) values (?,?,'story',?,?)",UUID.randomUUID().toString(),user,title,storyId);
  }
  jdbc.update("delete from story_release_scenes where story_id=?",storyId);
  for(String key:current) jdbc.update("insert into story_release_scenes(story_id,scene_key) values (?,?)",storyId,key);
 }
}
