create index idx_users_email_lower on users(lower(email));
create index idx_users_blocked_at on users(blocked_at);

create index idx_email_login_tokens_email_created on email_login_tokens(email, created_at desc);
create index idx_email_login_tokens_expires on email_login_tokens(expires_at);

create index idx_sessions_user_expires on sessions(user_id, expires_at);
create index idx_sessions_user_revoked on sessions(user_id, revoked_at);

create index idx_refresh_tokens_session_expires on refresh_tokens(session_id, expires_at);
create index idx_refresh_tokens_expires on refresh_tokens(expires_at);

create index idx_auth_audit_events_user_created on auth_audit_events(user_id, created_at desc);
create index idx_auth_audit_events_email_created on auth_audit_events(email, created_at desc);
