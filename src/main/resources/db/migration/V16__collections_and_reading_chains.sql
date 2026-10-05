alter table stories add column metadata_json text;
create table work_collections (
 id varchar(36) primary key,
 collection_key varchar(120) not null unique,
 collection_type varchar(16) not null check (collection_type in ('story','volume','cycle','catalog')),
 owner_player_id varchar(36) not null references players(id),
 draft_json text not null,
 draft_title varchar(200) not null,
 published_title varchar(200),
 draft_revision integer not null default 1,
 submitted_revision integer,
 published_revision integer,
 review_state varchar(24) not null default 'draft',
 visibility varchar(24) not null default 'private',
 decision_reason varchar(2000) not null default '',
 restricted boolean not null default false,
 generation integer not null default 1,
 created_at timestamp with time zone not null default current_timestamp,
 updated_at timestamp with time zone not null default current_timestamp
);
create index collection_owner on work_collections(owner_player_id,updated_at);
create index collection_queue on work_collections(review_state,updated_at);
create index collection_public_title on work_collections(visibility,published_title);
create table collection_versions (
 collection_id varchar(36) not null references work_collections(id),
 revision integer not null,
 document_json text not null,
 created_at timestamp with time zone not null default current_timestamp,
 primary key(collection_id,revision)
);
-- A single lock serializes structural writes across collections, including empty trees.
create table collection_structure_lock (id integer primary key);
insert into collection_structure_lock(id) values(1);
-- Reservations include both working and published structure, so a draft cannot steal
-- a child still included in a published revision. Derived only from version documents.
create table collection_memberships (
 parent_id varchar(36) not null references work_collections(id),
 target_kind varchar(16) not null,
 target_id varchar(36) not null,
 main_parent boolean not null,
 in_draft boolean not null,
 in_published boolean not null,
 primary key(parent_id,target_kind,target_id)
);
create index collection_member_target on collection_memberships(target_kind,target_id,main_parent);
create table collection_moderation_events (
 id varchar(36) primary key,
 collection_id varchar(36) not null references work_collections(id),
 revision integer,
 actor_id varchar(36) not null,
 action varchar(40) not null,
 reason varchar(2000) not null,
 internal_note varchar(2000) not null default '',
 created_at timestamp with time zone not null default current_timestamp
);
create table collection_favorites (
 player_id varchar(36) not null references players(id),
 collection_id varchar(36) not null references work_collections(id),
 primary key(player_id,collection_id)
);
create table collection_released_chapters (
 collection_id varchar(36) not null references work_collections(id),
 story_id varchar(36) not null references stories(id),
 primary key(collection_id,story_id)
);
alter table account_notifications add column collection_id varchar(36) references work_collections(id);
create table collection_runs (
 id varchar(36) primary key,
 player_id varchar(36) not null references players(id),
 collection_id varchar(36) not null references work_collections(id),
 collection_revision integer not null,
 generation integer not null default 1,
 request_id varchar(120) not null,
 created_at timestamp with time zone not null default current_timestamp,
 unique(player_id,request_id)
);
create index collection_runs_reader on collection_runs(player_id,collection_id,created_at);
create table chapter_transitions (
 id varchar(36) primary key,
 player_id varchar(36) not null references players(id),
 run_id varchar(36) references collection_runs(id),
 source_session_id varchar(36) references game_sessions(id),
 source_revision integer,
 policy_id varchar(120) not null,
 policy_revision integer not null,
 target_story_id varchar(36) not null references stories(id),
 target_revision integer not null,
 target_session_id varchar(36) not null unique references game_sessions(id),
 values_json text not null,
 request_id varchar(120) not null,
 created_at timestamp with time zone not null default current_timestamp,
 unique(player_id,request_id),
 unique(run_id,target_story_id)
);
create index chapter_transition_source on chapter_transitions(source_session_id,policy_id);
create table collection_run_saves (
 run_id varchar(36) not null references collection_runs(id),
 story_id varchar(36) not null references stories(id),
 session_id varchar(36) not null references game_sessions(id),
 primary key(run_id,story_id)
);
