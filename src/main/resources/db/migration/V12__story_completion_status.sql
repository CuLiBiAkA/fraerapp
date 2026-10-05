alter table stories add column completion_status varchar(24);
alter table stories add constraint stories_completion_status_check
    check (completion_status in ('completed', 'in_development', 'abandoned'));
