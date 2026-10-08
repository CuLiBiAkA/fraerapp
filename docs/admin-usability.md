# Admin usability redesign

Scope: `/auth/admin`, its existing account-management operations and navigation to
the separate moderation workspace. User request: examine every section and make
day-to-day administration convenient. Baseline: `7e0524e`, main; only output/
contains unrelated local notes. No database migration or authorization-policy change.

## Findings and intended behavior

| Existing section | Problem | Change / acceptance |
| --- | --- | --- |
| Entry and current session | Technical heading, role codes, long page before useful work | Clear identity and access state; Users opens first for an administrator; non-admin receives visible guidance and moderation link when permitted |
| Users | Eight columns, repeated button stacks, important details difficult to scan | Search and server-side role/status filters, compact rows/mobile cards, totals and stable pagination; one user details dialog holds metrics and account actions |
| Author requests | Fixed sidebar consumes content width; errors appear elsewhere | Dedicated queue with count, request time, search and grant action; success removes the request; failure stays alongside the action |
| Login requests | Looks like an approval queue; separate distant result | Name it Login history, explain what a record means; create/recover an account or delete the request with explicit consequences |
| Roles | Free-form email, internal names, misleading player-only option | Change roles for the selected user; human labels and explanation of each role; confirmation for privilege changes, including removal of all elevated roles |
| Manual link | Result appears in a different section; copying can fail silently | Single invitation/recovery form, selected identity prefilled, deliberate account creation and role choice, expiring link displayed in place with copy fallback; link is not stored in localStorage or logs |
| Message | Browser prompt, little space, no persistent draft on error | Dialog with recipient, multiline text, character count, retry retaining text and duplicate-submit prevention |
| Block/delete | Destructive actions compete with everyday actions | Separate danger area, explicit confirmation, type email before account deletion; current-account deletion disabled; backend last-admin protection remains authoritative |
| Passkeys and logout | Removal has no confirmation/error handling | Personal access section, understandable dates, pending/error states, named-device removal confirmation, recent-login guidance |
| Stories | Separate moderation system already exists | Persistent descriptive link to its existing workflow |

## Implementation and verification

Move the embedded HTML/CSS/JS out of the Java text block into an auth-service HTML
resource plus frontend admin-panel modules. Retire the old renderer in the same
change. Reuse the site's fonts, purple/cream palette and shared header. Native
dialogs provide keyboard focus and Escape; forms keep input on error. Async reads
ignore stale responses; searches debounce; background refresh does not replace an
open editor. Do not show raw server error bodies or pretend missing statistics are
zero. All privileged calls retain server-side admin/session checks.

Check actual browser journeys at 1440/768/390/320px, with long identifiers, empty
lists, loading/failure/retry, delayed out-of-order searches, pagination shrink,
role revocation, message delivery, link-copy fallback and destructive confirmation.
Use synthetic data only. Run auth/API and frontend tests, production validator and
git diff --check. Record deployment/commit state in project context and handoff.

Verified locally: 35 auth tests, 74 API tests (unchanged API tasks up-to-date),
71 frontend/Builder tests, production validator and syntax/diff checks. Browser
journeys pass at all four widths, including granting author requests, preserving
a different user's card/message while an earlier write finishes, discarding a
late invitation link after navigation, recent-auth guidance and self-block logout.
Desktop/mobile list and user-card screenshots were visually reviewed. Independent
code review found no remaining blockers after the async/access fixes. No production
accounts were changed. Release/deployment state is tracked in PROJECT_CONTEXT.md
and DEPLOY_RUNBOOK.md.
