package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
		"app.admin-token=test-token",
		"app.assets.storage-path=build/test-uploads/author-workflow"
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

	@Test
	void authorCanUploadAssetIntoOwnedStory() {
		String authorId = login("asset-author-" + UUID.randomUUID());
		String storyKey = "asset_story_" + UUID.randomUUID().toString().replace("-", "");
		ApiResponse imported = request("POST", "/api/author/stories/import", validStory(storyKey), authorId, null);
		String storyId = imported.body().get("storyId").toString();

		ApiResponse uploaded = multipart("/api/author/stories/" + storyId + "/assets", authorId, Map.of(
				"assetKey", "cover",
				"type", "image"), "cover.svg", "image/svg+xml", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");

		assertThat(uploaded.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(uploaded.body()).containsEntry("id", "cover");
		assertThat(uploaded.body()).containsEntry("type", "image");
		assertThat(uploaded.body().get("url").toString()).startsWith("/uploads/" + storyId + "/");

		ApiResponse document = request("GET", "/api/author/stories/" + storyId + "/document", null, authorId, null);
		List<Map<String, Object>> assets = castList(document.body().get("assets"));
		assertThat(assets).anySatisfy(asset -> {
			assertThat(asset).containsEntry("id", "cover");
			assertThat(asset.get("url").toString()).startsWith("/uploads/" + storyId + "/");
		});
	}

	@Test
	void authorCanDeleteOwnedStory() {
		String authorId = login("delete-author-" + UUID.randomUUID());
		String storyKey = "delete_story_" + UUID.randomUUID().toString().replace("-", "");
		ApiResponse imported = request("POST", "/api/author/stories/import", validStory(storyKey), authorId, null);
		String storyId = imported.body().get("storyId").toString();
		request("POST", "/api/author/stories/" + storyId + "/publish", null, authorId, null);

		ApiResponse deleted = request("DELETE", "/api/author/stories/" + storyId, null, authorId, null);
		assertThat(deleted.status()).isEqualTo(HttpStatus.OK.value());
		assertThat(deleted.body()).containsEntry("deleted", true);

		ApiResponse home = request("GET", "/api/author/home", null, authorId, null);
		List<Map<String, Object>> stories = castList(home.body().get("stories"));
		assertThat(stories).noneSatisfy(story -> assertThat(story).containsEntry("storyId", storyId));

		ApiResponse document = request("GET", "/api/author/stories/" + storyId + "/document", null, authorId, null);
		assertThat(document.status()).isEqualTo(HttpStatus.NOT_FOUND.value());
	}

	@Test
	void authorCannotDeleteAnotherAuthorsStory() {
		String ownerId = login("delete-owner-" + UUID.randomUUID());
		String otherId = login("delete-other-" + UUID.randomUUID());
		String storyKey = "foreign_delete_story_" + UUID.randomUUID().toString().replace("-", "");
		ApiResponse imported = request("POST", "/api/author/stories/import", validStory(storyKey), ownerId, null);
		String storyId = imported.body().get("storyId").toString();

		ApiResponse forbidden = request("DELETE", "/api/author/stories/" + storyId, null, otherId, null);
		assertThat(forbidden.status()).isEqualTo(HttpStatus.FORBIDDEN.value());

		ApiResponse home = request("GET", "/api/author/home", null, ownerId, null);
		List<Map<String, Object>> stories = castList(home.body().get("stories"));
		assertThat(stories).anySatisfy(story -> assertThat(story).containsEntry("storyId", storyId));
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

	private ApiResponse multipart(String path, String playerId, Map<String, String> fields,
			String filename, String contentType, String fileBody) {
		try {
			String boundary = "----fraerapp-" + UUID.randomUUID();
			HttpRequest.BodyPublisher body = multipartBody(boundary, fields, filename, contentType, fileBody);
			HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
					.header("Accept", "application/json")
					.header("X-Player-Id", playerId)
					.header("Content-Type", "multipart/form-data; boundary=" + boundary)
					.POST(body)
					.build();
			HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
			Map<String, Object> parsed = response.body().isBlank() ? Map.of() : readMap(response.body());
			return new ApiResponse(response.statusCode(), parsed, response.body());
		} catch (Exception ex) {
			throw new IllegalStateException("Multipart request failed: " + path, ex);
		}
	}

	private HttpRequest.BodyPublisher multipartBody(String boundary, Map<String, String> fields,
			String filename, String contentType, String fileBody) {
		List<byte[]> parts = new ArrayList<>();
		fields.forEach((name, value) -> parts.add(("""
				--%s\r
				Content-Disposition: form-data; name="%s"\r
				\r
				%s\r
				""").formatted(boundary, name, value).getBytes(StandardCharsets.UTF_8)));
		parts.add(("""
				--%s\r
				Content-Disposition: form-data; name="file"; filename="%s"\r
				Content-Type: %s\r
				\r
				%s\r
				--%s--\r
				""").formatted(boundary, filename, contentType, fileBody, boundary).getBytes(StandardCharsets.UTF_8));
		return HttpRequest.BodyPublishers.ofByteArrays(parts);
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
