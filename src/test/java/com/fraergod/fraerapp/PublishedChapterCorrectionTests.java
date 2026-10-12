package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.concurrent.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=jdbc:h2:mem:published-corrections;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=validate","app.assets.storage-path=${java.io.tmpdir}/fraer-published-correction-test-uploads"
})
class PublishedChapterCorrectionTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate db;
 final String email="correction-author-"+UUID.randomUUID()+"@example.test";
 final String author=TestJwtFactory.author(email),moderator=TestJwtFactory.moderator("correction-mod-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("correction-reader-"+UUID.randomUUID()+"@example.test");
 final String key="correction_"+UUID.randomUUID().toString().replace("-","");
 Map<String,Object> document(String text){return Map.of("key",key,"title","Published chapter","version",1,"startSceneId","end","assets",List.of(),"variables",Map.of(),"scenes",List.of(Map.of("id","end","title","Ending","text",text,"ending",Map.of("title","End"),"choices",List.of())));}
 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> r){assertThat(r.statusCode()).as(r.body()).isEqualTo(200);return object(r.body());}
 Map<String,Object> detail(String id){return ok(call("GET","/api/author/stories/"+id,null,author));}
 Map<String,Object> submit(String id){var d=detail(id);return ok(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",d.get("generation"),"replaceReview",false),author));}
 Map<String,Object> decision(String id,String action,String reason){var d=detail(id);return ok(call("POST","/api/moderation/stories/"+id+"/"+action,Map.of("generation",d.get("generation"),"revision",d.get("submittedRevision"),"reason",reason,"visibility","public"),moderator));}
 String published(){var d=ok(call("POST","/api/author/stories/import",document("Original published text"),author));String id=d.get("storyId").toString();submit(id);decision(id,"approve-publish","");return id;}
 Map<String,Object> correctionCommand(String id,String reason){var d=detail(id);return Map.of("generation",d.get("generation"),"revision",d.get("publishedRevision"),"reason",reason);}
 Map<String,Object> openCorrection(String id){return ok(call("POST","/api/moderation/stories/"+id+"/request-correction",correctionCommand(id,"Исправьте серьёзную ошибку в финале."),moderator));}
 @Test void publishedContentRejectsSaveImportRollbackAndAssetRemoval(){
  String id=published();var before=detail(id);
  assertThat(call("PUT","/api/author/stories/"+id,Map.of("generation",before.get("generation"),"document",document("Unauthorized edit")),author).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/author/stories/import",document("Unauthorized import"),author).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/author/stories/"+id+"/versions/1/rollback",null,author).statusCode()).isEqualTo(409);
  assertThat(call("DELETE","/api/author/stories/"+id+"/assets?assetKey=anything",null,author).statusCode()).isEqualTo(409);
  assertThat(upload(id,"local").statusCode()).isEqualTo(409);
  assertThat(upload(id,"global").statusCode()).isEqualTo(409);
  assertThat(detail(id)).containsEntry("generation",before.get("generation")).containsEntry("draftDocument",before.get("draftDocument")).containsEntry("canEditDraft",false);
 }
 HttpResponse<String> upload(String id,String scope){
  String boundary="correction-boundary";
  String data="--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cover.svg\"\r\nContent-Type: image/svg+xml\r\n\r\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"2\" height=\"2\"/>\r\n--"+boundary+"--\r\n";
  try{return HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/author/stories/"+id+"/assets?scope="+scope)).header("Authorization","Bearer "+author).header("Content-Type","multipart/form-data; boundary="+boundary).POST(HttpRequest.BodyPublishers.ofString(data)).build(),HttpResponse.BodyHandlers.ofString());}catch(Exception ex){throw new IllegalStateException(ex);}
 }
 @Test void simultaneousCorrectionRequestsCreateOneGrantAndOneNotice() throws Exception {
  String id=published();var cmd=correctionCommand(id,"Serious error");int before=db.queryForObject("select count(*) from account_notifications where story_id=?",Integer.class,id);
  var go=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{
   Callable<Integer> task=()->{go.await();return call("POST","/api/moderation/stories/"+id+"/request-correction",cmd,moderator).statusCode();};
   var a=pool.submit(task);var b=pool.submit(task);go.countDown();
   assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
   assertThat(db.queryForObject("select count(*) from story_moderation_events where story_id=? and action='request-correction'",Integer.class,id)).isEqualTo(1);
   assertThat(db.queryForObject("select count(*) from account_notifications where story_id=?",Integer.class,id)).isEqualTo(before+1);
  }finally{pool.shutdownNow();}
 }
 @Test void correctionNeedsIndependentModeratorCommentAndCurrentPublishedRevision(){
  String id=published();var cmd=correctionCommand(id,"Severe error");
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",cmd,author).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",cmd,TestJwtFactory.authorModerator(email)).statusCode()).isEqualTo(403);
  var override=new LinkedHashMap<>(cmd);override.put("ownOverride",true);
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",override,TestJwtFactory.admin(email)).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",correctionCommand(id,"   "),moderator).statusCode()).isEqualTo(400);
  var stale=new LinkedHashMap<>(cmd);stale.put("revision",999);
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",stale,moderator).statusCode()).isEqualTo(409);
  var opened=openCorrection(id);
  assertThat(opened).containsEntry("canEditDraft",true).containsEntry("correctionRequested",true).containsEntry("reviewState","rejected");
  assertThat(call("GET","/api/account",null,author).body()).contains("Исправьте серьёзную ошибку",id);
  assertThat(call("POST","/api/moderation/stories/"+id+"/request-correction",cmd,moderator).statusCode()).isEqualTo(409);
 }
 @Test void correctionKeepsPublishedTextUntilReviewedAndRelocksAfterPublication(){
  String id=published();var original=detail(id);openCorrection(id);
  ok(call("POST","/api/author/stories/import",document("Corrected ending"),author));
  var corrected=detail(id);
  assertThat(corrected.get("publishedDocument")).isEqualTo(original.get("publishedDocument"));
  assertThat(call("POST","/api/author/stories/"+id+"/publish",Map.of("generation",corrected.get("generation"),"revision",corrected.get("draftRevision")),author).statusCode()).isEqualTo(409);
  submit(id);
  assertThat(detail(id)).containsEntry("canEditDraft",false).containsEntry("correctionReason","Исправьте серьёзную ошибку в финале.");
  assertThat(call("POST","/api/author/stories/import",document("Edit during review"),author).statusCode()).isEqualTo(409);
  decision(id,"reject","Needs another fix");ok(call("POST","/api/author/stories/import",document("Final correction"),author));
  submit(id);var approved=decision(id,"approve","");
  assertThat(approved).containsEntry("canEditDraft",false);
  assertThat(call("POST","/api/author/stories/import",document("Edit after approval"),author).statusCode()).isEqualTo(409);
  var published=ok(call("POST","/api/author/stories/"+id+"/publish",Map.of("generation",approved.get("generation"),"revision",approved.get("draftRevision")),author));
  assertThat(published).containsEntry("canEditDraft",false).containsEntry("correctionRequested",false);
  assertThat(detail(id).get("publishedDocument").toString()).contains("Final correction");
  assertThat(call("POST","/api/author/stories/import",document("Another unauthorized edit"),author).statusCode()).isEqualTo(409);
 }
 @Test void approvedCorrectionCannotRemoveModeratorAvailabilityRestriction(){
  String id=published();var original=detail(id);openCorrection(id);
  ok(call("POST","/api/author/stories/import",document("Corrected ending"),author));
  submit(id);decision(id,"approve","");
  for(String action:List.of("hide","archive")){
   var restricted=decision(id,action,"Chapter must remain unavailable");
   assertThat(call("POST","/api/author/stories/"+id+"/publish",Map.of("generation",restricted.get("generation"),"revision",restricted.get("draftRevision")),author).statusCode()).isEqualTo(409);
   assertThat(detail(id)).containsEntry("visibility",restricted.get("visibility")).containsEntry("generation",restricted.get("generation")).containsEntry("publishedDocument",original.get("publishedDocument")).containsEntry("correctionRequested",true);
   decision(id,"restore","Availability restriction resolved");
  }
  var approved=detail(id);
  var released=ok(call("POST","/api/author/stories/"+id+"/publish",Map.of("generation",approved.get("generation"),"revision",approved.get("draftRevision")),author));
  assertThat(released).containsEntry("visibility","public").containsEntry("correctionRequested",false);
 }
 @Test void legacyUnapprovedDraftCannotBeSubmittedOrPublishedWithoutCorrectionRequest(){
  String id=published();var before=detail(id);
  // Simulate an unpublished edit that already existed before this policy was deployed.
  db.update("insert into story_versions(id,story_id,version_number,status,snapshot_json,note,created_at) select ?,story_id,2,status,?,note,created_at from story_versions where story_id=? and version_number=1",UUID.randomUUID().toString(),body(document("Legacy unauthorized change")),id);
  db.update("update story_workspaces set draft_revision=2,draft_json=? where story_id=?",body(document("Legacy unauthorized change")),id);
  assertThat(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",before.get("generation")),author).statusCode()).isEqualTo(409);
  db.update("update story_workspaces set submitted_revision=2,review_state='approved' where story_id=?",id);
  var legacy=detail(id);
  assertThat(call("POST","/api/author/stories/"+id+"/publish",Map.of("generation",legacy.get("generation"),"revision",2),author).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/moderation/stories/"+id+"/publish-approved",Map.of("generation",legacy.get("generation"),"revision",2,"reason","Release"),moderator).statusCode()).isEqualTo(409);
  openCorrection(id);
  assertThat(detail(id).get("draftDocument")).isEqualTo(before.get("publishedDocument"));
  assertThat(detail(id).get("versions").toString()).contains("2");
 }
}
