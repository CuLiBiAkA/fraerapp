package com.fraergod.fraerapp;

import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=jdbc:h2:mem:review-admission-trash;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.datasource.username=sa","spring.datasource.password=","spring.jpa.hibernate.ddl-auto=validate",
 "app.assets.storage-path=build/test-uploads/review-admission-trash"
})
class ReviewAdmissionAndTrashTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate db;
 @Autowired ApplicationContext context;
 final String author=TestJwtFactory.author("admission-"+UUID.randomUUID()+"@example.test");
 final String moderator=TestJwtFactory.moderator("reviewer-"+UUID.randomUUID()+"@example.test");
 String key(){return "draft_"+UUID.randomUUID().toString().replace("-","");}
 HttpResponse<String> call(String method,String path,Object data,String actor){return api(port,method,path,data==null?null:body(data),actor);}
 Map<String,Object> ok(HttpResponse<String> response){assertThat(response.statusCode()).as(response.body()).isEqualTo(200);return object(response.body());}
 Map<String,Object> document(){return new LinkedHashMap<>(Map.of("key",key(),"title","A private draft","version",1,"startSceneId","start","variables",Map.of(),"assets",List.of(),"scenes",List.of(Map.of("id","start","title","Start","text","Hello","choices",List.of(Map.of("id","go","label","Go","target","end"))),Map.of("id","end","title","End","text","Done","ending",Map.of("title","Done"),"choices",List.of()))));}
 Map<String,Object> create(Map<String,Object> document){return ok(call("POST","/api/author/stories/import",document,author));}
 String id(Map<String,Object> story){return story.get("storyId").toString();}
 Map<String,Object> detail(String id){return ok(call("GET","/api/author/stories/"+id,null,author));}
 HttpResponse<String> submit(String id,Map<String,Object> current){return call("POST","/api/author/stories/"+id+"/review",Map.of("generation",current.get("generation"),"replaceReview",true),author);}
 Map<String,Object> withdraw(String id,Map<String,Object> current){return ok(call("POST","/api/author/stories/"+id+"/withdraw",Map.of("generation",current.get("generation")),author));}
 void ageAdmission(String story){db.update("update author_review_admission set admitted_at=? where owner_player_id=(select owner_player_id from stories where id=?)",Timestamp.from(Instant.now().minus(Duration.ofHours(25))),story);}
 void ageTrash(String table,String id){db.update("update "+table+" set deleted_at=? where id=?",Timestamp.from(Instant.now().minus(Duration.ofDays(31))),id);}

 @Test void withdrawingAndDecisionsDoNotBypassTheDailyAdmissionButSameStoryUpdatesDo(){
  var doc=document();var a=create(doc);String id=id(a);var b=create(document());
  var pending=ok(submit(id,a));var before=db.queryForObject("select admitted_at from author_review_admission where owner_player_id=(select owner_player_id from stories where id=?)",Timestamp.class,id);
  withdraw(id,pending);doc.put("title","Same work, corrected");var changed=create(doc);pending=ok(submit(id,changed));
  assertThat(db.queryForObject("select admitted_at from author_review_admission where owner_player_id=(select owner_player_id from stories where id=?)",Timestamp.class,id)).isEqualTo(before);
  var draft=withdraw(id,pending);var denied=submit(id(b),b);
  assertThat(denied.statusCode()).isEqualTo(409);assertThat(object(denied.body())).containsEntry("code","REVIEW_DAILY_LIMIT_REACHED").containsKey("reviewAvailableAt");
  assertThat(detail(id(b))).containsEntry("reviewDailyLimitReached",true).containsEntry("reviewLimitReached",true);
  pending=ok(submit(id,draft));
  ok(call("POST","/api/moderation/stories/"+id+"/approve",Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision")),moderator));
  assertThat(submit(id(b),b).statusCode()).isEqualTo(409);
  ageAdmission(id);assertThat(detail(id(b))).containsEntry("reviewDailyLimitReached",false);ok(submit(id(b),b));
 }

 @Test void chaptersOfOneSerialStoryShareOneDailyAdmission(){
  var a=create(document());var b=create(document());
  var items=List.of(Map.of("target",Map.of("kind","scenario","id",id(a),"key",a.get("key"))),Map.of("target",Map.of("kind","scenario","id",id(b),"key",b.get("key"))));
  var collection=ok(call("POST","/api/author/collections",Map.of("document",Map.of("schemaVersion",2,"key",key(),"type","story","title","Two chapters","items",items,"transitions",List.of())),author));
  var result=ok(call("POST","/api/author/collections/"+collection.get("collectionId")+"/review-batch",Map.of("generation",collection.get("generation")),author));
  assertThat((List<?>)result.get("items")).hasSize(3);
  assertThat(db.queryForObject("select count(*) from author_review_admission where owner_player_id=(select owner_player_id from stories where id=?)",Integer.class,id(a))).isEqualTo(1);
 }

 @Test void concurrentFirstSubmissionsHaveOneWinnerAndFailedBatchSpendsNothing() throws Exception {
  var a=create(document());var b=create(document());var ready=new CountDownLatch(2);var start=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
  try {
   List<Future<Integer>> results=new ArrayList<>();
   for(var item:List.of(a,b))results.add(executor.submit(()->{ready.countDown();start.await();return submit(id(item),item).statusCode();}));
   assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
   assertThat(List.of(results.get(0).get(20,TimeUnit.SECONDS),results.get(1).get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
   assertThat(db.queryForObject("select count(*) from author_review_admission where owner_player_id=(select owner_player_id from stories where id=?)",Integer.class,id(a))).isEqualTo(1);
  }finally{executor.shutdownNow();}
 }

 @Test void failedBatchRollsBackAdmissionAlongWithSubmissions(){
  var a=create(document());var b=create(document());
  var items=List.of(Map.of("kind","scenario","id",id(a),"generation",a.get("generation")),Map.of("kind","scenario","id",id(b),"generation",b.get("generation")));
  assertThat(call("POST","/api/author/review-batch",Map.of("items",items),author).statusCode()).isEqualTo(409);
  assertThat(db.queryForObject("select count(*) from author_review_admission where owner_player_id=(select owner_player_id from stories where id=?)",Integer.class,id(a))).isZero();
  assertThat(detail(id(a))).containsEntry("reviewState","draft");assertThat(detail(id(b))).containsEntry("reviewState","draft");
 }

 @Test void authorCanRestoreOwnTrashWithinThirtyDaysWithoutPublishingOrRestoringReview(){
  var a=create(document());String id=id(a);ok(submit(id,a));var trash=ok(call("DELETE","/api/author/stories/"+id,null,author));
  assertThat(trash).containsEntry("canRestoreTrash",true).containsEntry("reviewState","draft").containsEntry("submittedRevision",null).containsKey("trashExpiresAt");
  String other=TestJwtFactory.author("other-"+UUID.randomUUID()+"@example.test");
  assertThat(call("POST","/api/author/stories/"+id+"/restore",Map.of("generation",trash.get("generation")),other).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/author/stories/"+id+"/restore",Map.of("generation",a.get("generation")),author).statusCode()).isEqualTo(409);
  var restored=ok(call("POST","/api/author/stories/"+id+"/restore",Map.of("generation",trash.get("generation")),author));
  assertThat(restored).containsEntry("visibility","private").containsEntry("reviewState","draft").containsEntry("publishedRevision",null).containsEntry("trashExpiresAt",null);
  assertThat(detail(id).get("events").toString()).contains("author_restore");
 }

 @Test void expiredTrashDisappearsBeforeSchedulerAndAuditAndVersionsRemainAfterIt(){
  var a=create(document());String id=id(a);var trash=ok(call("DELETE","/api/author/stories/"+id,null,author));ageTrash("stories",id);
  assertThat(call("GET","/api/author/stories/"+id+"/preview",null,author).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/author/stories/"+id+"/restore",Map.of("generation",trash.get("generation")),author).statusCode()).isEqualTo(404);
  assertThat(call("GET","/api/author/folders?visibility=deleted",null,author).body()).doesNotContain(id);
  assertThat(call("GET","/api/author/stories",null,author).body()).doesNotContain(id);
  ReflectionTestUtils.invokeMethod(context.getBean("trashRetentionService"),"expire");
  assertThat(db.queryForObject("select visibility from stories where id=?",String.class,id)).isEqualTo("purged");
  assertThat(db.queryForObject("select count(*) from story_versions where story_id=?",Integer.class,id)).isPositive();
  assertThat(db.queryForObject("select count(*) from story_moderation_events where story_id=?",Integer.class,id)).isPositive();
  assertThat(ok(call("GET","/api/moderation/stories/"+id,null,moderator))).containsEntry("visibility","purged");
 }

 @Test void collectionTrashRestoresPrivatelyAndExpiresWithoutRemovingChapters(){
  var chapter=create(document());var document=Map.of("schemaVersion",2,"key",key(),"type","story","title","Collection","items",List.of(Map.of("target",Map.of("kind","scenario","id",id(chapter),"key",chapter.get("key")))),"transitions",List.of());
  var c=ok(call("POST","/api/author/collections",Map.of("document",document),author));String id=c.get("collectionId").toString();
  var trash=ok(call("DELETE","/api/author/collections/"+id,Map.of("generation",c.get("generation")),author));
  assertThat(trash).containsEntry("canRestoreTrash",true);
  c=ok(call("POST","/api/author/collections/"+id+"/restore",Map.of("generation",trash.get("generation")),author));assertThat(c).containsEntry("visibility","private").containsEntry("publishedRevision",null);
  trash=ok(call("DELETE","/api/author/collections/"+id,Map.of("generation",c.get("generation")),author));ageTrash("work_collections",id);
  assertThat(call("POST","/api/author/collections/"+id+"/restore",Map.of("generation",trash.get("generation")),author).statusCode()).isEqualTo(404);
  assertThat(call("GET","/api/author/collections/"+id+"/export",null,author).statusCode()).isEqualTo(404);
  var replacement=new LinkedHashMap<String,Object>(document);replacement.put("key",key());
  ok(call("POST","/api/author/collections",Map.of("document",replacement),author));
  assertThat(call("GET","/api/author/collections/parents?scenarioId="+id(chapter),null,author).body()).doesNotContain(id);
  ReflectionTestUtils.invokeMethod(context.getBean("trashRetentionService"),"expire");assertThat(db.queryForObject("select visibility from work_collections where id=?",String.class,id)).isEqualTo("purged");
  assertThat(detail(id(chapter))).containsEntry("visibility","private");
  assertThat(db.queryForObject("select count(*) from collection_versions where collection_id=?",Integer.class,id)).isPositive();
 }
 @Test void expiredTargetsCannotBeReadOrRelinkedThroughALiveParentButModeratorDocumentsRemain(){
  var scenarioDocument=document();scenarioDocument.put("title","Expired private scenario title");
  var scenario=create(scenarioDocument);String scenarioId=id(scenario);
  var childDocument=Map.of("schemaVersion",1,"key",key(),"type","catalog","title","Expired private collection title","description","Expired private collection description","coverUrl","/assets/door.svg","items",List.of(),"transitions",List.of());
  var child=ok(call("POST","/api/author/collections",Map.of("document",childDocument),author));String childId=child.get("collectionId").toString();
  var scenarioTarget=Map.of("kind","scenario","id",scenarioId,"key",scenario.get("key"));
  var collectionTarget=Map.of("kind","collection","id",childId,"key",child.get("key"));
  var parentDocument=Map.of("schemaVersion",1,"key",key(),"type","catalog","title","Retained parent","items",List.of(Map.of("target",scenarioTarget),Map.of("target",collectionTarget)),"transitions",List.of());
  var parent=ok(call("POST","/api/author/collections",Map.of("document",parentDocument),author));String parentPath="/api/author/collections/"+parent.get("collectionId");
  ok(call("DELETE","/api/author/stories/"+scenarioId,null,author));
  ok(call("DELETE","/api/author/collections/"+childId,Map.of("generation",child.get("generation")),author));
  ageTrash("stories",scenarioId);ageTrash("work_collections",childId);

  for(boolean cleaned:List.of(false,true)){
   if(cleaned)ReflectionTestUtils.invokeMethod(context.getBean("trashRetentionService"),"expire");
   for(String suffix:List.of("","/preview")){
    var retained=ok(call("GET",parentPath+suffix,null,author));
    assertThat((List<?>)retained.get("dependencies")).hasSize(2).allSatisfy(raw->{
     assertThat(raw).isInstanceOf(Map.class);var dependency=(Map<?,?>)raw;
     assertThat(dependency.get("resolved")).isEqualTo(false);assertThat(dependency.get("available")).isEqualTo(false);
     assertThat(dependency.keySet()).noneMatch(Set.of("title","description","coverUrl","id")::contains);
    });
    assertThat(body(retained)).doesNotContain("Expired private","/assets/door.svg");
   }
   assertThat(call("GET","/api/author/stories/"+scenarioId,null,author).statusCode()).isEqualTo(404);
   assertThat(call("GET","/api/author/collections/"+childId,null,author).statusCode()).isEqualTo(404);
   for(var target:List.of(scenarioTarget,collectionTarget))for(boolean portable:List.of(false,true)){
    var reference=portable?Map.of("kind",target.get("kind"),"key",target.get("key")):target;
    var replacement=Map.of("schemaVersion",1,"key",key(),"type","catalog","title","New parent","items",List.of(Map.of("target",reference)),"transitions",List.of());
    var denied=call("POST","/api/author/collections",Map.of("document",replacement),author);
    assertThat(denied.statusCode()).as(denied.body()).isEqualTo(400);
   }
   assertThat(call("PUT",parentPath,Map.of("generation",parent.get("generation"),"document",parentDocument),author).statusCode()).isEqualTo(400);
   assertThat(call("POST",parentPath+"/review",Map.of("generation",parent.get("generation")),author).statusCode()).isEqualTo(400);
   var scenarioAudit=ok(call("GET","/api/moderation/stories/"+scenarioId,null,moderator));
   assertThat(body(scenarioAudit.get("draftDocument"))).contains("Expired private scenario title");
   var collectionAudit=ok(call("GET","/api/moderation/collections/"+childId,null,moderator));
   assertThat(body(collectionAudit.get("draftDocument"))).contains("Expired private collection description","/assets/door.svg");
   var parentAudit=ok(call("GET","/api/moderation/collections/"+parent.get("collectionId"),null,moderator));
   assertThat(body(parentAudit.get("draftDocument"))).contains("Retained parent",scenarioId,childId);
  }
 }
 @Test void expirationPreservesPublishedReaderSessionsAndForbidsAuthorRestoringModeratorTrash(){
  var a=create(document());String id=id(a);var pending=ok(submit(id,a));
  var published=ok(call("POST","/api/moderation/stories/"+id+"/approve-publish",Map.of("generation",pending.get("generation"),"revision",pending.get("submittedRevision")),moderator));
  String reader=TestJwtFactory.player("retained-reader-"+UUID.randomUUID()+"@example.test");
  var session=ok(call("POST","/api/sessions",Map.of("storyKey",a.get("key")),reader));
  var trash=ok(call("POST","/api/moderation/stories/"+id+"/delete",Map.of("generation",published.get("generation"),"reason","Moderation restriction"),moderator));
  assertThat(trash).containsEntry("canRestoreTrash",false);
  assertThat(call("POST","/api/author/stories/"+id+"/restore",Map.of("generation",trash.get("generation")),author).statusCode()).isEqualTo(409);
  ageTrash("stories",id);ReflectionTestUtils.invokeMethod(context.getBean("trashRetentionService"),"expire");
  assertThat(db.queryForObject("select count(*) from game_sessions where id=? and story_revision=?",Integer.class,session.get("sessionId"),published.get("publishedRevision"))).isEqualTo(1);
  assertThat(db.queryForObject("select count(*) from story_moderation_events where story_id=? and action='approve-publish'",Integer.class,id)).isEqualTo(1);
  assertThat(call("GET","/api/sessions/"+session.get("sessionId")+"/state",null,reader).statusCode()).isEqualTo(404);
 }
}
