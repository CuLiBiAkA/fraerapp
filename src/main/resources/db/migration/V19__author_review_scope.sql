-- Keep a pending chapter attached to its submitted story even if its draft moves.
alter table story_workspaces add column review_scope varchar(100);
alter table work_collections add column review_scope varchar(100);
