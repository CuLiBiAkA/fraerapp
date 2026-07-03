package com.fraergod.fraerapp.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@SpringBootApplication
public class AuthServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(AuthServiceApplication.class, args);
	}

	ApplicationRunner bootstrap(AuthStore store, @Value("${auth.bootstrap-admin-email:}") String adminEmail) {
		return args -> {
			if (adminEmail != null && !adminEmail.isBlank()) {
				store.user(normalizeEmail(adminEmail), true).ifPresent(user -> {
					store.grantRole(user.id(), "admin");
					store.grantRole(user.id(), "author");
				});
			}
		};
	}

	static String normalizeEmail(String email) {
		return email == null ? "" : email.trim().toLowerCase();
	}
}

@RestController
@RequestMapping("/auth")
class AuthController {

	private final AuthStore store;
	private final JwtCodec jwt;
	private final Optional<JavaMailSender> mail;
	private final PasskeyService passkeys;
	private final TelegramMessenger telegram;
	private final Map<String, List<DevLink>> devLinks = new ConcurrentHashMap<>();
	private final Map<String, Window> rate = new ConcurrentHashMap<>();

	@Value("${auth.magic-link-ttl-seconds:900}")
	private long magicLinkTtl;

	@Value("${auth.access-ttl-seconds:900}")
	private long accessTtl;

	@Value("${auth.refresh-ttl-seconds:2592000}")
	private long refreshTtl;

	@Value("${auth.cookie-secure:false}")
	private boolean cookieSecure;

	@Value("${auth.cookie-same-site:Lax}")
	private String sameSite;

	@Value("${auth.dev-mode:true}")
	private boolean devMode;

	@Value("${auth.admin-login-link-log-enabled:false}")
	private boolean adminLoginLinkLogEnabled;

	@Value("${auth.public-base-url:}")
	private String publicBaseUrl;

	@Value("${auth.bootstrap-admin-email:}")
	private String bootstrapAdminEmail;

	@Value("${auth.smtp-from:noreply@fraerapp.ru}")
	private String smtpFrom;

	@Value("${spring.mail.host:}")
	private String smtpHost;

	@Value("${auth.privacy-policy-version:2026-06-21}")
	private String privacyPolicyVersion;

	@Value("${auth.passkey.registration-recent-auth-seconds:600}")
	private long passkeyRegistrationRecentAuthSeconds;

	@Value("${auth.telegram.bot-enabled:false}")
	private boolean telegramBotEnabled;

	@Value("${auth.telegram.bot-username:}")
	private String telegramBotUsername;

	@Value("${auth.telegram.webhook-secret:}")
	private String telegramWebhookSecret;

	@Value("${auth.telegram.login-redirect-path:/}")
	private String telegramLoginRedirectPath;

	AuthController(AuthStore store, JwtCodec jwt, Optional<JavaMailSender> mail, PasskeyService passkeys,
			TelegramMessenger telegram) {
		this.store = store;
		this.jwt = jwt;
		this.mail = mail;
		this.passkeys = passkeys;
		this.telegram = telegram;
	}

	@PostMapping("/login-link")
	Map<String, Object> loginLink(@Valid @RequestBody LoginLinkRequest request, HttpServletRequest servletRequest) {
		String email = AuthServiceApplication.normalizeEmail(request.email());
		if (!request.personalDataConsent()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Personal data consent is required");
		}
		checkRate("login:" + email, devMode ? 200 : 5, Duration.ofMinutes(15));
		store.recordConsent(email, privacyPolicyVersion, "login_form");
		if (!devMode && !smtpAvailable()) {
			if (adminLoginLinkLogEnabled && canLogAdminLoginLink(email)) {
				CreatedLoginLink generated = createLoginLink(
						email, request.redirectPath(), servletRequest, "admin_log_bootstrap", privacyPolicyVersion);
				System.out.println("FraerApp admin login link for " + email + " expires at "
						+ generated.expiresAt() + ": " + generated.loginUrl());
			}
			else {
				store.audit(null, email, "login_link_requested",
						"{\"source\":\"self_service\",\"consentVersion\":\"" + privacyPolicyVersion
								+ "\",\"delivery\":\"unavailable\"}");
			}
			return Map.of("sent", true);
		}
		CreatedLoginLink generated = createLoginLink(
				email, request.redirectPath(), servletRequest, "self_service", privacyPolicyVersion);
		if (devMode) {
			devLinks.put(email, List.of(new DevLink(email, generated.loginUrl(), generated.expiresAt())));
			System.out.println("FraerApp dev magic link for " + email + ": " + generated.loginUrl());
		}
		else {
			sendMail(email, generated.loginUrl());
		}
		return Map.of("sent", true);
	}

