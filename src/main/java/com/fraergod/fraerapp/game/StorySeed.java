package com.fraergod.fraerapp.game;

import java.nio.charset.StandardCharsets;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
@org.springframework.core.annotation.Order(10)
class StorySeed implements CommandLineRunner {

	private final StoryRepository stories;
	private final StoryWorkflowService workflow;

	StorySeed(StoryRepository stories, StoryWorkflowService workflow) {
		this.stories = stories;
		this.workflow = workflow;
	}

	@Override
	public void run(String... args) throws Exception {
		if (stories.findByKey("night_train").isPresent()) {
			return;
		}
		String body = new String(new ClassPathResource("story/night-train.json").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		workflow.importDraft(body, null);
	}
}
