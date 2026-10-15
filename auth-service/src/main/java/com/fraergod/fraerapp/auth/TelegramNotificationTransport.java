package com.fraergod.fraerapp.auth;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

interface TelegramNotificationTransport {
 record Result(String status,long retryAfter) {}
 Result send(long chatId,String text);
}

@Component
@ConditionalOnProperty(name="auth.telegram.notifications-enabled",havingValue="true")
class TelegramHttpNotificationTransport implements TelegramNotificationTransport {
 private final URI endpoint;
 private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
 private final ObjectMapper json=new ObjectMapper();
 @org.springframework.beans.factory.annotation.Autowired
 TelegramHttpNotificationTransport(@Value("${auth.telegram.bot-token:}") String token) {
  if(token.isBlank()) throw new IllegalArgumentException("Telegram bot token is required for notification delivery");
  endpoint=URI.create("https://api.telegram.org/bot"+token+"/sendMessage");
 }
 // Package-private test seam: tests use a local HTTP server, never a real bot.
 TelegramHttpNotificationTransport(URI endpoint) { this.endpoint=endpoint; }
 public Result send(long chatId,String text) {
  try {
   var request=HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(7)).header("Content-Type","application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("chat_id",chatId,"text",text,"disable_web_page_preview",true)))).build();
   var response=client.send(request,HttpResponse.BodyHandlers.ofString());
   var body=json.readTree(response.body());
   if(response.statusCode()==200 && body.path("ok").asBoolean(false)) return new Result("sent",0);
   int code=body.path("error_code").asInt(response.statusCode());
   // Forbidden means the user blocked the bot; an invalid chat is also terminal.
   if(code==403 || (code==400 && body.path("description").asText().contains("chat not found"))) return new Result("skipped",0);
   return new Result("retry",Math.max(30,body.path("parameters").path("retry_after").asLong(30)));
  } catch(InterruptedException ex) {
   Thread.currentThread().interrupt(); return new Result("retry",30);
  } catch(Exception ex) {
   // Exceptions can include the token-bearing request URI: never log them.
   return new Result("retry",30);
  }
 }
}
