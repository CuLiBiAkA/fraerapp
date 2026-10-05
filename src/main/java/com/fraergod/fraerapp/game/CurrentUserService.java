package com.fraergod.fraerapp.game;

import java.security.MessageDigest;
import java.util.HexFormat;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
class CurrentUserService {

	private final PlayerRepository players;
	private final CurrentSessionClient currentSession;

	CurrentUserService(PlayerRepository players, CurrentSessionClient currentSession) {
		this.players = players;
		this.currentSession = currentSession;
	}

	AuthIdentity requireIdentity() {
		return currentSession.current(AuthContext.current().orElseThrow(AuthRequiredException::new));
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
		return playerFor(identity).getId();
	}

	String requireAuthorPlayerId() {
		AuthIdentity identity = requireIdentity();
		if (!identity.hasRole("author") && !identity.hasRole("admin")) {
			throw new ForbiddenRoleException();
		}
		return playerFor(identity).getId();
	}

	void requireAdmin() {
		requireRole("admin");
	}

	AuthIdentity requireModerator() {
		AuthIdentity identity = requireIdentity();
		if (!identity.hasRole("moderator") && !identity.hasRole("admin")) throw new ForbiddenRoleException();
		return identity;
	}

	String requireOwnerReaderPlayerId() { return playerFor(requireIdentity()).getId(); }

	java.util.Optional<AuthIdentity> optionalIdentity() { return AuthContext.current().map(ignored -> requireIdentity()); }

	String optionalPlayerId() {
		return optionalIdentity()
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

	private Player playerFor(AuthIdentity identity) {
		return players.findByUserId(identity.userId()).orElseGet(() -> createPlayer(identity));
	}

	private Player createPlayer(AuthIdentity identity) {
		try {
			return players.save(new Player(displayName(identity), "legacy", identity.userId()));
		}
		catch (DataIntegrityViolationException ex) {
			return players.findByUserId(identity.userId()).orElseThrow(() -> ex);
		}
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
