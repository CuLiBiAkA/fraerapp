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
@Table(name = "stories")
class Story {

	@Id
	private String id;

	@Column(name = "story_key", nullable = false, unique = true, length = 120)
	private String key;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(columnDefinition = "text")
	private String description;

	@Column(nullable = false)
	private int version;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private StoryStatus status = StoryStatus.DRAFT;

	@Column(nullable = false, length = 120)
	private String startSceneId;

	@Column(nullable = false, columnDefinition = "text")
	private String variablesJson = "{}";

	@Column(nullable = false, columnDefinition = "text")
	private String statsVariablesJson = "[]";

	@Column(length = 36)
	private String ownerPlayerId;

	@Column(length = 160, unique = true)
	private String publishedSlug;

	private Instant publishedAt;

	private Instant archivedAt;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected Story() {
	}

	Story(String key) {
		this.id = UUID.randomUUID().toString();
		this.key = key;
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

	String getKey() {
		return key;
	}

	String getTitle() {
		return title;
	}

	void setTitle(String title) {
		this.title = title;
	}

	String getDescription() {
		return description;
	}

	void setDescription(String description) {
		this.description = description;
	}

	int getVersion() {
		return version;
	}

	void setVersion(int version) {
		this.version = version;
	}

	StoryStatus getStatus() {
		return status;
	}

	void setStatus(StoryStatus status) {
		this.status = status;
	}

	String getStartSceneId() {
		return startSceneId;
	}

	void setStartSceneId(String startSceneId) {
		this.startSceneId = startSceneId;
	}

	String getVariablesJson() {
		return variablesJson;
	}

	void setVariablesJson(String variablesJson) {
		this.variablesJson = variablesJson;
	}

	String getStatsVariablesJson() {
		return statsVariablesJson;
	}

	void setStatsVariablesJson(String statsVariablesJson) {
		this.statsVariablesJson = statsVariablesJson;
	}

	String getOwnerPlayerId() {
		return ownerPlayerId;
	}

	void setOwnerPlayerId(String ownerPlayerId) {
		this.ownerPlayerId = ownerPlayerId;
	}

	String getPublishedSlug() {
		return publishedSlug;
	}

	void setPublishedSlug(String publishedSlug) {
		this.publishedSlug = publishedSlug;
	}

	Instant getPublishedAt() {
		return publishedAt;
	}

	void setPublishedAt(Instant publishedAt) {
		this.publishedAt = publishedAt;
	}

	Instant getArchivedAt() {
		return archivedAt;
	}

	void setArchivedAt(Instant archivedAt) {
		this.archivedAt = archivedAt;
	}

	Instant getUpdatedAt() {
		return updatedAt;
	}

	void touch() {
		this.updatedAt = Instant.now();
	}
}
