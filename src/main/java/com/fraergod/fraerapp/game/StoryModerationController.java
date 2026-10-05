package com.fraergod.fraerapp.game;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/moderation/stories")
class StoryModerationController {
 private final StoryWorkflowService workflow;
 private final CurrentUserService user;
 StoryModerationController(StoryWorkflowService workflow,CurrentUserService user) {this.workflow=workflow;this.user=user;}
 @GetMapping Object list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,
  @RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="all") String visibility) {
  user.requireModerator();return workflow.list(page,size,q,status,visibility);
 }
 @GetMapping("/{id}") Object detail(@PathVariable String id) {user.requireModerator();return workflow.details(id,null,true);}
 @GetMapping("/{id}/preview") Object preview(@PathVariable String id,@RequestParam(defaultValue="submitted") String revision) {
  user.requireModerator();return workflow.preview(id,null,true,revision);
 }
 @PostMapping("/{id}/{action}") Object decide(@PathVariable String id,@PathVariable String action,@RequestBody StoryWorkflowService.Decision command) {
  return workflow.decide(id,action,command,user.requireModerator());
 }
}
