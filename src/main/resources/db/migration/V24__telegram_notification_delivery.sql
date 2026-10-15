alter table account_notifications add column telegram_status varchar(16) not null default 'pending';
alter table account_notifications add column telegram_attempts integer not null default 0;
alter table account_notifications add column telegram_next_attempt_at timestamp with time zone not null default current_timestamp;
-- Only new site events should be delivered; never flood existing users on rollout.
update account_notifications set telegram_status='skipped';
create index account_notifications_telegram_pending on account_notifications(telegram_status,telegram_next_attempt_at);
