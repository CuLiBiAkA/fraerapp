package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "story_versions")
class StoryVersion {

	@Id
	private String id;

	@Column(nullable = false, length = 36)
	private String storyId;

	@Column(nullable = false)
	private int versionNumber;

	@Column(nullable = false, length = 24)
	private String status;

	@Lob
	@Column(nullable = false)
	private String snapshotJson;

	@Column(nullable = false, length = 120)
	private String note;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected StoryVersion() {
	}

	StoryVersion(String storyId, int versionNumber, StoryStatus status, String snapshotJson, String note) {
		this.id = UUID.randomUUID().toString();
		this.storyId = storyId;
		this.versionNumber = versionNumber;
		this.status = status.name();
		this.snapshotJson = snapshotJson;
		this.note = note;
	}

	@PrePersist
	void onCreate() {
		this.createdAt = Instant.now();
	}

	String getId() {
		return id;
	}

	String getStoryId() {
		return storyId;
	}

	int getVersionNumber() {
		return versionNumber;
	}

	StoryStatus getStatus() {
		return StoryStatus.valueOf(status);
	}

	String getSnapshotJson() {
		return snapshotJson;
	}

	String getNote() {
		return note;
	}

	Instant getCreatedAt() {
		return createdAt;
	}
}
