package com.fraergod.fraerapp.auth;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.Extensions;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.RegistrationExtensionInputs;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Component
class PasskeyService {

	private static final String REGISTRATION = "registration";
	private static final String AUTHENTICATION = "authentication";

	private final PasskeyRepository repository;
	private final AuthStore users;
	private final RelyingParty relyingParty;
	private final ObjectMapper json = new ObjectMapper();
	private final long challengeTtlSeconds;

	PasskeyService(PasskeyRepository repository,
			AuthStore users,
			@Value("${auth.passkey.rp-id:localhost}") String rpId,
			@Value("${auth.passkey.rp-name:FraerApp}") String rpName,
			@Value("${auth.passkey.origins:http://localhost:8088,http://localhost:8090}") String origins,
			@Value("${auth.passkey.challenge-ttl-seconds:300}") long challengeTtlSeconds) {
		this.repository = repository;
		this.users = users;
		this.challengeTtlSeconds = challengeTtlSeconds;
		Set<String> allowedOrigins = java.util.Arrays.stream(origins.split(","))
				.map(String::trim)
				.filter(origin -> !origin.isBlank())
				.collect(java.util.stream.Collectors.toUnmodifiableSet());
		if (allowedOrigins.isEmpty()) {
			throw new IllegalArgumentException("At least one passkey origin is required");
		}
		this.relyingParty = RelyingParty.builder()
				.identity(RelyingPartyIdentity.builder().id(rpId).name(rpName).build())
				.credentialRepository(repository)
				.origins(allowedOrigins)
				.allowOriginPort(false)
				.allowOriginSubdomain(false)
				.allowUntrustedAttestation(true)
				.validateSignatureCounter(true)
				.build();
	}

	String startRegistration(User user) {
		UserIdentity identity = UserIdentity.builder()
				.name(user.email())
				.displayName(user.email())
				.id(userHandle(user.id()))
				.build();
		AuthenticatorSelectionCriteria selection = AuthenticatorSelectionCriteria.builder()
				.residentKey(ResidentKeyRequirement.REQUIRED)
				.userVerification(UserVerificationRequirement.REQUIRED)
				.build();
		PublicKeyCredentialCreationOptions request = relyingParty.startRegistration(
				StartRegistrationOptions.builder()
						.user(identity)
						.authenticatorSelection(selection)
						.extensions(RegistrationExtensionInputs.builder()
								.credProps()
								.credProtect(Extensions.CredentialProtection.CredentialProtectionInput.prefer(
										Extensions.CredentialProtection.CredentialProtectionPolicy.UV_REQUIRED))
								.build())
						.timeout(challengeTtlSeconds * 1000)
						.build());
		String challengeId = repository.createChallenge(
				REGISTRATION, user.id(), toJson(request), Instant.now().plusSeconds(challengeTtlSeconds));
		users.audit(user.id(), user.email(), "passkey_registration_started", "{}");
		return envelope(challengeId, credentialsJson(request));
	}

	PasskeyView finishRegistration(User user, String challengeId, String displayName, Map<String, Object> credential) {
		PasskeyChallenge challenge = repository.consumeChallenge(challengeId, REGISTRATION)
				.orElseThrow(() -> {
					users.audit(user.id(), user.email(), "passkey_registration_failed", "{}");
					return badRequest("Passkey registration challenge expired");
				});
		if (!user.id().equals(challenge.userId())) {
			users.audit(user.id(), user.email(), "passkey_registration_failed", "{}");
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Passkey challenge belongs to another user");
		}
		try {
			PublicKeyCredentialCreationOptions request = PublicKeyCredentialCreationOptions.fromJson(challenge.requestJson());
			RegistrationResult result = relyingParty.finishRegistration(FinishRegistrationOptions.builder()
					.request(request)
					.response(PublicKeyCredential.parseRegistrationResponseJson(json.writeValueAsString(credential)))
					.build());
			if (!result.isUserVerified() || result.isDiscoverable().filter(discoverable -> !discoverable).isPresent()) {
				throw badRequest("A verified discoverable passkey is required");
			}
			String safeName = normalizeName(displayName);
			repository.saveCredential(user, result, safeName);
			users.audit(user.id(), user.email(), "passkey_registered",
					json.writeValueAsString(Map.of("credentialId", result.getKeyId().getId().getBase64Url(), "name", safeName)));
			return repository.credential(user.id(), result.getKeyId().getId().getBase64Url()).orElseThrow();
		}
		catch (ResponseStatusException ex) {
			users.audit(user.id(), user.email(), "passkey_registration_failed", "{}");
			throw ex;
		}
		catch (Exception ex) {
			users.audit(user.id(), user.email(), "passkey_registration_failed", "{}");
			throw badRequest("Passkey registration failed");
		}
	}

