package com.fraergod.fraerapp.game;

import java.nio.file.*;
import java.util.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
class StoryMediaController {
 private final StoryRepository stories;private final PlayerRepository players;private final CurrentUserService user;
 private final StoryAssetStorageService storage;private final StoryWorkflowService workflow;private final JdbcTemplate jdbc;
 private final CollectionService collections;private final StoryAccessService access;
 StoryMediaController(StoryRepository stories,PlayerRepository players,CurrentUserService user,StoryAssetStorageService storage,StoryWorkflowService workflow,JdbcTemplate jdbc,CollectionService collections,StoryAccessService access) {
  this.stories=stories;this.players=players;this.user=user;this.storage=storage;this.workflow=workflow;this.jdbc=jdbc;this.collections=collections;this.access=access;
 }
 @GetMapping("/uploads/{id}/{filename}")
 @Transactional(readOnly=true)
 ResponseEntity<FileSystemResource> media(@PathVariable String id,@PathVariable String filename) {
  if(!id.matches("[a-zA-Z0-9_-]+")||!filename.matches("[a-zA-Z0-9_.-]+")||filename.contains(".."))throw new StoryNotFoundException();
  Story story=stories.findById(id).orElse(null);
  var collection=story==null?collections.row(id):null;
  var identity=user.optionalIdentity();
  String ownerId=story==null?collection.owner():story.getOwnerPlayerId();
  boolean owner=identity.isPresent()&&ownerId!=null&&players.findById(ownerId).map(p->identity.get().userId().equals(p.getUserId())).orElse(false);
  boolean moderator=identity.map(a->a.hasRole("admin")||a.hasRole("moderator")).orElse(false);
  String url="/uploads/"+id+"/"+filename;
  if(!owner&&!moderator) {
   if(story==null){
    collections.accessible(collection.id(),identity.isEmpty());
    if(!url.equals(collections.document(collection,collection.published()).coverUrl()))throw new StoryNotFoundException();
   }else{
    if(!access.readable(story)||(identity.isEmpty()&&!GuestDemoStories.includes(story.getKey())))throw new StoryNotFoundException();
    Set<Integer> published=new HashSet<>(jdbc.query("select distinct revision from story_moderation_events where story_id=? and action in ('approve-publish','publish-approved','migration_approved') and revision is not null",(r,n)->r.getInt(1),id));
    published.add(story.getPublishedRevision());
    if(published.stream().noneMatch(rev->references(workflow.revision(id,rev),url)))throw new StoryNotFoundException();
   }
  }
  Path file=storage.rootPath().resolve(id).resolve(filename).normalize();
  if(!file.startsWith(storage.rootPath())||!Files.isRegularFile(file))throw new StoryNotFoundException();
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Content-Security-Policy","sandbox; default-src 'none'; style-src 'unsafe-inline'")
   .header("X-Content-Type-Options","nosniff").header("X-Robots-Tag","noindex, nofollow")
   .contentType(type(filename)).body(new FileSystemResource(file));
 }
 private boolean references(StoryDocument doc,String url) {
  if(doc.metadata()!=null&&url.equals(doc.metadata().coverUrl()))return true;
  if(doc.assets()!=null&&doc.assets().stream().anyMatch(a->url.equals(a.url())))return true;
  return doc.scenes()!=null&&doc.scenes().stream().anyMatch(s->s.assets()!=null&&s.assets().stream().anyMatch(a->url.equals(a.url())));
 }
 static MediaType type(String filename) {
  String ext=filename.substring(filename.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);
  return MediaType.parseMediaType(switch(ext) {case "png"->"image/png";case "jpg","jpeg"->"image/jpeg";case "gif"->"image/gif";case "webp"->"image/webp";case "svg"->"image/svg+xml";case "mp3"->"audio/mpeg";case "wav"->"audio/wav";case "ogg"->"audio/ogg";case "webm"->"audio/webm";default->"application/octet-stream";});
 }
}
