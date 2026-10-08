package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
class CollectionController {
 private final CollectionService collections;
 private final StoryWorkflowService workflow;
 private final ChapterReadingService reading;
 private final WorkPackageService packages;
 private final CurrentUserService user;
 private final WorkLinksService links;
 private final JsonSupport json;
 CollectionController(CollectionService collections,StoryWorkflowService workflow,ChapterReadingService reading,WorkPackageService packages,CurrentUserService user,WorkLinksService links,JsonSupport json){this.collections=collections;this.workflow=workflow;this.reading=reading;this.packages=packages;this.user=user;this.links=links;this.json=json;}
 record Draft(int generation,CollectionDocument document) {}
 record Create(CollectionDocument document) {}
 record Submission(int generation,Boolean replaceReview) {}
 record Favorite(boolean favorite) {}
 record Request(String requestId,Boolean newAttempt) {}
 @GetMapping("/api/author/collections") Object mine(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String type,@RequestParam(defaultValue="all") String status){return collections.mine(user.requireOwnerReaderPlayerId(),page,size,q,type,status);}
 @GetMapping("/api/author/collections/parents") Object parents(@RequestParam String scenarioId){return collections.parents(user.requireOwnerReaderPlayerId(),scenarioId);}
 @PostMapping("/api/author/collections") Object create(@RequestBody Create d){return collections.create(d.document(),user.requireAuthorPlayerId());}
 @GetMapping("/api/author/collections/targets") Object targets(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size){return collections.targets(user.requireOwnerReaderPlayerId(),q,page,size);}
 @GetMapping("/api/author/collections/{id}") Object detail(@PathVariable String id){return collections.details(id,user.requireOwnerReaderPlayerId(),false);}
 @PutMapping("/api/author/collections/{id}") Object save(@PathVariable String id,@RequestBody Draft d){return collections.save(id,d.generation(),d.document(),user.requireAuthorPlayerId());}
 @GetMapping("/api/author/collections/{id}/preview") Object preview(@PathVariable String id,@RequestParam(defaultValue="draft") String revision){return collections.preview(id,user.requireOwnerReaderPlayerId(),false,revision);}
 @PostMapping("/api/author/collections/{id}/review") Object review(@PathVariable String id,@RequestBody Submission c){return collections.submit(id,user.requireAuthorPlayerId(),c.generation(),Boolean.TRUE.equals(c.replaceReview()),user.requireIdentity());}
 @PostMapping("/api/author/collections/{id}/withdraw") Object withdraw(@PathVariable String id,@RequestBody Submission c){return collections.withdraw(id,user.requireAuthorPlayerId(),c.generation(),user.requireIdentity());}
 @PostMapping("/api/author/collections/{id}/archive") Object archive(@PathVariable String id,@RequestBody Submission c){return collections.takeDown(id,user.requireAuthorPlayerId(),c.generation(),false,user.requireIdentity());}
 @DeleteMapping("/api/author/collections/{id}") Object delete(@PathVariable String id,@RequestBody Submission c){return collections.takeDown(id,user.requireAuthorPlayerId(),c.generation(),true,user.requireIdentity());}
 @GetMapping("/api/author/collections/{id}/export") Object export(@PathVariable String id){return packages.export(id,user.requireOwnerReaderPlayerId());}
 @PostMapping("/api/author/collections/import") Object importPackage(@RequestBody Map<String,Object> data){return packages.importPackage(data,user.requireAuthorPlayerId());}
 @PostMapping("/api/author/collections/import-preview") Object importPreview(@RequestBody Map<String,Object> data){return packages.importPreview(data,user.requireAuthorPlayerId());}
 @PostMapping("/api/author/review-batch") Object batch(@RequestBody WorkPackageService.Batch data){return packages.review(data,user.requireAuthorPlayerId(),user.requireIdentity());}
 @PostMapping("/api/author/collections/{id}/chapters/review") Object chapterReview(@PathVariable String id,@RequestBody WorkPackageService.ChapterReview data){return packages.reviewChapter(id,data,user.requireAuthorPlayerId(),user.requireIdentity());}
 @PostMapping("/api/author/collections/{id}/review-batch") Object batchTree(@PathVariable String id,@RequestBody Submission c){return packages.reviewTree(id,c.generation(),Boolean.TRUE.equals(c.replaceReview()),user.requireAuthorPlayerId(),user.requireIdentity());}
 @GetMapping("/api/moderation/collections") Object moderation(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="all") String visibility,@RequestParam(defaultValue="all") String type){user.requireModerator();return collections.queue(page,size,q,status,visibility,type);}
 @GetMapping("/api/moderation/collections/{id}") Object moderationDetail(@PathVariable String id){user.requireModerator();return collections.details(id,null,true);}
 @GetMapping("/api/moderation/collections/{id}/preview") Object moderationPreview(@PathVariable String id,@RequestParam(defaultValue="submitted") String revision){user.requireModerator();return collections.preview(id,null,true,revision);}
 @GetMapping("/api/moderation/collections/{id}/descendants") Object descendants(@PathVariable String id){user.requireModerator();return packages.descendants(id);}
 @PostMapping("/api/moderation/collections/{id}/restrict-descendants") Object restrict(@PathVariable String id,@RequestBody WorkPackageService.Restriction c){return packages.restrict(id,c,user.requireModerator());}
 @PostMapping("/api/moderation/collections/{id}/{action}") Object decide(@PathVariable String id,@PathVariable String action,@RequestBody StoryWorkflowService.Decision c){return workflow.decideCollection(id,action,c,user.requireModerator());}
 @GetMapping("/api/catalog/collections") Object catalog(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String type,@RequestParam(defaultValue="false") boolean favorites){return collections.catalog(user.optionalIdentity().isEmpty(),user.optionalPlayerId(),page,size,q,type,favorites);}
 @GetMapping("/api/catalog/collections/{id}") Object publicDetail(@PathVariable String id){return collections.publicDetail(id,user.optionalIdentity().isEmpty(),user.optionalPlayerId());}
 @GetMapping("/api/catalog/stories/{slug}/entry-context") Object entry(@PathVariable String slug){return reading.entryContext(slug,user.optionalPlayerId(),user.optionalIdentity().isEmpty());}
 @PutMapping("/api/catalog/collections/{id}/favorite") Object favorite(@PathVariable String id,@RequestBody Favorite value){return collections.favorite(id,user.requirePlayerId(),value.favorite());}
 @GetMapping("/api/collections/{id}/runs") Object runs(@PathVariable String id){return reading.runs(id,user.requirePlayerId());}
 @PostMapping("/api/collections/{id}/runs") Object begin(@PathVariable String id,@RequestBody Request r){return reading.begin(id,user.requirePlayerId(),r.requestId());}
 @GetMapping("/api/collection-runs/{id}") Object run(@PathVariable String id){return reading.detail(id,user.requirePlayerId());}
 @PostMapping("/api/collection-runs/{id}/start") Object start(@PathVariable String id,@RequestBody ChapterReadingService.Start c){return reading.start(id,user.requirePlayerId(),c);}
 @PostMapping("/api/collection-runs/{id}/update-toc") Object update(@PathVariable String id,@RequestBody Submission c){return reading.update(id,user.requirePlayerId(),c.generation());}
 @GetMapping("/api/sessions/{id}/relations") Object relations(@PathVariable String id,@RequestParam(required=false) String runId){return reading.relations(id,user.requirePlayerId(),runId);}
 @PostMapping("/api/sessions/{id}/relations/{relation}/start") Object relationStart(@PathVariable String id,@PathVariable String relation,@RequestBody Request r){return reading.relationStart(id,relation,user.requirePlayerId(),r.requestId(),Boolean.TRUE.equals(r.newAttempt()));}
 record Synthetic(StoryDocument source,StoryDocument target,WorkMetadata.Target targetRef,WorkMetadata.Transfer stateTransfer,Map<String,Object> values) {}
 @PostMapping({"/api/author/relations/test","/api/author/relations/validate"}) Object synthetic(@RequestBody String body){String player=user.requireAuthorPlayerId();Synthetic c=json.readValue(body,Synthetic.class);StoryDocument target=c.targetRef()==null?c.target():links.targetDocument(links.resolve(c.targetRef(),player,true),player);if(c.source()==null||target==null)throw WorkLinksService.bad("Source and target are required");var result=new LinkedHashMap<String,Object>();result.put("valid",true);result.put("values",links.transfer(c.source(),target,c.stateTransfer(),c.values()==null?Map.of():c.values()));result.put("inputContract",target.metadata()==null?null:json.readObject(json.write(target.metadata().inputContract())));return result;}
}
