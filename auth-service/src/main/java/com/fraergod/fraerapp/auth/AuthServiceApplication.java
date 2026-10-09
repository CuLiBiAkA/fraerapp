package com.fraergod.fraerapp.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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

	@Bean
	ApplicationRunner bootstrap(AuthStore store, @Value("${auth.bootstrap-admin-email:}") String adminEmail) {
		return args -> {
			if (adminEmail != null && !adminEmail.isBlank()) {
				store.bootstrapAdmin(normalizeEmail(adminEmail));
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
	private final SubscriptionService subscriptions;
	private final Map<String, List<DevLink>> devLinks = new ConcurrentHashMap<>();
	private static final int MAX_RATE_WINDOWS = 10_000;
	private final Map<String, Window> rate = new LinkedHashMap<>();
	private final Map<String, Window> rateOverflow = new LinkedHashMap<>();

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
			TelegramMessenger telegram, SubscriptionService subscriptions) {
		this.subscriptions = subscriptions;
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
			if (!List.of("author", "moderator", "admin").contains(role)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only author/moderator/admin can be pre-granted");
			}
		}
		for (String role : request.safeGrantRoles()) {
			store.grantRole(user.id(), role);
			store.audit(admin.id(), admin.email(), "role_changed", roleChangeMetadata(user, role, true));
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
				&& !telegramBotUsername.isBlank() && telegramWebhookSecret != null && !telegramWebhookSecret.isBlank();
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
		if (telegramWebhookSecret == null || telegramWebhookSecret.isBlank() || secretToken == null
				|| !MessageDigest.isEqual(telegramWebhookSecret.getBytes(StandardCharsets.UTF_8),
						secretToken.getBytes(StandardCharsets.UTF_8))) {
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
		if (chat == null || !"private".equals(chat.get("type"))) {
			return Optional.empty();
		}
		long chatId = longValue(chat.get("id"));
		long userId = longValue(from == null ? null : from.get("id"));
		String username = stringValue(from == null ? null : from.get("username"));
		if (chatId <= 0L || userId <= 0L || chatId != userId || booleanValue(from == null ? null : from.get("is_bot"))) {
			return Optional.empty();
		}
		return Optional.of(new TelegramMessage(chatId, userId, username));
	}

	private Map<?, ?> mapValue(Object value) {
		return value instanceof Map<?, ?> map ? map : null;
	}

	private long longValue(Object value) {
		// Telegram IDs are JSON integers. Never truncate decimals or reinterpret strings.
		if (value instanceof Integer || value instanceof Long) {
			return ((Number) value).longValue();
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
		VerifiedLogin login = store.transaction(() -> {
			MagicLink link = store.magicLink(sha256(request.token()))
					.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid login link"));
			if (link.usedAt() != null || !link.expiresAt().isAfter(Instant.now())) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login link expired");
			}
			// Unknown tokens allocate no limiter state; one user's link cannot exhaust another's allowance.
			// The edge additionally limits requests before they reach the database.
			checkRate("verify:" + link.id(), devMode ? 200 : 20, Duration.ofMinutes(15));
			if (!store.consumeMagicLink(link.id())) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login link expired");
			}
			User user = isBootstrapAdmin(link.email())
					? store.bootstrapAdmin(link.email()).orElseGet(() -> store.user(link.email(), true).orElseThrow())
					: store.user(link.email(), true).orElseThrow();
			if (user.blockedAt() != null) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
			}
			TokenPair pair = issue(user, "magic_link");
			store.audit(user.id(), user.email(), "login_link_verified", "{}");
			return new VerifiedLogin(user, pair, link.redirectPath() == null ? "/" : link.redirectPath());
		});
		addCookies(response, login.pair());
		return Map.of("user", userView(login.user()), "redirectPath", login.redirectPath());
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
		User user = store.userBySession(token.sessionId())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired or revoked"));
		if (user.blockedAt() != null) {
			store.revokeSession(token.sessionId());
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is blocked");
		}
		TokenPair pair = store.transaction(() -> {
			if (!store.revokeRefresh(token.id())) {
				throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
			}
			TokenPair replacement = rotate(user, token.sessionId());
			store.replaceRefresh(token.id(), replacement.refreshId());
			store.audit(user.id(), user.email(), "refreshed", "{}");
			return replacement;
		});
		addCookies(response, pair);
		return Map.of("user", userView(user));
	}

	@GetMapping("/me")
	Map<String, Object> me(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken, HttpServletResponse response) {
		response.setHeader("Cache-Control", "private, no-store");
		JwtClaims claims = currentClaims(authorization, accessToken);
		User user = userForClaims(claims);
		return Map.of("id", user.id(), "email", user.email(), "roles", user.roles(),
				"blocked", false, "sessionId", claims.sessionId(),"subscriptionActive",subscriptions.active(user.id()));
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
		if (!List.of("player", "author", "moderator", "admin").contains(request.role())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only player/author/moderator/admin can be changed");
		}
		User user = store.user(AuthServiceApplication.normalizeEmail(request.email()), true).orElseThrow();
		if ("player".equals(request.role()) && request.grant()) {
			store.demoteToPlayer(user.id(), admin.id());
		}
		else if (request.grant()) {
			store.grantRole(user.id(), request.role());
		}
		else {
			store.removeRole(user.id(), request.role(), admin.id());
		}
		store.audit(admin.id(), admin.email(), "role_changed", roleChangeMetadata(user, request.role(), request.grant()));
		return userView(store.user(user.email(), true).orElseThrow());
	}

	@GetMapping("/admin/users")
	AdminUserPage users(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size,
			@RequestParam(defaultValue = "") String query,
			@RequestParam(defaultValue = "all") String role,
			@RequestParam(defaultValue = "all") String status) {
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		}
		if (!List.of("all", "player", "author", "moderator", "admin").contains(role)
				|| !List.of("all", "active", "blocked").contains(status)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user filter");
		}
		return store.adminUsers(page, size, query, role, status);
	}

	@GetMapping("/subscription/plan")
	SubscriptionService.Plan subscriptionPlan() { return subscriptions.plan(); }

	@GetMapping("/subscription")
	SubscriptionService.Account subscription(@RequestHeader(name="Authorization",required=false) String authorization,
			@CookieValue(name="fraer_access",required=false) String accessToken,HttpServletResponse response) {
		response.setHeader("Cache-Control","private, no-store");
		return subscriptions.account(currentUser(authorization,accessToken).id());
	}
	@PostMapping("/subscription/mock-checkout")
	SubscriptionService.Account checkout(@RequestHeader(name="Authorization",required=false) String authorization,
			@CookieValue(name="fraer_access",required=false) String accessToken,@RequestBody CheckoutRequest request,HttpServletResponse response) {
		response.setHeader("Cache-Control","private, no-store");
		return subscriptions.checkout(currentUser(authorization,accessToken).id(),request.planId(),request.requestId(),request.confirmTest());
	}
	@GetMapping("/admin/subscriptions")
	SubscriptionService.Page subscriptions(@RequestHeader(name="Authorization",required=false) String authorization,
			@CookieValue(name="fraer_access",required=false) String accessToken,@RequestParam(defaultValue="0") int page,
			@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="all") String status,HttpServletResponse response) {
		response.setHeader("Cache-Control","private, no-store");requireSubscriptionAdmin(authorization,accessToken);
		return subscriptions.list(page,size,query,status);
	}
	@GetMapping("/admin/subscriptions/{userId}")
	SubscriptionService.Account subscriptionDetail(@RequestHeader(name="Authorization",required=false) String authorization,
			@CookieValue(name="fraer_access",required=false) String accessToken,@PathVariable String userId,HttpServletResponse response) {
		response.setHeader("Cache-Control","private, no-store");requireSubscriptionAdmin(authorization,accessToken);
		store.userById(userId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found"));
		return subscriptions.adminAccount(userId);
	}
	@PostMapping("/admin/subscriptions/{userId}/revoke")
	SubscriptionService.Account revokeSubscription(@RequestHeader(name="Authorization",required=false) String authorization,
			@CookieValue(name="fraer_access",required=false) String accessToken,@PathVariable String userId,@RequestBody RevokeSubscription request,HttpServletResponse response) {
		response.setHeader("Cache-Control","private, no-store");User actor=requireSubscriptionAdmin(authorization,accessToken);
		return subscriptions.revoke(userId,actor.id(),request.version(),request.reason());
	}
	private User requireSubscriptionAdmin(String authorization,String accessToken) {
		User actor=currentUser(authorization,accessToken);
		if(!actor.roles().contains("admin"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Admin role required");
		return actor;
	}
	record CheckoutRequest(String planId,String requestId,boolean confirmTest){}
	record RevokeSubscription(int version,String reason){}

	@GetMapping("/author-request")
	Map<String, String> authorRequestStatus(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken, HttpServletResponse response) {
		response.setHeader("Cache-Control", "private, no-store");
		User user = currentUser(authorization, accessToken);
		return Map.of("status", store.authorRequestStatus(user));
	}

	@PostMapping("/author-request")
	Map<String, String> requestAuthorAccess(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken) {
		User user = currentUser(authorization, accessToken);
		return Map.of("status", store.requestAuthorAccess(user.id()));
	}

	@GetMapping("/admin/author-requests")
	List<AuthStore.AuthorRequest> authorRequests(@RequestHeader(name = "Authorization", required = false) String authorization,
			@CookieValue(name = "fraer_access", required = false) String accessToken, HttpServletResponse response) {
		response.setHeader("Cache-Control", "private, no-store");
		User admin = currentUser(authorization, accessToken);
		if (!admin.roles().contains("admin")) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
		return store.authorRequests();
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
	String adminPage() throws java.io.IOException {
		return new org.springframework.core.io.ClassPathResource("admin.html").getContentAsString(StandardCharsets.UTF_8);
	}

	@org.springframework.web.bind.annotation.ExceptionHandler(ResponseStatusException.class)
	org.springframework.http.ResponseEntity<Map<String, String>> publicError(ResponseStatusException error) {
		String reason = error.getReason() == null ? "" : error.getReason();
		String code = switch (reason) {
			case "Recent authentication required" -> "RECENT_AUTH_REQUIRED";
			case "At least one active admin must remain" -> "LAST_ACTIVE_ADMIN";
			case "Admin cannot delete the current account" -> "CURRENT_ACCOUNT";
			case "User is blocked" -> "USER_BLOCKED";
			case "User not found" -> "USER_NOT_FOUND";
			default -> "REQUEST_FAILED";
		};
		return org.springframework.http.ResponseEntity.status(error.getStatusCode())
				.header("Cache-Control", "private, no-store")
				.body(Map.of("code", code, "message", code.equals("REQUEST_FAILED") ? "Request failed" : reason));
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
		if (!List.of("player", "author", "moderator", "admin").contains(request.role())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only player/author/moderator/admin can be changed in dev");
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
		store.audit(user.id(), user.email(), "dev_role_changed", roleChangeMetadata(user, request.role(), request.grant()));
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
		User user = store.userBySession(claims.sessionId())
				.filter(sessionUser -> sessionUser.id().equals(claims.userId()))
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired or revoked"));
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

	private String roleChangeMetadata(User user, String role, boolean grant) {
		try {
			return new ObjectMapper().writeValueAsString(Map.of(
					"target", user.email(), "targetUserId", user.id(), "role", role, "grant", grant));
		}
		catch (Exception ex) {
			throw new IllegalStateException("Cannot record role change", ex);
		}
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

	private synchronized void checkRate(String key, int limit, Duration duration) {
		Instant now = Instant.now();
		rate.entrySet().removeIf(entry -> !entry.getValue().resetAt().isAfter(now));
		rateOverflow.entrySet().removeIf(entry -> !entry.getValue().resetAt().isAfter(now));
		Map<String, Window> windows = rate;
		String windowKey = key;
		if (!rate.containsKey(key) && rate.size() >= MAX_RATE_WINDOWS) {
			// Preserve active quotas under identity churn. Overflow has one bounded bucket per
			// internally defined operation, while existing identities keep their own windows.
			windows = rateOverflow;
			windowKey = key.substring(0, key.indexOf(':'));
		}
		Window existing = windows.get(windowKey);
		Window window = existing == null ? new Window(1, now.plus(duration))
				: new Window(Math.min(existing.count(), limit) + 1, existing.resetAt());
		windows.put(windowKey, window);
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

	record VerifiedLogin(User user, TokenPair pair, String redirectPath) {
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
		// HS256 has no public key. Publishing an octet key would disclose the signing secret.
		return Map.of("keys", List.of());
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
	private final TransactionTemplate transactions;
	private final SubscriptionService subscriptions;

	AuthStore(JdbcTemplate jdbc, SubscriptionService subscriptions) {
		this.jdbc = jdbc;
		this.subscriptions = subscriptions;
		this.transactions = new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
	}

	<T> T transaction(Supplier<T> operation) {
		return transactions.execute(status -> operation.get());
	}

	Optional<User> bootstrapAdmin(String email) {
		return transactions.execute(status -> {
			lockAdminRole();
			if (jdbc.queryForObject("select count(*) from bootstrap_admin_initializations where email = ?", Long.class, email) > 0) {
				return userByEmail(email);
			}
			User user = user(email, true).orElseThrow();
			rememberBootstrapInitialization(email);
			if (user.blockedAt() == null) {
				grantRole(user.id(), "admin");
				grantRole(user.id(), "author");
			}
			return userById(user.id());
		});
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

	AuthController.AdminUserPage adminUsers(int page, int size, String query, String role, String status) {
		int safePage = Math.max(0, page);
		int safeSize = Math.min(100, Math.max(1, size));
		String search = query == null ? "" : query.trim().toLowerCase();
		String like = "%" + search + "%";
		String filter = """
				where lower(u.email) like ?
				and (? = 'all' or exists (select 1 from effective_user_roles r where r.user_id=u.id and r.role_name=?))
				and (? = 'all' or (? = 'blocked' and u.blocked_at is not null) or (? = 'active' and u.blocked_at is null))
				""";
		long total = jdbc.queryForObject("select count(*) from users u " + filter, Long.class, like, role, role, status, status, status);
		int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
		safePage = Math.min(safePage, Math.max(0, totalPages - 1));
		List<AuthController.AdminUserSummary> items = jdbc.query("""
				select id, email, blocked_at, created_at, updated_at
				from users u
				""" + filter + """
				order by created_at desc, id
				limit ? offset ?
				""", (rs, row) -> adminUserRow(
				rs.getString(1),
				rs.getString(2),
				instant(rs.getTimestamp(3)),
				rs.getTimestamp(4).toInstant(),
				rs.getTimestamp(5).toInstant()), like, role, role, status, status, status, safeSize, safePage * safeSize);
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

	boolean consumeMagicLink(String id) {
		Instant now = Instant.now();
		return jdbc.update("update email_login_tokens set used_at = ? where id = ? and used_at is null and expires_at > ?",
				timestamp(now), id, timestamp(now)) == 1;
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

	boolean revokeRefresh(String id) {
		Instant now = Instant.now();
		return jdbc.update("update refresh_tokens set revoked_at = ? where id = ? and revoked_at is null and expires_at > ?",
				timestamp(now), id, timestamp(now)) == 1;
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
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			requireAnotherActiveAdmin(userId);
			Instant now = Instant.now();
			jdbc.update("update users set blocked_at = ?, updated_at = ? where id = ?", timestamp(now), timestamp(now), userId);
			revokeAllSessions(userId);
		});
	}

	void unblockUser(String userId) {
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			jdbc.update("update users set blocked_at = null, updated_at = ? where id = ?", timestamp(Instant.now()), userId);
		});
	}

	void deleteUser(String userId, String email) {
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			requireAnotherActiveAdmin(userId);
			rememberBootstrapInitialization(email);
			jdbc.update("delete from passkey_challenges where user_id = ?", userId);
			jdbc.update("delete from passkey_credentials where user_id = ?", userId);
			jdbc.update("delete from telegram_identities where user_id = ?", userId);
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
		});
	}

	void grantRole(String userId, String role) {
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			jdbc.update("""
					insert into user_roles(user_id, role_name, created_at)
					select ?, ?, ? where not exists (select 1 from user_roles where user_id = ? and role_name = ?)
					""", userId, role, timestamp(Instant.now()), userId, role);
			if ("admin".equals(role)) userById(userId).ifPresent(user -> rememberBootstrapInitialization(user.email()));
			if (List.of("author", "admin").contains(role)) jdbc.update("delete from author_access_requests where user_id=?", userId);
		});
	}

	record AuthorRequest(String userId, String email, Instant requestedAt) {}
	List<AuthorRequest> authorRequests() {
		return jdbc.query("select r.user_id,u.email,r.requested_at from author_access_requests r join users u on u.id=r.user_id order by r.requested_at",
			(r,n) -> new AuthorRequest(r.getString(1),r.getString(2),r.getTimestamp(3).toInstant()));
	}
	String authorRequestStatus(User user) {
		if (user.roles().contains("author") || user.roles().contains("admin")) return "granted";
		return jdbc.queryForObject("select count(*) from author_access_requests where user_id=?",Long.class,user.id()) > 0 ? "pending" : "none";
	}
	String requestAuthorAccess(String userId) {
		return transactions.execute(transaction -> {
			lockUser(userId);
			User user = userById(userId).orElseThrow();
			String status = authorRequestStatus(user);
			if (!"none".equals(status)) return status;
			jdbc.update("insert into author_access_requests(user_id,requested_at) values (?,?)",userId,timestamp(Instant.now()));
			audit(userId,user.email(),"author_access_requested","{}");
			return "pending";
		});
	}

	void removeRole(String userId, String role) {
		removeRole(userId,role,"system");
	}
	void removeRole(String userId, String role, String actorId) {
		if ("player".equals(role)) return;
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			if ("admin".equals(role)) requireAnotherActiveAdmin(userId);
			userById(userId).ifPresent(user -> rememberBootstrapInitialization(user.email()));
			jdbc.update("delete from user_roles where user_id = ? and role_name = ?", userId, role);
			if("author".equals(role)) subscriptions.revokeForRole(userId,actorId,"Сняты права автора");
		});
	}

	void demoteToPlayer(String userId) {
		demoteToPlayer(userId,"system");
	}
	void demoteToPlayer(String userId, String actorId) {
		transactions.executeWithoutResult(status -> {
			lockAdminRole();
			lockUser(userId);
			requireAnotherActiveAdmin(userId);
			userById(userId).ifPresent(user -> rememberBootstrapInitialization(user.email()));
			grantRole(userId, "player");
			jdbc.update("delete from user_roles where user_id = ? and role_name in ('author', 'moderator', 'admin')", userId);
			subscriptions.revokeForRole(userId,actorId,"Оставлены только права читателя");
		});
	}

	private void lockAdminRole() {
		// One durable row serializes all changes that can affect the active-admin count.
		jdbc.queryForObject("select name from roles where name = 'admin' for update", String.class);
	}

	private void lockUser(String userId) {
		jdbc.queryForList("select id from users where id = ? for update", userId);
	}

	private void requireAnotherActiveAdmin(String userId) {
		User target = userById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
		if (target.blockedAt() != null || !target.roles().contains("admin")) return;
		long activeAdmins = jdbc.queryForObject("""
				select count(*) from users u join user_roles r on r.user_id = u.id
				where r.role_name = 'admin' and u.blocked_at is null
				""", Long.class);
		if (activeAdmins <= 1) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one active admin must remain");
		}
	}

	private void rememberBootstrapInitialization(String email) {
		if (jdbc.queryForObject("select count(*) from bootstrap_admin_initializations where email = ?", Long.class, email) == 0) {
			jdbc.update("insert into bootstrap_admin_initializations(email, initialized_at) values (?, ?)",
					email, timestamp(Instant.now()));
		}
	}

	void audit(String userId, String email, String eventType, String metadata) {
		jdbc.update("""
				insert into auth_audit_events(id, user_id, email, event_type, metadata, created_at)
				values (?, ?, ?, ?, ?, ?)
				""", UUID.randomUUID().toString(), userId, email, eventType, metadata, timestamp(Instant.now()));
	}

	private User userRow(String id, String email, Instant blockedAt, Instant createdAt, Instant updatedAt) {
		List<String> roles = jdbc.queryForList("select role_name from effective_user_roles where user_id = ? order by role_name", String.class, id);
		return new User(id, email, roles, blockedAt, createdAt, updatedAt);
	}

	private AuthController.AdminUserSummary adminUserRow(String id, String email, Instant blockedAt, Instant createdAt, Instant updatedAt) {
		List<String> roles = jdbc.queryForList("select role_name from effective_user_roles where user_id = ? order by role_name", String.class, id);
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
