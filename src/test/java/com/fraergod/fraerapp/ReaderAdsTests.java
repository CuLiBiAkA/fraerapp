package com.fraergod.fraerapp;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
 "spring.datasource.url=jdbc:h2:mem:readerads;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=validate"
})
class ReaderAdsTests extends ApiTestSupport {
 @LocalServerPort int port;
 final String author=TestJwtFactory.author("ad-author-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("ad-reader-"+UUID.randomUUID()+"@example.test");
 final String admin=TestJwtFactory.admin("ad-admin@example.test");
 @BeforeEach void defaults(){settings(true,5);}
 Map<String,Object> settings(boolean enabled,int interval){var config=ok("GET","/api/admin/reader-ads",null,admin);return ok("PUT","/api/admin/reader-ads",Map.of("enabled",enabled,"intervalScenes",interval,"version",config.get("version")),admin);}
 String offer(Map<String,Object> state){return ((Map<?,?>)state.get("readerAd")).get("id").toString();}
 Object claim(String id,String token){return ok("POST","/api/reader-ads/claim",Map.of("offerId",id),token).get("ad");}
 Map<String,Object> ok(String method,String path,Object value,String token){var result=api(port,method,path,value==null?null:body(value),token);assertThat(result.statusCode()).as(result.body()).isEqualTo(200);return object(result.body());}
 String story(){
  String key="ads_"+UUID.randomUUID().toString().replace("-","");var scenes=new ArrayList<Map<String,Object>>();
  for(int i=1;i<=8;i++){var scene=new LinkedHashMap<String,Object>(Map.of("id","s"+i,"title","Scene "+i,"text","Text "+i,"choices",i<8?List.of(Map.of("id","next","label","Next","target","s"+(i+1))):List.of()));if(i==8)scene.put("ending",Map.of("title","The end"));scenes.add(scene);}
  var imported=ok("POST","/api/author/stories/import",Map.of("key",key,"title","Ad fixture","version",1,"startSceneId","s1","variables",Map.of(),"assets",List.of(),"scenes",scenes),author);
  assertThat(approveAndPublish(port,imported.get("storyId").toString(),author).statusCode()).isEqualTo(200);return key;
 }
 String start(String key,String token){return ok("POST","/api/sessions",Map.of("storyKey",key),token).get("sessionId").toString();}
 Map<String,Object> step(String id,String token){return ok("POST","/api/sessions/"+id+"/choice",Map.of("choiceId","next"),token);}
 @Test void fiveTransitionsOfferOneAdAndRefreshDoesNotCount(){
  String id=start(story(),reader);
  for(int i=0;i<4;i++){assertThat(step(id,reader).get("readerAd")).isNull();assertThat(ok("GET","/api/sessions/"+id+"/state",null,reader).get("readerAd")).isNull();}
  var state=step(id,reader);assertThat(state.get("readerAd")).isInstanceOf(Map.class);
  String offer=((Map<?,?>)state.get("readerAd")).get("id").toString();
  var delivery=ok("POST","/api/reader-ads/claim",Map.of("offerId",offer),reader);assertThat(delivery.get("ad")).isNotNull();
  assertThat(ok("POST","/api/reader-ads/claim",Map.of("offerId",offer),reader).get("ad")).isNull();
  assertThat(ok("GET","/api/sessions/"+id+"/state",null,reader).get("readerAd")).isNull();
 }
 @Test void sharedAcrossStoriesAndOnlySuccessfulChoicesCount(){
  settings(true,2);String first=start(story(),reader),second=start(story(),reader);
  assertThat(step(first,reader).get("readerAd")).isNull();
  assertThat(api(port,"POST","/api/sessions/"+second+"/choice",body(Map.of("choiceId","invalid")),reader).statusCode()).isEqualTo(400);
  assertThat(ok("GET","/api/sessions/"+second+"/state",null,reader).get("readerAd")).isNull();
  assertThat(step(second,reader).get("readerAd")).isNotNull();
 }
 @Test void subscriptionIsRecheckedAndPaidTransitionsClearTheCounter(){
  settings(true,2);String key=story(),id=start(key,reader);step(id,reader);String pending=offer(step(id,reader));
  subscription(reader,true);assertThat(claim(pending,reader)).isNull();assertThat(step(id,reader).get("readerAd")).isNull();
  subscription(reader,false);assertThat(step(id,reader).get("readerAd")).isNull();assertThat(step(id,reader).get("readerAd")).isNotNull();
  subscription(author,false);String own=start(key,author);step(own,author);assertThat(step(own,author).get("readerAd")).isNotNull();
 }
 @Test void endingNeverDisplaysButCarriesDuePause(){
  settings(true,7);String key=story(),id=start(key,reader);for(int i=0;i<7;i++)assertThat(step(id,reader).get("readerAd")).isNull();
  String next=start(key,reader);assertThat(ok("GET","/api/sessions/"+next+"/state",null,reader).get("readerAd")).isNull();assertThat(step(next,reader).get("readerAd")).isNotNull();
 }
 @Test void concurrentClaimsHaveOneWinnerAndOtherReadersCannotConsume(){
  settings(true,1);String id=start(story(),reader),pending=offer(step(id,reader));assertThat(claim(pending,author)).isNull();
  var a=java.util.concurrent.CompletableFuture.supplyAsync(()->claim(pending,reader));var b=java.util.concurrent.CompletableFuture.supplyAsync(()->claim(pending,reader));
  assertThat(java.util.stream.Stream.of(a.join(),b.join()).filter(Objects::nonNull).count()).isEqualTo(1);
 }
 @Test void disableOrConfigurationChangeInvalidatesPendingOffer(){
  settings(true,1);String id=start(story(),reader),pending=offer(step(id,reader));settings(false,1);assertThat(claim(pending,reader)).isNull();assertThat(step(id,reader).get("readerAd")).isNull();
  settings(true,1);pending=offer(step(id,reader));settings(true,2);assertThat(claim(pending,reader)).isNull();assertThat(step(id,reader).get("readerAd")).isNull();assertThat(step(id,reader).get("readerAd")).isNotNull();
 }
 @Test void adminValidationPermissionsAndVersionConflict(){
  assertThat(api(port,"GET","/api/admin/reader-ads",null,reader).statusCode()).isEqualTo(403);
  assertThat(api(port,"GET","/api/admin/reader-ads",null,null).statusCode()).isEqualTo(401);
  var value=new LinkedHashMap<String,Object>(Map.of("enabled",true,"intervalScenes",5,"version",ok("GET","/api/admin/reader-ads",null,admin).get("version")));
  assertThat(api(port,"PUT","/api/admin/reader-ads",body(value),reader).statusCode()).isEqualTo(403);
  for(String url:List.of("javascript:alert(1)","//example.test","/\\example.test","https://user@example.test")){value.put("linkUrl",url);assertThat(api(port,"PUT","/api/admin/reader-ads",body(value),admin).statusCode()).isEqualTo(400);}
  value.put("linkUrl","https://example.test/promo");value.put("intervalScenes",0);assertThat(api(port,"PUT","/api/admin/reader-ads",body(value),admin).statusCode()).isEqualTo(400);
  value.put("intervalScenes",101);assertThat(api(port,"PUT","/api/admin/reader-ads",body(value),admin).statusCode()).isEqualTo(400);
  value.put("intervalScenes",5);assertThat(ok("PUT","/api/admin/reader-ads",value,admin).get("linkUrl")).isEqualTo("https://example.test/promo");
  assertThat(api(port,"PUT","/api/admin/reader-ads",body(value),admin).statusCode()).isEqualTo(409);
 }
}
