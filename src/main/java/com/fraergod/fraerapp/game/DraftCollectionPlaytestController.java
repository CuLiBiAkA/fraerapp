package com.fraergod.fraerapp.game;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/author/collections/{id}/playtest")
class DraftCollectionPlaytestController {
 private final CurrentUserService user;
 private final DraftCollectionPlaytestService playtests;
 DraftCollectionPlaytestController(CurrentUserService user,DraftCollectionPlaytestService playtests){this.user=user;this.playtests=playtests;}
 @ModelAttribute
 void privateResponse(HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");}
 @ExceptionHandler(DraftCollectionPlaytestService.Unavailable.class)
 org.springframework.http.ResponseEntity<java.util.Map<String,Object>> unavailable(DraftCollectionPlaytestService.Unavailable error){
  return org.springframework.http.ResponseEntity.badRequest().header("Cache-Control","private, no-store").body(java.util.Map.of("status",400,"code",error.code,"message",error.getReason()));
 }
 record Step(@NotBlank @Size(max=120) String id,@NotNull @Min(1) Integer revision,@NotNull @Size(max=500) List<@NotBlank @Size(max=120) String> choices) {}
 record Playtest(@NotNull @Min(1) Integer revision,@NotNull @Size(min=1,max=500) List<@NotNull @Valid Step> steps) {}
 @GetMapping
 DraftCollectionPlaytestService.Manifest manifest(@PathVariable String id,@RequestParam(defaultValue="draft") String revision,HttpServletResponse response){
  response.setHeader("Cache-Control","private, no-store");
  return playtests.manifest(id,revision,user.requireIdentity());
 }
 @PostMapping
 DraftCollectionPlaytestService.Result replay(@PathVariable String id,@Valid @RequestBody Playtest command,HttpServletResponse response){
  response.setHeader("Cache-Control","private, no-store");
  return playtests.playtest(id,command,user.requireIdentity());
 }
}
