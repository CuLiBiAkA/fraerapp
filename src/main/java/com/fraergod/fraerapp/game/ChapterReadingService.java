package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import static com.fraergod.fraerapp.game.WorkLinksService.*;

/** Reading chains pin TOCs and immutable child saves; all mutations serialize per reader. */
@Service
class ChapterReadingService {
 private final CollectionService collections;
 private final GameService game;
 private final GameSessionRepository sessions;
 private final StoryRepository stories;
 private final StoryAccessService access;
 private final WorkLinksService links;
 private final JsonSupport json;
 private final JdbcTemplate jdbc;
 ChapterReadingService(CollectionService collections,GameService game,GameSessionRepository sessions,StoryRepository stories,StoryAccessService access,WorkLinksService links,JsonSupport json,JdbcTemplate jdbc){this.collections=collections;this.game=game;this.sessions=sessions;this.stories=stories;this.access=access;this.links=links;this.json=json;this.jdbc=jdbc;}
 record Start(String targetId,String sourceSessionId,String requestId,Boolean newAttempt) {}
 record Run(String id,String player,String collection,int revision,int generation) {}
 private Run run(String id,String player){return jdbc.query("select * from collection_runs where id=? and player_id=?",(r,n)->new Run(r.getString("id"),r.getString("player_id"),r.getString("collection_id"),r.getInt("collection_revision"),r.getInt("generation")),id,player).stream().findFirst().orElseThrow(SessionNotFoundException::new);}
 private void request(String id){if(id==null||id.isBlank()||id.length()>120)throw bad("A unique requestId (1–120 characters) is required");}
 @Transactional
 Map<String,Object> begin(String id,String player,String requestId){request(requestId);game.lockReader(player);var c=collections.accessible(id,false);
  var old=jdbc.queryForList("select id,collection_id from collection_runs where player_id=? and request_id=?",player,requestId);
  if(!old.isEmpty()){if(!c.id().equals(old.get(0).get("collection_id")))throw conflict("Request was already used for another collection");return detail((String)old.get(0).get("id"),player);}
  String runId=UUID.randomUUID().toString();jdbc.update("insert into collection_runs(id,player_id,collection_id,collection_revision,request_id) values (?,?,?,?,?)",runId,player,c.id(),c.published(),requestId);return detail(runId,player);
 }
 @Transactional(readOnly=true)
 List<Map<String,Object>> runs(String id,String player){var c=collections.accessible(id,false);return jdbc.query("select id from collection_runs where collection_id=? and player_id=? order by created_at desc limit 100",(r,n)->r.getString(1),c.id(),player).stream().map(r->detail(r,player)).toList();}
 @Transactional(readOnly=true)
 Map<String,Object> detail(String id,String player){Run r=run(id,player);var c=collections.accessible(r.collection(),false);var d=collections.document(c,r.revision());
  var m=new LinkedHashMap<String,Object>();m.put("id",r.id());m.put("runId",r.id());m.put("collectionId",c.id());m.put("title",d.title());m.put("key",c.key());m.put("revision",r.revision());m.put("generation",r.generation());m.put("availableRevision",c.published());m.put("completionStatus",d.completionStatus());
  var saves=new HashMap<String,Map<String,Object>>();for(var s:jdbc.queryForList("select t.story_id as target_story_id,t.session_id as target_session_id,g.status,g.story_revision from collection_run_saves t join game_sessions g on g.id=t.session_id where t.run_id=?",id))saves.put((String)s.get("target_story_id"),s);
  var items=collections.publicItems(d,false).stream().filter(item->"scenario".equals(item.get("kind"))).toList();int finished=0;for(var item:items){var save=saves.get(item.get("id"));if(save!=null){item.put("sessionId",save.get("target_session_id"));String status=save.get("status").toString().toLowerCase(Locale.ROOT);item.put("status",status);item.put("storyRevision",save.get("story_revision"));if("finished".equals(status))finished++;}}
  Set<Object> visibleIds=new HashSet<>();for(var item:items)visibleIds.add(item.get("id"));
  for(var item:items){String previous=null;for(int i=1;i<list(d.items()).size();i++)if(Objects.equals(item.get("id"),d.items().get(i).target().id())){String actual=d.items().get(i-1).target().id();if(visibleIds.contains(actual))previous=actual;break;}item.put("previousId",previous);}
  m.put("items",items);m.put("availableCount",items.size());m.put("completedCount",finished);m.put("allReleasedRead",!items.isEmpty()&&finished==items.size());return m;
 }
 @Transactional
 Map<String,Object> update(String id,String player,int generation){game.lockReader(player);Run r=run(id,player);var c=collections.accessible(r.collection(),false);if(r.generation()!=generation)throw conflict("Reading chain changed. Reload before retrying.");jdbc.update("update collection_runs set collection_revision=?,generation=generation+1 where id=?",c.published(),id);return detail(id,player);}
 private GameSession ownedSession(String id,String player){var s=sessions.findById(id).orElseThrow(SessionNotFoundException::new);if(!player.equals(s.getPlayerId()))throw new ForbiddenSessionException();return s;}
 private Story runtime(GameSession s){var live=stories.findById(s.getStoryId()).orElseThrow(StoryNotFoundException::new);return access.atRevision(live,s.getStoryRevision());}
 private Story target(String id){var s=stories.findById(id).filter(StoryAccessService::listed).orElseThrow(StoryNotFoundException::new);return access.atRevision(s,s.getPublishedRevision());}
 @Transactional(readOnly=true)
 Map<String,Object> entryContext(String slug,String player,boolean guest){var live=stories.findByPublishedSlug(slug).filter(StoryAccessService::available).orElseThrow(StoryNotFoundException::new);if(guest&&!GuestDemoStories.includes(live.getKey()))throw new AuthRequiredException();var target=access.atRevision(live,live.getPublishedRevision()).getRuntimeDocument();var contract=target.metadata()==null?null:target.metadata().inputContract();var result=new LinkedHashMap<String,Object>();result.put("allowIndependentStart",contract==null||Boolean.TRUE.equals(contract.allowIndependentStart()));result.put("parents",StoryAccessService.listed(live)?collections.breadcrumbs("scenario",live.getId(),guest):List.of());var prerequisites=new ArrayList<Map<String,Object>>();var sources=new ArrayList<Map<String,Object>>();
  if(!guest&&StoryAccessService.listed(live)){
   for(var r:jdbc.queryForList("select s.id,s.story_key,s.title,s.published_slug,v.snapshot_json from stories s join story_versions v on v.story_id=s.id and v.version_number=s.published_revision where s.status='PUBLISHED' and s.visibility='public' and s.metadata_json is not null and s.owner_player_id=?",live.getOwnerPlayerId())){
    var d=json.readStory((String)r.get("snapshot_json"));if(d.metadata()==null)continue;
    if(list(d.metadata().relations()).stream().anyMatch(link->relationTargets(link,live)&&link.stateTransfer()!=null))prerequisites.add(Map.of("id",r.get("id"),"key",r.get("story_key"),"title",r.get("title"),"slug",r.get("published_slug")));
   }
   if(player!=null)for(var r:jdbc.queryForList("select g.id,g.save_name,g.story_id,g.story_revision,s.published_slug,v.snapshot_json from game_sessions g join stories s on s.id=g.story_id join story_versions v on v.story_id=g.story_id and v.version_number=g.story_revision where g.player_id=? and g.status='FINISHED' and s.status='PUBLISHED' and s.visibility='public' order by g.updated_at desc limit 100",player)){
    var sourceLive=stories.findById((String)r.get("story_id")).orElseThrow();if(!Objects.equals(sourceLive.getOwnerPlayerId(),live.getOwnerPlayerId())||!access.supportsRevision(sourceLive,(Integer)r.get("story_revision")))continue;var d=json.readStory((String)r.get("snapshot_json"));
    for(var link:d.metadata()==null?List.<WorkMetadata.Relation>of():list(d.metadata().relations()))if(link.stateTransfer()!=null&&relationTargets(link,live))sources.add(Map.of("sourceSessionId",r.get("id"),"relationId",link.id(),"sourceTitle",d.title(),"sourceSlug",r.get("published_slug"),"saveName",r.get("save_name")));
   }
  }
  result.put("prerequisites",prerequisites);result.put("sources",sources);return result;
 }
 private boolean relationTargets(WorkMetadata.Relation link,Story target){var t=link.target();return t!=null&&"scenario".equals(t.kind())&&(t.id()!=null?t.id().equals(target.getId()):Objects.equals(t.key(),target.getKey()));}
 @Transactional
 Map<String,Object> start(String id,String player,Start command){request(command.requestId());game.lockReader(player);Run r=run(id,player);var c=collections.accessible(r.collection(),false);var d=collections.document(c,r.revision());
  if(collections.publicItems(d,false).stream().noneMatch(i->"scenario".equals(i.get("kind"))&&Objects.equals(i.get("id"),command.targetId())))throw new StoryNotFoundException();
  Story target=target(command.targetId());
  if(Boolean.TRUE.equals(command.newAttempt())) {
   String forkRequest="fork:"+UUID.nameUUIDFromBytes((id+":"+command.requestId()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
   var prior=jdbc.query("select id from collection_runs where player_id=? and request_id=?",(rs,n)->rs.getString(1),player,forkRequest);
   String branch=prior.isEmpty()?UUID.randomUUID().toString():prior.get(0);
   if(prior.isEmpty()){
    jdbc.update("insert into collection_runs(id,player_id,collection_id,collection_revision,request_id) values (?,?,?,?,?)",branch,player,c.id(),r.revision(),forkRequest);
    for(var item:list(d.items())){if(Objects.equals(item.target().id(),command.targetId()))break;jdbc.update("insert into collection_run_saves(run_id,story_id,session_id) select ?,story_id,session_id from collection_run_saves where run_id=? and story_id=?",branch,id,item.target().id());}
   }
   return start(branch,player,new Start(command.targetId(),command.sourceSessionId(),command.requestId(),false));
  }
  var repeat=jdbc.queryForList("select * from chapter_transitions where player_id=? and request_id=?",player,command.requestId());
  if(!repeat.isEmpty()){var t=repeat.get(0);if(!id.equals(t.get("run_id"))||!target.getId().equals(t.get("target_story_id"))||!Objects.equals(command.sourceSessionId(),t.get("source_session_id")))throw conflict("Request was already used for another transition");return result(id,player,(String)t.get("target_session_id"));}
  var old=jdbc.queryForList("select session_id as target_session_id from collection_run_saves where run_id=? and story_id=?",id,target.getId());
  if(!old.isEmpty())return result(id,player,(String)old.get(0).get("target_session_id"));
  GameSession source=null;Story sourceStory=null;WorkMetadata.Transfer policy=null;String policyId="direct:"+target.getId();
  if(command.sourceSessionId()!=null){source=ownedSession(command.sourceSessionId(),player);sourceStory=runtime(source);if(source.getStatus()!=SessionStatus.FINISHED)throw conflict("Complete the source chapter before continuing");
   if(jdbc.queryForObject("select count(*) from collection_run_saves where run_id=? and session_id=?",Integer.class,id,source.getId())==0)throw conflict("Source save belongs to another reading chain");
   if(!StoryAccessService.listed(stories.findById(source.getStoryId()).orElseThrow()))throw new StoryNotFoundException();
   int position=-1;for(int i=0;i<list(d.items()).size();i++)if(Objects.equals(d.items().get(i).target().id(),source.getStoryId()))position=i;
   if(position<0||position+1>=d.items().size()||!Objects.equals(d.items().get(position+1).target().id(),target.getId()))throw conflict("These chapters are not adjacent in this reading chain");
   policyId="toc:"+source.getStoryId()+":"+target.getId();
   for(var p:list(d.transitions()))if(Objects.equals(p.from().id(),source.getStoryId())&&Objects.equals(p.to().id(),target.getId())){policy=p.stateTransfer();policyId=p.id();break;}
  }
  var values=links.transfer(sourceStory==null?null:sourceStory.getRuntimeDocument(),target.getRuntimeDocument(),policy,source==null?Map.of():json.readMap(source.getVariablesJson()));
  var state=game.startTransferredSession(player,target,values,null);record(player,id,source,policyId,r.revision(),target,state.sessionId(),values,command.requestId());return Map.of("runId",id,"session",state);
 }
 private Map<String,Object> result(String runId,String player,String session){var m=new LinkedHashMap<String,Object>();m.put("runId",runId);m.put("session",game.sessionState(player,session));return m;}
 private void record(String player,String run,GameSession source,String policy,int revision,Story target,String session,Map<String,Object> values,String request){
  // Flush new JPA save before JDBC provenance inserts reference it.
  sessions.flush();jdbc.update("insert into chapter_transitions(id,player_id,run_id,source_session_id,source_revision,policy_id,policy_revision,target_story_id,target_revision,target_session_id,values_json,request_id) values (?,?,?,?,?,?,?,?,?,?,?,?)",UUID.randomUUID().toString(),player,run,source==null?null:source.getId(),source==null?null:source.getStoryRevision(),policy,revision,target.getId(),target.getPublishedRevision(),session,json.write(values),request);
  if(run!=null)jdbc.update("insert into collection_run_saves(run_id,story_id,session_id) values (?,?,?)",run,target.getId(),session);
 }
 @Transactional(readOnly=true)
 Map<String,Object> relations(String id,String player,String runId){var s=ownedSession(id,player);var source=runtime(s);var d=source.getRuntimeDocument();var result=new LinkedHashMap<String,Object>();var outgoing=new ArrayList<Map<String,Object>>();
  for(var link:d.metadata()==null?List.<WorkMetadata.Relation>of():list(d.metadata().relations())){
   // Re-evaluate live target availability without exposing inaccessible names, IDs or policies.
   try{var t=links.resolve(link.target(),source.getOwnerPlayerId(),true);Map<String,Object> target=new LinkedHashMap<>();if("scenario".equals(t.kind())){var st=stories.findById(t.id()).filter(StoryAccessService::listed).orElseThrow(StoryNotFoundException::new);target.put("id",st.getId());target.put("key",st.getKey());target.put("slug",st.getPublishedSlug());target.put("title",st.getTitle());}else{var c=collections.accessible(t.id(),false);if(!collections.listed(c))continue;var cd=collections.document(c,c.published());target.put("id",c.id());target.put("key",c.key());target.put("title",cd.title());target.put("slug",c.key());}target.put("kind",t.kind());var item=new LinkedHashMap<String,Object>();item.put("id",link.id());item.put("type",link.type());item.put("label",link.label());item.put("target",target);item.put("stateTransfer",link.stateTransfer());outgoing.add(item);}catch(org.springframework.web.server.ResponseStatusException|StoryNotFoundException unavailable){/* neutral absence */}
  }
  result.put("relations",outgoing);result.put("breadcrumbs",collections.breadcrumbs("scenario",s.getStoryId(),false));
  var chains=jdbc.queryForList("select r.id,r.collection_id from collection_run_saves t join collection_runs r on r.id=t.run_id join work_collections c on c.id=r.collection_id where t.session_id=? and r.player_id=? and c.visibility in ('public','unlisted') and c.published_revision is not null order by r.created_at desc",id,player);
  if(runId!=null){run(runId,player);chains=chains.stream().filter(c->runId.equals(c.get("id"))).toList();if(chains.isEmpty())throw new SessionNotFoundException();}
  if(!chains.isEmpty()){result.put("runId",chains.get(0).get("id"));result.put("collection",collections.publicDetail((String)chains.get(0).get("collection_id"),false,player));}return result;
 }
 @Transactional
 Map<String,Object> relationStart(String id,String relationId,String player,String requestId,boolean newAttempt){request(requestId);game.lockReader(player);var s=ownedSession(id,player);var source=runtime(s);
  var doc=source.getRuntimeDocument();var relation=(doc.metadata()==null?List.<WorkMetadata.Relation>of():list(doc.metadata().relations())).stream().filter(l->l.id().equals(relationId)).findFirst().orElseThrow(StoryNotFoundException::new);
  if(relation.stateTransfer()==null)throw bad("This is an information link, not a reading transition");
  var t=links.resolve(relation.target(),source.getOwnerPlayerId(),true);if(!"scenario".equals(t.kind()))throw bad("Open the target collection to start reading");Story target=target(t.id());
  var reused=jdbc.queryForList("select * from chapter_transitions where player_id=? and request_id=?",player,requestId);if(!reused.isEmpty()){var old=reused.get(0);if(!Objects.equals(id,old.get("source_session_id"))||!relationId.equals(old.get("policy_id"))||old.get("run_id")!=null)throw conflict("Request was already used for another transition");return result(null,player,(String)old.get("target_session_id"));}
  var old=jdbc.queryForList("select target_session_id from chapter_transitions where source_session_id=? and policy_id=? and run_id is null order by created_at desc limit 1",id,relationId);if(!newAttempt&&!old.isEmpty())return result(null,player,(String)old.get(0).get("target_session_id"));
  if(s.getStatus()!=SessionStatus.FINISHED)throw conflict("Complete the source story before continuing");
  var values=links.transfer(doc,target.getRuntimeDocument(),relation.stateTransfer(),json.readMap(s.getVariablesJson()));var state=game.startTransferredSession(player,target,values,null);record(player,null,s,relationId,s.getStoryRevision(),target,state.sessionId(),values,requestId);return Map.of("session",state);
 }
}
