package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = {
		"spring.datasource.url=jdbc:h2:mem:story-runtime;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
		"spring.jpa.hibernate.ddl-auto=validate",
		"app.admin-token=test-token"
})
class GameFlowTests {

	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};
	private static final TypeReference<List<Map<String, Object>>> LIST_TYPE = new TypeReference<>() {
	};

	private final HttpClient client = HttpClient.newHttpClient();
	private final ObjectMapper mapper = new ObjectMapper();

	@LocalServerPort
	private int port;

	@Test
	void seedStoryIsPublished() {
		ApiResponse response = request("GET", "/api/stories", null, null, null);

		assertThat(response.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(readList(response.rawBody())).anySatisfy(story -> assertThat(story).containsEntry("key", "night_train"));
	}

	@Test
	void importValidateAndPublishStory() {
		ApiResponse imported = request("POST", "/api/admin/stories/import", validStory("runtime_" + UUID.randomUUID()), null, "test-token");
		assertThat(imported.status()).isEqualTo(HttpStatus.OK.value());

		String storyId = imported.body().get("storyId").toString();
		ApiResponse validation = request("POST", "/api/admin/stories/" + storyId + "/validate", null, null, "test-token");
		assertThat(validation.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(validation.body()).containsEntry("valid", true);

		ApiResponse published = request("POST", "/api/admin/stories/" + storyId + "/publish", null, null, "test-token");
		assertThat(published.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(published.body()).containsEntry("status", "published");
	}

	@Test
	void importRejectsInvalidStory() {
		ApiResponse response = request("POST", "/api/admin/stories/import", invalidStory("broken_" + UUID.randomUUID()), null, "test-token");

		assertThat(response.status()).isEqualTo(HttpStatus.BAD_REQUEST.value());
	}

	@Test
	void sessionAppliesEffectsAndHidesChoicesByCondition() {
		String playerId = login("engine-" + UUID.randomUUID());
		String sessionId = createSession(playerId, "night_train").body().get("sessionId").toString();

		ApiResponse start = request("GET", "/api/sessions/" + sessionId + "/state", null, playerId, null);
		assertThat(choiceIds(start.body())).containsExactlyInAnyOrder("inspect_ticket", "enter_station");

		ApiResponse ticket = request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"inspect_ticket\"}", playerId, null);
		assertThat(ticket.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(((Map<?, ?>) ticket.body().get("variables")).get("hasTicket")).isEqualTo(true);

		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"ask_window\"}", playerId, null);
		ApiResponse hall = request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"read_board\"}", playerId, null);
		assertThat(choiceIds(hall.body())).contains("accept_journey");
	}

	@Test
	void conditionBlocksUnavailableChoice() {
		String playerId = login("blocked-" + UUID.randomUUID());
		String sessionId = createSession(playerId, "night_train").body().get("sessionId").toString();

		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"enter_station\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"open_door\"}", playerId, null);
		ApiResponse blocked = request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"white_line\"}", playerId, null);

		assertThat(blocked.status()).isEqualTo(HttpStatus.BAD_REQUEST.value());
	}

	@Test
	void sessionCannotBeUsedByAnotherPlayer() {
		String owner = login("owner-" + UUID.randomUUID());
		String other = login("other-" + UUID.randomUUID());
		String sessionId = createSession(owner, "night_train").body().get("sessionId").toString();

		ApiResponse response = request("GET", "/api/sessions/" + sessionId + "/state", null, other, null);

		assertThat(response.status()).isEqualTo(HttpStatus.FORBIDDEN.value());
	}

	@Test
	void playerCanListAndContinueSavedRuns() {
		String playerId = login("saves-" + UUID.randomUUID());
		String firstSessionId = createSession(playerId, "night_train").body().get("sessionId").toString();
		request("POST", "/api/sessions/" + firstSessionId + "/choice", "{\"choiceId\":\"inspect_ticket\"}", playerId, null);
		String secondSessionId = createSession(playerId, "night_train").body().get("sessionId").toString();

		ApiResponse saves = request("GET", "/api/sessions", null, playerId, null);
		assertThat(saves.status()).isEqualTo(HttpStatus.OK.value());
		List<Map<String, Object>> runs = readList(saves.rawBody());
		assertThat(runs).hasSizeGreaterThanOrEqualTo(2);
		assertThat(runs).anySatisfy(save -> {
			assertThat(save).containsEntry("sessionId", firstSessionId);
			assertThat(save).containsEntry("storyKey", "night_train");
			assertThat(save).containsEntry("sceneId", "ticket");
			assertThat(save.get("saveName").toString()).startsWith("Save ");
		});
		assertThat(runs).anySatisfy(save -> assertThat(save).containsEntry("sessionId", secondSessionId));

		ApiResponse continued = request("GET", "/api/sessions/" + firstSessionId + "/state", null, playerId, null);
		assertThat(castMap(continued.body().get("scene"))).containsEntry("id", "ticket");

		ApiResponse catalog = request("GET", "/api/catalog/stories", null, playerId, null);
		Map<String, Object> nightTrain = readList(catalog.rawBody()).stream()
				.filter(story -> "night_train".equals(story.get("key")))
				.findFirst()
				.orElseThrow();
		assertThat(nightTrain.get("lastSessionId")).isNotNull();
		assertThat(nightTrain.get("lastSaveName")).isNotNull();
	}

	@Test
	void endingFinishesSession() {
		String playerId = login("ending-" + UUID.randomUUID());
		String sessionId = createSession(playerId, "night_train").body().get("sessionId").toString();

		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"inspect_ticket\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"ask_window\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"read_board\"}", playerId, null);
		ApiResponse ending = request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"accept_journey\"}", playerId, null);

		assertThat(ending.body()).containsEntry("status", "finished");
		assertThat(((Map<?, ?>) ending.body().get("scene")).get("ending")).isNotNull();
	}

	private String login(String username) {
		ApiResponse response = request("POST", "/api/auth/login", "{\"username\":\"" + username + "\"}", null, null);
		assertThat(response.status()).isEqualTo(HttpStatus.OK.value());
		return response.body().get("playerId").toString();
	}

	private ApiResponse createSession(String playerId, String storyKey) {
		ApiResponse response = request("POST", "/api/sessions", "{\"storyKey\":\"" + storyKey + "\"}", playerId, null);
		assertThat(response.status()).isEqualTo(HttpStatus.OK.value());
		return response;
	}

	@SuppressWarnings("unchecked")
	private List<String> choiceIds(Map<String, Object> body) {
		Map<String, Object> scene = (Map<String, Object>) body.get("scene");
		List<Map<String, Object>> choices = (List<Map<String, Object>>) scene.get("choices");
		return choices.stream().map(choice -> choice.get("id").toString()).toList();
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> castMap(Object value) {
		return (Map<String, Object>) value;
	}

	private ApiResponse request(String method, String path, String body, String playerId, String adminToken) {
		try {
			HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
					.header("Accept", "application/json");
			if (playerId != null) {
				builder.header("X-Player-Id", playerId);
			}
			if (adminToken != null) {
				builder.header("X-Admin-Token", adminToken);
			}
			if (body == null) {
				builder.method(method, HttpRequest.BodyPublishers.noBody());
			} else {
				builder.header("Content-Type", "application/json")
						.method(method, HttpRequest.BodyPublishers.ofString(body));
			}
			HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
			Map<String, Object> parsed = response.body().isBlank() ? Map.of() : readMap(response.body());
			return new ApiResponse(response.statusCode(), parsed, response.body());
		} catch (Exception ex) {
			throw new IllegalStateException("Request failed: " + method + " " + path, ex);
		}
	}

	private Map<String, Object> readMap(String body) {
		try {
			return mapper.readValue(body, MAP_TYPE);
		} catch (Exception ex) {
			return Map.of("raw", body);
		}
	}

	private List<Map<String, Object>> readList(String body) {
		try {
			return mapper.readValue(body, LIST_TYPE);
		} catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String validStory(String key) {
		return """
				{
				  "key": "%s",
				  "title": "Runtime test",
				  "description": "Imported during tests",
				  "version": 1,
				  "startSceneId": "start",
				  "variables": { "score": 0 },
				  "assets": [
				    { "id": "bg", "type": "image", "url": "/assets/platform.svg" }
				  ],
				  "scenes": [
				    {
				      "id": "start",
				      "title": "Start",
				      "text": "Start text",
				      "background": "bg",
				      "music": null,
				      "animation": {},
				      "effects": [],
				      "choices": [
				        { "id": "go", "label": "Go", "target": "end", "conditions": [], "effects": [{ "inc": "score", "value": 1 }] }
				      ]
				    },
				    {
				      "id": "end",
				      "title": "End",
				      "text": "Done",
				      "background": "bg",
				      "music": null,
				      "animation": {},
				      "effects": [],
				      "ending": { "type": "ok", "title": "Done" },
				      "choices": []
				    }
				  ]
				}
				""".formatted(key);
	}

	private String invalidStory(String key) {
		return """
				{
				  "key": "%s",
				  "title": "Broken",
				  "version": 1,
				  "startSceneId": "start",
				  "variables": {},
				  "assets": [],
				  "scenes": [
				    {
				      "id": "start",
				      "title": "Start",
				      "text": "Broken target",
				      "animation": {},
				      "effects": [],
				      "choices": [
				        { "id": "bad", "label": "Bad", "target": "missing", "conditions": [], "effects": [] }
				      ]
				    }
				  ]
				}
				""".formatted(key);
	}

	private record ApiResponse(int status, Map<String, Object> body, String rawBody) {
	}
}
