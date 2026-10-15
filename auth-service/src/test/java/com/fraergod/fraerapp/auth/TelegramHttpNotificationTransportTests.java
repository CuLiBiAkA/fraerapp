package com.fraergod.fraerapp.auth;

import static org.assertj.core.api.Assertions.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class TelegramHttpNotificationTransportTests {
 @Test void checksTelegramResponseAndRetryAfterWithoutSendingRealMessages() throws Exception {
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  var response=new AtomicReference<>("{\"ok\":true}");
  var request=new AtomicReference<String>();
  server.createContext("/sendMessage",exchange->{
   request.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
   byte[] bytes=response.get().getBytes(StandardCharsets.UTF_8);
   exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
  });
  server.start();
  try {
   var sender=new TelegramHttpNotificationTransport(URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/sendMessage"));
   assertThat(sender.send(67890,"<b>literal</b>").status()).isEqualTo("sent");
   var body=new ObjectMapper().readTree(request.get());
   assertThat(body.path("chat_id").asLong()).isEqualTo(67890);
   assertThat(body.path("text").asText()).isEqualTo("<b>literal</b>");
   assertThat(body.has("parse_mode")).isFalse();
   response.set("{\"ok\":false,\"error_code\":429,\"parameters\":{\"retry_after\":120}}");
   assertThat(sender.send(67890,"text")).isEqualTo(new TelegramNotificationTransport.Result("retry",120));
   response.set("{\"ok\":false,\"error_code\":403}");
   assertThat(sender.send(67890,"text").status()).isEqualTo("skipped");
   response.set("bad gateway");
   assertThat(sender.send(67890,"text").status()).isEqualTo("retry");
  } finally {server.stop(0);}
 }
}
