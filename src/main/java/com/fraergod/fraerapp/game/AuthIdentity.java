package com.fraergod.fraerapp.game;

import java.util.List;

record AuthIdentity(String userId, String email, List<String> roles) {

	boolean hasRole(String role) {
		return roles != null && roles.contains(role);
	}
}
