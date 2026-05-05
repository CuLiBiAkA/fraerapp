alter table stories add column archived_at timestamp with time zone;

create table story_versions (
	id varchar(36) primary key,
	story_id varchar(36) not null,
	version_number integer not null,
	status varchar(24) not null,
	snapshot_json clob not null,
	note varchar(120) not null,
	created_at timestamp with time zone not null,
	constraint fk_story_versions_story foreign key (story_id) references stories(id),
	constraint uq_story_versions_number unique (story_id, version_number)
);

create index idx_story_versions_story_created on story_versions(story_id, created_at desc);
