package com.fraergod.fraerapp;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;

final class TestJwtFactory {

	private static final ObjectMapper JSON = new ObjectMapper();
	private static final byte[] SECRET = "dev-auth-secret-change-me-dev-auth-secret".getBytes(StandardCharsets.UTF_8);

	private TestJwtFactory() {
	}

	static String player(String email) {
		return token(email, List.of("player"));
	}

	static String author(String email) {
		return token(email, List.of("author", "player"));
	}

	static String admin(String email) {
		return token(email, List.of("admin", "author", "player"));
	}

	private static String token(String email, List<String> roles) {
		try {
			String normalized = email.toLowerCase();
			String userId = UUID.nameUUIDFromBytes(normalized.getBytes(StandardCharsets.UTF_8)).toString();
			Instant now = Instant.now();
			Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT", "kid", "test");
			Map<String, Object> claims = Map.of(
					"sub", userId,
					"email", normalized,
					"roles", roles,
					"sid", UUID.randomUUID().toString(),
					"iat", now.getEpochSecond(),
					"exp", now.plusSeconds(3600).getEpochSecond());
			String unsigned = part(header) + "." + part(claims);
			return unsigned + "." + sign(unsigned);
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static String part(Object value) throws Exception {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(JSON.writeValueAsBytes(value));
	}

	private static String sign(String value) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(SECRET, "HmacSHA256"));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
	}
}
