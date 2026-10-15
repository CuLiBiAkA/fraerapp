alter table telegram_identities add column first_name varchar(128);
alter table telegram_identities add column last_name varchar(128);
alter table telegram_identities add column profile_message_id bigint not null default 0;
alter table telegram_identities add column notifications_enabled boolean not null default true;

create table telegram_notification_receipts (
 notification_id varchar(36) primary key,
 user_id varchar(36) not null references users(id) on delete cascade,
 status varchar(16) not null default 'pending',
 attempt integer not null default 0,
 lease_until timestamp with time zone not null default current_timestamp,
 delivered_at timestamp with time zone
);
