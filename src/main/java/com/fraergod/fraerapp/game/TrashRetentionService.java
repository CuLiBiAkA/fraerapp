package com.fraergod.fraerapp.game;

import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Clear author trash after 30 days while retaining immutable audit and reader data. */
@Service
@EnableScheduling
class TrashRetentionService {
 private static final Duration RETENTION=Duration.ofDays(30);
 private final JdbcTemplate jdbc;
 TrashRetentionService(JdbcTemplate jdbc){this.jdbc=jdbc;}
 static Instant instant(Object value){return value instanceof Timestamp t?t.toInstant():value instanceof java.time.OffsetDateTime t?t.toInstant():null;}
 static Timestamp cutoff(){return Timestamp.from(Instant.now().minus(RETENTION));}
 static boolean expired(String visibility,Instant deletedAt){return "purged".equals(visibility)||("deleted".equals(visibility)&&deletedAt!=null&&!deletedAt.plus(RETENTION).isAfter(Instant.now()));}
 static void requireRetained(String visibility,Instant deletedAt){if(expired(visibility,deletedAt))throw new StoryNotFoundException();}
 static void describe(Map<String,Object> result,String visibility,Instant deletedAt,boolean restricted,Integer published){
  result.put("deletedAt",deletedAt);result.put("trashExpiresAt",deletedAt==null?null:deletedAt.plus(RETENTION));
  result.put("canRestoreTrash","deleted".equals(visibility)&&!expired(visibility,deletedAt)&&!restricted&&published==null);
 }
 @Scheduled(cron="${app.trash.cleanup-cron:0 0 3 * * *}")
 @Transactional
 public void expire(){
  jdbc.queryForObject("select id from collection_structure_lock where id=1 for update",Integer.class);
  Timestamp cutoff=cutoff();
  jdbc.update("update story_workspaces set generation=generation+1 where story_id in (select id from stories where visibility='deleted' and deleted_at<=?)",cutoff);
  jdbc.update("update stories set visibility='purged' where visibility='deleted' and deleted_at<=?",cutoff);
  jdbc.update("update work_collections set visibility='purged',generation=generation+1 where visibility='deleted' and deleted_at<=?",cutoff);
  // Expired unpublished folders must not trap the author's surviving chapters.
  // Published reservations still protect historical readership and pinned runs.
  jdbc.update("delete from collection_memberships where in_published=false and parent_id in (select id from work_collections where visibility='purged')");
 }
}
