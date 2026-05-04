package com.fraergod.fraerapp.game;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fraergod.fraerapp.game.GameService.SessionState;
import com.fraergod.fraerapp.game.GameService.SaveSummary;
import com.fraergod.fraerapp.game.GameService.StorySummary;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
class GameController {

	private final GameService game;

	GameController(GameService game) {
		this.game = game;
	}

	@GetMapping("/api/stories")
	List<StorySummary> stories() {
		return game.publishedStories();
	}

	@PostMapping("/api/sessions")
	SessionState createSession(@RequestHeader("X-Player-Id") String playerId, @Valid @RequestBody CreateSessionRequest request) {
		return game.createSession(playerId, request.storyKey(), request.saveName());
	}

	@GetMapping("/api/sessions")
	List<SaveSummary> sessions(@RequestHeader("X-Player-Id") String playerId) {
		return game.sessionSaves(playerId);
	}

	@GetMapping("/api/stories/{storyKey}/sessions")
	List<SaveSummary> storySessions(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyKey) {
		return game.storySaves(playerId, storyKey);
	}

	@GetMapping("/api/sessions/{sessionId}/state")
	SessionState state(@RequestHeader("X-Player-Id") String playerId, @PathVariable String sessionId) {
		return game.sessionState(playerId, sessionId);
	}

	@PostMapping("/api/sessions/{sessionId}/choice")
	SessionState choose(@RequestHeader("X-Player-Id") String playerId, @PathVariable String sessionId,
			@Valid @RequestBody ChoiceRequest request) {
		return game.choose(playerId, sessionId, request.choiceId());
	}

	@PostMapping("/api/sessions/{sessionId}/reset")
	SessionState reset(@RequestHeader("X-Player-Id") String playerId, @PathVariable String sessionId) {
		return game.reset(playerId, sessionId);
	}

	@PostMapping("/api/sessions/{sessionId}/save-name")
	SaveSummary renameSave(@RequestHeader("X-Player-Id") String playerId, @PathVariable String sessionId,
			@Valid @RequestBody RenameSaveRequest request) {
		return game.renameSave(playerId, sessionId, request.saveName());
	}

	record CreateSessionRequest(@NotBlank String storyKey, String saveName) {
	}

	record ChoiceRequest(@NotBlank String choiceId) {
	}

	record RenameSaveRequest(@NotBlank String saveName) {
	}
}
