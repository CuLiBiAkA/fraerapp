alter table stories add column genre varchar(80);
create table story_views (
 story_id varchar(36) not null references stories(id) on delete cascade,
 viewer_key varchar(80) not null,
 viewed_on date not null,
 primary key (story_id, viewer_key, viewed_on)
);
create table story_favorites (
 story_id varchar(36) not null references stories(id) on delete cascade,
 user_id varchar(36) not null,
 primary key (story_id, user_id)
);
create table story_ratings (
 story_id varchar(36) not null references stories(id) on delete cascade,
 user_id varchar(36) not null,
 score integer not null check (score between 1 and 5),
 primary key (story_id, user_id)
);
