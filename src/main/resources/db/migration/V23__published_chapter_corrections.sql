-- Published text stays locked unless an independent moderator requests a correction.
-- Old drafts/reviews do not grant permission; immutable revisions and audit stay intact.
alter table story_workspaces add column correction_revision integer;
alter table story_workspaces add column correction_reason text not null default '';
