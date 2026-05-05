package com.fraergod.fraerapp.game;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stories")
class AdminStoryController {

	private final StoryAdminService admin;
	private final CurrentUserService currentUser;

	AdminStoryController(StoryAdminService admin, CurrentUserService currentUser) {
		this.admin = admin;
		this.currentUser = currentUser;
	}

	@PostMapping("/import")
	Object importStory(@RequestBody String body) {
		currentUser.requireAdmin();
		return admin.importStory(body);
	}

	@PostMapping("/{storyId}/validate")
	StoryValidationResult validate(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.validateStory(storyId);
	}

	@GetMapping("/{storyId}/preview")
	Object preview(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.preview(storyId, null);
	}

	@GetMapping("/{storyId}/versions")
	Object versions(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.versions(storyId, null);
	}

	@PostMapping("/{storyId}/publish")
	Object publish(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.publish(storyId);
	}

	@PostMapping("/{storyId}/review")
	Object review(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.submitForReview(storyId, null);
	}

	@PostMapping("/{storyId}/archive")
	Object archive(@PathVariable String storyId) {
		currentUser.requireAdmin();
		return admin.archive(storyId, null);
	}

	@PostMapping("/{storyId}/versions/{versionNumber}/rollback")
	Object rollback(@PathVariable String storyId,
			@PathVariable int versionNumber) {
		currentUser.requireAdmin();
		return admin.rollback(storyId, versionNumber, null);
	}
}
