package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
		"spring.datasource.url=jdbc:h2:mem:story-runtime-edge;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
		"spring.jpa.hibernate.ddl-auto=validate",
		"app.admin-token=test-token"
})
class GameApiEdgeCaseTests {

	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};

	private final HttpClient client = HttpClient.newHttpClient();
	private final ObjectMapper mapper = new ObjectMapper();

	@LocalServerPort
	private int port;

	@Test
	void publishRequiresAdminToken() {
		ApiResponse imported = request("POST", "/api/admin/stories/import", validStory("runtime_" + UUID.randomUUID()), null, "test-token");
		String storyId = imported.body().get("storyId").toString();

		ApiResponse response = request("POST", "/api/admin/stories/" + storyId + "/publish", null, null, null);

		assertThat(response.status()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
	}

	@Test
	void draftStoryIsNotPlayableBeforePublish() {
		String storyKey = "draft_" + UUID.randomUUID();
		request("POST", "/api/admin/stories/import", validStory(storyKey), null, "test-token");
		String playerId = login("draft-player-" + UUID.randomUUID());

		ApiResponse response = request("POST", "/api/sessions", "{\"storyKey\":\"" + storyKey + "\"}", playerId, null);

		assertThat(response.status()).isEqualTo(HttpStatus.NOT_FOUND.value());
	}

	@Test
	void resetRestoresStartSceneVariablesAndStatus() {
		String playerId = login("reset-" + UUID.randomUUID());
		String sessionId = createSession(playerId, "night_train").body().get("sessionId").toString();

		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"inspect_ticket\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"ask_window\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"read_board\"}", playerId, null);
		request("POST", "/api/sessions/" + sessionId + "/choice", "{\"choiceId\":\"accept_journey\"}", playerId, null);

		ApiResponse reset = request("POST", "/api/sessions/" + sessionId + "/reset", null, playerId, null);

		assertThat(reset.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(reset.body()).containsEntry("status", "active");
		@SuppressWarnings("unchecked")
		Map<String, Object> scene = (Map<String, Object>) reset.body().get("scene");
		assertThat(scene).containsEntry("id", "platform");
		assertThat(((Map<?, ?>) reset.body().get("variables")).get("hasTicket")).isEqualTo(false);
	}

	@Test
	void sessionEndpointsRequirePlayerHeader() {
		ApiResponse response = request("POST", "/api/sessions", "{\"storyKey\":\"night_train\"}", null, null);

		assertThat(response.status()).isEqualTo(HttpStatus.BAD_REQUEST.value());
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
			Map<String, Object> parsed = readMap(response.body());
			return new ApiResponse(response.statusCode(), parsed);
		} catch (Exception ex) {
			throw new IllegalStateException("Request failed: " + method + " " + path, ex);
		}
	}

	private Map<String, Object> readMap(String body) {
		try {
			return body.isBlank() ? Map.of() : mapper.readValue(body, MAP_TYPE);
		} catch (Exception ex) {
			return Map.of("raw", body);
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

	private record ApiResponse(int status, Map<String, Object> body) {
	}
}
