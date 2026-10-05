package com.fraergod.fraerapp;

import java.net.*;
import java.net.http.*;
import java.util.*;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Test-only auth peer. Production always verifies sessions through the auth service. */
abstract class ApiTestSupport {
 private static final ObjectMapper JSON=new ObjectMapper();
 private static final HttpServer AUTH=startAuth();
 @DynamicPropertySource static void authentication(DynamicPropertyRegistry registry) {
  registry.add("app.auth.session-check-url",()->"http://127.0.0.1:"+AUTH.getAddress().getPort()+"/auth/me");
 }
 private static HttpServer startAuth() {
  try {
   HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
   server.createContext("/auth/me",exchange->{
    try {
     String token=exchange.getRequestHeaders().getFirst("Authorization").substring(7);
     Map<?,?> claims=JSON.readValue(Base64.getUrlDecoder().decode(token.split("\\.")[1]),Map.class);
     byte[] body=JSON.writeValueAsBytes(Map.of("id",claims.get("sub"),"email",claims.get("email"),
       "roles",claims.get("roles"),"sessionId",claims.get("sid"),"blocked",false));
     exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);
     exchange.getResponseBody().write(body);
    }catch(Exception ex){exchange.sendResponseHeaders(401,-1);}finally{exchange.close();}
   });server.start();return server;
  }catch(Exception ex){throw new IllegalStateException(ex);}
 }
 protected static HttpResponse<String> api(int port,String method,String path,String body,String token) {
  try {
   var req=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Accept","application/json");
   if(token!=null)req.header("Authorization","Bearer "+token);
   if(body!=null)req.header("Content-Type","application/json");
   return HttpClient.newHttpClient().send(req.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
  }catch(Exception ex){throw new IllegalStateException(ex);}
 }
 protected static Map<String,Object> object(String body) {
  try{return JSON.readValue(body,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});}
  catch(Exception ex){throw new IllegalStateException(body,ex);}
 }
 protected static String body(Object body) {
  try{return JSON.writeValueAsString(body);}catch(Exception ex){throw new IllegalStateException(ex);}
 }
 protected static HttpResponse<String> approveAndPublish(int port,String id,String author) {
  String reviewer=TestJwtFactory.admin("independent-reviewer@example.test");
  var detail=api(port,"GET","/api/moderation/stories/"+id,null,reviewer);
  org.assertj.core.api.Assertions.assertThat(detail.statusCode()).as(detail.body()).isEqualTo(200);
  Map<String,Object> current=object(detail.body());
  if(Objects.equals(current.get("publishedRevision"),current.get("draftRevision")))return detail;
  if(!"in_review".equals(current.get("reviewState"))||!Objects.equals(current.get("submittedRevision"),current.get("draftRevision"))) {
   var submitted=api(port,"POST","/api/"+(author==null?"admin":"author")+"/stories/"+id+"/review",
    body(Map.of("generation",current.get("generation"),"replaceReview",true)),author==null?reviewer:author);
   org.assertj.core.api.Assertions.assertThat(submitted.statusCode()).as(submitted.body()).isEqualTo(200);
   current=object(submitted.body());
  }
  return api(port,"POST","/api/moderation/stories/"+id+"/approve-publish",
    body(Map.of("generation",current.get("generation"),"revision",current.get("submittedRevision"),"visibility","public")),reviewer);
 }
 protected static void approveSeed(int port) {
  String reviewer=TestJwtFactory.admin("independent-reviewer@example.test");
  Map<String,Object> page=object(api(port,"GET","/api/moderation/stories?size=100",null,reviewer).body());
  for(Object row:(List<?>)page.get("items")) {
   Map<?,?> s=(Map<?,?>)row;
   if("night_train".equals(s.get("key"))&&s.get("publishedRevision")==null) {
    var response=approveAndPublish(port,s.get("storyId").toString(),null);
    org.assertj.core.api.Assertions.assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
   }
  }
 }
}
