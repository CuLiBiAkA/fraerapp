package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** The sole owner of draft, review, publication and availability transitions. */
@Service
class StoryWorkflowService {
 private final StoryRepository stories;
 private final StoryVersionRepository versions;
 private final StoryAdminService content;
 private final PlayerRepository players;
 private final JdbcTemplate jdbc;
 private final JsonSupport json;
 private final AccountService accounts;
 private final String legacyPolicy;
 @jakarta.persistence.PersistenceContext
 private jakarta.persistence.EntityManager entityManager;
 StoryWorkflowService(StoryRepository stories, StoryVersionRepository versions, StoryAdminService content,
   PlayerRepository players, JdbcTemplate jdbc, JsonSupport json, AccountService accounts,
   @Value("${app.moderation.legacy-policy:review}") String legacyPolicy) {
  this.stories=stories;this.versions=versions;this.content=content;this.players=players;
  this.jdbc=jdbc;this.json=json;this.accounts=accounts;this.legacyPolicy=legacyPolicy;
 }
 record Workspace(String draftJson,int draftRevision,Integer submittedRevision,String reviewState,String reason,
   Instant submittedAt,Instant decidedAt,String reviewerId,boolean restricted,int generation) {}
 record Decision(int generation,Integer revision,String reason,String internalNote,String visibility,Boolean ownOverride) {}

