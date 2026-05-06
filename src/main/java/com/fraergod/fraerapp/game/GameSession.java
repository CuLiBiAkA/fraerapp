package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "game_sessions")
class GameSession {

	@Id
	private String id;

	@Column(nullable = false, length = 36)
	private String playerId;

	@Column(nullable = false, length = 36)
	private String storyId;

	@Column(nullable = false, length = 120)
	private String currentSceneKey;

	@Column(nullable = false, length = 120)
	private String saveName;

	@Column(nullable = false, columnDefinition = "text")
	private String variablesJson;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private SessionStatus status = SessionStatus.ACTIVE;

	@Column(length = 120)
	private String endingSceneKey;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected GameSession() {
	}

	GameSession(String playerId, Story story) {
		this.id = UUID.randomUUID().toString();
		this.playerId = playerId;
		this.storyId = story.getId();
		this.currentSceneKey = story.getStartSceneId();
		this.saveName = "Autosave";
		this.variablesJson = story.getVariablesJson();
	}

	GameSession(String playerId, Story story, String saveName) {
		this(playerId, story);
		rename(saveName);
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		this.updatedAt = Instant.now();
	}

	String getId() {
		return id;
	}

	String getPlayerId() {
		return playerId;
	}

	String getStoryId() {
		return storyId;
	}

	String getCurrentSceneKey() {
		return currentSceneKey;
	}

	void setCurrentSceneKey(String currentSceneKey) {
		this.currentSceneKey = currentSceneKey;
	}

	String getSaveName() {
		return saveName;
	}

	void rename(String saveName) {
		String normalized = saveName == null ? "" : saveName.trim();
		this.saveName = normalized.isEmpty() ? "Autosave" : normalized;
	}

	String getVariablesJson() {
		return variablesJson;
	}

	void setVariablesJson(String variablesJson) {
		this.variablesJson = variablesJson;
	}

	SessionStatus getStatus() {
		return status;
	}

	String getEndingSceneKey() {
		return endingSceneKey;
	}

	Instant getUpdatedAt() {
		return updatedAt;
	}

	Instant getCreatedAt() {
		return createdAt;
	}

	void finish(String endingSceneKey) {
		this.status = SessionStatus.FINISHED;
		this.endingSceneKey = endingSceneKey;
	}

	void reset(Story story) {
		this.currentSceneKey = story.getStartSceneId();
		this.variablesJson = story.getVariablesJson();
		this.status = SessionStatus.ACTIVE;
		this.endingSceneKey = null;
	}
}
