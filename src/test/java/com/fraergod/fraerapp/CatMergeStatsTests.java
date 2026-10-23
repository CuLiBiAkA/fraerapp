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
    "spring.datasource.url=jdbc:h2:mem:catmerge;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=validate"
})
class CatMergeStatsTests extends ApiTestSupport {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    final String root = "/api/experiments/cat-merge", read = "/api/admin/experiments/cat-merge";
    final String admin = TestJwtFactory.admin("cat-merge-admin@example.test");
    @BeforeEach void clear() { jdbc.update("DELETE FROM cat_merge_games"); jdbc.update("DELETE FROM cat_merge_visitors"); }
    String id() { return UUID.randomUUID().toString(); }
    int post(String path, Map<String, Object> value) { return api(port, "POST", root + path, body(value), null).statusCode(); }
    Map<String,Object> stats() { var r = api(port,"GET",read,null,admin); assertThat(r.statusCode()).as(r.body()).isEqualTo(200); return object(r.body()); }
    Map<String,Object> finish(String visitor, String outcome) { return new HashMap<>(Map.of("visitorId",visitor,"outcome",outcome,"score",60,"drops",5,"merges",2,"highestLevel",2,"durationSeconds",40)); }

    @Test void visitsAndAdminOnlyAggregatesRemainSeparateFromMeow() {
        long old = jdbc.queryForObject("SELECT COUNT(*) FROM meow_visitors", Long.class);
        assertThat(stats().get("visitors")).isEqualTo(0); String v = id();
        assertThat(post("/visit",Map.of("visitorId",v))).isEqualTo(204);
        assertThat(post("/visit",Map.of("visitorId",v.toUpperCase(Locale.ROOT)))).isEqualTo(204);
        assertThat(stats().get("visitors")).isEqualTo(1); assertThat(stats().get("pageViews")).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM meow_visitors", Long.class)).isEqualTo(old);
        assertThat(api(port,"GET",read,null,null).statusCode()).isEqualTo(401);
        for (var token : List.of(TestJwtFactory.player("cat-reader@example.test"), TestJwtFactory.moderator("cat-mod@example.test")))
            assertThat(api(port,"GET",read,null,token).statusCode()).isEqualTo(403);
        assertThat(api(port,"GET",read,null,admin).headers().firstValue("Cache-Control").orElse("")).contains("no-store");
        assertThat(post("/visit",Map.of("visitorId","bad"))).isEqualTo(400);
        assertThat(post("/games",Map.of("visitorId",v))).isEqualTo(400);
    }
    @Test void gameResultsAreIdempotentOwnedAndRestartIsNotACompletion() {
        String visitor = id(), game = id(); var start = Map.<String,Object>of("visitorId",visitor,"gameId",game);
        assertThat(post("/games",start)).isEqualTo(204); assertThat(post("/games",start)).isEqualTo(204);
        assertThat(post("/games",Map.of("visitorId",id(),"gameId",game))).isEqualTo(404);
        assertThat(stats().get("gamesStarted")).isEqualTo(1); assertThat(stats().get("gamesFinished")).isEqualTo(0);
        assertThat(post("/games/"+game+"/finish",finish(id(),"lost"))).isEqualTo(404);
        assertThat(post("/games/"+game+"/finish",finish(visitor,"lost"))).isEqualTo(204);
        assertThat(post("/games/"+game+"/finish",finish(visitor,"restarted"))).isEqualTo(204);
        String second = id(); assertThat(post("/games",Map.of("visitorId",visitor,"gameId",second))).isEqualTo(204);
        assertThat(post("/games/"+second+"/finish",finish(visitor,"restarted"))).isEqualTo(204);
        var s = stats(); assertThat(s.get("gamesStarted")).isEqualTo(2); assertThat(s.get("gamesFinished")).isEqualTo(1);
        assertThat(s.get("gamesLost")).isEqualTo(1); assertThat(s.get("gamesRestarted")).isEqualTo(1);
        assertThat(s.get("bestScore")).isEqualTo(60); assertThat(((Number)s.get("averageScore")).doubleValue()).isEqualTo(60);
        assertThat(((Number)s.get("averageDurationSeconds")).doubleValue()).isEqualTo(40);
    }
    @Test void invalidResultsDoNotFinishGamesAndWinningResultIsCounted() {
        String v = id(), g = id(); post("/games",Map.of("visitorId",v,"gameId",g));
        for (String key : List.of("score","drops","merges","highestLevel","durationSeconds")) {
            var missing = finish(v,"lost"); missing.remove(key); assertThat(post("/games/"+g+"/finish",missing)).isEqualTo(400);
            var negative = finish(v,"lost"); negative.put(key,-1); assertThat(post("/games/"+g+"/finish",negative)).isEqualTo(400);
        }
        var invalid = finish(v,"lost"); invalid.put("merges",5); assertThat(post("/games/"+g+"/finish",invalid)).isEqualTo(400);
        assertThat(post("/games/"+g+"/finish",finish(v,"won"))).isEqualTo(400);
        assertThat(stats().get("gamesFinished")).isEqualTo(0);
        var won = finish(v,"won"); won.put("highestLevel",8); won.put("score",3000); won.put("merges",50); won.put("drops",60);
        assertThat(post("/games/"+g+"/finish",won)).isEqualTo(204); assertThat(stats().get("gamesWon")).isEqualTo(1);
    }
    @Test void calendarBoundariesAndConcurrentTabsPreserveCounts() throws Exception {
        Instant day = LocalDate.now(ZoneId.of("Europe/Kaliningrad")).atStartOfDay(ZoneId.of("Europe/Kaliningrad")).toInstant();
        for (long ago : List.of(1L, 6*86400L, 6*86400L+1))
            jdbc.update("INSERT INTO cat_merge_visitors VALUES (?, ?, ?, 1)",id(),Timestamp.from(day.minusSeconds(ago)),Timestamp.from(day.minusSeconds(ago)));
        assertThat(stats().get("visitorsToday")).isEqualTo(0); assertThat(stats().get("visitorsWeek")).isEqualTo(2);
        String v = id(), g = id(); var pool = Executors.newFixedThreadPool(8);
        try {
            var jobs = new ArrayList<Callable<Void>>();
            for (int i=0;i<12;i++) jobs.add(() -> {
                assertThat(post("/visit",Map.of("visitorId",v))).isEqualTo(204);
                assertThat(post("/games",Map.of("visitorId",v,"gameId",g))).isEqualTo(204);
                assertThat(post("/games/"+g+"/finish",finish(v,"lost"))).isEqualTo(204); return null;
            });
            for (var result : pool.invokeAll(jobs)) result.get();
        } finally { pool.shutdownNow(); }
        var s = stats(); assertThat(s.get("visitors")).isEqualTo(4); assertThat(s.get("pageViews")).isEqualTo(15);
        assertThat(s.get("visitorsToday")).isEqualTo(1); assertThat(s.get("visitorsWeek")).isEqualTo(3);
        assertThat(s.get("gamesStarted")).isEqualTo(1); assertThat(s.get("gamesFinished")).isEqualTo(1);
    }
}
