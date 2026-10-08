package com.fraergod.fraerapp.game;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Internal, dismissible ad delivery; counters follow gameplay, never page renders. */
@Service
class ReaderAdService {
 private final JdbcTemplate jdbc;
 ReaderAdService(JdbcTemplate jdbc){this.jdbc=jdbc;}
 record Settings(boolean enabled,int intervalScenes,String title,String body,String linkUrl,String buttonLabel,int version,String updatedBy,Instant updatedAt){}
 record Update(boolean enabled,int intervalScenes,String title,String body,String linkUrl,String buttonLabel,int version){}
 record Offer(String id){}
 record Creative(String id,String title,String body,String linkUrl,String buttonLabel){}
 record Delivery(Creative ad){}
 private record Progress(int transitions,String pending,int version){}
 Settings settings(){return jdbc.queryForObject("select * from reader_ad_settings where id=1",(r,n)->new Settings(r.getBoolean("enabled"),r.getInt("interval_scenes"),r.getString("title"),r.getString("body"),r.getString("link_url"),r.getString("button_label"),r.getInt("version"),r.getString("updated_by"),r.getTimestamp("updated_at").toInstant()));}
 private Progress progress(String player){return jdbc.query("select * from reader_ad_progress where player_id=?",(r,n)->new Progress(r.getInt("transitions"),r.getString("pending_id"),r.getInt("settings_version")),player).stream().findFirst().orElse(null);}
 private boolean eligible(){return AuthContext.current().map(identity->Boolean.FALSE.equals(identity.subscriptionActive())).orElse(false);}
 // Called only after a successful choice while GameService holds the reader lock.
 void transition(String player,boolean ending){
  Settings s=settings();Progress p=progress(player);int count=0;String pending=null;
  if(s.enabled()&&eligible()){
   if(p!=null&&p.version()==s.version()){count=p.transitions();pending=p.pending();}
   if(pending==null){count=Math.min(s.intervalScenes(),count+1);if(count>=s.intervalScenes()&&!ending){pending=UUID.randomUUID().toString();count=0;}}
  }
  if(p==null)jdbc.update("insert into reader_ad_progress(player_id,transitions,pending_id,settings_version) values (?,?,?,?)",player,count,pending,s.version());
  else jdbc.update("update reader_ad_progress set transitions=?,pending_id=?,settings_version=? where player_id=?",count,pending,s.version(),player);
 }
 Offer offer(String player,boolean ending){
  if(ending||!eligible())return null;Settings s=settings();if(!s.enabled())return null;Progress p=progress(player);
  return p!=null&&p.version()==s.version()&&p.pending()!=null?new Offer(p.pending()):null;
 }
 @Transactional
 Delivery claim(String player,String id){
  jdbc.queryForObject("select id from players where id=? for update",String.class,player);
  Settings s=settings();Progress p=progress(player);
  if(!eligible()||!s.enabled()||(p!=null&&p.version()!=s.version())){
   jdbc.update("update reader_ad_progress set transitions=0,pending_id=null,settings_version=? where player_id=?",s.version(),player);return new Delivery(null);
  }
  if(p==null||id==null||!id.equals(p.pending()))return new Delivery(null);
  jdbc.update("update reader_ad_progress set pending_id=null,transitions=0 where player_id=?",player);
  return new Delivery(new Creative(id,s.title(),s.body(),s.linkUrl(),s.buttonLabel()));
 }
 @Transactional
 Settings save(Update value,AuthIdentity actor){
  if(value.intervalScenes()<1||value.intervalScenes()>100)throw bad("Ad interval must be between 1 and 100");
  String title=text(value.title(),100),body=text(value.body(),600),url=text(value.linkUrl(),2000),label=text(value.buttonLabel(),60);
  if(!url.isEmpty()&&!safeUrl(url))throw bad("Use an HTTPS URL or a same-site path");
  int updated=jdbc.update("update reader_ad_settings set enabled=?,interval_scenes=?,title=?,body=?,link_url=?,button_label=?,version=version+1,updated_by=?,updated_at=current_timestamp where id=1 and version=?",value.enabled(),value.intervalScenes(),title,body,url,label,actor.email(),value.version());
  if(updated==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Advertising settings changed; reload before saving");return settings();
 }
 private String text(String value,int limit){String result=value==null?"":value.trim();if(result.length()>limit)throw bad("Advertising text is too long");return result;}
 private boolean safeUrl(String value){
  if(value.indexOf('\\')>=0||value.chars().anyMatch(c->c<32||c==127))return false;
  try{URI uri=URI.create(value);return value.startsWith("/")&&!value.startsWith("//")&&uri.getRawAuthority()==null||"https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null;}catch(IllegalArgumentException invalid){return false;}
 }
 private ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
