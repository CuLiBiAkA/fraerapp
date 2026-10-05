package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Comparator;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog/stories")
class PublicCatalogController {

	private final StoryProductService product;
	private final CurrentUserService currentUser;

	PublicCatalogController(StoryProductService product, CurrentUserService currentUser) {
		this.product = product;
		this.currentUser = currentUser;
	}

	@GetMapping
	List<StoryProductService.PublishedStorySummary> stories(HttpServletResponse response) {
		response.setHeader("Cache-Control", "private, no-store");
		var stories = product.publishedCatalog(currentUser.optionalPlayerId());
		if (AuthContext.current().isPresent()) return stories;
		return stories.stream().filter(story -> GuestDemoStories.includes(story.key()))
			.sorted(Comparator.comparingInt(story -> GuestDemoStories.KEYS.indexOf(story.key()))).toList();
	}

	@GetMapping("/{slug}")
	StoryProductService.PublishedStoryDetails story(@PathVariable String slug, HttpServletResponse response) {
		response.setHeader("Cache-Control", "private, no-store");
		var story = product.publishedStory(slug);
		if (currentUser.optionalIdentity().isEmpty() && !GuestDemoStories.includes(story.key())) throw new AuthRequiredException();
		return story;
	}
}
