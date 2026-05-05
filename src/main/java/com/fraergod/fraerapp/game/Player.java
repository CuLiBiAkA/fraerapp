package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "players")
public class Player {

	@Id
	private String id;

	@Column(nullable = false, unique = true, length = 80)
	private String username;

	@Column(name = "user_id", unique = true, length = 36)
	private String userId;

	@Column(nullable = false, length = 80)
	private String currentNodeId;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected Player() {
	}

	public Player(String username, String currentNodeId) {
		this.id = UUID.randomUUID().toString();
		this.username = username;
		this.currentNodeId = currentNodeId;
	}

	public Player(String username, String currentNodeId, String userId) {
		this(username, currentNodeId);
		this.userId = userId;
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

	public String getId() {
		return id;
	}

	public String getUsername() {
		return username;
	}

	public String getUserId() {
		return userId;
	}

	public void setUserId(String userId) {
		this.userId = userId;
	}

	public String getCurrentNodeId() {
		return currentNodeId;
	}

	public void setCurrentNodeId(String currentNodeId) {
		this.currentNodeId = currentNodeId;
	}
}
