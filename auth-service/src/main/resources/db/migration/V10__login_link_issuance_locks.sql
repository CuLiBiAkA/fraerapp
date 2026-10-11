-- Serialize link replacement even before an account exists. Retain coordination
-- rows: deleting a row while another issuer waits could split the lock owner.
create table login_link_issuance_locks (
	email_hash varchar(64) primary key
);