	String startAuthentication() {
		AssertionRequest request = relyingParty.startAssertion(StartAssertionOptions.builder()
				.userVerification(UserVerificationRequirement.REQUIRED)
				.timeout(challengeTtlSeconds * 1000)
				.build());
		String challengeId = repository.createChallenge(
				AUTHENTICATION, null, toJson(request), Instant.now().plusSeconds(challengeTtlSeconds));
		return envelope(challengeId, credentialsJson(request));
	}

	User finishAuthentication(String challengeId, Map<String, Object> credential) {
		PasskeyChallenge challenge = repository.consumeChallenge(challengeId, AUTHENTICATION).orElse(null);
		if (challenge == null) {
			users.audit(null, null, "passkey_authentication_failed", "{}");
			throw unauthorized("Passkey authentication failed");
		}
		try {
			AssertionRequest request = AssertionRequest.fromJson(challenge.requestJson());
			AssertionResult result = relyingParty.finishAssertion(FinishAssertionOptions.builder()
					.request(request)
					.response(PublicKeyCredential.parseAssertionResponseJson(json.writeValueAsString(credential)))
					.build());
			if (!result.isSuccess() || !result.isUserVerified()) {
				throw unauthorized("Passkey authentication failed");
			}
			User user = users.userByEmail(AuthServiceApplication.normalizeEmail(result.getUsername()))
					.orElseThrow(() -> unauthorized("Passkey authentication failed"));
			if (user.blockedAt() != null) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
			}
			repository.markUsed(result);
			users.audit(user.id(), user.email(), "passkey_authenticated",
					json.writeValueAsString(Map.of("credentialId", result.getCredential().getCredentialId().getBase64Url())));
			return user;
		}
		catch (ResponseStatusException ex) {
			users.audit(null, null, "passkey_authentication_failed", "{}");
			throw ex;
		}
		catch (Exception ex) {
			users.audit(null, null, "passkey_authentication_failed", "{}");
			throw unauthorized("Passkey authentication failed");
		}
	}

	List<PasskeyView> credentials(User user) {
		return repository.credentials(user.id());
	}

	void deleteCredential(User user, String credentialId) {
		if (!repository.deleteCredential(user.id(), credentialId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Passkey not found");
		}
		users.audit(user.id(), user.email(), "passkey_deleted",
				json(Map.of("credentialId", credentialId)));
	}

	private String envelope(String challengeId, String credentialsJson) {
		try {
			JsonNode parsed = json.readTree(credentialsJson);
			if (!(parsed instanceof ObjectNode root)) {
				throw new IllegalStateException("Unexpected WebAuthn options JSON");
			}
			root.put("challengeId", challengeId);
			return json.writeValueAsString(root);
		}
		catch (Exception ex) {
			throw new IllegalStateException("Cannot encode WebAuthn options", ex);
		}
	}

	private String credentialsJson(PublicKeyCredentialCreationOptions request) {
		try {
			return request.toCredentialsCreateJson();
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String credentialsJson(AssertionRequest request) {
		try {
			return request.toCredentialsGetJson();
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String toJson(PublicKeyCredentialCreationOptions request) {
		try {
			return request.toJson();
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String toJson(AssertionRequest request) {
		try {
			return request.toJson();
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String normalizeName(String displayName) {
		String value = displayName == null ? "" : displayName.trim();
		if (value.isBlank()) {
			return "Passkey";
		}
		return value.length() > 120 ? value.substring(0, 120) : value;
	}

	private String json(Map<String, Object> value) {
		try {
			return json.writeValueAsString(value);
		}
		catch (Exception ex) {
			return "{}";
		}
	}

	private ByteArray userHandle(String userId) {
		return new ByteArray(userId.getBytes(StandardCharsets.UTF_8));
	}

	private ResponseStatusException badRequest(String message) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
	}

	private ResponseStatusException unauthorized(String message) {
		return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
	}
}

@Repository
class PasskeyRepository implements CredentialRepository {

	private final JdbcTemplate jdbc;

	PasskeyRepository(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	String createChallenge(String ceremonyType, String userId, String requestJson, Instant expiresAt) {
		String id = UUID.randomUUID().toString();
		Instant now = Instant.now();
		jdbc.update("delete from passkey_challenges where expires_at < ?", timestamp(now.minusSeconds(86400)));
		jdbc.update("""
				insert into passkey_challenges(id, ceremony_type, user_id, request_json, created_at, expires_at)
				values (?, ?, ?, ?, ?, ?)
				""", id, ceremonyType, userId, requestJson, timestamp(now), timestamp(expiresAt));
		return id;
	}

	Optional<PasskeyChallenge> consumeChallenge(String id, String ceremonyType) {
		List<PasskeyChallenge> values = jdbc.query("""
				select id, ceremony_type, user_id, request_json, expires_at
				from passkey_challenges
				where id = ? and ceremony_type = ? and used_at is null and expires_at > ?
				""", (rs, row) -> new PasskeyChallenge(
				rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getTimestamp(5).toInstant()),
				id, ceremonyType, timestamp(Instant.now()));
		if (values.isEmpty()) {
			return Optional.empty();
		}
		int consumed = jdbc.update("""
				update passkey_challenges set used_at = ?
				where id = ? and ceremony_type = ? and used_at is null and expires_at > ?
				""", timestamp(Instant.now()), id, ceremonyType, timestamp(Instant.now()));
		return consumed == 1 ? Optional.of(values.get(0)) : Optional.empty();
	}

	// Yubico 2.7 marks BE/BS accessors experimental but recommends persisting both flags.
	@SuppressWarnings("deprecation")
	void saveCredential(User user, RegistrationResult result, String displayName) {
		jdbc.update("""
				insert into passkey_credentials(
					credential_id, user_id, user_handle, public_key_cose, signature_count,
					backup_eligible, backup_state, display_name, created_at
				) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
				""",
				result.getKeyId().getId().getBase64Url(),
				user.id(),
				userHandle(user.id()).getBase64Url(),
				result.getPublicKeyCose().getBase64Url(),
				result.getSignatureCount(),
				result.isBackupEligible(),
				result.isBackedUp(),
				displayName,
				timestamp(Instant.now()));
	}

	@SuppressWarnings("deprecation")
	void markUsed(AssertionResult result) {
		jdbc.update("""
				update passkey_credentials
				set signature_count = ?, backup_eligible = ?, backup_state = ?, last_used_at = ?
				where credential_id = ?
				""", result.getSignatureCount(), result.isBackupEligible(), result.isBackedUp(),
				timestamp(Instant.now()), result.getCredential().getCredentialId().getBase64Url());
	}

	List<PasskeyView> credentials(String userId) {
		return jdbc.query("""
				select credential_id, display_name, backup_eligible, backup_state, created_at, last_used_at
				from passkey_credentials where user_id = ? order by created_at desc
				""", (rs, row) -> new PasskeyView(
				rs.getString(1), rs.getString(2), rs.getBoolean(3), rs.getBoolean(4),
				rs.getTimestamp(5).toInstant(), instant(rs.getTimestamp(6))), userId);
	}

	Optional<PasskeyView> credential(String userId, String credentialId) {
		return credentials(userId).stream().filter(value -> value.credentialId().equals(credentialId)).findFirst();
	}

	boolean deleteCredential(String userId, String credentialId) {
		return jdbc.update("delete from passkey_credentials where user_id = ? and credential_id = ?", userId, credentialId) == 1;
	}

	@Override
	public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
		return jdbc.queryForList("""
				select pc.credential_id from passkey_credentials pc
				join users u on u.id = pc.user_id where u.email = ?
				""", String.class, AuthServiceApplication.normalizeEmail(username)).stream()
				.map(this::decode)
				.map(id -> PublicKeyCredentialDescriptor.builder().id(id).build())
				.collect(java.util.stream.Collectors.toUnmodifiableSet());
	}

	@Override
	public Optional<ByteArray> getUserHandleForUsername(String username) {
		List<String> ids = jdbc.queryForList("select id from users where email = ?", String.class,
				AuthServiceApplication.normalizeEmail(username));
		return ids.stream().findFirst().map(this::userHandle);
	}

	@Override
	public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
		String id = new String(userHandle.getBytes(), StandardCharsets.UTF_8);
		List<String> emails = jdbc.queryForList("select email from users where id = ?", String.class, id);
		return emails.stream().findFirst();
	}

	@Override
	public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
		return lookupAll(credentialId).stream()
				.filter(value -> value.getUserHandle().equals(userHandle))
				.findFirst();
	}

	@Override
	@SuppressWarnings("deprecation")
	public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
		return jdbc.query("""
				select credential_id, user_handle, public_key_cose, signature_count, backup_eligible, backup_state
				from passkey_credentials where credential_id = ?
				""", (rs, row) -> RegisteredCredential.builder()
				.credentialId(decode(rs.getString(1)))
				.userHandle(decode(rs.getString(2)))
				.publicKeyCose(decode(rs.getString(3)))
				.signatureCount(rs.getLong(4))
				.backupEligible(rs.getBoolean(5))
				.backupState(rs.getBoolean(6))
				.build(), credentialId.getBase64Url()).stream().collect(java.util.stream.Collectors.toUnmodifiableSet());
	}

	private ByteArray userHandle(String userId) {
		return new ByteArray(userId.getBytes(StandardCharsets.UTF_8));
	}

	private ByteArray decode(String value) {
		try {
			return ByteArray.fromBase64Url(value);
		}
		catch (Exception ex) {
			throw new IllegalStateException("Invalid stored passkey data", ex);
		}
	}

	private Instant instant(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	private Timestamp timestamp(Instant instant) {
		return Timestamp.from(instant);
	}
}

record PasskeyChallenge(String id, String ceremonyType, String userId, String requestJson, Instant expiresAt) {
}

record PasskeyView(
		String credentialId,
		String displayName,
		boolean backupEligible,
		boolean backedUp,
		Instant createdAt,
		Instant lastUsedAt) {
}
