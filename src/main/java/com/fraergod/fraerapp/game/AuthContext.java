package com.fraergod.fraerapp.game;

import java.util.Optional;

final class AuthContext {

	private static final ThreadLocal<AuthIdentity> CURRENT = new ThreadLocal<>();

	private AuthContext() {
	}

	static void set(AuthIdentity identity) {
		CURRENT.set(identity);
	}

	static Optional<AuthIdentity> current() {
		return Optional.ofNullable(CURRENT.get());
	}

	static void clear() {
		CURRENT.remove();
	}
}
