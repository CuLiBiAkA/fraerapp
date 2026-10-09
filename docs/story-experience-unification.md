# Unified story experience — 2026-10-09

## Intent and authority

User reported inconsistent serial story cards, missing engagement, an author
folder tree instead of a coherent story workspace, and incomplete creation
instructions. On the latest turn the user explicitly requested fixing everything
autonomously, including every page using these surfaces. This supersedes the
previous per-change screenshot approval requirement. Before/after evidence remains
useful; it is not a release gate requiring another user confirmation.

Baseline: main at a2ec8e6; only existing untracked output/ (preserve untouched).
Read PROJECT_CONTEXT.md, DEPLOY_RUNBOOK.md and private operator notes. Preserve
story → chapters → scenes, optional seasons, automatic state transfer; published
content, saves, old IDs/routes and v1 packages remain compatible. No data purge.

## Repair boundary

Decision: code-change. Styling alone cannot supply missing collection ratings,
consistent visibility, useful author navigation or full prompt instructions.
CollectionService/engagement own work metrics; FolderWorkspaceService owns author
projection/filtering before pagination; existing author/reader components own
their flows. Retire separate card statistic behavior and author folder rendering,
not legacy stored documents or moderation revision semantics.

Use existing visual tokens and roles. New prompt instructions generate/import
supported JSON; no unrequested external AI provider. Preserve validation and
moderation, and distinguish chapter documents from whole-story packages.

TDD route: off/skipped (no strict test-first user requirement). Add focused
behavior/persistence regressions and run them before release; record failures
as diagnostic evidence, not permission to dilute assertions.

## Work and ownership

- [x] Backend (security_baseline): additive V21 engagement and publication dates;
  authenticated rating/view endpoints; common public fields and run progression;
  author cover projection/trash filtering; serial parent availability enforcement.
- [x] Author UI (cat_story): shared cards/status/actions; explicit list/editor
  navigation; metadata/content, cover selection, chapter workflow; import and
  moderation/mobile consistency, permissions and dirty/error recovery.
- [x] Prompts/Builder (prompt_authoring): accessible complete RU/EN creation/edit
  prompts, valid package example, precise help and documentation, contextual
  import/export terminology, preserve chapter editing and state.
- [x] Reader UI (root): home/catalog/favorites card metrics; common detail header,
  cover, metadata, rating actions and reading controls; old-route compatibility,
  notifications/account links and sorting/search consumers.
- [x] Integration (root): all references/cache versions; focused backend/browser
  checks plus baseline tests; screenshots at 320/390/768/1440 and RU/EN; independent
  review of affected boundaries; context/runbook update in commit.
- [x] Release (root): inspect live runtime/logs, backup both DBs and changed
  runtime sources/images, commit/push main, rebuild changed services, public/API/
  health/log/hash checks and before/after evidence.

## Acceptance and contracts

Every listed story has the same real rating/view behavior; missing ratings display
an unrated state. Votes belong to a work, never averages of chapter votes. Views
deduplicate user/work/day UTC. Favorite identity retains type+ID. No private draft
changes leak through public dates. Serial final-ending counts exclude ordinary
intermediate chapter endings. Run selection reflects recent play where possible.

PUT /api/catalog/collections/{id}/rating {score}; POST .../{id}/view; existing
favorite unchanged. Collection catalog/detail include views, rating, ratingCount,
myRating, authorName, publishedAt, updatedAt, lastPlayedAt, completionRate,
totalRuns, finishedRuns, endingCount, discoveredEndings. Backend owns exact values.

Author list excludes deleted by default at API pagination; explicit trash is
read-only for authors. Opening/creating content visibly changes screen without
requiring a scroll past the list. Back/cancel preserves unsaved edits. Existing
standalone documents retain their IDs and editor rather than pretending to offer
unsupported chapter conversion. Moderation retains all approvals/restrictions.

