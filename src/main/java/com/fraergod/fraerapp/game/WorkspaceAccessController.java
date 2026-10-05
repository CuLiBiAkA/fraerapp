package com.fraergod.fraerapp.game;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
class WorkspaceAccessController {
 private final CurrentUserService user;
 WorkspaceAccessController(CurrentUserService user) {this.user=user;}
 @GetMapping("/api/moderation/access") Map<String,Boolean> moderation() {
  user.requireModerator();return Map.of("allowed",true);
 }
 @GetMapping("/api/workspace/access") Map<String,Boolean> workspace() {
  user.requireIdentity();return Map.of("allowed",true);
 }
}
