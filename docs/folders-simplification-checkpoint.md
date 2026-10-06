# Public folders correction

Follow-up 2026-10-06: the owner requested ordinary folders, without literal volume
or cycle types. Work on main from baeab00 preserves the same unrelated edits.
Removed UI kind/filter/rank rules; all legacy storage types behave identically.
Folders contain own stories and folders, one parent per item, arbitrary named
nesting with cycle protection. Forward package references resolve atomically;
reader saves only concern direct scenarios. Existing grouped review and transfers
remain. No schema/history rewrite. Tests cover deep same-kind nesting, grouped
publication, mixed reading and cyclic imports. Prior commit/deploy authorization
continues; no push. PostgreSQL: 27 folder tests passed, plus the notification
regression after removing its last legacy-type condition. Frontend: 70 tests and
browser fixtures at 1440/390/320px passed; no literary type selectors, nested folder
selection works, and owner-only/mapped reading/group moderation checks remain green.
The temporary database/tunnel were removed. Final full API/auth suites and bootJar
passed (69 API, 33 auth); production validator, JS syntax and diff checks passed.
Release status will be recorded after verification.

User correction 2026-10-06: collections must behave like folders for grouping
the author's own works. Foreign story/folder references must be forbidden. User
selected public folders and one expandable moderation application containing the
folder and new/changed chapters; unchanged approved chapters are not reviewed again.

## TaskStartSnapshot

Main at f7c6ba2, nine commits ahead of origin/main. Production release 39f41f7,
V17. Preserve pre-existing dirty legal HTML pages, story-builder/board.html,
untracked home artwork and scripts/preview-frontend.py. No task edits existed at
start. Prior implementation/deploy/commit authorization continues for this correction;
no push. No deletion of user content or revision/save history.

## Agreed plan

1. Restrict linking/grouping to owned scenarios and folders in selectors and server
   validation (including raw JSON, imports and publication). Preserve normal reader
   access to others' published works. Add ownership regressions.
2. Present one folder tree in the author workspace: create folder, add own works,
   reorder, edit chapter, send for review. Keep transfer contracts behind additional
   settings. Avoid keys/revision numbers/dependency terminology in the main flow.
3. Present one expandable moderation group for a folder with pending descendants.
   Show unchanged published children as context. Reuse existing immutable snapshots,
   permission checks, audits and stale-decision protection; no new workflow/table.
   Enable an explicit atomic decision on the reviewed pending parts, with exact
   revision/generation checks and no implicit approval of unreviewed drafts.
4. Reader sees public folders and contents, with existing independent/mapped reading
   preserved. No duplicate foreign-content catalogs or public private content.
5. Verify API ownership/grouping/decision regressions, frontend tests and browser
   folder workflow; review requirements then quality. Update project context and
   runbook, commit task-owned changes, backup/deploy/verify, record receipt.

Backend implementer owns Java/tests only; coordinator owns frontend/docs/tests,
Git and deployment. TDD off; targeted regression evidence required. Use existing
services and tables. Stop adding scope beyond this correction.

Implemented: owner-only references and selectors; default author/moderator folder
tree; one send action and one expandable grouped moderation application; exact
atomic decisions via existing workflow; older published parts stay unchanged.
Advanced JSON/revision/transfer details are collapsed. Direct story/list views
remain available. Explicit resubmission renews superseded dependency pins without
rewriting immutable history. No schema changes.

Evidence: 66 API, 33 auth and 70 frontend/Builder tests passed; final browser fixture
passed at 1440/390/320px including stale-decision and self-review safeguards.
Isolated PostgreSQL24 suite passed with zero failures. Requirement review PASS;
quality review PASS. Final full backend run and bootJar passed; artifact SHA-256
87ef78e1b226b3df295ef0aed5d226bfbcfcf9feba960776301d7c09c739d57e.
Production inspected: six healthy services, no recent API/auth errors, 3 guest demos
and 0 pre-existing folders. Manifests stored privately.
Disposable PostgreSQL and tunnel removed after all tests.

Complete: correction committed as 782ab67 and deployed, with verified backup and
restricted receipt in backups/folders-20261006-092158. Six healthy services,
readiness UP, V17 unchanged, exact runtime/public hashes, zero recent API/auth
errors, preserved story/folder manifests and guest policy; anonymous private folder
endpoints denied. Release documentation committed after verification. No push.
No task-owned source changes remain uncommitted; unrelated baseline edits preserved.
