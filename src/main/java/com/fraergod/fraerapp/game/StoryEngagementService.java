package com.fraergod.fraerapp.game;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class StoryEngagementService {
 private final JdbcTemplate jdbc;
 private final JsonSupport json;
 private final StoryAccessService access;
 StoryEngagementService(JdbcTemplate jdbc, JsonSupport json,StoryAccessService access) { this.jdbc = jdbc; this.json = json;this.access=access; }

 record Metrics(String slug, String genre, long views, Double rating, long ratingCount, boolean favorite, Integer myRating, long endingCount, String completionStatus, long discoveredEndings) {}

 @Transactional(readOnly = true)
 List<Metrics> catalog(String userId) {return metrics(userId,null);}
 @Transactional(readOnly=true)
 Metrics detail(String slug,String userId) {return metrics(userId,slug).stream().findFirst().orElseThrow(StoryNotFoundException::new);}
 private List<Metrics> metrics(String userId,String slug) {
  var blocked=access.restrictedSerialChapterIds();
  return jdbc.query("""
   select s.published_slug, s.genre,
     (select count(*) from story_views v where v.story_id=s.id) as views,
     (select avg(cast(r.score as decimal)) from story_ratings r where r.story_id=s.id) as rating,
     (select count(*) from story_ratings r where r.story_id=s.id) as rating_count,
     (select count(*) from story_favorites f where f.story_id=s.id and f.user_id=?) as favorite,
     (select r.score from story_ratings r where r.story_id=s.id and r.user_id=?) as my_rating,
     s.id, s.completion_status,
     (select count(*) from reader_endings e join players p on p.id=e.player_id
       join scenes sc on sc.story_id=e.story_id and sc.scene_key=e.scene_key
       where e.story_id=s.id and p.user_id=? and sc.ending_json <> '{}' and sc.ending_json <> 'null') as discovered_endings
   from stories s where s.status='PUBLISHED' and s.visibility in ('public','unlisted') and s.published_revision is not null and s.published_slug is not null
   and ((cast(? as varchar) is null and s.visibility='public') or s.published_slug=?)
   and (cast(? as varchar) is not null or s.story_key in ('kak_shodit_v_tualet_pravilno','kak_pogladit_kota_ne_ubiv','night_train'))
   """, (rs, row) -> blocked.contains(rs.getString(8))?null:new Metrics(rs.getString(1), rs.getString(2), rs.getLong(3),
     rs.getObject(4) == null ? null : rs.getDouble(4), rs.getLong(5), rs.getLong(6)>0,
     rs.getObject(7) == null ? null : rs.getInt(7), endingCount(rs.getString(8)), rs.getString(9), rs.getLong(10)), userId, userId, userId, slug, slug, userId).stream().filter(java.util.Objects::nonNull).toList();
 }

 private long endingCount(String storyId) {
  return jdbc.query("select ending_json from scenes where story_id=?", (rs, row) -> rs.getString(1), storyId)
    .stream().filter(ending -> json.readObject(ending) != null).count();
 }

 // Lock one published story so simultaneous retries remain idempotent on both PostgreSQL and H2.
 private String lockStory(String slug) {
  String id=jdbc.query("select id from stories where published_slug=? and status='PUBLISHED' and visibility in ('public','unlisted') and published_revision is not null for update",
    (rs, row) -> rs.getString(1), slug).stream().findFirst().orElseThrow(StoryNotFoundException::new);
  if(!access.parentAllowsReading(id))throw new StoryNotFoundException();return id;
 }

 @Transactional
 void view(String slug, String viewer) {
  String id = lockStory(slug);
  if(viewer.startsWith("guest:")&&!GuestDemoStories.includes(jdbc.queryForObject("select story_key from stories where id=?",String.class,id)))throw new AuthRequiredException();
  LocalDate today = LocalDate.now(ZoneOffset.UTC);
  if (jdbc.queryForObject("select count(*) from story_views where story_id=? and viewer_key=? and viewed_on=?", Long.class, id, viewer, today)==0) {
   jdbc.update("insert into story_views(story_id,viewer_key,viewed_on) values (?,?,?)", id, viewer, today);
  }
 }

 @Transactional
 void favorite(String slug, String userId, boolean selected) {
  String id = lockStory(slug);
  jdbc.update("delete from story_favorites where story_id=? and user_id=?", id, userId);
  if (selected) jdbc.update("insert into story_favorites(story_id,user_id) values (?,?)", id, userId);
 }

 @Transactional
 void rate(String slug, String userId, int score) {
  if (score < 1 || score > 5) throw new IllegalArgumentException("Rating must be between 1 and 5");
  String id = lockStory(slug);
  jdbc.update("delete from story_ratings where story_id=? and user_id=?", id, userId);
  jdbc.update("insert into story_ratings(story_id,user_id,score) values (?,?,?)", id, userId, score);
 }
}
