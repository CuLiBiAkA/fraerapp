create table reader_ad_settings (
 id integer primary key,
 enabled boolean not null,
 interval_scenes integer not null check (interval_scenes between 1 and 100),
 title varchar(100) not null,
 body varchar(600) not null,
 link_url varchar(2000) not null,
 button_label varchar(60) not null,
 version integer not null,
 updated_by varchar(320),
 updated_at timestamp with time zone not null default current_timestamp
);
insert into reader_ad_settings(id,enabled,interval_scenes,title,body,link_url,button_label,version)
 values (1,true,5,'','','','',1);
create table reader_ad_progress (
 player_id varchar(36) primary key references players(id) on delete cascade,
 transitions integer not null default 0,
 pending_id varchar(36),
 settings_version integer not null
);
