# Telegram profile and account notifications

Task started 2026-10-15 on main at 1427c9d. Only pre-existing untracked output/
was present; preserve it. Work is local until explicitly released.

User confirmed: save Telegram @username; mirror the notifications already shown
on the website into the user's private bot chat.

- Auth owns the stable Telegram ID binding, first/last name, username and delivery
  preference. Auth responses expose names to the shared account dialogs. Keep the
  internal synthetic email and all existing account/session/ownership IDs.
- API scans newly created account_notifications with persistent delivery state.
  Existing notices are marked skipped by migration to avoid a historical flood.
  A read or deleted website notice must not be recreated by delivery.
- API calls an internal authenticated auth endpoint. Auth owns the bot credential,
  checks account/consent/preferences and records successful delivery IDs. Site
  operations and Telegram login do not wait on this worker.
- Retry transient failures with bounded backoff; honor Telegram retry_after.
  Duplicate requests after a successful receipt are suppressed. Telegram has no
  sendMessage idempotency key: an ambiguous network failure/crash after acceptance
  can still duplicate a message. Do not claim exactly-once delivery.
- API claims a notice for 60 seconds; auth claims its delivery receipt for 30
  seconds. Database transactions finish before network I/O. Concurrent workers
  and HTTP retries see the committed leases. Attempts fence late completions.
- Reuse AccountService's availability expression and joins before delivery;
  story text receives the same Russian label as the inbox. A message already
  in flight can finish after opt-out or deletion.
- Enable delivery with a separate shared service secret and an explicit runtime
  flag. Verify outbound Telegram connectivity before production activation.
- Tests: profile update/no-username/identity preservation, authenticated preference,
  all existing notice kinds, migration history, retries, duplicate requests,
  disabled/blocked/unlinked users, secret validation, UI states and baseline suites.

No new public profile directory, custom site username, avatar import or browser
push is requested. Notification content remains owned by existing site events.

Independent review identified long network-held row locks and missing inbox
availability masking. Both were corrected with regression tests for concurrent
claims, preference updates/deletion during a stalled send, and hidden titles.

Final local verification: 144 API tests, 78 auth tests and 54 baseline/profile Node
tests pass. Telegram profile/preference browser checks pass in RU/EN at 320, 390
and 1440px, including long names and failed saves. Existing notification checks
pass at those widths; shared settings/account checks pass across eleven pages at
320/390/768/1440px. Syntax, production validator and git diff --check pass. The
follow-up independent review found no remaining material defects. PostgreSQL
concurrency and actual production Telegram connectivity/delivery were not exercised.
No real user messages were sent. Existing output/ is preserved.

Release authorized by the user. Preflight confirms six healthy production services,
no recent API/auth/edge error-like lines, public endpoints 200 and all 22 changed
existing runtime files matching the source baseline. Direct Telegram HTTPS times
out on IPv4 and IPv6 has no route; ordinary external HTTPS works. Deploy the code
and migrations with delivery disabled until outbound Telegram connectivity is
restored. Do not show delivery as available or send real-user smoke messages.
