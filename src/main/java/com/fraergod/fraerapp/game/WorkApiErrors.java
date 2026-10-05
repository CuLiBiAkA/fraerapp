package com.fraergod.fraerapp.game;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Return deliberate validation diagnostics, never stack traces or exception causes. */
@RestControllerAdvice(assignableTypes={CollectionController.class,AuthorStoryController.class,StoryModerationController.class,GameController.class})
class WorkApiErrors {
 @ExceptionHandler(ResponseStatusException.class)
 ResponseEntity<Map<String,Object>> validation(ResponseStatusException exception){return ResponseEntity.status(exception.getStatusCode()).body(Map.of("status",exception.getStatusCode().value(),"message",exception.getReason()==null?"Request could not be completed":exception.getReason()));}
}
