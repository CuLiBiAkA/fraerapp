package com.fraergod.fraerapp.game;

import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/account")
class AccountController {
 private final AccountService service;
 private final CurrentUserService users;
 AccountController(AccountService service,CurrentUserService users) { this.service=service;this.users=users; }
 @GetMapping
 AccountService.Account get(HttpServletResponse response) {
  response.setHeader("Cache-Control","private, no-store");
  return service.get(users.requireIdentity().userId());
 }
 record Avatar(@NotNull @Pattern(regexp="fairy|fae") String avatar) {}
 @PutMapping("/avatar")
 Map<String,String> avatar(@Valid @RequestBody Avatar body) {
  service.avatar(users.requireIdentity().userId(),body.avatar()); return Map.of("avatar",body.avatar());
 }
 @PostMapping("/notifications/{id}/read")
 Map<String,Boolean> read(@PathVariable String id) {
  service.read(users.requireIdentity().userId(),id);return Map.of("saved",true);
 }
 record Message(@NotBlank @Pattern(regexp="[a-zA-Z0-9-]{1,36}") String userId,@NotBlank @Size(max=2000) String message) {}
 @DeleteMapping("/notifications/{id}")
 AccountService.Account deleteNotice(@PathVariable String id,HttpServletResponse response) {
  response.setHeader("Cache-Control","private, no-store");
  return service.deleteNotice(users.requireIdentity().userId(),id);
 }
 @DeleteMapping("/notifications")
 AccountService.Account clearNotices(HttpServletResponse response) {
  response.setHeader("Cache-Control","private, no-store");
  return service.clearNotices(users.requireIdentity().userId());
 }
 @PostMapping("/admin/messages")
 Map<String,Boolean> message(@Valid @RequestBody Message body) {
  users.requireAdmin();service.message(body.userId(),body.message().trim());return Map.of("sent",true);
 }
}
