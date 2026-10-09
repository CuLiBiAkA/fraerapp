package com.fraergod.fraerapp.game;

import static com.fraergod.fraerapp.game.WorkLinksService.bad;

/** Covers share the reviewed media boundary, without changing any scene. */
final class CoverPaths {
 private CoverPaths() {}
 static void validatePath(String url) {
  if(url==null||url.isBlank())return;
  if(url.length()>2000||!url.matches("/(assets|uploads)/[A-Za-z0-9_./-]+")||url.contains(".."))
   throw bad("Cover must use uploaded or bundled media");
 }
 static void validate(String url,String workId) {
  validatePath(url);
  if(url!=null&&url.startsWith("/uploads/")&&(!url.startsWith("/uploads/"+workId+"/")||!url.substring(("/uploads/"+workId+"/").length()).matches("[A-Za-z0-9_.-]+")))
   throw bad("Upload the cover to this work before referencing it");
 }
}
