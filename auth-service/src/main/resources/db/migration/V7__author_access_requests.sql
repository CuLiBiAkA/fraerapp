create table author_access_requests (
 user_id varchar(36) primary key references users(id) on delete cascade,
 requested_at timestamp with time zone not null
);
