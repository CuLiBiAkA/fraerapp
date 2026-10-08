package com.fraergod.fraerapp.game;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Return deliberate validation diagnostics, never stack traces or exception causes. */
@RestControllerAdvice(assignableTypes={CollectionController.class,AuthorStoryController.class,AdminStoryController.class,StoryModerationController.class,GameController.class})
class WorkApiErrors {
 @ExceptionHandler(ReviewLimitException.class)
 ResponseEntity<Map<String,Object>> reviewLimit(ReviewLimitException exception){return ResponseEntity.status(409).header("Cache-Control","private, no-store").body(Map.of("status",409,"code","REVIEW_LIMIT_REACHED","message",exception.getReason()));}
 @ExceptionHandler(ResponseStatusException.class)
 ResponseEntity<Map<String,Object>> validation(ResponseStatusException exception){return ResponseEntity.status(exception.getStatusCode()).body(Map.of("status",exception.getStatusCode().value(),"message",exception.getReason()==null?"Request could not be completed":exception.getReason()));}
}
