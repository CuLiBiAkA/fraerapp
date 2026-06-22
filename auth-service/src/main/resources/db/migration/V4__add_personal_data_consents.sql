create table personal_data_consents (
	id varchar(36) primary key,
	email varchar(320) not null,
	policy_version varchar(40) not null,
	source varchar(80) not null,
	accepted_at timestamp with time zone not null,
	revoked_at timestamp with time zone
);

create index idx_personal_data_consents_email_accepted
	on personal_data_consents(email, accepted_at desc);
