-- Admission survives withdrawal and moderation decisions. One work may be
-- updated repeatedly, but another work must wait 24 hours from admission.
create table author_review_admission (
 owner_player_id varchar(36) primary key references players(id),
 review_scope varchar(160) not null,
 admitted_at timestamp with time zone not null
);

-- Existing trash receives the full recovery period at migration time.
alter table stories add column deleted_at timestamp with time zone;
alter table work_collections add column deleted_at timestamp with time zone;
update stories set deleted_at=current_timestamp where visibility='deleted';
update work_collections set deleted_at=current_timestamp where visibility='deleted';
create index stories_trash_expiry on stories(visibility,deleted_at);
create index collections_trash_expiry on work_collections(visibility,deleted_at);
