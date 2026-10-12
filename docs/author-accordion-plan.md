# Author story accordion — approved 2026-10-12

## Goal and authority
Implement the approved purple/light-panel mockup: one story per row, inline
expansion, chapter states/actions and moderator comments. Approval is distinct
from author-controlled publication. User approved implementation and deployment.
Baseline: main 0ca3aa0; preserve output/. Existing Java/Spring API and vanilla JS.

## Architecture and compatibility
Keep collection-workspace as the owner of serial-story editing, existing shared
navigation/dialogs and private playtest renderer. Reuse immutable moderation
revisions and account notifications. No fictional comments/unread counts.
Keep old deep links, JSON, reader saves and published snapshots working.

## Steps
1. Server: revision/generation-checked author publication, including approved
   parent contents, preceding chapter availability and ownership. Lock draft writes
   during review. Moderation defaults to approval without automatic publication.
2. UI: inline single-column cards; compact chapters with state-specific actions;
   comments and explicit notification reads; secondary fields under details.
3. Preview: device-width controls around existing private reader.
4. Verify state transitions, permissions, unchanged revisions, stale requests,
   accordion navigation/unsaved edits, mobile layout and private playtests.
5. Update context/runbook; back up, deploy tested files/services and check health.

## Verification
Targeted API regression tests plus full API/auth tests and relevant Node/browser
suites. Inspect desktop/phone screenshots. Stop release on unexplained remote
source drift. Keep deployed/committed/pushed state explicit in final handoff.

## Implementation and verification receipt

Implemented single-column inline cards, chapter states/actions, real moderation
comments and explicit notification reads. Search/import tools are collapsible.
The private preview wrapper offers desktop/tablet/phone widths and retains the
existing private replay engine. Approval no longer publishes a grouped application;
author publication checks ownership, generation and the exact approved revision.
Draft edits and rollback are rejected while a chapter is under review.

Local checks before the concurrent publication-lock followup: 130 API tests,
69 auth tests, 150 Node tests; eight RU/EN author-workspace browser cases,
four accordion state/notification/device cases, four trash/preview-link cases,
and six scenario/serial private-replay cases. Production validator and diff checks
pass. Screenshots inspected at phone and desktop sizes. Browser responses use
isolated fixtures; no real author content or moderation decision was changed.

Production preflight: six healthy services, no recent API/auth/edge errors, all
changed runtime files match baseline HEAD. Backup `backups/accordion-20261012-161848`
contains validated database dumps, prior files and rollback image tags.
Release is staged only; no running service has been switched by this task.

## Coordinated followup, not yet released

Task “Объяснить модерацию для автора” reports a newer explicit user rule:
published chapters are locked unless a moderator requests a correction with a
required comment, followed by another review. Its owner is implementing this in
the same checkout. Final build/deployment must include that change; the staged
accordion artifact predates it. Do not deploy an old JAR over the combined source.
That owner was also notified to preserve author publication for schema-1 parents
(chapter ordering applies only to schema-2 serial stories).

## Combined release candidate

The correction workflow is integrated and the source is frozen. Final Java:
137 API + 69 auth tests, no failures. The correction owner reports 155 Node tests,
four new correction browser cases and independent review with no outstanding P1/P2.
The availability bypass found during review is fixed: an approved correction cannot
republish a hidden/archived chapter without explicit moderator restoration.

Updated `check-review-limit.cjs` to refresh eligibility on window focus while
preserving unsaved input. Updated `check-serial-stories.cjs` to open chapter
settings and assert the new review action/state. Both pass on all four cases.
Combined accordion (four widths) and author workspace (eight RU/EN cases) pass;
private replay has eight scenario/serial cases. Fresh Java 17 bootJar built from
the final frozen source. Production baseline matches; final staging and release
receipt will supersede the earlier unused staging backup above.
