package com.fraergod.fraerapp.game;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

/** Auth owns live roles and revocation; cache only within one HTTP request. */
@Component
class CurrentSessionClient {
 private final URI endpoint;
 private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
 private final ObjectMapper mapper = new ObjectMapper();
 CurrentSessionClient(@Value("${app.auth.session-check-url}") String endpoint) {
  if(endpoint.isBlank())throw new IllegalArgumentException("Live session verification endpoint is required");
  this.endpoint = URI.create(endpoint);
 }
 AuthIdentity current(AuthIdentity signed) {
  var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
  if (attrs == null) throw new AuthRequiredException();
  HttpServletRequest request = attrs.getRequest();
  Object cached = request.getAttribute(CurrentSessionClient.class.getName());
  if (cached instanceof AuthIdentity identity) return identity;
  String authorization = request.getHeader("Authorization");
  if (authorization == null && request.getCookies() != null) {
   for (var cookie : request.getCookies()) if (cookie.getName().equals("fraer_access")) authorization = "Bearer " + cookie.getValue();
  }
  if (authorization == null) throw new AuthRequiredException();
  try {
   var response = client.send(HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(5))
    .header("Authorization", authorization).header("Accept", "application/json").GET().build(), HttpResponse.BodyHandlers.ofString());
   if (response.statusCode() == 401) throw new AuthRequiredException();
   if (response.statusCode() == 403) throw new ForbiddenRoleException();
   if (response.statusCode() != 200) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Session verification unavailable");
   Map<?,?> body = mapper.readValue(response.body(), Map.class);
   if (!signed.userId().equals(body.get("id")) || Boolean.TRUE.equals(body.get("blocked"))
      || !(body.get("sessionId") instanceof String sessionId) || sessionId.isBlank()) throw new AuthRequiredException();
   List<String> roles = body.get("roles") instanceof List<?> values ? values.stream().filter(String.class::isInstance).map(String.class::cast).toList() : List.of();
   var identity = new AuthIdentity(signed.userId(), (String) body.get("email"), roles);
   request.setAttribute(CurrentSessionClient.class.getName(), identity);
   AuthContext.set(identity);
   return identity;
  } catch (ResponseStatusException | AuthRequiredException | ForbiddenRoleException ex) { throw ex; }
  catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Session verification unavailable"); }
  catch (Exception ex) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Session verification unavailable"); }
 }
}
