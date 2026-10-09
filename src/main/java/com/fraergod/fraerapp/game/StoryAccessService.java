package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.stereotype.Service;

/** Shared availability policy for catalogue, gameplay and protected media. */
@Service
class StoryAccessService {
 private final StoryVersionRepository versions;
 private final JsonSupport json;
 private final org.springframework.jdbc.core.JdbcTemplate jdbc;
 StoryAccessService(StoryVersionRepository versions,JsonSupport json,org.springframework.jdbc.core.JdbcTemplate jdbc) {this.versions=versions;this.json=json;this.jdbc=jdbc;}
 static boolean available(Story story) {
  return story.getPublishedRevision()!=null && story.getStatus()==StoryStatus.PUBLISHED
   && List.of("public","unlisted").contains(story.getVisibility());
 }
 static boolean listed(Story story) {return available(story)&&"public".equals(story.getVisibility());}
 Set<String> restrictedSerialChapterIds(){
  Set<String> ids=new HashSet<>();
  jdbc.query("select m.target_id,v.document_json from collection_memberships m join work_collections c on c.id=m.parent_id join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision join stories s on s.id=m.target_id and s.owner_player_id=c.owner_player_id where m.target_kind='scenario' and m.in_published=true and (c.visibility not in ('public','unlisted') or c.restricted=true)",rs->{if(json.readCollection(rs.getString(2)).serialStory())ids.add(rs.getString(1));});return ids;
 }
 boolean parentAllowsReading(String storyId){return jdbc.query("select v.document_json from collection_memberships m join work_collections c on c.id=m.parent_id join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision join stories s on s.id=m.target_id and s.owner_player_id=c.owner_player_id where m.target_kind='scenario' and m.target_id=? and m.in_published=true and (c.visibility not in ('public','unlisted') or c.restricted=true)",(rs,n)->json.readCollection(rs.getString(1)).serialStory(),storyId).stream().noneMatch(Boolean.TRUE::equals);}
 boolean readable(Story story){return available(story)&&parentAllowsReading(story.getId());}
 Story atRevision(Story story,Integer revision) {
  if(!readable(story)||revision==null)throw new StoryNotFoundException();
  if(!supportsRevision(story,revision))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"This saved revision has not been approved. Start a new run.");
  var version=versions.findByStoryIdAndVersionNumber(story.getId(),revision).orElseThrow(StoryNotFoundException::new);
  return story.atRevision(json.readStory(version.getSnapshotJson()),json);
 }
 boolean supportsRevision(Story story,Integer revision) {
  if(!readable(story)||revision==null)return false;
  if(revision.equals(story.getPublishedRevision()))return true;
  return jdbc.queryForObject("select count(*) from story_moderation_events where story_id=? and revision=? and action in ('approve-publish','publish-approved','migration_approved')",Long.class,story.getId(),revision)>0;
 }
}