	@PostMapping("/admin/users/login-link")
	Map<String, Object> adminLoginLink(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody AdminLoginLinkRequest request,
			HttpServletRequest servletRequest) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		String email = AuthServiceApplication.normalizeEmail(request.email());
		User user = store.user(email, request.createUser())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
		if (user.blockedAt() != null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "User is blocked");
		}
		for (String role : request.safeGrantRoles()) {
			if (!List.of("author", "admin").contains(role)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only author/admin can be pre-granted");
			}
			store.grantRole(user.id(), role);
		}
		checkRate("admin-login:" + admin.id(), devMode ? 200 : 20, Duration.ofMinutes(15));
		CreatedLoginLink generated = createLoginLink(
				email, request.redirectPath(), servletRequest, "admin_resend", null);
		store.audit(admin.id(), admin.email(), "admin_login_link_requested",
				"{\"target\":\"" + email + "\"}");
		return Map.of(
				"sent", true,
				"email", email,
				"loginUrl", generated.loginUrl(),
				"expiresAt", generated.expiresAt());
	}

	@GetMapping("/telegram/login")
	Map<String, Object> telegramLogin() {
		boolean enabled = telegramBotEnabled && telegram.configured() && telegramBotUsername != null
				&& !telegramBotUsername.isBlank();
		if (!enabled) {
			return Map.of("enabled", false);
		}
		return Map.of(
				"enabled", true,
				"botUrl", "https://t.me/" + telegramBotUsername.replaceFirst("^@", "") + "?start=login");
	}

	@PostMapping("/telegram/webhook")
	Map<String, Object> telegramWebhook(
			@RequestHeader(name = "X-Telegram-Bot-Api-Secret-Token", required = false) String secretToken,
			@RequestBody Map<String, Object> update,
			HttpServletRequest servletRequest) {
		if (!telegramBotEnabled || !telegram.configured()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Telegram login is disabled");
		}
		if (telegramWebhookSecret != null && !telegramWebhookSecret.isBlank()
				&& !telegramWebhookSecret.equals(secretToken)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid Telegram webhook secret");
		}
		TelegramMessage message = telegramMessage(update).orElse(null);
		if (message == null) {
			return Map.of("ok", true);
		}
		checkRate("telegram-login:" + message.userId(), 200, Duration.ofMinutes(15));
		User user = store.userForTelegram(message.userId(), message.chatId(), message.username());
		String identity = user.email();
		store.recordConsent(identity, privacyPolicyVersion, "telegram_bot");
		CreatedLoginLink generated = createLoginLink(
				identity, telegramLoginRedirectPath, servletRequest, "telegram_bot", privacyPolicyVersion);
		store.audit(user.id(), identity, "telegram_login_link_prepared",
				"{\"source\":\"telegram_bot\",\"telegramUserId\":" + message.userId() + "}");
		return Map.of(
				"method", "sendMessage",
				"chat_id", message.chatId(),
				"text", telegramLoginMessage(generated.loginUrl(), generated.expiresAt()),
				"disable_web_page_preview", true);
	}

	private CreatedLoginLink createLoginLink(String email, String requestedRedirect, HttpServletRequest servletRequest,
			String source, String consentVersion) {
		String token = UUID.randomUUID() + "." + UUID.randomUUID();
		String tokenHash = sha256(token);
		String redirect = safeRedirect(requestedRedirect);
		Instant expiresAt = Instant.now().plusSeconds(magicLinkTtl);
		store.createMagicLink(email, tokenHash, redirect, expiresAt);
		String separator = redirect.contains("?") ? "&" : "?";
		String link = requestBaseUrl(servletRequest) + redirect + separator + "auth_token=" + token + "&redirect=" + url64(redirect.getBytes(StandardCharsets.UTF_8));
		String metadata = consentVersion == null
				? "{\"source\":\"" + source + "\"}"
				: "{\"source\":\"" + source + "\",\"consentVersion\":\"" + consentVersion + "\"}";
		store.audit(null, email, "login_link_requested", metadata);
		store.invalidateOtherActiveMagicLinks(email, tokenHash);
		return new CreatedLoginLink(link, expiresAt);
	}

	private Optional<TelegramMessage> telegramMessage(Map<String, Object> update) {
		Map<?, ?> message = mapValue(update.get("message"));
		if (message == null) {
			message = mapValue(update.get("edited_message"));
		}
		if (message == null) {
			return Optional.empty();
		}
		Map<?, ?> chat = mapValue(message.get("chat"));
		Map<?, ?> from = mapValue(message.get("from"));
		long chatId = longValue(chat == null ? null : chat.get("id"));
		long userId = longValue(from == null ? null : from.get("id"));
		String username = stringValue(from == null ? null : from.get("username"));
		if (chatId == 0L || userId == 0L || booleanValue(from == null ? null : from.get("is_bot"))) {
			return Optional.empty();
		}
		return Optional.of(new TelegramMessage(chatId, userId, username));
	}

	private Map<?, ?> mapValue(Object value) {
		return value instanceof Map<?, ?> map ? map : null;
	}

	private long longValue(Object value) {
		if (value instanceof Number number) {
			return number.longValue();
		}
		if (value instanceof String string && !string.isBlank()) {
			try {
				return Long.parseLong(string);
			}
			catch (NumberFormatException ex) {
				return 0L;
			}
		}
		return 0L;
	}

	private boolean booleanValue(Object value) {
		return value instanceof Boolean bool && bool;
	}

	private String stringValue(Object value) {
		return value == null ? "" : value.toString().trim();
	}

	private String telegramLoginMessage(String loginUrl, Instant expiresAt) {
		return "Временная ссылка для входа во FraerApp:\n" + loginUrl
				+ "\n\nСсылка одноразовая и действует до " + expiresAt + ".";
	}

	@PostMapping("/verify")
	Map<String, Object> verify(@Valid @RequestBody VerifyRequest request, HttpServletResponse response) {
		checkRate("verify", devMode ? 200 : 20, Duration.ofMinutes(15));
		MagicLink link = store.magicLink(sha256(request.token()))
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid login link"));
		if (link.usedAt() != null || link.expiresAt().isBefore(Instant.now())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login link expired");
		}
		User user = store.user(link.email(), true).orElseThrow();
		if (isBootstrapAdmin(user.email())) {
			store.grantRole(user.id(), "admin");
			store.grantRole(user.id(), "author");
			user = store.userById(user.id()).orElseThrow();
		}
		if (user.blockedAt() != null) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
		}
		store.consumeMagicLink(link.id());
		TokenPair pair = issue(user, "magic_link");
		addCookies(response, pair);
		store.audit(user.id(), user.email(), "login_link_verified", "{}");
		return Map.of("user", userView(user), "redirectPath", link.redirectPath() == null ? "/" : link.redirectPath());
	}

	@PostMapping("/refresh")
	Map<String, Object> refresh(@CookieValue(name = "fraer_refresh", required = false) String refreshToken,
			HttpServletResponse response) {
		if (refreshToken == null || refreshToken.isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing refresh token");
		}
		RefreshToken token = store.refresh(sha256(refreshToken))
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));
		if (token.revokedAt() != null || token.expiresAt().isBefore(Instant.now())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
		}
		User user = store.userBySession(token.sessionId()).orElseThrow();
		if (user.blockedAt() != null) {
			store.revokeSession(token.sessionId());
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
		}
		store.revokeRefresh(token.id());
		TokenPair pair = rotate(user, token.sessionId());
		store.replaceRefresh(token.id(), pair.refreshId());
		addCookies(response, pair);
		store.audit(user.id(), user.email(), "refreshed", "{}");
		return Map.of("user", userView(user));
	}

	@GetMapping("/me")
	Map<String, Object> me(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken) {
		User user = currentUser(authorization, accessToken);
		return userView(user);
	}

	@PostMapping("/logout")
	Map<String, Object> logout(@CookieValue(name = "fraer_refresh", required = false) String refreshToken,
			HttpServletResponse response) {
		if (refreshToken != null && !refreshToken.isBlank()) {
			store.refresh(sha256(refreshToken)).ifPresent(token -> {
				store.revokeSession(token.sessionId());
				store.audit(null, null, "logout", "{}");
			});
		}
		clearCookies(response);
		return Map.of("loggedOut", true);
	}

	@PostMapping("/logout-all")
	Map<String, Object> logoutAll(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			HttpServletResponse response) {
		User user = currentUser(authorization, accessToken);
		store.revokeAllSessions(user.id());
		clearCookies(response);
		store.audit(user.id(), user.email(), "logout_all", "{}");
		return Map.of("loggedOut", true);
	}

	@PostMapping(value = "/passkeys/registration/options", produces = MediaType.APPLICATION_JSON_VALUE)
	String passkeyRegistrationOptions(
			@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken) {
		JwtClaims claims = currentClaims(authorization, accessToken);
		User user = userForClaims(claims);
		requireRecentAuthentication(claims);
		checkRate("passkey-registration-start:" + user.id(), devMode ? 200 : 10, Duration.ofMinutes(15));
		return passkeys.startRegistration(user);
	}

	@PostMapping("/passkeys/registration/verify")
	PasskeyView passkeyRegistrationVerify(
			@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody PasskeyRegistrationFinishRequest request) {
		JwtClaims claims = currentClaims(authorization, accessToken);
		User user = userForClaims(claims);
		requireRecentAuthentication(claims);
		checkRate("passkey-registration-finish:" + user.id(), devMode ? 200 : 10, Duration.ofMinutes(15));
		return passkeys.finishRegistration(user, request.challengeId(), request.displayName(), request.credential());
	}

	@PostMapping(value = "/passkeys/authentication/options", produces = MediaType.APPLICATION_JSON_VALUE)
	String passkeyAuthenticationOptions(HttpServletRequest request) {
		checkRate("passkey-authentication-start:" + clientAddress(request), devMode ? 200 : 30, Duration.ofMinutes(15));
		return passkeys.startAuthentication();
	}

	@PostMapping("/passkeys/authentication/verify")
	Map<String, Object> passkeyAuthenticationVerify(
			@Valid @RequestBody PasskeyAuthenticationFinishRequest request,
			HttpServletRequest servletRequest,
			HttpServletResponse response) {
		checkRate("passkey-authentication-finish:" + clientAddress(servletRequest), devMode ? 200 : 30, Duration.ofMinutes(15));
		User user = passkeys.finishAuthentication(request.challengeId(), request.credential());
		TokenPair pair = issue(user, "passkey");
		addCookies(response, pair);
		return Map.of("user", userView(user));
	}

	@GetMapping("/passkeys")
	Map<String, Object> passkeyCredentials(
			@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken) {
		User user = currentUser(authorization, accessToken);
		return Map.of("passkeys", passkeys.credentials(user));
	}

	@DeleteMapping("/passkeys/{credentialId}")
	Map<String, Object> deletePasskey(
			@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@PathVariable @Size(max = 1024) String credentialId) {
		User user = currentUser(authorization, accessToken);
		passkeys.deleteCredential(user, credentialId);
		return Map.of("deleted", true);
	}

	@PostMapping("/admin/roles")
	Map<String, Object> grantRole(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody RoleRequest request) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		if (!List.of("player", "author", "admin").contains(request.role())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only player/author/admin can be changed");
		}
		User user = store.user(AuthServiceApplication.normalizeEmail(request.email()), true).orElseThrow();
		if ("player".equals(request.role()) && request.grant()) {
			store.demoteToPlayer(user.id());
		}
		else if (request.grant()) {
			store.grantRole(user.id(), request.role());
		}
		else {
			store.removeRole(user.id(), request.role());
		}
		store.audit(admin.id(), admin.email(), "role_changed", "{\"target\":\"" + user.email() + "\"}");
		return userView(store.user(user.email(), true).orElseThrow());
	}

	@GetMapping("/admin/users")
	AdminUserPage users(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size,
			@RequestParam(defaultValue = "") String query) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		return store.adminUsers(page, size, query);
	}

	@GetMapping("/admin/login-requests")
	AdminLoginRequestPage loginRequests(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size,
			@RequestParam(defaultValue = "") String query) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		return store.adminLoginRequests(page, size, query);
	}

	@PostMapping("/admin/login-requests/delete")
	Map<String, Object> deleteLoginRequest(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody DeleteLoginRequest request) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		String email = AuthServiceApplication.normalizeEmail(request.email());
		AuthStore.DeletedLoginRequest deleted = store.deleteLoginRequest(email);
		store.audit(admin.id(), admin.email(), "login_request_deleted", "{\"target\":\"" + email + "\"}");
		return Map.of(
				"deleted", true,
				"email", email,
				"requestEventsDeleted", deleted.requestEventsDeleted(),
				"unusedLinksDeleted", deleted.unusedLinksDeleted());
	}

	@PostMapping("/admin/users/block")
	Map<String, Object> blockUser(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody BlockRequest request) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		User user = store.user(AuthServiceApplication.normalizeEmail(request.email()), false)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
		if (request.blocked()) {
			store.blockUser(user.id());
			store.audit(admin.id(), admin.email(), "user_blocked", "{\"target\":\"" + user.email() + "\"}");
		}
		else {
			store.unblockUser(user.id());
			store.audit(admin.id(), admin.email(), "user_unblocked", "{\"target\":\"" + user.email() + "\"}");
		}
		return userView(store.userById(user.id()).orElseThrow());
	}

	@PostMapping("/admin/users/delete")
	Map<String, Object> deleteUser(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@Valid @RequestBody DeleteUserRequest request) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		User user = store.user(AuthServiceApplication.normalizeEmail(request.email()), false)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
		if (admin.id().equals(user.id())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Admin cannot delete the current account");
		}
		store.deleteUser(user.id(), user.email());
		store.audit(admin.id(), admin.email(), "user_deleted", "{\"target\":\"" + user.email() + "\"}");
		return Map.of("deleted", true, "email", user.email());
	}

	@GetMapping("/jwks")
	Map<String, Object> jwks() {
		return jwt.jwks();
	}

	@GetMapping(value = "/admin", produces = MediaType.TEXT_HTML_VALUE)
	String adminPage() {
		return """
				<!doctype html>
				<html lang="ru">
				<head>
				  <meta charset="utf-8">
				  <meta name="viewport" content="width=device-width, initial-scale=1">
				  <title>FraerApp права</title>
				  <style>
				    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; background: #f6f3ef; color: #202124; }
				    main { max-width: 1280px; margin: 0 auto; padding: 32px 18px 48px; }
				    h1 { margin: 0 0 8px; font-size: 32px; }
				    section { background: #fff; border: 1px solid #d8d3ca; border-radius: 8px; padding: 18px; margin-top: 16px; }
				    label { display: block; font-weight: 650; margin: 12px 0 6px; }
				    input, select, button { font: inherit; }
					    input, select { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #c9c2b8; border-radius: 6px; background: #fff; }
					    input[type="checkbox"] { width: auto; }
				    button { margin-top: 14px; padding: 10px 14px; border: 0; border-radius: 6px; background: #1f5f46; color: #fff; cursor: pointer; }
				    button.secondary { background: #51483f; }
				    button.danger { background: #8f2f25; }
				    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #161411; color: #f8f3e8; padding: 12px; border-radius: 6px; }
				    pre:empty { display: none; }
				    .row { display: grid; grid-template-columns: 1fr 160px 120px; gap: 12px; align-items: end; }
				    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
				    .toolbar label { min-width: 160px; margin-top: 0; }
				    .pager { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
				    .table-wrap { overflow-x: auto; margin-top: 14px; border: 1px solid #e4ded4; border-radius: 8px; }
				    table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 980px; }
				    .users-table { min-width: 1120px; }
				    .stories-table { min-width: 1080px; }
				    th, td { border-bottom: 1px solid #e4ded4; padding: 10px 8px; text-align: left; vertical-align: top; }
				    th { font-size: 13px; color: #6f665d; }
				    th, td { overflow-wrap: anywhere; word-break: break-word; }
				    tbody tr:last-child td { border-bottom: 0; }
				    .cell-email { font-weight: 600; }
				    .cell-key, .cell-muted { color: #51483f; font-size: 13px; }
				    .cell-metric { white-space: pre-line; font-size: 13px; line-height: 1.35; }
				    .cell-date { font-size: 13px; white-space: normal; }
				    .users-table td:nth-child(1), .stories-table td:nth-child(1) { font-weight: 600; }
				    .users-table td:nth-child(4), .users-table td:nth-child(5), .users-table td:nth-child(6),
				    .stories-table td:nth-child(2), .stories-table td:nth-child(4), .stories-table td:nth-child(6) {
				      color: #51483f; font-size: 13px; line-height: 1.35;
				    }
				    td.actions { white-space: normal; }
				    .action-stack { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
				    td.actions button { display: block; width: 100%; margin: 0 0 6px; padding: 7px 9px; }
				    .badge { display: inline-block; padding: 3px 7px; border-radius: 999px; background: #e8e0d4; font-size: 12px; }
				    .hidden { display: none; }
				    .muted { color: #6f665d; }
				    a { color: #1f5f46; }
				    @media (max-width: 680px) {
				      main { padding-inline: 10px; }
				      section { padding: 14px; }
				      .row { grid-template-columns: 1fr; }
				      .pager { flex-wrap: wrap; }
				    }
				  </style>
				</head>
				<body>
				  <main>
				    <h1>FraerApp права</h1>
				    <p class="muted">Общая сессия FraerApp. Для этой панели нужна роль admin.</p>

				    <section id="login-section">
				      <h2>Вход администратора</h2>
				      <form id="login-form">
					        <label for="login-email">Email</label>
					        <input id="login-email" type="email" placeholder="admin@example.com" autocomplete="email" required>
					        <label><input id="login-consent" type="checkbox" required> Я принимаю <a href="/personal-data-consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> и ознакомлен с <a href="/privacy-policy.html" target="_blank" rel="noopener">политикой</a>.</label>
					        <button type="submit">Отправить ссылку</button>
				      </form>
				      <button id="passkey-login" type="button" class="secondary">Войти с passkey</button>
				      <pre id="login-result"></pre>
				    </section>

				    <section id="me-section" class="hidden">
				      <h2>Текущий вход</h2>
				      <p id="me-line"></p>
				      <button id="logout" type="button" class="secondary">Выйти</button>
				      <h3>Passkeys</h3>
				      <label for="passkey-name">Название устройства</label>
				      <input id="passkey-name" maxlength="120" placeholder="Мой телефон">
				      <button id="passkey-register" type="button">Добавить passkey</button>
				      <div id="passkey-list"></div>
				      <pre id="passkey-result"></pre>
				    </section>

				    <section id="login-requests-section" class="hidden">
				      <h2>Заявки на вход</h2>
				      <p class="muted">Здесь видны email, по которым пользователь пытался войти через публичную форму.</p>
				      <div class="toolbar">
				        <label>Поиск email
				          <input id="request-query" type="search" placeholder="email">
				        </label>
				        <label>На странице
				          <select id="request-size">
				            <option value="10">10</option>
				            <option value="20" selected>20</option>
				            <option value="50">50</option>
				          </select>
				        </label>
				        <button id="refresh-requests" type="button" class="secondary">Обновить</button>
				      </div>
				      <div class="table-wrap">
				        <table>
				          <colgroup>
				            <col style="width: 24%">
				            <col style="width: 13%">
				            <col style="width: 12%">
				            <col style="width: 15%">
				            <col style="width: 12%">
				            <col style="width: 24%">
				          </colgroup>
				          <thead>
				            <tr>
				              <th>Email</th>
				              <th>Попыток</th>
				              <th>Активные ссылки</th>
				              <th>Пользователь</th>
				              <th>Последняя заявка</th>
				              <th>Действия</th>
				            </tr>
				          </thead>
				          <tbody id="requests-body"></tbody>
				        </table>
				      </div>
				      <div class="pager">
				        <button id="requests-prev" type="button" class="secondary">Назад</button>
				        <span id="requests-page"></span>
				        <button id="requests-next" type="button" class="secondary">Вперед</button>
				      </div>
				      <pre id="requests-result"></pre>
				    </section>

				    <section id="manual-link-section" class="hidden">
				      <h2>Ручная ссылка для входа</h2>
				      <p class="muted">Введите email существующего незаблокированного пользователя. Новая ссылка отменит предыдущие активные ссылки.</p>
				      <form id="manual-link-form">
				        <label for="manual-link-email">Email пользователя</label>
				        <input id="manual-link-email" type="email" placeholder="user@example.com" required>
				        <button type="submit">Создать ссылку</button>
				      </form>
				      <pre id="manual-link-result"></pre>
				      <button id="copy-manual-link" type="button" class="secondary hidden">Скопировать ссылку</button>
				    </section>

				    <section id="roles-section" class="hidden">
				      <h2>Выдать права</h2>
				      <form id="role-form">
				        <div class="row">
				          <div>
				            <label for="target-email">Email пользователя</label>
				            <input id="target-email" type="email" placeholder="user@example.com" required>
				          </div>
				          <div>
				            <label for="role">Роль</label>
				            <select id="role">
				              <option value="author">author</option>
				              <option value="admin">admin</option>
				              <option value="player">player only</option>
				            </select>
				          </div>
				          <div>
				            <label for="grant">Действие</label>
				            <select id="grant">
				              <option value="true">Выдать</option>
				              <option value="false">Снять</option>
				            </select>
				          </div>
				        </div>
				        <button type="submit">Применить</button>
				      </form>
				      <pre id="role-result"></pre>
				    </section>

				    <section id="users-section" class="hidden">
				      <h2>Пользователи</h2>
				      <div class="toolbar">
				        <label>Поиск email
				          <input id="user-query" type="search" placeholder="email">
				        </label>
				        <label>На странице
				          <select id="user-size">
				            <option value="10">10</option>
				            <option value="20" selected>20</option>
				            <option value="50">50</option>
				          </select>
				        </label>
				        <button id="refresh-users" type="button" class="secondary">Обновить</button>
				      </div>
				      <div class="table-wrap">
				        <table class="users-table">
				          <colgroup>
				            <col style="width: 18%">
				            <col style="width: 11%">
				            <col style="width: 9%">
				            <col style="width: 12%">
				            <col style="width: 16%">
				            <col style="width: 15%">
				            <col style="width: 10%">
				            <col style="width: 9%">
				          </colgroup>
				          <thead>
				            <tr>
				              <th>Email</th>
				              <th>Роли</th>
				              <th>Блок</th>
				              <th>Auth</th>
				              <th>Игра</th>
				              <th>Авторство</th>
				              <th>Создан</th>
				              <th>Действия</th>
				            </tr>
				          </thead>
				          <tbody id="users-body"></tbody>
				        </table>
				      </div>
				      <div class="pager">
				        <button id="users-prev" type="button" class="secondary">Назад</button>
				        <span id="users-page"></span>
				        <button id="users-next" type="button" class="secondary">Вперед</button>
				      </div>
				      <pre id="users-result"></pre>
				    </section>

				    <section id="stories-section" class="hidden">
				      <h2>Истории</h2>
				      <div class="toolbar">
				        <label>Статус
				          <select id="story-status">
				            <option value="all">Все</option>
				            <option value="draft">draft</option>
				            <option value="review">review</option>
				            <option value="published">published</option>
				            <option value="archived">archived</option>
				          </select>
				        </label>
				        <label>На странице
				          <select id="story-size">
				            <option value="10">10</option>
				            <option value="20" selected>20</option>
				            <option value="50">50</option>
				          </select>
				        </label>
				        <button id="refresh-stories" type="button" class="secondary">Обновить</button>
				      </div>
				      <div class="table-wrap">
				        <table class="stories-table">
				          <colgroup>
				            <col style="width: 22%">
				            <col style="width: 22%">
				            <col style="width: 9%">
				            <col style="width: 16%">
				            <col style="width: 7%">
				            <col style="width: 10%">
				            <col style="width: 14%">
				          </colgroup>
				          <thead>
				            <tr>
				              <th>Название</th>
				              <th>Ключ</th>
				              <th>Статус</th>
				              <th>Автор</th>
				              <th>Запуски</th>
				              <th>Обновлено</th>
				              <th>Действия</th>
				            </tr>
				          </thead>
				          <tbody id="stories-body"></tbody>
				        </table>
				      </div>
				      <div class="pager">
				        <button id="stories-prev" type="button" class="secondary">Назад</button>
				        <span id="stories-page"></span>
				        <button id="stories-next" type="button" class="secondary">Вперед</button>
				      </div>
				      <pre id="stories-result"></pre>
				    </section>
				  </main>

				  <script type="module">
				    import { credentialToJson, parseCreationOptions, parseRequestOptions, passkeysSupported } from "/passkeys.js";
				    const loginSection = document.querySelector("#login-section");
				    const meSection = document.querySelector("#me-section");
				    const loginRequestsSection = document.querySelector("#login-requests-section");
				    const manualLinkSection = document.querySelector("#manual-link-section");
				    const rolesSection = document.querySelector("#roles-section");
				    const usersSection = document.querySelector("#users-section");
				    const storiesSection = document.querySelector("#stories-section");
				    const loginResult = document.querySelector("#login-result");
				    const requestsResult = document.querySelector("#requests-result");
				    const manualLinkResult = document.querySelector("#manual-link-result");
				    const copyManualLink = document.querySelector("#copy-manual-link");
				    const roleResult = document.querySelector("#role-result");
				    const usersResult = document.querySelector("#users-result");
				    const storiesResult = document.querySelector("#stories-result");
				    const meLine = document.querySelector("#me-line");
				    const passkeyResult = document.querySelector("#passkey-result");
				    const passkeyList = document.querySelector("#passkey-list");
				    let requestPage = 0;
				    let requestTotalPages = 0;
				    let userPage = 0;
				    let userTotalPages = 0;
				    let storyPage = 0;
				    let storyTotalPages = 0;
				    let currentManualLoginUrl = "";

				    async function json(path, options = {}, allowRefresh = true) {
				      const response = await fetch(path, {
				        method: options.method || "GET",
				        credentials: "include",
				        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
				        body: options.body ? JSON.stringify(options.body) : undefined,
				      });
				      if (response.status === 401 && allowRefresh && shouldRefreshAuth(path)) {
				        const refreshed = await fetch("/auth/refresh", {
				          method: "POST",
				          credentials: "include",
				          headers: { Accept: "application/json" },
				        });
				        if (refreshed.ok) return json(path, options, false);
				      }
				      const text = await response.text();
				      const payload = text ? JSON.parse(text) : {};
				      if (!response.ok) throw new Error(payload.message || payload.detail || payload.error || `HTTP ${response.status}`);
				      return payload;
				    }

				    function shouldRefreshAuth(path) {
				      return !String(path).startsWith("/auth/login-link")
				        && !String(path).startsWith("/auth/verify")
				        && !String(path).startsWith("/auth/refresh")
				        && !String(path).startsWith("/auth/passkeys/authentication");
				    }

				    async function loadMe() {
				      try {
				        const me = await json("/auth/me");
				        meLine.textContent = `${me.email} / ${me.roles.join(", ")}`;
				        meSection.classList.remove("hidden");
				        loginSection.classList.add("hidden");
				        loadPasskeys().catch((error) => { passkeyResult.textContent = error.message; });
				        if (me.roles.includes("admin")) {
				          loginRequestsSection.classList.remove("hidden");
				          manualLinkSection.classList.remove("hidden");
				          rolesSection.classList.remove("hidden");
				          usersSection.classList.remove("hidden");
				          storiesSection.classList.remove("hidden");
				          loadLoginRequests();
				          loadUsers();
				          loadStories();
				        } else {
				          loginRequestsSection.classList.add("hidden");
				          manualLinkSection.classList.add("hidden");
				          rolesSection.classList.add("hidden");
				          usersSection.classList.add("hidden");
				          storiesSection.classList.add("hidden");
				          roleResult.textContent = "Нужна роль admin. Проверь AUTH_BOOTSTRAP_ADMIN_EMAIL или выдайте admin в dev.";
				        }
				      } catch {
				        loginSection.classList.remove("hidden");
				        meSection.classList.add("hidden");
				        loginRequestsSection.classList.add("hidden");
				        manualLinkSection.classList.add("hidden");
				        rolesSection.classList.add("hidden");
				        usersSection.classList.add("hidden");
				        storiesSection.classList.add("hidden");
				      }
				    }

				    async function loadLoginRequests() {
				      const size = document.querySelector("#request-size").value;
				      const query = document.querySelector("#request-query").value.trim();
				      const page = await json(`/auth/admin/login-requests?page=${requestPage}&size=${size}&query=${encodeURIComponent(query)}`);
				      requestPage = page.page;
				      requestTotalPages = page.totalPages;
				      renderLoginRequests(page.items || []);
				      document.querySelector("#requests-page").textContent =
				        `Страница ${page.totalPages === 0 ? 0 : page.page + 1} из ${page.totalPages}, всего ${page.totalElements}`;
				      document.querySelector("#requests-prev").disabled = page.page <= 0;
				      document.querySelector("#requests-next").disabled = page.page + 1 >= page.totalPages;
				    }

				    function renderLoginRequests(items) {
				      const body = document.querySelector("#requests-body");
				      body.replaceChildren();
				      if (!items.length) {
				        const row = document.createElement("tr");
				        const cell = document.createElement("td");
				        cell.colSpan = 6;
				        cell.textContent = "Заявок нет.";
				        row.append(cell);
				        body.append(row);
				        return;
				      }
				      for (const request of items) {
				        const row = document.createElement("tr");
				        row.append(
				          td(request.email || ""),
				          td(String(request.requestCount || 0)),
				          td(String(request.activeUnusedLinks || 0)),
				          td(request.userId ? `${(request.roles || []).join(", ")}${request.blocked ? " / blocked" : ""}` : "ещё не создан"),
				          td(formatDate(request.lastRequestedAt)),
				          loginRequestActionCell(request)
				        );
				        body.append(row);
				      }
				    }

				    function loginRequestActionCell(request) {
				      const cell = document.createElement("td");
				      cell.className = "actions";
				      const stack = document.createElement("div");
				      stack.className = "action-stack";
				      const loginLink = document.createElement("button");
				      loginLink.type = "button";
				      loginLink.className = "secondary";
				      loginLink.textContent = request.userId ? "Создать ссылку" : "Создать пользователя + ссылку";
				      loginLink.disabled = request.blocked;
				      loginLink.addEventListener("click", () => createLoginLinkForRequest(request, []));
				      const authorLink = document.createElement("button");
				      authorLink.type = "button";
				      authorLink.className = "secondary";
				      authorLink.textContent = "Ссылка + author";
				      authorLink.disabled = request.blocked;
				      authorLink.addEventListener("click", () => createLoginLinkForRequest(request, ["author"]));
				      const remove = document.createElement("button");
				      remove.type = "button";
				      remove.className = "danger";
				      remove.textContent = "Удалить заявку";
				      remove.addEventListener("click", () => deleteLoginRequest(request));
				      stack.append(loginLink, authorLink, remove);
				      cell.append(stack);
				      return cell;
				    }

				    async function createLoginLinkForRequest(request, grantRoles) {
				      const roleText = grantRoles.length ? ` и выдать ${grantRoles.join(", ")}` : "";
				      if (!confirm(`Создать ссылку для ${request.email}${roleText}?`)) return;
				      const result = await createManualLoginLink(request.email, {
				        createUser: true,
				        grantRoles,
				      });
				      requestsResult.textContent = `Ссылка создана для ${result.email}. Она показана в разделе «Ручная ссылка для входа».`;
				      await Promise.all([loadLoginRequests(), loadUsers()]);
				    }

				    async function deleteLoginRequest(request) {
				      if (!confirm(`Удалить заявку ${request.email}? Неиспользованные временные ссылки для этого email тоже будут удалены. Пользователь, если уже создан, останется.`)) {
				        return;
				      }
				      const result = await json("/auth/admin/login-requests/delete", {
				        method: "POST",
				        body: { email: request.email },
				      });
				      requestsResult.textContent = JSON.stringify(result, null, 2);
				      await loadLoginRequests();
				    }

				    async function loadUsers() {
				      const size = document.querySelector("#user-size").value;
				      const query = document.querySelector("#user-query").value.trim();
				      const page = await json(`/auth/admin/users?page=${userPage}&size=${size}&query=${encodeURIComponent(query)}`);
				      const runtime = await runtimeStats(page.items || []);
				      userPage = page.page;
				      userTotalPages = page.totalPages;
				      renderUsers(page.items || [], runtime);
				      document.querySelector("#users-page").textContent =
				        `Страница ${page.totalPages === 0 ? 0 : page.page + 1} из ${page.totalPages}, всего ${page.totalElements}`;
				      document.querySelector("#users-prev").disabled = page.page <= 0;
				      document.querySelector("#users-next").disabled = page.page + 1 >= page.totalPages;
				    }

				    async function runtimeStats(users) {
				      const ids = users.map((user) => user.id).filter(Boolean);
				      if (!ids.length) return new Map();
				      try {
				        const stats = await json(`/api/admin/users/runtime-stats?${ids.map((id) => "userIds=" + encodeURIComponent(id)).join("&")}`);
				        return new Map(stats.map((item) => [item.userId, item]));
				      } catch (error) {
				        usersResult.textContent = "Runtime stats: " + error.message;
				        return new Map();
				      }
				    }

				    function renderUsers(items, runtimeByUserId) {
				      const body = document.querySelector("#users-body");
				      body.replaceChildren();
				      if (!items.length) {
				        const row = document.createElement("tr");
				        const cell = document.createElement("td");
				        cell.colSpan = 8;
				        cell.textContent = "Пользователей нет.";
				        row.append(cell);
				        body.append(row);
				        return;
				      }
				      for (const user of items) {
				        const runtime = runtimeByUserId.get(user.id) || {};
				        const row = document.createElement("tr");
				        row.append(
				          td(user.email || ""),
				          td((user.roles || []).join(", ")),
				          td(user.blocked ? "заблокирован" : ""),
				          td(`sessions: ${user.sessions || 0}, active: ${user.activeSessions || 0}, passkeys: ${user.passkeys || 0}, audit: ${user.auditEvents || 0}`),
				          td(`player: ${runtime.username || ""}\\nsaves: ${runtime.sessions || 0}, active: ${runtime.activeSessions || 0}, finished: ${runtime.finishedSessions || 0}`),
				          td(`stories: ${runtime.authoredStories || 0}\\ndraft/review/pub/archive: ${runtime.draftStories || 0}/${runtime.reviewStories || 0}/${runtime.publishedStories || 0}/${runtime.archivedStories || 0}\\nruns: ${runtime.authoredRuns || 0}`),
				          td(formatDate(user.createdAt)),
				          userActionCell(user)
				        );
				        body.append(row);
				      }
				    }

				    function userActionCell(user) {
				      const cell = document.createElement("td");
				      cell.className = "actions";
				      const stack = document.createElement("div");
				      stack.className = "action-stack";
					      const block = document.createElement("button");
				      block.type = "button";
				      block.className = user.blocked ? "secondary" : "danger";
				      block.textContent = user.blocked ? "Разблокировать" : "Блокировать";
				      block.addEventListener("click", () => blockUser(user, !user.blocked));
					      const loginLink = document.createElement("button");
					      loginLink.type = "button";
					      loginLink.className = "secondary";
					      loginLink.textContent = "Создать ссылку";
					      loginLink.disabled = user.blocked;
					      loginLink.addEventListener("click", () => sendLoginLink(user));
				      const remove = document.createElement("button");
				      remove.type = "button";
				      remove.className = "danger";
				      remove.textContent = "Удалить";
				      remove.addEventListener("click", () => deleteUser(user));
					      stack.append(loginLink, block, remove);
					      cell.append(stack);
					      return cell;
					    }

				    async function createManualLoginLink(email, options = {}) {
				      const result = await json("/auth/admin/users/login-link", {
					        method: "POST",
					        body: {
					          email,
					          redirectPath: "/",
					          createUser: Boolean(options.createUser),
					          grantRoles: options.grantRoles || [],
					        },
					      });
				      currentManualLoginUrl = result.loginUrl;
				      manualLinkResult.textContent = `Новая ссылка для ${result.email} (действует до ${result.expiresAt}):\n${result.loginUrl}\nПередайте её пользователю вручную.`;
				      copyManualLink.classList.remove("hidden");
				      return result;
				    }

				    async function sendLoginLink(user) {
				      if (!confirm(`Создать новую ссылку для входа ${user.email}? Предыдущие ссылки перестанут работать.`)) return;
				      const result = await createManualLoginLink(user.email);
				      document.querySelector("#manual-link-email").value = user.email;
				      usersResult.textContent = `Ссылка для ${result.email} создана в разделе «Ручная ссылка для входа».`;
				    }

				    async function blockUser(user, blocked) {
				      if (blocked && !confirm(`Заблокировать ${user.email}? Активные сессии будут отозваны.`)) {
				        return;
				      }
				      const result = await json("/auth/admin/users/block", { method: "POST", body: { email: user.email, blocked } });
				      usersResult.textContent = JSON.stringify(result, null, 2);
				      await loadUsers();
				    }

				    async function deleteUser(user) {
				      if (!confirm(`Удалить пользователя ${user.email}? Это удалит auth-сессии, passkey, роли и временные ссылки. Игровые сохранения в основной БД не удаляются.`)) {
				        return;
				      }
				      const result = await json("/auth/admin/users/delete", { method: "POST", body: { email: user.email } });
				      usersResult.textContent = JSON.stringify(result, null, 2);
				      await Promise.all([loadUsers(), loadLoginRequests()]);
				    }

				    async function loadStories() {
				      const status = document.querySelector("#story-status").value;
				      const size = document.querySelector("#story-size").value;
				      const page = await json(`/api/admin/stories?page=${storyPage}&size=${size}&status=${encodeURIComponent(status)}`);
				      storyPage = page.page;
				      storyTotalPages = page.totalPages;
				      renderStories(page.items || []);
				      document.querySelector("#stories-page").textContent =
				        `Страница ${page.totalPages === 0 ? 0 : page.page + 1} из ${page.totalPages}, всего ${page.totalElements}`;
				      document.querySelector("#stories-prev").disabled = page.page <= 0;
				      document.querySelector("#stories-next").disabled = page.page + 1 >= page.totalPages;
				    }

				    function renderStories(items) {
				      const body = document.querySelector("#stories-body");
				      body.replaceChildren();
				      if (!items.length) {
				        const row = document.createElement("tr");
				        const cell = document.createElement("td");
				        cell.colSpan = 7;
				        cell.textContent = "Историй нет.";
				        row.append(cell);
				        body.append(row);
				        return;
				      }
				      for (const story of items) {
				        const row = document.createElement("tr");
				        row.append(
				          td(story.title || ""),
				          td(story.key || ""),
				          tdBadge(story.status || ""),
				          td(story.ownerName || ""),
				          td(String(story.totalRuns ?? 0)),
				          td(formatDate(story.updatedAt)),
				          actionCell(story)
				        );
				        body.append(row);
				      }
				    }

				    function td(text) {
				      const cell = document.createElement("td");
				      cell.textContent = text;
				      return cell;
				    }

				    function tdBadge(text) {
				      const cell = document.createElement("td");
				      const badge = document.createElement("span");
				      badge.className = "badge";
				      badge.textContent = text;
				      cell.append(badge);
				      return cell;
				    }

				    function actionCell(story) {
				      const cell = document.createElement("td");
				      cell.className = "actions";
				      cell.append(
				        actionButton("Опубликовать", "publish", story),
				        actionButton("В архив", "archive", story),
				        actionButton("Удалить", "delete", story, "danger")
				      );
				      return cell;
				    }

				    function actionButton(label, action, story, className = "secondary") {
				      const button = document.createElement("button");
				      button.type = "button";
				      button.className = className;
				      button.textContent = label;
				      button.addEventListener("click", () => runStoryAction(story, action));
				      return button;
				    }

				    async function runStoryAction(story, action) {
				      if (action === "delete" && !confirm(`Удалить историю "${story.title}"? Это удалит сессии, сцены, версии и ассеты.`)) {
				        return;
				      }
				      const method = action === "delete" ? "DELETE" : "POST";
				      const path = action === "delete"
				        ? `/api/admin/stories/${story.storyId}`
				        : `/api/admin/stories/${story.storyId}/${action}`;
				      const result = await json(path, { method });
				      storiesResult.textContent = JSON.stringify(result, null, 2);
				      await loadStories();
				    }

				    function formatDate(value) {
				      if (!value) return "";
				      return new Date(value).toLocaleString("ru-RU");
				    }

				    async function verifyFromUrl() {
				      const params = new URLSearchParams(location.search);
				      const token = params.get("auth_token");
				      if (!token) return;
				      const result = await json("/auth/verify", { method: "POST", body: { token } });
				      history.replaceState({}, document.title, "/auth/admin");
				      loginResult.textContent = JSON.stringify(result, null, 2);
				    }

				    async function loginWithPasskey() {
				      if (!passkeysSupported()) throw new Error("Passkey недоступен в этом браузере.");
				      const options = await json("/auth/passkeys/authentication/options", { method: "POST" });
				      const credential = await navigator.credentials.get({ publicKey: parseRequestOptions(options.publicKey) });
				      if (!credential) throw new Error("Passkey не выбран.");
				      await json("/auth/passkeys/authentication/verify", {
				        method: "POST",
				        body: { challengeId: options.challengeId, credential: credentialToJson(credential) },
				      });
				      await loadMe();
				    }

				    async function registerPasskey() {
				      if (!passkeysSupported()) throw new Error("Passkey недоступен в этом браузере.");
				      const options = await json("/auth/passkeys/registration/options", { method: "POST" });
				      const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options.publicKey) });
				      if (!credential) throw new Error("Passkey не создан.");
				      await json("/auth/passkeys/registration/verify", {
				        method: "POST",
				        body: {
				          challengeId: options.challengeId,
				          displayName: document.querySelector("#passkey-name").value.trim(),
				          credential: credentialToJson(credential),
				        },
				      });
				      document.querySelector("#passkey-name").value = "";
				      passkeyResult.textContent = "Passkey добавлен.";
				      await loadPasskeys();
				    }

				    async function loadPasskeys() {
				      const result = await json("/auth/passkeys");
				      passkeyList.replaceChildren();
				      if (!result.passkeys?.length) {
				        passkeyList.textContent = "Passkey пока не добавлены.";
				        return;
				      }
				      for (const passkey of result.passkeys) {
				        const row = document.createElement("p");
				        row.textContent = `${passkey.displayName} · ${new Date(passkey.createdAt).toLocaleDateString("ru-RU")} `;
				        const remove = document.createElement("button");
				        remove.type = "button";
				        remove.className = "danger";
				        remove.textContent = "Удалить";
				        remove.addEventListener("click", async () => {
				          await json("/auth/passkeys/" + encodeURIComponent(passkey.credentialId), { method: "DELETE" });
				          await loadPasskeys();
				        });
				        row.append(remove);
				        passkeyList.append(row);
				      }
				    }

				    document.querySelector("#login-form").addEventListener("submit", async (event) => {
				      event.preventDefault();
				      const email = document.querySelector("#login-email").value.trim();
					      await json("/auth/login-link", {
					        method: "POST",
					        body: {
					          email,
					          redirectPath: "/auth/admin",
					          personalDataConsent: document.querySelector("#login-consent").checked,
					        },
					      });
				      loginResult.textContent = "Запрос принят. Если вход для этого адреса доступен, инструкции будут доставлены доступным способом.";
				      try {
				        const dev = await json("/auth/dev/magic-links?email=" + encodeURIComponent(email));
				        const link = dev.links?.[0]?.link;
				        if (link) {
				          loginResult.innerHTML = "";
				          const a = document.createElement("a");
				          a.href = link;
				          a.textContent = "Открыть dev-ссылку для входа";
				          loginResult.append(a);
				        }
				      } catch {}
				    });

				    document.querySelector("#passkey-login").addEventListener("click", () => {
				      loginWithPasskey().catch((error) => { loginResult.textContent = error.message; });
				    });

				    document.querySelector("#passkey-register").addEventListener("click", () => {
				      registerPasskey().catch((error) => { passkeyResult.textContent = error.message; });
				    });

				    document.querySelector("#role-form").addEventListener("submit", async (event) => {
				      event.preventDefault();
				      const payload = {
				        email: document.querySelector("#target-email").value.trim(),
				        role: document.querySelector("#role").value,
				        grant: document.querySelector("#grant").value === "true",
				      };
				      const result = await json("/auth/admin/roles", { method: "POST", body: payload });
				      roleResult.textContent = JSON.stringify(result, null, 2);
				      await loadUsers();
				    });

				    document.querySelector("#manual-link-form").addEventListener("submit", async (event) => {
				      event.preventDefault();
				      const email = document.querySelector("#manual-link-email").value.trim();
				      if (!confirm(`Создать новую ссылку для входа ${email}? Предыдущие ссылки перестанут работать.`)) return;
				      try {
				        await createManualLoginLink(email);
				      } catch (error) {
				        currentManualLoginUrl = "";
				        copyManualLink.classList.add("hidden");
				        manualLinkResult.textContent = error.message;
				      }
				    });

				    copyManualLink.addEventListener("click", async () => {
				      if (!currentManualLoginUrl) return;
				      await navigator.clipboard.writeText(currentManualLoginUrl);
				      copyManualLink.textContent = "Скопировано";
				    });

				    document.querySelector("#request-query").addEventListener("input", () => {
				      requestPage = 0;
				      loadLoginRequests().catch((error) => { requestsResult.textContent = error.message; });
				    });
				    document.querySelector("#request-size").addEventListener("change", () => {
				      requestPage = 0;
				      loadLoginRequests().catch((error) => { requestsResult.textContent = error.message; });
				    });
				    document.querySelector("#refresh-requests").addEventListener("click", () => {
				      loadLoginRequests().catch((error) => { requestsResult.textContent = error.message; });
				    });
				    document.querySelector("#requests-prev").addEventListener("click", () => {
				      if (requestPage > 0) requestPage -= 1;
				      loadLoginRequests().catch((error) => { requestsResult.textContent = error.message; });
				    });
				    document.querySelector("#requests-next").addEventListener("click", () => {
				      if (requestPage + 1 < requestTotalPages) requestPage += 1;
				      loadLoginRequests().catch((error) => { requestsResult.textContent = error.message; });
				    });

				    document.querySelector("#user-query").addEventListener("input", () => {
				      userPage = 0;
				      loadUsers().catch((error) => { usersResult.textContent = error.message; });
				    });
				    document.querySelector("#user-size").addEventListener("change", () => {
				      userPage = 0;
				      loadUsers().catch((error) => { usersResult.textContent = error.message; });
				    });
				    document.querySelector("#refresh-users").addEventListener("click", () => {
				      loadUsers().catch((error) => { usersResult.textContent = error.message; });
				    });
				    document.querySelector("#users-prev").addEventListener("click", () => {
				      if (userPage > 0) userPage -= 1;
				      loadUsers().catch((error) => { usersResult.textContent = error.message; });
				    });
				    document.querySelector("#users-next").addEventListener("click", () => {
				      if (userPage + 1 < userTotalPages) userPage += 1;
				      loadUsers().catch((error) => { usersResult.textContent = error.message; });
				    });

				    document.querySelector("#story-status").addEventListener("change", () => {
				      storyPage = 0;
				      loadStories().catch((error) => { storiesResult.textContent = error.message; });
				    });
				    document.querySelector("#story-size").addEventListener("change", () => {
				      storyPage = 0;
				      loadStories().catch((error) => { storiesResult.textContent = error.message; });
				    });
				    document.querySelector("#refresh-stories").addEventListener("click", () => {
				      loadStories().catch((error) => { storiesResult.textContent = error.message; });
				    });
				    document.querySelector("#stories-prev").addEventListener("click", () => {
				      if (storyPage > 0) storyPage -= 1;
				      loadStories().catch((error) => { storiesResult.textContent = error.message; });
				    });
				    document.querySelector("#stories-next").addEventListener("click", () => {
				      if (storyPage + 1 < storyTotalPages) storyPage += 1;
				      loadStories().catch((error) => { storiesResult.textContent = error.message; });
				    });

				    document.querySelector("#logout").addEventListener("click", async () => {
				      await json("/auth/logout", { method: "POST" });
				      location.href = "/auth/admin";
				    });

				    verifyFromUrl().then(loadMe).catch((error) => {
				      loginResult.textContent = error.message;
				      loadMe();
				    });
				  </script>
				</body>
				</html>
				""";
	}

	@GetMapping("/dev/magic-links")
	Map<String, Object> devLinks(@RequestParam String email) {
		if (!devMode) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}
		return Map.of("links", devLinks.getOrDefault(AuthServiceApplication.normalizeEmail(email), List.of()));
	}

	@PostMapping("/dev/roles")
	Map<String, Object> devRole(@Valid @RequestBody RoleRequest request) {
		if (!devMode) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}
		if (!List.of("player", "author", "admin").contains(request.role())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only player/author/admin can be changed in dev");
		}
		User user = store.user(AuthServiceApplication.normalizeEmail(request.email()), true).orElseThrow();
		if ("player".equals(request.role()) && request.grant()) {
			store.demoteToPlayer(user.id());
		}
		else if (request.grant()) {
			store.grantRole(user.id(), request.role());
		}
		else {
			store.removeRole(user.id(), request.role());
		}
		store.audit(user.id(), user.email(), "dev_role_changed", "{\"role\":\"" + request.role() + "\"}");
		return userView(store.user(user.email(), true).orElseThrow());
	}

	private TokenPair issue(User user, String authMethod) {
		String sessionId = UUID.randomUUID().toString();
		Instant now = Instant.now();
		store.createSession(sessionId, user.id(), now.plusSeconds(refreshTtl), authMethod, now);
		return tokenPair(user, sessionId, now);
	}

	private TokenPair rotate(User user, String sessionId) {
		return tokenPair(user, sessionId, Instant.now());
	}

	private TokenPair tokenPair(User user, String sessionId, Instant now) {
		String refreshToken = UUID.randomUUID() + "." + UUID.randomUUID();
		String refreshId = UUID.randomUUID().toString();
		store.createRefresh(refreshId, sessionId, sha256(refreshToken), now.plusSeconds(refreshTtl));
		String accessToken = jwt.encode(user, sessionId, now.plusSeconds(accessTtl));
		return new TokenPair(accessToken, refreshToken, refreshId);
	}

	private User currentUser(String authorization, String accessToken) {
		return userForClaims(currentClaims(authorization, accessToken));
	}

	private JwtClaims currentClaims(String authorization, String accessToken) {
		String token = accessToken;
		if ((token == null || token.isBlank()) && authorization != null && authorization.startsWith("Bearer ")) {
			token = authorization.substring("Bearer ".length());
		}
		if (token == null || token.isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing access token");
		}
		return jwt.decode(token);
	}

	private User userForClaims(JwtClaims claims) {
		User user = store.userById(claims.userId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		if (user.blockedAt() != null) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
		}
		return user;
	}

	private void requireRecentAuthentication(JwtClaims claims) {
		SessionAuthentication authentication = store.sessionAuthentication(claims.sessionId())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Recent authentication required"));
		Instant cutoff = Instant.now().minusSeconds(passkeyRegistrationRecentAuthSeconds);
		if (authentication.authenticatedAt() == null
				|| authentication.authenticatedAt().isBefore(cutoff)
				|| !List.of("magic_link", "passkey").contains(authentication.authMethod())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Recent authentication required");
		}
	}

	private void addCookies(HttpServletResponse response, TokenPair pair) {
		response.addHeader(HttpHeaders.SET_COOKIE, cookie("fraer_access", pair.accessToken(), accessTtl).toString());
		response.addHeader(HttpHeaders.SET_COOKIE, cookie("fraer_refresh", pair.refreshToken(), refreshTtl).toString());
	}

	private void clearCookies(HttpServletResponse response) {
		response.addHeader(HttpHeaders.SET_COOKIE, cookie("fraer_access", "", 0).toString());
		response.addHeader(HttpHeaders.SET_COOKIE, cookie("fraer_refresh", "", 0).toString());
	}

	private ResponseCookie cookie(String name, String value, long ttl) {
		return ResponseCookie.from(name, value)
				.httpOnly(true)
				.secure(cookieSecure)
				.sameSite(sameSite)
				.path("/")
				.maxAge(ttl)
				.build();
	}

	private Map<String, Object> userView(User user) {
		return Map.of("id", user.id(), "email", user.email(), "roles", user.roles(), "blocked", user.blockedAt() != null);
	}

	private void sendMail(String email, String link) {
		if (!smtpAvailable()) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "SMTP is not configured");
		}
		SimpleMailMessage message = new SimpleMailMessage();
		message.setTo(email);
		message.setFrom(smtpFrom);
		message.setSubject("Ссылка для входа в FraerApp");
		message.setText("Откройте ссылку, чтобы войти в FraerApp:\n\n" + link
				+ "\n\nСсылка действует ограниченное время. Новая ссылка отменяет предыдущую. "
				+ "Если вы не запрашивали вход, проигнорируйте это письмо.");
		mail.get().send(message);
	}

	private boolean smtpAvailable() {
		return smtpHost != null && !smtpHost.isBlank() && mail.isPresent();
	}

	private boolean canLogAdminLoginLink(String email) {
		Optional<User> existing = store.user(email, false);
		if (existing.isPresent()) {
			User user = existing.get();
			return user.blockedAt() == null && user.roles().contains("admin");
		}
		return isBootstrapAdmin(email);
	}

	private boolean isBootstrapAdmin(String email) {
		return !AuthServiceApplication.normalizeEmail(bootstrapAdminEmail).isBlank()
				&& AuthServiceApplication.normalizeEmail(bootstrapAdminEmail).equals(AuthServiceApplication.normalizeEmail(email));
	}

	private String safeRedirect(String redirect) {
		if (redirect == null || redirect.isBlank() || !redirect.startsWith("/") || redirect.startsWith("//")) {
			return "/";
		}
		return redirect.length() > 500 ? "/" : redirect;
	}

	private String requestBaseUrl(HttpServletRequest request) {
		if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
			return stripTrailingSlash(publicBaseUrl.trim());
		}
		String proto = firstHeader(request, "X-Forwarded-Proto");
		String host = firstHeader(request, "X-Forwarded-Host");
		if (proto == null || proto.isBlank()) {
			proto = request.getScheme();
		}
		if (host == null || host.isBlank()) {
			host = request.getHeader(HttpHeaders.HOST);
		}
		if (host == null || host.isBlank()) {
			host = request.getServerName();
			int port = request.getServerPort();
			if (port > 0 && port != 80 && port != 443) {
				host = host + ":" + port;
			}
		}
		return stripTrailingSlash(proto + "://" + host);
	}

	private String firstHeader(HttpServletRequest request, String name) {
		String value = request.getHeader(name);
		if (value == null || value.isBlank()) {
			return null;
		}
		int comma = value.indexOf(',');
		return (comma >= 0 ? value.substring(0, comma) : value).trim();
	}

	private String clientAddress(HttpServletRequest request) {
		String realIp = firstHeader(request, "X-Real-IP");
		return realIp == null || realIp.isBlank() ? request.getRemoteAddr() : realIp;
	}

	private String stripTrailingSlash(String value) {
		while (value.endsWith("/")) {
			value = value.substring(0, value.length() - 1);
		}
		return value;
	}

	private void checkRate(String key, int limit, Duration duration) {
		Window window = rate.compute(key, (ignored, existing) -> {
			Instant now = Instant.now();
			if (existing == null || existing.resetAt().isBefore(now)) {
				return new Window(1, now.plus(duration));
			}
			return new Window(existing.count() + 1, existing.resetAt());
		});
		if (window.count() > limit) {
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
		}
	}

	private static String sha256(String value) {
		try {
			return hex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static String hex(byte[] bytes) {
		StringBuilder builder = new StringBuilder(bytes.length * 2);
		for (byte b : bytes) {
			builder.append(String.format("%02x", b));
		}
		return builder.toString();
	}

	private static String url64(byte[] bytes) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	record LoginLinkRequest(@Email @NotBlank String email, String redirectPath, boolean personalDataConsent) {
	}

	record AdminLoginLinkRequest(@Email @NotBlank String email, String redirectPath, boolean createUser,
			List<String> grantRoles) {
		AdminLoginLinkRequest(String email, String redirectPath) {
			this(email, redirectPath, false, List.of());
		}

		List<String> safeGrantRoles() {
			return grantRoles == null ? List.of() : grantRoles;
		}
	}

	record VerifyRequest(@NotBlank String token) {
	}

	record RoleRequest(@Email @NotBlank String email, @NotBlank String role, boolean grant) {
	}

	record BlockRequest(@Email @NotBlank String email, boolean blocked) {
	}

	record DeleteUserRequest(@Email @NotBlank String email) {
	}

	record DeleteLoginRequest(@Email @NotBlank String email) {
	}

	record PasskeyRegistrationFinishRequest(
			@NotBlank String challengeId,
			@Size(max = 120) String displayName,
			@NotNull Map<String, Object> credential) {
	}

	record PasskeyAuthenticationFinishRequest(
			@NotBlank String challengeId,
			@NotNull Map<String, Object> credential) {
	}

	record TokenPair(String accessToken, String refreshToken, String refreshId) {
	}

	record DevLink(String email, String link, Instant expiresAt) {
	}

	record CreatedLoginLink(String loginUrl, Instant expiresAt) {
	}

	record Window(int count, Instant resetAt) {
	}

	record AdminUserPage(int page, int size, long totalElements, int totalPages, List<AdminUserSummary> items) {
	}

	record AdminLoginRequestPage(int page, int size, long totalElements, int totalPages,
			List<AdminLoginRequestSummary> items) {
	}

	record AdminLoginRequestSummary(
			String email,
			Instant lastRequestedAt,
			long requestCount,
			String userId,
			List<String> roles,
			boolean blocked,
			long activeUnusedLinks) {
	}

	record AdminUserSummary(
			String id,
			String email,
			List<String> roles,
			boolean blocked,
			Instant blockedAt,
			Instant createdAt,
			Instant updatedAt,
			long sessions,
			long activeSessions,
			long passkeys,
			long auditEvents) {
	}
}

@org.springframework.stereotype.Component
class JwtCodec {

	private final ObjectMapper json;
	private final byte[] secret;

	JwtCodec(@Value("${auth.jwt.secret}") String secret) {
		this.json = new ObjectMapper();
		this.secret = secret.getBytes(StandardCharsets.UTF_8);
	}

	String encode(User user, String sessionId, Instant expiresAt) {
		try {
			Instant now = Instant.now();
			Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT", "kid", "fraerapp-dev");
			Map<String, Object> claims = Map.of(
					"sub", user.id(),
					"email", user.email(),
					"roles", user.roles(),
					"sid", sessionId,
					"iat", now.getEpochSecond(),
					"exp", expiresAt.getEpochSecond());
			String unsigned = part(header) + "." + part(claims);
			return unsigned + "." + sign(unsigned);
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	JwtClaims decode(String token) {
		try {
			String[] parts = token.split("\\.");
			if (parts.length != 3 || !MessageDigest.isEqual(sign(parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8),
					parts[2].getBytes(StandardCharsets.UTF_8))) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
			}
			@SuppressWarnings("unchecked")
			Map<String, Object> claims = json.readValue(Base64.getUrlDecoder().decode(parts[1]), Map.class);
			Number exp = (Number) claims.get("exp");
			if (exp == null || Instant.ofEpochSecond(exp.longValue()).isBefore(Instant.now())) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token expired");
			}
			return new JwtClaims((String) claims.get("sub"), (String) claims.get("sid"));
		}
		catch (ResponseStatusException ex) {
			throw ex;
		}
		catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
		}
	}

	Map<String, Object> jwks() {
		return Map.of("keys", List.of(Map.of(
				"kty", "oct",
				"kid", "fraerapp-dev",
				"alg", "HS256",
				"k", Base64.getUrlEncoder().withoutPadding().encodeToString(secret))));
	}

	private String part(Object value) throws Exception {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(json.writeValueAsBytes(value));
	}

	private String sign(String value) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(secret, "HmacSHA256"));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
	}
}

