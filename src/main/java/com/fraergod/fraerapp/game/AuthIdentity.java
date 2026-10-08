package com.fraergod.fraerapp.game;

import java.util.List;

record AuthIdentity(String userId, String email, List<String> roles, Boolean subscriptionActive) {
	AuthIdentity(String userId,String email,List<String> roles){this(userId,email,roles,null);}

	boolean hasRole(String role) {
		return roles != null && roles.contains(role);
	}
}
