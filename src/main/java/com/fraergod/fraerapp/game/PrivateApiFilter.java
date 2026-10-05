package com.fraergod.fraerapp.game;

import java.io.IOException;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;

@Component
class PrivateApiFilter extends OncePerRequestFilter {
 private final Set<String> origins;
 PrivateApiFilter(@Value("${app.cors.allowed-origins}") String allowed) {
  origins=new HashSet<>(Arrays.asList(allowed.split(",")));
 }
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
  String path=request.getRequestURI();
  if(path.startsWith("/api/")||path.startsWith("/uploads/")) {
   response.setHeader("Cache-Control","private, no-store, max-age=0");
   response.setHeader("X-Robots-Tag","noindex, nofollow");
   response.setHeader("X-Content-Type-Options","nosniff");
   boolean cookie=request.getCookies()!=null&&Arrays.stream(request.getCookies()).anyMatch(c->"fraer_access".equals(c.getName()));
   boolean unsafe=!Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
   if(cookie&&unsafe&&request.getHeader("Authorization")==null) {
    String origin=request.getHeader("Origin");
    String own=request.getScheme()+"://"+request.getServerName()+((request.getServerPort()==80||request.getServerPort()==443)?"":":"+request.getServerPort());
    boolean same=origin!=null&&(origins.contains(origin)||own.equals(origin));
    // A custom header is accepted only without an Origin; cross-origin requests still require the allowlist.
    boolean sameSite=origin==null&&("same-origin".equals(request.getHeader("Sec-Fetch-Site"))||"same-origin".equals(request.getHeader("X-Fraer-Request")));
    if(!same&&!sameSite) {response.sendError(403,"Cross-origin cookie mutation is not allowed");return;}
   }
  }
  chain.doFilter(request,response);
 }
}
