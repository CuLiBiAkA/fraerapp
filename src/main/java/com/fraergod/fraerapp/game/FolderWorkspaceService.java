package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fraergod.fraerapp.game.WorkLinksService.*;

/** Folder projections and exact, atomic decisions over the existing revision workflow. */
@Service
class FolderWorkspaceService {
 private final CollectionService collections;
 private final StoryWorkflowService workflow;
 private final JsonSupport json;
 private final PlayerRepository players;

 FolderWorkspaceService(CollectionService collections,StoryWorkflowService workflow,JsonSupport json,PlayerRepository players){
  this.collections=collections;this.workflow=workflow;this.json=json;this.players=players;
 }
 record ReviewItem(String kind,String id,int generation,int revision) {}
 record Decision(String action,List<ReviewItem> items,int rootGeneration,String reason,Boolean ownOverride) {}
 private record Work(String kind,String id,String key,String type,String owner,String title,int generation,
   int draftRevision,Integer submitted,Integer published,String review,String visibility,boolean restricted,
   Object document,Object publishedDocument,List<CollectionDocument.Item> children) {
  String identity(){return kind+":"+id;}
  boolean pending(){return submitted!=null&&!Objects.equals(submitted,published)&&List.of("in_review","approved").contains(review);}
 }
 private Map<String,Work> works(String owner,boolean moderation){
  var result=new LinkedHashMap<String,Work>();var db=collections.database();
  String collectionSql="select c.*,sv.document_json as submitted_json,pv.document_json as published_json from work_collections c left join collection_versions sv on sv.collection_id=c.id and sv.revision=c.submitted_revision left join collection_versions pv on pv.collection_id=c.id and pv.revision=c.published_revision"+(owner==null?"":" where c.owner_player_id=?")+" order by c.updated_at desc,c.id";
  var collectionRows=owner==null?db.queryForList(collectionSql):db.queryForList(collectionSql,owner);
  for(var r:collectionRows){
   String id=(String)r.get("id"),review=(String)r.get("review_state");Integer submitted=(Integer)r.get("submitted_revision"),publishedRevision=(Integer)r.get("published_revision");boolean pending=submitted!=null&&!Objects.equals(submitted,publishedRevision)&&List.of("in_review","approved").contains(review);
   var published=publishedRevision==null?null:json.readCollection((String)r.get("published_json"));
   var d=moderation?(pending?json.readCollection((String)r.get("submitted_json")):published!=null?published:json.readCollection((String)r.get("draft_json"))):json.readCollection((String)r.get("draft_json"));
   var w=new Work("collection",id,(String)r.get("collection_key"),(String)r.get("collection_type"),(String)r.get("owner_player_id"),d.title(),(Integer)r.get("generation"),(Integer)r.get("draft_revision"),submitted,publishedRevision,review,(String)r.get("visibility"),(Boolean)r.get("restricted"),d,published,WorkLinksService.list(d.items()));result.put(w.identity(),w);
  }
  String sql="select s.id,s.story_key,s.owner_player_id,s.published_revision,s.visibility,w.*,sv.snapshot_json as submitted_json,pv.snapshot_json as published_json from stories s join story_workspaces w on w.story_id=s.id left join story_versions sv on sv.story_id=s.id and sv.version_number=w.submitted_revision left join story_versions pv on pv.story_id=s.id and pv.version_number=s.published_revision"+(owner==null?"":" where s.owner_player_id=?")+" order by s.updated_at desc,s.id";
  var rows=owner==null?db.queryForList(sql):db.queryForList(sql,owner);
  for(var r:rows){
   String id=(String)r.get("id"),review=(String)r.get("review_state");Integer submitted=(Integer)r.get("submitted_revision"),published=(Integer)r.get("published_revision");
   boolean pending=submitted!=null&&!Objects.equals(submitted,published)&&List.of("in_review","approved").contains(review);
   var pub=published==null?null:json.readStory((String)r.get("published_json"));
   var d=moderation?(pending?json.readStory((String)r.get("submitted_json")):pub!=null?pub:json.readStory((String)r.get("draft_json"))):json.readStory((String)r.get("draft_json"));
   var w=new Work("scenario",id,(String)r.get("story_key"),"scenario",(String)r.get("owner_player_id"),d.title(),(Integer)r.get("generation"),(Integer)r.get("draft_revision"),submitted,published,review,(String)r.get("visibility"),(Boolean)r.get("restricted"),d,pub,List.of());result.put(w.identity(),w);
  }
  return result;
 }
 private Work child(Map<String,Work> all,WorkMetadata.Target target){
  if(target==null)return null;
  if(target.id()!=null)return all.get(target.kind()+":"+target.id());
  return all.values().stream().filter(w->w.kind().equals(target.kind())&&w.key().equals(target.key())).findFirst().orElse(null);
 }
 private Map<String,Object> node(Work w,Map<String,Work> all,Set<String> seen,boolean snapshots,AuthIdentity actor,List<Map<String,Object>> pending,List<String> conflicts){
  if(!seen.add(w.identity()))return null;
  var m=new LinkedHashMap<String,Object>();
  m.put("kind",w.kind());m.put("id",w.id());m.put("key",w.key());m.put("type",w.type());m.put("title",w.title());
  m.put("reviewState",w.review());m.put("visibility",w.visibility());m.put("generation",w.generation());m.put("draftRevision",w.draftRevision());m.put("submittedRevision",w.submitted());m.put("publishedRevision",w.published());m.put("pending",w.pending());m.put("restricted",w.restricted());
  m.put("hasDraft",!Objects.equals(w.published(),w.draftRevision()));
  if(w.document() instanceof CollectionDocument doc){m.put("schemaVersion",doc.schemaVersion());m.put("coverUrl",doc.coverUrl());m.put("description",doc.description());m.put("genre",doc.genre());m.put("completionStatus",doc.completionStatus());}
  if(w.document() instanceof StoryDocument doc){m.put("schemaVersion",null);m.put("coverUrl",doc.metadata()==null?null:doc.metadata().coverUrl());m.put("description",doc.description());m.put("genre",doc.genre());m.put("completionStatus",doc.completionStatus());}
  var children=new ArrayList<Map<String,Object>>();m.put("children",children);int count=w.pending()?1:0;
  if(snapshots){
   m.put("document",w.document());m.put("publishedDocument",w.publishedDocument());
   boolean self=w.owner()!=null&&players.findById(w.owner()).map(p->actor.userId().equals(p.getUserId())).orElse(false);
   boolean available=!w.restricted()&&!List.of("hidden","archived","deleted").contains(w.visibility());
   m.put("self",self);m.put("approvalEligibility",Map.of("canApprove",available&&!self,"canOverride",available&&self&&actor.hasRole("admin"),"reason",!available?"Restore availability before publication":self?"Own work requires an administrator override and reason":""));
   if(w.pending()){
    var item=new LinkedHashMap<>(m);item.remove("children");item.put("revision",w.submitted());pending.add(item);
   }
  }
  Map<String,Integer> pinned=new HashMap<>();
  if(w.pending()&&"collection".equals(w.kind()))for(var d:collections.database().queryForList("select target_kind,target_id,requested_revision from collection_review_dependencies where collection_id=? and collection_revision=?",w.id(),w.submitted()))pinned.put(d.get("target_kind")+":"+d.get("target_id"),(Integer)d.get("requested_revision"));
  for(var item:w.children()){
   var c=child(all,item.target());
   if(c==null&&!snapshots)continue;
   if(c==null||!Objects.equals(w.owner(),c.owner())){
    String reason="A folder contains a missing or foreign work. Edit and submit the folder again.";m.put("reviewConflict",reason);conflicts.add(reason);continue;
   }
   Integer requested=pinned.get(c.identity());
   if(requested!=null&&!Objects.equals(requested,c.pending()?c.submitted():c.published())){
    String reason="A submitted chapter was replaced or withdrawn. Submit the folder again.";m.put("reviewConflict",reason);conflicts.add(reason);
   }
   var nested=node(c,all,seen,snapshots,actor,pending,conflicts);if(nested!=null){children.add(nested);count+=(Integer)nested.get("pendingCount");}
  }
  m.put("pendingCount",count);return m;
 }
 private boolean matches(Map<String,Object> node,String q,String status,String visibility,String type){
  boolean direct=(q.isEmpty()||Objects.toString(node.get("title"),"").toLowerCase(Locale.ROOT).contains(q)||Objects.toString(node.get("key"),"").toLowerCase(Locale.ROOT).contains(q))
   &&("all".equals(status)||status.equals(node.get("reviewState"))||status.equals(node.get("visibility")))
   &&("all".equals(visibility)||visibility.equals(node.get("visibility")))&&("all".equals(type)||type.equals(node.get("type")));
  if(direct)return true;
  for(Object value:(List<?>)node.get("children"))if(matches(cast(value),q,status,visibility,type))return true;
  return false;
 }
 @SuppressWarnings("unchecked") private Map<String,Object> cast(Object value){return (Map<String,Object>)value;}
 @Transactional(readOnly=true)
 Map<String,Object> list(String owner,boolean moderation,int page,int size,String q,String status,String visibility,String type){
  var all=works(owner,moderation);Set<String> nested=new HashSet<>();
  if(!moderation){boolean trash="deleted".equals(status)||"deleted".equals(visibility);all.entrySet().removeIf(entry->"deleted".equals(entry.getValue().visibility())!=trash);}
  for(var w:all.values())for(var item:w.children()){var c=child(all,item.target());if(c!=null&&Objects.equals(w.owner(),c.owner()))nested.add(c.identity());}
  var roots=new ArrayList<Map<String,Object>>();Set<String> seen=new HashSet<>();
  // Multiple legacy catalog memberships still produce a single application.
  for(var w:all.values())if(!nested.contains(w.identity())){var n=node(w,all,seen,false,null,new ArrayList<>(),new ArrayList<>());if(n!=null)roots.add(n);}
  for(var w:all.values())if(!seen.contains(w.identity())){var n=node(w,all,seen,false,null,new ArrayList<>(),new ArrayList<>());if(n!=null)roots.add(n);}
  String query=q==null?"":q.strip().toLowerCase(Locale.ROOT);
  var filtered=roots.stream().filter(n->matches(n,query,status,visibility,type)).sorted(Comparator.comparingInt(n->(Integer)n.get("pendingCount")>0?0:1)).toList();
  page=Math.max(0,Math.min(100000,page));size=Math.max(1,Math.min(100,size));int from=Math.min(filtered.size(),page*size),to=Math.min(filtered.size(),from+size);
  return Map.of("items",filtered.subList(from,to),"page",page,"size",size,"total",filtered.size());
 }
 @Transactional(readOnly=true)
 Map<String,Object> review(String id,AuthIdentity actor){
  var root=collections.row(id);var all=works(root.owner(),true);var pending=new ArrayList<Map<String,Object>>();var conflicts=new ArrayList<String>();
  var tree=node(all.get("collection:"+root.id()),all,new HashSet<>(),true,actor,pending,conflicts);
  return Map.of("tree",tree,"items",pending,"rootGeneration",root.generation(),"canDecide",!pending.isEmpty()&&conflicts.isEmpty(),"conflicts",conflicts.stream().distinct().toList());
 }
 @Transactional
 Map<String,Object> decide(String id,Decision command,AuthIdentity actor){
  if(command==null||command.action()==null||!List.of("approve-publish","reject").contains(command.action()))throw bad("Choose approve-publish or reject");
  if(WorkLinksService.list(command.items()).isEmpty()||command.items().size()>100)throw bad("Select the exact 1–100 submitted works shown in the application");
  collections.structureLock();var root=collections.lock(id);collections.expected(root,command.rootGeneration());
  // Lock every scenario in this owner's tree, including unchanged context. Imports and
  // structure edits already take the structure lock; withdrawals take scenario locks.
  var initial=review(root.id(),actor);var ids=new TreeSet<String>();collectScenarioIds(cast(initial.get("tree")),ids);
  for(String storyId:ids)workflow.lock(storyId);
  var current=review(root.id(),actor);
  if(!Boolean.TRUE.equals(current.get("canDecide")))throw conflict("This application changed or contains superseded submissions. Reload and submit the folder again.");
  Map<String,ReviewItem> requested=new LinkedHashMap<>();
  for(var item:command.items())if(item==null||requested.putIfAbsent(item.kind()+":"+item.id(),item)!=null)throw bad("Select distinct submitted works");
  var actual=new ArrayList<Map<String,Object>>();for(Object value:(List<?>)current.get("items"))actual.add(cast(value));
  if(requested.size()!=actual.size())throw conflict("The submitted works changed. Reload the application.");
  for(var item:actual){
   String identity=item.get("kind")+":"+item.get("id");var expected=requested.get(identity);
   if(expected==null||!Objects.equals(expected.generation(),item.get("generation"))||!Objects.equals(expected.revision(),item.get("revision")))throw conflict("A reviewed revision changed. Reload the application.");
   ModerationPolicy.authorizeDecision(actor,Boolean.TRUE.equals(item.get("self")),command.action(),command.ownOverride());
  }
  var results=new ArrayList<Map<String,Object>>();
  // Children publish before parents, all inside this transaction. No draft enters here.
  Collections.reverse(actual);
  for(var item:actual){
   String action="approve-publish".equals(command.action())&&"approved".equals(item.get("reviewState"))?"publish-approved":command.action();
   var c=new StoryWorkflowService.Decision((Integer)item.get("generation"),(Integer)item.get("revision"),command.reason(),null,"unlisted".equals(item.get("visibility"))?"unlisted":"public",command.ownOverride());
   results.add("scenario".equals(item.get("kind"))?workflow.decide((String)item.get("id"),action,c,actor):workflow.decideCollection((String)item.get("id"),action,c,actor));
  }
  return Map.of("items",results,"atomic",true);
 }
 private void collectScenarioIds(Map<String,Object> node,Set<String> ids){if("scenario".equals(node.get("kind")))ids.add((String)node.get("id"));for(Object child:(List<?>)node.get("children"))collectScenarioIds(cast(child),ids);}
}
