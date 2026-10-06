package com.fraergod.fraerapp.game;

import org.springframework.web.bind.annotation.*;

@RestController
class FolderWorkspaceController {
 private final FolderWorkspaceService folders;
 private final CurrentUserService user;
 FolderWorkspaceController(FolderWorkspaceService folders,CurrentUserService user){this.folders=folders;this.user=user;}
 @GetMapping("/api/author/folders") Object mine(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="all") String visibility,@RequestParam(defaultValue="all") String type){return folders.list(user.requireOwnerReaderPlayerId(),false,page,size,q,status,visibility,type);}
 @GetMapping("/api/moderation/folders") Object queue(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="all") String visibility,@RequestParam(defaultValue="all") String type){user.requireModerator();return folders.list(null,true,page,size,q,status,visibility,type);}
 @GetMapping("/api/moderation/folders/{id}/review") Object review(@PathVariable String id){return folders.review(id,user.requireModerator());}
 @PostMapping("/api/moderation/folders/{id}/decision") Object decide(@PathVariable String id,@RequestBody FolderWorkspaceService.Decision command){return folders.decide(id,command,user.requireModerator());}
}
