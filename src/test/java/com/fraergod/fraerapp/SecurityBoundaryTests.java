package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:security-boundaries;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=validate"
})
class SecurityBoundaryTests extends ApiTestSupport {
    @LocalServerPort int port;

    @Test
    void legacyTasksRequireCurrentAdministratorForEveryOperation() {
        String admin = TestJwtFactory.admin("tasks-admin@example.test");
        String reader = TestJwtFactory.player("tasks-reader@example.test");
        var created = api(port, "POST", "/api/tasks", "{\"title\":\"Private task\",\"completed\":false}", admin);
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String id = object(created.body()).get("id").toString();
        for (String token : new String[] { null, reader }) {
            int denied = token == null ? 401 : 403;
            assertThat(api(port, "GET", "/api/tasks", null, token).statusCode()).isEqualTo(denied);
            assertThat(api(port, "POST", "/api/tasks", "{\"title\":\"Attack\",\"completed\":false}", token).statusCode()).isEqualTo(denied);
            assertThat(api(port, "PUT", "/api/tasks/" + id, "{\"title\":\"Attack\",\"completed\":true}", token).statusCode()).isEqualTo(denied);
            assertThat(api(port, "DELETE", "/api/tasks/" + id, null, token).statusCode()).isEqualTo(denied);
        }
        var listed = api(port, "GET", "/api/tasks", null, admin);
        assertThat(listed.statusCode()).isEqualTo(200);
        assertThat(listed.body()).contains("Private task").doesNotContain("Attack");
        assertThat(api(port, "DELETE", "/api/tasks/" + id, null, admin).statusCode()).isEqualTo(204);
    }

    @Test
    void readersAndAuthorsNeverReceiveOtherUsersLoginIdentity() {
        String author = TestJwtFactory.author("private-author@example.test");
        String reader = TestJwtFactory.player("private-reader@example.test");
        String key = "identity_" + UUID.randomUUID();
        var story = Map.of("key", key, "title", "Identity boundary", "startSceneId", "end",
            "variables", Map.of(), "assets", List.of(), "scenes", List.of(Map.of(
                "id", "end", "title", "End", "text", "The end", "choices", List.of(), "ending", Map.of("type", "good"))));
        var imported = api(port, "POST", "/api/author/stories/import", body(story), author);
        assertThat(imported.statusCode()).as(imported.body()).isEqualTo(200);
        String id = object(imported.body()).get("storyId").toString();
        var published = approveAndPublish(port, id, author);
        assertThat(published.statusCode()).as(published.body()).isEqualTo(200);
        String slug = object(published.body()).get("publishedSlug").toString();
        for (String path : List.of("/api/catalog/stories", "/api/catalog/stories/" + slug)) {
            var result = api(port, "GET", path, null, reader);
            assertThat(result.statusCode()).as(result.body()).isEqualTo(200);
            assertThat(result.body()).doesNotContain("private-author", "@example.test");
        }
        var run = api(port, "POST", "/api/sessions", body(Map.of("storyKey", key)), reader);
        assertThat(run.statusCode()).as(run.body()).isEqualTo(200);
        assertThat(run.body()).doesNotContain("private-author", "@example.test");
        var saves = api(port, "GET", "/api/sessions", null, reader);
        assertThat(saves.body()).doesNotContain("private-author", "@example.test");
        var analytics = api(port, "GET", "/api/author/stories/" + id + "/analytics", null, author);
        assertThat(analytics.statusCode()).as(analytics.body()).isEqualTo(200);
        assertThat(analytics.body()).doesNotContain("private-reader", "@example.test");
    }
}
