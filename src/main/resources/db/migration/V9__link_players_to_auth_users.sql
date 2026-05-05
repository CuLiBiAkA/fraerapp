alter table players add column user_id varchar(36);
create unique index uq_players_user_id on players(user_id);
create index idx_players_user_id on players(user_id);
