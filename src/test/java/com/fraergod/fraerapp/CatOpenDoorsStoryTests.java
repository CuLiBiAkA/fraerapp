package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/** The repository story is tested through the real import, moderation and reader APIs. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
 "spring.datasource.url=jdbc:h2:mem:cat-doors;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=validate", "app.assets.storage-path=build/test-uploads/cat-doors"
})
class CatOpenDoorsStoryTests extends ApiTestSupport {
 @LocalServerPort int port;
 final String author=TestJwtFactory.author("cat-author-"+UUID.randomUUID()+"@example.test");
 final String reviewer=TestJwtFactory.moderator("cat-reviewer-"+UUID.randomUUID()+"@example.test");
 final String reader=TestJwtFactory.player("cat-reader-"+UUID.randomUUID()+"@example.test");

 HttpResponse<String> call(String method,String path,Object value,String token){return api(port,method,path,value==null?null:body(value),token);}
 Map<String,Object> ok(HttpResponse<String> response){assertThat(response.statusCode()).as(response.body()).isEqualTo(200);return object(response.body());}
 @SuppressWarnings("unchecked") Map<String,Object> map(Object value){return (Map<String,Object>)value;}
 @SuppressWarnings("unchecked") List<Map<String,Object>> maps(Object value){return (List<Map<String,Object>>)value;}
 String unique(){return UUID.randomUUID().toString().replace("-","");}
 Map<String,Object> scene(Map<String,Object> state){return map(state.get("scene"));}
 Map<String,Object> variables(Map<String,Object> state){return map(state.get("variables"));}
 Set<String> choices(Map<String,Object> state){var result=new HashSet<String>();for(var choice:maps(scene(state).get("choices")))result.add(choice.get("id").toString());return result;}
 Map<String,Object> step(Map<String,Object> state,String choice){
  assertThat(choices(state)).as("choice %s in %s",choice,scene(state).get("id")).contains(choice);
  return ok(call("POST","/api/sessions/"+state.get("sessionId")+"/choice",Map.of("choiceId",choice),reader));
 }
 Map<String,Object> walk(Map<String,Object> state,String... choices){for(String choice:choices)state=step(state,choice);return state;}
 record Fixture(String collection,List<String> chapters,Map<String,Object> source) {}
 Fixture publishPackage() throws Exception {
  String prefix="cat_"+unique();
  var source=object(Files.readString(Path.of("story-builder/scenarios/koshka-i-otkrytye-dveri.package.json")).replace("koshka_i_otkrytye_dveri",prefix));
  var preview=ok(call("POST","/api/author/collections/import-preview",source,author));
  assertThat(preview.get("canImport")).isEqualTo(true);
  assertThat(maps(preview.get("items"))).allSatisfy(item->assertThat(item.get("action")).isEqualTo("create"));
  var imported=ok(call("POST","/api/author/collections/import",source,author));
  String root=maps(imported.get("items")).stream().filter(item->prefix.equals(item.get("key"))).findFirst().orElseThrow().get("collectionId").toString();
  var details=ok(call("GET","/api/author/collections/"+root,null,author));
  var chapterIds=maps(map(details.get("draftDocument")).get("items")).stream().map(item->map(item.get("target")).get("id").toString()).toList();
  assertThat(call("GET","/api/catalog/collections/"+root,null,reader).statusCode()).isEqualTo(404);
  ok(call("GET","/api/author/collections/"+root+"/preview",null,author));
  ok(call("POST","/api/author/collections/"+root+"/review-batch",Map.of("generation",details.get("generation"),"replaceReview",false),author));
  var review=ok(call("GET","/api/moderation/folders/"+root+"/review",null,reviewer));
  var items=maps(review.get("items")).stream().map(item->Map.of("kind",item.get("kind"),"id",item.get("id"),"generation",item.get("generation"),"revision",item.get("revision"))).toList();
  assertThat(items).hasSize(4);
  ok(call("POST","/api/moderation/folders/"+root+"/decision",Map.of("action","approve-publish","rootGeneration",review.get("rootGeneration"),"items",items,"reason","Reviewed the isolated cat story fixture"),reviewer));
  var catalog=ok(call("GET","/api/catalog/collections/"+root,null,reader));
  assertThat(body(catalog)).contains("Осень. По обе стороны порога","Весна. Право вернуться");
  return new Fixture(root,chapterIds,source);
 }
 String begin(Fixture fixture){return ok(call("POST","/api/collections/"+fixture.collection()+"/runs",Map.of("requestId",unique()),reader)).get("runId").toString();}
 Map<String,Object> start(Fixture fixture,String run,int chapter,Map<String,Object> previous){
  var command=new LinkedHashMap<String,Object>();command.put("targetId",fixture.chapters().get(chapter-1));command.put("requestId",unique());
  if(previous!=null)command.put("sourceSessionId",previous.get("sessionId"));
  return map(ok(call("POST","/api/collection-runs/"+run+"/start",command,reader)).get("session"));
 }

 @Test void numericConditionsCompareValuesAcrossJsonNumberRepresentations() {
  var conditions=new ArrayList<Map<String,Object>>();
  for(String op:List.of("==","!=",">",">=","<","<="))conditions.add(Map.of("id","n"+conditions.size(),"label",op,"target","end","conditions",List.of(Map.of("var","n","op",op,"value",1))));
  conditions.add(Map.of("id","advance","label","Advance","target","after_inc","effects",List.of(Map.of("inc","n","value",1))));
  conditions.add(Map.of("id","string_is_not_number","label","String","target","end","conditions",List.of(Map.of("var","label","op","==","value",1))));
  var document=Map.of("key","numbers_"+unique(),"title","Number comparison fixture","version",1,"startSceneId","start","variables",Map.of("n",1,"label","1"),"assets",List.of(),"scenes",List.of(
   Map.of("id","start","title","Start","text","Start","choices",conditions),
   Map.of("id","after_inc","title","Incremented","text","Incremented","choices",List.of(
    Map.of("id","equal","label","Equal","target","after_decimal","conditions",List.of(Map.of("var","n","op","==","value",2)),"effects",List.of(Map.of("inc","n","value",-.5))),
    Map.of("id","not_equal","label","Not equal","target","end","conditions",List.of(Map.of("var","n","op","!=","value",2))))),
   Map.of("id","after_decimal","title","Decimal","text","Decimal","choices",List.of(Map.of("id","decimal_equal","label","Decimal equal","target","end","conditions",List.of(Map.of("var","n","op","==","value",1.5))))),
   Map.of("id","end","title","End","text","End","ending",Map.of("type","good"),"choices",List.of())));
  var draft=ok(call("POST","/api/author/stories/import",document,author));
  ok(approveAndPublish(port,draft.get("storyId").toString(),author));
  var state=ok(call("POST","/api/sessions",Map.of("storyKey",document.get("key")),reader));
  assertThat(choices(state)).containsExactlyInAnyOrder("n0","n3","n5","advance");
  state=step(state,"advance");assertThat(choices(state)).containsExactly("equal");
  state=step(state,"equal");assertThat(choices(state)).containsExactly("decimal_equal");
  assertThat(step(state,"decimal_equal").get("status")).isEqualTo("finished");
 }

 @Test void localMediaAndVariablesShadowGlobalsAndPersistAcrossReentry() throws Exception {
  var fixture=publishPackage();var state=start(fixture,begin(fixture),1,null);
  state=walk(state,"ask","listen","wardrobe");
  assertThat(scene(state)).containsEntry("backgroundUrl","/assets/stories/cat-sofa-background-v1.png").containsEntry("musicUrl","/assets/stories/cat-open-doors-chime.wav");
  assertThat(scene(state).get("text").toString()).contains("«шкаф»","номер 1");
  assertThat(variables(state)).containsEntry("эхо","дом").doesNotContainKey("стук");
  state=walk(state,"leave","wardrobe");
  assertThat(scene(state).get("text").toString()).contains("«мур»","номер 2");
  assertThat(variables(state)).containsEntry("эхо","дом");
  state=step(state,"knock");assertThat(scene(state).get("id")).isEqualTo("wardrobe_pause");
  state=step(state,"return");
  assertThat(scene(state)).containsEntry("backgroundUrl","/assets/stories/cat-sofa-background-v2.png").containsEntry("musicUrl","/assets/stories/cat-open-doors-purr.wav");
 }

 @Test void localTimerDeclarationIsANumberAndSurvivesSaveReload() throws Exception {
  var fixture=publishPackage();String run=begin(fixture);
  var first=walk(start(fixture,run,1,null),"ask","listen","try_door","inspect","home");
  var second=walk(start(fixture,run,2,first),"help","ribbon","greet","lean","prop","stay");
  var state=walk(start(fixture,run,3,second),"nap_first");
  assertThat(scene(state).get("text").toString()).contains("30 спокойных мгновений").doesNotContain("type","value");
  assertThat(choices(state)).containsExactlyInAnyOrder("patient","countdown");
  var reloaded=ok(call("GET","/api/sessions/"+state.get("sessionId")+"/state",null,reader));
  assertThat(scene(reloaded)).isEqualTo(scene(state));
  assertThat(variables(reloaded)).doesNotContainKey("пауза");
  assertThat(scene(step(reloaded,"patient")).get("id")).isEqualTo("ribbon_path");
 }

 @Test void realPublishedPackageReachesEverySceneAndAllThreeFinales() throws Exception {
  var fixture=publishPackage();var visited=new HashSet<String>();
  String[][][] routes={
   {{"ask","listen","try_door","inspect","home"},{"help","ribbon","greet","lean","prop","stay"},{"plan","share_plan","patient","inspect_route","invite"}},
   {{"rush","sneak","try_door","rest","settle"},{"sulk","greet","wait_out","stay"},{"nap_first","countdown","inspect_route","invite"}},
   {{"ask","listen","wardrobe","knock","knock","return","try_door","inspect","soft_step","settle"},{"help","hurry","untangle","listen","quiet_visit","push","repair","approve","stay"},{"plan","draw_small","countdown","request_revision","approve","inspector","stamp"}},
   {{"ask","listen","try_door","watch","settle"},{"help","ribbon","greet","lean","prop","stay"},{"plan","share_plan","patient","request_revision","more_cushions"}}
  };
  var finales=new HashSet<String>();
  for(var route:routes){
   String run=begin(fixture);Map<String,Object> previous=null;
   assertThat(call("POST","/api/collection-runs/"+run+"/start",Map.of("targetId",fixture.chapters().get(2),"requestId",unique()),reader).statusCode()).isEqualTo(409);
   for(int chapter=1;chapter<=3;chapter++){
    var state=start(fixture,run,chapter,previous);
    if(previous!=null){assertThat(variables(state).get("доверие")).isEqualTo(variables(previous).get("доверие"));assertThat(variables(state)).doesNotContainKeys("стук","пауза","__sceneVariables");}
    visited.add(chapter+":"+scene(state).get("id"));
    for(String choice:route[chapter-1]){state=step(state,choice);visited.add(chapter+":"+scene(state).get("id"));}
    assertThat(state.get("status")).isEqualTo("finished");previous=state;
   }
   finales.add(scene(previous).get("id").toString());
   var completed=ok(call("GET","/api/collection-runs/"+run,null,reader));assertThat(completed).containsEntry("completedCount",3).containsEntry("allReleasedRead",true);
  }
  var expected=new HashSet<String>();var chapters=maps(fixture.source().get("scenarios"));
  for(int n=0;n<chapters.size();n++)for(var scene:maps(chapters.get(n).get("scenes")))expected.add((n+1)+":"+scene.get("id"));
  assertThat(visited).containsExactlyInAnyOrderElementsOf(expected);
  assertThat(finales).containsExactlyInAnyOrder("shared_end","quiet_end","funny_end");
 }

 @Test void exportedPackagePreservesAllFeaturesAndRelationPreviewCreatesNoReadingRun() throws Exception {
  var fixture=publishPackage();
  var exported=ok(call("GET","/api/author/collections/"+fixture.collection()+"/export",null,author));
  assertThat(exported).containsEntry("kind","fraerapp-work-package").containsEntry("schemaVersion",1);
  assertThat(maps(exported.get("scenarios"))).hasSize(3);
  var source=maps(fixture.source().get("scenarios")).get(0);var target=maps(fixture.source().get("scenarios")).get(1);
  var transfer=maps(map(source.get("metadata")).get("relations")).get(0).get("stateTransfer");
  var result=ok(call("POST","/api/author/relations/test",Map.of("source",source,"target",target,"stateTransfer",transfer,"values",Map.of("доверие",7,"обещание",true,"настроение","ласковое","стук",99)),author));
  assertThat(map(result.get("values"))).containsExactlyInAnyOrderEntriesOf(Map.of("доверие",7,"обещание",true,"настроение","ласковое"));
  assertThat(call("GET","/api/collections/"+fixture.collection()+"/runs",null,reader).body()).isEqualTo("[]");
  assertThat(call("POST","/api/author/relations/test",Map.of("source",source,"target",target,"stateTransfer",transfer,"values",Map.of("доверие",101,"обещание",true,"настроение","ласковое")),author).statusCode()).isEqualTo(409);
 }
}
