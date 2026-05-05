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
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
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

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

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

	@Value("${auth.public-base-url:http://localhost:8088}")
	private String publicBaseUrl;

	@Value("${auth.bootstrap-admin-email:}")
	private String bootstrapAdminEmail;

	AuthController(AuthStore store, JwtCodec jwt, Optional<JavaMailSender> mail) {
		this.store = store;
		this.jwt = jwt;
		this.mail = mail;
	}

	@PostMapping("/login-link")
	Map<String, Object> loginLink(@Valid @RequestBody LoginLinkRequest request) {
		String email = AuthServiceApplication.normalizeEmail(request.email());
		checkRate("login:" + email, devMode ? 200 : 5, Duration.ofMinutes(15));
		String token = UUID.randomUUID() + "." + UUID.randomUUID();
		String redirect = safeRedirect(request.redirectPath());
		Instant expiresAt = Instant.now().plusSeconds(magicLinkTtl);
		store.createMagicLink(email, sha256(token), redirect, expiresAt);
		String separator = redirect.contains("?") ? "&" : "?";
		String link = publicBaseUrl + redirect + separator + "auth_token=" + token + "&redirect=" + url64(redirect.getBytes(StandardCharsets.UTF_8));
		store.audit(null, email, "login_link_requested", "{}");
		if (devMode) {
			devLinks.put(email, List.of(new DevLink(email, link, expiresAt)));
			System.out.println("FraerApp dev magic link for " + email + ": " + link);
		}
		else {
			sendMail(email, link);
		}
		return Map.of("sent", true);
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
		store.consumeMagicLink(link.id());
		TokenPair pair = issue(user);
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
		store.revokeRefresh(token.id());
		TokenPair pair = issue(user);
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
				    main { max-width: 760px; margin: 0 auto; padding: 32px 18px 48px; }
				    h1 { margin: 0 0 8px; font-size: 32px; }
				    section { background: #fff; border: 1px solid #d8d3ca; border-radius: 8px; padding: 18px; margin-top: 16px; }
				    label { display: block; font-weight: 650; margin: 12px 0 6px; }
				    input, select, button { font: inherit; }
				    input, select { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #c9c2b8; border-radius: 6px; background: #fff; }
				    button { margin-top: 14px; padding: 10px 14px; border: 0; border-radius: 6px; background: #1f5f46; color: #fff; cursor: pointer; }
				    button.secondary { background: #51483f; }
				    button.danger { background: #8f2f25; }
				    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #161411; color: #f8f3e8; padding: 12px; border-radius: 6px; }
				    .row { display: grid; grid-template-columns: 1fr 160px 120px; gap: 12px; align-items: end; }
				    .hidden { display: none; }
				    .muted { color: #6f665d; }
				    a { color: #1f5f46; }
				    @media (max-width: 680px) { .row { grid-template-columns: 1fr; } }
				  </style>
				</head>
				<body>
				  <main>
				    <h1>FraerApp права</h1>
				    <p class="muted">Вход только через email. Для этой панели нужна роль admin.</p>

				    <section id="login-section">
				      <h2>Вход администратора</h2>
				      <form id="login-form">
				        <label for="login-email">Email</label>
				        <input id="login-email" type="email" value="culibiaka2012@yandex.ru" autocomplete="email" required>
				        <button type="submit">Отправить ссылку</button>
				      </form>
				      <pre id="login-result"></pre>
				    </section>

				    <section id="me-section" class="hidden">
				      <h2>Текущий вход</h2>
				      <p id="me-line"></p>
				      <button id="logout" type="button" class="secondary">Выйти</button>
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
				  </main>

				  <script>
				    const loginSection = document.querySelector("#login-section");
				    const meSection = document.querySelector("#me-section");
				    const rolesSection = document.querySelector("#roles-section");
				    const loginResult = document.querySelector("#login-result");
				    const roleResult = document.querySelector("#role-result");
				    const meLine = document.querySelector("#me-line");

				    async function json(path, options = {}) {
				      const response = await fetch(path, {
				        method: options.method || "GET",
				        credentials: "include",
				        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
				        body: options.body ? JSON.stringify(options.body) : undefined,
				      });
				      const text = await response.text();
				      const payload = text ? JSON.parse(text) : {};
				      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
				      return payload;
				    }

				    async function loadMe() {
				      try {
				        const me = await json("/auth/me");
				        meLine.textContent = `${me.email} / ${me.roles.join(", ")}`;
				        meSection.classList.remove("hidden");
				        loginSection.classList.add("hidden");
				        if (me.roles.includes("admin")) {
				          rolesSection.classList.remove("hidden");
				        } else {
				          rolesSection.classList.add("hidden");
				          roleResult.textContent = "Нужна роль admin. Проверь AUTH_BOOTSTRAP_ADMIN_EMAIL или выдайте admin в dev.";
				        }
				      } catch {
				        loginSection.classList.remove("hidden");
				        meSection.classList.add("hidden");
				        rolesSection.classList.add("hidden");
				      }
				    }

				    async function verifyFromUrl() {
				      const params = new URLSearchParams(location.search);
				      const token = params.get("auth_token");
				      if (!token) return;
				      const result = await json("/auth/verify", { method: "POST", body: { token } });
				      history.replaceState({}, document.title, "/auth/admin");
				      loginResult.textContent = JSON.stringify(result, null, 2);
				    }

				    document.querySelector("#login-form").addEventListener("submit", async (event) => {
				      event.preventDefault();
				      const email = document.querySelector("#login-email").value.trim();
				      await json("/auth/login-link", { method: "POST", body: { email, redirectPath: "/auth/admin" } });
				      loginResult.textContent = "Ссылка отправлена. В dev можно открыть /auth/dev/magic-links?email=" + encodeURIComponent(email);
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

				    document.querySelector("#role-form").addEventListener("submit", async (event) => {
				      event.preventDefault();
				      const payload = {
				        email: document.querySelector("#target-email").value.trim(),
				        role: document.querySelector("#role").value,
				        grant: document.querySelector("#grant").value === "true",
				      };
				      const result = await json("/auth/admin/roles", { method: "POST", body: payload });
				      roleResult.textContent = JSON.stringify(result, null, 2);
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

	private TokenPair issue(User user) {
		String sessionId = UUID.randomUUID().toString();
		Instant now = Instant.now();
		String refreshToken = UUID.randomUUID() + "." + UUID.randomUUID();
		String refreshId = UUID.randomUUID().toString();
		store.createSession(sessionId, user.id(), now.plusSeconds(refreshTtl));
		store.createRefresh(refreshId, sessionId, sha256(refreshToken), now.plusSeconds(refreshTtl));
		String accessToken = jwt.encode(user, sessionId, now.plusSeconds(accessTtl));
		return new TokenPair(accessToken, refreshToken, refreshId);
	}

	private User currentUser(String authorization, String accessToken) {
		String token = accessToken;
		if ((token == null || token.isBlank()) && authorization != null && authorization.startsWith("Bearer ")) {
			token = authorization.substring("Bearer ".length());
		}
		if (token == null || token.isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing access token");
		}
		JwtClaims claims = jwt.decode(token);
		return store.userById(claims.userId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
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
		return Map.of("id", user.id(), "email", user.email(), "roles", user.roles());
	}

	private void sendMail(String email, String link) {
		if (mail.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "SMTP is not configured");
		}
		SimpleMailMessage message = new SimpleMailMessage();
		message.setTo(email);
		message.setSubject("FraerApp login link");
		message.setText("Open this link to sign in to FraerApp:\n\n" + link);
		mail.get().send(message);
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

	record LoginLinkRequest(@Email @NotBlank String email, String redirectPath) {
	}

	record VerifyRequest(@NotBlank String token) {
	}

	record RoleRequest(@Email @NotBlank String email, @NotBlank String role, boolean grant) {
	}

	record TokenPair(String accessToken, String refreshToken, String refreshId) {
	}

	record DevLink(String email, String link, Instant expiresAt) {
	}

	record Window(int count, Instant resetAt) {
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
			return new JwtClaims((String) claims.get("sub"));
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
				id, email, true, now, now);
		grantRole(id, "player");
		return userByEmail(email);
	}

	Optional<User> userByEmail(String email) {
		List<User> users = jdbc.query("select id, email from users where email = ?", (rs, row) -> userRow(rs.getString(1), rs.getString(2)), email);
		return users.stream().findFirst();
	}

	Optional<User> userById(String id) {
		List<User> users = jdbc.query("select id, email from users where id = ?", (rs, row) -> userRow(rs.getString(1), rs.getString(2)), id);
		return users.stream().findFirst();
	}

	Optional<User> userBySession(String sessionId) {
		List<User> users = jdbc.query("""
				select u.id, u.email from users u
				join sessions s on s.user_id = u.id
				where s.id = ? and s.revoked_at is null and s.expires_at > ?
				""", (rs, row) -> userRow(rs.getString(1), rs.getString(2)), sessionId, Instant.now());
		return users.stream().findFirst();
	}

	void createMagicLink(String email, String tokenHash, String redirectPath, Instant expiresAt) {
		jdbc.update("""
				insert into email_login_tokens(id, email, token_hash, redirect_path, expires_at, created_at)
				values (?, ?, ?, ?, ?, ?)
				""", UUID.randomUUID().toString(), email, tokenHash, redirectPath, expiresAt, Instant.now());
	}

	Optional<MagicLink> magicLink(String tokenHash) {
		List<MagicLink> links = jdbc.query("""
				select id, email, redirect_path, expires_at, used_at from email_login_tokens where token_hash = ?
				""", (rs, row) -> new MagicLink(rs.getString(1), rs.getString(2), rs.getString(3),
				rs.getTimestamp(4).toInstant(), rs.getTimestamp(5) == null ? null : rs.getTimestamp(5).toInstant()), tokenHash);
		return links.stream().findFirst();
	}

	void consumeMagicLink(String id) {
		jdbc.update("update email_login_tokens set used_at = ? where id = ? and used_at is null", Instant.now(), id);
	}

	void createSession(String id, String userId, Instant expiresAt) {
		jdbc.update("insert into sessions(id, user_id, created_at, expires_at) values (?, ?, ?, ?)", id, userId, Instant.now(), expiresAt);
	}

	void createRefresh(String id, String sessionId, String tokenHash, Instant expiresAt) {
		jdbc.update("""
				insert into refresh_tokens(id, session_id, token_hash, created_at, expires_at)
				values (?, ?, ?, ?, ?)
				""", id, sessionId, tokenHash, Instant.now(), expiresAt);
	}

	Optional<RefreshToken> refresh(String tokenHash) {
		List<RefreshToken> tokens = jdbc.query("""
				select id, session_id, expires_at, revoked_at from refresh_tokens where token_hash = ?
				""", (rs, row) -> new RefreshToken(rs.getString(1), rs.getString(2), rs.getTimestamp(3).toInstant(),
				rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant()), tokenHash);
		return tokens.stream().findFirst();
	}

	void revokeRefresh(String id) {
		jdbc.update("update refresh_tokens set revoked_at = ? where id = ? and revoked_at is null", Instant.now(), id);
	}

	void replaceRefresh(String oldId, String newId) {
		jdbc.update("update refresh_tokens set replaced_by_token_id = ? where id = ?", newId, oldId);
	}

	void revokeSession(String id) {
		jdbc.update("update sessions set revoked_at = ? where id = ? and revoked_at is null", Instant.now(), id);
		jdbc.update("update refresh_tokens set revoked_at = ? where session_id = ? and revoked_at is null", Instant.now(), id);
	}

	void revokeAllSessions(String userId) {
		jdbc.update("update sessions set revoked_at = ? where user_id = ? and revoked_at is null", Instant.now(), userId);
	}

	void grantRole(String userId, String role) {
		jdbc.update("""
				insert into user_roles(user_id, role_name, created_at)
				select ?, ?, ? where not exists (select 1 from user_roles where user_id = ? and role_name = ?)
				""", userId, role, Instant.now(), userId, role);
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
				""", UUID.randomUUID().toString(), userId, email, eventType, metadata, Instant.now());
	}

	private User userRow(String id, String email) {
		List<String> roles = jdbc.queryForList("select role_name from user_roles where user_id = ? order by role_name", String.class, id);
		return new User(id, email, roles);
	}
}

record User(String id, String email, List<String> roles) {
}

record MagicLink(String id, String email, String redirectPath, Instant expiresAt, Instant usedAt) {
}

record RefreshToken(String id, String sessionId, Instant expiresAt, Instant revokedAt) {
}

record JwtClaims(String userId) {
}

@Configuration
class AuthCorsConfig implements WebMvcConfigurer {

	private final String[] allowedOrigins;

	AuthCorsConfig(@Value("${auth.cors.allowed-origins}") String allowedOrigins) {
		this.allowedOrigins = allowedOrigins.split(",");
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
