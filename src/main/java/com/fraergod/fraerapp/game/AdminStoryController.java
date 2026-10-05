package com.fraergod.fraerapp.game;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Compatibility routes require the same revision-aware decisions as the moderation page. */
@RestController
@RequestMapping("/api/admin/stories")
class AdminStoryController {
 private final StoryWorkflowService workflow;
 private final CurrentUserService currentUser;
 AdminStoryController(StoryWorkflowService workflow,CurrentUserService currentUser) {
  this.workflow=workflow;this.currentUser=currentUser;
 }
 @PostMapping("/import") Object importStory(@RequestBody String body) {
  currentUser.requireAdmin();return workflow.importAdminDraft(body,currentUser.requireAuthorPlayerId());
 }
 @GetMapping Object stories(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,
  @RequestParam(defaultValue="all") String status) {
  currentUser.requireAdmin();return workflow.list(page,size,"",status,"all");
 }
 @GetMapping("/{id}/preview") Object preview(@PathVariable String id,@RequestParam(defaultValue="draft") String revision) {
  currentUser.requireAdmin();return workflow.preview(id,null,true,revision);
 }
 @GetMapping("/{id}/versions") Object versions(@PathVariable String id) {
  currentUser.requireAdmin();return workflow.details(id,null,true).get("versions");
 }
 @PostMapping("/{id}/validate") Object validate(@PathVariable String id) {
  currentUser.requireAdmin();return workflow.validateDraft(id,null);
 }
 @PostMapping("/{id}/review") Object review(@PathVariable String id,@RequestBody AuthorStoryController.Submission command) {
  currentUser.requireAdmin();return workflow.submit(id,null,command.generation(),Boolean.TRUE.equals(command.replaceReview()),currentUser.requireIdentity());
 }
 @PostMapping("/{id}/publish") Object publish(@PathVariable String id) {
  currentUser.requireAdmin();
  throw new ResponseStatusException(HttpStatus.CONFLICT,"Use a revision-aware moderation decision");
 }
 @PostMapping("/{id}/archive") Object archive(@PathVariable String id,@RequestBody StoryWorkflowService.Decision command) {
  currentUser.requireAdmin();return workflow.decide(id,"archive",command,currentUser.requireIdentity());
 }
 @DeleteMapping("/{id}") Object delete(@PathVariable String id,@RequestBody StoryWorkflowService.Decision command) {
  currentUser.requireAdmin();return workflow.decide(id,"delete",command,currentUser.requireIdentity());
 }
 @PostMapping("/{id}/versions/{number}/rollback") Object rollback(@PathVariable String id,@PathVariable int number) {
  currentUser.requireAdmin();return workflow.rollback(id,null,number);
 }
}
