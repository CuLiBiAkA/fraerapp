package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

record StoryDocument(
		String key,
		String title,
		String description,
		String genre,
		String completionStatus,
		int version,
		String startSceneId,
		Map<String, JsonNode> variables,
		List<AssetDocument> assets,
		List<SceneDocument> scenes,
		WorkMetadata metadata,
		String topic) {

	StoryDocument(String key, String title, String description, String genre, String completionStatus,
			int version, String startSceneId, Map<String, JsonNode> variables,
			List<AssetDocument> assets, List<SceneDocument> scenes, WorkMetadata metadata) {
		this(key,title,description,genre,completionStatus,version,startSceneId,variables,assets,scenes,metadata,null);
	}

	StoryDocument(String key, String title, String description, String genre, String completionStatus,
			int version, String startSceneId, Map<String, JsonNode> variables,
			List<AssetDocument> assets, List<SceneDocument> scenes) {
		this(key,title,description,genre,completionStatus,version,startSceneId,variables,assets,scenes,null);
	}

	record AssetDocument(String id, String type, String url, JsonNode metadata) {
	}

	record SceneDocument(
			String id,
			String title,
			String text,
			String background,
			String music,
			Map<String, JsonNode> variables,
			List<AssetDocument> assets,
			JsonNode animation,
			List<JsonNode> effects,
			JsonNode ending,
			List<ChoiceDocument> choices) {
	}

	record ChoiceDocument(
			String id,
			String label,
			String target,
			String fallbackTarget,
			List<JsonNode> conditions,
			List<JsonNode> effects) {
	}
}
