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
 Story atRevision(Story story,Integer revision) {
  if(!available(story)||revision==null)throw new StoryNotFoundException();
  if(!supportsRevision(story,revision))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"This saved revision has not been approved. Start a new run.");
  var version=versions.findByStoryIdAndVersionNumber(story.getId(),revision).orElseThrow(StoryNotFoundException::new);
  return story.atRevision(json.readStory(version.getSnapshotJson()),json);
 }
 boolean supportsRevision(Story story,Integer revision) {
  if(!available(story)||revision==null)return false;
  if(revision.equals(story.getPublishedRevision()))return true;
  return jdbc.queryForObject("select count(*) from story_moderation_events where story_id=? and revision=? and action in ('approve-publish','publish-approved','migration_approved')",Long.class,story.getId(),revision)>0;
 }
}
