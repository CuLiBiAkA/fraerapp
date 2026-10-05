# Story moderation implementation and checkpoint

## Authority and goal

User approved full implementation, commit and production deployment of
`docs/prompts/story-moderation-codex.md`, including the author visibility addendum.
Project authority: AGENTS.md, PROJECT_CONTEXT.md, DEPLOY_RUNBOOK.md. Private operator
notes supply runtime values without publication. The owner explicitly approved
preserving the four existing publications during migration (2026-10-05). Use the
one-time legacy approval policy only for these unchanged publications.

## Baseline and scope

Starting branch main, HEAD 1b90556, 5 commits ahead of origin. Many existing dirty
changes include deployed frontend, author requests, account notifications and
engagement. Preserve them. Before edits, code and status were copied to
`/tmp/fraer-moderation-baseline`. No branch or worktree is needed. Coordinator owns
git and deployment; agents do not stage, commit, push or deploy.

Change Necessity: code-change. The current backend permits direct author publication
and rollback to PUBLISHED, mutates live content on import, trusts stale JWT roles,
and serves draft assets publicly. Configuration/UI-only changes cannot enforce review.

## Architecture and compatibility

Keep stable stories/player/session identities and existing auth service. Store author
drafts separately from immutable submitted and published revisions. Reuse immutable
story_versions snapshots, extend explicit workflow/visibility metadata and audit.
All publication/availability transitions have one service owner; old /publish paths
must enforce the same rules. Public/runtime reads use approved revision content,
sessions retain their chosen revision. Private previews do not produce analytics.

Auth adds moderator role, current session/role verification for privileged access,
and last-administrator safety. Moderator API cannot access auth administration.
Author workspace retains drafts and review decisions, including read-only ownership
after author-role removal. Moderation and author pages reuse service contracts.

TDD Route: off/skipped (no strict authority); post-change integration and concurrency
regressions are mandatory. Auth monolith receives minimal wiring/role fixes; new
responsibilities belong in focused classes/modules. No general RBAC framework.

## Work sequence and verification

1. Auth contract: moderator grant/revoke/demotion/bootstrap/session validity, last
   active admin guard; focused auth tests. May be delegated with auth-service-only
   ownership while coordinator works on story backend.
2. Story backend: workflow migration/service/API, immutable draft/review/public
   boundaries, runtime revisions, visibility, soft deletion, protected media,
   notifications, seed behavior and legacy endpoint retirement. Integration tests.
3. Frontend/Builder: moderation page, My Stories and labels/filter transitions,
   author submission flows, private preview, role navigation and noindex. Syntax,
   browser role fixtures and workflow tests.
4. Independent spec review then quality/security review. Resolve supported gaps.
   Full Java/frontend tests, production validator, diff check; PostgreSQL migration
   and concurrency verification in isolated data.
5. Commit coherent task and required context documentation, preserving provenance
   of pre-existing deployed code. Inspect production state/logs, back up databases
   and runtime files, deploy only necessary services/files; no real moderation
   decisions beyond the owner's explicit migration decision. Verify health,
   public/private endpoints, assets and recent logs. Record outcome and commit docs.

## Checkpoint

- Completed: auth, story workflow, immutable runtime revisions, protected media,
  author workspace, moderation UI and Builder submission. Independent auth/story/UI
  spec and quality reviews completed; supported issues fixed, final narrow review active.
- Verified: 69 frontend/Builder tests; 33 auth tests on H2 and isolated PostgreSQL;
  42 API tests on H2 and 14 workflow/migration tests on isolated PostgreSQL after
  all review corrections. Production validator, JS syntax (including auth admin)
  and diff checks pass. Browser fixtures confirm
  mobile layout, revision labels, submission replacement, explicit admin override and
  focus recovery, read-only former authors, moderator self-approval restrictions
  and 409 recovery. All mutation checks use isolated fixtures, not real accounts.
- All supported independent review findings are resolved. No unresolved code review
  blocker remains. Native Safari/device passkeys have not been exercised.
- Active: scoped commit, context/runbook updates and production deployment.
- Git scope: the requested complete release includes necessary deployed but
  previously uncommitted account/engagement/author-request dependencies, their
  migrations, tests and referenced theme assets. This is needed for a reproducible
  commit of the verified release. Their provenance is the saved pre-task snapshot,
  not new moderation work. Unrelated legal pages, old artwork, map HTML and local
  preview script remain outside the release and are not overwritten.
- Remaining: final checks; scoped commit and push; fresh production inspection,
  backups, deployment and post-deployment verification. No production release or
  Git commit for this moderation feature has happened yet.
- Completion requires full accepted behavior, real checks, a commit and verified
  production deployment; a green local slice is not completion.
