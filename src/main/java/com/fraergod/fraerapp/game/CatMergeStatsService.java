package com.fraergod.fraerapp.game;

import java.sql.Timestamp;
import java.time.*;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Approximate browser telemetry, never an account record or a verified leaderboard. */
@Service
class CatMergeStatsService {
    private static final ZoneId ZONE = ZoneId.of("Europe/Kaliningrad");
    private final JdbcTemplate jdbc;
    CatMergeStatsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    void visit(String id) {
        Timestamp now = Timestamp.from(Instant.now());
        if (increment(id, now) == 0) {
            try { jdbc.update("INSERT INTO cat_merge_visitors VALUES (?, ?, ?, 1)", id, now, now); }
            catch (DuplicateKeyException concurrentFirstVisit) { increment(id, now); }
        }
    }
    private int increment(String id, Timestamp now) {
        return jdbc.update("UPDATE cat_merge_visitors SET last_seen = GREATEST(last_seen, ?), page_views = page_views + 1 WHERE visitor_id = ?", now, id);
    }
    void start(String visitorId, String gameId) {
        try {
            jdbc.update("INSERT INTO cat_merge_games (game_id, visitor_id, started_at) VALUES (?, ?, ?)", gameId, visitorId, Timestamp.from(Instant.now()));
        } catch (DuplicateKeyException repeatedStart) { requireGame(gameId, visitorId); }
    }
    private void requireGame(String gameId, String visitorId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM cat_merge_games WHERE game_id = ? AND visitor_id = ?", Integer.class, gameId, visitorId);
        if (count == null || count != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Game not found");
    }
    void finish(String gameId, CatMergeStatsController.Finish value) {
        // Basic bounds catch broken clients; public telemetry is not cheat-proof.
        if (value.merges() >= value.drops() || value.score() % 20 != 0
            || value.score() < value.merges() * 20L || value.score() > value.merges() * 2560L
            || (value.outcome().equals("won") != (value.highestLevel() == 8)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid result");
        String visitor = value.visitorId().toLowerCase(Locale.ROOT);
        requireGame(gameId, visitor);
        // The first terminal result wins, including concurrent duplicate finishes.
        jdbc.update("""
            UPDATE cat_merge_games SET finished_at = ?, outcome = ?, score = ?, drops = ?,
                merges = ?, highest_level = ?, duration_seconds = ?
            WHERE game_id = ? AND visitor_id = ? AND finished_at IS NULL
            """, Timestamp.from(Instant.now()), value.outcome(), value.score(), value.drops(), value.merges(),
            value.highestLevel(), value.durationSeconds(), gameId, visitor);
    }

    Stats stats() {
        LocalDate today = LocalDate.now(ZONE);
        Timestamp day = Timestamp.from(today.atStartOfDay(ZONE).toInstant());
        Timestamp week = Timestamp.from(today.minusDays(6).atStartOfDay(ZONE).toInstant());
        var audience = jdbc.queryForObject("""
            SELECT COUNT(*) visitors, COALESCE(SUM(page_views), 0) views,
              COUNT(CASE WHEN last_seen >= ? THEN 1 END) today,
              COUNT(CASE WHEN last_seen >= ? THEN 1 END) week, MIN(first_seen) first_visit
            FROM cat_merge_visitors
            """, (rs, row) -> new Audience(rs.getLong("visitors"), rs.getLong("views"), rs.getLong("today"), rs.getLong("week"),
                rs.getTimestamp("first_visit") == null ? null : rs.getTimestamp("first_visit").toInstant()), day, week);
        return jdbc.queryForObject("""
            SELECT COUNT(*) started,
              COUNT(CASE WHEN outcome IN ('won', 'lost') THEN 1 END) finished,
              COUNT(CASE WHEN outcome = 'won' THEN 1 END) won,
              COUNT(CASE WHEN outcome = 'lost' THEN 1 END) lost,
              COUNT(CASE WHEN outcome = 'restarted' THEN 1 END) restarted,
              COALESCE(MAX(CASE WHEN outcome IN ('won', 'lost') THEN score END), 0) best,
              COALESCE(AVG(CASE WHEN outcome IN ('won', 'lost') THEN CAST(score AS DOUBLE PRECISION) END), 0) average_score,
              COALESCE(AVG(CASE WHEN outcome IN ('won', 'lost') THEN CAST(duration_seconds AS DOUBLE PRECISION) END), 0) average_duration
            FROM cat_merge_games
            """, (rs, row) -> new Stats(audience.visitors(), audience.pageViews(), audience.today(), audience.week(), audience.first(), ZONE.getId(),
                rs.getLong("started"), rs.getLong("finished"), rs.getLong("won"), rs.getLong("lost"), rs.getLong("restarted"),
                rs.getLong("best"), rs.getDouble("average_score"), rs.getDouble("average_duration")));
    }
    private record Audience(long visitors, long pageViews, long today, long week, Instant first) {}
    record Stats(long visitors, long pageViews, long visitorsToday, long visitorsWeek, Instant firstVisitAt, String timeZone,
                 long gamesStarted, long gamesFinished, long gamesWon, long gamesLost, long gamesRestarted,
                 long bestScore, double averageScore, double averageDurationSeconds) {}
}