@org.springframework.stereotype.Repository
class AuthStore {

	private final JdbcTemplate jdbc;

	AuthStore(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	Optional<User> user(String email, boolean create) {
		Optional<User> existing = userByEmail(email);
		if (existing.isPresent() || !create) {
			return existing;
		}
		String id = UUID.randomUUID().toString();
		Instant now = Instant.now();
		jdbc.update("insert into users(id, email, email_verified, created_at, updated_at) values (?, ?, ?, ?, ?)",
				id, email, true, timestamp(now), timestamp(now));
		grantRole(id, "player");
		return userByEmail(email);
	}

	Optional<User> userByEmail(String email) {
		List<User> users = jdbc.query("select id, email, blocked_at, created_at, updated_at from users where email = ?",
				(rs, row) -> userRow(rs.getString(1), rs.getString(2), instant(rs.getTimestamp(3)), rs.getTimestamp(4).toInstant(),
						rs.getTimestamp(5).toInstant()), email);
		return users.stream().findFirst();
	}

	Optional<User> userById(String id) {
		List<User> users = jdbc.query("select id, email, blocked_at, created_at, updated_at from users where id = ?",
				(rs, row) -> userRow(rs.getString(1), rs.getString(2), instant(rs.getTimestamp(3)), rs.getTimestamp(4).toInstant(),
						rs.getTimestamp(5).toInstant()), id);
		return users.stream().findFirst();
	}

	Optional<User> userBySession(String sessionId) {
		List<User> users = jdbc.query("""
				select u.id, u.email, u.blocked_at, u.created_at, u.updated_at from users u
				join sessions s on s.user_id = u.id
				where s.id = ? and s.revoked_at is null and s.expires_at > ?
				""", (rs, row) -> userRow(rs.getString(1), rs.getString(2), instant(rs.getTimestamp(3)), rs.getTimestamp(4).toInstant(),
				rs.getTimestamp(5).toInstant()), sessionId, timestamp(Instant.now()));
		return users.stream().findFirst();
	}

	User userForTelegram(long telegramUserId, long telegramChatId, String username) {
		Optional<User> existing = userByTelegramId(telegramUserId);
		if (existing.isPresent()) {
			touchTelegramIdentity(telegramUserId, telegramChatId, username);
			return existing.get();
		}
		String email = telegramEmail(telegramUserId);
		User user = user(email, true).orElseThrow();
		Instant now = Instant.now();
		jdbc.update("""
				insert into telegram_identities(
					telegram_user_id, telegram_chat_id, user_id, username, created_at, updated_at, last_seen_at
				)
				select ?, ?, ?, ?, ?, ?, ?
				where not exists (select 1 from telegram_identities where telegram_user_id = ?)
				""", telegramUserId, telegramChatId, user.id(), blankToNull(username), timestamp(now), timestamp(now),
				timestamp(now), telegramUserId);
		return userByTelegramId(telegramUserId).orElse(user);
	}

	Optional<User> userByTelegramId(long telegramUserId) {
		List<User> users = jdbc.query("""
				select u.id, u.email, u.blocked_at, u.created_at, u.updated_at
				from telegram_identities t
				join users u on u.id = t.user_id
				where t.telegram_user_id = ?
				""", (rs, row) -> userRow(rs.getString(1), rs.getString(2), instant(rs.getTimestamp(3)),
				rs.getTimestamp(4).toInstant(), rs.getTimestamp(5).toInstant()), telegramUserId);
		return users.stream().findFirst();
	}

	private void touchTelegramIdentity(long telegramUserId, long telegramChatId, String username) {
		Instant now = Instant.now();
		jdbc.update("""
				update telegram_identities
				set telegram_chat_id = ?, username = ?, updated_at = ?, last_seen_at = ?
				where telegram_user_id = ?
				""", telegramChatId, blankToNull(username), timestamp(now), timestamp(now), telegramUserId);
	}

	private String telegramEmail(long telegramUserId) {
		return "telegram-" + telegramUserId + "@telegram.fraerapp.local";
	}

	private String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	AuthController.AdminUserPage adminUsers(int page, int size, String query) {
		int safePage = Math.max(0, page);
		int safeSize = Math.min(100, Math.max(1, size));
		String search = query == null ? "" : query.trim().toLowerCase();
		String like = "%" + search + "%";
		long total = jdbc.queryForObject("select count(*) from users where lower(email) like ?", Long.class, like);
		List<AuthController.AdminUserSummary> items = jdbc.query("""
				select id, email, blocked_at, created_at, updated_at
				from users
				where lower(email) like ?
				order by created_at desc
				limit ? offset ?
				""", (rs, row) -> adminUserRow(
				rs.getString(1),
				rs.getString(2),
				instant(rs.getTimestamp(3)),
				rs.getTimestamp(4).toInstant(),
				rs.getTimestamp(5).toInstant()), like, safeSize, safePage * safeSize);
		int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
		return new AuthController.AdminUserPage(safePage, safeSize, total, totalPages, items);
	}

	AuthController.AdminLoginRequestPage adminLoginRequests(int page, int size, String query) {
		int safePage = Math.max(0, page);
		int safeSize = Math.min(100, Math.max(1, size));
		String search = query == null ? "" : query.trim().toLowerCase();
		String like = "%" + search + "%";
		long total = jdbc.queryForObject("""
				select count(*) from (
					select email from auth_audit_events
					where event_type = 'login_link_requested' and email is not null and lower(email) like ?
					group by email
				) requests
				""", Long.class, like);
		List<AuthController.AdminLoginRequestSummary> items = jdbc.query("""
				select email, max(created_at) as last_requested_at, count(*) as request_count
				from auth_audit_events
				where event_type = 'login_link_requested' and email is not null and lower(email) like ?
				group by email
				order by max(created_at) desc
				limit ? offset ?
				""", (rs, row) -> adminLoginRequestRow(
				rs.getString(1),
				rs.getTimestamp(2).toInstant(),
				rs.getLong(3)), like, safeSize, safePage * safeSize);
		int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
		return new AuthController.AdminLoginRequestPage(safePage, safeSize, total, totalPages, items);
	}

	DeletedLoginRequest deleteLoginRequest(String email) {
		int unusedLinksDeleted = jdbc.update("""
				delete from email_login_tokens
				where email = ? and used_at is null
				""", email);
		int requestEventsDeleted = jdbc.update("""
				delete from auth_audit_events
				where email = ? and event_type = 'login_link_requested'
				""", email);
		return new DeletedLoginRequest(requestEventsDeleted, unusedLinksDeleted);
	}

	void createMagicLink(String email, String tokenHash, String redirectPath, Instant expiresAt) {
		jdbc.update("""
				insert into email_login_tokens(id, email, token_hash, redirect_path, expires_at, created_at)
				values (?, ?, ?, ?, ?, ?)
				""", UUID.randomUUID().toString(), email, tokenHash, redirectPath, timestamp(expiresAt), timestamp(Instant.now()));
	}

	void invalidateOtherActiveMagicLinks(String email, String currentTokenHash) {
		Instant now = Instant.now();
		jdbc.update("""
				update email_login_tokens set used_at = ?
				where email = ? and token_hash <> ? and used_at is null and expires_at > ?
				""", timestamp(now), email, currentTokenHash, timestamp(now));
	}

	void recordConsent(String email, String policyVersion, String source) {
		jdbc.update("""
				insert into personal_data_consents(id, email, policy_version, source, accepted_at)
				values (?, ?, ?, ?, ?)
				""", UUID.randomUUID().toString(), email, policyVersion, source, timestamp(Instant.now()));
	}

	Optional<MagicLink> magicLink(String tokenHash) {
		List<MagicLink> links = jdbc.query("""
				select id, email, redirect_path, expires_at, used_at from email_login_tokens where token_hash = ?
				""", (rs, row) -> new MagicLink(rs.getString(1), rs.getString(2), rs.getString(3),
				rs.getTimestamp(4).toInstant(), rs.getTimestamp(5) == null ? null : rs.getTimestamp(5).toInstant()), tokenHash);
		return links.stream().findFirst();
	}

	void consumeMagicLink(String id) {
		jdbc.update("update email_login_tokens set used_at = ? where id = ? and used_at is null", timestamp(Instant.now()), id);
	}

	void createSession(String id, String userId, Instant expiresAt, String authMethod, Instant authenticatedAt) {
		jdbc.update("""
				insert into sessions(id, user_id, created_at, expires_at, auth_method, authenticated_at)
				values (?, ?, ?, ?, ?, ?)
				""", id, userId, timestamp(Instant.now()), timestamp(expiresAt), authMethod, timestamp(authenticatedAt));
	}

	Optional<SessionAuthentication> sessionAuthentication(String sessionId) {
		List<SessionAuthentication> values = jdbc.query("""
				select auth_method, authenticated_at from sessions
				where id = ? and revoked_at is null and expires_at > ?
				""", (rs, row) -> new SessionAuthentication(
				rs.getString(1), rs.getTimestamp(2) == null ? null : rs.getTimestamp(2).toInstant()),
				sessionId, timestamp(Instant.now()));
		return values.stream().findFirst();
	}

	void createRefresh(String id, String sessionId, String tokenHash, Instant expiresAt) {
		jdbc.update("""
				insert into refresh_tokens(id, session_id, token_hash, created_at, expires_at)
				values (?, ?, ?, ?, ?)
				""", id, sessionId, tokenHash, timestamp(Instant.now()), timestamp(expiresAt));
	}

	Optional<RefreshToken> refresh(String tokenHash) {
		List<RefreshToken> tokens = jdbc.query("""
				select id, session_id, expires_at, revoked_at from refresh_tokens where token_hash = ?
				""", (rs, row) -> new RefreshToken(rs.getString(1), rs.getString(2), rs.getTimestamp(3).toInstant(),
				rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant()), tokenHash);
		return tokens.stream().findFirst();
	}

	void revokeRefresh(String id) {
		jdbc.update("update refresh_tokens set revoked_at = ? where id = ? and revoked_at is null", timestamp(Instant.now()), id);
	}

	void replaceRefresh(String oldId, String newId) {
		jdbc.update("update refresh_tokens set replaced_by_token_id = ? where id = ?", newId, oldId);
	}

	void revokeSession(String id) {
		Instant now = Instant.now();
		jdbc.update("update sessions set revoked_at = ? where id = ? and revoked_at is null", timestamp(now), id);
		jdbc.update("update refresh_tokens set revoked_at = ? where session_id = ? and revoked_at is null", timestamp(now), id);
	}

	void revokeAllSessions(String userId) {
		Instant now = Instant.now();
		jdbc.update("update sessions set revoked_at = ? where user_id = ? and revoked_at is null", timestamp(now), userId);
		jdbc.update("""
				update refresh_tokens set revoked_at = ?
				where session_id in (select id from sessions where user_id = ?) and revoked_at is null
				""", timestamp(now), userId);
	}

	void blockUser(String userId) {
		Instant now = Instant.now();
		jdbc.update("update users set blocked_at = ?, updated_at = ? where id = ?", timestamp(now), timestamp(now), userId);
		revokeAllSessions(userId);
	}

	void unblockUser(String userId) {
		jdbc.update("update users set blocked_at = null, updated_at = ? where id = ?", timestamp(Instant.now()), userId);
	}

	void deleteUser(String userId, String email) {
		jdbc.update("delete from passkey_challenges where user_id = ?", userId);
		jdbc.update("delete from passkey_credentials where user_id = ?", userId);
		jdbc.update("""
				delete from refresh_tokens
				where session_id in (select id from sessions where user_id = ?)
				""", userId);
		jdbc.update("delete from sessions where user_id = ?", userId);
		jdbc.update("delete from user_roles where user_id = ?", userId);
		jdbc.update("delete from personal_data_consents where email = ?", email);
		jdbc.update("delete from email_login_tokens where email = ?", email);
		jdbc.update("delete from auth_audit_events where user_id = ? or email = ?", userId, email);
		jdbc.update("delete from users where id = ?", userId);
	}

	void grantRole(String userId, String role) {
		jdbc.update("""
				insert into user_roles(user_id, role_name, created_at)
				select ?, ?, ? where not exists (select 1 from user_roles where user_id = ? and role_name = ?)
				""", userId, role, timestamp(Instant.now()), userId, role);
	}

	void removeRole(String userId, String role) {
		if (!"player".equals(role)) {
			jdbc.update("delete from user_roles where user_id = ? and role_name = ?", userId, role);
		}
	}

	void demoteToPlayer(String userId) {
		grantRole(userId, "player");
		jdbc.update("delete from user_roles where user_id = ? and role_name in ('author', 'admin')", userId);
	}

	void audit(String userId, String email, String eventType, String metadata) {
		jdbc.update("""
				insert into auth_audit_events(id, user_id, email, event_type, metadata, created_at)
				values (?, ?, ?, ?, ?, ?)
				""", UUID.randomUUID().toString(), userId, email, eventType, metadata, timestamp(Instant.now()));
	}

	private User userRow(String id, String email, Instant blockedAt, Instant createdAt, Instant updatedAt) {
		List<String> roles = jdbc.queryForList("select role_name from user_roles where user_id = ? order by role_name", String.class, id);
		return new User(id, email, roles, blockedAt, createdAt, updatedAt);
	}

	private AuthController.AdminUserSummary adminUserRow(String id, String email, Instant blockedAt, Instant createdAt, Instant updatedAt) {
		List<String> roles = jdbc.queryForList("select role_name from user_roles where user_id = ? order by role_name", String.class, id);
		long sessionsCount = jdbc.queryForObject("select count(*) from sessions where user_id = ?", Long.class, id);
		long activeSessions = jdbc.queryForObject("select count(*) from sessions where user_id = ? and revoked_at is null and expires_at > ?",
				Long.class, id, timestamp(Instant.now()));
		long passkeys = jdbc.queryForObject("select count(*) from passkey_credentials where user_id = ?", Long.class, id);
		long auditEvents = jdbc.queryForObject("select count(*) from auth_audit_events where user_id = ? or email = ?", Long.class, id, email);
		return new AuthController.AdminUserSummary(id, email, roles, blockedAt != null, blockedAt, createdAt, updatedAt,
				sessionsCount, activeSessions, passkeys, auditEvents);
	}

	private AuthController.AdminLoginRequestSummary adminLoginRequestRow(String email, Instant lastRequestedAt, long requestCount) {
		Optional<User> user = userByEmail(email);
		return new AuthController.AdminLoginRequestSummary(
				email,
				lastRequestedAt,
				requestCount,
				user.map(User::id).orElse(null),
				user.map(User::roles).orElse(List.of()),
				user.map(value -> value.blockedAt() != null).orElse(false),
				activeUnusedLoginLinks(email));
	}

	private long activeUnusedLoginLinks(String email) {
		return jdbc.queryForObject("""
				select count(*) from email_login_tokens
				where email = ? and used_at is null and expires_at > ?
				""", Long.class, email, timestamp(Instant.now()));
	}

	private Instant instant(java.sql.Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	private java.sql.Timestamp timestamp(Instant instant) {
		return java.sql.Timestamp.from(instant);
	}

	record DeletedLoginRequest(int requestEventsDeleted, int unusedLinksDeleted) {
	}
}

record User(String id, String email, List<String> roles, Instant blockedAt, Instant createdAt, Instant updatedAt) {
}

record MagicLink(String id, String email, String redirectPath, Instant expiresAt, Instant usedAt) {
}

record RefreshToken(String id, String sessionId, Instant expiresAt, Instant revokedAt) {
}

record JwtClaims(String userId, String sessionId) {
}

record SessionAuthentication(String authMethod, Instant authenticatedAt) {
}

record TelegramMessage(long chatId, long userId, String username) {
}

interface TelegramMessenger {

	boolean configured();
}

@Component
class TelegramBotApiClient implements TelegramMessenger {

	private final String token;

	TelegramBotApiClient(@Value("${auth.telegram.bot-token:}") String token) {
		this.token = token == null ? "" : token.trim();
	}

	@Override
	public boolean configured() {
		return !token.isBlank();
	}
}

@Configuration
class AuthCorsConfig implements WebMvcConfigurer {

	private final String[] allowedOrigins;

	AuthCorsConfig(@Value("${auth.cors.allowed-origins}") String allowedOrigins) {
		this.allowedOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
				.map(String::trim)
				.filter(origin -> !origin.isBlank())
				.toArray(String[]::new);
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/auth/**")
				.allowedOrigins(allowedOrigins)
				.allowedMethods("GET", "POST", "DELETE", "OPTIONS")
				.allowedHeaders("*")
				.allowCredentials(true);
	}
}
