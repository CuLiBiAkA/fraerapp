package com.fraergod.fraerapp.game;

import static org.assertj.core.api.Assertions.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

class CurrentSessionClientTests {
 private HttpServer peer;
 private final AtomicInteger status=new AtomicInteger(200);
 private final AtomicInteger requests=new AtomicInteger();
 private final AtomicReference<String> body=new AtomicReference<>("{\"id\":\"user\",\"email\":\"user@example.test\",\"roles\":[\"player\"],\"sessionId\":\"active-session\",\"blocked\":false}");
 private final AuthIdentity signed=new AuthIdentity("user","user@example.test",List.of("admin","author","player"));
 private CurrentSessionClient client;
 @BeforeEach void setup() throws Exception {
  peer=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  peer.createContext("/auth/me",exchange->{
   requests.incrementAndGet();byte[] bytes=body.get().getBytes(StandardCharsets.UTF_8);
   exchange.sendResponseHeaders(status.get(),bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
  });peer.start();client=new CurrentSessionClient("http://127.0.0.1:"+peer.getAddress().getPort()+"/auth/me");newRequest();
 }
 private void newRequest() {
  var request=new MockHttpServletRequest();request.addHeader("Authorization","Bearer test-only");
  RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
 }
 @AfterEach void close() {RequestContextHolder.resetRequestAttributes();AuthContext.clear();peer.stop(0);}
 @Test void staleJwtRolesAreReplacedAndCacheDoesNotCrossRequests() {
  assertThat(client.current(signed).roles()).containsExactly("player");
  assertThat(client.current(signed).roles()).doesNotContain("admin");assertThat(requests.get()).isEqualTo(1);
  newRequest();status.set(401);
  assertThatThrownBy(()->client.current(signed)).isInstanceOf(AuthRequiredException.class);
  assertThat(requests.get()).isEqualTo(2);
 }
 @Test void missingWrongOrBlockedIdentityAndMissingSessionFailClosed() {
  for(String response:List.of("{\"id\":\"different\",\"roles\":[\"admin\"],\"sessionId\":\"s\"}",
     "{\"id\":\"user\",\"roles\":[\"admin\"],\"blocked\":true,\"sessionId\":\"s\"}",
     "{\"id\":\"user\",\"roles\":[\"admin\"]}")) {
   body.set(response);newRequest();assertThatThrownBy(()->client.current(signed)).isInstanceOf(AuthRequiredException.class);
  }
 }
 @Test void unavailableAuthServiceNeverFallsBackToSignedRoles() {
  status.set(503);
  assertThatThrownBy(()->client.current(signed)).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(503));
  assertThatThrownBy(()->new CurrentSessionClient("")).isInstanceOf(IllegalArgumentException.class);
  status.set(200);body.set("invalid");newRequest();
  assertThatThrownBy(()->client.current(signed)).isInstanceOf(ResponseStatusException.class);
 }
 @Test void subscriptionUsesLiveAuthAndMissingEntitlementStaysUnknown(){
  assertThat(client.current(signed).subscriptionActive()).isNull();
  body.set(body.get().replace("\"blocked\":false","\"blocked\":false,\"subscriptionActive\":true"));newRequest();
  assertThat(client.current(signed).subscriptionActive()).isTrue();
  body.set(body.get().replace("\"subscriptionActive\":true","\"subscriptionActive\":false"));newRequest();
  assertThat(client.current(signed).subscriptionActive()).isFalse();
 }
}
