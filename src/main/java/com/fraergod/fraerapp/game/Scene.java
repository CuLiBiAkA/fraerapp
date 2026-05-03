package com.fraergod.fraerapp.game;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "scenes")
class Scene {

	@Id
	private String id;

	@Column(nullable = false, length = 36)
	private String storyId;

	@Column(nullable = false, length = 120)
	private String sceneKey;

	@Column(nullable = false, length = 200)
	private String title;

	@Lob
	@Column(nullable = false)
	private String text;

	@Column(length = 120)
	private String backgroundAssetId;

	@Column(length = 120)
	private String musicAssetId;

	@Lob
	@Column(nullable = false)
	private String animationJson = "{}";

	@Lob
	@Column(nullable = false)
	private String effectsJson = "[]";

	@Lob
	@Column(nullable = false)
	private String localVariablesJson = "{}";

	@Lob
	@Column(nullable = false)
	private String localAssetsJson = "[]";

	@Lob
	@Column(nullable = false)
	private String endingJson = "{}";

	@Column(nullable = false)
	private int orderIndex;

	protected Scene() {
	}

	Scene(String storyId, StoryDocument.SceneDocument scene, JsonSupport json, int orderIndex) {
		this.id = UUID.randomUUID().toString();
		this.storyId = storyId;
		this.sceneKey = scene.id();
		this.title = scene.title();
		this.text = scene.text();
		this.backgroundAssetId = scene.background();
		this.musicAssetId = scene.music();
		this.animationJson = json.writeObject(scene.animation());
		this.effectsJson = json.writeArray(scene.effects());
		this.localVariablesJson = json.writeVariables(scene.variables());
		this.localAssetsJson = json.write(scene.assets() == null ? java.util.List.of() : scene.assets());
		this.endingJson = json.writeObject(scene.ending());
		this.orderIndex = orderIndex;
	}

	String getId() {
		return id;
	}

	String getSceneKey() {
		return sceneKey;
	}

	String getTitle() {
		return title;
	}

	String getText() {
		return text;
	}

	String getBackgroundAssetId() {
		return backgroundAssetId;
	}

	String getMusicAssetId() {
		return musicAssetId;
	}

	String getAnimationJson() {
		return animationJson;
	}

	String getEffectsJson() {
		return effectsJson;
	}

	String getLocalVariablesJson() {
		return localVariablesJson;
	}

	String getLocalAssetsJson() {
		return localAssetsJson;
	}

	String getEndingJson() {
		return endingJson;
	}
}
