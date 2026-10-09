package com.fraergod.fraerapp;

import java.net.http.HttpResponse;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=jdbc:h2:mem:collection-presentation;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.datasource.username=sa","spring.datasource.password=","spring.jpa.hibernate.ddl-auto=validate",
 "app.assets.storage-path=build/test-uploads/collection-presentation"
})
class CollectionPresentationTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 final String author=TestJwtFactory.author("presentation-author-"+UUID.randomUUID()+"@example.test");
 final String reviewer=TestJwtFactory.moderator("presentation-reviewer-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("presentation-reader-"+UUID.randomUUID()+"@example.test");
 String key(){return "presentation_"+UUID.randomUUID().toString().replace("-","");}
 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> response){assertThat(response.statusCode()).as(response.body()).isEqualTo(200);return object(response.body());}
 @SuppressWarnings("unchecked") List<Map<String,Object>> maps(Object value){return (List<Map<String,Object>>)value;}
 List<Map<String,Object>> list(String path,String token){var response=call("GET",path,null,token);assertThat(response.statusCode()).as(response.body()).isEqualTo(200);return maps(object("{\"items\":"+response.body()+"}").get("items"));}
 Map<String,Object> scenario(){return new LinkedHashMap<>(Map.of("key",key(),"title","Standalone","version",1,"startSceneId","start","variables",Map.of(),"assets",List.of(),"scenes",List.of(Map.of("id","start","title","Start","text","Start","choices",List.of(Map.of("id","go","label","Go","target","end"))),Map.of("id","end","title","End","text","End","ending",Map.of("title","Done"),"choices",List.of()))));}
 Map<String,Object> chapter(){var value=ok(call("POST","/api/author/stories/import",scenario(),author));ok(approveAndPublish(port,value.get("storyId").toString(),author));return value;}
 Map<String,Object> item(Map<String,Object> story){return Map.of("target",Map.of("kind","scenario","id",story.get("storyId"),"key",story.get("key")));}
 Map<String,Object> document(int schema,List<?> items){return new LinkedHashMap<>(Map.of("schemaVersion",schema,"key",key(),"title","Collection","type","story","completionStatus","completed","items",items,"transitions",List.of()));}
 Map<String,Object> create(Map<String,Object> document){return ok(call("POST","/api/author/collections",Map.of("document",document),author));}
 Map<String,Object> detail(String id){return ok(call("GET","/api/author/collections/"+id,null,author));}
 Map<String,Object> publicDetail(String id){return ok(call("GET","/api/catalog/collections/"+id,null,reader));}
 Map<String,Object> decide(String id,String action){var d=detail(id);var command=new LinkedHashMap<String,Object>();command.put("generation",d.get("generation"));command.put("revision",d.get("submittedRevision")==null?d.get("publishedRevision"):d.get("submittedRevision"));command.put("reason","Reviewed");return ok(call("POST","/api/moderation/collections/"+id+"/"+action,command,reviewer));}
 void publish(String id){ok(call("POST","/api/author/collections/"+id+"/review",Map.of("generation",detail(id).get("generation")),author));decide(id,"approve-publish");}
 Map<String,Object> run(String id){return run(id,reader);}
 Map<String,Object> run(String id,String token){return ok(call("POST","/api/collections/"+id+"/runs",Map.of("requestId",key()),token));}
 String start(String run,Map<String,Object> chapter,String source){return start(run,chapter,source,reader);}
 String start(String run,Map<String,Object> chapter,String source,String token){var command=new LinkedHashMap<String,Object>();command.put("targetId",chapter.get("storyId"));command.put("requestId",key());command.put("sourceSessionId",source);var result=ok(call("POST","/api/collection-runs/"+run+"/start",command,token));return ((Map<?,?>)result.get("session")).get("sessionId").toString();}
 void finish(String save){finish(save,reader);}
 void finish(String save,String token){ok(call("POST","/api/sessions/"+save+"/choice",Map.of("choiceId","go"),token));}
 HttpResponse<String> upload(String path,String token,String mime) throws Exception {
  String boundary="cover"+UUID.randomUUID();String bytes="--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"source.html\"\r\nContent-Type: "+mime+"\r\n\r\n<svg xmlns=\"http://www.w3.org/2000/svg\"/>\r\n--"+boundary+"--\r\n";
  var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Authorization","Bearer "+token).header("Content-Type","multipart/form-data; boundary="+boundary).POST(HttpRequest.BodyPublishers.ofString(bytes)).build();
  return HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString());
 }

 @Test void engagementIsIndependentIdempotentAndPublishedDatesIgnoreDraftActivity(){
  var chapter=chapter();var doc=document(2,List.of(item(chapter)));String id=create(doc).get("id").toString();publish(id);var initial=publicDetail(id);
  assertThat(initial).containsEntry("views",0).containsEntry("ratingCount",0).containsEntry("rating",null).containsEntry("myRating",null);
  assertThat(initial.get("authorName")).asString().startsWith("Участник #").doesNotContain("@","presentation-author");
  assertThat(initial.get("publishedAt")).isNotNull();assertThat(initial.get("updatedAt")).isNotNull();
  for(Object invalid:List.of(Map.of(),Map.of("score",0),Map.of("score",6),Map.of("score",4.5)))assertThat(call("PUT","/api/catalog/collections/"+id+"/rating",invalid,reader).statusCode()).isEqualTo(400);
  assertThat(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",5),null).statusCode()).isEqualTo(401);
  assertThat(call("POST","/api/catalog/collections/"+id+"/view",null,null).statusCode()).isEqualTo(401);
  ok(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",5),reader));ok(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",3),reader));
  ok(call("POST","/api/catalog/collections/"+id+"/view",null,reader));ok(call("POST","/api/catalog/collections/"+id+"/view",null,reader));
  assertThat(publicDetail(id)).containsEntry("views",1).containsEntry("rating",3.0).containsEntry("ratingCount",1).containsEntry("myRating",3);
  String other=TestJwtFactory.player("other-"+UUID.randomUUID()+"@example.test");ok(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",5),other));ok(call("POST","/api/catalog/collections/"+id+"/view",null,other));
  assertThat(publicDetail(id)).containsEntry("views",2).containsEntry("rating",4.0).containsEntry("ratingCount",2).containsEntry("myRating",3);
  jdbc.update("update collection_views set viewed_on=? where collection_id=?",java.sql.Date.valueOf(LocalDate.now(ZoneOffset.UTC).minusDays(1)),id);ok(call("POST","/api/catalog/collections/"+id+"/view",null,reader));assertThat(publicDetail(id)).containsEntry("views",3);
  doc.put("title","PRIVATE draft title");ok(call("PUT","/api/author/collections/"+id,Map.of("generation",detail(id).get("generation"),"document",doc),author));var after=publicDetail(id);
  for(String field:List.of("title","publishedAt","updatedAt"))assertThat(after.get(field)).isEqualTo(initial.get(field));
  assertThat(jdbc.queryForObject("select count(*) from story_ratings where story_id=?",Long.class,chapter.get("storyId"))).isZero();
  assertThat(jdbc.queryForObject("select count(*) from story_views where story_id=?",Long.class,chapter.get("storyId"))).isZero();
  var catalog=list("/api/catalog/collections?q="+doc.get("key"),reader);assertThat(catalog).hasSize(1);assertThat(catalog.get(0)).containsEntry("views",3).containsEntry("myRating",3);
  publish(id);assertThat(publicDetail(id)).containsEntry("publishedAt",initial.get("publishedAt")).containsEntry("views",3).containsEntry("ratingCount",2).containsEntry("rating",4.0);
  assertThat(publicDetail(id).get("updatedAt")).isNotEqualTo(initial.get("updatedAt"));
 }

 @Test void finalChapterEndingsAndRecentRunActivityHaveDistinctMeaning(){
  var a=chapter();var b=chapter();String id=create(document(2,List.of(item(a),item(b)))).get("id").toString();publish(id);
  String first=run(id).get("id").toString();String saveA=start(first,a,null);finish(saveA);
  assertThat(publicDetail(id)).containsEntry("endingCount",1).containsEntry("discoveredEndings",0).containsEntry("completionRate",50.0).containsEntry("completedCount",1).containsEntry("progressTotal",2).containsEntry("finishedRuns",0);
  String saveB=start(first,b,saveA);finish(saveB);assertThat(publicDetail(id)).containsEntry("discoveredEndings",1).containsEntry("completionRate",100.0).containsEntry("finishedRuns",1).containsEntry("lastRunId",first);
  run(id);jdbc.update("update game_sessions set updated_at=? where id=?",java.sql.Timestamp.from(Instant.now().plusSeconds(60)),saveB);
  var runs=list("/api/collections/"+id+"/runs",reader);assertThat(runs.get(0)).containsEntry("id",first);assertThat(runs.get(0).get("lastPlayedAt")).isNotNull();
  assertThat(publicDetail(id)).containsEntry("totalRuns",2).containsEntry("lastRunId",first);
 }

 @Test void unfinishedSerialAndLegacyCollectionsDoNotInventWholeStoryFinals(){
  var a=chapter();var doc=document(2,List.of(item(a)));doc.put("completionStatus","in_development");String id=create(doc).get("id").toString();publish(id);finish(start(run(id).get("id").toString(),a,null));
  assertThat(publicDetail(id)).containsEntry("endingCount",0).containsEntry("discoveredEndings",0).containsEntry("finishedRuns",0).containsEntry("allReleasedRead",true);
  var b=chapter();String legacy=create(document(1,List.of(item(b)))).get("id").toString();publish(legacy);
  assertThat(publicDetail(legacy)).containsEntry("endingCount",null).containsEntry("discoveredEndings",null).containsEntry("finishedRuns",null).containsEntry("progressBasis","direct_chapters");
 }

 @Test void restrictedSerialParentKeepsChaptersPrivateAndPreservesSaves(){
  var a=chapter();String id=create(document(2,List.of(item(a)))).get("id").toString();publish(id);String save=start(run(id).get("id").toString(),a,null);
  String slug=ok(call("GET","/api/author/stories/"+a.get("storyId"),null,author)).get("publishedSlug").toString();
  ok(call("POST","/api/author/collections/"+id+"/archive",Map.of("generation",detail(id).get("generation")),author));
  assertThat(call("GET","/api/catalog/stories",null,reader).body()).doesNotContain(a.get("key").toString());
  for(String path:List.of("/api/catalog/stories/"+slug,"/api/catalog/engagement/"+slug,"/api/sessions/"+save+"/state"))assertThat(call("GET",path,null,reader).statusCode()).as(path).isEqualTo(404);
  assertThat(call("POST","/api/catalog/engagement/"+slug+"/view",null,reader).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/sessions/"+save+"/choice",Map.of("choiceId","go"),reader).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/sessions",Map.of("storyKey",a.get("key")),reader).statusCode()).isEqualTo(404);
  assertThat(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",4),reader).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/catalog/collections/"+id+"/view",null,reader).statusCode()).isEqualTo(404);
  assertThat(jdbc.queryForObject("select count(*) from game_sessions where id=?",Long.class,save)).isEqualTo(1);
  decide(id,"restore");assertThat(call("GET","/api/sessions/"+save+"/state",null,reader).statusCode()).isEqualTo(404);
  ok(call("POST","/api/moderation/collections/"+id+"/visibility",Map.of("generation",detail(id).get("generation"),"reason","Restore publication","visibility","public"),reviewer));assertThat(call("GET","/api/sessions/"+save+"/state",null,reader).statusCode()).isEqualTo(200);
 }

 @Test void legacyContainerArchivePreservesIndependentReading(){
  var a=chapter();String id=create(document(1,List.of(item(a)))).get("id").toString();publish(id);String save=ok(call("POST","/api/sessions",Map.of("storyKey",a.get("key")),reader)).get("sessionId").toString();
  ok(call("POST","/api/author/collections/"+id+"/archive",Map.of("generation",detail(id).get("generation")),author));
  assertThat(call("GET","/api/sessions/"+save+"/state",null,reader).statusCode()).isEqualTo(200);assertThat(call("GET","/api/catalog/stories",null,reader).body()).contains(a.get("key").toString());
 }

 @Test void authorTrashIsFilteredBeforePaginationAndCardsHaveDocumentMetadata(){
  var a=ok(call("POST","/api/author/stories/import",scenario(),author));var deleted=ok(call("POST","/api/author/stories/import",scenario(),author));ok(call("DELETE","/api/author/stories/"+deleted.get("storyId"),null,author));
  var doc=document(2,List.of(item(a)));doc.put("coverUrl","/assets/example.png");doc.put("description","Card description");String id=create(doc).get("id").toString();var gone=create(document(1,List.of()));ok(call("DELETE","/api/author/collections/"+gone.get("id"),Map.of("generation",gone.get("generation")),author));
  var active=ok(call("GET","/api/author/folders?size=1",null,author));assertThat(active).containsEntry("total",1);assertThat(maps(active.get("items"))).hasSize(1);
  assertThat(maps(active.get("items")).get(0)).containsEntry("id",id).containsEntry("schemaVersion",2).containsEntry("coverUrl","/assets/example.png").containsEntry("description","Card description").containsEntry("completionStatus","completed");
  var trash=ok(call("GET","/api/author/folders?visibility=deleted&size=1",null,author));assertThat(trash).containsEntry("total",2);assertThat(maps(trash.get("items"))).hasSize(1);
  var next=ok(call("GET","/api/author/folders?visibility=deleted&size=1&page=1",null,author));assertThat(maps(next.get("items"))).hasSize(1);assertThat(maps(next.get("items")).get(0).get("id")).isNotEqualTo(maps(trash.get("items")).get(0).get("id"));
  assertThat(call("GET","/api/moderation/folders?q="+deleted.get("key")+"&status=all",null,reviewer).body()).contains(deleted.get("storyId").toString());
 }

 @Test void collectionCoverHasOwnLibraryAndOnlyThePublishedReferenceIsReadable() throws Exception {
  var doc=document(2,List.of());String id=create(doc).get("id").toString();String path="/api/author/collections/"+id;
  String stranger=TestJwtFactory.author("cover-stranger-"+UUID.randomUUID()+"@example.test");
  assertThat(upload(path+"/cover",stranger,"image/svg+xml").statusCode()).isEqualTo(403);
  assertThat(upload(path+"/cover",author,"audio/ogg").statusCode()).isEqualTo(400);
  var first=ok(upload(path+"/cover",author,"image/svg+xml"));String url=first.get("url").toString();
  assertThat(first.get("filename").toString()).endsWith(".svg");assertThat(first.get("bytes")).isNotNull();
  assertThat(list(path+"/covers",author)).hasSize(1);assertThat(call("GET",path+"/covers",null,stranger).statusCode()).isEqualTo(403);
  assertThat(call("GET",url,null,author).statusCode()).isEqualTo(200);assertThat(call("GET",url,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("GET","/api/catalog/collections/"+id,null,reader).statusCode()).isEqualTo(404);
  assertThat(call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",5),reader).statusCode()).isEqualTo(404);
  assertThat(call("POST","/api/catalog/collections/"+id+"/view",null,reader).statusCode()).isEqualTo(404);
  doc.put("items",List.of(item(chapter())));doc.put("coverUrl",url);ok(call("PUT",path,Map.of("generation",detail(id).get("generation"),"document",doc),author));publish(id);
  assertThat(publicDetail(id)).containsEntry("coverUrl",url);assertThat(call("GET",url,null,reader).statusCode()).isEqualTo(200);assertThat(call("GET",url,null,null).statusCode()).isEqualTo(401);
  String draftUrl=ok(upload(path+"/cover",author,"image/svg+xml")).get("url").toString();doc.put("coverUrl",draftUrl);ok(call("PUT",path,Map.of("generation",detail(id).get("generation"),"document",doc),author));
  assertThat(call("GET",draftUrl,null,reader).statusCode()).isEqualTo(404);assertThat(publicDetail(id)).containsEntry("coverUrl",url);
  doc.put("coverUrl","/uploads/other/file.svg");assertThat(call("PUT",path,Map.of("generation",detail(id).get("generation"),"document",doc),author).statusCode()).isEqualTo(400);
  ok(call("POST",path+"/archive",Map.of("generation",detail(id).get("generation")),author));assertThat(call("GET",url,null,reader).statusCode()).isEqualTo(404);
  assertThat(jdbc.queryForObject("select count(*) from stories where owner_player_id=(select owner_player_id from work_collections where id=?)",Integer.class,id)).isEqualTo(1);
 }

 @Test void scenarioMetadataSaveUsesGenerationAndPreservesIdentityAndPublishedCover() throws Exception {
  var doc=scenario();var created=ok(call("POST","/api/author/stories/import",doc,author));String id=created.get("storyId").toString();String path="/api/author/stories/"+id;
  String url=ok(upload(path+"/assets?scope=local",author,"image/svg+xml")).get("url").toString();doc.put("metadata",Map.of("schemaVersion",1,"coverUrl",url));doc.put("title","New settings");
  var saved=ok(call("PUT",path,Map.of("generation",created.get("generation"),"document",doc),author));assertThat(saved).containsEntry("storyId",id).containsEntry("key",created.get("key"));
  assertThat(call("PUT",path,Map.of("generation",created.get("generation"),"document",doc),author).statusCode()).isEqualTo(409);
  assertThat(call("PUT",path,Map.of("document",doc),author).statusCode()).isEqualTo(400);
  String stranger=TestJwtFactory.author("scenario-stranger-"+UUID.randomUUID()+"@example.test");assertThat(call("PUT",path,Map.of("generation",saved.get("generation"),"document",doc),stranger).statusCode()).isEqualTo(403);
  doc.put("key",key());assertThat(call("PUT",path,Map.of("generation",saved.get("generation"),"document",doc),author).statusCode()).isEqualTo(400);doc.put("key",created.get("key"));
  doc.put("metadata",Map.of("coverUrl","/uploads/other/file.svg"));assertThat(call("PUT",path,Map.of("generation",saved.get("generation"),"document",doc),author).statusCode()).isEqualTo(400);doc.put("metadata",Map.of("schemaVersion",1,"coverUrl",url));
  ok(approveAndPublish(port,id,author));String slug=ok(call("GET",path,null,author)).get("publishedSlug").toString();var published=ok(call("GET","/api/catalog/stories/"+slug,null,reader));assertThat(published).containsEntry("coverUrl",url);assertThat(call("GET",url,null,reader).statusCode()).isEqualTo(200);
  assertThat(list("/api/catalog/stories",reader)).anySatisfy(row->assertThat(row).containsEntry("key",doc.get("key")).containsEntry("coverUrl",url));
  var parentDoc=document(2,List.of(item(created)));String parent=create(parentDoc).get("id").toString();publish(parent);
  doc.put("metadata",Map.of("schemaVersion",1,"coverUrl","/assets/private-draft.svg"));doc.put("title","Private new settings");ok(call("PUT",path,Map.of("generation",ok(call("GET",path,null,author)).get("generation"),"document",doc),author));
  var current=ok(call("GET","/api/catalog/stories/"+slug,null,reader));assertThat(current).containsEntry("coverUrl",url).containsEntry("updatedAt",published.get("updatedAt"));
  decide(parent,"hide");assertThat(call("GET",url,null,reader).statusCode()).isEqualTo(404);
 }

 @Test void concurrentViewsAndVotesAreDeduplicated() {
  String id=create(document(2,List.of(item(chapter())))).get("id").toString();publish(id);
  var operations=new ArrayList<java.util.concurrent.CompletableFuture<HttpResponse<String>>>();
  for(int i=0;i<4;i++){int score=i+1;operations.add(java.util.concurrent.CompletableFuture.supplyAsync(()->call("POST","/api/catalog/collections/"+id+"/view",null,reader)));operations.add(java.util.concurrent.CompletableFuture.supplyAsync(()->call("PUT","/api/catalog/collections/"+id+"/rating",Map.of("score",score),reader)));}
  operations.forEach(result->ok(result.join()));assertThat(publicDetail(id)).containsEntry("views",1).containsEntry("ratingCount",1);
 }

 @Test void concurrentScenarioSettingsSavesCannotOverwriteTheWinner() {
  var original=scenario();var created=ok(call("POST","/api/author/stories/import",original,author));String path="/api/author/stories/"+created.get("storyId");
  var first=new LinkedHashMap<>(original);first.put("title","First tab");var second=new LinkedHashMap<>(original);second.put("title","Second tab");
  var a=java.util.concurrent.CompletableFuture.supplyAsync(()->call("PUT",path,Map.of("generation",created.get("generation"),"document",first),author));
  var b=java.util.concurrent.CompletableFuture.supplyAsync(()->call("PUT",path,Map.of("generation",created.get("generation"),"document",second),author));
  var one=a.join();var two=b.join();assertThat(List.of(one.statusCode(),two.statusCode())).containsExactlyInAnyOrder(200,409);
  var winner=object(one.statusCode()==200?one.body():two.body());var current=ok(call("GET",path,null,author));assertThat(current).containsEntry("title",winner.get("title")).containsEntry("storyId",created.get("storyId"));
  assertThat(((Map<?,?>)current.get("draftDocument")).get("scenes")).isEqualTo(original.get("scenes"));
 }

 @Test void aggregateCountsIncludeOtherReadersButUseEachFrozenRevisionExactly() {
  var a=chapter();var b=chapter();var doc=document(2,List.of(item(a),item(b)));String id=create(doc).get("id").toString();publish(id);
  String other=TestJwtFactory.player("aggregate-other-"+UUID.randomUUID()+"@example.test");
  String mine=run(id).get("id").toString(),saveA=start(mine,a,null);finish(saveA);finish(start(mine,b,saveA));
  String theirs=run(id,other).get("id").toString(),theirA=start(theirs,a,null,other);finish(theirA,other);finish(start(theirs,b,theirA,other),other);
  String partial=run(id,other).get("id").toString();finish(start(partial,a,null,other),other);
  assertThat(publicDetail(id)).containsEntry("totalRuns",3).containsEntry("finishedRuns",2).containsEntry("lastRunId",mine).containsEntry("completedCount",2).containsEntry("discoveredEndings",1);
  doc.put("items",List.of(item(a)));ok(call("PUT","/api/author/collections/"+id,Map.of("generation",detail(id).get("generation"),"document",doc),author));publish(id);
  assertThat(publicDetail(id)).containsEntry("totalRuns",3).containsEntry("finishedRuns",2).containsEntry("lastRunId",mine).containsEntry("progressTotal",2);
  String current=run(id,other).get("id").toString();finish(start(current,a,null,other),other);
  assertThat(publicDetail(id)).containsEntry("totalRuns",4).containsEntry("finishedRuns",3).containsEntry("lastRunId",mine);
  String newReader=TestJwtFactory.player("aggregate-new-"+UUID.randomUUID()+"@example.test");
  assertThat(ok(call("GET","/api/catalog/collections/"+id,null,newReader))).containsEntry("totalRuns",4).containsEntry("finishedRuns",3).containsEntry("lastRunId",null).containsEntry("completedCount",0).containsEntry("discoveredEndings",0);
  var bDetail=ok(call("GET","/api/author/stories/"+b.get("storyId"),null,author));ok(call("POST","/api/moderation/stories/"+b.get("storyId")+"/hide",Map.of("generation",bDetail.get("generation"),"reason","Unavailable old chapter"),reviewer));
  assertThat(publicDetail(id)).containsEntry("totalRuns",4).containsEntry("finishedRuns",1);
 }
}
