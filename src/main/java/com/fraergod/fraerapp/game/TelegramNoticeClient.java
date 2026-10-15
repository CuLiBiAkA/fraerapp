package com.fraergod.fraerapp.game;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

interface TelegramNoticeClient {
 record Result(String status,long retryAfter) {}
 Result send(String id,String userId,String message);
}

@Component
@ConditionalOnProperty(name="app.telegram.notifications-enabled",havingValue="true")
class AuthTelegramNoticeClient implements TelegramNoticeClient {
 private final URI endpoint;
 private final String secret;
 private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
 private final ObjectMapper json=new ObjectMapper();
 AuthTelegramNoticeClient(@Value("${app.telegram.notification-url}") String endpoint,@Value("${app.telegram.notification-secret:}") String secret) {
  if(secret.length()<32) throw new IllegalArgumentException("Telegram notification service secret must contain at least 32 characters");
  this.endpoint=URI.create(endpoint);this.secret=secret;
 }
 public Result send(String id,String userId,String message) {
  try {
   var request=HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(12))
    .header("X-Notification-Secret",secret).header("Content-Type","application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("id",id,"userId",userId,"message",message)))).build();
   var response=client.send(request,HttpResponse.BodyHandlers.ofString());
   if(response.statusCode()!=200) return new Result("retry",30);
   var body=json.readTree(response.body());
   return new Result(body.path("status").asText("retry"),Math.max(0,body.path("retryAfter").asLong(30)));
  } catch(InterruptedException ex) { Thread.currentThread().interrupt();return new Result("retry",30); }
  catch(Exception ex) { return new Result("retry",30); }
 }
}
