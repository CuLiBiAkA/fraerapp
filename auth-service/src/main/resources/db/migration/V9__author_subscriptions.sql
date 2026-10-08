create table author_subscriptions (
 user_id varchar(36) primary key references users(id) on delete cascade,
 plan_id varchar(40) not null,
 started_at timestamp with time zone not null,
 expires_at timestamp with time zone not null,
 revoked_at timestamp with time zone,
 version integer not null default 1
);
create table subscription_orders (
 id varchar(36) primary key,
 user_id varchar(36) not null references users(id) on delete cascade,
 request_id varchar(36) not null,
 plan_id varchar(40) not null,
 status varchar(40) not null,
 price_minor bigint not null,
 amount_minor bigint not null,
 currency varchar(3) not null,
 created_at timestamp with time zone not null,
 period_end timestamp with time zone not null,
 unique(user_id,request_id)
);
create table subscription_events (
 id varchar(36) primary key,
 user_id varchar(36) not null references users(id) on delete cascade,
 actor_id varchar(36) not null,
 action varchar(40) not null,
 reason varchar(500) not null,
 created_at timestamp with time zone not null
);
create index idx_subscription_orders_user on subscription_orders(user_id,created_at);
create index idx_subscription_events_user on subscription_events(user_id,created_at);
create view effective_user_roles as
 select user_id,role_name from user_roles
 union
 select user_id,'author' as role_name from author_subscriptions
 where revoked_at is null and expires_at > current_timestamp;
