package com.fraergod.fraerapp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class AuthControllerTests {

	private JdbcTemplate jdbc;
	private AuthStore store;
	private AuthController controller;
	private JwtCodec jwt;
	private PasskeyService passkeys;
	private FakeTelegramMessenger telegram;

	@BeforeEach
	void setUp() {
		DriverManagerDataSource dataSource = new DriverManagerDataSource();
		dataSource.setDriverClassName("org.h2.Driver");
		dataSource.setUrl("jdbc:h2:mem:auth-" + System.nanoTime()
				+ ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1");
		ResourceDatabasePopulator schema = new ResourceDatabasePopulator(
				new ClassPathResource("db/migration/V1__create_auth_schema.sql"),
				new ClassPathResource("db/migration/V2__add_user_blocking.sql"),
				new ClassPathResource("db/migration/V4__add_personal_data_consents.sql"),
				new ClassPathResource("db/migration/V5__add_passkeys.sql"),
				new ClassPathResource("db/migration/V6__add_telegram_identities.sql"));
		schema.execute(dataSource);
		jdbc = new JdbcTemplate(dataSource);
		store = new AuthStore(jdbc);
		jwt = new JwtCodec("test-secret-test-secret-test-secret");
		passkeys = new PasskeyService(new PasskeyRepository(jdbc), store,
				"localhost", "FraerApp Test", "http://localhost:8088", 300);
		telegram = new FakeTelegramMessenger();
		controller = new AuthController(store, jwt, Optional.empty(), passkeys, telegram);
		ReflectionTestUtils.setField(controller, "magicLinkTtl", 900L);
		ReflectionTestUtils.setField(controller, "accessTtl", 900L);
		ReflectionTestUtils.setField(controller, "refreshTtl", 2592000L);
		ReflectionTestUtils.setField(controller, "cookieSecure", false);
		ReflectionTestUtils.setField(controller, "sameSite", "Lax");
		ReflectionTestUtils.setField(controller, "devMode", true);
		ReflectionTestUtils.setField(controller, "adminLoginLinkLogEnabled", false);
		ReflectionTestUtils.setField(controller, "publicBaseUrl", "http://localhost:8088");
		ReflectionTestUtils.setField(controller, "bootstrapAdminEmail", "");
		ReflectionTestUtils.setField(controller, "smtpFrom", "noreply@fraerapp.ru");
		ReflectionTestUtils.setField(controller, "smtpHost", "");
		ReflectionTestUtils.setField(controller, "privacyPolicyVersion", "2026-06-21");
		ReflectionTestUtils.setField(controller, "passkeyRegistrationRecentAuthSeconds", 600L);
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", false);
		ReflectionTestUtils.setField(controller, "telegramBotUsername", "");
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "");
		ReflectionTestUtils.setField(controller, "telegramLoginRedirectPath", "/");
	}

	@Test
	void existingUserCanReceiveNewLinkAndPreviousLinkIsInvalidated() {
		String email = "existing@example.test";
		User existing = store.user(email, true).orElseThrow();
		MockHttpServletRequest request = request();

		controller.loginLink(new AuthController.LoginLinkRequest(email, "/", true), request);
		String firstToken = latestDevToken(email);

		User admin = store.user("admin@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminEmail = admin.email();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));
		Map<String, Object> adminResponse = controller.adminLoginLink("Bearer " + adminJwt, null,
				new AuthController.AdminLoginLinkRequest(email, "/"), request);
		String secondToken = tokenFromUrl((String) adminResponse.get("loginUrl"));

		assertThat(secondToken).isNotEqualTo(firstToken);
		assertThatThrownBy(() -> controller.verify(new AuthController.VerifyRequest(firstToken), new MockHttpServletResponse()))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("expired");

		Map<String, Object> verified = controller.verify(
				new AuthController.VerifyRequest(secondToken), new MockHttpServletResponse());
		@SuppressWarnings("unchecked")
		Map<String, Object> user = (Map<String, Object>) verified.get("user");
		assertThat(user.get("id")).isEqualTo(existing.id());
		assertThat(jdbc.queryForObject("select count(*) from personal_data_consents where email = ?", Long.class, email))
				.isEqualTo(1L);
	}

	@Test
	void publicLoginLinkRequiresSeparateConsent() {
		assertThatThrownBy(() -> controller.loginLink(
				new AuthController.LoginLinkRequest("user@example.test", "/", false), request()))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("consent");
		assertThat(jdbc.queryForObject("select count(*) from personal_data_consents", Long.class)).isZero();
	}

	@Test
	void publicLoginLinkNeverReturnsUrlWhenSmtpIsDisabled() {
		ReflectionTestUtils.setField(controller, "devMode", false);

		Map<String, Object> response = controller.loginLink(
				new AuthController.LoginLinkRequest("user@example.test", "/", true), request());

		assertThat(response).containsExactly(Map.entry("sent", true));
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
	}

	@Test
	void noSmtpLogFallbackCreatesLinkOnlyForAdminAndNeverReturnsIt() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		ReflectionTestUtils.setField(controller, "adminLoginLinkLogEnabled", true);
		String adminEmail = "admin@example.test";
		User admin = store.user(adminEmail, true).orElseThrow();
		store.grantRole(admin.id(), "admin");

		Map<String, Object> adminResponse = controller.loginLink(
				new AuthController.LoginLinkRequest(adminEmail, "/auth/admin", true), request());
		Map<String, Object> userResponse = controller.loginLink(
				new AuthController.LoginLinkRequest("user@example.test", "/", true), request());

		assertThat(adminResponse).containsExactly(Map.entry("sent", true));
		assertThat(userResponse).containsExactly(Map.entry("sent", true));
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ?", Long.class, adminEmail))
				.isEqualTo(1L);
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ?", Long.class,
				"user@example.test")).isZero();
	}

	@Test
	void anonymousAndRegularUserCannotGetAdminLoginLink() {
		String targetEmail = "existing@example.test";
		store.user(targetEmail, true).orElseThrow();

		assertThatThrownBy(() -> controller.adminLoginLink(null, null,
				new AuthController.AdminLoginLinkRequest(targetEmail, "/"), request()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(401));

		User regularUser = store.user("regular@example.test", true).orElseThrow();
		String regularJwt = jwt.encode(regularUser, "regular-session", Instant.now().plusSeconds(900));
		assertThatThrownBy(() -> controller.adminLoginLink("Bearer " + regularJwt, null,
				new AuthController.AdminLoginLinkRequest(targetEmail, "/"), request()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(403));

		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
	}

	@Test
	void adminGetsLoginUrlWithoutSmtpForExistingUnblockedUser() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		String targetEmail = "existing@example.test";
		store.user(targetEmail, true).orElseThrow();
		User admin = store.user("admin@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminEmail = admin.email();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));

		Map<String, Object> response = controller.adminLoginLink("Bearer " + adminJwt, null,
				new AuthController.AdminLoginLinkRequest(targetEmail, "/"), request());

		assertThat(response.get("email")).isEqualTo(targetEmail);
		assertThat(response.get("loginUrl")).asString().startsWith("http://localhost:8088/");
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ?", Long.class, targetEmail))
				.isEqualTo(1L);
		assertThat(jdbc.queryForObject(
				"select count(*) from auth_audit_events where event_type = 'admin_login_link_requested'", Long.class))
				.isEqualTo(1L);
	}

	@Test
	void adminCannotCreateLoginUrlForMissingOrBlockedUser() {
		User admin = store.user("admin@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));

		assertThatThrownBy(() -> controller.adminLoginLink("Bearer " + adminJwt, null,
				new AuthController.AdminLoginLinkRequest("missing@example.test", "/"), request()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(404));

		User blocked = store.user("blocked@example.test", true).orElseThrow();
		store.blockUser(blocked.id());
		assertThatThrownBy(() -> controller.adminLoginLink("Bearer " + adminJwt, null,
				new AuthController.AdminLoginLinkRequest(blocked.email(), "/"), request()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(409));

		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
	}

	@Test
	void adminCanSeePublicLoginRequestsAndCreateUserWithAuthorLink() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		String requestedEmail = "future-author@example.test";
		controller.loginLink(new AuthController.LoginLinkRequest(requestedEmail, "/", true), request());
		User admin = store.user("admin@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));

		AuthController.AdminLoginRequestPage requests = controller.loginRequests("Bearer " + adminJwt, null, 0, 20, "future");

		assertThat(requests.totalElements()).isEqualTo(1L);
		assertThat(requests.items()).singleElement().satisfies(item -> {
			assertThat(item.email()).isEqualTo(requestedEmail);
			assertThat(item.userId()).isNull();
			assertThat(item.requestCount()).isEqualTo(1L);
		});

		Map<String, Object> response = controller.adminLoginLink("Bearer " + adminJwt, null,
				new AuthController.AdminLoginLinkRequest(requestedEmail, "/", true, java.util.List.of("author")),
				request());

		assertThat(response.get("loginUrl")).asString().startsWith("http://localhost:8088/");
		User created = store.userByEmail(requestedEmail).orElseThrow();
		assertThat(created.roles()).contains("player", "author");
	}

	@Test
	void adminCanDeleteLoginRequestWithoutDeletingUser() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		String requestedEmail = "delete-request@example.test";
		controller.loginLink(new AuthController.LoginLinkRequest(requestedEmail, "/", true), request());
		User user = store.user(requestedEmail, true).orElseThrow();
		store.createMagicLink(requestedEmail, sha256("unused-login-token"), "/", Instant.now().plusSeconds(900));
		User admin = store.user("admin-delete-request@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));

		Map<String, Object> response = controller.deleteLoginRequest("Bearer " + adminJwt, null,
				new AuthController.DeleteLoginRequest(requestedEmail));

		assertThat(response).containsEntry("deleted", true).containsEntry("email", requestedEmail);
		assertThat(response.get("requestEventsDeleted")).isEqualTo(1);
		assertThat(response.get("unusedLinksDeleted")).isEqualTo(1);
		assertThat(store.userByEmail(requestedEmail)).contains(user);
		assertThat(controller.loginRequests("Bearer " + adminJwt, null, 0, 20, requestedEmail).totalElements()).isZero();
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ?", Long.class,
				requestedEmail)).isZero();
	}

	@Test
	void adminCanDeleteUserButNotCurrentAccount() {
		User admin = store.user("admin@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		admin = store.userById(admin.id()).orElseThrow();
		String adminEmail = admin.email();
		String adminJwt = jwt.encode(admin, "admin-session", Instant.now().plusSeconds(900));
		User target = store.user("delete-me@example.test", true).orElseThrow();
		store.createSession("target-session", target.id(), Instant.now().plusSeconds(3600), "magic_link", Instant.now());
		store.createRefresh("target-refresh", "target-session", sha256("refresh"), Instant.now().plusSeconds(3600));
		store.createMagicLink(target.email(), sha256("login-token"), "/", Instant.now().plusSeconds(900));

		Map<String, Object> response = controller.deleteUser("Bearer " + adminJwt, null,
				new AuthController.DeleteUserRequest(target.email()));

		assertThat(response).containsEntry("deleted", true).containsEntry("email", target.email());
		assertThat(store.userByEmail(target.email())).isEmpty();
		assertThat(jdbc.queryForObject("select count(*) from sessions where user_id = ?", Long.class, target.id())).isZero();
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ?", Long.class, target.email())).isZero();
		assertThatThrownBy(() -> controller.deleteUser("Bearer " + adminJwt, null,
				new AuthController.DeleteUserRequest(adminEmail)))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(409));
	}

	@Test
	void telegramLoginConfigReturnsBotUrlWhenEnabled() {
		telegram.enabled = true;
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", true);
		ReflectionTestUtils.setField(controller, "telegramBotUsername", "@culibiaka_bot");

		Map<String, Object> response = controller.telegramLogin();

		assertThat(response).containsEntry("enabled", true)
				.containsEntry("botUrl", "https://t.me/culibiaka_bot?start=login");
	}

	@Test
	void telegramWebhookCreatesReusableMagicLinkRecordsAndSendsLink() throws Exception {
		telegram.enabled = true;
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", true);
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "secret");
		ReflectionTestUtils.setField(controller, "telegramLoginRedirectPath", "/builder/");
		Map<String, Object> update = Map.of(
				"update_id", 1,
				"message", Map.of(
						"message_id", 2,
						"chat", Map.of("id", 12345L),
						"from", Map.of("id", 67890L, "is_bot", false, "username", "fraer_user"),
						"text", "/start login"));

		Map<String, Object> response = controller.telegramWebhook("secret", update, request());

		String identity = "telegram-67890@telegram.fraerapp.local";
		assertThat(response).containsEntry("method", "sendMessage")
				.containsEntry("chat_id", 12345L)
				.containsEntry("disable_web_page_preview", true);
		assertThat(response.get("text")).asString().contains("auth_token=");
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens where email = ? and redirect_path = ?",
				Long.class, identity, "/builder/")).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select count(*) from auth_audit_events where email = ? and event_type = ?",
				Long.class, identity, "login_link_requested")).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select count(*) from personal_data_consents where email = ? and source = ?",
				Long.class, identity, "telegram_bot")).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select count(*) from telegram_identities where telegram_user_id = ? and username = ?",
				Long.class, 67890L, "fraer_user")).isEqualTo(1L);
		assertThat(store.userByTelegramId(67890L)).map(User::email).contains(identity);
		controller.telegramWebhook("secret", update, request());
		assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Long.class, identity)).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select count(*) from telegram_identities where telegram_user_id = ?",
				Long.class, 67890L)).isEqualTo(1L);
	}

	@Test
	void telegramWebhookIgnoresNonMessageUpdates() {
		telegram.enabled = true;
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", true);
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "secret");

		Map<String, Object> response = controller.telegramWebhook("secret", Map.of(), request());

		assertThat(response).containsEntry("ok", true);
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
	}

	@Test
	void passkeyRegistrationRequiresAuthenticatedSessionAndCreatesBoundChallenge() throws Exception {
		assertThatThrownBy(() -> controller.passkeyRegistrationOptions(null, null))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(401));

		User user = store.user("passkey@example.test", true).orElseThrow();
		String sessionId = "passkey-session";
		store.createSession(sessionId, user.id(), Instant.now().plusSeconds(3600), "magic_link", Instant.now());
		String token = jwt.encode(user, sessionId, Instant.now().plusSeconds(900));
		JsonNode options = new ObjectMapper().readTree(
				controller.passkeyRegistrationOptions("Bearer " + token, null));

		assertThat(options.path("challengeId").asText()).isNotBlank();
		assertThat(options.path("publicKey").path("user").path("name").asText()).isEqualTo(user.email());
		assertThat(options.path("publicKey").path("authenticatorSelection").path("residentKey").asText())
				.isEqualTo("required");
		assertThat(options.path("publicKey").path("authenticatorSelection").path("userVerification").asText())
				.isEqualTo("required");
		assertThat(options.path("publicKey").path("extensions").path("credProps").asBoolean()).isTrue();
		assertThat(jdbc.queryForObject(
				"select count(*) from passkey_challenges where id = ? and user_id = ? and ceremony_type = 'registration'",
				Long.class, options.path("challengeId").asText(), user.id())).isEqualTo(1L);
	}

	@Test
	void staleOrLegacySessionCannotRegisterPasskey() {
		User user = store.user("stale@example.test", true).orElseThrow();
		String sessionId = "stale-session";
		store.createSession(sessionId, user.id(), Instant.now().plusSeconds(3600), "legacy",
				Instant.now().minusSeconds(3600));
		String token = jwt.encode(user, sessionId, Instant.now().plusSeconds(900));

		assertThatThrownBy(() -> controller.passkeyRegistrationOptions("Bearer " + token, null))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(403))
				.hasMessageContaining("Recent authentication");
		assertThat(jdbc.queryForObject("select count(*) from passkey_challenges", Long.class)).isZero();
	}

	@Test
	void refreshRotatesTokenWithoutResettingAuthenticationAge() {
		User user = store.user("refresh@example.test", true).orElseThrow();
		String sessionId = "refresh-session";
		Instant authenticatedAt = Instant.ofEpochMilli(System.currentTimeMillis()).minusSeconds(120);
		store.createSession(sessionId, user.id(), Instant.now().plusSeconds(3600), "magic_link", authenticatedAt);
		String rawRefresh = "raw-refresh-token";
		store.createRefresh("old-refresh", sessionId, sha256(rawRefresh), Instant.now().plusSeconds(3600));

		controller.refresh(rawRefresh, new MockHttpServletResponse());

		assertThat(jdbc.queryForObject("select count(*) from sessions where user_id = ?", Long.class, user.id()))
				.isEqualTo(1L);
		SessionAuthentication authentication = store.sessionAuthentication(sessionId).orElseThrow();
		assertThat(authentication.authMethod()).isEqualTo("magic_link");
		assertThat(authentication.authenticatedAt()).isEqualTo(authenticatedAt);
		assertThat(jdbc.queryForObject(
				"select count(*) from refresh_tokens where session_id = ? and revoked_at is null",
				Long.class, sessionId)).isEqualTo(1L);
	}

	@Test
	void passkeyAuthenticationIsUsernamelessAndFailedChallengeCannotBeReplayed() throws Exception {
		JsonNode options = new ObjectMapper().readTree(controller.passkeyAuthenticationOptions(request()));
		String challengeId = options.path("challengeId").asText();

		assertThat(challengeId).isNotBlank();
		assertThat(options.path("publicKey").path("userVerification").asText()).isEqualTo("required");
		assertThat(options.path("publicKey").has("allowCredentials")).isFalse();

		assertThatThrownBy(() -> passkeys.finishAuthentication(challengeId, Map.of()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(401));
		assertThat(jdbc.queryForObject(
				"select count(*) from passkey_challenges where id = ? and used_at is not null",
				Long.class, challengeId)).isEqualTo(1L);
		assertThatThrownBy(() -> passkeys.finishAuthentication(challengeId, Map.of()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(401));
		assertThat(jdbc.queryForObject(
				"select count(*) from auth_audit_events where event_type = 'passkey_authentication_failed'",
				Long.class)).isEqualTo(2L);
	}

	@Test
	void usersCanDeleteOnlyTheirOwnPasskeys() {
		User owner = store.user("owner@example.test", true).orElseThrow();
		User other = store.user("other@example.test", true).orElseThrow();
		String credentialId = "test-credential";
		Instant now = Instant.now();
		jdbc.update("""
				insert into passkey_credentials(
					credential_id, user_id, user_handle, public_key_cose, signature_count,
					backup_eligible, backup_state, display_name, created_at
				) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
				""", credentialId, owner.id(), "handle", "public-key", 0L, false, false, "Phone",
				java.sql.Timestamp.from(now));

		assertThatThrownBy(() -> passkeys.deleteCredential(other, credentialId))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(404));
		assertThat(passkeys.credentials(owner)).hasSize(1);

		passkeys.deleteCredential(owner, credentialId);

		assertThat(passkeys.credentials(owner)).isEmpty();
		assertThat(jdbc.queryForObject(
				"select count(*) from auth_audit_events where user_id = ? and event_type = 'passkey_deleted'",
				Long.class, owner.id())).isEqualTo(1L);
	}

	private MockHttpServletRequest request() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setScheme("http");
		request.setServerName("localhost");
		request.setServerPort(8088);
		return request;
	}

	@SuppressWarnings("unchecked")
	private String latestDevToken(String email) {
		Map<String, Object> response = controller.devLinks(email);
		AuthController.DevLink link = ((java.util.List<AuthController.DevLink>) response.get("links")).get(0);
		return tokenFromUrl(link.link());
	}

	private String tokenFromUrl(String url) {
		String query = URI.create(url).getQuery();
		return java.util.Arrays.stream(query.split("&"))
				.map(part -> part.split("=", 2))
				.filter(parts -> parts.length == 2 && "auth_token".equals(parts[0]))
				.map(parts -> parts[1])
				.findFirst()
				.orElseThrow();
	}

	private String sha256(String value) {
		try {
			return java.util.HexFormat.of().formatHex(
					MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static class FakeTelegramMessenger implements TelegramMessenger {

		boolean enabled;

		@Override
		public boolean configured() {
			return enabled;
		}
	}
}
