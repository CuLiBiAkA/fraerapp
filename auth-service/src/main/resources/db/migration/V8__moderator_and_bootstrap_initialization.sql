insert into roles(name) values ('moderator');

-- Bootstrap is a one-time setup action, not a role policy applied at every login.
-- Keep the marker after account deletion so configuration cannot recreate privileges.
create table bootstrap_admin_initializations (
	email varchar(320) primary key,
	initialized_at timestamp with time zone not null
);

-- Existing accounts are already managed; deploying this change must not alter them.
insert into bootstrap_admin_initializations(email, initialized_at)
select email, current_timestamp from users;
