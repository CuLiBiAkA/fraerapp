package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

record StoryDocument(
		String key,
		String title,
		String description,
		int version,
		String startSceneId,
		Map<String, JsonNode> variables,
		List<AssetDocument> assets,
		List<SceneDocument> scenes) {

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
