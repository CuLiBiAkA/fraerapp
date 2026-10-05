create table account_preferences (
 user_id varchar(36) primary key,
 avatar varchar(8) not null check (avatar in ('fairy', 'fae'))
);
create table account_notifications (
 id varchar(36) primary key,
 user_id varchar(36) not null,
 kind varchar(16) not null,
 message varchar(2000) not null,
 story_id varchar(36) references stories(id) on delete cascade,
 created_at timestamp with time zone not null default current_timestamp,
 read_at timestamp with time zone
);
create index account_notifications_user on account_notifications(user_id, created_at);
create table story_release_scenes (
 story_id varchar(36) not null references stories(id) on delete cascade,
 scene_key varchar(120) not null,
 primary key(story_id, scene_key)
);
insert into story_release_scenes(story_id,scene_key)
 select sc.story_id,sc.scene_key from scenes sc join stories s on s.id=sc.story_id where s.published_at is not null;
