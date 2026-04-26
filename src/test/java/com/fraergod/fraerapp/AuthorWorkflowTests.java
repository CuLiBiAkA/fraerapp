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
		"spring.datasource.url=jdbc:h2:mem:author-workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
		"spring.jpa.hibernate.ddl-auto=validate",
		"app.admin-token=test-token"
})
class AuthorWorkflowTests {

	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};
	private static final TypeReference<List<Map<String, Object>>> LIST_TYPE = new TypeReference<>() {
	};

	private final HttpClient client = HttpClient.newHttpClient();
	private final ObjectMapper mapper = new ObjectMapper();

	@LocalServerPort
	private int port;

	@Test
	void authorCanImportPublishAndSeeStoryInCatalog() {
		String authorId = login("author-" + UUID.randomUUID());
		String storyKey = "author_story_" + UUID.randomUUID().toString().replace("-", "");

		ApiResponse imported = request("POST", "/api/author/stories/import", validStory(storyKey), authorId, null);
		assertThat(imported.status()).isEqualTo(HttpStatus.OK.value());

		String storyId = imported.body().get("storyId").toString();
		ApiResponse validation = request("POST", "/api/author/stories/" + storyId + "/validate", null, authorId, null);
		assertThat(validation.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(validation.body()).containsEntry("valid", true);

		ApiResponse published = request("POST", "/api/author/stories/" + storyId + "/publish", null, authorId, null);
		assertThat(published.status()).isEqualTo(HttpStatus.OK.value());

		ApiResponse home = request("GET", "/api/author/home", null, authorId, null);
		assertThat(home.status()).isEqualTo(HttpStatus.OK.value());
		List<Map<String, Object>> stories = castList(home.body().get("stories"));
		assertThat(stories).anySatisfy(story -> {
			assertThat(story).containsEntry("storyId", storyId);
			assertThat(story.get("publishedSlug")).isNotNull();
		});

		String slug = stories.stream()
				.filter(story -> storyId.equals(story.get("storyId")))
				.findFirst()
				.orElseThrow()
				.get("publishedSlug").toString();

		ApiResponse catalog = request("GET", "/api/catalog/stories", null, null, null);
		assertThat(catalog.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(readList(catalog.rawBody())).anySatisfy(story -> assertThat(story).containsEntry("slug", slug));

		ApiResponse details = request("GET", "/api/catalog/stories/" + slug, null, null, null);
		assertThat(details.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(details.body()).containsEntry("slug", slug);
		assertThat(details.body()).containsEntry("authorName", home.body().get("username"));
	}

	private String login(String username) {
		ApiResponse response = request("POST", "/api/auth/login", "{\"username\":\"" + username + "\"}", null, null);
		assertThat(response.status()).isEqualTo(HttpStatus.OK.value());
		return response.body().get("playerId").toString();
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

	@SuppressWarnings("unchecked")
	private List<Map<String, Object>> castList(Object value) {
		return (List<Map<String, Object>>) value;
	}

	private String validStory(String key) {
		return """
				{
				  "key": "%s",
				  "title": "Author runtime test",
				  "description": "Imported during author workflow tests",
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

	private record ApiResponse(int status, Map<String, Object> body, String rawBody) {
	}
}
