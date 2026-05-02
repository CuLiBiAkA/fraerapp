package com.fraergod.fraerapp.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

@Component
class JsonSupport {

	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};
	private static final TypeReference<List<JsonNode>> NODE_LIST_TYPE = new TypeReference<>() {
	};

	private final ObjectMapper mapper = new ObjectMapper();

	StoryDocument readStory(String json) {
		try {
			return mapper.readValue(json, StoryDocument.class);
		} catch (Exception ex) {
			throw new IllegalArgumentException("Invalid story JSON", ex);
		}
	}

	String writeVariables(Map<String, JsonNode> variables) {
		Map<String, Object> values = new LinkedHashMap<>();
		if (variables != null) {
			for (Map.Entry<String, JsonNode> entry : variables.entrySet()) {
				values.put(entry.getKey(), mapper.convertValue(variableValue(entry.getValue()), Object.class));
			}
		}
		return write(values);
	}

	String writeStatsVariables(Map<String, JsonNode> variables) {
		List<String> names = new ArrayList<>();
		if (variables != null) {
			for (Map.Entry<String, JsonNode> entry : variables.entrySet()) {
				JsonNode node = entry.getValue();
				if (node != null && node.isObject() && node.path("showInStats").asBoolean(false)) {
					names.add(entry.getKey());
				}
			}
		}
		return write(names);
	}

	String writeObject(JsonNode node) {
		return node == null || node.isNull() ? "{}" : write(node);
	}

	String writeArray(List<JsonNode> nodes) {
		return nodes == null ? "[]" : write(nodes);
	}

	String write(Object value) {
		try {
			return mapper.writeValueAsString(value);
		} catch (Exception ex) {
			throw new IllegalArgumentException("Cannot write JSON", ex);
		}
	}

	Map<String, Object> readMap(String json) {
		try {
			if (json == null || json.isBlank()) {
				return new LinkedHashMap<>();
			}
			return new LinkedHashMap<>(mapper.readValue(json, MAP_TYPE));
		} catch (Exception ex) {
			throw new IllegalArgumentException("Cannot read JSON map", ex);
		}
	}

	List<JsonNode> readNodeList(String json) {
		try {
			if (json == null || json.isBlank()) {
				return List.of();
			}
			return mapper.readValue(json, NODE_LIST_TYPE);
		} catch (Exception ex) {
			throw new IllegalArgumentException("Cannot read JSON array", ex);
		}
	}

	List<String> readStringList(String json) {
		try {
			if (json == null || json.isBlank()) {
				return List.of();
			}
			List<JsonNode> nodes = mapper.readValue(json, NODE_LIST_TYPE);
			return nodes.stream()
					.filter(JsonNode::isTextual)
					.map(JsonNode::asText)
					.toList();
		} catch (Exception ex) {
			throw new IllegalArgumentException("Cannot read JSON string list", ex);
		}
	}

	Object readObject(String json) {
		try {
			if (json == null || json.isBlank() || "{}".equals(json)) {
				return null;
			}
			JsonNode node = mapper.readTree(json);
			return node == null || node.isNull() || (node.isObject() && node.isEmpty()) ? null : mapper.convertValue(node, Object.class);
		} catch (Exception ex) {
			throw new IllegalArgumentException("Cannot read JSON object", ex);
		}
	}

	JsonNode valueToNode(Object value) {
		return mapper.valueToTree(value);
	}

	List<JsonNode> emptyNodeList() {
		return new ArrayList<>();
	}

	JsonNode nullNode() {
		return JsonNodeFactory.instance.nullNode();
	}

	private JsonNode variableValue(JsonNode node) {
		if (node != null && node.isObject() && node.has("value")) {
			return node.get("value");
		}
		return node;
	}
}
