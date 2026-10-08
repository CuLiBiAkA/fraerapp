package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fraergod.fraerapp.game.WorkLinksService.*;

@Service
class WorkPackageService {
 private final CollectionService collections;
 private final StoryWorkflowService workflow;
 private final StoryRepository stories;
 private final JsonSupport json;
 private final WorkLinksService links;
 WorkPackageService(CollectionService collections,StoryWorkflowService workflow,StoryRepository stories,JsonSupport json,WorkLinksService links){this.collections=collections;this.workflow=workflow;this.stories=stories;this.json=json;this.links=links;}
 record ReviewItem(String kind,String id,int generation,Boolean replaceReview) {}
 record Batch(List<ReviewItem> items) {}
 record ChapterReview(String storyId,int storyGeneration,int generation,Boolean replaceReview) {}
 @Transactional
 Map<String,Object> reviewChapter(String id,ChapterReview command,String player,AuthIdentity actor){
  collections.structureLock();var parent=collections.row(id);collections.owner(parent,player);collections.expected(parent,command.generation());
  var doc=json.readCollection(parent.draft());if(!doc.serialStory())throw bad("Select a serial story");
  if(list(doc.items()).stream().noneMatch(i->Objects.equals(i.target().id(),command.storyId())))throw bad("Chapter does not belong to this story");
  for(var item:doc.items()){
   if(Objects.equals(item.target().id(),command.storyId()))break;
   var prior=stories.findById(item.target().id()).orElseThrow(StoryNotFoundException::new);var state=workflow.workspace(prior.getId());
   if(prior.getPublishedRevision()==null&&!List.of("in_review","approved").contains(state.reviewState()))throw conflict("Submit the preceding chapters first");
  }
  var requests=new ArrayList<ReviewItem>();requests.add(new ReviewItem("scenario",command.storyId(),command.storyGeneration(),command.replaceReview()));
  if(!Objects.equals(parent.published(),parent.draftRevision()))requests.add(new ReviewItem("collection",parent.id(),parent.generation(),command.replaceReview()));
  var result=review(new Batch(requests),player,actor);
  renewSupersededFolder(parent.id(),Boolean.TRUE.equals(command.replaceReview()),actor);
  linkSubmittedDependencies(parent.id(),(String)result.get("batchId"));return result;
 }
 record Restriction(List<ReviewItem> items,String reason) {}
 @Transactional(readOnly=true)
 List<Map<String,Object>> descendants(String id){var root=collections.row(id);var result=new ArrayList<Map<String,Object>>();Set<String> seen=new HashSet<>();var pending=new ArrayDeque<String>();pending.add(root.id());
  var edges=collections.database().queryForList("select parent_id,target_kind,target_id from collection_memberships where in_published=true");
  while(!pending.isEmpty()){String parent=pending.remove();for(var edge:edges){if(!parent.equals(edge.get("parent_id")))continue;String kind=(String)edge.get("target_kind"),child=(String)edge.get("target_id");if(!seen.add(kind+":"+child))continue;var m=new LinkedHashMap<String,Object>();m.put("id",child);m.put("kind",kind);if("collection".equals(kind)){var c=collections.row(child);m.putAll(collections.summary(c));pending.add(child);}else{var s=stories.findById(child).orElseThrow(StoryNotFoundException::new);var w=workflow.workspace(child);m.put("title",s.getTitle());m.put("key",s.getKey());m.put("generation",w.generation());m.put("visibility",s.getVisibility());m.put("publishedRevision",s.getPublishedRevision());m.put("reviewState",w.reviewState());}result.add(m);}}return result;
 }
 @Transactional
 Map<String,Object> restrict(String id,Restriction command,AuthIdentity actor){collections.structureLock();ModerationPolicy.authorizeDecision(actor,false,"hide",false);String reason=ModerationPolicy.reason(command.reason(),true);if(list(command.items()).isEmpty()||command.items().size()>100)throw bad("Select 1–100 descendants");Set<String> allowed=new HashSet<>();for(var d:descendants(id))allowed.add(d.get("kind")+":"+d.get("id"));Set<String> seen=new HashSet<>();var result=new ArrayList<Map<String,Object>>();for(var i:command.items()){String identity=i.kind()+":"+i.id();if(!allowed.contains(identity)||!seen.add(identity))throw bad("Select distinct descendants from this published collection");var decision=new StoryWorkflowService.Decision(i.generation(),null,reason,null,null,false);result.add("scenario".equals(i.kind())?workflow.decide(i.id(),"hide",decision,actor):workflow.decideCollection(i.id(),"hide",decision,actor));}return Map.of("items",result,"atomic",true);}
 @Transactional
 Map<String,Object> reviewTree(String id,int generation,boolean replace,String player,AuthIdentity actor){collections.structureLock();var root=collections.row(id);collections.owner(root,player);collections.expected(root,generation);var requests=new ArrayList<ReviewItem>();var participants=new ArrayList<String>();var queue=new ArrayDeque<WorkMetadata.Target>();queue.add(new WorkMetadata.Target("collection",root.id(),root.key()));Set<String> seen=new HashSet<>();
  while(!queue.isEmpty()){
   var t=queue.remove();if(!seen.add(t.kind()+":"+t.id()))continue;if(seen.size()>100)throw bad("Select at most 100 works per submission");
   if("collection".equals(t.kind())){
    var c=collections.row(t.id());collections.owner(c,player);participants.add(c.id());var normalized=collections.normalize(json.readCollection(c.draft()),player,c.id(),true);
    if(!Objects.equals(c.published(),c.draftRevision())&&!("in_review".equals(c.review())&&Objects.equals(c.submitted(),c.draftRevision())))requests.add(new ReviewItem("collection",c.id(),c.generation(),replace));
    for(var item:list(normalized.items()))queue.add(item.target());
   }else{
    var s=stories.findById(t.id()).orElseThrow(StoryNotFoundException::new);if(!player.equals(s.getOwnerPlayerId()))throw new ForbiddenRoleException();var w=workflow.workspace(s.getId());
    if(!Objects.equals(s.getPublishedRevision(),w.draftRevision())&&!("in_review".equals(w.reviewState())&&Objects.equals(w.submittedRevision(),w.draftRevision())))requests.add(new ReviewItem("scenario",s.getId(),w.generation(),replace));
   }
  }
  Map<String,Object> result=requests.isEmpty()?Map.of("items",List.of(),"atomic",true,"batchId",UUID.randomUUID().toString()):review(new Batch(requests),player,actor);
  // Existing in-review parents participate even when their exact submission is
  // already current and therefore did not need another submit command.
  var updated=new ArrayList<Object>((List<?>)result.get("items"));Collections.reverse(participants);
  for(String participant:participants){
   var refreshed=renewSupersededFolder(participant,replace,actor);if(refreshed!=null)updated.add(refreshed);
   linkSubmittedDependencies(participant,(String)result.get("batchId"));
  }
  return Map.of("items",updated,"atomic",true,"batchId",result.get("batchId"));
 }
 private Map<String,Object> renewSupersededFolder(String id,boolean replace,AuthIdentity actor){
  var c=collections.row(id);if(!"in_review".equals(c.review())||c.submitted()==null)return null;var db=collections.database();boolean stale=false;
  for(var pin:db.queryForList("select target_kind,target_id,requested_revision from collection_review_dependencies where collection_id=? and collection_revision=?",id,c.submitted())){
   String target=(String)pin.get("target_id");Integer current;
   if("scenario".equals(pin.get("target_kind"))){var w=workflow.workspace(target);current=List.of("in_review","approved").contains(w.reviewState())?w.submittedRevision():stories.findById(target).orElseThrow(StoryNotFoundException::new).getPublishedRevision();}
   else{var w=collections.row(target);current=List.of("in_review","approved").contains(w.review())?w.submitted():w.published();}
   if(!Objects.equals(current,pin.get("requested_revision")))stale=true;
  }
  if(!stale)return null;if(!replace)throw conflict("Confirm replacement of the superseded folder application");
  // Never rewrite the former dependency set. An explicit replacement receives a
  // fresh immutable parent snapshot even when its visible structure is unchanged.
  int revision=c.draftRevision()+1;db.update("insert into collection_versions(collection_id,revision,document_json) values (?,?,?)",id,revision,c.draft());
  db.update("update work_collections set draft_revision=?,generation=generation+1 where id=?",revision,id);
  return collections.submit(id,c.owner(),c.generation()+1,true,actor);
 }
 @Transactional
 Map<String,Object> review(Batch batch,String player,AuthIdentity actor){if(batch==null||list(batch.items()).isEmpty()||batch.items().size()>100)throw bad("Select 1–100 works for review");collections.structureLock();Set<String> unique=new HashSet<>();var result=new ArrayList<Map<String,Object>>();
  for(var i:batch.items()){if(!unique.add(i.kind()+":"+i.id()))throw bad("Duplicate batch item");if("scenario".equals(i.kind()))result.add(workflow.submit(i.id(),player,i.generation(),Boolean.TRUE.equals(i.replaceReview()),actor));else if("collection".equals(i.kind()))result.add(collections.submit(i.id(),player,i.generation(),Boolean.TRUE.equals(i.replaceReview()),actor));else throw bad("Unknown batch item type");}
  String batchId=UUID.randomUUID().toString();
  for(var submitted:result)if(submitted.get("collectionId")!=null)linkSubmittedDependencies(submitted.get("collectionId").toString(),batchId);
  return Map.of("items",result,"atomic",true,"batchId",batchId);
 }
 private void linkSubmittedDependencies(String id,String batchId){var parent=collections.row(id);if(parent.submitted()==null||!"in_review".equals(parent.review()))return;var db=collections.database();
  for(var item:list(collections.document(parent,parent.submitted()).items())){var t=item.target();if(t.id()==null)continue;Integer revision=null;
   if("scenario".equals(t.kind())){var target=stories.findById(t.id()).orElseThrow(StoryNotFoundException::new);if(!parent.owner().equals(target.getOwnerPlayerId()))continue;var w=workflow.workspace(target.getId());if("in_review".equals(w.reviewState()))revision=w.submittedRevision();}
   else{var target=collections.row(t.id());if(!parent.owner().equals(target.owner()))continue;if("in_review".equals(target.review()))revision=target.submitted();}
   if(revision!=null&&db.queryForObject("select count(*) from collection_review_dependencies where collection_id=? and collection_revision=? and target_kind=? and target_id=?",Integer.class,parent.id(),parent.submitted(),t.kind(),t.id())==0)db.update("insert into collection_review_dependencies(collection_id,collection_revision,target_kind,target_id,requested_revision,batch_id) values (?,?,?,?,?,?)",parent.id(),parent.submitted(),t.kind(),t.id(),revision,batchId);
  }
 }
 @Transactional(readOnly=true)
 Map<String,Object> export(String id,String player){var root=collections.row(id);collections.owner(root,player);var collectionDocs=new ArrayList<Object>();var scenarioDocs=new ArrayList<Object>();Set<String> seen=new HashSet<>();ArrayDeque<WorkMetadata.Target> todo=new ArrayDeque<>();todo.add(new WorkMetadata.Target("collection",root.id(),root.key()));
  while(!todo.isEmpty()){var t=todo.remove();if(!seen.add(t.kind()+":"+t.id()))continue;if(seen.size()>1000)throw bad("Package is too large");
   if("collection".equals(t.kind())){var c=collections.row(t.id());if(!player.equals(c.owner()))continue;var d=json.readCollection(c.draft());collectionDocs.add(portable(json.readMap(json.write(d))));for(var item:list(d.items()))if(item.target().id()!=null)todo.add(item.target());}
   else {var s=stories.findById(t.id()).orElseThrow(StoryNotFoundException::new);if(!player.equals(s.getOwnerPlayerId()))continue;var d=json.readStory(workflow.workspace(s.getId()).draftJson());scenarioDocs.add(portable(json.readMap(json.write(d))));}
  }
  return Map.of("schemaVersion",1,"kind","fraerapp-work-package","root",Map.of("kind","collection","key",root.key()),"scenarios",scenarioDocs,"collections",collectionDocs);
 }
 @SuppressWarnings("unchecked")
 private Object portable(Object v){if(v instanceof Map<?,?> raw){var out=new LinkedHashMap<String,Object>();raw.forEach((k,x)->out.put(k.toString(),portable(x)));if(("scenario".equals(out.get("kind"))||"collection".equals(out.get("kind")))&&out.containsKey("key"))out.remove("id");return out;}if(v instanceof List<?> l)return l.stream().map(this::portable).toList();return v;}
 @Transactional
 Map<String,Object> importPackage(Map<String,Object> payload,String player){collections.structureLock();Object raw=payload.getOrDefault("package",payload);Map<String,Object> data=json.readMap(json.write(portable(raw)));
  if(!"fraerapp-work-package".equals(data.get("kind"))||!Integer.valueOf(1).equals(data.get("schemaVersion")))throw bad("Unsupported work package");
  List<?> scenarioDocs=data.get("scenarios") instanceof List<?> l?l:List.of(),collectionDocs=data.get("collections") instanceof List<?> l?l:List.of();if(scenarioDocs.size()+collectionDocs.size()>1000)throw bad("Package is too large");
  Map<?,?> generations=payload.get("generations") instanceof Map<?,?> m?m:Map.of();var results=new ArrayList<Map<String,Object>>();Set<String> unique=new HashSet<>();
  for(Object value:scenarioDocs){var d=json.readStory(json.write(value));if(!unique.add("scenario:"+d.key()))throw bad("Duplicate package scenario key");var existing=stories.findByKey(d.key()).orElse(null);if(existing!=null){if(!player.equals(existing.getOwnerPlayerId()))throw new ForbiddenRoleException();var w=workflow.workspace(existing.getId());boolean equal=Objects.equals(portable(json.readMap(json.write(json.readStory(w.draftJson())))),portable(json.readMap(json.write(d))));if(equal){results.add(workflow.details(existing.getId(),player,false));continue;}if(!Objects.equals(generations.get(existing.getId()),w.generation()))throw conflict("Existing scenario differs. Reload and supply its generation before importing");}results.add(workflow.importDraft(json.write(d),player));}
  List<CollectionDocument> docs=collectionDocs.stream().map(d->json.readCollection(json.write(d))).toList();
  for(var d:docs){if(!unique.add("collection:"+d.key()))throw bad("Duplicate package collection key");var ids=collections.database().query("select id from work_collections where collection_key=?",(r,n)->r.getString(1),d.key());if(ids.isEmpty())results.add(collections.create(d,player));else{var c=collections.row(ids.get(0));collections.owner(c,player);var normalized=collections.normalize(d,player,c.id(),false);if(!json.write(normalized).equals(c.draft())&&!Objects.equals(generations.get(c.id()),c.generation()))throw conflict("Existing collection differs. Reload and supply its generation before importing");results.add(collections.save(c.id(),c.generation(),normalized,player));}}
  // Resolve every folder after all objects exist. This also rejects cycles and
  // duplicate parent reservations hidden behind forward keys, atomically.
  for(var d:docs){var c=collections.row(d.key());var saved=collections.save(c.id(),c.generation(),json.readCollection(c.draft()),player);for(int i=0;i<results.size();i++)if(c.id().equals(results.get(i).get("collectionId")))results.set(i,saved);}
  // Resolve forward scenario links only after all package objects exist.
  for(Object value:scenarioDocs){var d=json.readStory(json.write(value));if(d.metadata()!=null)workflow.importDraft(json.write(links.normalize(d,player,false)),player);}
  return Map.of("items",results,"root",data.getOrDefault("root",Map.of()),"atomic",true);
 }
 @Transactional(readOnly=true)
 Map<String,Object> importPreview(Map<String,Object> payload,String player){var data=json.readMap(json.write(portable(payload.getOrDefault("package",payload))));if(!"fraerapp-work-package".equals(data.get("kind"))||!Integer.valueOf(1).equals(data.get("schemaVersion")))throw bad("Unsupported work package");var items=new ArrayList<Map<String,Object>>();var generations=new LinkedHashMap<String,Object>();Set<String> unique=new HashSet<>();
  for(String kind:List.of("scenario","collection")){Object raw=data.get("scenario".equals(kind)?"scenarios":"collections");if(!(raw instanceof List<?> documents))continue;if(documents.size()>1000)throw bad("Package is too large");for(Object value:documents){var m=new LinkedHashMap<String,Object>();String key;String id=null;Integer generation=null;String action="create",reason=null;
    if("scenario".equals(kind)){var d=json.readStory(json.write(value));key=d.key();var s=stories.findByKey(key).orElse(null);if(s!=null){if(!player.equals(s.getOwnerPlayerId())){action="conflict";reason="This key is unavailable";}else{id=s.getId();var w=workflow.workspace(id);generation=w.generation();action=Objects.equals(portable(json.readMap(json.write(json.readStory(w.draftJson())))),portable(json.readMap(json.write(d))))?"unchanged":"update";if("deleted".equals(s.getVisibility())){action="conflict";reason="Restore this scenario before importing";}}}}
    else {var d=json.readCollection(json.write(value));key=d.key();var rows=collections.database().query("select id from work_collections where collection_key=?",(r,n)->r.getString(1),key);if(!rows.isEmpty()){var c=collections.row(rows.get(0));if(!player.equals(c.owner())){action="conflict";reason="This key is unavailable";}else{id=c.id();generation=c.generation();try{var normalized=collections.normalize(d,player,id,false);action=json.write(normalized).equals(c.draft())?"unchanged":"update";if(!Objects.equals(c.type(),d.type())||"deleted".equals(c.visibility())){action="conflict";reason="Collection type is immutable; deleted collections must be restored";}}catch(org.springframework.web.server.ResponseStatusException ex){action="conflict";reason=ex.getReason();}}}}
    if(!"conflict".equals(action))try{
     if("scenario".equals(kind))links.normalize(json.readStory(json.write(value)),player,false);
     else collections.normalize(json.readCollection(json.write(value)),player,id==null?"package-preview":id,false);
    }catch(org.springframework.web.server.ResponseStatusException ex){action="conflict";reason=ex.getReason();}
    if(!unique.add(kind+":"+key)){action="conflict";reason="Duplicate package key";}m.put("kind",kind);m.put("key",key);m.put("action",action);if(id!=null){m.put("id",id);m.put("generation",generation);generations.put(id,generation);}if(reason!=null)m.put("reason",reason);items.add(m);
  }}return Map.of("items",items,"generations",generations,"canImport",items.stream().noneMatch(i->"conflict".equals(i.get("action"))));
 }
}
