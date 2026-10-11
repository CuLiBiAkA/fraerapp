# Architecture cleanup — 2026-10-11

## Scope and baseline

User requested a project-wide workaround audit and confirmed the target: improve
the existing architecture while preserving functionality and data. Baseline:
`main` at `2581cba`, no tracked edits, existing untracked `output/` preserved.
Changes are local until an explicit release is recorded. No production operations
have been performed. Auth V10 is an additive schema migration for the next release;
it does not rewrite existing user, token or session data.

Preserve story → chapters → scenes, immutable published revisions, generation
checks, moderation, existing IDs/routes/saves and schema-v1 imports. Legacy data
compatibility, active-session verification and explicit consent are deliberate
contracts. A new framework, payment provider or database redesign is out of scope.

## Corrections and owners

- [x] Browser authentication: one shared refresh coordinator for Reader, Builder,
  collections, workspaces, subscriptions and account dialogs; concurrent 401s
  share one refresh, recover a session refreshed by another tab and retry once.
  Remove the unreferenced client of retired player-ID endpoints.
- [x] API authentication: handle token verification failure at the servlet filter
  boundary, returning 401 so the browser can refresh instead of seeing 500.
- [x] Reader state: prohibit in-place reset of chain saves; existing chapter
  attempt/fork logic owns replay and transferred input preservation. Apply the
  same publication visibility to legacy listings and reader metadata.
- [x] Package import: return final generations/revisions after resolving forward
  links, removing the need for clients to reread every imported document.
- [x] Builder validation: one pure document validator used by the editor and tests;
  local scope, numeric wrappers/timers and fallback links use the actual document.
- [x] Admin invitations: validate and rate-limit before mutation, then persist
  account, roles, login link and audit atomically.
- [x] Documentation: replace conflicting README instructions with current entry
  points and one owner for the story format; update context and release checks.
- [x] Execute behavioral regressions, full Java/Node checks, affected browser
  journeys and independent review; distinguish initial mixed-copy failures from
  final verification below.

## Initial evidence

The existing 109 Node tests pass. Baseline Gradle API/auth tasks succeed with
cached results; final checks will execute changed suites. Read-only review found
two simultaneous collection requests caused two refresh calls and one false 401
despite a live session. Other identified cases are receiving focused regressions.

The old README repeats the story format in two languages and also describes
retired `/api/auth/login`, `X-Player-Id` and runtime H2. Runtime uses PostgreSQL,
current auth sessions and revision-based publication. Browser fixture results
must remain distinct from production or real-device verification.

## Integration boundaries and executed checks

A separate active task, “Доработать загрузку и конструктор”, changed this same
checkout during the audit: media preparation, Builder UI, guest catalogue, trash,
daily review quota and related tests. Its edits were preserved. No branch switch,
commit, push, deploy, JWT rotation or production data write was performed here.

- Full Node run: 146 tests passed on the combined working copy. Focused shared
  auth checks: 41 passed; validator/workflow checks: 51 passed. Syntax, production
  static validation and diff whitespace checks passed.
- HTTP token regressions reproduced 500 before the filter fix and pass with 401
  afterward for malformed, tampered and expired bearer/cookie credentials.
- The combined fresh Java run passed 64 auth checks before the lock-order followup;
  32 of 116 API checks failed: 30 hit the parallel task's new daily admission limit,
  two were its image-upload tests against then-unfinished implementation. This is
  not a passing combined release check.
- 18/20 existing Chromium suites passed. Unified catalogue fails its equal-height
  assertion under the other task's mobile auto-height/full-title CSS (confirmed
  after fonts settle and by substituting only baseline CSS in the browser).
  Author workspace fails uploading an eight-byte PNG signature, now rejected by
  the other task's image decoder. Neither test was weakened to hide these changes.
- API verification is additionally isolated in a temporary source snapshot of
  `2581cba` with only this audit's Java hunks/tests and versioned fixture data.
  The first attempt omitted fixture directories and failed five file reads;
  the corrected run passes **112/112 API tests**, zero failures/errors/skips.
  Snapshot: `/tmp/fraer-architecture-check-o4ngl3vb`; output:
  `/tmp/fraer-audit-api-isolated.log`. The working copy is untouched by isolation.
- PostgreSQL verification is outstanding: local Docker is stopped and no test
  PostgreSQL endpoint is configured. H2 PostgreSQL-mode tests do not establish
  production lock behavior or migration success. No Safari/device check is claimed.

## Independent review

The initial read-only review found one P1: the new invitation transaction retained
role/user locks while replacing tokens, opposite login verification's order.
The repair acquires hashed-email ownership before invitation, verification,
Telegram authorization or first account/bootstrap creation, then rechecks mutable
token/identity state inside that transaction. Different recipients remain
independent. User deletion shares that order to avoid waiting on a consumed token
while verification waits for its user. Unknown/expired tokens are rejected before
allocating lock state. Four controlled overlap regressions reproduced the earlier
ordering problems and pass after repair. The final complete auth suite passes
**69/69**, zero failures/errors/skips; auth migration V10 is unchanged.

The reviewer found no other actionable regression in the scoped refresh callers,
multipart replay/runtime capture, JWT filter, chapter reset/availability, import
generation response, validator delegation, retired client removal or version
references. The external task and production were outside that review.

Focused re-review of the lock-order repair: **specification pass; quality pass;
no actionable findings**. This is a static verdict. Actual PostgreSQL locking and
production behavior remain unverified; executed concurrency proof uses H2.

## Final integration

The parallel task corrected mobile card row sizing and updated the daily-quota
test fixtures. This audit replaced the two fake eight-byte PNG upload inputs in
`scripts/check-author-workspace.cjs` with an existing real image and explicit
image-preparation confirmation; saved references, ownership and stale-save
assertions remain intact. Both previously failing browser suites now pass in
RU/EN at 320/390/768/1440: **all 20 pre-existing browser suites pass** across the
aggregate run and these focused reruns. Additional new browser suites from the
other task are outside this claim.

The final combined `sh gradlew :auth-service:test :test --no-daemon` also succeeds.
Its API task executed against the updated mixed working copy; auth reused the
immediately preceding successful full 69-test run. Earlier failures above are
diagnostic history, not the final result. Final combined totals: **124 API + 69
auth tests**, zero failures/errors/skips; **151 Node tests passed** on the last
run. Syntax/lint, production static validation, documentation links and
`git diff --check` pass. Independent API-only snapshot: 112/112 passed.

Changes remain local on `main`, uncommitted, unpushed and undeployed. Existing
`output/` and the other task's edits were preserved. README, code map, project
context and deploy runbook were updated; private operator notes were unchanged.
