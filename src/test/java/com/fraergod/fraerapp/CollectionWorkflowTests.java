package com.fraergod.fraerapp;

import java.util.*;
import java.net.http.HttpResponse;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=${COLLECTIONS_TEST_DB:jdbc:h2:mem:collections;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
 "spring.datasource.username=${COLLECTIONS_TEST_USER:sa}","spring.datasource.password=${COLLECTIONS_TEST_PASSWORD:}",
 "spring.jpa.hibernate.ddl-auto=validate","app.assets.storage-path=build/test-uploads/collections"
})
class CollectionWorkflowTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 final String author=TestJwtFactory.author("collection-author-"+UUID.randomUUID()+"@example.test");
 final String reviewer=TestJwtFactory.moderator("collection-reviewer-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("collection-reader-"+UUID.randomUUID()+"@example.test");
 String key(){return "work_"+UUID.randomUUID().toString().replace("-","");}
 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> r){assertThat(r.statusCode()).as(r.body()).isEqualTo(200);return object(r.body());}
 Map<String,Object> scenario(String key,int score){var m=new LinkedHashMap<String,Object>();m.put("key",key);m.put("title",key);m.put("version",1);m.put("startSceneId","start");m.put("variables",Map.of("score",score,"met",true));m.put("assets",List.of());m.put("scenes",List.of(Map.of("id","start","title","Start","text","Start","effects",List.of(Map.of("inc","score","value",2)),"choices",List.of(Map.of("id","go","label","Go","target","end"))),Map.of("id","end","title","End","text","End","ending",Map.of("title","Done"),"choices",List.of())));return m;}
 Map<String,Object> draft(Map<String,Object> d){return ok(call("POST","/api/author/stories/import",d,author));}
 String sid(Map<String,Object> s){return s.get("storyId").toString();}
 String cid(Map<String,Object> s){return s.get("collectionId").toString();}
 Map<String,Object> item(String kind,Map<String,Object> target){return Map.of("target",Map.of("kind",kind,"id",target.get(kind.equals("scenario")?"storyId":"collectionId"),"key",target.get("key")));}
 Map<String,Object> document(String type,List<?> items){return new LinkedHashMap<>(Map.of("schemaVersion",1,"key",key(),"title","Collection "+key(),"type",type,"items",items,"transitions",List.of()));}
 Map<String,Object> create(Map<String,Object> d){return ok(call("POST","/api/author/collections",Map.of("document",d),author));}
 Map<String,Object> details(String id){return ok(call("GET","/api/author/collections/"+id,null,author));}
 Map<String,Object> save(String id,Map<String,Object> d){return ok(call("PUT","/api/author/collections/"+id,Map.of("generation",details(id).get("generation"),"document",d),author));}
 Map<String,Object> submit(String id){return ok(call("POST","/api/author/collections/"+id+"/review",Map.of("generation",details(id).get("generation"),"replaceReview",true),author));}
 Map<String,Object> decide(String id,String action){var d=details(id);var c=new LinkedHashMap<String,Object>();c.put("generation",d.get("generation"));c.put("revision",d.get("submittedRevision"));c.put("reason","Reviewed");return ok(call("POST","/api/moderation/collections/"+id+"/"+action,c,reviewer));}
 void publish(String id){submit(id);decide(id,"approve-publish");}
 void publishStory(Map<String,Object> s){ok(approveAndPublish(port,sid(s),author));}
 Map<String,Object> run(String collection){return ok(call("POST","/api/collections/"+collection+"/runs",Map.of("requestId",key()),reader));}
 Map<String,Object> start(String run,String target,String source,String request){var c=new LinkedHashMap<String,Object>();c.put("targetId",target);c.put("sourceSessionId",source);c.put("requestId",request);return ok(call("POST","/api/collection-runs/"+run+"/start",c,reader));}
 @SuppressWarnings("unchecked") Map<String,Object> session(Map<String,Object> result){return (Map<String,Object>)result.get("session");}
 String sessionId(Map<String,Object> result){return session(result).get("sessionId").toString();}
 void finish(String id){ok(call("POST","/api/sessions/"+id+"/choice",Map.of("choiceId","go"),reader));}
 Map<String,Object> transfer(){return Map.of("mode","mapped","contractVersion",1,"mapping",List.of(Map.of("from","score","to","score","type","number")));}
 Map<String,Object> contract(boolean independent){return Map.of("version",1,"allowIndependentStart",independent,"fields",List.of(Map.of("name","score","type","number","required",true,"min",0,"max",100)));}
 @SuppressWarnings("unchecked") List<Map<String,Object>> maps(Object value){return (List<Map<String,Object>>)value;}
 Map<String,Object> folderReview(String id){return ok(call("GET","/api/moderation/folders/"+id+"/review",null,reviewer));}
 Map<String,Object> folderDecision(Map<String,Object> preview,String action){var cmd=new LinkedHashMap<String,Object>();cmd.put("action",action);cmd.put("rootGeneration",preview.get("rootGeneration"));cmd.put("items",maps(preview.get("items")).stream().map(i->Map.of("kind",i.get("kind"),"id",i.get("id"),"generation",i.get("generation"),"revision",i.get("revision"))).toList());cmd.put("reason","Reviewed together");return cmd;}
 void batch(String id){ok(call("POST","/api/author/collections/"+id+"/review-batch",Map.of("generation",details(id).get("generation"),"replaceReview",true),author));}
 @Test void onePendingStoryBlocksOnlySubmissionUntilModeratorAnswers() {
  var first=draft(scenario(key(),1));var secondDoc=scenario(key(),2);var second=draft(secondDoc);
  var pending=ok(call("POST","/api/author/stories/"+sid(first)+"/review",Map.of("generation",first.get("generation")),author));
  secondDoc.put("title","Still editable while waiting");second=draft(secondDoc);
  var denied=call("POST","/api/author/stories/"+sid(second)+"/review",Map.of("generation",second.get("generation")),author);
  assertThat(denied.statusCode()).isEqualTo(409);assertThat(object(denied.body())).containsEntry("code","REVIEW_LIMIT_REACHED");
  assertThat(ok(call("GET","/api/author/stories/"+sid(second),null,author))).containsEntry("reviewState","draft").containsEntry("reviewLimitReached",true);
  assertThat(draft(scenario(key(),3)).get("reviewState")).isEqualTo("draft");
  String other=TestJwtFactory.author("independent-"+UUID.randomUUID()+"@example.test");
  var theirs=ok(call("POST","/api/author/stories/import",scenario(key(),4),other));
  ok(call("POST","/api/author/stories/"+sid(theirs)+"/review",Map.of("generation",theirs.get("generation")),other));
  ok(call("POST","/api/moderation/stories/"+sid(first)+"/approve",Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision")),reviewer));
  pending=ok(call("POST","/api/author/stories/"+sid(second)+"/review",Map.of("generation",second.get("generation")),author));
  ok(call("POST","/api/moderation/stories/"+sid(second)+"/reject",Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision"),"reason","Please revise"),reviewer));
  var fresh=ok(call("GET","/api/author/stories/"+sid(first),null,author));
  ok(call("POST","/api/author/stories/"+sid(first)+"/review",Map.of("generation",fresh.get("generation")),author));
 }
 @Test void concurrentDifferentStoriesHaveOneSubmissionWinner() throws Exception {
  var first=draft(scenario(key(),1));var second=draft(scenario(key(),2));
  assertThat(race(()->call("POST","/api/author/stories/"+sid(first)+"/review",Map.of("generation",first.get("generation")),author).statusCode(),
   ()->call("POST","/api/author/stories/"+sid(second)+"/review",Map.of("generation",second.get("generation")),author).statusCode())).containsExactlyInAnyOrder(200,409);
 }
 @Test void chaptersShareOneStorySlotAndOtherStoryBatchRollsBack() {
  var a=draft(scenario(key(),1));var b=draft(scenario(key(),2));var firstDoc=document("story",List.of(item("scenario",a),item("scenario",b)));firstDoc.put("schemaVersion",2);String first=cid(create(firstDoc));
  ok(call("POST","/api/author/collections/"+first+"/chapters/review",Map.of("storyId",sid(a),"storyGeneration",a.get("generation"),"generation",details(first).get("generation")),author));
  ok(call("POST","/api/author/collections/"+first+"/chapters/review",Map.of("storyId",sid(b),"storyGeneration",b.get("generation"),"generation",details(first).get("generation"),"replaceReview",true),author));
  assertThat(maps(folderReview(first).get("items"))).hasSize(3);
  var c=draft(scenario(key(),3));String second=cid(create(document("story",List.of(item("scenario",c)))));
  var denied=call("POST","/api/author/collections/"+second+"/review-batch",Map.of("generation",details(second).get("generation")),author);
  assertThat(denied.statusCode()).isEqualTo(409);assertThat(details(second)).containsEntry("reviewState","draft").containsEntry("reviewLimitReached",true);
  assertThat(ok(call("GET","/api/author/stories/"+sid(c),null,author))).containsEntry("reviewState","draft");
  var application=folderReview(first);ok(call("POST","/api/moderation/folders/"+first+"/decision",folderDecision(application,"reject"),reviewer));batch(second);
 }
 @Test void unrelatedBatchIsAtomicAndWithdrawalFreesTheSlot() {
  var a=draft(scenario(key(),1));var b=draft(scenario(key(),2));
  var batch=Map.of("items",List.of(Map.of("kind","scenario","id",sid(a),"generation",a.get("generation")),Map.of("kind","scenario","id",sid(b),"generation",b.get("generation"))));
  assertThat(call("POST","/api/author/review-batch",batch,author).statusCode()).isEqualTo(409);
  for(var s:List.of(a,b))assertThat(ok(call("GET","/api/author/stories/"+sid(s),null,author))).containsEntry("reviewState","draft");
  var pending=ok(call("POST","/api/author/stories/"+sid(a)+"/review",Map.of("generation",a.get("generation")),author));
  String admin=TestJwtFactory.admin("quota-admin-"+UUID.randomUUID()+"@example.test");
  var denied=call("POST","/api/admin/stories/"+sid(b)+"/review",Map.of("generation",b.get("generation")),admin);
  assertThat(denied.statusCode()).isEqualTo(409);assertThat(object(denied.body())).containsEntry("code","REVIEW_LIMIT_REACHED");
  ok(call("POST","/api/author/stories/"+sid(a)+"/withdraw",Map.of("generation",pending.get("generation")),author));
  ok(call("POST","/api/author/stories/"+sid(b)+"/review",Map.of("generation",b.get("generation")),author));
 }
 @Test void movingAPendingChapterCannotChangeItsOccupiedStorySlot() {
  var aDoc=scenario(key(),1);var a=draft(aDoc);var firstDoc=document("story",List.of(item("scenario",a)));firstDoc.put("schemaVersion",2);String first=cid(create(firstDoc));
  ok(call("POST","/api/author/stories/"+sid(a)+"/review",Map.of("generation",a.get("generation")),author));
  aDoc.put("title","New draft of the pending chapter");a=draft(aDoc);
  ok(call("POST","/api/author/stories/"+sid(a)+"/review",Map.of("generation",a.get("generation"),"replaceReview",true),author));
  firstDoc.put("items",List.of());save(first,firstDoc);
  var b=draft(scenario(key(),2));var secondDoc=document("story",List.of(item("scenario",a),item("scenario",b)));secondDoc.put("schemaVersion",2);create(secondDoc);
  var denied=call("POST","/api/author/stories/"+sid(b)+"/review",Map.of("generation",b.get("generation")),author);
  assertThat(denied.statusCode()).isEqualTo(409);assertThat(object(denied.body())).containsEntry("code","REVIEW_LIMIT_REACHED");
 }
 @Test void moderatorRestrictionsFinishPendingChapterReview(){restrictionFinishesReview(false);}
 @Test void moderatorRestrictionsFinishPendingCollectionReview(){restrictionFinishesReview(true);}
 void restrictionFinishesReview(boolean collection){
  for(String action:List.of("hide","archive","delete")){
   var work=collection?create(document("story",List.of())):draft(scenario(key(),1));
   String id=collection?cid(work):sid(work),route=collection?"collections":"stories";
   var pending=ok(call("POST","/api/author/"+route+"/"+id+"/review",Map.of("generation",work.get("generation")),author));
   var decided=ok(call("POST","/api/moderation/"+route+"/"+id+"/"+action,Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision"),"reason","Moderator response"),reviewer));
   assertThat(decided).containsEntry("reviewState","rejected");
  }
  var next=draft(scenario(key(),2));ok(call("POST","/api/author/stories/"+sid(next)+"/review",Map.of("generation",next.get("generation")),author));
 }
 @Test void authorLinksForbidForeignPublicAndPrivateWorksByIdKeyAndPackage() {
  String foreign=TestJwtFactory.author("foreign-"+UUID.randomUUID()+"@example.test");
  for(boolean published:List.of(false,true)){
   var target=ok(call("POST","/api/author/stories/import",scenario(key(),1),foreign));if(published)ok(approveAndPublish(port,sid(target),foreign));
   var foreignFolder=ok(call("POST","/api/author/collections",Map.of("document",document("story",List.of())),foreign));
   if(published){var sent=ok(call("POST","/api/author/collections/"+cid(foreignFolder)+"/review",Map.of("generation",1),foreign));ok(call("POST","/api/moderation/collections/"+cid(foreignFolder)+"/approve-publish",Map.of("generation",sent.get("generation"),"revision",sent.get("submittedRevision")),reviewer));}
   for(String kind:List.of("scenario","collection"))for(String field:List.of("id","key")){
    var work=kind.equals("scenario")?target:foreignFolder;var ref=Map.of("kind",kind,field,field.equals("key")?work.get("key"):work.get(kind.equals("scenario")?"storyId":"collectionId"));
    var source=scenario(key(),1);source.put("metadata",Map.of("schemaVersion",1,"relations",List.of(Map.of("id","related","type","related","target",ref))));
    assertThat(call("POST","/api/author/stories/import",source,author).statusCode()).isEqualTo(400);
    assertThat(call("POST","/api/author/collections",Map.of("document",document("catalog",List.of(Map.of("target",ref)))),author).statusCode()).isEqualTo(400);
    var pkg=Map.of("schemaVersion",1,"kind","fraerapp-work-package","scenarios",List.of(source),"collections",List.of());
    assertThat(ok(call("POST","/api/author/collections/import-preview",pkg,author)).get("canImport")).isEqualTo(false);
    assertThat(call("POST","/api/author/collections/import",pkg,author).statusCode()).isEqualTo(400);
   }
   assertThat(call("GET","/api/author/collections/targets?q="+target.get("key"),null,author).body()).isEqualTo("[]");
   assertThat(call("GET","/api/author/collections/targets?q="+foreignFolder.get("key"),null,author).body()).isEqualTo("[]");
   if(published)assertThat(call("GET","/api/catalog/stories",null,reader).body()).contains(target.get("key").toString());
  }
 }
 @Test void folderQueueGroupsPendingChildrenAndPublishesOnlyExactSubmittedParts() {
  var unchanged=draft(scenario(key(),1));publishStory(unchanged);var changedDoc=scenario(key(),2);var changed=draft(changedDoc);publishStory(changed);var draftOnly=draft(scenario(key(),3));
  String id=cid(create(document("story",List.of(item("scenario",unchanged),item("scenario",changed),item("scenario",draftOnly)))));publish(id);
  changedDoc.put("title","Changed chapter");draft(changedDoc);var state=ok(call("GET","/api/author/stories/"+sid(changed),null,author));ok(call("POST","/api/author/stories/"+sid(changed)+"/review",Map.of("generation",state.get("generation")),author));
  var queue=ok(call("GET","/api/moderation/folders?q="+changed.get("key")+"&status=in_review",null,reviewer));assertThat(maps(queue.get("items"))).hasSize(1);assertThat(maps(queue.get("items")).get(0).get("id")).isEqualTo(id);assertThat(maps(queue.get("items")).get(0).get("pendingCount")).isEqualTo(1);
  var authorTree=ok(call("GET","/api/author/folders?q="+changed.get("key"),null,author));assertThat(maps(authorTree.get("items"))).hasSize(1);assertThat(maps(maps(authorTree.get("items")).get(0).get("children"))).hasSize(3);
  var preview=folderReview(id);assertThat(preview.get("canDecide")).isEqualTo(true);assertThat(maps(preview.get("items"))).hasSize(1);assertThat(maps(preview.get("items")).get(0).get("id")).isEqualTo(sid(changed));assertThat(body(maps(preview.get("items")).get(0).get("document"))).contains("Changed chapter");assertThat(body(maps(preview.get("items")).get(0).get("publishedDocument"))).doesNotContain("Changed chapter");
  var unreviewed=new LinkedHashMap<>(changedDoc);unreviewed.put("title","Later draft remains private");draft(unreviewed);
  assertThat(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(preview,"approve-publish"),reviewer).statusCode()).isEqualTo(409);
  preview=folderReview(id);ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(preview,"approve-publish"),reviewer));
  assertThat(details(id).get("publishedRevision")).isEqualTo(1);assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(unchanged))).isEqualTo(1);assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(changed))).isEqualTo(2);assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(draftOnly))).isNull();
  assertThat(call("GET","/api/catalog/collections/"+id,null,reader).body()).contains("Changed chapter").doesNotContain("Later draft remains private");
 }
 @Test void legacyForeignLinksRemainInHistoryButCannotBePublishedOrFollowed() {
  String foreign=TestJwtFactory.author("legacy-target-"+UUID.randomUUID()+"@example.test");var target=ok(call("POST","/api/author/stories/import",scenario(key(),1),foreign));ok(approveAndPublish(port,sid(target),foreign));
  var sourceDoc=scenario(key(),1);var source=draft(sourceDoc);publishStory(source);
  sourceDoc.put("metadata",Map.of("schemaVersion",1,"relations",List.of(Map.of("id","foreign","type","sequel","target",Map.of("kind","scenario","id",sid(target),"key",target.get("key")),"stateTransfer",Map.of("mode","independent")))));
  // Legacy snapshots are retained, while all new publication and link traversal is checked.
  jdbc.update("update story_versions set snapshot_json=? where story_id=? and version_number=1",body(sourceDoc),sid(source));
  jdbc.update("update story_workspaces set draft_json=?,submitted_revision=1,review_state='in_review',generation=generation+1 where story_id=?",body(sourceDoc),sid(source));
  jdbc.update("update stories set metadata_json=? where id=?",body(sourceDoc.get("metadata")),sid(source));
  var detail=ok(call("GET","/api/author/stories/"+sid(source),null,author));assertThat(body(detail.get("draftDocument"))).contains(sid(target));
  assertThat(call("POST","/api/moderation/stories/"+sid(source)+"/approve-publish",Map.of("generation",detail.get("generation"),"revision",1),reviewer).statusCode()).isEqualTo(400);
  String save=ok(call("POST","/api/sessions",Map.of("storyKey",source.get("key")),reader)).get("sessionId").toString();finish(save);
  assertThat(call("GET","/api/sessions/"+save+"/relations",null,reader).body()).doesNotContain(sid(target));assertThat(call("POST","/api/sessions/"+save+"/relations/foreign/start",Map.of("requestId",key()),reader).statusCode()).isEqualTo(400);
  var targetDetail=ok(call("GET","/api/author/stories/"+sid(target),null,foreign));assertThat(call("GET","/api/catalog/stories/"+targetDetail.get("publishedSlug")+"/entry-context",null,reader).body()).doesNotContain(sid(source),save);
  assertThat(call("POST","/api/sessions",Map.of("storyKey",target.get("key")),reader).statusCode()).isEqualTo(200);
 }
 @Test void groupedLatePublicationFailureRollsBackEarlierChildrenAndAudit() {
  var blocked=draft(scenario(key(),1));var valid=draft(scenario(key(),2));String id=cid(create(document("story",List.of(item("scenario",blocked),item("scenario",valid)))));batch(id);
  var state=ok(call("GET","/api/moderation/stories/"+sid(blocked),null,reviewer));ok(call("POST","/api/moderation/stories/"+sid(blocked)+"/hide",Map.of("generation",state.get("generation"),"reason","Restricted"),reviewer));
  var preview=folderReview(id);assertThat(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(preview,"approve-publish"),reviewer).statusCode()).isEqualTo(409);
  assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(valid))).isNull();assertThat(jdbc.queryForObject("select review_state from story_workspaces where story_id=?",String.class,sid(valid))).isEqualTo("in_review");assertThat(jdbc.queryForObject("select count(*) from story_moderation_events where story_id=? and action='approve-publish'",Integer.class,sid(valid))).isZero();assertThat(details(id).get("publishedRevision")).isNull();
 }
 @Test void groupedDecisionsRejectStaleMissingOutsideAndSupersededSelectionsAtomically() {
  var doc=scenario(key(),1);var a=draft(doc);var b=draft(scenario(key(),2));String id=cid(create(document("story",List.of(item("scenario",a),item("scenario",b)))));batch(id);var preview=folderReview(id);
  var missing=folderDecision(preview,"approve-publish");missing.put("items",maps(missing.get("items")).subList(0,2));assertThat(call("POST","/api/moderation/folders/"+id+"/decision",missing,reviewer).statusCode()).isEqualTo(409);
  var outside=draft(scenario(key(),3));var changed=folderDecision(preview,"approve-publish");var items=new ArrayList<>(maps(changed.get("items")));items.set(1,Map.of("kind","scenario","id",sid(outside),"generation",1,"revision",1));changed.put("items",items);assertThat(call("POST","/api/moderation/folders/"+id+"/decision",changed,reviewer).statusCode()).isEqualTo(409);
  doc.put("title","Replacement submission");draft(doc);var current=ok(call("GET","/api/author/stories/"+sid(a),null,author));ok(call("POST","/api/author/stories/"+sid(a)+"/review",Map.of("generation",current.get("generation"),"replaceReview",true),author));
  assertThat(folderReview(id).get("canDecide")).isEqualTo(false);assertThat(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(preview,"approve-publish"),reviewer).statusCode()).isEqualTo(409);
  assertThat(details(id).get("publishedRevision")).isNull();assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(b))).isNull();assertThat(details(id).get("reviewState")).isEqualTo("in_review");
  batch(id);var fresh=folderReview(id);assertThat(fresh.get("canDecide")).isEqualTo(true);assertThat(details(id).get("submittedRevision")).isEqualTo(2);
  assertThat(jdbc.queryForObject("select requested_revision from collection_review_dependencies where collection_id=? and collection_revision=1 and target_id=?",Integer.class,id,sid(a))).isEqualTo(1);
  assertThat(jdbc.queryForObject("select requested_revision from collection_review_dependencies where collection_id=? and collection_revision=2 and target_id=?",Integer.class,id,sid(a))).isEqualTo(2);
  ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(fresh,"approve-publish"),reviewer));assertThat(details(id).get("publishedRevision")).isEqualTo(2);
 }
 @Test void groupedRejectionKeepsExistingPublicationAndCanRejectApprovedUnpublishedParts() {
  var d=scenario(key(),1);var a=draft(d);publishStory(a);String id=cid(create(document("story",List.of(item("scenario",a)))));publish(id);
  d.put("title","Replacement chapter");draft(d);var parent=new LinkedHashMap<>((Map<String,Object>)details(id).get("draftDocument"));parent.put("title","Replacement folder");save(id,parent);batch(id);
  var child=ok(call("GET","/api/author/stories/"+sid(a),null,author));ok(call("POST","/api/moderation/stories/"+sid(a)+"/approve",Map.of("generation",child.get("generation"),"revision",child.get("submittedRevision")),reviewer));
  var preview=folderReview(id);assertThat(maps(preview.get("items"))).hasSize(2);ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(preview,"reject"),reviewer));assertThat(details(id).get("reviewState")).isEqualTo("rejected");assertThat(details(id).get("publishedRevision")).isEqualTo(1);assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(a))).isEqualTo(1);assertThat(call("GET","/api/catalog/collections/"+id,null,reader).body()).doesNotContain("Replacement");
 }
 @Test void groupedOwnReviewRequiresExplicitAdminOverrideAndIsAtomic() {
  String email="folder-self-"+UUID.randomUUID()+"@example.test",own=TestJwtFactory.authorModerator(email),admin=TestJwtFactory.admin(email);
  var a=ok(call("POST","/api/author/stories/import",scenario(key(),1),own));var folder=ok(call("POST","/api/author/collections",Map.of("document",document("story",List.of(item("scenario",a)))),own));String id=cid(folder);ok(call("POST","/api/author/collections/"+id+"/review-batch",Map.of("generation",1),own));
  var preview=ok(call("GET","/api/moderation/folders/"+id+"/review",null,admin));assertThat(preview.get("canDecide")).isEqualTo(true);assertThat(maps(preview.get("items"))).allMatch(i->Boolean.TRUE.equals(i.get("self")));var cmd=folderDecision(preview,"approve-publish");
  assertThat(call("POST","/api/moderation/folders/"+id+"/decision",cmd,own).statusCode()).isEqualTo(403);assertThat(call("POST","/api/moderation/folders/"+id+"/decision",cmd,admin).statusCode()).isEqualTo(403);cmd.put("ownOverride",true);cmd.put("reason","");assertThat(call("POST","/api/moderation/folders/"+id+"/decision",cmd,admin).statusCode()).isEqualTo(400);
  assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(a))).isNull();cmd.put("reason","Explicit administrator review");ok(call("POST","/api/moderation/folders/"+id+"/decision",cmd,admin));assertThat(jdbc.queryForObject("select published_revision from stories where id=?",Integer.class,sid(a))).isEqualTo(1);
 }
 @Test void foldersPublicFilteringAndIndependentReview() {
  var a=draft(scenario(key(),1));var b=draft(scenario(key(),2));var c=draft(scenario(key(),3));publishStory(a);
  var storyDoc=document("story",List.of(item("scenario",a),item("scenario",b),item("scenario",c)));var story=create(storyDoc);String id=cid(story);publish(id);
  var volume=create(document("volume",List.of(item("collection",story))));var cycle=create(document("cycle",List.of(item("collection",volume))));
  publish(cid(volume));publish(cid(cycle));create(document("catalog",List.of(item("collection",cycle))));
  assertThat(call("POST","/api/author/collections",Map.of("document",document("catalog",List.of(item("collection",cycle)))),author).statusCode()).isEqualTo(409);
  var pub=ok(call("GET","/api/catalog/collections/"+id,null,reader));assertThat((List<?>)pub.get("items")).hasSize(1);assertThat(body(pub)).contains(a.get("key").toString()).doesNotContain(b.get("key").toString(),c.get("key").toString());
  assertThat(call("GET","/api/catalog/collections",null,null).body()).isEqualTo("[]");assertThat(call("GET","/api/catalog/collections/"+id,null,null).statusCode()).isEqualTo(401);
  assertThat(call("GET","/api/catalog/stories",null,reader).body()).doesNotContain(a.get("key").toString());
  publishStory(b);pub=ok(call("GET","/api/catalog/collections/"+id,null,reader));assertThat((List<?>)pub.get("items")).hasSize(2);
  storyDoc.put("title","Unreviewed title");save(id,storyDoc);assertThat(call("GET","/api/catalog/collections/"+id,null,reader).body()).doesNotContain("Unreviewed title");
  assertThat(call("POST","/api/author/collections",Map.of("document",document("story",List.of(item("collection",volume)))),author).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/author/collections",Map.of("document",document("story",List.of(item("scenario",a)))),author).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/author/collections",Map.of("document",document("catalog",List.of(item("scenario",a)))),author).statusCode()).isEqualTo(409);
 }
 @Test void foldersNestWithoutTypeRanksAndKeepOneGroupedApplication() {
  var story=draft(scenario(key(),1));var leafDoc=document("catalog",List.of(item("scenario",story)));var leaf=create(leafDoc);var parent=leaf;
  // Former catalog/story ranks and the former four-level breadcrumb limit do not apply.
  for(String type:List.of("catalog","story","story","volume","cycle","story"))parent=create(document(type,List.of(item("collection",parent))));
  String root=cid(parent);batch(root);var application=folderReview(root);assertThat(maps(application.get("items"))).hasSize(8);
  ok(call("POST","/api/moderation/folders/"+root+"/decision",folderDecision(application,"approve-publish"),reviewer));
  assertThat(maps(ok(call("GET","/api/catalog/collections/"+cid(leaf),null,reader)).get("breadcrumbs"))).hasSize(6);
  var reading=run(cid(leaf));assertThat(maps(reading.get("items"))).hasSize(1);start(reading.get("id").toString(),sid(story),null,key());
  leafDoc.put("items",List.of(item("scenario",story),item("collection",parent)));
  assertThat(call("PUT","/api/author/collections/"+cid(leaf),Map.of("generation",details(cid(leaf)).get("generation"),"document",leafDoc),author).statusCode()).isEqualTo(400);
 }
 @Test void mixedFoldersOnlyStartStoriesAndDoNotTransferAcrossNestedFolders() {
  var a=draft(scenario(key(),3));var b=draft(scenario(key(),1));var nested=create(document("story",List.of()));
  var doc=document("volume",List.of(item("scenario",a),item("collection",nested),item("scenario",b)));String id=cid(create(doc));batch(id);
  ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(folderReview(id),"approve-publish"),reviewer));
  var reading=run(id);var items=maps(reading.get("items"));assertThat(items).hasSize(2);assertThat(items.get(1).get("previousId")).isNull();
  assertThat(call("POST","/api/collection-runs/"+reading.get("id")+"/start",Map.of("targetId",cid(nested),"requestId",key()),reader).statusCode()).isEqualTo(404);
  doc.put("transitions",List.of(Map.of("id","skip-folder","from",item("scenario",a).get("target"),"to",item("scenario",b).get("target"),"stateTransfer",transfer())));
  assertThat(call("PUT","/api/author/collections/"+id,Map.of("generation",details(id).get("generation"),"document",doc),author).statusCode()).isEqualTo(400);
 }
 @Test void folderPackagesResolveForwardNestingAndRejectCyclesAtomically() {
  var child=document("story",List.of());var parent=document("story",List.of(Map.of("target",Map.of("kind","collection","key",child.get("key")))));
  var pkg=Map.of("schemaVersion",1,"kind","fraerapp-work-package","scenarios",List.of(),"collections",List.of(parent,child));
  ok(call("POST","/api/author/collections/import",pkg,author));ok(call("POST","/api/author/collections/import",pkg,author));
  var saved=details(parent.get("key").toString());assertThat(body(saved.get("draftDocument"))).contains("\"id\"");batch(saved.get("collectionId").toString());
  var x=document("story",List.of());var y=document("story",List.of(Map.of("target",Map.of("kind","collection","key",x.get("key")))));x.put("items",List.of(Map.of("target",Map.of("kind","collection","key",y.get("key")))));
  var cyclic=Map.of("schemaVersion",1,"kind","fraerapp-work-package","scenarios",List.of(),"collections",List.of(x,y));
  assertThat(call("POST","/api/author/collections/import",cyclic,author).statusCode()).isEqualTo(400);
  assertThat(jdbc.queryForObject("select count(*) from work_collections where collection_key in (?,?)",Integer.class,x.get("key"),y.get("key"))).isZero();
 }
 @Test void serialChapterReleaseKeepsFutureChaptersAsDrafts() {
  var a=draft(scenario(key(),7));var b=draft(scenario(key(),1));
  var doc=document("story",List.of(item("scenario",a),item("scenario",b)));doc.put("schemaVersion",2);
  String id=cid(create(doc));
  ok(call("POST","/api/author/collections/"+id+"/chapters/review",Map.of("storyId",sid(a),"storyGeneration",a.get("generation"),"generation",details(id).get("generation"),"replaceReview",true),author));
  assertThat(jdbc.queryForObject("select review_state from story_workspaces where story_id=?",String.class,sid(b))).isEqualTo("draft");
  var review=folderReview(id);assertThat(maps(review.get("items"))).hasSize(2);
  ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(review,"approve-publish"),reviewer));
  var published=ok(call("GET","/api/catalog/collections/"+id,null,reader));assertThat(maps(published.get("items"))).hasSize(1);
  String chain=run(id).get("id").toString(),source=sessionId(start(chain,sid(a),null,key()));finish(source);
  ok(call("POST","/api/author/collections/"+id+"/chapters/review",Map.of("storyId",sid(b),"storyGeneration",b.get("generation"),"generation",details(id).get("generation"),"replaceReview",true),author));
  review=folderReview(id);assertThat(maps(review.get("items"))).hasSize(1);
  ok(call("POST","/api/moderation/folders/"+id+"/decision",folderDecision(review,"approve-publish"),reviewer));
  var next=start(chain,sid(b),source,key());assertThat(((Number)((Map<?,?>)session(next).get("variables")).get("score")).doubleValue()).isEqualTo(11);
 }
 @Test void serialStoryCarriesProgressAcrossSeasonsAndRejectsSkipping() {
  var a=draft(scenario(key(),7));var b=draft(scenario(key(),1));publishStory(a);publishStory(b);
  var second=new LinkedHashMap<String,Object>(item("scenario",b));second.put("season","Сезон 2");
  var doc=document("story",List.of(item("scenario",a),second));doc.put("schemaVersion",2);doc.put("genre","Mystery");
  String id=cid(create(doc));publish(id);String chain=run(id).get("id").toString();
  assertThat(call("POST","/api/collection-runs/"+chain+"/start",Map.of("targetId",sid(b),"requestId",key()),reader).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/sessions",Map.of("storyKey",b.get("key")),reader).statusCode()).isEqualTo(409);
  String source=sessionId(start(chain,sid(a),null,key()));finish(source);
  var next=start(chain,sid(b),source,key());
  assertThat(((Number)((Map<?,?>)session(next).get("variables")).get("score")).doubleValue()).isEqualTo(11);
  assertThat(call("GET","/api/collection-runs/"+chain,null,reader).body()).contains("Сезон 2");
  var nested=document("story",List.of(item("collection",details(id))));nested.put("schemaVersion",2);
  assertThat(call("POST","/api/author/collections",Map.of("document",nested),author).statusCode()).isEqualTo(400);
 }
 @Test void mappedTransferUsesExactCompletedSavePinsRevisionsAndAppliesStartEffectOnce() {
  var aDoc=scenario(key(),7);var a=draft(aDoc);var bDoc=scenario(key(),1);bDoc.put("metadata",Map.of("schemaVersion",1,"inputContract",contract(false)));var b=draft(bDoc);publishStory(a);publishStory(b);
  var cd=document("catalog",List.of(item("scenario",a),item("scenario",b)));cd.put("transitions",List.of(Map.of("id","next","from",((Map<?,?>)item("scenario",a)).get("target"),"to",((Map<?,?>)item("scenario",b)).get("target"),"stateTransfer",transfer())));String id=cid(create(cd));publish(id);
  assertThat(call("POST","/api/sessions",Map.of("storyKey",b.get("key")),reader).statusCode()).isEqualTo(409);
  String run=run(id).get("id").toString();String source=sessionId(start(run,sid(a),null,key()));
  assertThat(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",sid(b),"sourceSessionId",source,"requestId",key()),reader).statusCode()).isEqualTo(409);
  finish(source);String request=key();var next=start(run,sid(b),source,request);assertThat(((Number)((Map<?,?>)session(next).get("variables")).get("score")).doubleValue()).isEqualTo(11);String target=sessionId(next);
  assertThat(sessionId(start(run,sid(b),source,request))).isEqualTo(target);assertThat(sessionId(start(run,sid(b),source,key()))).isEqualTo(target);
  assertThat(jdbc.queryForObject("select count(*) from chapter_transitions where target_session_id=?",Integer.class,target)).isEqualTo(1);
  assertThat(jdbc.queryForObject("select values_json from chapter_transitions where target_session_id=?",String.class,target)).contains("9");
  bDoc.put("title","New target revision");draft(bDoc);publishStory(b);assertThat(((Map<?,?>)ok(call("GET","/api/sessions/"+target+"/state",null,reader)).get("story")).get("title")).isEqualTo(bDoc.get("key"));
  String otherRun=run(id).get("id").toString();assertThat(call("POST","/api/collection-runs/"+otherRun+"/start",Map.of("targetId",sid(b),"sourceSessionId",source,"requestId",key()),reader).statusCode()).isEqualTo(409);
  var branch=ok(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",sid(b),"sourceSessionId",source,"requestId","branch-"+request,"newAttempt",true),reader));assertThat(branch.get("runId")).isNotEqualTo(run);assertThat(sessionId(branch)).isNotEqualTo(target);
  assertThat(sessionId(ok(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",sid(b),"sourceSessionId",source,"requestId","branch-"+request,"newAttempt",true),reader)))).isEqualTo(sessionId(branch));
  assertThat(call("GET","/api/collection-runs/"+run,null,reader).body()).contains(target);
  assertThat(ok(call("GET","/api/sessions/"+source+"/relations?runId="+run,null,reader)).get("runId")).isEqualTo(run);
  assertThat(ok(call("GET","/api/sessions/"+source+"/relations?runId="+branch.get("runId"),null,reader)).get("runId")).isEqualTo(branch.get("runId"));
 }
 @Test void independentStartsUseTargetDefaultsAndTocUpdateIsExplicit() {
  var a=draft(scenario(key(),10));var b=draft(scenario(key(),20));publishStory(a);publishStory(b);var doc=document("story",List.of(item("scenario",a)));String id=cid(create(doc));publish(id);String run=run(id).get("id").toString();var first=start(run,sid(a),null,key());String source=sessionId(first);finish(source);
  doc.put("items",List.of(item("scenario",a),item("scenario",b)));save(id,doc);publish(id);var old=ok(call("GET","/api/collection-runs/"+run,null,reader));assertThat((List<?>)old.get("items")).hasSize(1);assertThat(old.get("availableRevision")).isNotEqualTo(old.get("revision"));
  var updated=ok(call("POST","/api/collection-runs/"+run+"/update-toc",Map.of("generation",old.get("generation")),reader));assertThat((List<?>)updated.get("items")).hasSize(2);assertThat(body(updated)).contains(source);
  var target=start(run,sid(b),source,key());assertThat(((Number)((Map<?,?>)session(target).get("variables")).get("score")).doubleValue()).isEqualTo(22);
  decide(id,"hide");assertThat(call("GET","/api/collection-runs/"+run,null,reader).statusCode()).isEqualTo(404);assertThat(call("GET","/api/sessions/"+source+"/state",null,reader).statusCode()).isEqualTo(200);
 }
 @Test void concurrentParentReservationsAndDecisionsHaveSingleWinner() throws Exception {
  var a=draft(scenario(key(),1));var one=create(document("story",List.of()));var two=create(document("story",List.of()));
  List<Integer> statuses=race(()->{var d=new LinkedHashMap<>((Map<String,Object>)details(cid(one)).get("draftDocument"));d.put("items",List.of(item("scenario",a)));return call("PUT","/api/author/collections/"+cid(one),Map.of("generation",1,"document",d),author).statusCode();},()->{var d=new LinkedHashMap<>((Map<String,Object>)details(cid(two)).get("draftDocument"));d.put("items",List.of(item("scenario",a)));return call("PUT","/api/author/collections/"+cid(two),Map.of("generation",1,"document",d),author).statusCode();});assertThat(statuses).containsExactlyInAnyOrder(200,409);
  var pending=submit(cid(one));var cmd=Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision"),"reason","review");assertThat(race(()->call("POST","/api/moderation/collections/"+cid(one)+"/approve",cmd,reviewer).statusCode(),()->call("POST","/api/moderation/collections/"+cid(one)+"/reject",cmd,reviewer).statusCode())).containsExactlyInAnyOrder(200,409);
 }
 @SafeVarargs final <T> List<T> race(Callable<T>... calls)throws Exception {var ready=new CountDownLatch(calls.length);var go=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(calls.length);try{var futures=new ArrayList<Future<T>>();for(var c:calls)futures.add(pool.submit(()->{ready.countDown();go.await();return c.call();}));assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();go.countDown();var results=new ArrayList<T>();for(var f:futures)results.add(f.get(30,TimeUnit.SECONDS));return results;}finally{pool.shutdownNow();}}
 @Test void parallelTransitionsUseOneTargetAndCannotReadAnotherReadersSave()throws Exception {
  var a=draft(scenario(key(),1));var b=draft(scenario(key(),2));publishStory(a);publishStory(b);String id=cid(create(document("story",List.of(item("scenario",a),item("scenario",b)))));publish(id);String run=run(id).get("id").toString();String source=sessionId(start(run,sid(a),null,key()));finish(source);
  var responses=race(()->start(run,sid(b),source,key()),()->start(run,sid(b),source,key()));assertThat(sessionId(responses.get(0))).isEqualTo(sessionId(responses.get(1)));
  String stranger=TestJwtFactory.player("stranger-"+UUID.randomUUID()+"@example.test");assertThat(call("GET","/api/collection-runs/"+run,null,stranger).statusCode()).isEqualTo(404);assertThat(call("GET","/api/sessions/"+source+"/relations",null,stranger).statusCode()).isEqualTo(403);
 }
 @Test void chapterNotificationsAreDeduplicatedAndPrivateTargetsDisappear() {
  var a=draft(scenario(key(),1));String id=cid(create(document("story",List.of(item("scenario",a)))));publish(id);ok(call("PUT","/api/catalog/collections/"+id+"/favorite",Map.of("favorite",true),reader));publishStory(a);
  assertThat(jdbc.queryForObject("select count(*) from account_notifications where collection_id=? and kind='chapter'",Integer.class,id)).isEqualTo(1);
  var doc=new LinkedHashMap<>((Map<String,Object>)details(id).get("draftDocument"));doc.put("title","Changed collection");save(id,doc);publish(id);assertThat(jdbc.queryForObject("select count(*) from account_notifications where collection_id=? and kind='chapter'",Integer.class,id)).isEqualTo(1);
  var current=ok(call("GET","/api/moderation/stories/"+sid(a),null,reviewer));ok(call("POST","/api/moderation/stories/"+sid(a)+"/hide",Map.of("generation",current.get("generation"),"reason","restricted"),reviewer));
  assertThat(call("GET","/api/catalog/collections/"+id,null,reader).body()).doesNotContain(a.get("key").toString(),sid(a));assertThat(call("GET","/api/account",null,reader).body()).doesNotContain(sid(a));
 }
 @Test void packageRoundTripIsIdempotentAndCannotClaimAnotherOwnersWork() {
  var a=draft(scenario(key(),1));var c=create(document("story",List.of(item("scenario",a))));String id=cid(c);var exported=ok(call("GET","/api/author/collections/"+id+"/export",null,author));
  assertThat(body(exported)).doesNotContain(sid(a));ok(call("POST","/api/author/collections/import",Map.of("package",exported),author));ok(call("POST","/api/author/collections/import",Map.of("package",exported),author));assertThat(details(id).get("generation")).isEqualTo(1);
  String stranger=TestJwtFactory.author("other-"+UUID.randomUUID()+"@example.test");assertThat(call("POST","/api/author/collections/import",Map.of("package",exported),stranger).statusCode()).isEqualTo(403);
 }
 @Test void batchReviewIsAtomicAndNeverPublishesChildren() {
  var a=draft(scenario(key(),1));var c=create(document("story",List.of(item("scenario",a))));String id=cid(c);
  var batch=ok(call("POST","/api/author/collections/"+id+"/review-batch",Map.of("generation",1),author));assertThat((List<?>)batch.get("items")).hasSize(2);decide(id,"approve-publish");assertThat((List<?>)ok(call("GET","/api/catalog/collections/"+id,null,reader)).get("items")).isEmpty();
  var b=draft(scenario(key(),1));var explicit=Map.of("items",List.of(Map.of("kind","scenario","id",sid(b),"generation",1),Map.of("kind","collection","id",id,"generation",999)));
  assertThat(call("POST","/api/author/review-batch",explicit,author).statusCode()).isEqualTo(409);assertThat(ok(call("GET","/api/author/stories/"+sid(b),null,author)).get("reviewState")).isEqualTo("draft");
 }
 @Test void ownApprovalAndCurrentRoleAreEnforcedForCollections() {
  String email="own-"+UUID.randomUUID()+"@example.test",own=TestJwtFactory.authorModerator(email),admin=TestJwtFactory.admin(email),revoked=TestJwtFactory.player(email);var c=ok(call("POST","/api/author/collections",Map.of("document",document("story",List.of())),own));String id=cid(c);var p=ok(call("POST","/api/author/collections/"+id+"/review",Map.of("generation",1),own));var cmd=new LinkedHashMap<String,Object>();cmd.put("generation",p.get("generation"));cmd.put("revision",p.get("submittedRevision"));
  assertThat(call("POST","/api/moderation/collections/"+id+"/approve-publish",cmd,own).statusCode()).isEqualTo(403);assertThat(call("POST","/api/moderation/collections/"+id+"/approve-publish",cmd,admin).statusCode()).isEqualTo(403);cmd.put("ownOverride",true);assertThat(call("POST","/api/moderation/collections/"+id+"/approve-publish",cmd,admin).statusCode()).isEqualTo(400);cmd.put("reason","Explicit own review");ok(call("POST","/api/moderation/collections/"+id+"/approve-publish",cmd,admin));
  assertThat(call("GET","/api/author/collections/"+id,null,revoked).statusCode()).isEqualTo(200);assertThat(call("PUT","/api/author/collections/"+id,Map.of("generation",3,"document",document("story",List.of())),revoked).statusCode()).isEqualTo(403);
 }
 @Test void semanticLinksUsePublishedContractsExactSavesAndExplicitReplay() {
  var targetDoc=scenario(key(),0);targetDoc.put("metadata",Map.of("schemaVersion",1,"inputContract",contract(false)));var target=draft(targetDoc);publishStory(target);
  var sourceDoc=scenario(key(),5);sourceDoc.put("metadata",Map.of("schemaVersion",1,"relations",List.of(Map.of("id","sequel","type","sequel","target",Map.of("kind","scenario","key",target.get("key")),"stateTransfer",transfer()))));var source=draft(sourceDoc);publishStory(source);
  String save=ok(call("POST","/api/sessions",Map.of("storyKey",source.get("key")),reader)).get("sessionId").toString();finish(save);
  String slug=ok(call("GET","/api/author/stories/"+sid(target),null,author)).get("publishedSlug").toString();var entry=ok(call("GET","/api/catalog/stories/"+slug+"/entry-context",null,reader));assertThat(entry.get("allowIndependentStart")).isEqualTo(false);assertThat(body(entry.get("sources"))).contains(save,"sequel");
  String uri="/api/sessions/"+save+"/relations/sequel/start",request=key();var first=ok(call("POST",uri,Map.of("requestId",request),reader));assertThat(((Number)((Map<?,?>)session(first).get("variables")).get("score")).doubleValue()).isEqualTo(9);
  ok(call("POST","/api/sessions/"+save+"/reset",null,reader));assertThat(sessionId(ok(call("POST",uri,Map.of("requestId",request),reader)))).isEqualTo(sessionId(first));assertThat(call("POST",uri,Map.of("requestId",key(),"newAttempt",true),reader).statusCode()).isEqualTo(409);finish(save);
  assertThat(sessionId(ok(call("POST",uri,Map.of("requestId",key()),reader)))).isEqualTo(sessionId(first));String replayRequest=key();var replay=ok(call("POST",uri,Map.of("requestId",replayRequest,"newAttempt",true),reader));assertThat(sessionId(replay)).isNotEqualTo(sessionId(first));assertThat(sessionId(ok(call("POST",uri,Map.of("requestId",replayRequest,"newAttempt",true),reader)))).isEqualTo(sessionId(replay));
  var targetState=ok(call("GET","/api/moderation/stories/"+sid(target),null,reviewer));ok(call("POST","/api/moderation/stories/"+sid(target)+"/hide",Map.of("generation",targetState.get("generation"),"reason","temporary"),reviewer));assertThat(call("GET","/api/sessions/"+save+"/relations",null,reader).body()).doesNotContain(sid(target),target.get("key").toString());assertThat(call("POST",uri,Map.of("requestId",request),reader).statusCode()).isIn(400,404);
 }
 @Test void contractsRejectAbsentWrongTypeAndVersionAndUseOptionalDefaults() {
  var source=scenario(key(),1);var target=scenario(key(),0);var fields=List.of(Map.of("name","score","type","number","required",true,"min",0,"max",10),Map.of("name","met","type","boolean","required",false,"defaultValue",false));target.put("metadata",Map.of("schemaVersion",1,"inputContract",Map.of("version",1,"allowIndependentStart",false,"fields",fields)));
  var synthetic=new LinkedHashMap<String,Object>(Map.of("source",source,"target",target,"stateTransfer",transfer(),"values",Map.of("score",4)));
  assertThat(((Map<?,?>)ok(call("POST","/api/author/relations/test",synthetic,author)).get("values")).get("met")).isEqualTo(false);
  synthetic.put("values",Map.of());assertThat(call("POST","/api/author/relations/test",synthetic,author).statusCode()).isEqualTo(409);synthetic.put("values",Map.of("score","4"));assertThat(call("POST","/api/author/relations/test",synthetic,author).statusCode()).isEqualTo(409);synthetic.put("values",Map.of("score",11));assertThat(call("POST","/api/author/relations/test",synthetic,author).statusCode()).isEqualTo(409);
  synthetic.put("values",Map.of("score",4));synthetic.put("stateTransfer",Map.of("mode","mapped","contractVersion",2,"mapping",List.of(Map.of("from","score","to","score","type","number"))));assertThat(call("POST","/api/author/relations/test",synthetic,author).statusCode()).isEqualTo(409);
  synthetic.put("stateTransfer",Map.of("mode","mapped","contractVersion",1,"mapping",List.of(Map.of("from","__sceneVariables","to","score","type","number"))));assertThat(call("POST","/api/author/relations/test",synthetic,author).statusCode()).isEqualTo(400);
 }
 @Test void exactPreviewDependenciesSearchPrivacyAndSelectedDescendantRestrictions() {
  var a=draft(scenario(key(),1));var b=draft(scenario(key(),2));publishStory(a);publishStory(b);var doc=document("story",List.of(item("scenario",a)));doc.put("title","Searchable unique "+key());String id=cid(create(doc));submit(id);doc.put("items",List.of(item("scenario",b)));save(id,doc);
  var preview=ok(call("GET","/api/moderation/collections/"+id+"/preview?revision=submitted",null,reviewer));assertThat(body(preview.get("dependencies"))).contains(sid(a)).doesNotContain(sid(b));decide(id,"approve-publish");
  assertThat(call("GET","/api/author/collections/targets?q=Searchable",null,author).body()).contains(id);assertThat(call("GET","/api/catalog/collections?q="+b.get("key"),null,reader).body()).doesNotContain(id);
  assertThat(call("GET","/api/author/collections/parents?scenarioId="+sid(a),null,author).body()).contains(id);
  var descendants=call("GET","/api/moderation/collections/"+id+"/descendants",null,reviewer);assertThat(descendants.statusCode()).isEqualTo(200);assertThat(descendants.body()).contains(sid(a)).doesNotContain(sid(b));var current=ok(call("GET","/api/author/stories/"+sid(a),null,author));
  assertThat(call("POST","/api/moderation/collections/"+id+"/restrict-descendants",Map.of("items",List.of(Map.of("kind","scenario","id",sid(b),"generation",1)),"reason","restrict"),reviewer).statusCode()).isEqualTo(400);
  ok(call("POST","/api/moderation/collections/"+id+"/restrict-descendants",Map.of("items",List.of(Map.of("kind","scenario","id",sid(a),"generation",current.get("generation"))),"reason","restrict"),reviewer));assertThat((List<?>)ok(call("GET","/api/catalog/collections/"+id,null,reader)).get("items")).isEmpty();assertThat(details(id).get("visibility")).isEqualTo("public");
 }
 @Test void documentedPackageImportsWithForwardLinksAndPreviewProtectsConcurrentEdits()throws Exception {
  String example=java.nio.file.Files.readString(java.nio.file.Path.of("docs/examples/chapters-package.json")).replace("example_",key()+"_");var data=object(example);var preview=ok(call("POST","/api/author/collections/import-preview",Map.of("package",data),author));assertThat(preview.get("canImport")).isEqualTo(true);ok(call("POST","/api/author/collections/import",Map.of("package",data),author));
  var again=ok(call("POST","/api/author/collections/import-preview",Map.of("package",data),author));assertThat(body(again.get("items"))).doesNotContain("\"action\":\"update\"","\"action\":\"conflict\"");ok(call("POST","/api/author/collections/import",Map.of("package",data),author));
  Map<String,Object> changed=(Map<String,Object>)((List<?>)data.get("collections")).get(0);changed.put("title","Updated package title");var changePreview=ok(call("POST","/api/author/collections/import-preview",Map.of("package",data),author));assertThat(body(changePreview)).contains("update");Map<String,Object> item=(Map<String,Object>)((List<?>)changePreview.get("items")).stream().filter(x->"update".equals(((Map<?,?>)x).get("action"))).findFirst().orElseThrow();String id=item.get("id").toString();var currentDoc=new LinkedHashMap<>((Map<String,Object>)details(id).get("draftDocument"));currentDoc.put("description","Concurrent edit");save(id,currentDoc);
  assertThat(call("POST","/api/author/collections/import",Map.of("package",data,"generations",changePreview.get("generations")),author).statusCode()).isEqualTo(409);assertThat(body(details(id))).contains("Concurrent edit");var fresh=ok(call("POST","/api/author/collections/import-preview",Map.of("package",data),author));ok(call("POST","/api/author/collections/import",Map.of("package",data,"generations",fresh.get("generations")),author));assertThat(details(id).get("title")).isEqualTo("Updated package title");
  String stranger=TestJwtFactory.author("preview-other-"+UUID.randomUUID()+"@example.test");var denied=ok(call("POST","/api/author/collections/import-preview",Map.of("package",data),stranger));assertThat(denied.get("canImport")).isEqualTo(false);assertThat(body(denied)).doesNotContain(id);
 }
 @Test void hiddenMiddleChapterDoesNotChangeAdjacencyOrBlockIndependentLaterChapter() {
  var a=draft(scenario(key(),1));var hidden=draft(scenario(key(),2));var cDoc=scenario(key(),3);var c=draft(cDoc);publishStory(a);publishStory(c);String collection=cid(create(document("story",List.of(item("scenario",a),item("scenario",hidden),item("scenario",c)))));publish(collection);String run=run(collection).get("id").toString();String source=sessionId(start(run,sid(a),null,key()));finish(source);
  var context=ok(call("GET","/api/collection-runs/"+run,null,reader));Map<?,?> last=(Map<?,?>)((List<?>)context.get("items")).get(1);assertThat(last.get("previousId")).isNull();assertThat(last.get("allowIndependentStart")).isEqualTo(true);assertThat(body(context)).doesNotContain(sid(hidden),hidden.get("key").toString());
  assertThat(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",sid(c),"sourceSessionId",source,"requestId",key()),reader).statusCode()).isEqualTo(409);assertThat(((Number)((Map<?,?>)session(start(run,sid(c),null,key())).get("variables")).get("score")).doubleValue()).isEqualTo(5);
  cDoc.put("metadata",Map.of("schemaVersion",1,"inputContract",contract(false)));draft(cDoc);publishStory(c);String mandatoryRun=run(collection).get("id").toString();assertThat(call("POST","/api/collection-runs/"+mandatoryRun+"/start",Map.of("targetId",sid(c),"requestId",key()),reader).statusCode()).isEqualTo(409);var current=ok(call("GET","/api/collection-runs/"+mandatoryRun,null,reader));assertThat(((Map<?,?>)((List<?>)current.get("items")).get(1)).get("allowIndependentStart")).isEqualTo(false);
 }
 @Test void foreignCatalogCannotVetoOwnersPrimaryChapterStructure() {
  var a=draft(scenario(key(),1));publishStory(a);String curator=TestJwtFactory.author("curator-"+UUID.randomUUID()+"@example.test");var legacy=document("catalog",List.of());var catalog=ok(call("POST","/api/author/collections",Map.of("document",legacy),curator));String catalogId=cid(catalog);
  // Model a pre-correction stored catalog; no supported write may create this now.
  legacy.put("items",List.of(item("scenario",a)));jdbc.update("update work_collections set draft_json=?,published_revision=1,visibility='public' where id=?",body(legacy),catalogId);jdbc.update("update collection_versions set document_json=? where collection_id=? and revision=1",body(legacy),catalogId);
  assertThat(call("GET","/api/catalog/collections/"+catalogId,null,reader).body()).doesNotContain(sid(a));
  var parent=create(document("story",List.of(item("scenario",a))));publish(cid(parent));assertThat(call("GET","/api/catalog/collections/"+catalogId,null,reader).body()).doesNotContain(sid(a));
  var preserved=ok(call("GET","/api/author/collections/"+catalogId,null,curator));assertThat(preserved.get("publishedRevision")).isEqualTo(1);assertThat(body(preserved.get("publishedDocument"))).contains(sid(a));assertThat(call("GET","/api/author/collections/"+catalogId,null,author).statusCode()).isEqualTo(403);
  assertThat(((Map<?,?>)preserved.get("validation")).get("valid")).isEqualTo(false);
 }
 @Test void batchDependencyKeepsExactRequestedRevisionAfterChildReplacement() {
  var childDoc=scenario(key(),1);var child=draft(childDoc);var parentDoc=document("story",List.of(item("scenario",child)));String parent=cid(create(parentDoc));var batch=ok(call("POST","/api/author/collections/"+parent+"/review-batch",Map.of("generation",1),author));
  var original=ok(call("GET","/api/moderation/collections/"+parent+"/preview?revision=submitted",null,reviewer));Map<?,?> dependency=(Map<?,?>)((List<?>)original.get("dependencies")).get(0);assertThat(dependency.get("requestedRevision")).isEqualTo(1);assertThat(dependency.get("submittedRevision")).isEqualTo(1);assertThat(dependency.get("batchId")).isEqualTo(batch.get("batchId"));assertThat(dependency.get("requestedRevisionCurrent")).isEqualTo(true);
  childDoc.put("title","Replacement child revision");var revised=draft(childDoc);ok(call("POST","/api/author/stories/"+sid(child)+"/review",Map.of("generation",revised.get("generation"),"replaceReview",true),author));
  var after=ok(call("GET","/api/moderation/collections/"+parent+"/preview?revision=submitted",null,reviewer));dependency=(Map<?,?>)((List<?>)after.get("dependencies")).get(0);assertThat(dependency.get("requestedRevision")).isEqualTo(1);assertThat(dependency.get("submittedRevision")).isEqualTo(2);assertThat(dependency.get("requestedRevisionCurrent")).isEqualTo(false);
  parentDoc.put("description","A newer unsubmitted collection draft");save(parent,parentDoc);var draftPreview=ok(call("GET","/api/moderation/collections/"+parent+"/preview?revision=draft",null,reviewer));assertThat(((Map<?,?>)((List<?>)draftPreview.get("dependencies")).get(0)).get("requestedRevision")).isNull();decide(parent,"approve-publish");
  assertThat(jdbc.queryForObject("select count(*) from collection_review_dependencies where collection_id=? and requested_revision=1",Integer.class,parent)).isEqualTo(1);assertThat((List<?>)ok(call("GET","/api/catalog/collections/"+parent,null,reader)).get("items")).isEmpty();
 }
 @Test void batchPinsAlreadySubmittedParentsAndIntermediatesWithoutResubmittingThem() {
  var child=draft(scenario(key(),1));var story=create(document("story",List.of(item("scenario",child))));var volume=create(document("volume",List.of(item("collection",story))));var cycle=create(document("cycle",List.of(item("collection",volume))));submit(cid(volume));var pending=submit(cid(cycle));
  var submitted=ok(call("POST","/api/author/collections/"+cid(cycle)+"/review-batch",Map.of("generation",pending.get("generation")),author));assertThat((List<?>)submitted.get("items")).hasSize(2);
  for(var parent:List.of(story,volume,cycle)){var preview=ok(call("GET","/api/moderation/collections/"+cid(parent)+"/preview?revision=submitted",null,reviewer));assertThat(((Map<?,?>)((List<?>)preview.get("dependencies")).get(0)).get("requestedRevision")).isEqualTo(1);}
  assertThat(details(cid(cycle)).get("generation")).isEqualTo(pending.get("generation"));
  var noOp=ok(call("POST","/api/author/collections/"+cid(cycle)+"/review-batch",Map.of("generation",pending.get("generation")),author));assertThat((List<?>)noOp.get("items")).isEmpty();for(var parent:List.of(story,volume,cycle))assertThat(jdbc.queryForObject("select count(*) from collection_review_dependencies where collection_id=?",Integer.class,cid(parent))).isEqualTo(1);
 }
}
