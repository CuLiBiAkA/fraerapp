create table reader_endings (
    player_id varchar(36) not null references players(id) on delete cascade,
    story_id varchar(36) not null references stories(id) on delete cascade,
    scene_key varchar(120) not null,
    primary key (player_id, story_id, scene_key)
);
insert into reader_endings(player_id, story_id, scene_key)
select distinct player_id, story_id, ending_scene_key from game_sessions
where status='FINISHED' and ending_scene_key is not null;

-- Classification explicitly supplied by the owner for the current demo stories.
update stories set completion_status='completed'
where story_key in ('kak_shodit_v_tualet_pravilno', 'kak_pogladit_kota_ne_ubiv', 'night_train');
update stories set completion_status='in_development' where title='Новая история';
