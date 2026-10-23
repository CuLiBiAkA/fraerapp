package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.file.*;
import java.util.*;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/** Content acceptance through the real package, review and game-transition owners. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
 "spring.datasource.url=jdbc:h2:mem:district;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=validate", "app.assets.storage-path=build/test-uploads/district"
})
class DistrictStoryTests extends ApiTestSupport {
 @LocalServerPort int port;
 final String author=TestJwtFactory.author("district-author-"+UUID.randomUUID()+"@example.test");
 final String reviewer=TestJwtFactory.moderator("district-reviewer-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("district-reader-"+UUID.randomUUID()+"@example.test");
 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> r){assertThat(r.statusCode()).as(r.body()).isEqualTo(200);return object(r.body());}
 @SuppressWarnings("unchecked") Map<String,Object> map(Object v){return (Map<String,Object>)v;}
 @SuppressWarnings("unchecked") List<Map<String,Object>> maps(Object v){return (List<Map<String,Object>>)v;}

 @Test void allSixtyScenesAndSixteenEndingsSurviveNativePublicationAndRuntime() throws Exception {
  String key="district_"+UUID.randomUUID().toString().replace("-","");
  var source=object(Files.readString(Path.of("story-builder/scenarios/kto-ty-po-zhizni.package.json")).replace("kto_ty_po_zhizni",key));
  assertThat(ok(call("POST","/api/author/collections/import-preview",source,author)).get("canImport")).isEqualTo(true);
  var imported=ok(call("POST","/api/author/collections/import",source,author));
  String root=maps(imported.get("items")).stream().filter(i->key.equals(i.get("key"))).findFirst().orElseThrow().get("collectionId").toString();
  var details=ok(call("GET","/api/author/collections/"+root,null,author));
  String chapter=map(maps(map(details.get("draftDocument")).get("items")).get(0).get("target")).get("id").toString();
  var draft=ok(call("GET","/api/author/stories/"+chapter,null,author));
  Object revision=draft.get("draftRevision");
  var routes=maps(new ObjectMapper().readValue(Files.readString(Path.of("story-builder/fixtures/kto-ty-po-zhizni-routes.json")),List.class));
  Set<String> seen=new HashSet<>(),ends=new HashSet<>();
  for(var route:routes) {
   var result=ok(call("POST","/api/author/stories/"+chapter+"/playtest",Map.of("revision",revision,"choices",route.get("choices")),author));
   assertThat(map(result.get("scene")).get("id")).isEqualTo(route.get("ending"));
   assertThat(result.get("status")).isEqualTo("finished");
   for(var entry:map(route.get("expected")).entrySet())assertThat(((Number)map(result.get("variables")).get(entry.getKey())).doubleValue()).isEqualTo(((Number)entry.getValue()).doubleValue());
   for(Object scene:(List<?>)route.get("scenes"))seen.add(scene.toString());
   ends.add(route.get("ending").toString());
  }
  assertThat(seen).hasSize(60);assertThat(ends).hasSize(16);
  // The real server rejects an unaffordable 400-ruble purchase after buying tools.
  var expensive=List.of("approach","honest","real","promise","sleep","market","pawn","tools","back","clothes","buy");
  assertThat(call("POST","/api/author/stories/"+chapter+"/playtest",Map.of("revision",revision,"choices",expensive),author).statusCode()).isEqualTo(400);
  ok(call("POST","/api/author/collections/"+root+"/review-batch",Map.of("generation",details.get("generation"),"replaceReview",false),author));
  var review=ok(call("GET","/api/moderation/folders/"+root+"/review",null,reviewer));
  var items=maps(review.get("items")).stream().map(i->Map.of("kind",i.get("kind"),"id",i.get("id"),"generation",i.get("generation"),"revision",i.get("revision"))).toList();
  assertThat(items).hasSize(2);
  ok(call("POST","/api/moderation/folders/"+root+"/decision",Map.of("action","approve-publish","rootGeneration",review.get("rootGeneration"),"items",items,"reason","Reviewed 60 illustrated scenes and all 16 earned endings in an isolated fixture"),reviewer));
  assertThat(maps(ok(call("GET","/api/catalog/collections/"+root,null,reader)).get("items"))).hasSize(1);
  String run=ok(call("POST","/api/collections/"+root+"/runs",Map.of("requestId",UUID.randomUUID().toString()),reader)).get("runId").toString();
  var state=map(ok(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",chapter,"requestId",UUID.randomUUID().toString()),reader)).get("session"));
  for(Object choice:(List<?>)routes.get(0).get("choices"))state=ok(call("POST","/api/sessions/"+state.get("sessionId")+"/choice",Map.of("choiceId",choice),reader));
  assertThat(map(state.get("scene")).get("id")).isEqualTo("end_authority");
 }
}
