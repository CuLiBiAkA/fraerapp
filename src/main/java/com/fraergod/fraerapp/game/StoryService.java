package com.fraergod.fraerapp.game;

import java.io.IOException;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.core.io.ClassPathResource;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

class StoryService {

	private final ObjectMapper objectMapper;
	private StoryTree story;
	private Map<String, StoryNode> nodes;

	StoryService() {
		this.objectMapper = new ObjectMapper();
	}

	@PostConstruct
	void load() throws IOException {
		story = objectMapper.readValue(new ClassPathResource("story/demo-story.json").getInputStream(), StoryTree.class);
		nodes = story.nodes().stream().collect(Collectors.toUnmodifiableMap(StoryNode::id, Function.identity()));
		validate();
	}

	String startNodeId() {
		return story.startNodeId();
	}

	StoryNode node(String id) {
		StoryNode node = nodes.get(id);
		if (node == null) {
			throw new StoryConfigurationException("Unknown story node: " + id);
		}
		return node;
	}

	StoryNode applyChoice(String currentNodeId, String choiceId) {
		StoryNode currentNode = node(currentNodeId);
		return currentNode.choices().stream()
				.filter(choice -> choice.id().equals(choiceId))
				.findFirst()
				.map(choice -> node(choice.targetNodeId()))
				.orElseThrow(InvalidChoiceException::new);
	}

	private void validate() {
		if (!nodes.containsKey(story.startNodeId())) {
			throw new StoryConfigurationException("Start story node is missing: " + story.startNodeId());
		}

		for (StoryNode node : story.nodes()) {
			for (StoryChoice choice : node.choices()) {
				if (!nodes.containsKey(choice.targetNodeId())) {
					throw new StoryConfigurationException("Choice " + choice.id() + " points to missing node " + choice.targetNodeId());
				}
			}
		}
	}
}
