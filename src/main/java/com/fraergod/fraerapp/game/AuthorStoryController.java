package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/author")
class AuthorStoryController {

	private final StoryProductService product;
	private final CurrentUserService currentUser;

	AuthorStoryController(StoryProductService product, CurrentUserService currentUser) {
		this.product = product;
		this.currentUser = currentUser;
	}

	@GetMapping("/home")
	Map<String, Object> home() {
		return product.authorHome(currentUser.requireAuthorPlayerId());
	}

	@GetMapping("/stories")
	List<StoryProductService.AuthorStorySummary> stories() {
		return product.authoredStories(currentUser.requireAuthorPlayerId());
	}

	@GetMapping("/stories/{storyId}")
	StoryProductService.AuthorStoryDetails story(@PathVariable String storyId) {
		return product.authoredStory(currentUser.requireAuthorPlayerId(), storyId);
	}

	@GetMapping("/stories/{storyId}/document")
	Map<String, Object> storyDocument(@PathVariable String storyId) {
		return product.authoredStoryDocument(currentUser.requireAuthorPlayerId(), storyId);
	}

	@GetMapping("/stories/{storyId}/preview")
	Map<String, Object> preview(@PathVariable String storyId) {
		return product.previewForAuthor(currentUser.requireAuthorPlayerId(), storyId);
	}

	@GetMapping("/stories/{storyId}/versions")
	List<StoryAdminService.StoryVersionSummary> versions(@PathVariable String storyId) {
		return product.versionsForAuthor(currentUser.requireAuthorPlayerId(), storyId);
	}

	@GetMapping("/stories/{storyId}/analytics")
	StoryProductService.StoryAnalytics analytics(@PathVariable String storyId) {
		return product.analytics(currentUser.requireAuthorPlayerId(), storyId);
	}

	@DeleteMapping("/stories/{storyId}")
	Map<String, Object> deleteStory(@PathVariable String storyId) {
		product.deleteForAuthor(currentUser.requireAuthorPlayerId(), storyId);
		return Map.of("deleted", true, "storyId", storyId);
	}

	@PostMapping("/stories/{storyId}/validate")
	StoryValidationResult validate(@PathVariable String storyId) {
		return product.validateForAuthor(currentUser.requireAuthorPlayerId(), storyId);
	}

	@PostMapping("/stories/{storyId}/assets")
	StoryProductService.UploadedAsset uploadAsset(@PathVariable String storyId,
			@RequestParam("file") MultipartFile file,
			@RequestParam(name = "assetKey", required = false) String assetKey,
			@RequestParam(name = "type", required = false) String type,
			@RequestParam(name = "scope", required = false) String scope) {
		return product.uploadAssetForAuthor(currentUser.requireAuthorPlayerId(), storyId, file, assetKey, type, scope);
	}

	@DeleteMapping("/stories/{storyId}/assets")
	StoryProductService.DeletedAsset deleteAsset(@PathVariable String storyId,
			@RequestParam(name = "assetKey", required = false) String assetKey,
			@RequestParam(name = "url", required = false) String url) {
		return product.deleteAssetForAuthor(currentUser.requireAuthorPlayerId(), storyId, assetKey, url);
	}

	@PostMapping("/stories/import")
	StoryAdminService.ImportResponse importStory(@RequestBody String body) {
		return product.importForAuthor(currentUser.requireAuthorPlayerId(), body);
	}

	@PostMapping("/stories/{storyId}/publish")
	StoryAdminService.ImportResponse publish(@PathVariable String storyId) {
		return product.publishForAuthor(currentUser.requireAuthorPlayerId(), storyId);
	}

	@PostMapping("/stories/{storyId}/review")
	StoryAdminService.ImportResponse review(@PathVariable String storyId) {
		return product.submitForReview(currentUser.requireAuthorPlayerId(), storyId);
	}

	@PostMapping("/stories/{storyId}/archive")
	StoryAdminService.ImportResponse archive(@PathVariable String storyId) {
		return product.archiveForAuthor(currentUser.requireAuthorPlayerId(), storyId);
	}

	@PostMapping("/stories/{storyId}/versions/{versionNumber}/rollback")
	StoryAdminService.ImportResponse rollback(@PathVariable String storyId,
			@PathVariable int versionNumber) {
		return product.rollbackForAuthor(currentUser.requireAuthorPlayerId(), storyId, versionNumber);
	}
}
