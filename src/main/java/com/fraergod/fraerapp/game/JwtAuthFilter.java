package com.fraergod.fraerapp.game;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
class JwtAuthFilter extends OncePerRequestFilter {

	private final JwtTokenVerifier verifier;
	private final String cookieName;
	private final boolean enabled;

	JwtAuthFilter(JwtTokenVerifier verifier,
			@Value("${app.auth.access-cookie:fraer_access}") String cookieName,
			@Value("${app.auth.enabled:true}") boolean enabled) {
		this.verifier = verifier;
		this.cookieName = cookieName;
		this.enabled = enabled;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		try {
			String token = token(request);
			if (enabled && token != null && !token.isBlank()) {
				AuthContext.set(verifier.verify(token));
			}
			filterChain.doFilter(request, response);
		}
		finally {
			AuthContext.clear();
		}
	}

	private String token(HttpServletRequest request) {
		String authorization = request.getHeader("Authorization");
		if (authorization != null && authorization.startsWith("Bearer ")) {
			return authorization.substring("Bearer ".length());
		}
		if (request.getCookies() != null) {
			for (Cookie cookie : request.getCookies()) {
				if (cookieName.equals(cookie.getName())) {
					return cookie.getValue();
				}
			}
		}
		return null;
	}
}
