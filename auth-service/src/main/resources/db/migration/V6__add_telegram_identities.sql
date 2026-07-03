create table telegram_identities (
	telegram_user_id bigint primary key,
	telegram_chat_id bigint not null,
	user_id varchar(36) not null unique,
	username varchar(128),
	created_at timestamp with time zone not null,
	updated_at timestamp with time zone not null,
	last_seen_at timestamp with time zone not null,
	constraint fk_telegram_identities_user foreign key (user_id) references users(id)
);

create index idx_telegram_identities_user on telegram_identities(user_id);
