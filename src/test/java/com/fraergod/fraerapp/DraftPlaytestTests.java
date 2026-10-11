package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
 "spring.datasource.url=jdbc:h2:mem:draft-playtest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=validate", "app.admin-token=test-token"
})
class DraftPlaytestTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;

 @Test void privatePlaythroughUsesReaderRulesWithoutCreatingReaderActivity() {
  String author=TestJwtFactory.author("playtest-"+UUID.randomUUID()+"@example.test");
  String key="playtest_"+UUID.randomUUID().toString().replace("-", "");
  String document="""
   {"key":"%s","title":"Draft","startSceneId":"start","variables":{"points":0},
    "metadata":{"schemaVersion":1,"inputContract":{"version":1,"allowIndependentStart":true,"fields":[{"name":"points","type":"number","required":false,"defaultValue":7}]}},
    "scenes":[
     {"id":"start","title":"Start","text":"Points {{points}}","choices":[
      {"id":"go","label":"Go","target":"end","effects":[{"inc":"points","value":2}]}]},
     {"id":"end","title":"End","text":"Points {{points}}","ending":{"title":"Finished"},"choices":[]}]}
   """.formatted(key);
  var imported=api(port,"POST","/api/author/stories/import",document,author);
  assertThat(imported.statusCode()).as(imported.body()).isEqualTo(200);
  var info=object(imported.body());String id=info.get("storyId").toString();
  var before=counts();
  String path="/api/author/stories/"+id+"/playtest";
  String start=body(Map.of("revision",info.get("draftRevision"),"choices",List.of()));
  assertThat(api(port,"POST",path,start,null).statusCode()).isEqualTo(401);
  assertThat(api(port,"POST",path,start,TestJwtFactory.author("stranger@example.test")).statusCode()).isEqualTo(403);
  var initial=api(port,"POST",path,start,author);
  assertThat(initial.statusCode()).as(initial.body()).isEqualTo(200);
  assertThat(((Map<?,?>)object(initial.body()).get("scene")).get("text")).isEqualTo("Points 7");
  var finish=api(port,"POST",path,body(Map.of("revision",info.get("draftRevision"),"choices",List.of("go"))),author);
  assertThat(finish.statusCode()).as(finish.body()).isEqualTo(200);
  var result=object(finish.body());
  assertThat(result).containsEntry("status","finished");
  assertThat(((Map<?,?>)result.get("scene")).get("text")).isEqualTo("Points 9");
  assertThat(result).containsKey("readerAd");
  assertThat(result.get("readerAd")).isNull();
  assertThat(api(port,"POST",path,body(Map.of("revision",info.get("draftRevision"),"choices",List.of("missing"))),author).statusCode()).isEqualTo(400);
  assertThat(api(port,"POST",path,body(Map.of("revision",info.get("draftRevision"),"choices",Collections.nCopies(501,"go"))),author).statusCode()).isEqualTo(400);
  assertThat(counts()).isEqualTo(before);
  assertThat(api(port,"POST","/api/sessions",body(Map.of("storyKey",key)),author).statusCode()).isEqualTo(404);
 }
 private Map<String,Long> counts(){
  var result=new LinkedHashMap<String,Long>();
  for(String table:List.of("game_sessions","reader_endings","reader_ad_progress","story_views","story_ratings"))
   result.put(table,jdbc.queryForObject("select count(*) from "+table,Long.class));
  return result;
 }
}
