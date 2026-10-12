package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=jdbc:h2:mem:draft-collection-playtest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.datasource.username=sa","spring.datasource.password=","spring.jpa.hibernate.ddl-auto=validate"
})
class DraftCollectionPlaytestTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 final String author=TestJwtFactory.author("serial-preview-"+UUID.randomUUID()+"@example.test");
 final String moderator=TestJwtFactory.moderator("serial-reviewer-"+UUID.randomUUID()+"@example.test");
 String key(){return "preview_"+UUID.randomUUID().toString().replace("-","");}
 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> response){assertThat(response.statusCode()).as(response.body()).isEqualTo(200);return object(response.body());}
 @SuppressWarnings("unchecked") List<Map<String,Object>> chapters(Map<String,Object> manifest){return (List<Map<String,Object>>)manifest.get("chapters");}
 Map<String,Object> chapter(int initial,int startEffect,int choiceEffect){
  return new LinkedHashMap<>(Map.of("key",key(),"title","Private chapter","startSceneId","start","variables",Map.of("points",initial),"scenes",List.of(
   Map.of("id","start","title","Start","text","Points {{points}}","effects",List.of(Map.of("inc","points","value",startEffect)),"choices",List.of(Map.of("id","go","label","Go","target","end","effects",List.of(Map.of("inc","points","value",choiceEffect))))),
   Map.of("id","end","title","End","text","Finished {{points}}","ending",Map.of("title","Done"),"choices",List.of()))));
 }
 Map<String,Object> imported(Map<String,Object> document){return ok(call("POST","/api/author/stories/import",document,author));}
 Map<String,Object> item(Map<String,Object> story){return Map.of("target",Map.of("kind","scenario","id",story.get("storyId")));}
 Map<String,Object> document(int schema,List<?> items){return new LinkedHashMap<>(Map.of("schemaVersion",schema,"key",key(),"title","Private serial","type","story","completionStatus","completed","items",items,"transitions",List.of()));}
 Map<String,Object> collection(Map<String,Object> document){return ok(call("POST","/api/author/collections",Map.of("document",document),author));}
 String path(Map<String,Object> collection){return "/api/author/collections/"+collection.get("id")+"/playtest";}
 Map<String,Object> manifest(Map<String,Object> collection){var response=call("GET",path(collection),null,author);assertThat(response.headers().firstValue("Cache-Control")).contains("private, no-store");return ok(response);}
 Map<String,Object> step(Map<String,Object> chapter,String... choices){return Map.of("id",chapter.get("id"),"revision",chapter.get("revision"),"choices",List.of(choices));}
 Map<String,Object> replay(Map<String,Object> collection,Map<String,Object> manifest,List<?> steps){return ok(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",steps),author));}
 @SuppressWarnings("unchecked") Map<String,Object> session(Map<String,Object> result){return (Map<String,Object>)result.get("session");}
 void publish(Map<String,Object> collection){
  String id=collection.get("id").toString();advanceReviewDay(jdbc,"collection",id);
  var submitted=ok(call("POST","/api/author/collections/"+id+"/review",Map.of("generation",collection.get("generation")),author));
  ok(call("POST","/api/moderation/collections/"+id+"/approve-publish",Map.of("generation",submitted.get("generation"),"revision",submitted.get("submittedRevision"),"visibility","public"),moderator));
 }
 Map<String,Object> publishedStart(String run,Map<String,Object> chapter,String source){
  var command=new LinkedHashMap<String,Object>();command.put("targetId",chapter.get("storyId"));command.put("sourceSessionId",source);command.put("requestId",key());
  return session(ok(call("POST","/api/collection-runs/"+run+"/start",command,author)));
 }
 Map<String,Object> comparable(Map<String,Object> state){var result=new LinkedHashMap<>(state);result.remove("sessionId");result.remove("readerAd");return result;}
 Map<String,List<Map<String,Object>>> storedState(){
  var result=new LinkedHashMap<String,List<Map<String,Object>>>();
  for(String table:List.of("players","stories","story_versions","story_workspaces","work_collections","collection_versions","game_sessions","collection_runs","collection_run_saves","chapter_transitions","reader_endings","reader_ad_progress","story_views","story_ratings","collection_views","collection_ratings"))result.put(table,jdbc.queryForList("select * from "+table));
  return result;
 }

 @Test void fullPrivateSerialMatchesPublishedTransfersAndPinsBothContentsAndChapterSnapshots(){
  var first=imported(chapter(1,0,9));var secondDocument=chapter(100,1,3);var second=imported(secondDocument);
  var document=document(2,List.of(item(first),item(second)));var collection=collection(document);var manifest=manifest(collection);var chapters=chapters(manifest);
  assertThat(chapters).hasSize(2);var before=storedState();
  var initial=replay(collection,manifest,List.of(step(chapters.get(0))));assertThat(initial).containsEntry("chapterIndex",0);
  var secondStart=replay(collection,manifest,List.of(step(chapters.get(0),"go"),step(chapters.get(1))));
  assertThat(secondStart).containsEntry("chapterIndex",1);assertThat(session(secondStart).get("variables")).isEqualTo(Map.of("points",11.0));
  var finished=replay(collection,manifest,List.of(step(chapters.get(0),"go"),step(chapters.get(1),"go")));
  assertThat(session(finished)).containsEntry("status","finished").containsEntry("variables",Map.of("points",14.0)).containsEntry("readerAd",null);
  assertThat(storedState()).isEqualTo(before);

  ok(approveAndPublishOnNextDay(jdbc,port,first.get("storyId").toString(),author));ok(approveAndPublishOnNextDay(jdbc,port,second.get("storyId").toString(),author));publish(collection);
  var run=ok(call("POST","/api/collections/"+collection.get("id")+"/runs",Map.of("requestId",key()),author));
  var realFirst=publishedStart(run.get("id").toString(),first,null);assertThat(comparable(realFirst)).isEqualTo(comparable(session(initial)));
  var completedFirst=ok(call("POST","/api/sessions/"+realFirst.get("sessionId")+"/choice",Map.of("choiceId","go"),author));
  var realSecond=publishedStart(run.get("id").toString(),second,completedFirst.get("sessionId").toString());assertThat(comparable(realSecond)).isEqualTo(comparable(session(secondStart)));
  var completedSecond=ok(call("POST","/api/sessions/"+realSecond.get("sessionId")+"/choice",Map.of("choiceId","go"),author));assertThat(comparable(completedSecond)).isEqualTo(comparable(session(finished)));

  requestPublishedCorrection(port,second.get("storyId").toString());
  secondDocument.put("title","New private chapter title");imported(secondDocument);
  document.put("items",List.of(item(second),item(first)));
  var current=ok(call("GET","/api/author/collections/"+collection.get("id"),null,author));
  ok(call("PUT","/api/author/collections/"+collection.get("id"),Map.of("generation",current.get("generation"),"document",document),author));
  before=storedState();
  assertThat(comparable(session(replay(collection,manifest,List.of(step(chapters.get(0),"go"),step(chapters.get(1),"go")))))).isEqualTo(comparable(session(finished)));
  assertThat(storedState()).isEqualTo(before);
  assertThat(chapters(manifest(collection)).get(0).get("id")).isEqualTo(second.get("storyId"));
 }

 @Test void rejectsSkippedIncompleteForeignAndExpiredChaptersAndNeverTrustsSubmittedValues(){
  var first=imported(chapter(1,0,9));var second=imported(chapter(100,1,3));var collection=collection(document(2,List.of(item(first),item(second))));var manifest=manifest(collection);var chapters=chapters(manifest);
  var command=Map.of("revision",manifest.get("revision"),"steps",List.of(step(chapters.get(0))));var before=storedState();
  for(String method:List.of("GET","POST")){
   assertThat(call(method,path(collection),method.equals("POST")?command:null,null).statusCode()).isEqualTo(401);
   assertThat(call(method,path(collection),method.equals("POST")?command:null,TestJwtFactory.author("foreign-"+UUID.randomUUID()+"@example.test")).statusCode()).isEqualTo(403);
   assertThat(call(method,path(collection),method.equals("POST")?command:null,TestJwtFactory.player("reader-"+UUID.randomUUID()+"@example.test")).statusCode()).isEqualTo(403);
   ok(call(method,path(collection),method.equals("POST")?command:null,moderator));
  }
  assertThat(storedState()).isEqualTo(before);
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of(step(chapters.get(1)))),author).statusCode()).isEqualTo(400);
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of(step(chapters.get(0)),step(chapters.get(1)))),author).statusCode()).isEqualTo(409);
  var badRevision=new LinkedHashMap<>(step(chapters.get(0)));badRevision.put("revision",999999);
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of(badRevision)),author).statusCode()).isEqualTo(404);
  assertThat(call("GET",path(collection)+"?revision=999999",null,author).statusCode()).isEqualTo(404);
  var injected=new LinkedHashMap<>(step(chapters.get(0)));injected.put("variables",Map.of("points",999));
  assertThat(session(replay(collection,manifest,List.of(injected))).get("variables")).isEqualTo(Map.of("points",1.0));
  var tooLong=new LinkedHashMap<>(step(chapters.get(0)));tooLong.put("choices",Collections.nCopies(500,"go"));
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of(tooLong,step(chapters.get(1),"go"))),author).statusCode()).isEqualTo(400);
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of()),author).statusCode()).isEqualTo(400);
  assertThat(storedState()).isEqualTo(before);
  jdbc.update("update stories set visibility='deleted',deleted_at=? where id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(31*86400)),first.get("storyId"));
  assertThat(call("GET",path(collection),null,author).statusCode()).isEqualTo(404);
  assertThat(call("POST",path(collection),command,author).statusCode()).isEqualTo(404);
 }

 @Test void emptyAndLegacyContentsHaveActionableDiagnosticsAndParentExpiryBlocksFrozenReplay(){
  var empty=collection(document(2,List.of()));var response=call("GET",path(empty),null,author);
  assertThat(response.statusCode()).isEqualTo(400);assertThat(object(response.body())).containsEntry("code","NO_CHAPTERS");
  var legacy=collection(document(1,List.of()));response=call("GET",path(legacy),null,author);
  assertThat(response.statusCode()).isEqualTo(400);assertThat(object(response.body())).containsEntry("code","UNSUPPORTED_PREVIEW");
  var first=imported(chapter(1,0,9));var collection=collection(document(2,List.of(item(first))));var manifest=manifest(collection);
  jdbc.update("update work_collections set visibility='purged' where id=?",collection.get("id"));
  assertThat(call("GET",path(collection),null,author).statusCode()).isEqualTo(404);
  assertThat(call("POST",path(collection),Map.of("revision",manifest.get("revision"),"steps",List.of(step(chapters(manifest).get(0)))),author).statusCode()).isEqualTo(404);
 }
}
