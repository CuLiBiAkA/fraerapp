package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/author")
class AuthorStoryController {

	private final StoryProductService product;

	AuthorStoryController(StoryProductService product) {
		this.product = product;
	}

	@GetMapping("/home")
	Map<String, Object> home(@RequestHeader("X-Player-Id") String playerId) {
		return product.authorHome(playerId);
	}

	@GetMapping("/stories")
	List<StoryProductService.AuthorStorySummary> stories(@RequestHeader("X-Player-Id") String playerId) {
		return product.authoredStories(playerId);
	}

	@GetMapping("/stories/{storyId}")
	StoryProductService.AuthorStoryDetails story(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyId) {
		return product.authoredStory(playerId, storyId);
	}

	@GetMapping("/stories/{storyId}/document")
	Map<String, Object> storyDocument(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyId) {
		return product.authoredStoryDocument(playerId, storyId);
	}

	@GetMapping("/stories/{storyId}/analytics")
	StoryProductService.StoryAnalytics analytics(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyId) {
		return product.analytics(playerId, storyId);
	}

	@PostMapping("/stories/{storyId}/validate")
	StoryValidationResult validate(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyId) {
		return product.validateForAuthor(playerId, storyId);
	}

	@PostMapping("/stories/{storyId}/assets")
	StoryProductService.UploadedAsset uploadAsset(@RequestHeader("X-Player-Id") String playerId,
			@PathVariable String storyId,
			@RequestParam("file") MultipartFile file,
			@RequestParam(name = "assetKey", required = false) String assetKey,
			@RequestParam(name = "type", required = false) String type,
			@RequestParam(name = "scope", required = false) String scope) {
		return product.uploadAssetForAuthor(playerId, storyId, file, assetKey, type, scope);
	}

	@PostMapping("/stories/import")
	StoryAdminService.ImportResponse importStory(@RequestHeader("X-Player-Id") String playerId, @RequestBody String body) {
		return product.importForAuthor(playerId, body);
	}

	@PostMapping("/stories/{storyId}/publish")
	StoryAdminService.ImportResponse publish(@RequestHeader("X-Player-Id") String playerId, @PathVariable String storyId) {
		return product.publishForAuthor(playerId, storyId);
	}
}
