package com.fraergod.fraerapp.game;

import java.util.List;

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
	List<StoryProductService.PublishedStorySummary> stories() {
		return product.publishedCatalog(currentUser.optionalPlayerId());
	}

	@GetMapping("/{slug}")
	StoryProductService.PublishedStoryDetails story(@PathVariable String slug) {
		return product.publishedStory(slug);
	}
}
