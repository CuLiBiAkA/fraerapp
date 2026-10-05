alter table stories add column visibility varchar(24) not null default 'private';
alter table stories add column published_revision integer;
alter table game_sessions add column story_revision integer;
alter table account_notifications add column revision integer;
alter table account_notifications add column reviewer_id varchar(36);

create table story_workspaces (
 story_id varchar(36) primary key references stories(id),
 draft_json text not null,
 draft_revision integer not null,
 submitted_revision integer,
 review_state varchar(24) not null default 'draft',
 decision_reason varchar(2000) not null default '',
 submitted_at timestamp with time zone,
 decided_at timestamp with time zone,
 reviewer_id varchar(36),
 restricted boolean not null default false,
 generation integer not null default 1
);
create table story_moderation_events (
 id varchar(36) primary key,
 story_id varchar(36) not null references stories(id),
 revision integer,
 actor_id varchar(36) not null,
 actor_role varchar(24) not null,
 action varchar(40) not null,
 reason varchar(2000) not null,
 internal_note varchar(2000) not null default '',
 before_state varchar(80) not null,
 after_state varchar(80) not null,
 created_at timestamp with time zone not null default current_timestamp
);
create index story_moderation_queue on story_workspaces(review_state, submitted_at);
create index story_moderation_history on story_moderation_events(story_id,created_at);
