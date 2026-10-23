create table admin_registration_baseline (
    id integer primary key check (id = 1),
    started_at timestamp with time zone not null default current_timestamp
);
insert into admin_registration_baseline(id) values (1);

create table admin_registration_reads (
    admin_id varchar(36) not null references users(id) on delete cascade,
    user_id varchar(36) not null references users(id) on delete cascade,
    read_at timestamp with time zone not null default current_timestamp,
    primary key (admin_id, user_id)
);
