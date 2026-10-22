package com.fraergod.fraerapp.game;

import java.sql.Timestamp;
import java.time.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Isolated experiment counters: no accounts, IP addresses or story events. */
@Service
class MeowStatsService {
    private final JdbcTemplate jdbc;
    private static final ZoneId ZONE = ZoneId.of("Europe/Kaliningrad");

    MeowStatsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    void visit(String visitorId) {
        Timestamp now = Timestamp.from(Instant.now());
        if (increment(visitorId, now) == 0) {
            try {
                jdbc.update("INSERT INTO meow_visitors(visitor_id, first_seen, last_seen, page_views) VALUES (?, ?, ?, 1)", visitorId, now, now);
            } catch (DuplicateKeyException concurrentFirstVisit) {
                // Another tab inserted this browser between UPDATE and INSERT.
                increment(visitorId, now);
            }
        }
    }

    private int increment(String id, Timestamp now) {
        return jdbc.update("UPDATE meow_visitors SET last_seen = GREATEST(last_seen, ?), page_views = page_views + 1 WHERE visitor_id = ?", now, id);
    }

    Stats stats() {
        LocalDate today = LocalDate.now(ZONE);
        Timestamp day = Timestamp.from(today.atStartOfDay(ZONE).toInstant());
        Timestamp week = Timestamp.from(today.minusDays(6).atStartOfDay(ZONE).toInstant());
        return jdbc.queryForObject("""
            SELECT COUNT(*) AS visitors, COALESCE(SUM(page_views), 0) AS views,
              COUNT(CASE WHEN last_seen >= ? THEN 1 END) AS today,
              COUNT(CASE WHEN last_seen >= ? THEN 1 END) AS week,
              MIN(first_seen) AS first_visit
            FROM meow_visitors
            """, (rs, row) -> new Stats(rs.getLong("visitors"), rs.getLong("views"),
                rs.getLong("today"), rs.getLong("week"),
                rs.getTimestamp("first_visit") == null ? null : rs.getTimestamp("first_visit").toInstant(), ZONE.getId()), day, week);
    }

    record Stats(long visitors, long pageViews, long visitorsToday, long visitorsWeek, Instant firstVisitAt, String timeZone) {}
}
