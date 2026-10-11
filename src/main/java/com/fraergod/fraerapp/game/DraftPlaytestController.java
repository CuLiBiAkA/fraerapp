package com.fraergod.fraerapp.game;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

/** Private immutable revisions, replayed without reader sessions or engagement writes. */
@RestController
class DraftPlaytestController {
 private final CurrentUserService user;
 private final StoryWorkflowService workflow;
 private final GameService game;
 DraftPlaytestController(CurrentUserService user, StoryWorkflowService workflow, GameService game) {
  this.user=user;this.workflow=workflow;this.game=game;
 }
 record Playtest(@NotNull @Min(1) Integer revision, @NotNull @Size(max=500) List<@NotBlank @Size(max=120) String> choices) {}
 @PostMapping("/api/author/stories/{id}/playtest")
 GameService.SessionState playtest(@PathVariable String id, @Valid @RequestBody Playtest command, HttpServletResponse response) {
  var identity=user.requireIdentity();
  boolean moderator=identity.hasRole("moderator")||identity.hasRole("admin");
  workflow.preview(id,user.requireOwnerReaderPlayerId(),moderator,command.revision().toString());
  response.setHeader("Cache-Control","private, no-store");
  return game.playtest(id,workflow.revision(id,command.revision()),command.choices());
 }
}
