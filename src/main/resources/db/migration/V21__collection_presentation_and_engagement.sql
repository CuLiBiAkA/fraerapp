alter table work_collections add column published_at timestamp with time zone;
alter table work_collections add column published_updated_at timestamp with time zone;

-- Use publication events, never the mutable draft timestamp. Unknown historical dates stay null.
update work_collections set published_at = (
 select min(e.created_at) from collection_moderation_events e
 where e.collection_id = work_collections.id and e.action in ('approve-publish','publish-approved')
), published_updated_at = (
 select max(e.created_at) from collection_moderation_events e
 where e.collection_id = work_collections.id and e.revision = work_collections.published_revision
 and e.action in ('approve-publish','publish-approved')
) where published_revision is not null;

create table collection_views (
 collection_id varchar(36) not null references work_collections(id),
 player_id varchar(36) not null references players(id),
 viewed_on date not null,
 primary key(collection_id,player_id,viewed_on)
);
create table collection_ratings (
 collection_id varchar(36) not null references work_collections(id),
 player_id varchar(36) not null references players(id),
 score integer not null check (score between 1 and 5),
 primary key(collection_id,player_id)
);
create index collection_public_updated on work_collections(visibility,published_updated_at);
create index collection_runs_work_revision on collection_runs(collection_id,collection_revision);
