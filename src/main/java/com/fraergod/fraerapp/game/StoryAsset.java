package com.fraergod.fraerapp.game;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "assets")
class StoryAsset {

	@Id
	private String id;

	@Column(nullable = false, length = 36)
	private String storyId;

	@Column(nullable = false, length = 120)
	private String assetKey;

	@Column(nullable = false, length = 24)
	private String type;

	@Column(nullable = false, length = 500)
	private String url;

	@Lob
	@Column(nullable = false)
	private String metadataJson = "{}";

	protected StoryAsset() {
	}

	StoryAsset(String storyId, String assetKey, String type, String url, String metadataJson) {
		this.id = UUID.randomUUID().toString();
		this.storyId = storyId;
		this.assetKey = assetKey;
		this.type = type;
		this.url = url;
		this.metadataJson = metadataJson;
	}

	String getAssetKey() {
		return assetKey;
	}

	String getType() {
		return type;
	}

	String getUrl() {
		return url;
	}

	String getMetadataJson() {
		return metadataJson;
	}

	void update(String type, String url, String metadataJson) {
		this.type = type;
		this.url = url;
		this.metadataJson = metadataJson;
	}
}
