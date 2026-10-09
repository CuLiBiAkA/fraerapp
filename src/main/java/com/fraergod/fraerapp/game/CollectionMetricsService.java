package com.fraergod.fraerapp.game;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Work metrics use SQL aggregates; only the current reader's runs and saves enter memory. */
@Service
class CollectionMetricsService {
 private final JdbcTemplate db;
 private final JsonSupport json;
 CollectionMetricsService(JdbcTemplate db,JsonSupport json){this.db=db;this.json=json;}
 private record Save(String story,String status,String ending,Instant updated) {}
 private record Run(String id,String collection,CollectionDocument document,Instant created,List<Save> saves) {
  Instant lastPlayed(){return saves.stream().map(Save::updated).filter(Objects::nonNull).max(Comparator.naturalOrder()).filter(t->t.isAfter(created)).orElse(created);}
 }
 private record Revision(String collection,int number,CollectionDocument document) {}
 private static Instant instant(Object value){return value==null?null:value instanceof Timestamp t?t.toInstant():value instanceof OffsetDateTime t?t.toInstant():(Instant)value;}
 private static String marks(int count){return String.join(",",Collections.nCopies(count,"?"));}

 void enrich(List<Map<String,Object>> summaries,String player){
  if(summaries.isEmpty())return;
  var byId=new LinkedHashMap<String,Map<String,Object>>();for(var item:summaries)byId.put(item.get("id").toString(),item);
  Object[] ids=byId.keySet().toArray();String in=marks(ids.length);
  var documents=new HashMap<String,CollectionDocument>();
  for(var row:db.queryForList("select c.id,c.owner_player_id,c.published_at,c.published_updated_at,v.document_json from work_collections c join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision where c.id in ("+in+")",ids)){
   String id=row.get("id").toString();var item=byId.get(id);documents.put(id,json.readCollection(row.get("document_json").toString()));
   item.put("authorName","Участник #"+row.get("owner_player_id").toString().substring(0,8));
   item.put("publishedAt",instant(row.get("published_at")));item.put("updatedAt",instant(row.get("published_updated_at")));
   item.put("views",0L);item.put("rating",null);item.put("ratingCount",0L);item.put("myRating",null);
  }
  for(var row:db.queryForList("select collection_id,count(*) as total from collection_views where collection_id in ("+in+") group by collection_id",ids))byId.get(row.get("collection_id")).put("views",((Number)row.get("total")).longValue());
  var ratingArgs=new ArrayList<Object>();ratingArgs.add(player);ratingArgs.addAll(Arrays.asList(ids));
  for(var row:db.queryForList("select collection_id,avg(cast(score as decimal)) as rating,count(*) as total,max(case when player_id=? then score else null end) as own from collection_ratings where collection_id in ("+in+") group by collection_id",ratingArgs.toArray())){
   var item=byId.get(row.get("collection_id"));item.put("rating",((Number)row.get("rating")).doubleValue());item.put("ratingCount",((Number)row.get("total")).longValue());item.put("myRating",row.get("own"));
  }
  var totals=new HashMap<String,Long>();var globalRevisions=new ArrayList<Revision>();var revisions=new HashMap<String,CollectionDocument>();
  // Load one immutable document per used revision, not one document per reader/run.
  for(var row:db.queryForList("select r.collection_id,r.collection_revision,r.total,v.document_json from (select collection_id,collection_revision,count(*) as total from collection_runs where collection_id in ("+in+") group by collection_id,collection_revision) r join collection_versions v on v.collection_id=r.collection_id and v.revision=r.collection_revision",ids)){
   String collection=row.get("collection_id").toString();int number=((Number)row.get("collection_revision")).intValue();
   var doc=json.readCollection(row.get("document_json").toString());revisions.put(collection+":"+number,doc);globalRevisions.add(new Revision(collection,number,doc));totals.merge(collection,((Number)row.get("total")).longValue(),Long::sum);
  }
  var personalArgs=new ArrayList<Object>();personalArgs.add(player);personalArgs.addAll(Arrays.asList(ids));
  var runs=new ArrayList<Run>();var runById=new HashMap<String,Run>();
  if(player!=null)for(var row:db.queryForList("select r.id,r.collection_id,r.collection_revision,r.created_at,v.document_json from collection_runs r join collection_versions v on v.collection_id=r.collection_id and v.revision=r.collection_revision where r.player_id=? and r.collection_id in ("+in+")",personalArgs.toArray())){
   String version=row.get("collection_id")+":"+row.get("collection_revision");
   var doc=revisions.computeIfAbsent(version,ignored->json.readCollection(row.get("document_json").toString()));
   var run=new Run(row.get("id").toString(),row.get("collection_id").toString(),doc,instant(row.get("created_at")),new ArrayList<>());runs.add(run);runById.put(run.id(),run);
  }
  if(player!=null)for(var row:db.queryForList("select rs.run_id,rs.story_id,g.status,g.ending_scene_key,g.updated_at from collection_run_saves rs join collection_runs r on r.id=rs.run_id join game_sessions g on g.id=rs.session_id where r.player_id=? and r.collection_id in ("+in+")",personalArgs.toArray())){
   var run=runById.get(row.get("run_id"));if(run!=null)run.saves().add(new Save(row.get("story_id").toString(),row.get("status").toString(),(String)row.get("ending_scene_key"),instant(row.get("updated_at"))));
  }
  Set<String> storyIds=new HashSet<>();for(var doc:documents.values())storyIds.addAll(chapters(doc));for(var doc:revisions.values())storyIds.addAll(chapters(doc));
  var available=new HashSet<String>();var candidates=new ArrayList<>(storyIds);
  for(int start=0;start<candidates.size();start+=500){var batch=candidates.subList(start,Math.min(start+500,candidates.size()));available.addAll(db.query("select id from stories where status='PUBLISHED' and visibility='public' and published_revision is not null and id in ("+marks(batch.size())+")",(rs,n)->rs.getString(1),batch.toArray()));}
  var finalIds=documents.values().stream().filter(doc->doc.serialStory()&&"completed".equals(doc.completionStatus())).map(this::lastChapter).filter(available::contains).distinct().toList();
  var finalDocuments=new HashMap<String,StoryDocument>();
  if(!finalIds.isEmpty())for(var row:db.queryForList("select s.id,v.snapshot_json from stories s join story_versions v on v.story_id=s.id and v.version_number=s.published_revision where s.id in ("+marks(finalIds.size())+")",finalIds.toArray()))finalDocuments.put(row.get("id").toString(),json.readStory(row.get("snapshot_json").toString()));
  var finishedRuns=finishedCounts(globalRevisions,available);
  var grouped=runs.stream().collect(Collectors.groupingBy(Run::collection));
  for(var entry:byId.entrySet()){
   String id=entry.getKey();var item=entry.getValue();var doc=documents.get(id);var workRuns=grouped.getOrDefault(id,List.of());
   var latest=workRuns.stream().max(Comparator.comparing(Run::lastPlayed).thenComparing(Run::id)).orElse(null);
   var progressDoc=latest==null?doc:latest.document();var visible=chapters(progressDoc).stream().filter(available::contains).toList();
   long completed=latest==null?0:latest.saves().stream().filter(save->visible.contains(save.story())&&"FINISHED".equals(save.status())).count();
   item.put("progressBasis",doc.serialStory()?"chapters":"direct_chapters");item.put("completedCount",completed);item.put("progressTotal",visible.size());
   item.put("completionRate",visible.isEmpty()?0.0:100.0*completed/visible.size());item.put("allReleasedRead",!visible.isEmpty()&&completed==visible.size());
   item.put("lastRunId",latest==null?null:latest.id());item.put("lastPlayedAt",latest==null?null:latest.lastPlayed());item.put("totalRuns",totals.getOrDefault(id,0L));
   item.put("finishedRuns",doc.serialStory()?finishedRuns.getOrDefault(id,0L):null);
   Set<String> endings=finalEndings(doc,finalDocuments);String last=lastChapter(doc);
   var found=new HashSet<String>();if(doc.serialStory()&&last!=null)for(var run:workRuns)for(var save:run.saves())if(last.equals(save.story())&&"FINISHED".equals(save.status())&&endings.contains(save.ending()))found.add(save.ending());
   item.put("endingCount",doc.serialStory()?(long)endings.size():null);item.put("discoveredEndings",doc.serialStory()?(long)found.size():null);
  }
 }
 private List<String> chapters(CollectionDocument doc){return WorkLinksService.list(doc.items()).stream().map(CollectionDocument.Item::target).filter(Objects::nonNull).filter(t->"scenario".equals(t.kind())&&t.id()!=null).map(WorkMetadata.Target::id).distinct().toList();}
 private String lastChapter(CollectionDocument doc){var chapters=chapters(doc);return chapters.isEmpty()?null:chapters.get(chapters.size()-1);}
 private Set<String> finalEndings(CollectionDocument doc,Map<String,StoryDocument> available){
  if(!doc.serialStory()||!"completed".equals(doc.completionStatus()))return Set.of();var story=available.get(lastChapter(doc));if(story==null)return Set.of();
  return WorkLinksService.list(story.scenes()).stream().filter(scene->scene.ending()!=null&&!scene.ending().isNull()&&!scene.ending().isEmpty()).map(StoryDocument.SceneDocument::id).collect(Collectors.toSet());
 }
 private Map<String,Long> finishedCounts(List<Revision> revisions,Set<String> available){
  var result=new HashMap<String,Long>();var statements=new ArrayList<String>();var args=new ArrayList<Object>();
  for(var revision:revisions){
   if(!revision.document().serialStory()||!"completed".equals(revision.document().completionStatus()))continue;
   var expected=chapters(revision.document());if(expected.isEmpty()||!available.containsAll(expected))continue;
   // Bound both UNION size and bind count on PostgreSQL and H2, even with 500-chapter revisions.
   if(statements.size()>=64||args.size()+expected.size()+3>4000){collectFinishedCounts(statements,args,result);statements.clear();args.clear();}
   statements.add("select r.collection_id,count(*) as total from collection_runs r where r.collection_id=? and r.collection_revision=? and (select count(*) from collection_run_saves rs join game_sessions g on g.id=rs.session_id where rs.run_id=r.id and g.status='FINISHED' and rs.story_id in ("+marks(expected.size())+"))=? group by r.collection_id");
   args.add(revision.collection());args.add(revision.number());args.addAll(expected);args.add(expected.size());
  }
  collectFinishedCounts(statements,args,result);return result;
 }
 private void collectFinishedCounts(List<String> statements,List<Object> args,Map<String,Long> result){
  if(statements.isEmpty())return;
  for(var row:db.queryForList(String.join(" union all ",statements),args.toArray()))result.merge(row.get("collection_id").toString(),((Number)row.get("total")).longValue(),Long::sum);
 }
 private String lock(String id){return db.query("select id from work_collections where (id=? or collection_key=?) and published_revision is not null and visibility in ('public','unlisted') and restricted=false for update",(r,n)->r.getString(1),id,id).stream().findFirst().orElseThrow(StoryNotFoundException::new);}
 @Transactional void view(String id,String player){String work=lock(id);var day=java.sql.Date.valueOf(LocalDate.now(ZoneOffset.UTC));if(db.queryForObject("select count(*) from collection_views where collection_id=? and player_id=? and viewed_on=?",Long.class,work,player,day)==0)db.update("insert into collection_views(collection_id,player_id,viewed_on) values (?,?,?)",work,player,day);}
 @Transactional void rate(String id,String player,int score){if(score<1||score>5)throw WorkLinksService.bad("Rating must be between 1 and 5");String work=lock(id);db.update("delete from collection_ratings where collection_id=? and player_id=?",work,player);db.update("insert into collection_ratings(collection_id,player_id,score) values (?,?,?)",work,player,score);}
}
