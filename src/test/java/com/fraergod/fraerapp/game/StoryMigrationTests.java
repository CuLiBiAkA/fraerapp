package com.fraergod.fraerapp.game;

import static org.assertj.core.api.Assertions.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties={
 "spring.datasource.url=${MODERATION_TEST_DB:jdbc:h2:mem:moderation-migration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
 "spring.datasource.username=${MODERATION_TEST_USER:sa}","spring.datasource.password=${MODERATION_TEST_PASSWORD:}",
 "spring.jpa.hibernate.ddl-auto=validate"
})
@Transactional
class StoryMigrationTests {
 @Autowired StoryWorkflowService workflow;
 @Autowired StoryAdminService content;
 @Autowired StoryRepository stories;
 @Autowired StoryVersionRepository versions;
 @Autowired GameSessionRepository sessions;
 @Autowired PlayerRepository players;
 @Autowired GameService game;
 @Autowired JsonSupport json;
 @Autowired JdbcTemplate jdbc;
 private final AuthIdentity admin=new AuthIdentity("test-reviewer","reviewer@example.test",List.of("admin"));
 private StoryDocument doc(String key,String scene) {
  return json.readStory(json.write(Map.of("key",key,"title","Existing publication","version",1,"startSceneId",scene,
    "scenes",List.of(Map.of("id",scene,"title","Original scene","text","Preserved text","choices",List.of())))));
 }
 private record Legacy(Story story,GameSession save,Player player) {}
 private Legacy legacy() {
  String key="legacy_"+UUID.randomUUID();
  Story s=content.applyDocument(new Story(key),doc(key,"old_scene"),StoryStatus.PUBLISHED);
  s.setPublishedSlug(key);s.setPublishedAt(Instant.now());stories.saveAndFlush(s);
  versions.saveAndFlush(new StoryVersion(s.getId(),1,StoryStatus.PUBLISHED,json.write(content.exportStoryDocument(s)),"legacy_publish"));
  Player p=players.saveAndFlush(new Player("legacy-reader-"+UUID.randomUUID(),"legacy"));
  GameSession save=sessions.saveAndFlush(new GameSession(p.getId(),s,"Before moderation"));
  return new Legacy(s,save,p);
 }
 @Test void explicitOwnerApprovalPreservesIdsSnapshotsAndSavesAndDoesNotRepublishNewSeed() {
  ReflectionTestUtils.setField(workflow,"legacyPolicy","approve");var old=legacy();String id=old.story().getId();
  workflow.initializeExisting();
  Story migrated=stories.findById(id).orElseThrow();
  assertThat(migrated.getPublishedSlug()).isEqualTo(old.story().getKey());assertThat(migrated.getPublishedRevision()).isEqualTo(2);
  assertThat(jdbc.queryForObject("select story_revision from game_sessions where id=?",Integer.class,old.save().getId())).isEqualTo(2);
  assertThat(versions.countByStoryId(id)).isEqualTo(2);assertThat(workflow.workspace(id).reviewState()).isEqualTo("approved");
  assertThat(jdbc.queryForObject("select action from story_moderation_events where story_id=?",String.class,id)).isEqualTo("migration_approved");
  workflow.initializeExisting();assertThat(versions.countByStoryId(id)).isEqualTo(2);
  assertThat(stories.findByKey("night_train").orElseThrow().getPublishedRevision()).isNull();
 }
 @Test void archivedLegacySaveStaysOnItsOriginalSnapshotAfterRestorationAndNewPublication() {
  ReflectionTestUtils.setField(workflow,"legacyPolicy","approve");var old=legacy();String id=old.story().getId();
  old.story().setStatus(StoryStatus.ARCHIVED);stories.saveAndFlush(old.story());
  workflow.initializeExisting();
  int original=jdbc.queryForObject("select story_revision from game_sessions where id=?",Integer.class,old.save().getId());
  assertThat(original).isEqualTo(2);
  workflow.decide(id,"restore",new StoryWorkflowService.Decision(workflow.workspace(id).generation(),null,"Restore archived work","","private",false),admin);
  workflow.importDraft(json.write(doc(old.story().getKey(),"new_scene")),null);
  workflow.submit(id,null,workflow.workspace(id).generation(),false,admin);
  var current=workflow.workspace(id);
  workflow.decide(id,"approve-publish",new StoryWorkflowService.Decision(current.generation(),current.submittedRevision(),"","","public",false),admin);
  assertThat(jdbc.queryForObject("select story_revision from game_sessions where id=?",Integer.class,old.save().getId())).isEqualTo(original);
  assertThat(workflow.revision(id,original).startSceneId()).isEqualTo("old_scene");
  assertThatThrownBy(()->new StoryAccessService(versions,json,jdbc).atRevision(old.story(),original))
   .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("409");
 }
 @Test void strictMigrationKeepsLegacyRevisionAndNeverRebindsItToAnUnrelatedScene() {
  ReflectionTestUtils.setField(workflow,"legacyPolicy","review");var old=legacy();String id=old.story().getId();
  workflow.initializeExisting();
  assertThat(workflow.workspace(id).reviewState()).isEqualTo("in_review");
  assertThat(stories.findById(id).orElseThrow().getPublishedRevision()).isNull();
  int original=jdbc.queryForObject("select story_revision from game_sessions where id=?",Integer.class,old.save().getId());
  workflow.importDraft(json.write(doc(old.story().getKey(),"new_scene")),null);
  workflow.submit(id,null,workflow.workspace(id).generation(),true,admin);
  var current=workflow.workspace(id);
  workflow.decide(id,"approve-publish",new StoryWorkflowService.Decision(current.generation(),current.submittedRevision(),"","","public",false),admin);
  assertThat(jdbc.queryForObject("select story_revision from game_sessions where id=?",Integer.class,old.save().getId())).isEqualTo(original);
  // The pre-moderation version was never approved: preserve its save, but require a fresh run.
  assertThatThrownBy(()->new StoryAccessService(versions,json,jdbc).atRevision(old.story(),original))
   .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("409");
 }
}
