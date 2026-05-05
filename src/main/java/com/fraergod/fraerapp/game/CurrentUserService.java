package com.fraergod.fraerapp.game;

import java.security.MessageDigest;
import java.util.HexFormat;

import org.springframework.stereotype.Service;

@Service
class CurrentUserService {

	private final PlayerRepository players;

	CurrentUserService(PlayerRepository players) {
		this.players = players;
	}

	AuthIdentity requireIdentity() {
		return AuthContext.current().orElseThrow(AuthRequiredException::new);
	}

	AuthIdentity requireRole(String role) {
		AuthIdentity identity = requireIdentity();
		if (!identity.hasRole(role)) {
			throw new ForbiddenRoleException();
		}
		return identity;
	}

	String requirePlayerId() {
		AuthIdentity identity = requireRole("player");
		return players.findByUserId(identity.userId())
				.orElseGet(() -> players.save(new Player(displayName(identity), "legacy", identity.userId())))
				.getId();
	}

	String requireAuthorPlayerId() {
		AuthIdentity identity = requireRole("author");
		return players.findByUserId(identity.userId())
				.orElseGet(() -> players.save(new Player(displayName(identity), "legacy", identity.userId())))
				.getId();
	}

	void requireAdmin() {
		requireRole("admin");
	}

	String optionalPlayerId() {
		return AuthContext.current()
				.filter(identity -> identity.hasRole("player"))
				.flatMap(identity -> players.findByUserId(identity.userId()))
				.map(Player::getId)
				.orElse(null);
	}

	private String displayName(AuthIdentity identity) {
		String email = identity.email() == null ? "player" : identity.email();
		String prefix = email.length() <= 62 ? email : email.substring(0, 62);
		return prefix + "-" + shortHash(identity.userId());
	}

	private String shortHash(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes());
			return HexFormat.of().formatHex(digest).substring(0, 8);
		}
		catch (Exception ex) {
			return "user";
		}
	}
}
