package com.fraergod.fraerapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:jwt-http;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=validate"
})
class JwtAuthenticationTests extends ApiTestSupport {
    @LocalServerPort int port;

    @Test
    void invalidCredentialsReturnRefreshableUnauthorizedForCookieAndBearer() throws Exception {
        String valid = TestJwtFactory.player("jwt-http@example.test");
        for (String token : List.of("malformed-access-token", valid + "tampered",
                TestJwtFactory.expiredPlayer("jwt-http@example.test"))) {
            for (boolean cookie : List.of(false, true)) {
                var response = get("/api/sessions", token, cookie);
                assertThat(response.statusCode()).as("cookie=%s: %s", cookie, response.body()).isEqualTo(401);
                assertThat(response.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
                assertThat(response.body()).doesNotContain(token, "stackTrace", "JwtTokenVerifier");
            }
        }
        assertThat(get("/api/sessions", valid, false).statusCode()).isEqualTo(200);
        assertThat(get("/api/sessions", valid, true).statusCode()).isEqualTo(200);
        assertThat(get("/api/sessions", null, false).statusCode()).isEqualTo(401);
    }

    @Test
    void publicAnonymousCatalogueRemainsAccessible() throws Exception {
        assertThat(get("/api/catalog/stories", null, false).statusCode()).isEqualTo(200);
        assertThat(get("/api/catalog/stories", "invalid", true).statusCode()).isEqualTo(401);
    }

    private HttpResponse<String> get(String path, String token, boolean cookie) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Accept", "application/json");
        if (token != null) request.header(cookie ? "Cookie" : "Authorization",
                cookie ? "fraer_access=" + token : "Bearer " + token);
        return HttpClient.newHttpClient().send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
