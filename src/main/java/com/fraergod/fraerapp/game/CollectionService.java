package com.fraergod.fraerapp.game;

import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static com.fraergod.fraerapp.game.WorkLinksService.*;

/** Versioned collection content and derived structure; decisions enter through StoryWorkflowService. */
@Service
class CollectionService {
 private final JdbcTemplate jdbc;
 private final JsonSupport json;
 JdbcTemplate database(){return jdbc;}
 private final StoryRepository stories;
 private final PlayerRepository players;
 private final WorkLinksService links;
 record Row(String id,String key,String type,String owner,String draft,int draftRevision,Integer submitted,
   Integer published,String review,String visibility,String reason,boolean restricted,int generation) {}
 CollectionService(JdbcTemplate jdbc,JsonSupport json,StoryRepository stories,PlayerRepository players,WorkLinksService links) {
  this.jdbc=jdbc;this.json=json;this.stories=stories;this.players=players;this.links=links;
 }
 private Row map(java.sql.ResultSet r,int n)throws java.sql.SQLException {return new Row(r.getString("id"),r.getString("collection_key"),r.getString("collection_type"),r.getString("owner_player_id"),r.getString("draft_json"),r.getInt("draft_revision"),(Integer)r.getObject("submitted_revision"),(Integer)r.getObject("published_revision"),r.getString("review_state"),r.getString("visibility"),r.getString("decision_reason"),r.getBoolean("restricted"),r.getInt("generation"));}
 Row row(String id){return jdbc.query("select * from work_collections where id=? or collection_key=?",this::map,id,id).stream().findFirst().orElseThrow(StoryNotFoundException::new);}
 void structureLock(){jdbc.queryForObject("select id from collection_structure_lock where id=1 for update",Integer.class);}
 Row lock(String id){structureLock();return jdbc.query("select * from work_collections where id=? for update",this::map,id).stream().findFirst().orElseThrow(StoryNotFoundException::new);}
 void owner(Row r,String player){if(!Objects.equals(r.owner(),player))throw new ForbiddenRoleException();}
 void expected(Row r,int generation){if(r.generation()!=generation)throw conflict("Collection changed. Reload before retrying.");}
 CollectionDocument document(Row r,Integer revision){if(revision==null)throw new StoryNotFoundException();return json.readCollection(jdbc.queryForObject("select document_json from collection_versions where collection_id=? and revision=?",String.class,r.id(),revision));}
 Map<String,Object> summary(Row r) {
  var d=json.readCollection(r.draft());Map<String,Object> m=new LinkedHashMap<>();
  m.put("id",r.id());m.put("collectionId",r.id());m.put("key",r.key());m.put("type",r.type());m.put("title",d.title());m.put("description",d.description());
  m.put("generation",r.generation());m.put("draftRevision",r.draftRevision());m.put("submittedRevision",r.submitted());m.put("publishedRevision",r.published());
  m.put("reviewState",r.review());m.put("visibility",r.visibility());m.put("decisionReason",r.reason());m.put("restricted",r.restricted());
  m.put("ownerPlayerId",r.owner());m.put("hasDraft",!Objects.equals(r.published(),r.draftRevision()));return m;
 }
 @Transactional(readOnly=true)
 List<Map<String,Object>> mine(String owner,int page,int size,String q,String type,String state){return jdbc.query("select * from work_collections where owner_player_id=? and (lower(draft_title) like ? or lower(collection_key) like ?) and (?='all' or collection_type=?) and (?='all' or review_state=? or visibility=?) order by updated_at desc limit ? offset ?",this::map,owner,"%"+q.toLowerCase(Locale.ROOT)+"%","%"+q.toLowerCase(Locale.ROOT)+"%",type,type,state,state,state,Math.max(1,Math.min(100,size)),Math.max(0,page)*Math.max(1,Math.min(100,size))).stream().map(this::summary).toList();}
 List<Map<String,Object>> parents(String player,String scenarioId){var s=stories.findById(scenarioId).orElseThrow(StoryNotFoundException::new);if(!player.equals(s.getOwnerPlayerId()))throw new ForbiddenRoleException();return jdbc.query("select c.* from work_collections c join collection_memberships m on m.parent_id=c.id where m.target_kind='scenario' and m.target_id=? and c.owner_player_id=?",this::map,scenarioId,player).stream().map(this::summary).toList();}
 @Transactional(readOnly=true)
 Map<String,Object> queue(int page,int size,String q,String state,String visibility,String type) {
  size=Math.max(1,Math.min(100,size));page=Math.max(0,page);
  var all=jdbc.query("select * from work_collections where (?='all' or review_state=?) and (?='all' or visibility=?) and (?='all' or collection_type=?) and lower(draft_title) like ? order by updated_at desc limit ? offset ?",this::map,state,state,visibility,visibility,type,type,"%"+q.toLowerCase(Locale.ROOT)+"%",size,page*size);
  var total=jdbc.queryForObject("select count(*) from work_collections where (?='all' or review_state=?) and (?='all' or visibility=?) and (?='all' or collection_type=?) and lower(draft_title) like ?",Long.class,state,state,visibility,visibility,type,type,"%"+q.toLowerCase(Locale.ROOT)+"%");
  return Map.of("items",all.stream().map(this::summary).toList(),"page",page,"size",size,"total",total);
 }
 @Transactional(readOnly=true)
 Map<String,Object> details(String id,String player,boolean moderator) {
  Row r=row(id);if(!moderator)owner(r,player);var result=summary(r);
  result.put("draftDocument",json.readCollection(r.draft()));result.put("document",json.readCollection(r.draft()));
  result.put("submittedDocument",r.submitted()==null?null:document(r,r.submitted()));result.put("publishedDocument",r.published()==null?null:document(r,r.published()));
  result.put("versions",jdbc.queryForList("select revision,created_at from collection_versions where collection_id=? order by revision desc",r.id()));
  result.put("events",jdbc.queryForList("select id,revision,action,reason,created_at"+(moderator?",actor_id,internal_note":"")+" from collection_moderation_events where collection_id=? order by created_at desc",r.id()));
  result.put("dependencies",dependencies(r.id(),r.draftRevision(),json.readCollection(r.draft()),r.owner()));result.put("validation",validation(r,json.readCollection(r.draft())));
  return result;
 }
 private Map<String,Object> validation(Row r,CollectionDocument d){try{normalize(d,r.owner(),r.id(),true);return Map.of("valid",true,"errors",List.of());}catch(org.springframework.web.server.ResponseStatusException ex){return Map.of("valid",false,"errors",List.of(Objects.toString(ex.getReason(),"Invalid collection")));}}
 @Transactional(readOnly=true)
 Map<String,Object> preview(String id,String player,boolean moderator,String selection) {
  Row r=row(id);if(!moderator)owner(r,player);
  Integer rev=switch(selection){case "draft"->r.draftRevision();case "submitted"->r.submitted();case "published"->r.published();default->{try{yield Integer.valueOf(selection);}catch(NumberFormatException ex){throw bad("Unknown revision");}}};
  var d=document(r,rev);var m=new LinkedHashMap<String,Object>();m.put("collectionId",r.id());m.put("revision",rev);m.put("privatePreview",true);m.put("document",d);m.put("publishedDocument",r.published()==null?null:document(r,r.published()));m.put("validation",validation(r,d));m.put("dependencies",dependencies(r.id(),rev,d,r.owner()));m.put("readerItems",publicItems(d,false));return m;
 }
 @Transactional
 Map<String,Object> create(CollectionDocument d,String player) {
  structureLock();if(d==null)throw bad("Collection document required");name(d.key(),"collection key");
  if(jdbc.queryForObject("select count(*) from work_collections where collection_key=?",Integer.class,d.key())>0)throw conflict("Collection key already exists");
  String id=UUID.randomUUID().toString();d=normalize(d,player,id,false);String body=json.write(d);
  jdbc.update("insert into work_collections(id,collection_key,collection_type,owner_player_id,draft_json,draft_title) values (?,?,?,?,?,?)",id,d.key(),d.type(),player,body,d.title());
  jdbc.update("insert into collection_versions(collection_id,revision,document_json) values (?,1,?)",id,body);reindex(row(id));return summary(row(id));
 }
 @Transactional
 Map<String,Object> save(String id,int generation,CollectionDocument d,String player) {
  Row r=lock(id);owner(r,player);expected(r,generation);if("deleted".equals(r.visibility()))throw conflict("Restore collection before editing");
  if(d==null)throw bad("Collection document required");
  if(!Objects.equals(d.key(),r.key())||!Objects.equals(d.type(),r.type()))throw bad("Collection key and type are immutable");
  d=normalize(d,player,id,false);String body=json.write(d);if(body.equals(r.draft()))return summary(r);
  int revision=r.draftRevision()+1;
  jdbc.update("insert into collection_versions(collection_id,revision,document_json) values (?,?,?)",id,revision,body);
  jdbc.update("update work_collections set draft_json=?,draft_title=?,draft_revision=?,generation=generation+1,updated_at=current_timestamp where id=?",body,d.title(),revision,id);
  reindex(row(id));return summary(row(id));
 }
 CollectionDocument normalize(CollectionDocument d,String owner,String id,boolean strict) {
  if(d==null)throw bad("Collection document required");name(d.key(),"collection key");
  if(d.schemaVersion()!=null&&d.schemaVersion()!=1)throw bad("Unsupported collection schema");
  if(d.type()==null||!List.of("story","volume","cycle","catalog").contains(d.type()))throw bad("Invalid collection type");
  if(d.title()==null||d.title().isBlank()||d.title().length()>200)throw bad("Collection title is required (max 200 characters)");
  if(d.description()!=null&&d.description().length()>10000)throw bad("Description too long");
  if(d.completionStatus()!=null&&!List.of("completed","in_development","abandoned").contains(d.completionStatus()))throw bad("Invalid completion status");
  if(d.coverUrl()!=null&&!d.coverUrl().isBlank()){
   String cover=d.coverUrl();boolean asset=cover.startsWith("/assets/")&&cover.matches("/[A-Za-z0-9_./-]+")&&!Arrays.asList(cover.split("/")).contains("..");
   if(cover.length()>2000||!asset)throw bad("Collection cover must use a public /assets/ path");
  }
  if(list(d.items()).size()>500)throw bad("A collection may contain at most 500 direct items");
  var references=new ArrayList<WorkMetadata.Target>();for(var i:list(d.items())){if(i==null)throw bad("Collection item is required");references.add(i.target());}for(var p:list(d.transitions())){if(p==null)throw bad("Transition is required");references.add(p.from());references.add(p.to());}
  var targets=links.references(references);
  // All legacy type values now describe ordinary folders. Check the actual graph,
  // reserving both draft and published membership while publication is pending.
  var memberships=jdbc.queryForList("select m.parent_id,m.target_kind,m.target_id from collection_memberships m join work_collections c on c.id=m.parent_id where c.owner_player_id=?",owner);
  Set<String> unique=new HashSet<>();var items=new ArrayList<CollectionDocument.Item>();
  for(var item:list(d.items())) {
   var t=targets.resolve(item.target(),owner,strict);String identity=t.kind()+":"+(t.id()==null?t.key():t.id());
   if(!unique.add(identity))throw bad("Duplicate collection item");if(item.label()!=null&&item.label().length()>200)throw bad("Item label too long");
   if("collection".equals(t.kind())&&Objects.equals(t.id(),id))throw bad("Collection cannot include itself");
   if(t.id()!=null)validateChild(id,t,owner,targets.info(t),memberships);
   items.add(new CollectionDocument.Item(t,item.label()));
  }
  var transitions=new ArrayList<CollectionDocument.Transition>();Set<String> policyIds=new HashSet<>(),pairs=new HashSet<>();
  for(var t:list(d.transitions())) {
   name(t.id(),"transition id");
   if(!policyIds.add(t.id()))throw bad("Duplicate transition id");var from=targets.resolve(t.from(),owner,strict);var to=targets.resolve(t.to(),owner,strict);
   if(!"scenario".equals(from.kind())||!"scenario".equals(to.kind()))throw bad("Transitions require scenario chapters");
   int index=-1;for(int i=0;i<items.size();i++)if(same(items.get(i).target(),from))index=i;
   if(index<0||index+1>=items.size()||!same(items.get(index+1).target(),to))throw bad("Transition endpoints must be adjacent in this reading order; fix the policy after reordering");
   if(!pairs.add(from.key()+":"+to.key()))throw bad("Duplicate chapter transition");links.validateTransfer(t.stateTransfer());
   if(strict&&t.stateTransfer()!=null&&"mapped".equals(t.stateTransfer().mode()))links.validateMapping(links.targetDocument(from,owner),links.targetDocument(to,owner),t.stateTransfer());
   transitions.add(new CollectionDocument.Transition(t.id(),from,to,t.stateTransfer()));
  }
  return new CollectionDocument(1,d.key(),d.type(),d.title(),d.description(),d.coverUrl(),d.completionStatus(),items,transitions);
 }
 static boolean same(WorkMetadata.Target a,WorkMetadata.Target b){return a.kind().equals(b.kind())&&(a.id()!=null&&b.id()!=null?a.id().equals(b.id()):Objects.equals(a.key(),b.key()));}
 private void validateChild(String parentId,WorkMetadata.Target t,String owner,WorkLinksService.TargetInfo child,List<Map<String,Object>> memberships) {
  if(!Objects.equals(owner,child.owner()))throw bad("Only your own works can be grouped");
  if(memberships.stream().anyMatch(m->t.kind().equals(m.get("target_kind"))&&t.id().equals(m.get("target_id"))&&!parentId.equals(m.get("parent_id"))))throw conflict("This work is already in another folder");
  if(!"collection".equals(t.kind()))return;
  var descendants=new ArrayDeque<String>();descendants.add(t.id());Set<String> visited=new HashSet<>();
  while(!descendants.isEmpty()){
   String current=descendants.remove();if(current.equals(parentId))throw bad("A folder cannot contain itself or its parent");if(!visited.add(current))continue;
   for(var m:memberships)if(current.equals(m.get("parent_id"))&&"collection".equals(m.get("target_kind")))descendants.add((String)m.get("target_id"));
  }
 }
 private void reindex(Row r) {
  var draft=json.readCollection(r.draft());var published=r.published()==null?null:document(r,r.published());
  Map<String,WorkMetadata.Target> targets=new LinkedHashMap<>();Set<String> draftKeys=new HashSet<>(),publishedKeys=new HashSet<>();
  for(var item:list(draft.items()))if(item.target().id()!=null){String k=item.target().kind()+":"+item.target().id();draftKeys.add(k);targets.put(k,item.target());}
  if(published!=null)for(var item:list(published.items()))if(item.target().id()!=null){String k=item.target().kind()+":"+item.target().id();publishedKeys.add(k);targets.put(k,item.target());}
  jdbc.update("delete from collection_memberships where parent_id=?",r.id());
  targets.forEach((k,t)->jdbc.update("insert into collection_memberships(parent_id,target_kind,target_id,main_parent,in_draft,in_published) values (?,?,?,?,?,?)",r.id(),t.kind(),t.id(),true,draftKeys.contains(k),publishedKeys.contains(k)));
 }
 @Transactional
 Map<String,Object> submit(String id,String player,int generation,boolean replace,AuthIdentity actor) {
  Row r=lock(id);owner(r,player);expected(r,generation);if("deleted".equals(r.visibility()))throw conflict("Restore collection first");
  if("in_review".equals(r.review())&&Objects.equals(r.submitted(),r.draftRevision()))return summary(r);
  if("in_review".equals(r.review())&&!replace)throw conflict("Confirm replacement of the previous submission");
  if(Objects.equals(r.published(),r.draftRevision()))throw conflict("This revision is already published");
  var normalized=normalize(json.readCollection(r.draft()),player,id,true);
  // Resolved IDs are frozen into a fresh immutable draft before submission.
  if(!json.write(normalized).equals(r.draft())){save(id,generation,normalized,player);r=row(id);}
  if("in_review".equals(r.review()))event(r,actor,"superseded",r.submitted(),"","");
  jdbc.update("update work_collections set submitted_revision=draft_revision,review_state='in_review',decision_reason='',generation=generation+1,updated_at=current_timestamp where id=?",id);
  event(r,actor,"submitted",r.draftRevision(),"","");return summary(row(id));
 }
 @Transactional
 Map<String,Object> withdraw(String id,String player,int generation,AuthIdentity actor) {
  Row r=lock(id);owner(r,player);expected(r,generation);if(!"in_review".equals(r.review()))throw conflict("No active submission");
  jdbc.update("update work_collections set submitted_revision=null,review_state='draft',generation=generation+1 where id=?",id);event(r,actor,"withdrawn",r.submitted(),"","");return summary(row(id));
 }
 @Transactional
 Map<String,Object> takeDown(String id,String player,int generation,boolean delete,AuthIdentity actor) {
  Row r=lock(id);owner(r,player);expected(r,generation);if(r.restricted())throw new ForbiddenRoleException();
  if(delete&&r.published()!=null)throw conflict("Published collections can be archived, not deleted by the author");
  jdbc.update("update work_collections set visibility=?,submitted_revision=null,review_state=case when review_state='in_review' then 'draft' else review_state end,generation=generation+1 where id=?",delete?"deleted":"archived",id);
  event(r,actor,delete?"author_delete":"author_archive",r.draftRevision(),"","");return summary(row(id));
 }
 Map<String,Object> decide(String id,String action,StoryWorkflowService.Decision c,AuthIdentity actor) {
  Row r=lock(id);expected(r,c.generation());boolean self=players.findById(r.owner()).map(p->actor.userId().equals(p.getUserId())).orElse(false);
  ModerationPolicy.authorizeDecision(actor,self,action,c.ownOverride());boolean approve=List.of("approve","approve-publish").contains(action);
  String reason=ModerationPolicy.reason(c.reason(),!approve||self),note=ModerationPolicy.reason(c.internalNote(),false);
  if("publish-approved".equals(action)) {
   if(!"approved".equals(r.review())||!Objects.equals(r.submitted(),c.revision()))throw conflict("Select the approved revision");publish(r,c.revision(),c.visibility());
  }else if(approve||"reject".equals(action)) {
   boolean reviewable="in_review".equals(r.review())||("reject".equals(action)&&"approved".equals(r.review())&&!Objects.equals(r.published(),r.submitted()));
   if(!reviewable||!Objects.equals(r.submitted(),c.revision()))throw conflict("The reviewed submission is no longer current");
   if("deleted".equals(r.visibility()))throw conflict("Restore collection first");
   if(approve)normalize(document(r,c.revision()),r.owner(),r.id(),true);
   if("approve-publish".equals(action))publish(r,c.revision(),c.visibility());
   jdbc.update("update work_collections set review_state=?,decision_reason=? where id=?",approve?"approved":"rejected",reason,id);
  }else {
   String next=switch(action){case "hide"->"hidden";case "archive"->"archived";case "delete"->"deleted";case "restore"->"private";case "visibility"->c.visibility();default->throw bad("Unknown moderation action");};
   if(next==null||!List.of("public","unlisted","private","hidden","archived","deleted").contains(next))throw bad("Unknown visibility");
   if((r.restricted()&&List.of("public","unlisted").contains(next))||("deleted".equals(r.visibility())&&!"restore".equals(action)))throw conflict("Restore availability explicitly first");
   if("restore".equals(action)&&!List.of("hidden","deleted","archived").contains(r.visibility()))throw conflict("Collection is not restricted");
   if(List.of("public","unlisted").contains(next)&&r.published()==null)throw conflict("Publish an approved revision explicitly first");
   jdbc.update("update work_collections set visibility=?,restricted=?,decision_reason=? where id=?",next,List.of("hidden","archived","deleted").contains(next),reason,id);
  }
  jdbc.update("update work_collections set generation=generation+1,updated_at=current_timestamp where id=?",id);event(r,actor,action,c.revision(),reason,note);
  players.findById(r.owner()).filter(p->p.getUserId()!=null).ifPresent(p->jdbc.update("insert into account_notifications(id,user_id,kind,message,collection_id,revision,reviewer_id) values (?,?,'moderation',?,?,?,?)",UUID.randomUUID().toString(),p.getUserId(),"Collection: "+action+(reason.isBlank()?"":" — "+reason),id,c.revision(),actor.userId()));
  notifyNewChapters();return summary(row(id));
 }
 private void publish(Row r,int revision,String visibility) {
  if(r.restricted()||List.of("hidden","archived","deleted").contains(r.visibility()))throw conflict("Restore availability explicitly before publication");
  if(visibility!=null&&!List.of("public","unlisted").contains(visibility))throw bad("Publication visibility must be public or unlisted");
  var document=normalize(document(r,revision),r.owner(),r.id(),true);
  jdbc.update("update work_collections set published_revision=?,published_title=?,visibility=? where id=?",revision,document.title(),"unlisted".equals(visibility)?"unlisted":"public",r.id());reindex(row(r.id()));
 }
 private void event(Row r,AuthIdentity actor,String action,Integer revision,String reason,String note){jdbc.update("insert into collection_moderation_events(id,collection_id,revision,actor_id,action,reason,internal_note) values (?,?,?,?,?,?,?)",UUID.randomUUID().toString(),r.id(),revision,actor.userId(),action,reason,note);}
 boolean listed(Row r){return r.published()!=null&&"public".equals(r.visibility());}
 Row accessible(String id,boolean guest){if(guest)throw new AuthRequiredException();Row r=row(id);if(r.published()==null||!List.of("public","unlisted").contains(r.visibility()))throw new StoryNotFoundException();return r;}
 @Transactional(readOnly=true)
 List<Map<String,Object>> catalog(boolean guest,String player,int page,int size,String q,String type,boolean favorites){if(guest)return List.of();return jdbc.query("select c.*,v.document_json,exists(select 1 from collection_favorites f where f.collection_id=c.id and f.player_id=?) as favorite from work_collections c join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision where visibility='public' and (lower(published_title) like ? or lower(collection_key) like ?) and (?='all' or collection_type=?) and (?=false or exists(select 1 from collection_favorites f where f.collection_id=c.id and f.player_id=?)) order by c.updated_at desc limit ? offset ?",(r,n)->publicSummary(map(r,n),json.readCollection(r.getString("document_json")),r.getBoolean("favorite")),player,"%"+q.toLowerCase(Locale.ROOT)+"%","%"+q.toLowerCase(Locale.ROOT)+"%",type,type,favorites,player,Math.max(1,Math.min(100,size)),Math.max(0,page)*Math.max(1,Math.min(100,size)));}
 private Map<String,Object> publicSummary(Row r,String player){return publicSummary(r,document(r,r.published()),player!=null&&jdbc.queryForObject("select count(*) from collection_favorites where player_id=? and collection_id=?",Integer.class,player,r.id())>0);}
 private Map<String,Object> publicSummary(Row r,CollectionDocument d,boolean favorite){var m=new LinkedHashMap<String,Object>();m.put("id",r.id());m.put("collectionId",r.id());m.put("key",r.key());m.put("slug",r.key());m.put("kind","collection");m.put("type",r.type());m.put("title",d.title());m.put("description",d.description());m.put("coverUrl",d.coverUrl());m.put("completionStatus",d.completionStatus());m.put("revision",r.published());m.put("favorite",favorite);return m;}
 @Transactional(readOnly=true)
 Map<String,Object> publicDetail(String id,boolean guest,String player){Row r=accessible(id,guest);var m=publicSummary(r,player);var items=publicItems(document(r,r.published()),guest);m.put("items",items);m.put("availableCount",items.size());m.put("breadcrumbs",breadcrumbs("collection",r.id(),guest));return m;}
 List<Map<String,Object>> publicItems(CollectionDocument d,boolean guest) {
  String owner=row(d.key()).owner();
  var scenarioIds=list(d.items()).stream().map(CollectionDocument.Item::target).filter(t->"scenario".equals(t.kind())&&t.id()!=null).map(WorkMetadata.Target::id).toList();
  var scenarioMap=stories.findAllById(scenarioIds).stream().filter(s->Objects.equals(owner,s.getOwnerPlayerId())).filter(StoryAccessService::listed).filter(s->!guest||GuestDemoStories.includes(s.getKey())).collect(Collectors.toMap(Story::getId,s->s));
  var collectionIds=list(d.items()).stream().map(CollectionDocument.Item::target).filter(t->"collection".equals(t.kind())&&t.id()!=null).map(WorkMetadata.Target::id).distinct().toList();
  Map<String,Map<String,Object>> collectionMap=new HashMap<>();
  if(!guest&&!collectionIds.isEmpty())jdbc.query("select c.*,v.document_json from work_collections c join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision where c.visibility='public' and c.id in ("+String.join(",",Collections.nCopies(collectionIds.size(),"?"))+")",rs->{Row row=map(rs,0);if(Objects.equals(owner,row.owner()))collectionMap.put(row.id(),publicSummary(row,json.readCollection(rs.getString("document_json")),false));},collectionIds.toArray());
  var result=new ArrayList<Map<String,Object>>();
  for(var item:list(d.items())) {var t=item.target();Map<String,Object> m=null;
   if("scenario".equals(t.kind())){var s=scenarioMap.get(t.id());if(s!=null){m=new LinkedHashMap<>();m.put("id",s.getId());m.put("key",s.getKey());m.put("slug",s.getPublishedSlug());m.put("kind","scenario");m.put("type","scenario");m.put("title",s.getTitle());m.put("revision",s.getPublishedRevision());var metadata=s.getMetadataJson()==null?null:json.readValue(s.getMetadataJson(),WorkMetadata.class);m.put("allowIndependentStart",metadata==null||metadata.inputContract()==null||Boolean.TRUE.equals(metadata.inputContract().allowIndependentStart()));}}
   else if(!guest&&collectionMap.containsKey(t.id()))m=collectionMap.get(t.id());
   if(m!=null){m.put("label",item.label());result.add(m);}
  }return result;
 }
 List<Map<String,Object>> breadcrumbs(String kind,String id,boolean guest){var result=new ArrayList<Map<String,Object>>();if(guest)return result;Set<String> seen=new HashSet<>();while(seen.add(kind+":"+id)){var rows=jdbc.query("select c.* from work_collections c join collection_memberships m on m.parent_id=c.id where m.target_kind=? and m.target_id=? and m.in_published=true and c.visibility='public' and c.published_revision is not null",this::map,kind,id);if(rows.isEmpty())break;String childOwner="scenario".equals(kind)?stories.findById(id).map(Story::getOwnerPlayerId).orElse(null):row(id).owner();Row r=rows.stream().filter(c->Objects.equals(c.owner(),childOwner)).findFirst().orElse(null);if(r==null)break;result.add(0,publicSummary(r,null));id=r.id();kind="collection";}return result;}
 @Transactional
 Map<String,Object> favorite(String id,String player,boolean favorite){Row r=accessible(id,false);jdbc.queryForObject("select id from players where id=? for update",String.class,player);if(favorite){if(jdbc.queryForObject("select count(*) from collection_favorites where collection_id=? and player_id=?",Integer.class,r.id(),player)==0)jdbc.update("insert into collection_favorites(player_id,collection_id) values (?,?)",player,r.id());}else jdbc.update("delete from collection_favorites where player_id=? and collection_id=?",player,r.id());return Map.of("favorite",favorite);}
 @Transactional
 void notifyNewChapters(){
  structureLock();var rows=jdbc.queryForList("select c.id as collection_id,m.target_id as story_id from work_collections c join collection_memberships m on m.parent_id=c.id join stories s on s.id=m.target_id and s.owner_player_id=c.owner_player_id where c.visibility='public' and c.published_revision is not null and m.target_kind='scenario' and m.in_published=true and s.visibility='public' and s.status='PUBLISHED' and s.published_revision is not null");
  for(var r:rows){String cid=(String)r.get("collection_id"),sid=(String)r.get("story_id");if(jdbc.queryForObject("select count(*) from collection_released_chapters where collection_id=? and story_id=?",Integer.class,cid,sid)>0)continue;
   jdbc.update("insert into collection_released_chapters(collection_id,story_id) values (?,?)",cid,sid);
   for(String uid:jdbc.query("select p.user_id from collection_favorites f join players p on p.id=f.player_id where f.collection_id=? and p.user_id is not null",(rs,n)->rs.getString(1),cid))jdbc.update("insert into account_notifications(id,user_id,kind,message,story_id,collection_id) values (?,?,'chapter','Новая глава',?,?)",UUID.randomUUID().toString(),uid,sid,cid);
  }
 }
 Set<String> listedChapterIds(){return new HashSet<>(jdbc.query("select m.target_id from collection_memberships m join work_collections c on c.id=m.parent_id join stories s on s.id=m.target_id and s.owner_player_id=c.owner_player_id where c.visibility='public' and c.published_revision is not null and m.in_published=true and m.target_kind='scenario'",(r,n)->r.getString(1)));}
 List<Map<String,Object>> targets(String player,String q,int page,int size){var result=new ArrayList<Map<String,Object>>();String query=q==null?"":q.toLowerCase(Locale.ROOT);
  // Bounded paginated source queries avoid returning private targets owned by another user.
  for(var s:jdbc.queryForList("select s.id,s.story_key,s.title,s.owner_player_id,s.visibility,w.draft_json from stories s join story_workspaces w on w.story_id=s.id where s.owner_player_id=? and (lower(s.title) like ? or lower(s.story_key) like ? or lower(w.draft_json) like ?) order by s.story_key limit ? offset ?",player,"%"+query+"%","%"+query+"%","%"+query+"%",Math.min(100,Math.max(1,size)),Math.max(0,page)*Math.min(100,Math.max(1,size)))){
   boolean own=Objects.equals(player,s.get("owner_player_id"));var m=new LinkedHashMap<String,Object>();m.put("id",s.get("id"));m.put("key",s.get("story_key"));m.put("kind","scenario");m.put("type","scenario");m.put("title",own?json.readStory((String)s.get("draft_json")).title():s.get("title"));m.put("owned",own);m.put("visibility",s.get("visibility"));
   var target=new WorkMetadata.Target("scenario",(String)s.get("id"),(String)s.get("story_key"));var doc=links.targetDocument(target,player);m.put("inputContract",doc.metadata()==null?null:json.readObject(json.write(doc.metadata().inputContract())));result.add(m);
  }
  for(Row r:jdbc.query("select * from work_collections where owner_player_id=? and (lower(collection_key) like ? or lower(draft_title) like ?) order by collection_key limit ? offset ?",this::map,player,"%"+query+"%","%"+query+"%",Math.min(100,Math.max(1,size)),Math.max(0,page)*Math.min(100,Math.max(1,size)))){var d=json.readCollection(r.draft());result.add(Map.of("id",r.id(),"key",r.key(),"kind","collection","type",r.type(),"title",d.title(),"owned",true,"visibility",r.visibility()));}return result;
 }
 List<Map<String,Object>> dependencies(String collectionId,int revision,CollectionDocument d,String owner){
  var result=new ArrayList<Map<String,Object>>();
  for(var i:list(d.items())){
   WorkMetadata.Target t;
   try{t=links.resolve(i.target(),owner,false);}catch(org.springframework.web.server.ResponseStatusException ex){
    // Legacy drafts remain editable without exposing the referenced owner's content.
    var unavailable=new LinkedHashMap<String,Object>();unavailable.put("kind",i.target().kind());unavailable.put("resolved",false);unavailable.put("available",false);unavailable.put("error",ex.getReason());result.add(unavailable);continue;
   }
   if(t.id()==null){result.add(Map.of("key",t.key(),"kind",t.kind(),"resolved",false));continue;}
   if("scenario".equals(t.kind())){
    var s=stories.findById(t.id()).orElseThrow();var w=jdbc.queryForMap("select draft_revision,submitted_revision,review_state,generation from story_workspaces where story_id=?",s.getId());var m=new LinkedHashMap<String,Object>();
    m.put("id",s.getId());m.put("kind","scenario");m.put("title",s.getTitle());m.put("publishedRevision",s.getPublishedRevision());m.put("draftRevision",w.get("draft_revision"));m.put("submittedRevision",w.get("submitted_revision"));m.put("reviewState",w.get("review_state"));m.put("generation",w.get("generation"));m.put("available",StoryAccessService.listed(s));result.add(m);
   }else{var m=summary(row(t.id()));m.put("kind","collection");result.add(m);}
  }
  var pinned=jdbc.queryForList("select target_kind,target_id,requested_revision,batch_id from collection_review_dependencies where collection_id=? and collection_revision=?",collectionId,revision);
  for(var item:result)for(var dependency:pinned)if(Objects.equals(item.get("kind"),dependency.get("target_kind"))&&Objects.equals(item.get("id"),dependency.get("target_id"))){item.put("requestedRevision",dependency.get("requested_revision"));item.put("batchId",dependency.get("batch_id"));item.put("requestedRevisionCurrent",Objects.equals(item.get("submittedRevision"),dependency.get("requested_revision")));}
  return result;
 }
}
