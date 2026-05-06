create table stories (
	id varchar(36) primary key,
	story_key varchar(120) not null unique,
	title varchar(200) not null,
	description text,
	version integer not null,
	status varchar(24) not null,
	start_scene_id varchar(120) not null,
	variables_json text not null,
	created_at timestamp with time zone not null,
	updated_at timestamp with time zone not null
);

create table assets (
	id varchar(36) primary key,
	story_id varchar(36) not null,
	asset_key varchar(120) not null,
	type varchar(24) not null,
	url varchar(500) not null,
	metadata_json text not null,
	constraint fk_assets_story foreign key (story_id) references stories(id),
	constraint uq_assets_story_key unique (story_id, asset_key)
);

create table scenes (
	id varchar(36) primary key,
	story_id varchar(36) not null,
	scene_key varchar(120) not null,
	title varchar(200) not null,
	text text not null,
	background_asset_id varchar(120),
	music_asset_id varchar(120),
	animation_json text not null,
	effects_json text not null,
	ending_json text not null,
	order_index integer not null,
	constraint fk_scenes_story foreign key (story_id) references stories(id),
	constraint uq_scenes_story_key unique (story_id, scene_key)
);

create table choices (
	id varchar(36) primary key,
	scene_id varchar(36) not null,
	choice_key varchar(120) not null,
	label varchar(240) not null,
	target_scene_key varchar(120) not null,
	conditions_json text not null,
	effects_json text not null,
	order_index integer not null,
	constraint fk_choices_scene foreign key (scene_id) references scenes(id),
	constraint uq_choices_scene_key unique (scene_id, choice_key)
);

create table game_sessions (
	id varchar(36) primary key,
	player_id varchar(36) not null,
	story_id varchar(36) not null,
	current_scene_key varchar(120) not null,
	variables_json text not null,
	status varchar(24) not null,
	ending_scene_key varchar(120),
	created_at timestamp with time zone not null,
	updated_at timestamp with time zone not null,
	constraint fk_sessions_player foreign key (player_id) references players(id),
	constraint fk_sessions_story foreign key (story_id) references stories(id)
);
