package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/author")
class AuthorStoryController {
 private final StoryProductService product;
 private final StoryWorkflowService workflow;
 private final CurrentUserService currentUser;
 AuthorStoryController(StoryProductService product,StoryWorkflowService workflow,CurrentUserService currentUser) {
  this.product=product;this.workflow=workflow;this.currentUser=currentUser;
 }
 // Ownership remains readable when author privileges are revoked.
 @GetMapping("/home") Object home() {
  String id=currentUser.requireOwnerReaderPlayerId();
  var home=new LinkedHashMap<String,Object>(product.authorHome(id));
  home.put("stories",workflow.mine(id));return home;
 }
 @GetMapping("/stories") Object stories() {return workflow.mine(currentUser.requireOwnerReaderPlayerId());}
 @GetMapping("/stories/{id}") Object story(@PathVariable String id) {return workflow.details(id,currentUser.requireOwnerReaderPlayerId(),false);}
 @GetMapping("/stories/{id}/document") Object document(@PathVariable String id) {
  return workflow.details(id,currentUser.requireOwnerReaderPlayerId(),false).get("draftDocument");
 }
 @GetMapping("/stories/{id}/preview") Object preview(@PathVariable String id,@RequestParam(defaultValue="draft") String revision) {
  return workflow.preview(id,currentUser.requireOwnerReaderPlayerId(),false,revision);
 }
 @GetMapping("/stories/{id}/versions") Object versions(@PathVariable String id) {
  return workflow.details(id,currentUser.requireOwnerReaderPlayerId(),false).get("versions");
 }
 @GetMapping("/stories/{id}/analytics") Object analytics(@PathVariable String id) {
  return product.analytics(currentUser.requireOwnerReaderPlayerId(),id);
 }
 @PostMapping("/stories/{id}/validate") Object validate(@PathVariable String id) {
  return workflow.validateDraft(id,currentUser.requireAuthorPlayerId());
 }
 @PostMapping("/stories/{id}/assets") Object upload(@PathVariable String id,@RequestParam("file") MultipartFile file,
  @RequestParam(required=false) String assetKey,@RequestParam(required=false) String type,@RequestParam(required=false) String scope) {
  return product.uploadAssetForAuthor(currentUser.requireAuthorPlayerId(),id,file,assetKey,type,scope);
 }
 @DeleteMapping("/stories/{id}/assets") Object removeAsset(@PathVariable String id,
  @RequestParam(required=false) String assetKey,@RequestParam(required=false) String url) {
  return product.deleteAssetForAuthor(currentUser.requireAuthorPlayerId(),id,assetKey,url);
 }
 @PostMapping("/stories/import") Object importStory(@RequestBody String body) {
  return workflow.importDraft(body,currentUser.requireAuthorPlayerId());
 }
 record Draft(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Min(0) Integer generation,Map<String,Object> document) {}
 @PutMapping("/stories/{id}") Object save(@PathVariable String id,@jakarta.validation.Valid @RequestBody Draft command) {
  return workflow.saveDocument(id,currentUser.requireAuthorPlayerId(),command.generation(),command.document());
 }
 @PostMapping("/stories/{id}/publish") Object publish(@PathVariable String id) {
  currentUser.requireAuthorPlayerId();
  throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Submit the story for moderation before publication");
 }
 record Submission(int generation,Boolean replaceReview) {}
 @PostMapping("/stories/{id}/review") Object review(@PathVariable String id,@RequestBody Submission command) {
  return workflow.submit(id,currentUser.requireAuthorPlayerId(),command.generation(),Boolean.TRUE.equals(command.replaceReview()),currentUser.requireIdentity());
 }
 @PostMapping("/stories/{id}/withdraw") Object withdraw(@PathVariable String id,@RequestBody Submission command) {
  return workflow.withdraw(id,currentUser.requireAuthorPlayerId(),command.generation(),currentUser.requireIdentity());
 }
 @PostMapping("/stories/{id}/archive") Object archive(@PathVariable String id) {
  return workflow.takeDown(id,currentUser.requireAuthorPlayerId(),false,currentUser.requireIdentity());
 }
 @DeleteMapping("/stories/{id}") Object delete(@PathVariable String id) {
  return workflow.takeDown(id,currentUser.requireAuthorPlayerId(),true,currentUser.requireIdentity());
 }
 @PostMapping("/stories/{id}/versions/{number}/rollback") Object rollback(@PathVariable String id,@PathVariable int number) {
  return workflow.rollback(id,currentUser.requireAuthorPlayerId(),number);
 }
}
