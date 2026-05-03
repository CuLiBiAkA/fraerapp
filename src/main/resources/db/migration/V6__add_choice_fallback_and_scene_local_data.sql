alter table choices add column fallback_target_scene_key varchar(120);

alter table scenes add column local_variables_json clob not null default '{}';
alter table scenes add column local_assets_json clob not null default '[]';
