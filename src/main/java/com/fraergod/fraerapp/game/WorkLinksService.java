package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.JsonNode;

/** Resolves stable identities and validates declarative, explicitly allowlisted transfer contracts. */
@Service
class WorkLinksService {
 private final StoryRepository stories;
 private final JdbcTemplate jdbc;
 private final JsonSupport json;
 WorkLinksService(StoryRepository stories,JdbcTemplate jdbc,JsonSupport json) {this.stories=stories;this.jdbc=jdbc;this.json=json;}
 static ResponseStatusException bad(String s) {return new ResponseStatusException(HttpStatus.BAD_REQUEST,s);}
 static ResponseStatusException conflict(String s) {return new ResponseStatusException(HttpStatus.CONFLICT,s);}
 static <T> List<T> list(List<T> values) {return values==null?List.of():values;}
 static void name(String s,String label) {
  if(s==null||!s.matches("[\\p{L}\\p{N}_-]{1,120}")||s.startsWith("__"))throw bad("Invalid "+label);
 }
 record TargetInfo(String id,String key,String kind,String type,String owner,boolean listed) {}
 final class References {
  private final Map<String,TargetInfo> identities=new HashMap<>(),keys=new HashMap<>();
  private void add(TargetInfo t){identities.put(t.kind()+":"+t.id(),t);keys.put(t.kind()+":"+t.key(),t);}
  TargetInfo info(WorkMetadata.Target t){return t.id()==null?keys.get(t.kind()+":"+t.key()):identities.get(t.kind()+":"+t.id());}
  WorkMetadata.Target resolve(WorkMetadata.Target t,String owner,boolean strict){
   if(t==null||t.kind()==null||!List.of("scenario","collection").contains(t.kind()))throw bad("Target kind must be scenario or collection");
   var found=info(t);
   if(found!=null&&owner!=null&&!Objects.equals(owner,found.owner()))throw bad("Only your own works can be linked");
   if(found==null||(!(owner!=null&&Objects.equals(owner,found.owner()))&&!found.listed())){
    if(strict)throw bad("A target is missing or unavailable");if(t.key()==null||t.key().isBlank())throw bad("Unresolved target requires a portable key");return new WorkMetadata.Target(t.kind(),null,t.key());
   }return new WorkMetadata.Target(found.kind(),found.id(),found.key());
  }
 }
 References references(List<WorkMetadata.Target> targets){
  var ref=new References();var ids=new HashSet<String>();var keys=new HashSet<String>();var collectionIds=new HashSet<String>();var collectionKeys=new HashSet<String>();
  for(var t:targets){if(t==null)throw bad("Target is required");if("scenario".equals(t.kind())){if(t.id()!=null)ids.add(t.id());else if(t.key()!=null)keys.add(t.key());}else if("collection".equals(t.kind())){if(t.id()!=null)collectionIds.add(t.id());else if(t.key()!=null)collectionKeys.add(t.key());}else throw bad("Invalid target kind");}
  var scenarioRows=new ArrayList<Story>();if(!ids.isEmpty())scenarioRows.addAll(stories.findAllById(ids));if(!keys.isEmpty())scenarioRows.addAll(stories.findByKeyIn(keys));
  for(var s:scenarioRows)ref.add(new TargetInfo(s.getId(),s.getKey(),"scenario","scenario",s.getOwnerPlayerId(),StoryAccessService.listed(s)));
  if(!collectionIds.isEmpty()||!collectionKeys.isEmpty()){
   var args=new ArrayList<Object>();var predicates=new ArrayList<String>();if(!collectionIds.isEmpty()){predicates.add("id in ("+String.join(",",Collections.nCopies(collectionIds.size(),"?"))+")");args.addAll(collectionIds);}if(!collectionKeys.isEmpty()){predicates.add("collection_key in ("+String.join(",",Collections.nCopies(collectionKeys.size(),"?"))+")");args.addAll(collectionKeys);}
   jdbc.query("select id,collection_key,collection_type,owner_player_id,visibility,published_revision from work_collections where "+String.join(" or ",predicates),rs->{ref.add(new TargetInfo(rs.getString("id"),rs.getString("collection_key"),"collection",rs.getString("collection_type"),rs.getString("owner_player_id"),"public".equals(rs.getString("visibility"))&&rs.getObject("published_revision")!=null));},args.toArray());
  }return ref;
 }
 WorkMetadata.Target resolve(WorkMetadata.Target t,String owner,boolean strict) {
  if(t==null||t.kind()==null||!List.of("scenario","collection").contains(t.kind()))throw bad("Target kind must be scenario or collection");
  String id=null,key=null,targetOwner=null,visibility=null;
  if("scenario".equals(t.kind())) {
   Story s=t.id()!=null?stories.findById(t.id()).orElse(null):stories.findByKey(t.key()==null?"":t.key()).orElse(null);
   if(s!=null){id=s.getId();key=s.getKey();targetOwner=s.getOwnerPlayerId();visibility=StoryAccessService.listed(s)?"public":"private";}
  } else {
   var rows=jdbc.queryForList("select id,collection_key,owner_player_id,visibility,published_revision from work_collections where "+(t.id()!=null?"id":"collection_key")+"=?",t.id()!=null?t.id():t.key());
   if(!rows.isEmpty()){var r=rows.get(0);id=(String)r.get("id");key=(String)r.get("collection_key");targetOwner=(String)r.get("owner_player_id");visibility=r.get("published_revision")==null?"private":(String)r.get("visibility");}
  }
  if(id!=null&&owner!=null&&!Objects.equals(owner,targetOwner))throw bad("Only your own works can be linked");
  if(id==null||(!(owner!=null&&Objects.equals(owner,targetOwner))&&!"public".equals(visibility))) {
   if(strict)throw bad("A target is missing or unavailable");
   if(t.key()==null||t.key().isBlank())throw bad("Unresolved target requires a portable key");
   return new WorkMetadata.Target(t.kind(),null,t.key());
  }
  return new WorkMetadata.Target(t.kind(),id,key);
 }
 StoryDocument normalize(StoryDocument d,String owner,boolean strict) {
  WorkMetadata m=d.metadata();if(m==null)return d;
  if(m.schemaVersion()!=null&&m.schemaVersion()!=1)throw bad("Unsupported metadata schema version");
  validateContract(m.inputContract(),d);
  Set<String> ids=new HashSet<>();List<WorkMetadata.Relation> relations=new ArrayList<>();
  if(list(m.relations()).size()>100)throw bad("At most 100 relations are allowed");
  var targets=references(list(m.relations()).stream().map(WorkMetadata.Relation::target).toList());
  for(var r:list(m.relations())) {
   name(r.id(),"relation id");if(!ids.add(r.id()))throw bad("Duplicate relation id");
   if(r.type()==null||!List.of("prequel","sequel","branch","related").contains(r.type()))throw bad("Invalid relation type");
   var t=targets.resolve(r.target(),owner,strict);validateTransfer(r.stateTransfer());
   if(r.stateTransfer()!=null&&"mapped".equals(r.stateTransfer().mode())&&!"scenario".equals(t.kind()))throw bad("State transfer requires a scenario target");
   if(strict&&r.stateTransfer()!=null&&"mapped".equals(r.stateTransfer().mode()))validateMapping(d,targetDocument(t,owner),r.stateTransfer());
   relations.add(new WorkMetadata.Relation(r.id(),r.type(),t,r.label(),r.stateTransfer()));
  }
  return new StoryDocument(d.key(),d.title(),d.description(),d.genre(),d.completionStatus(),d.version(),d.startSceneId(),d.variables(),d.assets(),d.scenes(),new WorkMetadata(1,relations,m.inputContract()),d.topic());
 }
 StoryDocument targetDocument(WorkMetadata.Target t,String owner) {
  if(!"scenario".equals(t.kind()))throw bad("Scenario required");
  var s=stories.findById(t.id()).orElseThrow(StoryNotFoundException::new);
  String body;
  if(owner!=null&&Objects.equals(owner,s.getOwnerPlayerId()))body=jdbc.queryForObject("select draft_json from story_workspaces where story_id=?",String.class,s.getId());
  else if(StoryAccessService.listed(s))body=jdbc.queryForObject("select snapshot_json from story_versions where story_id=? and version_number=?",String.class,s.getId(),s.getPublishedRevision());
  else throw bad("Target unavailable");
  return json.readStory(body);
 }
 void validateTransfer(WorkMetadata.Transfer p) {
  if(p==null)return;
  if(p.mode()==null||!List.of("independent","mapped").contains(p.mode()))throw bad("Transfer mode must be independent or mapped");
  if("independent".equals(p.mode())){if(!list(p.mapping()).isEmpty())throw bad("Independent links cannot map parameters");return;}
  if(p.contractVersion()==null||p.contractVersion()<1)throw bad("Mapped transfer requires a contract version");
  if(list(p.mapping()).isEmpty()||list(p.mapping()).size()>100)throw bad("Mapped transfer needs 1–100 parameters");
  Set<String> targets=new HashSet<>();
  for(var m:list(p.mapping())){name(m.from(),"source parameter");name(m.to(),"target parameter");type(m.type());if(!targets.add(m.to()))throw bad("Duplicate target parameter");}
 }
 void validateContract(WorkMetadata.InputContract c,StoryDocument d) {
  if(c==null)return;
  if(c.version()==null||c.version()<1)throw bad("Input contract version is required");
  if(c.allowIndependentStart()==null)throw bad("Input contract must explicitly allow or disallow independent starts");
  if(list(c.fields()).size()>100||(!Boolean.TRUE.equals(c.allowIndependentStart())&&list(c.fields()).isEmpty()))throw bad("A required transfer contract needs 1–100 fields");
  Set<String> names=new HashSet<>();
  for(var f:list(c.fields())) {
   name(f.name(),"input field");type(f.type());if(!names.add(f.name()))throw bad("Duplicate contract field");
   if(d.variables()==null||!d.variables().containsKey(f.name()))throw bad("Input field must be a global scenario variable: "+f.name());
   if((f.min()!=null&&!Double.isFinite(f.min()))||(f.max()!=null&&!Double.isFinite(f.max()))||(f.min()!=null&&f.max()!=null&&f.min()>f.max()))throw bad("Invalid parameter bounds");
   if(f.defaultValue()!=null&&!f.defaultValue().isNull())checkValue(f,f.defaultValue());
   if(Boolean.TRUE.equals(c.allowIndependentStart())||!Boolean.TRUE.equals(f.required()))checkValue(f,defaultNode(d,f));
  }
 }
 private void type(String t){if(t==null||!List.of("number","boolean","string").contains(t))throw bad("Supported parameter types: number, boolean, string");}
 JsonNode defaultNode(StoryDocument d,WorkMetadata.Field f) {
  if(f.defaultValue()!=null&&!f.defaultValue().isNull())return f.defaultValue();
  JsonNode n=d.variables()==null?null:d.variables().get(f.name());return n!=null&&n.isObject()?n.get("value"):n;
 }
 void checkValue(WorkMetadata.Field f,JsonNode n) {
  if(n==null||n.isNull())throw conflict("Missing input parameter: "+f.name());
  boolean valid=switch(f.type()){case "number"->n.isNumber()&&Double.isFinite(n.asDouble());case "boolean"->n.isBoolean();case "string"->n.isTextual();default->false;};
  if(!valid)throw conflict("Incompatible parameter type: "+f.name());
  if(n.isNumber()&&((f.min()!=null&&n.asDouble()<f.min())||(f.max()!=null&&n.asDouble()>f.max())))throw conflict("Parameter outside allowed bounds: "+f.name());
  if(!list(f.allowedValues()).isEmpty()&&!f.allowedValues().contains(n))throw conflict("Parameter outside allowed values: "+f.name());
 }
 void validateMapping(StoryDocument source,StoryDocument target,WorkMetadata.Transfer p) {
  validateTransfer(p);if(p==null||!"mapped".equals(p.mode()))return;
  var c=target.metadata()==null?null:target.metadata().inputContract();
  if(c==null||!Objects.equals(p.contractVersion(),c.version()))throw conflict("Target input contract version is incompatible");
  var fields=new HashMap<String,WorkMetadata.Field>();for(var f:list(c.fields()))fields.put(f.name(),f);
  for(var m:list(p.mapping())) {
   var f=fields.get(m.to());
   if(f==null||!m.type().equals(f.type()))throw conflict("Target does not accept parameter: "+m.to());
   if(source==null||source.variables()==null||!source.variables().containsKey(m.from()))throw conflict("Only declared global source variables can be transferred: "+m.from());
   JsonNode declared=source.variables().get(m.from());if(declared!=null&&declared.isObject())declared=declared.get("value");
   boolean compatible=declared!=null&&switch(m.type()){case "number"->declared.isNumber();case "boolean"->declared.isBoolean();case "string"->declared.isTextual();default->false;};
   if(!compatible)throw conflict("Source parameter type does not match mapping: "+m.from());
  }
  for(var f:list(c.fields()))if(Boolean.TRUE.equals(f.required())&&list(p.mapping()).stream().noneMatch(m->m.to().equals(f.name())))throw conflict("Required parameter is not mapped: "+f.name());
 }
 Map<String,Object> transfer(StoryDocument source,StoryDocument target,WorkMetadata.Transfer p,Map<String,Object> sourceValues) {
  var c=target.metadata()==null?null:target.metadata().inputContract();
  Map<String,Object> result=new LinkedHashMap<>();
  if(p==null||"independent".equals(p.mode())) {
   if(c!=null&&!Boolean.TRUE.equals(c.allowIndependentStart()))throw conflict("This chapter requires a completed source save");
   if(c!=null)for(var f:list(c.fields())){var n=defaultNode(target,f);checkValue(f,n);result.put(f.name(),json.readObject(json.write(n)));}
   return result;
  }
  validateMapping(source,target,p);
  Map<String,WorkMetadata.Mapping> mapping=new HashMap<>();for(var m:list(p.mapping()))mapping.put(m.to(),m);
  for(var f:list(c.fields())) {
   var m=mapping.get(f.name());Object raw=m==null?null:sourceValues.get(m.from());
   JsonNode n=raw==null?null:json.valueToNode(raw);
   if(n==null||n.isNull()){if(Boolean.TRUE.equals(f.required()))throw conflict("Missing required source value: "+f.name());n=defaultNode(target,f);}
   checkValue(f,n);result.put(f.name(),json.readObject(json.write(n)));
  }
  return result;
 }
}
