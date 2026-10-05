package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/catalog/engagement")
class StoryEngagementController {
 private final StoryEngagementService service;
 private final CurrentUserService users;
 StoryEngagementController(StoryEngagementService service, CurrentUserService users) {
  this.service=service; this.users=users;
 }
 @GetMapping
 List<StoryEngagementService.Metrics> catalog(HttpServletResponse response) {
  response.setHeader("Cache-Control", "private, no-store");
  return service.catalog(users.optionalIdentity().map(AuthIdentity::userId).orElse(null));
 }
 @PostMapping("/{slug}/view")
 Map<String, Boolean> view(@PathVariable String slug,
   @CookieValue(name="fraer_viewer", required=false) String visitor, HttpServletResponse response) {
  String user = users.optionalIdentity().map(AuthIdentity::userId).orElse(null);
  if (user == null && (visitor == null || !visitor.matches("[0-9a-fA-F-]{36}"))) {
   visitor=UUID.randomUUID().toString();
   response.addHeader("Set-Cookie", ResponseCookie.from("fraer_viewer",visitor)
     .httpOnly(true).secure(true).sameSite("Lax").path("/").maxAge(31536000).build().toString());
  }
  service.view(slug, user == null ? "guest:"+visitor : "user:"+user);
  response.setHeader("Cache-Control", "no-store");
  return Map.of("recorded",true);
 }
 @GetMapping("/{slug}")
 StoryEngagementService.Metrics detail(@PathVariable String slug,HttpServletResponse response) {
  response.setHeader("Cache-Control","private, no-store");
  return service.detail(slug,users.optionalIdentity().map(AuthIdentity::userId).orElse(null));
 }
 record Favorite(@NotNull Boolean selected) {}
 record Rating(@NotNull @Min(1) @Max(5) Integer score) {}
 @PutMapping("/{slug}/favorite")
 Map<String, Boolean> favorite(@PathVariable String slug, @Valid @RequestBody Favorite body) {
  service.favorite(slug, users.requireIdentity().userId(), body.selected());
  return Map.of("favorite",body.selected());
 }
 @PutMapping("/{slug}/rating")
 Map<String, Boolean> rate(@PathVariable String slug, @Valid @RequestBody Rating body) {
  service.rate(slug, users.requireIdentity().userId(), body.score());
  return Map.of("saved",true);
 }
}
