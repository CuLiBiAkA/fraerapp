package com.fraergod.fraerapp.game;

import java.net.URI;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
class AuthorProfileService {
 private final JdbcTemplate db;
 private final ObjectMapper json;
 private final StoryAccessService access;
 AuthorProfileService(JdbcTemplate db,StoryAccessService access){this.db=db;this.access=access;this.json=new ObjectMapper();}
 record Link(String label,String url){}
 record Profile(String id,String nickname,String biography,String avatar,List<Link> links){}
 Profile get(String id){
  return db.query("select * from author_profiles where player_id=?",(r,n)->new Profile(id,r.getString("nickname"),r.getString("biography"),r.getString("avatar"),links(r.getString("links_json"))),id)
   .stream().findFirst().orElse(new Profile(id,"","","",List.of()));
 }
 private List<Link> links(String value){try{return Arrays.asList(json.readValue(value,Link[].class));}catch(Exception e){throw new IllegalStateException(e);}}
 String name(String id){String name=get(id).nickname();return name.isBlank()?"Автор":name;}
 private String text(String value,int max){String result=value==null?"":value.strip();if(result.length()>max)throw WorkLinksService.bad("Profile field is too long");return result;}
 @Transactional Profile save(String id,Profile input){
  String nick=text(input.nickname(),60),bio=text(input.biography(),1200),avatar=text(input.avatar(),500);
  if(!avatar.isEmpty()&&!avatar.matches("/api/authors/"+java.util.regex.Pattern.quote(id)+"/avatar/[a-zA-Z0-9-]+\\.(png|jpg|webp|gif)"))throw WorkLinksService.bad("Invalid avatar");
  List<Link> links=new ArrayList<>();
  if(input.links()!=null){if(input.links().size()>5)throw WorkLinksService.bad("Too many links");for(Link link:input.links()){
   if(link==null)throw WorkLinksService.bad("Invalid link");
   String label=text(link.label(),40),url=text(link.url(),500);
   try{URI uri=URI.create(url);if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new IllegalArgumentException();}catch(Exception e){throw WorkLinksService.bad("Use an https link");}
   links.add(new Link(label.isEmpty()?URI.create(url).getHost():label,url));
  }}
  String encoded;try{encoded=json.writeValueAsString(links);}catch(Exception e){throw new IllegalStateException(e);}
  db.update("insert into author_profiles(player_id) values (?) on conflict do nothing",id);
  db.update("update author_profiles set nickname=?,biography=?,avatar=?,links_json=? where player_id=?",nick,bio,avatar,encoded,id);
  return get(id);
 }
 List<Map<String,Object>> works(String id,boolean guest){
  List<Map<String,Object>> result=new ArrayList<>();
  if(!guest)for(var row:db.queryForList("select c.collection_key,c.published_title,v.document_json from work_collections c join collection_versions v on v.collection_id=c.id and v.revision=c.published_revision where c.owner_player_id=? and c.visibility='public' and c.restricted=false order by c.published_updated_at desc",id)){
   try{result.add(Map.of("title",row.get("published_title"),"url","/collections/"+row.get("collection_key"),"coverUrl",json.readTree(row.get("document_json").toString()).path("coverUrl").asText("")));}catch(Exception e){throw new IllegalStateException(e);}
  }
  for(var row:db.queryForList("select s.id,s.story_key,v.snapshot_json,s.published_slug from stories s join story_versions v on v.story_id=s.id and v.version_number=s.published_revision where s.owner_player_id=? and s.status='PUBLISHED' and s.visibility='public' and s.published_revision is not null and not exists(select 1 from collection_memberships m join work_collections c on c.id=m.parent_id where m.target_kind='scenario' and m.target_id=s.id and m.in_published=true and c.visibility='public' and c.restricted=false and c.published_revision is not null) order by s.published_at desc",id)){
   if(!access.parentAllowsReading(row.get("id").toString()))continue;
   if(guest&&!GuestDemoStories.includes(row.get("story_key").toString()))continue;
   try{var snapshot=json.readTree(row.get("snapshot_json").toString());result.add(Map.of("title",snapshot.path("title").asText(),"url","/history/"+row.get("published_slug"),"coverUrl",snapshot.path("metadata").path("coverUrl").asText("")));}catch(Exception e){throw new IllegalStateException(e);}
  }
  return result;
 }
 Map<String,Object> publicProfile(String id,String reader,boolean guest){
  var works=works(id,guest);if(works.isEmpty()&&!Objects.equals(id,reader))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  return Map.of("profile",get(id),"works",works,"favorite",reader!=null&&db.queryForObject("select count(*) from author_favorites where reader_id=? and author_id=?",Integer.class,reader,id)>0);
 }
 @Transactional void favorite(String author,String reader,boolean favorite){
  publicProfile(author,reader,false);
  if(favorite)db.update("insert into author_favorites(reader_id,author_id) values (?,?) on conflict do nothing",reader,author);
  else db.update("delete from author_favorites where reader_id=? and author_id=?",reader,author);
 }
}
