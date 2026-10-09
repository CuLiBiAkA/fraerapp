package com.fraergod.fraerapp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class AuthControllerTests {
	@Test void newReaderHasAdsUntilAnActiveSubscriptionEvenWithManualAuthorRole(){
		User user=store.user("ad-reader@example.test",true).orElseThrow();String token="Bearer "+authenticatedToken(user);
		assertThat(user.roles()).containsExactly("player");assertThat(controller.me(token,null,new MockHttpServletResponse())).containsEntry("subscriptionActive",false);
		store.grantRole(user.id(),"author");assertThat(controller.me(token,null,new MockHttpServletResponse())).containsEntry("subscriptionActive",false);
		buy(token,UUID.randomUUID().toString());assertThat(controller.me(token,null,new MockHttpServletResponse())).containsEntry("subscriptionActive",true);
		jdbc.update("update author_subscriptions set expires_at=? where user_id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),user.id());
		assertThat(controller.me(token,null,new MockHttpServletResponse())).containsEntry("subscriptionActive",false);
	}

	@Test void subscriptionCheckoutGrantsLiveAuthorAndIsIdempotent() throws Exception {
		var user=store.user("subscriber@example.test",true).orElseThrow();
		String token="Bearer "+authenticatedToken(user);
		var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
		String purchase="{\"planId\":\"author-monthly\",\"requestId\":\""+UUID.randomUUID()+"\",\"confirmTest\":true}";
		var request=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/auth/subscription/mock-checkout").header("Authorization",token).contentType("application/json").content(purchase);
		var first=mvc.perform(request).andReturn().getResponse();
		assertThat(first.getStatus()).isEqualTo(200);
		var snapshot=new ObjectMapper().readTree(first.getContentAsString());
		assertThat(snapshot.path("subscription").path("status").asText()).isEqualTo("active");
		assertThat((List<String>)controller.me(token,null,new MockHttpServletResponse()).get("roles")).contains("author");
		var second=new ObjectMapper().readTree(mvc.perform(request).andReturn().getResponse().getContentAsString());
		assertThat(second.path("subscription").path("expiresAt")).isEqualTo(snapshot.path("subscription").path("expiresAt"));
		assertThat(second.path("orders").size()).isEqualTo(1);
		assertThat(first.getHeader("Cache-Control")).contains("no-store");
	}
	private SubscriptionService.Account buy(String token,String key){return controller.checkout(token,null,new AuthController.CheckoutRequest("author-monthly",key,true),new MockHttpServletResponse());}
	@Test void subscriptionExpiryPreservesManualRolesAndDoesNotTrustOldToken(){
		User user=store.user("expiry@example.test",true).orElseThrow();String token="Bearer "+authenticatedToken(user);
		buy(token,UUID.randomUUID().toString());
		assertThat(store.userById(user.id()).orElseThrow().roles()).contains("author");
		jdbc.update("update author_subscriptions set expires_at=? where user_id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),user.id());
		assertThat(controller.subscription(token,null,new MockHttpServletResponse()).subscription().status()).isEqualTo("expired");
		assertThat((List<String>)controller.me(token,null,new MockHttpServletResponse()).get("roles")).doesNotContain("author");
		store.grantRole(user.id(),"author");buy(token,UUID.randomUUID().toString());
		jdbc.update("update author_subscriptions set expires_at=? where user_id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),user.id());
		assertThat(controller.subscription(token,null,new MockHttpServletResponse()).manualAuthor()).isTrue();
		assertThat((List<String>)controller.me(token,null,new MockHttpServletResponse()).get("roles")).contains("author");
	}
	@Test void subscriptionAdminRevocationIsVersionedAuditedAndPreservesManualAccess(){
		User user=store.user("revoke-subscription@example.test",true).orElseThrow();String token="Bearer "+authenticatedToken(user),adminToken="Bearer "+authenticatedToken(admin("subscription-admin@example.test"));
		var first=buy(token,UUID.randomUUID().toString());var renewed=buy(token,UUID.randomUUID().toString());
		assertThat(renewed.subscription().expiresAt()).isEqualTo(first.subscription().expiresAt().atZone(java.time.ZoneOffset.UTC).plusMonths(1).toInstant());
		assertThatThrownBy(()->controller.revokeSubscription(adminToken,null,user.id(),new AuthController.RevokeSubscription(first.subscription().version(),"Old screen"),new MockHttpServletResponse())).isInstanceOf(ResponseStatusException.class).satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
		store.grantRole(user.id(),"author");
		var revoked=controller.revokeSubscription(adminToken,null,user.id(),new AuthController.RevokeSubscription(renewed.subscription().version(),"Test completed"),new MockHttpServletResponse());
		assertThat(revoked.subscription().status()).isEqualTo("revoked");assertThat(revoked.authorAccess()).isTrue();assertThat(revoked.events()).anySatisfy(event->assertThat(event.reason()).isEqualTo("Test completed"));
		var page=controller.subscriptions(adminToken,null,100,10,"revoke-subscription","revoked",new MockHttpServletResponse());
		assertThat(page.totalElements()).isEqualTo(1);assertThat(page.page()).isZero();
		assertThat(controller.users(adminToken,null,0,20,"revoke-subscription","author","all").totalElements()).isEqualTo(1);
		store.removeRole(user.id(),"author");assertThat(store.userById(user.id()).orElseThrow().roles()).doesNotContain("author");
	}
	@Test void subscriptionCheckoutRejectsAnonymousBlockedInvalidAndNonAdminAccess() throws Exception {
		User user=store.user("sub-access@example.test",true).orElseThrow();String token="Bearer "+authenticatedToken(user);
		var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
		assertThat(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/auth/subscription")).andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/auth/admin/subscriptions").header("Authorization",token)).andReturn().getResponse().getStatus()).isEqualTo(403);
		assertThatThrownBy(()->controller.subscriptionDetail(token,null,"someone-else",new MockHttpServletResponse())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(()->controller.checkout(token,null,new AuthController.CheckoutRequest("admin",UUID.randomUUID().toString(),true),new MockHttpServletResponse())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(()->controller.checkout(token,null,new AuthController.CheckoutRequest("author-monthly",UUID.randomUUID().toString(),false),new MockHttpServletResponse())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(()->new SubscriptionService(jdbc,false).checkout(user.id(),"author-monthly",UUID.randomUUID().toString(),true)).isInstanceOf(ResponseStatusException.class);
		store.blockUser(user.id());assertThatThrownBy(()->buy(token,UUID.randomUUID().toString())).isInstanceOf(ResponseStatusException.class);
		assertThat(jdbc.queryForObject("select count(*) from subscription_orders",Long.class)).isZero();
	}
	@Test void concurrentCheckoutRetryCreatesOneOrderAndRoleRemovalRevokesAccess() throws Exception {
		User user=store.user("concurrent-sub@example.test",true).orElseThrow();String token="Bearer "+authenticatedToken(user),key=UUID.randomUUID().toString();
		var executor=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
		try{
			var a=executor.submit(()->{gate.await();return buy(token,key);});var b=executor.submit(()->{gate.await();return buy(token,key);});gate.countDown();
			assertThat(a.get(5,TimeUnit.SECONDS).subscription().expiresAt()).isEqualTo(b.get(5,TimeUnit.SECONDS).subscription().expiresAt());
		}finally{executor.shutdownNow();}
		assertThat(jdbc.queryForObject("select count(*) from subscription_orders where user_id=?",Long.class,user.id())).isEqualTo(1);
		assertThat(store.adminUsers(0,20,"concurrent-sub","author","all").totalElements()).isEqualTo(1);
		store.demoteToPlayer(user.id());assertThat(store.userById(user.id()).orElseThrow().roles()).containsExactly("player");
		assertThat(controller.subscription(token,null,new MockHttpServletResponse()).subscription().status()).isEqualTo("revoked");
		store.deleteUser(user.id(),user.email());assertThat(jdbc.queryForObject("select count(*) from subscription_orders where user_id=?",Long.class,user.id())).isZero();
	}
	@Test void calendarMonthPriceAndAdminRoleRevocationAreRecordedWithoutLeakingAdminEmail(){
		User user=store.user("calendar@example.test",true).orElseThrow(),admin=admin("billing-admin@example.test");String token="Bearer "+authenticatedToken(user),adminToken="Bearer "+authenticatedToken(admin);
		buy(token,UUID.randomUUID().toString());
		jdbc.update("update author_subscriptions set expires_at=? where user_id=?",java.sql.Timestamp.from(Instant.parse("2030-01-31T12:00:00Z")),user.id());
		var renewed=buy(token,UUID.randomUUID().toString());assertThat(renewed.subscription().expiresAt()).isEqualTo(Instant.parse("2030-02-28T12:00:00Z"));
		assertThat(renewed.plan().priceMinor()).isEqualTo(13900);assertThat(renewed.orders()).allSatisfy(order->{assertThat(order.priceMinor()).isEqualTo(13900);assertThat(order.amountMinor()).isZero();});
		controller.grantRole(adminToken,null,new AuthController.RoleRequest(user.email(),"author",false));
		var own=controller.subscription(token,null,new MockHttpServletResponse());assertThat(own.authorAccess()).isFalse();assertThat(own.events()).allSatisfy(event->assertThat(event.actorLabel()).isNull());
		var audit=controller.subscriptionDetail(adminToken,null,user.id(),new MockHttpServletResponse());
		assertThat(audit.events()).anySatisfy(event->{assertThat(event.action()).isEqualTo("revoked");assertThat(event.actorId()).isEqualTo(admin.id());assertThat(event.actorLabel()).isEqualTo(admin.email());});
	}

	private JdbcTemplate jdbc;
	private AuthStore store;
	private AuthController controller;
	private JwtCodec jwt;
	private PasskeyService passkeys;
	private FakeTelegramMessenger telegram;
	private DriverManagerDataSource postgresAdmin;
	private String postgresSchema;

	@BeforeEach
	void setUp() {
		DriverManagerDataSource dataSource = new DriverManagerDataSource();
		String postgresUrl=System.getenv("AUTH_MODERATION_TEST_DB");
		if(postgresUrl==null||postgresUrl.isBlank()) {
			dataSource.setDriverClassName("org.h2.Driver");
			dataSource.setUrl("jdbc:h2:mem:auth-" + System.nanoTime()
					+ ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1");
		} else {
			postgresAdmin=new DriverManagerDataSource(postgresUrl,System.getenv("MODERATION_TEST_USER"),System.getenv("MODERATION_TEST_PASSWORD"));
			postgresSchema="auth_check_"+UUID.randomUUID().toString().replace("-","");
			new JdbcTemplate(postgresAdmin).execute("create schema "+postgresSchema);
			dataSource.setDriverClassName("org.postgresql.Driver");
			dataSource.setUrl(postgresUrl+(postgresUrl.contains("?")?"&":"?")+"currentSchema="+postgresSchema);
			dataSource.setUsername(System.getenv("MODERATION_TEST_USER"));dataSource.setPassword(System.getenv("MODERATION_TEST_PASSWORD"));
		}
		ResourceDatabasePopulator schema = new ResourceDatabasePopulator(
				new ClassPathResource("db/migration/V1__create_auth_schema.sql"),
				new ClassPathResource("db/migration/V2__add_user_blocking.sql"),
				new ClassPathResource("db/migration/V4__add_personal_data_consents.sql"),
				new ClassPathResource("db/migration/V5__add_passkeys.sql"),
				new ClassPathResource("db/migration/V6__add_telegram_identities.sql"),
				new ClassPathResource("db/migration/V7__author_access_requests.sql"),
				new ClassPathResource("db/migration/V8__moderator_and_bootstrap_initialization.sql"),
				new ClassPathResource("db/migration/V9__author_subscriptions.sql"));
		schema.execute(dataSource);
		jdbc = new JdbcTemplate(dataSource);
		var subscriptions = new SubscriptionService(jdbc,true);
		store = new AuthStore(jdbc,subscriptions);
		jwt = new JwtCodec("test-secret-test-secret-test-secret");
		passkeys = new PasskeyService(new PasskeyRepository(jdbc), store,
				"localhost", "FraerApp Test", "http://localhost:8088", 300);
		telegram = new FakeTelegramMessenger();
		controller = new AuthController(store, jwt, Optional.empty(), passkeys, telegram,subscriptions);
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

	@org.junit.jupiter.api.AfterEach
	void cleanPostgresFixture() {
		if(postgresAdmin!=null && postgresSchema!=null && postgresSchema.matches("auth_check_[a-f0-9]+"))
			new JdbcTemplate(postgresAdmin).execute("drop schema "+postgresSchema+" cascade");
	}

	@Test
	void publicJwksNeverExportsTheSymmetricSigningKey() throws Exception {
		var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
		var response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/auth/jwks"))
				.andReturn().getResponse();
		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(new ObjectMapper().readTree(response.getContentAsString()).path("keys").size()).isZero();
		assertThat(response.getContentAsString()).doesNotContain("test-secret", "dGVzdC1zZWNyZXQ", "\"k\"");
	}

	@Test
	void telegramOnlyIssuesCredentialsForTheSendersPrivateChat() {
		telegram.enabled = true;
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", true);
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "secret");
		List<Map<String, Object>> chats = List.of(
				Map.of("id", -123L, "type", "group"),
				Map.of("id", -100123L, "type", "supergroup"),
				Map.of("id", 67890L, "type", "channel"),
				Map.of("id", 67890L),
				Map.of("id", 12345L, "type", "private"),
				Map.of("id", 67890.5, "type", "private"),
				Map.of("id", "67890", "type", "private"));
		for (Map<String, Object> chat : chats) {
			var update = Map.<String, Object>of("message", Map.of("chat", chat,
					"from", Map.of("id", 67890L, "is_bot", false), "text", "/start login"));
			assertThat(controller.telegramWebhook("secret", update, request())).containsOnlyKeys("ok");
		}
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
		assertThat(jdbc.queryForObject("select count(*) from telegram_identities", Long.class)).isZero();
	}

	@Test
	void telegramRequiresAConfiguredMatchingWebhookSecret() {
		telegram.enabled = true;
		ReflectionTestUtils.setField(controller, "telegramBotEnabled", true);
		ReflectionTestUtils.setField(controller, "telegramBotUsername", "test_bot");
		var update = Map.<String, Object>of("message", Map.of("chat", Map.of("id", 67890L, "type", "private"),
				"from", Map.of("id", 67890L, "is_bot", false), "text", "/start login"));
		for (String configured : List.of("", " ")) {
			ReflectionTestUtils.setField(controller, "telegramWebhookSecret", configured);
			assertThat(controller.telegramLogin()).containsEntry("enabled", false);
			assertThatThrownBy(() -> controller.telegramWebhook(null, update, request())).isInstanceOf(ResponseStatusException.class);
		}
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "secret");
		assertThatThrownBy(() -> controller.telegramWebhook(null, update, request())).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> controller.telegramWebhook("wrong", update, request())).isInstanceOf(ResponseStatusException.class);
		assertThat(jdbc.queryForObject("select count(*) from email_login_tokens", Long.class)).isZero();
	}

	@Test
	void invalidVerificationAttemptsCannotLockOutOtherUsersOrAllocateRateEntries() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		for (int i = 0; i < 30; i++) {
			String invalidToken = "unknown-" + i;
			assertThatThrownBy(() -> controller.verify(new AuthController.VerifyRequest(invalidToken), new MockHttpServletResponse()))
					.isInstanceOf(ResponseStatusException.class)
					.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
		}
		assertThat((Map<?, ?>) ReflectionTestUtils.getField(controller, "rate")).isEmpty();
		verifyLinkFor("unaffected-reader@example.test");
		assertThat(jdbc.queryForObject("select count(*) from sessions", Long.class)).isEqualTo(1);
	}

	@Test
	void manyIndependentValidLoginLinksDoNotShareAVerificationQuota() {
		ReflectionTestUtils.setField(controller, "devMode", false);
		for (int i = 0; i < 25; i++) verifyLinkFor("independent-" + i + "@example.test");
		assertThat(jdbc.queryForObject("select count(*) from sessions", Long.class)).isEqualTo(25);
	}

	@Test
	@SuppressWarnings("unchecked")
	void limiterExpiresOldEntriesAndAdmitsNewIdentitiesAtCapacity() {
		Map<String, AuthController.Window> rate = (Map<String, AuthController.Window>) ReflectionTestUtils.getField(controller, "rate");
		ReflectionTestUtils.setField(controller, "devMode", false);
		rate.put("login:limited@example.test", new AuthController.Window(5, Instant.now().plusSeconds(900)));
		for (int i = 0; i < 9_999; i++) rate.put("existing-" + i, new AuthController.Window(1, Instant.now().plusSeconds(900)));
		rate.put("expired", new AuthController.Window(30, Instant.now().minusSeconds(1)));
		assertThat(controller.passkeyAuthenticationOptions(request())).contains("challengeId");
		assertThat(rate).hasSize(10_000).doesNotContainKey("expired").containsKey("login:limited@example.test");
		assertThatThrownBy(() -> controller.loginLink(new AuthController.LoginLinkRequest("limited@example.test", "/", true), request()))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
		Map<String, AuthController.Window> overflow = (Map<String, AuthController.Window>) ReflectionTestUtils.getField(controller, "rateOverflow");
		assertThat(overflow).containsOnlyKeys("passkey-authentication-start");
		verifyLinkFor("overflow-reader@example.test");
		assertThat(overflow).containsOnlyKeys("passkey-authentication-start", "verify");
		assertThat(jdbc.queryForObject("select count(*) from passkey_challenges", Long.class)).isEqualTo(1);
	}

	@Test
	void concurrentMagicLinkReplayIssuesExactlyOneSession() throws Exception {
		String raw = "single-use-login";
		store.createMagicLink("single-use@example.test", sha256(raw), "/", Instant.now().plusSeconds(900));
		CountDownLatch reads = new CountDownLatch(2);
		AuthStore racingStore = new AuthStore(jdbc, new SubscriptionService(jdbc, true)) {
			@Override Optional<MagicLink> magicLink(String hash) {
				Optional<MagicLink> result = super.magicLink(hash);
				awaitBothReads(reads);
				return result;
			}
		};
		ReflectionTestUtils.setField(controller, "store", racingStore);
		assertOneSuccessfulAuthentication(() -> controller.verify(new AuthController.VerifyRequest(raw), new MockHttpServletResponse()));
		assertThat(jdbc.queryForObject("select count(*) from users", Long.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from sessions", Long.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from refresh_tokens", Long.class)).isEqualTo(1);
	}

	@Test
	void concurrentRefreshReplayIssuesExactlyOneReplacement() throws Exception {
		User user = store.user("single-refresh@example.test", true).orElseThrow();
		store.createSession("rotation-session", user.id(), Instant.now().plusSeconds(3600), "magic_link", Instant.now());
		store.createRefresh("rotation-old", "rotation-session", sha256("rotation-raw"), Instant.now().plusSeconds(3600));
		CountDownLatch reads = new CountDownLatch(2);
		AuthStore racingStore = new AuthStore(jdbc, new SubscriptionService(jdbc, true)) {
			@Override Optional<RefreshToken> refresh(String hash) {
				Optional<RefreshToken> result = super.refresh(hash);
				awaitBothReads(reads);
				return result;
			}
		};
		ReflectionTestUtils.setField(controller, "store", racingStore);
		assertOneSuccessfulAuthentication(() -> controller.refresh("rotation-raw", new MockHttpServletResponse()));
		assertThat(jdbc.queryForObject("select count(*) from refresh_tokens where revoked_at is null", Long.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from refresh_tokens", Long.class)).isEqualTo(2);
	}

	@Test
	void failedIssuanceRollsBackMagicLinkConsumptionAndSessionCreation() {
		store.user("retry-login@example.test", true);
		String raw = "retry-login-token";
		store.createMagicLink("retry-login@example.test", sha256(raw), "/", Instant.now().plusSeconds(900));
		ReflectionTestUtils.setField(controller, "jwt", failingJwt());
		MockHttpServletResponse response = new MockHttpServletResponse();
		assertThatThrownBy(() -> controller.verify(new AuthController.VerifyRequest(raw), response)).isInstanceOf(IllegalStateException.class);
		assertThat(store.magicLink(sha256(raw)).orElseThrow().usedAt()).isNull();
		assertThat(jdbc.queryForObject("select count(*) from sessions", Long.class)).isZero();
		assertThat(jdbc.queryForObject("select count(*) from refresh_tokens", Long.class)).isZero();
		assertThat(response.getHeaders("Set-Cookie")).isEmpty();
		ReflectionTestUtils.setField(controller, "jwt", jwt);
		controller.verify(new AuthController.VerifyRequest(raw), new MockHttpServletResponse());
	}

	@Test
	void failedIssuanceRollsBackRefreshRotation() {
		User user = store.user("retry-refresh@example.test", true).orElseThrow();
		store.createSession("retry-session", user.id(), Instant.now().plusSeconds(3600), "magic_link", Instant.now());
		store.createRefresh("retry-old", "retry-session", sha256("retry-raw"), Instant.now().plusSeconds(3600));
		ReflectionTestUtils.setField(controller, "jwt", failingJwt());
		MockHttpServletResponse response = new MockHttpServletResponse();
		assertThatThrownBy(() -> controller.refresh("retry-raw", response)).isInstanceOf(IllegalStateException.class);
		assertThat(store.refresh(sha256("retry-raw")).orElseThrow().revokedAt()).isNull();
		assertThat(jdbc.queryForObject("select count(*) from refresh_tokens", Long.class)).isEqualTo(1);
		assertThat(response.getHeaders("Set-Cookie")).isEmpty();
		ReflectionTestUtils.setField(controller, "jwt", jwt);
		controller.refresh("retry-raw", new MockHttpServletResponse());
	}

	private JwtCodec failingJwt() {
		return new JwtCodec("test-secret-test-secret-test-secret") {
			@Override String encode(User user, String sessionId, Instant expiresAt) {
				throw new IllegalStateException("Synthetic signing failure");
			}
		};
	}

	private static void awaitBothReads(CountDownLatch reads) {
		reads.countDown();
		try {
			if (!reads.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent reads did not meet");
		}
		catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
	}

	private void assertOneSuccessfulAuthentication(Runnable attempt) throws Exception {
		var executor = Executors.newFixedThreadPool(2);
		try {
			java.util.concurrent.Callable<Integer> request = () -> {
				try { attempt.run(); return 200; }
				catch (ResponseStatusException error) { return error.getStatusCode().value(); }
			};
			var first = executor.submit(request);
			var second = executor.submit(request);
			assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 401);
		}
		finally { executor.shutdownNow(); }
	}

	@Test
	void adminUserFiltersApplyBeforePaginationAndClampAnEmptyLastPage() throws Exception {
		User administrator = admin("filter-admin@example.test");
		for (int i = 0; i < 3; i++) {
			User user = store.user("filter-author-" + i + "@example.test", true).orElseThrow();
			store.grantRole(user.id(), "author");
			if (i == 2) store.blockUser(user.id());
		}
		store.user("filter-reader@example.test", true);
		var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
		var response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/auth/admin/users")
				.header("Authorization", "Bearer " + authenticatedToken(administrator))
				.param("query", "FILTER-").param("role", "author").param("status", "active")
				.param("page", "99").param("size", "1")).andReturn().getResponse();
		assertThat(response.getStatus()).isEqualTo(200);
		var data = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.getContentAsString());
		assertThat(data.path("totalElements").asInt()).isEqualTo(2);
		assertThat(data.path("page").asInt()).isEqualTo(1);
		assertThat(data.path("items").size()).isEqualTo(1);
		assertThat(data.path("items").get(0).path("blocked").asBoolean()).isFalse();
		assertThat(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/auth/admin/users")
				.header("Authorization", "Bearer " + authenticatedToken(administrator)).param("role", "unknown"))
				.andReturn().getResponse().getStatus()).isEqualTo(400);
	}

	@Test
	void httpErrorsExplainRecentAuthenticationAndLastAdminWithoutLeakingReasons() throws Exception {
		User administrator = admin("error-admin@example.test");
		store.createSession("old-admin-session", administrator.id(), Instant.now().plusSeconds(3600),
				"magic_link", Instant.now().minusSeconds(3600));
		String token = jwt.encode(administrator, "old-admin-session", Instant.now().plusSeconds(900));
		var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
		var recent = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/auth/passkeys/registration/options")
				.header("Authorization", "Bearer " + token)).andReturn().getResponse();
		assertThat(recent.getStatus()).isEqualTo(403);
		assertThat(recent.getHeader("Cache-Control")).isEqualTo("private, no-store");
		assertThat(new com.fasterxml.jackson.databind.ObjectMapper().readTree(recent.getContentAsString()).path("code").asText())
				.isEqualTo("RECENT_AUTH_REQUIRED");
		var lastAdmin = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/auth/admin/users/block")
				.header("Authorization", "Bearer " + token).contentType("application/json")
				.content("{\"email\":\"error-admin@example.test\",\"blocked\":true}")).andReturn().getResponse();
		assertThat(lastAdmin.getStatus()).isEqualTo(409);
		assertThat(new com.fasterxml.jackson.databind.ObjectMapper().readTree(lastAdmin.getContentAsString()).path("code").asText())
				.isEqualTo("LAST_ACTIVE_ADMIN");
		assertThat(controller.publicError(new ResponseStatusException(HttpStatus.BAD_REQUEST, "internal private reason")).getBody())
				.containsEntry("message", "Request failed").containsEntry("code", "REQUEST_FAILED");
	}

	@Test
	void authorRequestsArePrivateIdempotentAndResolvedByRoleGrant() {
		User player = store.user("aspiring@example.test", true).orElseThrow();
		String token = "Bearer " + authenticatedToken(player);
		assertThatThrownBy(() -> controller.requestAuthorAccess(null, null)).isInstanceOf(ResponseStatusException.class);
		assertThat(controller.authorRequestStatus(token, null, new MockHttpServletResponse())).containsEntry("status", "none");
		assertThat(controller.requestAuthorAccess(token, null)).containsEntry("status", "pending");
		assertThat(controller.requestAuthorAccess(token, null)).containsEntry("status", "pending");
		assertThat(jdbc.queryForObject("select count(*) from author_access_requests", Long.class)).isEqualTo(1L);
		assertThatThrownBy(() -> controller.authorRequests(token, null, new MockHttpServletResponse()))
			.isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
		assertThatThrownBy(() -> controller.grantRole(token, null, new AuthController.RoleRequest(player.email(), "author", true)))
			.isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
		User admin = store.user("approver@example.test", true).orElseThrow();
		store.grantRole(admin.id(), "admin");
		String adminToken = "Bearer " + authenticatedToken(store.userById(admin.id()).orElseThrow());
		assertThat(controller.authorRequests(adminToken, null, new MockHttpServletResponse()))
			.singleElement().satisfies(item -> assertThat(item.email()).isEqualTo(player.email()));
		controller.grantRole(adminToken, null, new AuthController.RoleRequest(player.email(), "author", true));
		assertThat(controller.authorRequests(adminToken, null, new MockHttpServletResponse())).isEmpty();
		assertThat(controller.authorRequestStatus(token, null, new MockHttpServletResponse())).containsEntry("status", "granted");
		assertThat(controller.requestAuthorAccess(token, null)).containsEntry("status", "granted");
		assertThat(jdbc.queryForObject("select count(*) from author_access_requests", Long.class)).isZero();
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
		String adminJwt = authenticatedToken(admin);
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
		String regularJwt = authenticatedToken(regularUser);
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
		String adminJwt = authenticatedToken(admin);

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
		String adminJwt = authenticatedToken(admin);

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
		String adminJwt = authenticatedToken(admin);

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
		String adminJwt = authenticatedToken(admin);

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
		String adminJwt = authenticatedToken(admin);
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
		ReflectionTestUtils.setField(controller, "telegramWebhookSecret", "secret");

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
						"chat", Map.of("id", 67890L, "type", "private"),
						"from", Map.of("id", 67890L, "is_bot", false, "username", "fraer_user"),
						"text", "/start login"));

		Map<String, Object> response = controller.telegramWebhook("secret", update, request());

		String identity = "telegram-67890@telegram.fraerapp.local";
		assertThat(response).containsEntry("method", "sendMessage")
				.containsEntry("chat_id", 67890L)
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

	@Test
	void adminCanDeleteTelegramBoundAccountAndItsSession() {
		String adminToken = "Bearer " + authenticatedToken(admin("telegram-delete-admin@example.test"));
		User target = store.userForTelegram(8090102L, 8090102L, "delete_test");
		String targetToken = authenticatedToken(target);
		store.grantRole(target.id(), "moderator");
		store.requestAuthorAccess(target.id());

		assertThat(controller.deleteUser(adminToken, null, new AuthController.DeleteUserRequest(target.email())))
				.containsEntry("deleted", true);
		assertThat(store.userById(target.id())).isEmpty();
		assertThat(jdbc.queryForObject("select count(*) from telegram_identities where user_id = ?", Long.class, target.id())).isZero();
		assertThat(jdbc.queryForObject("select count(*) from author_access_requests where user_id = ?", Long.class, target.id())).isZero();
		assertThatThrownBy(() -> me(targetToken)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
	}

	@Test
	void moderatorAndAuthorRolesAreIndependentAndOnlyAuthorAccessResolvesRequests() throws Exception {
		User admin = admin("roles-admin@example.test");
		String adminToken = "Bearer " + authenticatedToken(admin);
		User target = store.user("moderator@example.test", true).orElseThrow();
		String targetToken = "Bearer " + authenticatedToken(target);
		controller.requestAuthorAccess(targetToken, null);

		controller.grantRole(adminToken, null, new AuthController.RoleRequest(target.email(), "moderator", true));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("moderator", "player");
		assertThat(controller.authorRequestStatus(targetToken, null, new MockHttpServletResponse())).containsEntry("status", "pending");
		assertThat(controller.requestAuthorAccess(targetToken, null)).containsEntry("status", "pending");

		controller.grantRole(adminToken, null, new AuthController.RoleRequest(target.email(), "author", true));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("author", "moderator", "player");
		assertThat(controller.authorRequestStatus(targetToken, null, new MockHttpServletResponse())).containsEntry("status", "granted");
		controller.grantRole(adminToken, null, new AuthController.RoleRequest(target.email(), "author", false));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("moderator", "player");
		controller.grantRole(adminToken, null, new AuthController.RoleRequest(target.email(), "author", true));
		controller.grantRole(adminToken, null, new AuthController.RoleRequest(target.email(), "moderator", false));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("author", "player");

		List<String> metadata = jdbc.queryForList("select metadata from auth_audit_events where event_type = 'role_changed'", String.class);
		JsonNode grant = new ObjectMapper().readTree(metadata.get(0));
		assertThat(grant.path("targetUserId").asText()).isEqualTo(target.id());
		assertThat(grant.path("role").asText()).isEqualTo("moderator");
		assertThat(grant.path("grant").asBoolean()).isTrue();
	}

	@Test
	void moderatorCanBePreGrantedAndPlayerDemotionRemovesEveryElevatedRole() {
		String adminToken = "Bearer " + authenticatedToken(admin("grant-admin@example.test"));
		String email = "pre-granted@example.test";
		controller.adminLoginLink(adminToken, null,
				new AuthController.AdminLoginLinkRequest(email, "/", true, List.of("moderator", "author", "admin")), request());
		User target = store.userByEmail(email).orElseThrow();
		assertThat(target.roles()).containsExactly("admin", "author", "moderator", "player");
		controller.grantRole(adminToken, null, new AuthController.RoleRequest(email, "player", true));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("player");

		controller.devRole(new AuthController.RoleRequest(email, "moderator", true));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("moderator", "player");
		controller.devRole(new AuthController.RoleRequest(email, "moderator", false));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("player");
		controller.devRole(new AuthController.RoleRequest(email, "moderator", true));
		controller.devRole(new AuthController.RoleRequest(email, "player", true));
		assertThat(store.userById(target.id()).orElseThrow().roles()).containsExactly("player");
	}

	@Test
	void moderatorCannotUseAuthAdministrationEndpoints() {
		User moderator = store.user("restricted-moderator@example.test", true).orElseThrow();
		store.grantRole(moderator.id(), "moderator");
		String token = "Bearer " + authenticatedToken(store.userById(moderator.id()).orElseThrow());
		List<Runnable> adminCalls = List.of(
				() -> controller.users(token, null, 0, 20, "", "all", "all"),
				() -> controller.loginRequests(token, null, 0, 20, ""),
				() -> controller.authorRequests(token, null, new MockHttpServletResponse()),
				() -> controller.grantRole(token, null, new AuthController.RoleRequest(moderator.email(), "admin", true)),
				() -> controller.blockUser(token, null, new AuthController.BlockRequest(moderator.email(), true)),
				() -> controller.deleteUser(token, null, new AuthController.DeleteUserRequest(moderator.email())),
				() -> controller.deleteLoginRequest(token, null, new AuthController.DeleteLoginRequest(moderator.email())),
				() -> controller.adminLoginLink(token, null, new AuthController.AdminLoginLinkRequest(moderator.email(), "/"), request()));
		for (Runnable call : adminCalls) {
			assertThatThrownBy(call::run).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
		}
	}

	@Test
	void currentSessionUsesDatabaseRolesAndIsPrivate() {
		User target = admin("changed-admin@example.test");
		admin("remaining-admin@example.test");
		String token = authenticatedToken(target);
		store.removeRole(target.id(), "admin");
		store.grantRole(target.id(), "moderator");
		MockHttpServletResponse response = new MockHttpServletResponse();
		Map<String, Object> current = controller.me("Bearer " + token, null, response);
		assertThat(current).containsEntry("id", target.id()).containsEntry("blocked", false)
				.containsEntry("roles", List.of("moderator", "player"))
				.containsEntry("sessionId", jwt.decode(token).sessionId());
		assertThat(response.getHeader("Cache-Control")).isEqualTo("private, no-store");
		assertThat(controller.me(null, token, new MockHttpServletResponse())).isEqualTo(current);
		assertThatThrownBy(() -> controller.users("Bearer " + token, null, 0, 20, "", "all", "all"))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
	}

	@Test
	void currentSessionRejectsMissingRevokedExpiredAndMismatchedSessions() {
		User user = store.user("session-user@example.test", true).orElseThrow();
		User other = store.user("session-other@example.test", true).orElseThrow();
		String token = authenticatedToken(user);
		String sessionId = jwt.decode(token).sessionId();
		assertThatThrownBy(() -> me(jwt.encode(user, "missing", Instant.now().plusSeconds(900))))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		assertThatThrownBy(() -> me(jwt.encode(other, sessionId, Instant.now().plusSeconds(900))))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		assertThatThrownBy(() -> me(jwt.encode(user, sessionId, Instant.now().minusSeconds(1))))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		store.createSession("expired", user.id(), Instant.now().minusSeconds(1), "magic_link", Instant.now().minusSeconds(2));
		assertThatThrownBy(() -> me(jwt.encode(user, "expired", Instant.now().plusSeconds(900))))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		store.revokeSession(sessionId);
		assertThatThrownBy(() -> me(token)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
	}

	@Test
	void logoutBlockingAndDeletionInvalidateCurrentSessionImmediately() {
		User user = store.user("logout-user@example.test", true).orElseThrow();
		String token = authenticatedToken(user);
		store.createRefresh("logout-refresh", jwt.decode(token).sessionId(), sha256("logout-refresh-token"), Instant.now().plusSeconds(3600));
		controller.logout("logout-refresh-token", new MockHttpServletResponse());
		assertThatThrownBy(() -> me(token)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		String blockedToken = authenticatedToken(user);
		store.blockUser(user.id());
		assertThatThrownBy(() -> me(blockedToken)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		store.unblockUser(user.id());
		assertThatThrownBy(() -> me(blockedToken)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
		String deletedToken = authenticatedToken(user);
		store.deleteUser(user.id(), user.email());
		assertThatThrownBy(() -> me(deletedToken)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("401");
	}

	@Test
	void blockedUserIsRejectedEvenIfSessionWasNotRevoked() {
		User user = store.user("blocked-current@example.test", true).orElseThrow();
		String token = authenticatedToken(user);
		jdbc.update("update users set blocked_at = current_timestamp where id = ?", user.id());
		assertThatThrownBy(() -> me(token)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
	}

	@Test
	void lastActiveAdminCannotBeRevokedDemotedBlockedOrDeleted() {
		User sole = admin("sole-admin@example.test");
		String token = "Bearer " + authenticatedToken(sole);
		List<Runnable> destructiveCalls = List.of(
				() -> controller.grantRole(token, null, new AuthController.RoleRequest(sole.email(), "admin", false)),
				() -> controller.grantRole(token, null, new AuthController.RoleRequest(sole.email(), "player", true)),
				() -> controller.blockUser(token, null, new AuthController.BlockRequest(sole.email(), true)),
				() -> controller.deleteUser(token, null, new AuthController.DeleteUserRequest(sole.email())),
				() -> store.deleteUser(sole.id(), sole.email()),
				() -> controller.devRole(new AuthController.RoleRequest(sole.email(), "admin", false)));
		for (Runnable call : destructiveCalls) {
			assertThatThrownBy(call::run).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
			assertThat(store.userById(sole.id()).orElseThrow().blockedAt()).isNull();
			assertThat(store.userById(sole.id()).orElseThrow().roles()).contains("admin");
		}
		assertThat(controller.me(token, null, new MockHttpServletResponse())).containsEntry("blocked", false);
	}

	@Test
	void blockedAdminsDoNotCountAndCanBeRemoved() {
		User active = admin("active-admin@example.test");
		User blocked = admin("blocked-admin@example.test");
		store.blockUser(blocked.id());
		assertThatThrownBy(() -> store.removeRole(active.id(), "admin"))
				.isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
		store.removeRole(blocked.id(), "admin");
		store.deleteUser(blocked.id(), blocked.email());
		assertThat(store.userById(blocked.id())).isEmpty();
		assertThat(store.userById(active.id()).orElseThrow().roles()).contains("admin");
	}

	@Test
	void concurrentAdminLossAcrossIndependentStoresAlwaysLeavesOneActiveAdmin() throws Exception {
		List<String> actions = List.of("revoke", "demote", "block", "delete");
		for (String firstAction : actions) {
			for (String secondAction : actions) {
				setUp();
				User first = admin("first-admin@example.test");
				User second = admin("second-admin@example.test");
				AuthStore secondStore = new AuthStore(jdbc,new SubscriptionService(jdbc,true));
				var executor = Executors.newFixedThreadPool(2);
				CountDownLatch ready = new CountDownLatch(2);
				CountDownLatch start = new CountDownLatch(1);
				try {
					var firstResult = executor.submit(() -> changeAdminConcurrently(store, firstAction, first, ready, start));
					var secondResult = executor.submit(() -> changeAdminConcurrently(secondStore, secondAction, second, ready, start));
					assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
					start.countDown();
					assertThat(List.of(firstResult.get(10, TimeUnit.SECONDS), secondResult.get(10, TimeUnit.SECONDS)))
							.as("%s racing %s", firstAction, secondAction).containsExactlyInAnyOrder(true, false);
					assertThat(jdbc.queryForObject("select count(*) from users u join user_roles r on r.user_id=u.id where r.role_name='admin' and u.blocked_at is null", Long.class))
							.isEqualTo(1L);
				}
				finally {
					start.countDown();
					executor.shutdownNow();
				}
			}
		}
	}

	@Test
	void bootstrapRolesAreNotRestoredAfterExplicitRemovalOrRestart() throws Exception {
		String email = "bootstrap@example.test";
		ReflectionTestUtils.setField(controller, "bootstrapAdminEmail", email);
		var runner = new AuthServiceApplication().bootstrap(store, email);
		runner.run(null);
		User bootstrap = store.userByEmail(email).orElseThrow();
		assertThat(bootstrap.roles()).containsExactly("admin", "author", "player");
		admin("other-bootstrap-admin@example.test");
		store.removeRole(bootstrap.id(), "admin");
		store.removeRole(bootstrap.id(), "author");
		store.grantRole(bootstrap.id(), "moderator");
		verifyLinkFor(email);
		runner.run(null);
		assertThat(store.userByEmail(email).orElseThrow().roles()).containsExactly("moderator", "player");
	}

	@Test
	void deletedBootstrapAccountIsNotRecreatedByStartupOrReprivilegedByLogin() throws Exception {
		String email = "deleted-bootstrap@example.test";
		ReflectionTestUtils.setField(controller, "bootstrapAdminEmail", email);
		User bootstrap = store.bootstrapAdmin(email).orElseThrow();
		admin("surviving-bootstrap-admin@example.test");
		store.deleteUser(bootstrap.id(), email);
		new AuthServiceApplication().bootstrap(store, email).run(null);
		assertThat(store.userByEmail(email)).isEmpty();
		verifyLinkFor(email);
		assertThat(store.userByEmail(email).orElseThrow().roles()).containsExactly("player");
	}

	@Test
	void migrationPreservesRolesOfExistingManagedAccounts() {
		User existing = store.user("existing-managed@example.test", true).orElseThrow();
		jdbc.execute("drop table bootstrap_admin_initializations");
		jdbc.update("delete from roles where name = 'moderator'");
		new ResourceDatabasePopulator(new ClassPathResource("db/migration/V8__moderator_and_bootstrap_initialization.sql"))
				.execute(jdbc.getDataSource());
		assertThat(store.bootstrapAdmin(existing.email()).orElseThrow().roles()).containsExactly("player");
		assertThat(store.bootstrapAdmin("new-bootstrap@example.test").orElseThrow().roles()).containsExactly("admin", "author", "player");
	}

	private boolean changeAdminConcurrently(AuthStore targetStore, String action, User user, CountDownLatch ready, CountDownLatch start) throws Exception {
		ready.countDown();
		if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test did not start");
		try {
			switch (action) {
				case "revoke" -> targetStore.removeRole(user.id(), "admin");
				case "demote" -> targetStore.demoteToPlayer(user.id());
				case "block" -> targetStore.blockUser(user.id());
				case "delete" -> targetStore.deleteUser(user.id(), user.email());
				default -> throw new IllegalArgumentException(action);
			}
			return true;
		}
		catch (ResponseStatusException ex) {
			assertThat(ex.getStatusCode().value()).isEqualTo(409);
			return false;
		}
	}

	private User admin(String email) {
		User user = store.user(email, true).orElseThrow();
		store.grantRole(user.id(), "admin");
		return store.userById(user.id()).orElseThrow();
	}

	private String authenticatedToken(User user) {
		String sessionId = UUID.randomUUID().toString();
		store.createSession(sessionId, user.id(), Instant.now().plusSeconds(3600), "magic_link", Instant.now());
		return jwt.encode(user, sessionId, Instant.now().plusSeconds(900));
	}

	private Map<String, Object> me(String token) {
		return controller.me("Bearer " + token, null, new MockHttpServletResponse());
	}

	private void verifyLinkFor(String email) {
		String rawToken = UUID.randomUUID().toString();
		store.createMagicLink(email, sha256(rawToken), "/", Instant.now().plusSeconds(900));
		controller.verify(new AuthController.VerifyRequest(rawToken), new MockHttpServletResponse());
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
