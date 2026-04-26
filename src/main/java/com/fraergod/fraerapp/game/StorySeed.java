package com.fraergod.fraerapp.game;

import java.nio.charset.StandardCharsets;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
class StorySeed implements CommandLineRunner {

	private final StoryRepository stories;
	private final StoryAdminService admin;

	StorySeed(StoryRepository stories, StoryAdminService admin) {
		this.stories = stories;
		this.admin = admin;
	}

	@Override
	public void run(String... args) throws Exception {
		if (stories.findByKey("night_train").isPresent()) {
			return;
		}
		String body = new String(new ClassPathResource("story/night-train.json").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		Object imported = admin.importStory(body);
		if (imported instanceof StoryAdminService.ImportResponse response) {
			admin.publish(response.storyId());
		}
	}
}