Package/chapter prompts cover variables, types/scopes/stats/substitution,
conditions and fallback, effects, local/global media and animation, endings,
chapters/seasons/transfer, validation and publication. Unsupported timers, video,
scripts and OR/NOT are clearly delimited. Generated examples must validate.

## Verification and current checkpoint

Current: implementation, independent review, final browser regression and
production release verification complete. Committed/pushed/deployed: 8af0b49;
Builder shared CSS version followup: 848568e.
Existing 15 browser suites/96 frontend tests are the baseline, not proof of the
new behavior. Meaningful counterexamples: equal scenario/collection keys; no votes;
private/hidden/archived parent; deleted list pagination; unpublished next chapter;
finished run with new chapter; lost author role; 409/failed save and cancelled exit;
standalone and schema1 compatibility; copy unavailable; both import formats.

Frontend full suites after integration; API/auth Java checks for changed shared
backend, syntax/build/diff checks. Real production verification must not mutate
other users' stories, favorites or saves. Public rendering and authenticated data
reads are separate evidence; synthetic browser responses are labelled as such.

No deletion of persistent data or breaking rewrite of distributed JSON formats.
Retained legacy paths serve existing content/saves; new authoring uses schema2.
Update this checkpoint with executed evidence and remaining limitations.

## Review findings closed during implementation

- Same story shell in library, home, favorites and direct links, including the
  original same-key scenario/collection collision. Real work votes are separate
  from chapter votes. No fabricated ratings when a work has no votes.
- Collection and standalone media respect published visibility and work ownership.
  Private draft changes cannot leak through public dates or cover references.
- Author navigation preserves dirty text through cancel, modifier/new-tab links,
  failed saves, 409 conflicts, loss of author role and Back during a write. Readonly
  text remains selectable; destructive refresh requires explicit confirmation.
- Builder and standalone metadata both use generation-checked PUT for existing
  documents. Same-key AI edits retain server identity and generation. Asset upload
  stores bytes without mutating the draft; references/removal are saved through
  the same version check. New documents retain the existing import endpoint.
- Late reader detail/start/save responses cannot undo close, Back, logout or run
  selection. Language changes preserve the chosen run and do not unlock duplicate
  starts. A failed repeated contents load has visible feedback and a retry.
- Favorite writes synchronize freshly reopened work details, disable duplicate
  in-flight actions, retain typed identity and ignore replies for a logged-out
  account. Older statistics responses cannot reopen the reader dialog.
- Collection aggregates load other readers' totals through SQL, rather than all
  their runs/saves into Java. Completion follows each frozen table of contents;
  SQL batches and chapter availability lookups are bounded. Personal progress
  still reads the current reader's runs, preserving all existing branches.

Executed baseline after final backend changes: API 107/107, auth 59/59, fresh
:bootJar; Node 109/109, syntax/lint and production build validation pass. The first
integrated 18 browser suites passed; the final runner, including standalone request
recovery and Builder CAS, passes all 20 suites. Author checks also ran axe in 32 states
with no serious/critical findings. Viewports are 320/390/768/1440, RU and EN; some
focused suites use a subset or additional widths. These are Chromium fixture
checks, not a Safari/device claim. Live PostgreSQL migration and publication
checks follow during release. Backup prepared:
`backups/story-unification-20261009-143337`, both database dumps validated and
prior API/Builder image tags retained. No auth/JWT/policy changes in this release.

Production evidence: V21 succeeded on PostgreSQL; running API JAR, origin sources,
21 actual versioned public asset URLs and two protected HTML mount hashes match.
Six services healthy; recent API/auth ERROR counts zero. Public home, readiness,
catalogue, Builder/prompts 200; protected author routes anonymous302, account401,
JWKS404. The existing QA reader's four runs, cat's three chapters and three final
endings were read through an ephemeral session, which was revoked. No production
rating/run/content changes for smoke testing. Published reader files plus this
data snapshot pass eight RU/EN contents viewport cases and two catalogue/detail
cases. Author flows use isolated data. Before/after screenshots are in the task
artifact `/private/tmp/fraer-unified-evidence/review.html`.
