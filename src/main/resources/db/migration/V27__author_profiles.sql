create table author_profiles (
 player_id varchar(36) primary key references players(id),
 nickname varchar(60) not null default '',
 biography varchar(1200) not null default '',
 avatar varchar(500) not null default '',
 links_json text not null default '[]'
);
create table author_favorites (
 reader_id varchar(36) not null references players(id),
 author_id varchar(36) not null references players(id),
 primary key(reader_id,author_id)
);
