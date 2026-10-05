package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=${MODERATION_TEST_DB:jdbc:h2:mem:moderation;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
 "spring.datasource.username=${MODERATION_TEST_USER:sa}","spring.datasource.password=${MODERATION_TEST_PASSWORD:}",
 "spring.jpa.hibernate.ddl-auto=validate","app.assets.storage-path=build/test-uploads/moderation"
})
class ModerationWorkflowTests extends ApiTestSupport {
 @LocalServerPort int port;
 private final String author=TestJwtFactory.author("writer-"+UUID.randomUUID()+"@example.test");
 private final String moderator=TestJwtFactory.moderator("reviewer-"+UUID.randomUUID()+"@example.test");
 private final String reader=TestJwtFactory.player("reader-"+UUID.randomUUID()+"@example.test");
 private final String admin=TestJwtFactory.admin("manager-"+UUID.randomUUID()+"@example.test");
 private final String key="moderated_"+UUID.randomUUID().toString().replace("-","");
 private String story(String text) {
  return body(Map.of("key",key,"title","Moderation test","version",1,"startSceneId","start","assets",List.of(),"variables",Map.of(),
   "scenes",List.of(Map.of("id","start","title","Start","text",text,"choices",List.of(Map.of("id","go","label","Go","target","end"))),
     Map.of("id","end","title","End","text","Ending "+text,"ending",Map.of("title","Done"),"choices",List.of()))));
 }
 private HttpResponse<String> call(String method,String path,Object data,String token) {
  return api(port,method,path,data==null?null:data instanceof String?(String)data:body(data),token);
 }
 private Map<String,Object> ok(HttpResponse<String> r) {
  assertThat(r.statusCode()).as(r.body()).isEqualTo(200);return object(r.body());
 }
 private Map<String,Object> draft(String text,String token) {return ok(call("POST","/api/author/stories/import",story(text),token));}
 private String id(Map<String,Object> s){return s.get("storyId").toString();}
 private Map<String,Object> detail(String id){return ok(call("GET","/api/moderation/stories/"+id,null,moderator));}
 private Map<String,Object> submit(String id,String token,boolean replace) {
  var current=detail(id);return ok(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",current.get("generation"),"replaceReview",replace),token));
 }
 private Map<String,Object> command(Map<String,Object> s,String reason) {
  Map<String,Object> result=new LinkedHashMap<>();result.put("generation",s.get("generation"));result.put("revision",s.get("submittedRevision"));
  result.put("reason",reason);result.put("visibility","public");return result;
 }
 private Map<String,Object> decision(String id,String action,String why) {
  return ok(call("POST","/api/moderation/stories/"+id+"/"+action,command(detail(id),why),moderator));
 }
 @Test void privateOwnershipAndRoleBoundaries() {
  var s=draft("Secret draft",author);String id=id(s);
  assertThat(call("GET","/api/author/stories/"+id,null,reader).statusCode()).isEqualTo(403);
  assertThat(call("GET","/api/author/stories/"+id+"/document",null,null).statusCode()).isEqualTo(401);
  assertThat(call("GET","/api/moderation/stories",null,author).statusCode()).isEqualTo(403);
  assertThat(call("GET","/api/admin/stories",null,moderator).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/author/stories/import",story("Bad"),moderator).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/author/stories/"+id+"/publish",null,author).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/admin/stories/"+id+"/publish",null,admin).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/sessions",Map.of("storyKey",key),reader).statusCode()).isEqualTo(404);
  var preview=call("GET","/api/author/stories/"+id+"/preview",null,author);
  assertThat(ok(preview)).containsEntry("privatePreview",true);
  assertThat(preview.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
  assertThat(detail(id)).containsEntry("totalRuns",0);
 }
 @Test void submittedSnapshotDoesNotFollowDraftAndActiveSavesStayOnTheirRevision() {
  String id=id(draft("version one",author));submit(id,author,false);
  var published=decision(id,"approve-publish","");String slug=published.get("publishedSlug").toString();
  var run=ok(call("POST","/api/sessions",Map.of("storyKey",key),reader));String save=run.get("sessionId").toString();
  var revisionOne=published.get("publishedRevision");
  ok(call("POST","/api/author/stories/import",story("version two").replace("\"start\"","\"new_start\""),author));
  var submitted=submit(id,author,false);draft("version three",author);
  var pending=detail(id);
  assertThat(((Map<?,?>)pending.get("submittedDocument")).get("scenes").toString()).contains("version two").doesNotContain("version three");
  assertThat(pending).containsEntry("hasDraft",true).containsEntry("publishedRevision",revisionOne);
  assertThat(call("GET","/api/catalog/stories/"+slug,null,reader).statusCode()).isEqualTo(200);
  assertThat(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",pending.get("generation")),author).statusCode()).isEqualTo(409);
  decision(id,"approve-publish","");
  assertThat(detail(id).get("publishedRevision")).isEqualTo(submitted.get("submittedRevision"));
  var oldState=ok(call("GET","/api/sessions/"+save+"/state",null,reader));
  assertThat(((Map<?,?>)oldState.get("scene")).get("text")).isEqualTo("version one");
  assertThat(call("GET","/api/catalog/stories",null,reader).body()).contains("\"lastSceneTitle\":\"Start\"");
  assertThat(((Map<?,?>)ok(call("POST","/api/sessions",Map.of("storyKey",key),reader)).get("scene")).get("text")).isEqualTo("version two");
  assertThat(((Map<?,?>)ok(call("POST","/api/sessions/"+save+"/choice",Map.of("choiceId","go"),reader)).get("scene")).get("text")).isEqualTo("Ending version one");
  decision(id,"hide","Temporarily hidden");
  assertThat(call("GET","/api/catalog/stories/"+slug,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET","/api/sessions/"+save+"/state",null,reader).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/sessions/"+save+"/reset",null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET","/api/sessions",null,reader).body()).doesNotContain(save);
  assertThat(call("GET","/api/catalog/engagement",null,reader).body()).doesNotContain(slug);
  assertThat(call("POST","/api/author/stories/"+id+"/archive",null,author).statusCode()).isEqualTo(403);
  decision(id,"restore","Restriction removed");
  assertThat(call("GET","/api/catalog/stories/"+slug,null,reader).statusCode()).isEqualTo(404);
  assertThat(detail(id)).containsEntry("visibility","private");
 }
 @Test void approveOnlyIsPrivateAndSelfApprovalRequiresExplicitAdminOverride() {
  String email="own-"+UUID.randomUUID()+"@example.test";
  String authorMod=TestJwtFactory.authorModerator(email);String ownAdmin=TestJwtFactory.admin(email);
  String id=id(draft("own work",authorMod));var pending=submit(id,authorMod,false);
  var cmd=command(pending,"");
  assertThat(call("POST","/api/moderation/stories/"+id+"/approve",cmd,authorMod).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/moderation/stories/"+id+"/approve",cmd,ownAdmin).statusCode()).isEqualTo(403);
  cmd.put("ownOverride",true);
  assertThat(call("POST","/api/moderation/stories/"+id+"/approve",cmd,ownAdmin).statusCode()).isEqualTo(400);
  cmd.put("reason","Explicit administrator review of own work");
  assertThat(ok(call("POST","/api/moderation/stories/"+id+"/approve",cmd,ownAdmin))).containsEntry("reviewState","approved").containsEntry("visibility","private");
  assertThat(call("POST","/api/sessions",Map.of("storyKey",key),reader).statusCode()).isEqualTo(404);
  assertThat(decision(id,"publish-approved","Release approved revision")).containsEntry("visibility","public");
  assertThat(call("GET","/api/author/stories/"+id,null,authorMod).body()).contains("Explicit administrator review");
 }
 @Test void adminCompatibilityImportAttributesNewStoryAndRequiresOwnApprovalConfirmation() {
  String id=id(ok(call("POST","/api/admin/stories/import",story("Imported by admin"),admin)));
  assertThat(ok(call("GET","/api/author/stories/"+id,null,admin)).get("ownerUserId")).isNotNull();
  var pending=ok(call("POST","/api/admin/stories/"+id+"/review",Map.of("generation",detail(id).get("generation")),admin));
  var cmd=command(pending,"");
  assertThat(call("POST","/api/moderation/stories/"+id+"/approve-publish",cmd,admin).statusCode()).isEqualTo(403);
  cmd.put("ownOverride",true);
  assertThat(call("POST","/api/moderation/stories/"+id+"/approve-publish",cmd,admin).statusCode()).isEqualTo(400);
  cmd.put("reason","Explicit review of my imported story");
  assertThat(ok(call("POST","/api/moderation/stories/"+id+"/approve-publish",cmd,admin))).containsEntry("visibility","public");
 }
 @Test void rejectionAndReplacementKeepAuditAndPrivateNotes() {
  String id=id(draft("first",author));submit(id,author,false);
  assertThat(call("POST","/api/moderation/stories/"+id+"/reject",command(detail(id),""),moderator).statusCode()).isEqualTo(400);
  var cmd=command(detail(id),"Please clarify ending");cmd.put("internalNote","private moderator note");
  ok(call("POST","/api/moderation/stories/"+id+"/reject",cmd,moderator));
  var own=call("GET","/api/author/stories/"+id,null,author);
  assertThat(own.body()).contains("Please clarify ending").doesNotContain("private moderator note");
  assertThat(call("GET","/api/account",null,author).body()).contains("Please clarify ending").contains(id).doesNotContain("private moderator note");
  draft("improved",author);submit(id,author,false);draft("replacement",author);submit(id,author,true);
  assertThat(detail(id).get("events").toString()).contains("superseded");
  var pending=detail(id);
  ok(call("POST","/api/author/stories/"+id+"/withdraw",Map.of("generation",pending.get("generation")),author));
  assertThat(detail(id)).containsEntry("reviewState","draft").containsEntry("submittedRevision",null);
 }
 @Test void simultaneousDecisionsHaveOneWinnerAndOneAuthorNotice() throws Exception {
  String id=id(draft("race",author));var pending=submit(id,author,false);var cmd=command(pending,"Reviewed");
  var ready=new CountDownLatch(2);var go=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try {
   List<Future<Integer>> results=new ArrayList<>();
   for(String action:List.of("approve-publish","reject"))results.add(pool.submit(()->{ready.countDown();go.await();return call("POST","/api/moderation/stories/"+id+"/"+action,cmd,moderator).statusCode();}));
   assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();go.countDown();
   assertThat(List.of(results.get(0).get(20,TimeUnit.SECONDS),results.get(1).get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
   assertThat((List<?>)detail(id).get("events")).hasSize(2);
   assertThat(ok(call("GET","/api/account",null,author))).containsEntry("unreadCount",1);
  }finally{pool.shutdownNow();}
 }
 @Test void readOnlyOwnershipSurvivesAuthorRoleRemoval() {
  String email="demoted-"+UUID.randomUUID()+"@example.test";
  String former=TestJwtFactory.author(email), now=TestJwtFactory.player(email);
  String id=id(draft("read only",former));
  assertThat(call("GET","/api/author/stories",null,now).statusCode()).isEqualTo(200);
  assertThat(call("GET","/api/author/stories/"+id+"/document",null,now).statusCode()).isEqualTo(200);
  assertThat(call("POST","/api/author/stories/import",story("changed"),now).statusCode()).isEqualTo(403);
  assertThat(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",1),now).statusCode()).isEqualTo(403);
 }
 @Test void uploadedDraftMediaNeverLeaksAndPublishedFilesRemainImmutable() throws Exception {
  String id=id(draft("media",author));
  String first=upload(id,"cover");assertThat(call("GET",first,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET",first,null,author).statusCode()).isEqualTo(200);
  submit(id,author,false);decision(id,"approve-publish","");
  var visible=call("GET",first,null,reader);assertThat(visible.statusCode()).isEqualTo(200);
  assertThat(visible.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
  String second=upload(id,"cover");
  assertThat(call("GET",second,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET",first,null,reader).statusCode()).isEqualTo(200);
  ok(call("DELETE","/api/author/stories/"+id+"/assets?assetKey=cover&url="+URLEncoder.encode(second,StandardCharsets.UTF_8),null,author));
  assertThat(call("GET",first,null,reader).statusCode()).isEqualTo(200);
  decision(id,"delete","Removed from site");
  assertThat(call("GET",first,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET",second,null,reader).statusCode()).isEqualTo(404);
  decision(id,"restore","Restore privately");
  assertThat(call("GET",first,null,reader).statusCode()).isEqualTo(404);
 }
 private String upload(String id,String key) throws Exception {
  String boundary="modtest"+UUID.randomUUID();
  String bytes="--"+boundary+"\r\nContent-Disposition: form-data; name=\"assetKey\"\r\n\r\n"+key+"\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"image.html\"\r\nContent-Type: image/svg+xml\r\n\r\n<svg xmlns=\"http://www.w3.org/2000/svg\"/>\r\n--"+boundary+"--\r\n";
  var req=HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/author/stories/"+id+"/assets")).header("Authorization","Bearer "+author)
   .header("Content-Type","multipart/form-data; boundary="+boundary).POST(HttpRequest.BodyPublishers.ofString(bytes)).build();
  String url=ok(HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString())).get("url").toString();
  assertThat(url).endsWith(".svg");return url;
 }
 @Test void csrfAndExternalMediaAreRejected() throws Exception {
  String id=id(draft("safe",author));
  var req=HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/author/stories/"+id+"/archive"))
   .header("Cookie","fraer_access="+author).header("Origin","https://untrusted.example").POST(HttpRequest.BodyPublishers.noBody()).build();
  assertThat(HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
  var doc=object(story("external"));doc.put("assets",List.of(Map.of("id","x","type","image","url","https://untrusted.example/asset.svg")));
  assertThat(call("POST","/api/author/stories/import",doc,author).statusCode()).isEqualTo(400);
  doc.put("assets",List.of(Map.of("id","x","type","image","url","/uploads/another-story/file.svg")));
  assertThat(call("POST","/api/author/stories/import",doc,author).statusCode()).isEqualTo(400);
 }
 @Test void newDraftAcceptsMediaPlaceholderButSubmissionRequiresActualMedia() throws Exception {
  var doc=object(story("new upload"));doc.put("assets",List.of(Map.of("id","cover","type","image","url","")));
  String id=id(ok(call("POST","/api/author/stories/import",doc,author)));
  assertThat(call("POST","/api/author/stories/"+id+"/review",Map.of("generation",1),author).statusCode()).isEqualTo(400);
  upload(id,"cover");assertThat(submit(id,author,false)).containsEntry("reviewState","in_review");
 }
 @Test void unlistedIsReadableByLinkAndSoftDeletionNeedsExplicitRestoration() {
  String id=id(draft("unlisted",author));submit(id,author,false);var cmd=command(detail(id),"");cmd.put("visibility","unlisted");
  var s=ok(call("POST","/api/moderation/stories/"+id+"/approve-publish",cmd,moderator));String slug=s.get("publishedSlug").toString();
  assertThat(call("GET","/api/catalog/stories",null,reader).body()).doesNotContain(slug);
  assertThat(call("GET","/api/catalog/stories/"+slug,null,reader).statusCode()).isEqualTo(200);
  assertThat(call("GET","/api/catalog/engagement/"+slug,null,reader).statusCode()).isEqualTo(200);
  assertThat(call("GET","/api/catalog/engagement/"+slug,null,null).statusCode()).isEqualTo(404);
  assertThat(call("DELETE","/api/author/stories/"+id,null,author).statusCode()).isEqualTo(409);
  decision(id,"delete","Remove story");
  assertThat(call("POST","/api/moderation/stories/"+id+"/visibility",command(detail(id),"Make public"),moderator).statusCode()).isEqualTo(409);
  assertThat(call("POST","/api/author/stories/"+id+"/versions/1/rollback",null,author).statusCode()).isEqualTo(409);
  decision(id,"restore","Restore");
  assertThat(detail(id)).containsEntry("visibility","private");
  assertThat(call("GET","/api/moderation/stories?size=1&q="+key+"&visibility=private",null,moderator).body()).contains("\"totalElements\":1");
 }
}
