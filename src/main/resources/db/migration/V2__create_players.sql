create table players (
	id varchar(36) primary key,
	username varchar(80) not null unique,
	current_node_id varchar(80) not null,
	created_at timestamp with time zone not null,
	updated_at timestamp with time zone not null
);
