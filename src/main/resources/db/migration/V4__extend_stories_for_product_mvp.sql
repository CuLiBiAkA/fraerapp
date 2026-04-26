alter table stories add column owner_player_id varchar(36);
alter table stories add column published_slug varchar(160);
alter table stories add column published_at timestamp with time zone;

create unique index uq_stories_published_slug on stories(published_slug);
create index idx_stories_owner_player on stories(owner_player_id);
create index idx_stories_published_at on stories(published_at);
