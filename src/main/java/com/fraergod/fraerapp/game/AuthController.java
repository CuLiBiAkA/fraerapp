package com.fraergod.fraerapp.game;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/auth")
class AuthController {

	private final GameService game;

	AuthController(GameService game) {
		this.game = game;
	}

	@PostMapping("/login")
	LoginResponse login(@Valid @RequestBody LoginRequest request) {
		Player player = game.login(request.username());
		return new LoginResponse(player.getId(), player.getUsername());
	}

	record LoginRequest(@NotBlank @Size(max = 80) String username) {
	}

	record LoginResponse(String playerId, String username) {
	}
}
