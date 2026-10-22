package com.fraergod.fraerapp;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "spring.datasource.url=jdbc:h2:mem:meowstats;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=validate"
})
class MeowStatsTests extends ApiTestSupport {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    final String admin = TestJwtFactory.admin("meow-admin@example.test");
    final String writePath = "/api/experiments/meow/visit", readPath = "/api/admin/experiments/meow";
    @BeforeEach void clear() { jdbc.update("DELETE FROM meow_visitors"); }
    void visit(String id) { assertThat(api(port, "POST", writePath, body(Map.of("visitorId", id)), null).statusCode()).isEqualTo(204); }
    Map<String,Object> stats() { var response = api(port, "GET", readPath, null, admin); assertThat(response.statusCode()).as(response.body()).isEqualTo(200); return object(response.body()); }

    @Test void countsBrowsersSeparatelyFromPageViewsAndRejectsNonAdminReaders() {
        assertThat(stats().get("visitors")).isEqualTo(0);
        String id = UUID.randomUUID().toString(); visit(id); visit(id.toUpperCase(Locale.ROOT)); visit(UUID.randomUUID().toString());
        var counts = stats();
        assertThat(counts.get("visitors")).isEqualTo(2); assertThat(counts.get("pageViews")).isEqualTo(3);
        assertThat(counts.get("visitorsToday")).isEqualTo(2); assertThat(counts.get("visitorsWeek")).isEqualTo(2);
        assertThat(counts.get("firstVisitAt")).isNotNull();
        assertThat(api(port,"GET",readPath,null,null).statusCode()).isEqualTo(401);
        for (String token : List.of(TestJwtFactory.player("meow-reader@example.test"), TestJwtFactory.moderator("meow-mod@example.test")))
            assertThat(api(port,"GET",readPath,null,token).statusCode()).isEqualTo(403);
        assertThat(api(port,"POST",writePath,"{}",null).statusCode()).isEqualTo(400);
        assertThat(api(port,"POST",writePath,"{\"visitorId\":\"invalid\"}",null).statusCode()).isEqualTo(400);
        assertThat(stats().get("pageViews")).isEqualTo(3);
        assertThat(api(port,"GET",readPath,null,admin).headers().firstValue("Cache-Control").orElse("")).contains("no-store");
    }

    @Test void rollingPeriodsUseKaliningradCalendarBoundariesAndReturningBrowsers() {
        var start = LocalDate.now(ZoneId.of("Europe/Kaliningrad")).atStartOfDay(ZoneId.of("Europe/Kaliningrad")).toInstant();
        String yesterday = UUID.randomUUID().toString();
        for (var entry : Map.of(yesterday, start.minusSeconds(1), UUID.randomUUID().toString(), start.minus(6, java.time.temporal.ChronoUnit.DAYS), UUID.randomUUID().toString(), start.minus(6, java.time.temporal.ChronoUnit.DAYS).minusSeconds(1)).entrySet())
            jdbc.update("INSERT INTO meow_visitors VALUES (?, ?, ?, 1)",entry.getKey(),Timestamp.from(entry.getValue()),Timestamp.from(entry.getValue()));
        assertThat(stats().get("visitorsToday")).isEqualTo(0); assertThat(stats().get("visitorsWeek")).isEqualTo(2);
        visit(yesterday);
        assertThat(stats().get("visitors")).isEqualTo(3); assertThat(stats().get("visitorsToday")).isEqualTo(1); assertThat(stats().get("pageViews")).isEqualTo(4);
    }

    @Test void concurrentTabsDoNotLoseViewsOrDuplicateVisitors() throws Exception {
        var pool = Executors.newFixedThreadPool(8); String id = UUID.randomUUID().toString();
        try {
            var jobs = new ArrayList<Callable<Void>>();
            for (int i = 0; i < 16; i++) jobs.add(() -> { visit(id); return null; });
            for (var result : pool.invokeAll(jobs)) result.get();
        } finally { pool.shutdownNow(); }
        assertThat(stats().get("visitors")).isEqualTo(1); assertThat(stats().get("pageViews")).isEqualTo(16);
    }
}
