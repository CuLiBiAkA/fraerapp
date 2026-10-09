package com.fraergod.fraerapp.game;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
class CollectionCoverController {
 private final CollectionService collections;
 private final CurrentUserService user;
 private final StoryAssetStorageService storage;
 CollectionCoverController(CollectionService collections,CurrentUserService user,StoryAssetStorageService storage){this.collections=collections;this.user=user;this.storage=storage;}
 record Cover(String url,String contentType,long bytes,String filename) {}
 @PostMapping("/api/author/collections/{id}/cover")
 @Transactional
 Object upload(@PathVariable String id,@RequestParam("file") MultipartFile file) {
  var row=collections.lock(id);collections.owner(row,user.requireAuthorPlayerId());
  if("deleted".equals(row.visibility()))throw WorkLinksService.conflict("Restore collection before editing");
  if(file.getContentType()==null||!file.getContentType().toLowerCase(Locale.ROOT).startsWith("image/"))throw WorkLinksService.bad("Cover must be an image");
  var stored=storage.store(row.id(),file);return new Cover(stored.url(),stored.contentType(),stored.size(),stored.filename());
 }
 @GetMapping("/api/author/collections/{id}/covers")
 Object library(@PathVariable String id) {
  var row=collections.row(id);collections.owner(row,user.requireOwnerReaderPlayerId());
  Path directory=storage.rootPath().resolve(row.id());
  if(!Files.isDirectory(directory))return List.of();
  try(var files=Files.list(directory)) {
   return files.filter(Files::isRegularFile).filter(path->path.getFileName().toString().matches("[A-Za-z0-9_-]+\\.(jpg|png|gif|webp|svg)")).sorted().map(path->{
    String filename=path.getFileName().toString();
    try{return new Cover("/uploads/"+row.id()+"/"+filename,StoryMediaController.type(filename).toString(),Files.size(path),filename);}
    catch(IOException ex){throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not read cover library",ex);}
   }).toList();
  }catch(IOException ex){throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not read cover library",ex);}
 }
}
