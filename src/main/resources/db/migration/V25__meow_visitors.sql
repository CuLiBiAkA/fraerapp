CREATE TABLE meow_visitors (
    visitor_id VARCHAR(36) PRIMARY KEY,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    page_views BIGINT NOT NULL DEFAULT 1
);
CREATE INDEX meow_visitors_last_seen_idx ON meow_visitors(last_seen);
