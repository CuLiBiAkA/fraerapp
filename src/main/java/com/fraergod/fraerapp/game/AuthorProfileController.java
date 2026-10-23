package com.fraergod.fraerapp.game;
import java.util.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;

@RestController
class AuthorProfileController {
 private final AuthorProfileService profiles;private final CurrentUserService users;private final StoryAssetStorageService storage;
 AuthorProfileController(AuthorProfileService profiles,CurrentUserService users,StoryAssetStorageService storage){this.profiles=profiles;this.users=users;this.storage=storage;}
 @GetMapping("/api/author/profile") Object mine(HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");return profiles.get(users.requireAuthorPlayerId());}
 @PutMapping("/api/author/profile") Object save(@RequestBody AuthorProfileService.Profile body){return profiles.save(users.requireAuthorPlayerId(),body);}
 @PostMapping("/api/author/profile/avatar") Object avatar(@RequestParam("file") MultipartFile file){
  String id=users.requireAuthorPlayerId();
  if(!List.of("image/png","image/jpeg","image/webp","image/gif").contains(Objects.toString(file.getContentType(),"")))throw WorkLinksService.bad("Upload a raster image");
  return Map.of("url","/api/authors/"+id+"/avatar/"+storage.store(id,file).filename());
 }
 @GetMapping("/api/authors/{id}/avatar/{filename}") ResponseEntity<FileSystemResource> image(@PathVariable String id,@PathVariable String filename){
  if(!id.matches("[a-zA-Z0-9-]+")||!filename.matches("[a-zA-Z0-9-]+\\.(png|jpg|webp|gif)"))throw new StoryNotFoundException();
  String reader=users.optionalPlayerId();
  if(!id.equals(reader)){
   profiles.publicProfile(id,reader,users.optionalIdentity().isEmpty());
   if(!profiles.get(id).avatar().equals("/api/authors/"+id+"/avatar/"+filename))throw new StoryNotFoundException();
  }
  Path path=storage.rootPath().resolve(id).resolve(filename).normalize();
  if(!path.startsWith(storage.rootPath())||!Files.isRegularFile(path))throw new StoryNotFoundException();
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").contentType(StoryMediaController.type(filename)).body(new FileSystemResource(path));
 }
 @GetMapping("/api/authors/{id}") Object profile(@PathVariable String id,HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");return profiles.publicProfile(id,users.optionalPlayerId(),users.optionalIdentity().isEmpty());}
 record Favorite(boolean favorite){}
 @PutMapping("/api/authors/{id}/favorite") Object favorite(@PathVariable String id,@RequestBody Favorite body){profiles.favorite(id,users.requirePlayerId(),body.favorite());return Map.of("favorite",body.favorite());}
}
