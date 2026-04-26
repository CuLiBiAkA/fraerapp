package com.fraergod.fraerapp.game;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stories")
class AdminStoryController {

	private final StoryAdminService admin;
	private final String adminToken;

	AdminStoryController(StoryAdminService admin, @Value("${app.admin-token:dev-admin-token}") String adminToken) {
		this.admin = admin;
		this.adminToken = adminToken;
	}

	@PostMapping("/import")
	Object importStory(@RequestHeader(value = "X-Admin-Token", required = false) String token, @RequestBody String body) {
		requireAdmin(token);
		return admin.importStory(body);
	}

	@PostMapping("/{storyId}/validate")
	StoryValidationResult validate(@RequestHeader(value = "X-Admin-Token", required = false) String token, @PathVariable String storyId) {
		requireAdmin(token);
		return admin.validateStory(storyId);
	}

	@PostMapping("/{storyId}/publish")
	Object publish(@RequestHeader(value = "X-Admin-Token", required = false) String token, @PathVariable String storyId) {
		requireAdmin(token);
		return admin.publish(storyId);
	}

	private void requireAdmin(String token) {
		if (!adminToken.equals(token)) {
			throw new AdminRequiredException();
		}
	}
}
