create table users (
	id varchar(36) primary key,
	email varchar(320) not null unique,
	email_verified boolean not null,
	created_at timestamp with time zone not null,
	updated_at timestamp with time zone not null
);

create table roles (
	name varchar(40) primary key
);

create table user_roles (
	user_id varchar(36) not null,
	role_name varchar(40) not null,
	created_at timestamp with time zone not null,
	constraint pk_user_roles primary key (user_id, role_name),
	constraint fk_user_roles_user foreign key (user_id) references users(id),
	constraint fk_user_roles_role foreign key (role_name) references roles(name)
);

create table email_login_tokens (
	id varchar(36) primary key,
	email varchar(320) not null,
	token_hash varchar(128) not null unique,
	redirect_path varchar(500),
	expires_at timestamp with time zone not null,
	used_at timestamp with time zone,
	created_at timestamp with time zone not null
);

create table sessions (
	id varchar(36) primary key,
	user_id varchar(36) not null,
	created_at timestamp with time zone not null,
	expires_at timestamp with time zone not null,
	revoked_at timestamp with time zone,
	constraint fk_sessions_user foreign key (user_id) references users(id)
);

create table refresh_tokens (
	id varchar(36) primary key,
	session_id varchar(36) not null,
	token_hash varchar(128) not null unique,
	created_at timestamp with time zone not null,
	expires_at timestamp with time zone not null,
	revoked_at timestamp with time zone,
	replaced_by_token_id varchar(36),
	constraint fk_refresh_tokens_session foreign key (session_id) references sessions(id)
);

create table auth_audit_events (
	id varchar(36) primary key,
	user_id varchar(36),
	email varchar(320),
	event_type varchar(80) not null,
	metadata text not null,
	created_at timestamp with time zone not null
);

insert into roles(name) values ('player'), ('author'), ('admin');
