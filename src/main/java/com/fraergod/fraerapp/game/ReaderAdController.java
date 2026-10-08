package com.fraergod.fraerapp.game;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

@RestController
class ReaderAdController {
 private final CurrentUserService current;
 private final ReaderAdService ads;
 ReaderAdController(CurrentUserService current,ReaderAdService ads){this.current=current;this.ads=ads;}
 @PostMapping("/api/reader-ads/claim")
 ReaderAdService.Delivery claim(@RequestBody Claim request,HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");return ads.claim(current.requirePlayerId(),request.offerId());}
 @GetMapping("/api/admin/reader-ads")
 ReaderAdService.Settings settings(HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");current.requireAdmin();return ads.settings();}
 @PutMapping("/api/admin/reader-ads")
 ReaderAdService.Settings save(@RequestBody ReaderAdService.Update update,HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");return ads.save(update,current.requireRole("admin"));}
 record Claim(String offerId){}
}
