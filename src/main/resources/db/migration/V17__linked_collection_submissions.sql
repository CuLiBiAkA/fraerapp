-- Exact review dependencies are separate from structural references: a later child
-- submission must not silently rewrite the batch originally sent for review.
create table collection_review_dependencies (
 collection_id varchar(36) not null,
 collection_revision integer not null,
 target_kind varchar(16) not null check (target_kind in ('scenario','collection')),
 target_id varchar(36) not null,
 requested_revision integer not null,
 batch_id varchar(36) not null,
 created_at timestamp with time zone not null default current_timestamp,
 primary key(collection_id,collection_revision,target_kind,target_id),
 foreign key(collection_id,collection_revision) references collection_versions(collection_id,revision)
);
create index collection_requested_revision on collection_review_dependencies(target_kind,target_id,requested_revision);