 Workspace workspace(String id) {
  return jdbc.query("select * from story_workspaces where story_id=?",(r,n)->new Workspace(r.getString("draft_json"),
   r.getInt("draft_revision"),(Integer)r.getObject("submitted_revision"),r.getString("review_state"),r.getString("decision_reason"),
   r.getTimestamp("submitted_at")==null?null:r.getTimestamp("submitted_at").toInstant(),
   r.getTimestamp("decided_at")==null?null:r.getTimestamp("decided_at").toInstant(),r.getString("reviewer_id"),r.getBoolean("restricted"),r.getInt("generation")),id)
   .stream().findFirst().orElseThrow(StoryNotFoundException::new);
 }
 Story lock(String id) {
  if(jdbc.queryForList("select id from stories where id=? for update",id).isEmpty())throw new StoryNotFoundException();
  Story story=stories.findById(id).orElseThrow(StoryNotFoundException::new);
  // An import may already have loaded this entity before waiting on the row lock.
  entityManager.refresh(story);
  return story;
 }
 private void owner(Story story,String playerId) {
  if(playerId==null || !playerId.equals(story.getOwnerPlayerId()))throw new ForbiddenRoleException();
 }
 private boolean owns(Story story,AuthIdentity actor) {
  return story.getOwnerPlayerId()!=null && players.findById(story.getOwnerPlayerId()).map(p->actor.userId().equals(p.getUserId())).orElse(false);
 }
 private void editable(Story s) {
  if("deleted".equals(s.getVisibility()))throw conflict("Restore the story before editing");
 }
 private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT,message); }
 private void expected(Workspace w,int generation) {if(w.generation()!=generation)throw conflict("Story changed. Reload before retrying.");}
 private String reason(String value,boolean required) {
  String clean=value==null?"":value.strip();
  if(clean.length()>2000 || (required&&clean.isEmpty()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A reason of 1–2000 characters is required");
  return clean;
 }
 private int snapshot(Story s,String body,String note) {
  int number=jdbc.queryForObject("select coalesce(max(version_number),0)+1 from story_versions where story_id=?",Integer.class,s.getId());
  versions.saveAndFlush(new StoryVersion(s.getId(),number,StoryStatus.DRAFT,body,note));
  return number;
 }
 StoryDocument revision(String id,int number) {
  return json.readStory(versions.findByStoryIdAndVersionNumber(id,number).orElseThrow(StoryNotFoundException::new).getSnapshotJson());
 }
 Map<String,Object> document(String id,int number) {
  return json.readMap(versions.findByStoryIdAndVersionNumber(id,number).orElseThrow(StoryNotFoundException::new).getSnapshotJson());
 }
 @Transactional
 void initializeExisting() {
  for(Story s:stories.findAll()) {
   s=lock(s.getId());
   if(jdbc.queryForObject("select count(*) from story_workspaces where story_id=?",Integer.class,s.getId())>0)continue;
   String body=json.write(content.exportStoryDocument(s));
   int rev=snapshot(s,body,"moderation_baseline");
   boolean wasPublished=s.getStatus()==StoryStatus.PUBLISHED;
   boolean approved=wasPublished&&"approve".equals(legacyPolicy);
   s.setVisibility(approved?"public":s.getStatus()==StoryStatus.ARCHIVED?"archived":"private");
   s.setPublishedRevision(approved?rev:null);
   s.setStatus(approved?StoryStatus.PUBLISHED:StoryStatus.DRAFT);
   stories.saveAndFlush(s);
   jdbc.update("insert into story_workspaces(story_id,draft_json,draft_revision,submitted_revision,review_state,submitted_at) values (?,?,?,?,?,?)",
    s.getId(),body,rev,wasPublished?rev:null,approved?"approved":wasPublished?"in_review":"draft",wasPublished?java.sql.Timestamp.from(Instant.now()):null);
   if(wasPublished) {
    event(s,rev,new AuthIdentity("deployment-owner",null,List.of("admin")),approved?"migration_approved":"migration_review",
     approved?"Existing publication approved by the owner for moderation rollout":"Existing publication awaits moderation","","published",s.getVisibility());
   }
   // Archived/private legacy saves also belong to this snapshot, never to a later release.
   jdbc.update("update game_sessions set story_revision=? where story_id=? and story_revision is null",rev,s.getId());
  }
 }
 @Transactional
 Map<String,Object> importDraft(String body,String playerId) {
  return importDraft(body,playerId,playerId);
 }
 @Transactional
 Map<String,Object> importAdminDraft(String body,String creatorPlayerId) {
  return importDraft(body,null,Objects.requireNonNull(creatorPlayerId));
 }
 private Map<String,Object> importDraft(String body,String playerId,String newOwnerPlayerId) {
  StoryDocument doc=json.readStory(body);
  var valid=content.validate(doc);
  if(!valid.valid())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,String.join("; ",valid.errors()));
  checkMedia(doc,true);
  Story s=stories.findByKey(doc.key()).orElse(null);
  if(s==null) {
   s=new Story(doc.key());s.setOwnerPlayerId(newOwnerPlayerId);checkMediaOwnership(doc,s.getId());
   s=content.applyDocument(s,doc,StoryStatus.DRAFT);
   stories.flush();
   int revision=snapshot(s,body,"draft");
   jdbc.update("insert into story_workspaces(story_id,draft_json,draft_revision) values (?,?,?)",s.getId(),body,revision);
  } else {
   s=lock(s.getId());if(playerId!=null)owner(s,playerId);editable(s);
   checkMediaOwnership(doc,s.getId());
   Workspace w=workspace(s.getId());
   if(!json.readMap(w.draftJson()).equals(json.readMap(body))) {
    s.touch();stories.saveAndFlush(s);
    int revision=snapshot(s,body,"draft");
    jdbc.update("update story_workspaces set draft_json=?,draft_revision=?,generation=generation+1 where story_id=?",body,revision,s.getId());
   }
  }
  return summary(s,workspace(s.getId()));
 }
 @Transactional
 Map<String,Object> submit(String id,String playerId,int generation,boolean replaceReview,AuthIdentity actor) {
  Story s=lock(id);if(playerId!=null)owner(s,playerId);editable(s);Workspace w=workspace(id);expected(w,generation);
  if("in_review".equals(w.reviewState())&&Objects.equals(w.submittedRevision(),w.draftRevision()))return summary(s,w);
  if("in_review".equals(w.reviewState())&&!replaceReview)throw conflict("Confirm replacement of the previous submission");
  if(Objects.equals(s.getPublishedRevision(),w.draftRevision()))throw conflict("This revision is already published");
  checkMedia(json.readStory(w.draftJson()));
  var valid=content.validate(json.readStory(w.draftJson()));
  if(!valid.valid())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,String.join("; ",valid.errors()));
  if("in_review".equals(w.reviewState()))event(s,w.submittedRevision(),actor,"superseded","","",w.reviewState(),"superseded");
  jdbc.update("update story_workspaces set submitted_revision=draft_revision,review_state='in_review',decision_reason='',submitted_at=current_timestamp,decided_at=null,reviewer_id=null,generation=generation+1 where story_id=?",id);
  event(s,w.draftRevision(),actor,"submitted","","",w.reviewState(),"in_review");
  return summary(s,workspace(id));
 }
 @Transactional
 Map<String,Object> withdraw(String id,String playerId,int generation,AuthIdentity actor) {
  Story s=lock(id);owner(s,playerId);Workspace w=workspace(id);expected(w,generation);
  if(!"in_review".equals(w.reviewState()))throw conflict("No active submission");
  jdbc.update("update story_workspaces set submitted_revision=null,review_state='draft',generation=generation+1 where story_id=?",id);
  event(s,w.submittedRevision(),actor,"withdrawn","","",w.reviewState(),"draft");return summary(s,workspace(id));
 }
 @Transactional
 Map<String,Object> rollback(String id,String playerId,int number) {
  Story s=lock(id);if(playerId!=null)owner(s,playerId);editable(s);
  String body=json.write(document(id,number));int revision=snapshot(s,body,"restore_draft_"+number);
  jdbc.update("update story_workspaces set draft_json=?,draft_revision=?,generation=generation+1 where story_id=?",body,revision,id);
  return summary(s,workspace(id));
 }
 @Transactional
 Map<String,Object> decide(String id,String action,Decision command,AuthIdentity actor) {
  if(!actor.hasRole("moderator")&&!actor.hasRole("admin"))throw new ForbiddenRoleException();
  Story s=lock(id);Workspace w=workspace(id);expected(w,command.generation());
  boolean self=owns(s,actor);
  boolean approving=List.of("approve","approve-publish").contains(action);
  boolean restoring=List.of("restore","visibility","publish-approved").contains(action);
  if(self&&(approving||restoring)&&(!actor.hasRole("admin")||!Boolean.TRUE.equals(command.ownOverride())))throw new ForbiddenRoleException();
  String why=reason(command.reason(),!approving||self);
  String note=reason(command.internalNote(),false);
  String before=s.getVisibility()+":"+w.reviewState();
  if("publish-approved".equals(action)) {
   if(!"approved".equals(w.reviewState()) || !Objects.equals(w.submittedRevision(),command.revision()))throw conflict("Select the approved revision");
   if(w.restricted() || List.of("hidden","archived","deleted").contains(s.getVisibility()))throw conflict("Restore availability explicitly first");
   s=publishRevision(s,command.revision(),command.visibility());
   jdbc.update("update story_workspaces set generation=generation+1 where story_id=?",id);
  } else if(approving||"reject".equals(action)) {
   if(!"in_review".equals(w.reviewState())||!Objects.equals(command.revision(),w.submittedRevision()))throw conflict("The reviewed submission is no longer current");
   editable(s);
   if(approving) {
    StoryDocument doc=revision(id,command.revision());
    var valid=content.validate(doc);if(!valid.valid())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,String.join("; ",valid.errors()));
    checkMedia(doc);
    if("approve-publish".equals(action)) {
     if(w.restricted()||List.of("hidden","archived","deleted").contains(s.getVisibility()))throw conflict("Restore availability explicitly before publication");
     s=publishRevision(s,command.revision(),command.visibility());
    }
   }
   jdbc.update("update story_workspaces set review_state=?,decision_reason=?,decided_at=current_timestamp,reviewer_id=?,generation=generation+1 where story_id=?",
    approving?"approved":"rejected",why,actor.userId(),id);
  } else {
   String next=switch(action) {case "hide"->"hidden";case "archive"->"archived";case "delete"->"deleted";case "restore"->"private";case "visibility"->command.visibility();default->throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown moderation action");};
   if(next==null||!List.of("public","unlisted","private","hidden","archived","deleted").contains(next))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown visibility");
   if(w.restricted()&&List.of("public","unlisted").contains(next))throw conflict("Restore availability explicitly first");
   if("deleted".equals(s.getVisibility())&&!"restore".equals(action))throw conflict("Restore the story first");
   if("restore".equals(action)&&!List.of("deleted","hidden","archived").contains(s.getVisibility()))throw conflict("Story is not restricted");
   if(List.of("public","unlisted").contains(next)&&s.getPublishedRevision()==null)throw conflict("Publish an approved revision explicitly first");
   s.setVisibility(next);s.setStatus(List.of("public","unlisted").contains(next)?StoryStatus.PUBLISHED:StoryStatus.ARCHIVED);
   stories.saveAndFlush(s);
   jdbc.update("update story_workspaces set restricted=?,decision_reason=?,generation=generation+1 where story_id=?",List.of("hidden","archived","deleted").contains(next),why,id);
  }
  Workspace after=workspace(id);
  event(s,command.revision(),actor,action,why,note,before,s.getVisibility()+":"+after.reviewState());
  notifyAuthor(s,action,why,command.revision(),actor.userId());
  return summary(s,after);
 }
 @Transactional
 Map<String,Object> takeDown(String id,String playerId,boolean delete,AuthIdentity actor) {
  Story s=lock(id);owner(s,playerId);Workspace w=workspace(id);
  if(w.restricted())throw new ForbiddenRoleException();
  if(delete&&s.getPublishedRevision()!=null)throw conflict("Published stories can be archived, not deleted by the author");
  String before=s.getVisibility();s.setVisibility(delete?"deleted":"archived");s.setStatus(StoryStatus.ARCHIVED);stories.saveAndFlush(s);
  jdbc.update("update story_workspaces set submitted_revision=null,review_state=case when review_state='in_review' then 'draft' else review_state end,generation=generation+1 where story_id=?",id);
  event(s,w.draftRevision(),actor,delete?"author_delete":"author_archive","","",before,s.getVisibility());return summary(s,workspace(id));
 }
 private Story publishRevision(Story s,int revision,String visibility) {
  if(visibility!=null&&!List.of("public","unlisted").contains(visibility))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Publication visibility must be public or unlisted");
  StoryDocument doc=revision(s.getId(),revision);checkMedia(doc);checkMediaOwnership(doc,s.getId());
  var valid=content.validate(doc);if(!valid.valid())throw conflict(String.join("; ",valid.errors()));
  s=content.applyDocument(s,doc,StoryStatus.PUBLISHED);
  s.setPublishedRevision(revision);s.setVisibility("unlisted".equals(visibility)?"unlisted":"public");
  if(s.getPublishedSlug()==null)s.setPublishedSlug(content.uniqueSlug(s.getKey(),s.getTitle()));
  s.setPublishedAt(Instant.now());stories.saveAndFlush(s);
  if("public".equals(s.getVisibility()))accounts.published(s.getId(),s.getTitle());
  return s;
 }
 @Transactional(readOnly=true)
 StoryValidationResult validateDraft(String id,String playerId) {
  Story s=stories.findById(id).orElseThrow(StoryNotFoundException::new);
  if(playerId!=null)owner(s,playerId);
  return content.validate(json.readStory(workspace(id).draftJson()));
 }
 @Transactional(readOnly=true)
 Map<String,Object> preview(String id,String playerId,boolean moderation,String selection) {
  Story s=stories.findById(id).orElseThrow(StoryNotFoundException::new);
  if(!moderation)owner(s,playerId);Workspace w=workspace(id);
  Integer number=switch(selection) {
   case "draft"->w.draftRevision();case "submitted"->w.submittedRevision();case "published"->s.getPublishedRevision();
   default->{try {yield Integer.valueOf(selection);}catch(NumberFormatException ex){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown revision");}}
  };
  if(number==null)throw new StoryNotFoundException();
  Map<String,Object> result=new LinkedHashMap<>();
  result.put("storyId",id);result.put("revision",number);result.put("status",selection);result.put("privatePreview",true);
  result.put("document",document(id,number));result.put("publishedDocument",s.getPublishedRevision()==null?null:document(id,s.getPublishedRevision()));
  result.put("validation",content.validate(revision(id,number)));return result;
 }
 @Transactional
 void putDraftAsset(String id,String playerId,String key,String type,String url,Map<String,Object> metadata) {
  Story s=lock(id);owner(s,playerId);editable(s);Map<String,Object> doc=json.readMap(workspace(id).draftJson());
  var assets=new ArrayList<Map<String,Object>>(mapList(doc.get("assets")));
  assets.removeIf(a->key.equals(a.get("id")));assets.add(Map.of("id",key,"type",type,"url",url,"metadata",metadata));
  doc.put("assets",assets);saveDraft(s,doc);
 }
 @Transactional
 void removeDraftAsset(String id,String playerId,String key,String url) {
  Story s=lock(id);owner(s,playerId);editable(s);Map<String,Object> doc=json.readMap(workspace(id).draftJson());
  if(url!=null&&!url.isBlank()&&!url.startsWith("/uploads/"+id+"/"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Only this story's uploads may be removed");
  var assets=new ArrayList<Map<String,Object>>(mapList(doc.get("assets")));
  assets.removeIf(a->Objects.equals(key,a.get("id"))&&(url==null||url.isBlank()||url.equals(a.get("url"))));
  doc.put("assets",assets);saveDraft(s,doc);
  // Revision files are immutable. References in published versions and saves retain their bytes.
 }
 @SuppressWarnings("unchecked")
 private List<Map<String,Object>> mapList(Object value) {return value instanceof List<?>?(List<Map<String,Object>>)value:List.of();}
 private void saveDraft(Story s,Map<String,Object> doc) {
  String body=json.write(doc);int revision=snapshot(s,body,"draft");s.touch();stories.saveAndFlush(s);
  jdbc.update("update story_workspaces set draft_json=?,draft_revision=?,generation=generation+1 where story_id=?",body,revision,s.getId());
 }
 private void checkMediaOwnership(StoryDocument doc,String id) {
  List<StoryDocument.AssetDocument> all=new ArrayList<>(doc.assets()==null?List.of():doc.assets());
  if(doc.scenes()!=null)for(var scene:doc.scenes())if(scene.assets()!=null)all.addAll(scene.assets());
  for(var asset:all)if(asset.url()!=null&&asset.url().startsWith("/uploads/")&&!asset.url().startsWith("/uploads/"+id+"/"))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload resources to this story before referencing them");
 }
 private void notifyAuthor(Story s,String action,String reason,Integer revision,String reviewer) {
  if(s.getOwnerPlayerId()==null)return;
  players.findById(s.getOwnerPlayerId()).filter(p->p.getUserId()!=null).ifPresent(p->jdbc.update(
   "insert into account_notifications(id,user_id,kind,message,story_id,revision,reviewer_id) values (?,?,'moderation',?,?,?,?)",UUID.randomUUID().toString(),p.getUserId(),
   notificationText(s,action,reason),s.getId(),revision,reviewer));
 }
 private String notificationText(Story s,String action,String reason) {
  String message=json.readStory(workspace(s.getId()).draftJson()).title()+": "+switch(action) {
   case "approve","approve-publish"->"редакция одобрена";case "publish-approved"->"редакция опубликована";
   case "reject"->"нужны исправления";case "delete"->"история в корзине";case "restore"->"история восстановлена";default->"изменена видимость";
  }+(reason.isBlank()?"":". "+reason);
  return message.substring(0,Math.min(2000,message.length()));
 }
 private void event(Story s,Integer revision,AuthIdentity actor,String action,String reason,String note,String before,String after) {
  jdbc.update("insert into story_moderation_events(id,story_id,revision,actor_id,actor_role,action,reason,internal_note,before_state,after_state) values (?,?,?,?,?,?,?,?,?,?)",
   UUID.randomUUID().toString(),s.getId(),revision,actor.userId(),actor.hasRole("admin")?"admin":actor.hasRole("moderator")?"moderator":"author",action,reason,note,before,after);
 }
 @Transactional(readOnly=true)
 List<Map<String,Object>> mine(String playerId) {
  return stories.findByOwnerPlayerIdOrderByUpdatedAtDesc(playerId).stream().map(s->summary(s,workspace(s.getId()))).toList();
 }
 @Transactional(readOnly=true)
 Map<String,Object> details(String id,String playerId,boolean moderation) {
  Story s=stories.findById(id).orElseThrow(StoryNotFoundException::new);if(!moderation)owner(s,playerId);
  Workspace w=workspace(id);Map<String,Object> result=summary(s,w);
  result.put("draftDocument",json.readMap(w.draftJson()));
  result.put("submittedDocument",w.submittedRevision()==null?null:document(id,w.submittedRevision()));
  result.put("publishedDocument",s.getPublishedRevision()==null?null:document(id,s.getPublishedRevision()));
  result.put("versions",content.versions(id,moderation?null:playerId));
  result.put("events",jdbc.query("select * from story_moderation_events where story_id=? order by created_at desc,id desc",(r,n)->{
   Map<String,Object> e=new LinkedHashMap<>();e.put("id",r.getString("id"));e.put("revision",r.getObject("revision"));e.put("action",r.getString("action"));e.put("reason",r.getString("reason"));e.put("createdAt",r.getTimestamp("created_at").toInstant());
   e.put("actorId",r.getString("actor_id"));e.put("actorRole",r.getString("actor_role"));e.put("beforeState",r.getString("before_state"));e.put("afterState",r.getString("after_state"));
   if(moderation){e.put("actorId",r.getString("actor_id"));e.put("internalNote",r.getString("internal_note"));}return e;
  },id));return result;
 }
 @Transactional(readOnly=true)
 Map<String,Object> list(int page,int size,String query,String status,String visibility) {
  int limit=Math.max(1,Math.min(100,size)),safePage=Math.max(0,Math.min(100000,page));
  List<Object> args=new ArrayList<>();StringBuilder where=new StringBuilder(" where 1=1");
  if(query!=null&&!query.isBlank()) {
   where.append(" and (lower(w.draft_json) like ? escape '!' or lower(concat('Автор #',substring(s.owner_player_id,1,8))) like ? escape '!')");
   String q="%"+query.strip().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%";args.add(q);args.add(q);
  }
  if(status!=null&&!"all".equals(status)){where.append(" and w.review_state=?");args.add(status);}
  if(visibility!=null&&!"all".equals(visibility)){where.append(" and s.visibility=?");args.add(visibility);}
  String from=" from stories s join story_workspaces w on w.story_id=s.id left join players p on p.id=s.owner_player_id";
  long total=jdbc.queryForObject("select count(*)"+from+where,Long.class,args.toArray());
  args.add(limit);args.add(safePage*limit);
  var ids=jdbc.query("select s.id"+from+where+" order by case when w.review_state='in_review' then 0 else 1 end,w.submitted_at asc nulls last,s.updated_at desc,s.id limit ? offset ?",(r,n)->r.getString(1),args.toArray());
  return Map.of("page",safePage,"size",limit,"totalElements",total,"totalPages",(total+limit-1)/limit,
   "items",ids.stream().map(id->summary(stories.findById(id).orElseThrow(),workspace(id))).toList());
 }
 Map<String,Object> summary(Story s,Workspace w) {
  var doc=json.readStory(w.draftJson());Map<String,Object> m=new LinkedHashMap<>();
  m.put("storyId",s.getId());m.put("key",s.getKey());m.put("title",doc.title());m.put("description",doc.description());
  m.put("status",s.getStatus().name().toLowerCase());m.put("visibility",s.getVisibility());m.put("publishedSlug",s.getPublishedSlug());
  m.put("publishedAt",s.getPublishedAt());m.put("updatedAt",s.getUpdatedAt());m.put("draftRevision",w.draftRevision());m.put("versionNumber",w.draftRevision());
  m.put("publishedRevision",s.getPublishedRevision());m.put("submittedRevision",w.submittedRevision());m.put("reviewState",w.reviewState());
  m.put("hasDraft",!Objects.equals(s.getPublishedRevision(),w.draftRevision())&&(!Objects.equals(w.submittedRevision(),w.draftRevision())||!List.of("in_review","approved").contains(w.reviewState())));
  m.put("reason",w.reason());m.put("submittedAt",w.submittedAt());m.put("decidedAt",w.decidedAt());m.put("reviewerId",w.reviewerId());m.put("restricted",w.restricted());m.put("generation",w.generation());
  m.put("ownerUserId",s.getOwnerPlayerId()==null?null:players.findById(s.getOwnerPlayerId()).map(Player::getUserId).orElse(null));
  m.put("ownerName",s.getOwnerPlayerId()==null?"System":"Автор #"+s.getOwnerPlayerId().substring(0,8));
  m.put("totalRuns",jdbc.queryForObject("select count(*) from game_sessions where story_id=?",Long.class,s.getId()));
  m.put("finishedRuns",jdbc.queryForObject("select count(*) from game_sessions where story_id=? and status='FINISHED'",Long.class,s.getId()));return m;
 }
 void checkMedia(StoryDocument document) {checkMedia(document,false);}
 private void checkMedia(StoryDocument document,boolean allowPlaceholders) {
  List<StoryDocument.AssetDocument> resources=new ArrayList<>(document.assets()==null?List.of():document.assets());
  if(document.scenes()!=null)for(var scene:document.scenes())if(scene.assets()!=null)resources.addAll(scene.assets());
  for(var asset:resources) {
   String url=asset.url();
   if(allowPlaceholders&&(url==null||url.isBlank()))continue;
   if(url==null||!(url.startsWith("/uploads/")||url.startsWith("/assets/"))||url.contains("..")||url.contains("?")||url.contains("#")||url.contains("%")||url.contains("\\"))
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use uploaded or bundled media; external mutable resources cannot be reviewed");
  }
 }
}
