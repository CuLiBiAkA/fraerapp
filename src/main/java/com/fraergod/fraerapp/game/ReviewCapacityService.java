package com.fraergod.fraerapp.game;

import java.util.*;
import java.time.Instant;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** One pending story and one newly admitted work per 24 hours, per owner. */
@Service
class ReviewCapacityService {
 private final JdbcTemplate jdbc;
 private final JsonSupport json;
 ReviewCapacityService(JdbcTemplate jdbc,JsonSupport json){this.jdbc=jdbc;this.json=json;}
 private record Pending(String kind,String id,String scope) {String key(){return kind+":"+id;}}
 private record Queue(Map<String,String> parents,Set<String> serialStories,List<Pending> pending) {
  String root(String key){
   Set<String> seen=new HashSet<>();
   while(!serialStories.contains(key)&&parents.containsKey(key)&&seen.add(key))key=parents.get(key);
   return key;
  }
  String scope(Pending item){return item.scope()==null?root(item.key()):item.scope();}
  String scope(String key){return pending.stream().filter(p->p.key().equals(key)).findFirst().map(this::scope).orElseGet(()->root(key));}
  boolean blocked(String key){String scope=scope(key);return pending.stream().anyMatch(p->!scope.equals(scope(p)));}
 }
 private Queue queue(String owner){
  var parents=new HashMap<String,String>();var serial=new HashSet<String>();var pending=new ArrayList<Pending>();
  for(var r:jdbc.queryForList("select id,draft_json,review_state,review_scope from work_collections where owner_player_id=? order by id",owner)){
   String id=(String)r.get("id");if(json.readCollection((String)r.get("draft_json")).serialStory())serial.add("collection:"+id);
   if("in_review".equals(r.get("review_state")))pending.add(new Pending("collection",id,(String)r.get("review_scope")));
  }
  for(var r:jdbc.queryForList("select m.parent_id,m.target_kind,m.target_id from collection_memberships m join work_collections c on c.id=m.parent_id where c.owner_player_id=? and (m.in_published=true or (c.visibility<>'purged' and (c.visibility<>'deleted' or c.deleted_at is null or c.deleted_at>?))) order by m.in_draft desc,m.parent_id",owner,TrashRetentionService.cutoff()))
   parents.putIfAbsent(r.get("target_kind")+":"+r.get("target_id"),"collection:"+r.get("parent_id"));
  for(var r:jdbc.queryForList("select s.id,w.review_scope from stories s join story_workspaces w on w.story_id=s.id where s.owner_player_id=? and w.review_state='in_review'",owner))
   pending.add(new Pending("scenario",(String)r.get("id"),(String)r.get("review_scope")));
  return new Queue(parents,serial,pending);
 }
 private record Admission(String scope,Instant at) {}
 private Admission admission(String owner){return jdbc.query("select review_scope,admitted_at from author_review_admission where owner_player_id=?",(r,n)->new Admission(r.getString(1),r.getTimestamp(2).toInstant()),owner).stream().findFirst().orElse(null);}
 private Instant dailyRetry(Admission admission,String scope,Instant now){return admission!=null&&!admission.scope().equals(scope)&&admission.at().plus(Duration.ofHours(24)).isAfter(now)?admission.at().plus(Duration.ofHours(24)):null;}
 void addStatus(Map<String,Object> result,String owner,String kind,String id){
  Queue queue=queue(owner);String key=kind+":"+id;Instant retry=owner==null?null:dailyRetry(admission(owner),queue.scope(key),Instant.now());
  result.put("reviewLimitReached",owner!=null&&(queue.blocked(key)||retry!=null));
  result.put("reviewDailyLimitReached",retry!=null);result.put("reviewAvailableAt",retry);
 }
 // Both submission owners already hold collection_structure_lock until commit.
 // This also serializes batch submissions, imports and concurrent browser tabs.
 void claim(String owner,String kind,String id){
  if(owner==null)return;
  Queue queue=queue(owner);String key=kind+":"+id;
  if(queue.blocked(key))throw new ReviewLimitException();
  Instant now=Instant.now();String scope=queue.scope(key);Admission admission=admission(owner);Instant retry=dailyRetry(admission,scope,now);
  if(retry!=null)throw new ReviewDailyLimitException(retry);
  if(admission==null)jdbc.update("insert into author_review_admission(owner_player_id,review_scope,admitted_at) values (?,?,?)",owner,scope,java.sql.Timestamp.from(now));
  else if(!admission.at().plus(Duration.ofHours(24)).isAfter(now))jdbc.update("update author_review_admission set review_scope=?,admitted_at=? where owner_player_id=?",scope,java.sql.Timestamp.from(now),owner);
  // Adopt legacy pending submissions without deleting or resubmitting them.
  for(Pending item:queue.pending())if(item.scope()==null)saveScope(item.kind(),item.id(),queue.scope(item));
  saveScope(kind,id,queue.scope(key));
 }
 private void saveScope(String kind,String id,String scope){
  if("scenario".equals(kind))jdbc.update("update story_workspaces set review_scope=? where story_id=?",scope,id);
  else jdbc.update("update work_collections set review_scope=? where id=?",scope,id);
 }
}

class ReviewDailyLimitException extends ResponseStatusException {
 private final Instant retryAt;
 ReviewDailyLimitException(Instant retryAt){super(HttpStatus.CONFLICT,"One new story may be submitted every 24 hours. You can continue editing drafts and updating the same submitted story.");this.retryAt=retryAt;}
 Instant retryAt(){return retryAt;}
}

class ReviewLimitException extends ResponseStatusException {
 ReviewLimitException(){super(HttpStatus.CONFLICT,"Only one story can await moderation. Wait for the moderator's decision before submitting another story. You can continue creating and editing drafts.");}
}
