# Chapters implementation checkpoint

User authorized implementation, commit and production deployment on 2026-10-06.
Requirements: `docs/prompts/story-chapters-collections-codex.md`; both independent
and mapped-state reading modes are required. Deployment authorization supersedes
the original prompt's local-only limit. No user request to push has been made.

## Baseline

- Main at `ddbf98781224408d399178f022a9c4be8cb9e769`, seven commits ahead of tracking upstream.
- Existing unrelated edits: three legal HTML pages, `story-builder/board.html`;
  untracked home artwork and `scripts/preview-frontend.py`. Preserve these.
- Existing prompt belongs to this task. No active Git operation; one main checkout.
- Existing moderation uses immutable story revisions; saves pin story_revision.
- References read: AGENTS, project context, deployment runbook, current workflow,
  access policy, account notifications, frontend workspace and Builder seams.

## Execution

1. Backend: versioned collections, ownership/review/access, typed links, package
   exchange, reading chains and validated state transfer; integration tests.
2. UI: collection workspace and moderation, Builder metadata editor, reader TOC,
   chain/continuation controls, catalog/favorites; targeted frontend/browser tests.
3. Independent requirement review then quality review; fix findings.
4. Full relevant API/auth/frontend tests, migration/concurrency checks on isolated
   PostgreSQL, production validator, diff check; update context/runbook.
5. Commit task-owned files; backup runtime and DB; deploy verified artifacts;
   verify service health, public/private APIs, asset hashes and sanitized logs.

Backend implementer owns Java/SQL/tests only; coordinator owns JS/HTML/CSS,
integration, documentation, Git and deployment. No concurrent shared-file writers.
TDD mode off; meaningful regression/integration tests required before release.

## Change and complexity boundary

New persistent grouping and cross-scenario state cannot be delivered through
configuration alone. Add cohesive collection/reading owners; keep existing large
GameService, StoryWorkflowService, engine.js and Builder app changes to explicit
integration seams. Reuse publication policy and existing styles. Preserve old JSON,
IDs, owners, URLs, saves, review state and metrics. No new external dependencies.

## Current checkpoint

Implemented: versioned collections and metadata contracts, both transfer modes,
package preview/import/export, personal reading chains and replay branches,
author/moderator workspaces, reader catalog/TOC/navigation/favorites, notices.
Requirements review passed. Quality review found four P2 cases (nullable metadata,
filtered TOC adjacency, editor state after a failed switch, foreign catalog veto);
all were fixed and independent re-review passed with regression coverage.

Evidence executed: 70 frontend/Builder tests, 59 API tests including 17
collection workflows, 33 auth tests, PostgreSQL migration/workflow checks,
browser fixtures at 1440/390/320px, production validator and whitespace checks.
Production inspection: six healthy services, no recent API/auth error markers,
guest catalog remains three demos, live origin and public ingress verified.

V17 exact batch-submission dependencies are verified, including already-submitted
parents/intermediates and replacement of individual child submissions. UI links
to the captured revision. PostgreSQL evidence includes the complete 15-test V16
suite, additive V17 upgrade and three final affected regressions. The final full
API/auth suite and bootJar passed; requirement and final quality reviews passed.
Disposable PostgreSQL and tunnel were removed after tests.

Implementation commit: `39f41f7`, deployed and verified 2026-10-06. Backup and
restricted release receipt: `backups/chapters-20261006-012825`. Both databases,
runtime configuration/replaced files and a stopped-writes API cutover dump are
backed up. V17 applied; six healthy services, readiness UP, public assets/runtime
file hashes match the release, no recent API/auth error markers. Existing story
identity/publication manifest and guest-access policy are preserved. Anonymous
private endpoints return 401. No example works were written to production.

Complete: implementation, reviews, checks, local commit and authorized deployment.
Release documentation is committed separately after verification. No Git push.
No task-owned code remains uncommitted; unrelated baseline changes are preserved.
