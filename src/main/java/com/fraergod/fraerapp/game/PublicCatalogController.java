package com.fraergod.fraerapp.game;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog/stories")
class PublicCatalogController {

	private final StoryProductService product;

	PublicCatalogController(StoryProductService product) {
		this.product = product;
	}

	@GetMapping
	List<StoryProductService.PublishedStorySummary> stories(@RequestHeader(name = "X-Player-Id", required = false) String playerId) {
		return product.publishedCatalog(playerId);
	}

	@GetMapping("/{slug}")
	StoryProductService.PublishedStoryDetails story(@PathVariable String slug) {
		return product.publishedStory(slug);
	}
}
