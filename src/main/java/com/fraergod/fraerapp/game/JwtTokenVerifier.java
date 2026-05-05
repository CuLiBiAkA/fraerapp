package com.fraergod.fraerapp.game;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
class JwtTokenVerifier {

	private final ObjectMapper json;
	private final byte[] secret;

	JwtTokenVerifier(@Value("${app.auth.jwt-secret}") String secret) {
		this.json = new ObjectMapper();
		this.secret = secret.getBytes(StandardCharsets.UTF_8);
	}

	AuthIdentity verify(String token) {
		try {
			String[] parts = token.split("\\.");
			if (parts.length != 3) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
			}
			String expected = sign(parts[0] + "." + parts[1]);
			if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
			}
			@SuppressWarnings("unchecked")
			Map<String, Object> claims = json.readValue(Base64.getUrlDecoder().decode(parts[1]), Map.class);
			Number exp = (Number) claims.get("exp");
			if (exp == null || Instant.ofEpochSecond(exp.longValue()).isBefore(Instant.now())) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token expired");
			}
			@SuppressWarnings("unchecked")
			List<String> roles = (List<String>) claims.getOrDefault("roles", List.of());
			return new AuthIdentity((String) claims.get("sub"), (String) claims.get("email"), roles);
		}
		catch (ResponseStatusException ex) {
			throw ex;
		}
		catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
		}
	}

	private String sign(String value) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(secret, "HmacSHA256"));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
	}
}
