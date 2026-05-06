create index idx_stories_status_published_at on stories(status, published_at desc);
create index idx_stories_owner_updated on stories(owner_player_id, updated_at desc);

create index idx_game_sessions_player_updated on game_sessions(player_id, updated_at desc);
create index idx_game_sessions_player_story_updated on game_sessions(player_id, story_id, updated_at desc);
create index idx_game_sessions_story_status on game_sessions(story_id, status);
create index idx_game_sessions_story_updated on game_sessions(story_id, updated_at desc);

create index idx_assets_story on assets(story_id);
create index idx_scenes_story_order on scenes(story_id, order_index);
create index idx_choices_scene_order on choices(scene_id, order_index);
