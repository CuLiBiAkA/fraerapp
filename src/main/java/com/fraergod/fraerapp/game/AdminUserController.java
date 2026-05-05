package com.fraergod.fraerapp.game;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
class AdminUserController {

	private final StoryAdminService admin;
	private final CurrentUserService currentUser;

	AdminUserController(StoryAdminService admin, CurrentUserService currentUser) {
		this.admin = admin;
		this.currentUser = currentUser;
	}

	@GetMapping("/runtime-stats")
	List<StoryAdminService.AdminUserRuntimeStats> runtimeStats(@RequestParam List<String> userIds) {
		currentUser.requireAdmin();
		return admin.userRuntimeStats(userIds);
	}
}
