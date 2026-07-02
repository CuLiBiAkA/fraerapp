alter table sessions add column auth_method varchar(32) not null default 'legacy';
alter table sessions add column authenticated_at timestamp with time zone;

create table passkey_credentials (
	credential_id varchar(1024) primary key,
	user_id varchar(36) not null,
	user_handle varchar(128) not null,
	public_key_cose text not null,
	signature_count bigint not null default 0,
	backup_eligible boolean not null default false,
	backup_state boolean not null default false,
	display_name varchar(120) not null,
	created_at timestamp with time zone not null,
	last_used_at timestamp with time zone,
	constraint fk_passkey_credentials_user foreign key (user_id) references users(id)
);

create index idx_passkey_credentials_user on passkey_credentials(user_id);
create index idx_passkey_credentials_user_handle on passkey_credentials(user_handle);

create table passkey_challenges (
	id varchar(36) primary key,
	ceremony_type varchar(24) not null,
	user_id varchar(36),
	request_json text not null,
	created_at timestamp with time zone not null,
	expires_at timestamp with time zone not null,
	used_at timestamp with time zone,
	constraint fk_passkey_challenges_user foreign key (user_id) references users(id)
);

create index idx_passkey_challenges_expires on passkey_challenges(expires_at);
