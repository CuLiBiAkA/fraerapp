package com.fraergod.fraerapp.game;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.fraergod.fraerapp.game.GameService.SessionState;
import com.fraergod.fraerapp.game.GameService.SaveSummary;
import com.fraergod.fraerapp.game.GameService.StorySummary;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
class GameController {

	private final GameService game;
	private final CurrentUserService currentUser;

	GameController(GameService game, CurrentUserService currentUser) {
		this.game = game;
		this.currentUser = currentUser;
	}

	@GetMapping("/api/stories")
	List<StorySummary> stories() {
		return game.publishedStories();
	}

	@PostMapping("/api/sessions")
	SessionState createSession(@Valid @RequestBody CreateSessionRequest request) {
		return game.createSession(currentUser.requirePlayerId(), request.storyKey(), request.saveName());
	}

	@GetMapping("/api/sessions")
	List<SaveSummary> sessions() {
		return game.sessionSaves(currentUser.requirePlayerId());
	}

	@GetMapping("/api/stories/{storyKey}/sessions")
	List<SaveSummary> storySessions(@PathVariable String storyKey) {
		return game.storySaves(currentUser.requirePlayerId(), storyKey);
	}

	@GetMapping("/api/sessions/{sessionId}/state")
	SessionState state(@PathVariable String sessionId) {
		return game.sessionState(currentUser.requirePlayerId(), sessionId);
	}

	@PostMapping("/api/sessions/{sessionId}/choice")
	SessionState choose(@PathVariable String sessionId, @Valid @RequestBody ChoiceRequest request) {
		return game.choose(currentUser.requirePlayerId(), sessionId, request.choiceId());
	}

	@PostMapping("/api/sessions/{sessionId}/reset")
	SessionState reset(@PathVariable String sessionId) {
		return game.reset(currentUser.requirePlayerId(), sessionId);
	}

	@PostMapping("/api/sessions/{sessionId}/save-name")
	SaveSummary renameSave(@PathVariable String sessionId, @Valid @RequestBody RenameSaveRequest request) {
		return game.renameSave(currentUser.requirePlayerId(), sessionId, request.saveName());
	}

	record CreateSessionRequest(@NotBlank String storyKey, String saveName) {
	}

	record ChoiceRequest(@NotBlank String choiceId) {
	}

	record RenameSaveRequest(@NotBlank String saveName) {
	}
}
