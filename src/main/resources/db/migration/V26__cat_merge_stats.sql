CREATE TABLE cat_merge_visitors (
    visitor_id VARCHAR(36) PRIMARY KEY,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    page_views BIGINT NOT NULL DEFAULT 1 CHECK (page_views > 0)
);
CREATE INDEX cat_merge_visitors_last_seen_idx ON cat_merge_visitors(last_seen);

-- Starts can arrive even when a page-view request was blocked or lost.
CREATE TABLE cat_merge_games (
    game_id VARCHAR(36) PRIMARY KEY,
    visitor_id VARCHAR(36) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    outcome VARCHAR(16) CHECK (outcome IN ('lost', 'won', 'restarted')),
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    drops INTEGER NOT NULL DEFAULT 0 CHECK (drops >= 0),
    merges INTEGER NOT NULL DEFAULT 0 CHECK (merges >= 0),
    highest_level INTEGER NOT NULL DEFAULT 0 CHECK (highest_level BETWEEN 0 AND 8),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 86400)
);
