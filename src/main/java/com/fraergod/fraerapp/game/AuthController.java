package com.fraergod.fraerapp.game;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {

	private final CurrentUserService currentUser;

	AuthController(CurrentUserService currentUser) {
		this.currentUser = currentUser;
	}

	@GetMapping("/me")
	Map<String, Object> me() {
		AuthIdentity identity = currentUser.requireIdentity();
		return Map.of("id", identity.userId(), "email", identity.email(), "roles", identity.roles());
	}

	@PostMapping("/login")
	Object legacyLogin() {
		throw new ResponseStatusException(HttpStatus.GONE, "Use /auth/login-link");
	}
}
