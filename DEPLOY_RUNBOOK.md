# FraerApp deploy and ops runbook

## Admin usability redesign (release candidate, 2026-10-08)

Not deployed. Before release inspect the live runtime, service status and recent
logs, and back up changed runtime sources/assets and the current auth image.
Publish frontend/admin-panel.js and admin-panel.css v1, then rebuild/recreate
auth-service with AuthServiceApplication.java and resources/admin.html together.
The frontend files are nginx-mounted; the HTML template is packaged in the auth
JAR. No API/Builder rebuild or database migration is needed. Keep both assets when
rolling auth back so already-open tabs can finish loading. Restore the previous
auth image and changed runtime files for rollback.

Run `sh gradlew :auth-service:test test --no-daemon`, frontend/Builder tests,
`node scripts/check-admin-panel.cjs` (Playwright available through NODE_PATH),
production validation and `git diff --check`. Browser checks use synthetic data
at 1440/768/390/320px and cover all admin sections, stale responses, recent-auth
guidance, role revocation and self-block. Never modify real accounts for smoke
testing. After release verify six services, readiness/public domain, `/auth/admin`
resource/import versions, public asset hashes, anonymous `/auth/admin/users`
denial, and recent auth/API logs. Record actual release state and backup afterward.

## Account notification clearing (2026-10-08)

Deploy AccountController/AccountService with the API rebuild before publishing
frontend/account-ui.js v6, standalone-dialogs.js, engine.js engine-85 and index.html.
Back up the affected runtime files and API database first. No migration is needed.
Shared standalone imports revalidate under nginx's existing no-cache policy.
Verify with isolated fixtures: individual deletion, Clear all with more than 100
read/unread notices, anonymous denial, cross-user isolation, repeat deletion,
reload persistence, unread badge, network failure/retry and new incoming notices.
Run scripts/check-notifications.cjs using Playwright for RU/EN at 1440/390/320px,
plus API/auth tests and the baseline frontend checks. Never clear real users'
notifications as a deployment smoke test.
Preflight confirmed six healthy services, no API/auth error lines in the previous
15 minutes and public home/readiness/catalog HTTP 200. All runtime Java sources
other than AccountController/AccountService already match the local checkout.
Use the tested local bootJar in a layer over the current API image, preserving
entrypoint/runtime settings, as in the preceding genre/topic release. Tag the old
API image for rollback and record the release commit and JAR hash with the backup.

Deployed from ffaaf23 after its push to main. Backup:
`backups/notifications-20261008-211946` contains the PostgreSQL custom-format dump,
prior runtime files, release files and receipt with hashes. Rollback image:
`fraerapp-api:before-notifications-20261008-211946`; release image:
`fraerapp-api:notifications-ffaaf23`. The new layer preserves entrypoint, command,
environment, user, working directory and exposed ports. API reached healthy before
the four frontend files were published; edge configuration passed and was reloaded.
Six services healthy; public home/readiness/catalog 200; frontend SHA-256 values
and running JAR/release label match. Story identity/ownership/publication manifest
is unchanged; recent API/auth error counts are zero. Anonymous account and both
DELETE endpoints return 401. Browser fixtures using published static files pass
RU/EN at 1440/390/320px, with all API mutations kept on synthetic fixtures.
Tests: 74 API, 33 auth, 71 frontend/Builder; production validator, diff check,
Builder help/chapter tabs and reader layout checks pass. All accumulated project
changes were committed and pushed by explicit owner request; older uncommitted
status notes below are historical. Local output/ notes are not release sources.

Last updated: 2026-10-08.

Media wording release (builder-50, board-12, help v3): publish Builder index/app,
board.html/board.js, help.js and showcase JSON description. Backup:
`backups/media-labels-20261008-171912`; rollback image
fraerapp-builder:before-media-labels. Built a layer on the existing Builder image
to avoid registry downloads, recreated Builder and reloaded edge. Six public
files match local, six services healthy, health/catalog 200, no recent API/auth
errors. Help dialogs passed RU/EN checks at 1440/768/390/320px; syntax and diff
checks passed. No API/schema changes. Changes remain uncommitted and unpushed.

Genre/topic release: back up API database and changed sources; deploy Builder
index.html/app.js/theme.css/genre-topic.js and API StoryDocument, Story,
StoryAdminService, WorkLinksService plus V18__story_topic.sql. Rebuild API and
Builder, recreate both, reload edge and verify public assets and health/catalog.
V18 only adds a nullable text column; keep it if rolling back the application.
Checks: full API/auth suite, 17 frontend tests, four browser widths (1440,768,
390,320), JSON export/import, local reload and legacy custom genre preservation.
AuthorWorkflowTests covers topic retention through normalization/publication.
Published with backup `backups/genre-topic-20261008-165859` (database and sources).
The normal Docker build stalled before compilation and was cancelled. Release
used the locally tested bootJar in a layer over the current API image and four
Builder files over the current Builder image; original entrypoints are retained.
Rollback images: fraerapp-api:before-genre-topic and
fraerapp-builder:before-genre-topic. All four public Builder files match local;
six services healthy, health/catalog 200, no recent API/auth errors. Changes
remain uncommitted and unpushed.

My stories styling: deploy author-workspace.css, collection-workspace.js,
workspace-entry.js and my-stories/index.html together; no rebuild. Backup:
`backups/author-style-20261008-164226`. Public assets and authenticated route's
runtime HTML match local. Health/catalog 200, six healthy services, no recent
API/auth errors. Browser fixtures cover story creation, chapter editing/saving,
submission and one visible Home link at 1440/768/390/320px; 17 unit tests pass.
The old browser script's account link locator is stale (the shared dialog uses
an action button); the scoped check navigates back to My stories directly.
Working changes remain uncommitted and unpushed.

Reader CSS v4: stronger corner shading and 38px bottom panel clearance on all
widths, respecting larger safe-area insets. Deploy reader.css and index.html;
no rebuild. Backup: `backups/reader-v4-20261008-151029`. Six viewport checks
passed; public files match local, health/catalog return 200, six services healthy
and no recent API/auth errors. Changes remain uncommitted and unpushed.

Reader v3: deploy reader.css, reader-presentation.js, engine.js and index.html
with the cat-sofa-background-v2.png asset. Backup existing files, no rebuild.
Verify 1/3/6 actual choices, description above buttons, stats icon open/close,
two-column mobile stats, radial shading, cat art loading and choice submission.
This replaces v2 narration/Continue behavior. Do not change story/player data.
Deployed with backup `backups/reader-v3-20261008-111412`; all five public files
match local, health/catalog return 200, six services healthy, no recent API/auth
errors. Working changes remain uncommitted and unpushed.

Reader presentation v2: deploy reader.css v2, new reader-presentation.js v1,
engine.js engine-83 and index.html together. Back up previous files, no service
rebuild. Run check-reader-layout.cjs: narration → Continue → choices → reread,
server choice submission, mobile characteristics toggle, shared dialogs and
no horizontal overflow at 1722/1024/768/700/390/320px. Keep author artwork intact.
Deployed with backup `backups/reader-v2-20261006-214421`; four public assets
match local, health/catalog 200, six healthy services and no recent API/auth
errors. Changes remain uncommitted and unpushed.

Loading Home-link visibility: deploy frontend/loading.css v2 and index.html
together after backing them up; no rebuild. Verify the Home link is hidden
during delayed authentication and restored in the library afterwards.

Carousel clipping repair: publish home.css cosmos-34, home-fit.js v6,
engine.js engine-82 and index.html together, with a backup and current tar mtimes.
No service rebuild. Verify full card bottoms against both the home clipping
boundary and footer, before/after carousel navigation, at 896×910, 1722×970,
1440×900, 1024×768, 768×900, 390×844 and 320×568. This replaces the earlier
transform-based carousel-lower implementation.
Deployed with backup `backups/carousel-clip-20261006-213038`; all four public
files match local, health/catalog return 200, six services healthy, no recent
API/auth errors. Changes remain uncommitted and unpushed.

Figma Home button release: site-controls JS/CSS v5, engine-81, version references
on frontend/standalone/Builder/generated admin pages. Reuse the existing
/builder/assets/figma/back.svg. Preserve remote legal content, back up changed
files, rebuild auth and Builder, reload edge, verify public versions and health.
Backup: `backups/back-button-20261006-212001`; previous auth image:
`fraerapp-auth-before-back-button:20261006`. Check the container HTML as well as
uploaded Builder source before declaring deployment complete.
Tar payloads must set a current mtime (not the TarInfo default 0): repeated
same-size version edits can leave BuildKit's source snapshot stale even with
--no-cache. Refresh changed source mtimes before rebuilding in that case.
This release required touching index.html/board.html and rebuilding Builder;
the resulting public HTML matches local. Admin v5 and health/catalog return 200.

Guest carousel lower position: deploy frontend home.css cosmos-33, home-fit.js v5,
engine.js engine-80 and index.html together. Back up all four files; no rebuild.
Verify the carousel moves lower without resizing cards or covering the footer;
checked at 1722/896/390/320px.
Deployed with backup `backups/carousel-lower-20261006-211029`; four public files
verified, six services healthy, health/catalog 200, no recent API/auth errors.
Uncommitted and unpushed.

Shared Home navigation: site-controls JS/CSS v4, engine-79, library v9, frontend
index and control URL bumps on standalone/Builder/generated admin pages. Preserve
remote legal text while replacing version URLs. Back up changed files and Builder,
rebuild Builder/auth, reload edge. Verify Home/icon center alignment on all routes,
four-card library fits 1440×900, shared dialogs work and homepage search is unchanged.
Deployed with backup `backups/shared-home-20261006-210447`; previous auth image
`fraerapp-auth-before-shared-home:20261006`. Runtime files/public versions verified,
health/catalog/admin 200, six services healthy, no recent API/auth errors.
Working changes remain uncommitted and unpushed.

Builder single-scroll change: theme v21 plus index/board HTML version URLs.
Back up the full Builder, upload these three files, rebuild story-builder and
reload edge. Check expanded example tree at 1722/1024/390/320px: overflow visible,
no height cap, normal band positioning, wheel updates window scrollY only.
Deployed: backup `backups/builder-scroll-20261006-205429`; all three public
files verified, health/catalog 200, six services healthy after startup, no recent
API/auth errors. Changes remain uncommitted and unpushed.

Guest homepage layout: deploy frontend home.css cosmos-32, home-fit.js v4,
engine.js engine-78 and index.html together after backing up the four mounted
files. No rebuild is needed. Check guest card size/position and footer separation
at desktop/tablet/mobile widths; authenticated search remains in the icon row.
Deployed with backup `backups/guest-layout-20261006-205208`: all four public
files match local bytes; six services healthy, health/catalog 200, no recent
API/auth errors. Uncommitted and unpushed.

Reader/shared dialogs release: deploy frontend engine-77/home cosmos-31/index,
site-controls v3 JS/CSS, new account-dialogs.js/.css, standalone-dialogs.js and
reader.css. Bump shared control URLs on Builder, account workspaces, legal/access
pages and generated auth admin HTML. Preserve production legal wording when
patching version URLs. Back up changed files and Builder; rebuild Builder and
auth-service (generated admin HTML), then reload edge. Verify public file hashes,
the generated admin URL versions, six service health states, health/catalog and
recent logs. UI checks: scripts/check-reader-layout.cjs and check-site-controls.cjs.
Deployment backup: `backups/reader-shared-ui-20261006-204422`; prior auth image:
`fraerapp-auth-before-reader:20261006`. Public legal HTML is transformed by
Cloudflare email obfuscation: verify runtime bytes against the archive and public
versioned control URLs instead of requiring an identical HTML byte hash there.
Live static reader/header checks passed at 320, 390, 700, 768, 1024 and 1722px.
Changes are deployed but remain uncommitted and unpushed.

Previous mobile search correction (superseded above): frontend engine-76,
home.css cosmos-30 and index.html.
Back up the three mounted files before upload; no container rebuild required.
Verify signed-in search shares the icon row below 701px, desktop resizing restores
the form, guest/other routes hide it, and settings/account dialogs still work.
Deployed 2026-10-06; backup `backups/mobile-search-20261006-203120`.
All three public files match local bytes; six services healthy, health/catalog 200,
and no recent API/auth errors. Changes remain uncommitted and unpushed.

Builder palette/navigation release: theme v20, Builder index/board HTML and
frontend/site-controls.js v2. Back up changed files and full Builder, rebuild
Builder, reload edge. Verify Home/icon center alignment and toolbar wrapping on
desktop/tablet/phone widths; check other pages retain shared controls. Palette
comes from native Figma properties and the owner's supplied reference screenshot.

## Builder chapter tabs

Builder-48/theme v19/help v2: deploy app.js, index.html, board.html, theme.css,
help.js and new chapter-panel.js. Back up the full Builder directory, rebuild
story-builder, reload edge. Verify public bytes including the new module and all
services/health/catalog/logs. No API, auth or database migration required.
Run scripts/check-chapter-tabs.cjs, check-serial-stories.cjs and
check-builder-help.cjs with bundled Playwright. The preview is a local read-only
scene snapshot. Validation operates on current editor JSON; moderator submission
retains server-side validation and publication policy.
Deployed backup: `backups/builder-tabs-20261006-173939`. All six services healthy;
public file bytes, health/catalog endpoints and recent logs verified. 71 unit
tests and tab/serial-story/help browser checks pass. Uncommitted/unpushed.

## Serial-story release

Builder theme v18 sets H3-style block-heading line-height to the requested 37px.
Deploy theme.css plus index.html and board.html cache versions; back up Builder,
rebuild it and reload edge. Verify wrapped headings at 1722/1440/1024/850/768/390/320px.

Builder-47 removes the duplicate My Stories/chapter-list link from the header.
Deploy app.js and index.html, back up the Builder directory, rebuild Builder and
reload edge. The serial-story browser check now returns through the account menu
at 1440/768/390/320px; no API or database change is involved.

Deploy the changed CollectionDocument/CollectionService/CollectionController,
ChapterReadingService/GameService/WorkPackageService API sources and verified bootJar;
collection UI/reader/workspace, folder-review, workspace-entry, engine and versioned
HTML entrypoints; Builder app/index. Rebuild/recreate API and Builder, reload edge.
No schema migration. Back up API database, source and static files; retain the previous
API image for rollback. Inspect the published-story manifest before/after deployment.
Verify all services healthy, public JS/HTML bytes, health/catalog endpoints and logs.

Regression: node scripts/check-serial-stories.cjs (bundled Playwright NODE_PATH),
node scripts/check-builder-help.cjs, frontend/Builder unit tests, Gradle :test and
:auth-service:test. Test per-chapter submission without future-draft publication,
sequential carry-over, direct-start rejection, seasons and existing v1 behavior.
Backup: `backups/serial-stories-20261006-124720` (API custom-format dump verified
with pg_restore --list, previous sources/static files). Previous API image tag:
`fraerapp-api-before-serial:20261006-124720`.
For deploying a locally verified bootJar, use a separate temporary Docker context
containing app.jar and a Dockerfile based on the current API runtime image. The
repository .dockerignore excludes build/, so COPY build/libs/... from the repository
context fails. Preserve the runtime entrypoint/user/environment and jar ownership.
Anonymous requests to /my-stories/ and /moderation/ intentionally return the
workspace-access gate, so verify their protected HTML bytes on the runtime.
Public module/Builder bytes, health/catalog responses and the unchanged publication
manifest were verified. Builder-46 includes the file:// return-link correction;
its immediate predecessor is backed up under builder-before-local-link in the
same release backup. No auth service rebuild, data migration, commit or push.
Workspace v5/entry v4 follow-up displays the current per-chapter review state;
previous frontend files are under frontend-before-chapter-status in that backup.

Builder toolbar spacing correction: theme v16 and index.html. Deploy both,
rebuild story-builder and reload edge. Check all seven actions in one row at
1722px and natural wrapping without horizontal scrolling on narrower screens.
Backup: `backups/builder-toolbar-20261006-120937`. Uncommitted/unpushed.

Builder-44 removes the JSON preview; theme v15 adds bottom clearance for fixed
actions. Deploy app.js, index.html and theme.css, rebuild story-builder and
reload edge. Initial backup: `backups/builder-remove-json-20261006-115808`.
Allow time for the rebuilt service health check before reporting readiness.
Theme follow-up backup: `backups/builder-remove-json-20261006-115942`.

Guest/card CSS correction: frontend/home.css cosmos-29, collections.css v3
and index.html deployed with backup `backups/guest-card-20261006-115555`.
Mounted frontend files only; no service rebuild required. Verify guest search
is hidden, signed-in search remains, and empty story-entry-context has no box.
Public file bytes, health/catalog endpoints and service health were checked.

Frame-specific typography correction: theme v14 and typography.css v2; deploy
both Builder HTML entrypoints, theme.css and frontend/typography.css. Backup:
`backups/builder-frame-fonts-20261006-115036`. Builder rebuild/edge reload only.
For local file previews, verify document.fonts loading, not just computed CSS
font names: the old absolute stylesheet path produced zero loaded font faces.
Relative font URLs retain the same asset locations on HTTP.

Builder background adjustment (theme v13): #684E86 with light panels retained.
Backup `backups/builder-background-20261006-114616`; theme and both Builder HTML
entrypoints updated, Builder rebuilt and edge reloaded. No API/auth/data changes.

Builder contextual help release: builder-43, theme v12, help.js v1. Backup:
`backups/builder-help-20261006-114405` (full Builder directory). Five Builder
files updated, service rebuilt, edge reloaded. Verify public help.js as well as
the versioned app/theme and both HTML entrypoints. Regression script:
`scripts/check-builder-help.cjs` exercises 17 topics in two languages on four
viewport sizes with synthetic session data; also run the 25 Builder unit tests.
No backend or story-data changes; release remains uncommitted/unpushed.

Typography correction: Builder theme v11 and shared controls CSS restore Figma
4:6 font roles. Backup `backups/builder-fonts-20261006-113714` contains the Builder
directory and previous controls CSS. Rebuilt Builder and reloaded edge; four
public file comparisons pass, health/catalog return 200 and services are healthy.
No auth/API changes in this correction. Browser checks: 11 pages × four widths.

## Shared controls release (2026-10-06)

Engine-73, account-ui v5, site-controls v1 and legal.css v2 are deployed with
Builder HTML and admin template imports. Backup:
`backups/site-controls-20261006-112656` (replaced files, complete Builder directory,
restricted auth DB dump; spacing CSS before its final adjustment). Frontend is
mounted. Builder was rebuilt, auth used the locally tested Java 17 bootJar with
the unchanged runtime image stage, and edge was reloaded. No migrations or
backend policy changes. Baselines were checked before overwrite.

Public hashes match static controls, account/engine, main/access/Builder HTML and
legal CSS. Private workspace HTML and auth JAR match runtime hashes. Legal HTML
matches the prepared patch on the server; Cloudflare email obfuscation modifies
public HTML bytes, so exact public hashes differ for those three pages. Verify
their script/style tags publicly and exact source bytes on the runtime. Preserve
production legal wording when unrelated local legal edits are present.
Post-checks: six healthy services, home/health/catalog/admin 200, zero recent
API/auth errors. Tests: 70 frontend/Builder, 33 auth, four-width browser checks on
11 pages. Release changes remain uncommitted/unpushed.

## Builder light theme release (2026-10-06)

Deployed theme v10 / builder-42 after confirming remote file baselines and six
healthy services. Full Builder directory backup:
`backups/builder-light-20261006-111646`. Updated only theme.css, index.html,
board.html and app.js, rebuilt story-builder and reloaded edge. Public hashes
match all four files; home, healthz and guest catalog return 200. All six services
remain healthy; recent API/auth error count is zero. No data or API changes.
Validation: 25 Builder tests, syntax/diff checks and browser checks at 11 viewport
sizes, covering light editor/dialog/map, tree labels, sticky layout and Up/Down.
Local edits and this release record have not been committed or pushed.

## Ordinary folder correction (deployed 2026-10-06)

Verified release c5a6f84; backup/receipt `backups/plain-folders-20261006-094253`.
Both DB dumps and replaced runtime/config files were backed up; API cutover dump
taken with writes stopped. Dump listings and transferred JAR hash verified. Six
healthy services, readiness UP, public/runtime hashes match, V17 unchanged, no
recent API/auth error markers. Story/folder manifests and guest policy preserved;
private folder APIs deny anonymous access. No sample user works were created.
69 API, 33 auth, 70 frontend tests, PostgreSQL 27 folder tests and final notification
regression, browser 1440/390/320px and static checks passed. No Git push.

Release removes volume/cycle type rules; it changes API and static clients without
a migration (V17). Rebuild API and Builder, deploy shared modules before entrypoint
HTML: collection-ui/reader/workspace v3, folder-review/workspace-entry v2, engine-72,
builder-41. Reload edge after recreating Builder to refresh upstream resolution.
Preserve immutable JSON and existing type columns as file compatibility.
Verify same-kind nested folders, mixed contents, cycle/duplicate-parent rejection,
forward-reference package import, grouped moderation and direct-scenario reading
on H2/PostgreSQL and browser fixtures. Follow backup/cutover/health/hash/manifest
checks below. Previous production release: 782ab67. No push or unrelated file edits.

## Public folder simplification (deployed 2026-10-06)

Verified release `782ab67`; backup/receipt directory
`backups/folders-20261006-092158`. Both databases and replaced files/configuration
were backed up; an additional API cutover dump was taken with writes stopped.
Dump listings and transferred API SHA-256 were verified. Runtime/public hashes
match; six services healthy, readiness UP, V17 current, recent API/auth errors zero.
Story/folder identity and publication manifests match before/after; guest demos
remain three and anonymous folder author/moderation endpoints return 401.
No sample works or production mutations on real accounts were used for testing.

Checks: 66 API tests, 33 auth tests, 70 frontend/Builder tests, 24 collection
workflows on PostgreSQL, browser fixtures at 1440/390/320px, syntax, production
validator and diff checks passed. Requirements and quality reviews passed.
The disposable PostgreSQL container and tunnel were removed. No Git push.

Correction: default folder tree, a single grouped moderation application/decision,
and owner-only authoring links. No new migration; database remains at V17. Do not
remove or rewrite historical user documents/saves. Baseline main f7c6ba2 and runtime
39f41f7. Commit/deploy authorization continues; no push or unrelated workspace edits.

Run full API/auth and frontend suites and the collection suite on isolated
PostgreSQL. Exercise folders, sole submission action, exact grouped snapshots,
stale-decision retention and self-review safeguards with the browser fixture.
Inspect production and retain story and collection identity/publication manifests.
Back up both databases, replaced runtime files and private configuration; take an
API cutover dump with writes stopped.

Rebuild API and Builder. Install shared collection-ui, collection-reader,
collection-workspace, folder-review, workspace-entry and collections.css before
entrypoint HTML; engine-71, builder-40 and shared collection modules v2 invalidate
old assets. Recreate API, wait for readiness, install frontend/reload edge and
recreate Builder. Verify runtime/public file hashes, six healthy services,
readiness/public catalog/guest policy, V17, unchanged manifests and recent logs.
Anonymous author/moderation folder endpoints must return 401. Remove only the
labelled disposable database and tunnel after tests; record the release receipt.

## Chapters and collections release (V16–V17)

Released and verified 2026-10-06 from implementation `39f41f7` (engine-70,
builder-39, account-ui v4). User authorized implementation, commit and deployment.
This request does not authorize pushing the earlier unpushed commits; Git push is
separate from runtime deployment.

Release receipt: `backups/chapters-20261006-012825/release-receipt.json` records
commit and verified API artifact SHA-256. The restricted backup contains both
database dumps, an additional API cutover dump taken while writes were stopped,
dump listings, replaced runtime files, compose and private environment settings.
V16–V17 applied; six services healthy, API readiness UP, public health OK, recent
API/auth error markers zero. Existing story identity/publication manifest matches;
guest catalog still has three demos and collection catalog is empty. No production
sample collections were created. Private endpoints deny anonymous access with 401;
served assets and all replaced runtime files match the release hashes.

Verification: 59 API tests (17 collection workflows), 33 auth tests, 70 frontend/
Builder tests, JS syntax, production validator and diff checks passed. PostgreSQL
verification includes the complete 15-test V16 suite, additive V17 upgrade, and
three final affected dependency/replay regressions. Browser fixtures passed at
1440/390/320px including failed editor switching, nullable informational metadata,
hidden intermediate chapters and exact dependency revision links. The labelled
PostgreSQL fixture and its SSH tunnel were removed. No Git push was performed.

1. Verify local changes and retain unrelated legal/map/artwork changes. Run API and
   auth suites, all frontend/Builder tests, JS syntax, production validator and
   `git diff --check`. Run collection workflows, migration, request retry, parent
   assignment and moderation races on isolated PostgreSQL 16. Run
   `scripts/check-chapters-ui.mjs` with bundled Playwright exposed through NODE_PATH.
2. Inspect all six runtime services and sanitized recent logs, confirm current
   origin ingress and Cloudflare public response, and capture an identity/publication
   manifest of existing stories. Do not import examples or use real user accounts
   for mutation smoke tests.
3. Commit the exact task-owned sources and accompanying context. Back up both
   databases, runtime `.env`, compose and every replaced file to a restricted
   timestamped directory. Check dumps with pg_restore --list. Preserve uploads,
   old revisions and saved games. Take an additional API dump while API writes are
   stopped immediately before cutover.
4. Build verified API and Builder artifacts. API requires rebuild/recreate for V16–V17;
   auth-service has no feature changes and need not be rebuilt. If origin Gradle
   download still fails, use the existing verified-local-JAR packaging procedure:
   Java 17 bootJar, transfer/hash comparison, unchanged runtime Dockerfile stage,
   entrypoint/upload ownership/memory settings, image release label.
5. Recreate API and wait for readiness, install public frontend files, reload edge,
   then recreate Builder. Frontend additions include collection-ui.js,
   collection-workspace.js, collection-reader.js and collections.css. Builder adds
   relations-editor.js and uses the shared frontend collection controls. Deploy the
   modules before serving entrypoints that reference them. Private workspace HTML
   remains under the existing authenticated nginx locations.
6. Verify V16–V17 applied, six healthy services, public health/catalog responses,
   unchanged legacy publication manifest and zero unexpected seed/collection data.
   Anonymous collection private endpoints must return 401; guest collection catalog
   is empty and legacy demo catalog has three entries. Compare served JS/CSS/HTML
   SHA-256 to the committed release and inspect recent API/auth errors. Verify
   engine-70, builder-39 and account-ui v4 integration assets.
7. Save a restricted release receipt with commit, backup, artifact hash and checks.
   Remove only the labelled disposable PostgreSQL fixture and its tunnel after
   final tests. Record deployment outcome in both context and runbook.

Rollback: never run pre-V16 API after chapter data has been written: that version
does not enforce incoming contracts and can lose metadata on export. Prefer fix
forward; otherwise keep affected access unavailable and restore a coordinated
backup under maintenance after explicitly assessing writes since that backup.
Do not drop V16 tables or restore a dump over new reader/author work as an automatic
rollback. Frontend rollback must also preserve access to pinned saved scenarios.

Moderation release verified 2026-10-06: implementation `ecac99b`, backup
`backups/moderation-20261006-000143` includes initial and cutover dumps of both
databases, runtime files, private env and a restricted `release-receipt.json`.
V8/V15 applied successfully. Four unchanged publications received audited migration
approval from the owner's explicit instruction; all legacy saves were pinned.
The runtime policy is now `review`, and restart idempotence was verified. API/auth
images use locally verified Java 17 artifacts because server Gradle download hit
an outbound TLS error; transferred SHA-256 and running commit labels matched.
Builder and edge were rebuilt/recreated as appropriate. Public engine-69,
Builder-38, 16 JS/CSS files and four Builder entry/assets matched local bytes.
All six services are healthy, guest catalogue contains exactly three demos,
private APIs return 401, private pages redirect with Location/no-store/noindex,
missing uploads return 404, and recent API/auth errors are zero. Live browser
confirms the guest recovery page; privileged workflows use isolated fixtures.
Validation: 42 API, 33 auth, 69 frontend/Builder tests; additionally 14 workflow/
migration tests and all 33 auth tests on isolated PostgreSQL. Temporary PostgreSQL
and its tunnel were removed. Git push was separately blocked by automatic approval
review pending explicit user authorization; deployment used the verified local
commit under the user's explicit deployment instruction.

Builder theme v9/app builder-37 Add gradients: backup `backups/builder-add-buttons-20261005-132036`. Four public files match local after builder rebuild and edge reload; six services healthy, health/catalog 200, recent API/auth errors zero. Eight builder tests and browser checks at 1440/1024/390px pass, including Add colors after new scene creation and on the scenario map. No commit/push.

Builder theme v8 bounded sticky structure: backup `backups/builder-sticky-tree-20261005-131115`; theme and both HTML entrypoints deployed, builder rebuilt, edge reloaded. Three public files match local; six services healthy, health/catalog 200, recent API/auth errors zero. Browser regression at 12 widths verifies sticky top=12px in side-by-side layouts, no overlap with author workspace, bounded tree width, and working back-to-top. git diff --check passes. No commit/push.

Builder theme v7 compact file selector: backup `backups/builder-file-button-20261005-130638`. Theme and HTML entrypoints published, builder rebuilt, edge reloaded. Three public files match local, six services healthy, health/catalog 200, recent API/auth errors zero. Browser checks at 1440/390px confirm compact padding and retained gradient; git diff --check passes. No commit/push.

Builder theme v6 scrolling fix: backup `backups/builder-scroll-layout-20261005-130316`. Theme and HTML entrypoints published; builder rebuilt, edge reloaded. Three public files match local, six services healthy, health/catalog 200, no recent API/auth errors. Eight builder tests pass. Browser regression scrolls until author workspace reaches viewport y=200 at 1440/1380/1024/901/900/850/768/701/700/600/390/320 widths: no intersecting sidebar boxes, structure <=390px, no page overflow, visible back-to-top click returns scrollY to zero. No commit/push.

Builder theme v5 toolbar wrapping: backup `backups/builder-toolbar-wrap-20261005-125554`. Theme and both HTML files published; builder rebuilt and edge reloaded. Public files match local, six services healthy, health/catalog 200, recent API/auth errors zero. Browser checks at 1440/1024/768/390/320px confirm wrapping with no horizontal toolbar overflow. git diff --check passes. No commit/push.

Builder theme v4: backup `backups/builder-scene-button-20261005-125204`; published theme.css and both HTML entrypoints, rebuilt builder and reloaded edge. Public files match local, six services healthy, health/catalog 200, recent API/auth errors zero. Browser checks at 1440/390 verify dark nested panels and identical Delete/+ Scene gradients. git diff --check passes. No commit/push.

Builder tree/surfaces theme v3: backup `backups/builder-tree-20261005-124752`. Published theme.css and both HTML entrypoints; rebuilt builder and reloaded edge. All three public files match local, six services healthy, health/catalog 200, recent API/auth errors zero. Eight builder tests passed. Browser checks cover ten viewports from 320x568 through 2560x1080, including 480x320 and 1920x600: tree rows 36px with 4px gaps, no editor/map page overflow, working selection/filters and JSON dialog. Additional 1440/390 checks confirm all nested panels dark and file selectors gradient. No commit/push.

Builder compact/darker theme v2: backup `backups/builder-compact-20261004-205534`; deployed theme.css and both HTML entrypoints, rebuilt story-builder and reloaded edge. Three public files match local, six services healthy, health/catalog 200, no recent API/auth errors. Eight builder tests and browser checks passed: all seven toolbar actions fit one row without scrolling at 1024/1440px; 390px scrolls the toolbar without page overflow; panels are #5A427C and scene subtitles #FEE3E2. No commit/push.

Builder Figma theme release: backup `backups/builder-theme-20261004-204120`; publish theme.css v1, three assets/figma arrows, app.js builder-36 and both HTML entrypoints. Rebuild/recreate story-builder and reload edge as for the background release. All seven public files match local; six services healthy, health/catalog 200, recent API/auth error count zero. 35 frontend/builder tests, production validation and browser checks at 1440/1024/390px passed (editor, JSON dialog, selected tree objects, scenario map and active filters). No commit/push.

Builder background release (builder-32): backup `backups/builder-background-20261004-162515` includes story-builder/styles.css and index.html. Builder assets are baked into its nginx image: rebuild/recreate only story-builder, then reload edge nginx to refresh the upstream address. Both public files match local bytes, six services healthy, health/catalog 200, recent API/auth errors zero. Eight builder tests and desktop/mobile browser previews passed. No commit/push.

Reader action visibility release (engine-68/index): backup `backups/reader-actions-20261002-162944`; no rebuild. Browser fixtures verify untouched, first active run, finished and active replay at 1440/390/320px. 35 frontend/builder tests pass. Public files match local, six services healthy, health/catalog 200 and recent API/auth errors zero. No commit/push.

Reader card layout release: engine-67, story-dialog v5 and index published with backup `backups/reader-layout-20261002-162213`. No rebuild. Public files match local bytes; six services healthy, health/catalog 200 and recent API/auth error count zero. 35 frontend/builder tests, production validation and browser fixtures at 1440/390/320px passed. Fixtures verify four metrics, compact progress left/rating right, and identical restart-left/continue-right buttons. No commit/push.

Refined icon release: back up and publish search-neon.png, arrow-neon.png, account-neon.png, settings-neon.png, account-ui.js/css v2, library v8, engine-66 and index last. No backend migration/rebuild. Verify home/library, all three account states, notification read clearing the dot, no character picker, search/carousel/settings actions, and 320/390/1440px fit. Retain legacy avatar data/assets for rollback.

Published with backup backups/neon-icons-20261002-161259. All nine public files match local bytes; health/catalog 200, six services healthy, recent API/auth errors zero. 35 frontend/builder tests, syntax and production validation pass. Browser fixtures verify guest/signed/unread at 1440/390/320px, settings, profile, library and notification clearing without real account mutations. No commit/push.

Reader completion release: back up API database and runtime files before V14. Deploy GameService, StoryEngagementService and V14__reader_endings.sql; rebuild/recreate api, wait for health, reload edge, then publish engine-65/story-dialog v4/index. Validate three demos completed, Новая история in development, anonymous discoveredEndings=0 and no private-response caching. Existing finished saves seed discoveries; old resets cannot be reconstructed. Keep the additive ledger on code rollback to preserve new discoveries. Tests cover duplicate endings, reset persistence and reader isolation; browser fixtures cover statuses, 0/100%, active replay, restart and 320/390/1440px.

Published with backup backups/reader-completion-20261002-155101 (API dump and source/frontend files, restricted permissions). API rebuilt; all six services healthy; public engine/CSS/index match local bytes, health/catalog return 200, recent API/auth errors zero. Public metrics confirm three completed demos (2/6/5 endings), New Story in development and anonymous discoveries zero. 25 API tests, 19 auth tests and 35 frontend/builder tests pass. Browser fixtures verify new-save restart, signed-in completion, personal counts and all three statuses at three widths. No commit/push.

Guest story introduction release: back up engine.js, home.css and index; deploy engine-64/cosmos-27 and index last. Verify guest card opening, Continue returning to details, Register opening authentication, Escape/back cleanup, and signed-in bypass. Check desktop and 390/320px layouts. No service rebuild.

Published with backup backups/demo-welcome-20261002-144751. Public files match local; health/catalog 200, all six services healthy, recent API/auth errors zero. All 35 frontend/builder checks, syntax, production validation and diff checks pass. Browser checks cover three widths and signed-in fixture; view POST is mocked to avoid test analytics writes. No commit or push.

Homepage navigation artwork release: back up home.css/index and any existing search-magic.png/carousel-arrow-magic.png; publish the two assets, home.css cosmos-26 and index last. No service rebuild. Verify images load with transparent backgrounds, both carousel directions and search still work, and no horizontal overflow at 320/390/1024/1440px. Run standard frontend checks and compare public asset bytes after deployment.

Published with backup backups/navigation-icons-20261002-004732. Both PNGs, CSS and index match public bytes; health/catalog 200, six services healthy, recent API/auth errors zero. All 35 frontend/builder tests and production validation pass. Local browser checks cover four viewport widths, search submission, carousel next/previous and no overflow. No commit/push; existing worktree changes preserved.

Cookie artwork/H3 release: back up home.css/index and any existing cookie-frame.png/cookie-magic.png; publish both new assets, home.css cosmos-25 and index last. No backend rebuild. Verify the shared notice on home/library, readable text and 28px desktop tagline, no overflow at 320/390/1024/1440px, and acknowledgement remaining hidden after reload.

Published with backup backups/cookie-frame-20261002-003808. Both assets, CSS and index match public bytes; health/catalog return 200, all six services healthy, recent API/auth errors zero. All 35 frontend/builder tests and production validation pass. Browser checks cover the four widths, persisted dismissal, live desktop heading and matching library notice. No commit/push; existing worktree changes preserved.

Guest catalogue/author-request release: back up auth database and changed runtime files; install GuestDemoStories, PublicCatalogController, GameController, auth AuthServiceApplication and auth migration V7. Rebuild/recreate api and auth-service, wait for healthy services, then reload edge. Publish engine-63, cosmos-24, library v7 and index last. Verify guest catalogue contains exactly the three demo keys, non-demo details and author-request endpoints reject anonymous access, and private/no-store prevents shared caching. Test player submission, duplicates, admin-only listing/grant and clearing with isolated accounts/fixtures; never issue trial grants to real users. Backup: backups/guest-authors-20261002-001142 (auth DB and runtime files; backup directory restricted). Local checks: 24 API, 19 auth and 35 frontend/builder tests pass; browser fixtures cover guest/player/author/admin, request submission/pending/approval, refreshed-role Builder entry and sidebar clearing. Rollback restores previous code/frontend while retaining the additive author_access_requests table.

Avatar/inbox deployment: back up API database and runtime files; deploy V13, AccountController/AccountService, StoryAdminService, and auth AuthServiceApplication. Rebuild/recreate api and auth-service, wait for both healthy and reload edge to resolve container addresses. Then install account-ui.js/css, avatar-fairy/fae PNGs, engine-61, privacy page and index last. Verify guest account GET/PUT return 401, public files match, health/catalog and services are healthy. Test authenticated selection, cross-account isolation, admin-only messages, read ownership and publication deduplication in isolated integration tests; never send test messages to real users. Additive migration rollback retains preferences/inbox data. Generated assets derive from the user's supplied reference.

Guest/author release published and verified 2026-10-02: all six services healthy; public engine-63/cosmos-24/library-7/index match local files. Both catalogue APIs return exactly three demo keys to guests, published non-demo detail returns 401, and author request/list endpoints reject anonymous callers. Live guest browser verifies no full-library link or homepage filters, both CTA buttons opening sign-in, direct /history redirecting to sign-in, mobile fit and no page errors. A check during API restart hit a transient failure; final checks were repeated after health recovery and edge reload. Authenticated request/approval and role refresh are covered by isolated tests/browser fixtures without modifying real users. Changes remain local in Git, uncommitted and unpushed; production is updated.

Avatar/inbox backup: `backups/account-icons-20261001-233412`, including API database dump. Validation: 24 API tests, 18 auth tests and 34 frontend/builder tests pass. Browser fixtures verify both avatars, guest/authenticated/unread states, persistence after reload, clearing unread and desktop/mobile dialog fit. Production messages are not exercised against real accounts.

The same release includes the user's follow-up settings icon: settings-magic.png and home.css cosmos-23, with old home.css added to the backup before installation. Mobile browser verified 48px icon, working settings dialog and no horizontal overflow.

Published and verified: all six services healthy, health/catalog 200, guest `/api/account` 401, recent API/auth error count zero. Index and all new/versioned assets match local bytes. Public privacy HTML includes the new disclosure (CDN-served HTML is not byte-identical). Production guest browser loads both new icons, opens Settings and reports no page errors. Changes remain uncommitted/unpushed.

Account spacing release: home.css cosmos-22 plus index; back up both before install. At 1440px and 390px, title top inset is 37px including border and account name/button gap is 20px. Production validation and diff checks pass.

Heart shape correction: deploy story-cards v6 and index together after backup. Selected gradient is path-only; root SVG has no fill/filter, glow sits on the transparent button. Visually checked Chromium and computed styles; native Safari verification remains unavailable locally.

Favorite gradient release: deploy engine-60, story-cards v5 and index together after backup. Browser verified gradient stops, unique SVG IDs and stronger glow; all 34 frontend/builder tests and syntax/diff checks pass.

Story dialog cover release: `story-dialog.css?v=3` and `index.html`, backup `backups/dialog-cover-20261001-213147`. Browser verified enlarged cover, reduced gap before Start, and visible action at 1440×900, 390×844 and 320×568. Short windows scroll information internally. Syntax, production validation and diff checks pass.

Sort/typography release: backup `backups/sort-typography-20261001-212612`; engine-59, library v6, story-cards v4, index. Verified five widths 320–1440px, matching input/select font sizes, no horizontal overflow and guest favorites empty state. 34 tests, syntax, production validation and diff checks pass. Public files match; health/catalog return 200; all six services healthy, recent logs error-free.

Profile style correction (`cosmos-21`, home.css/index): backup `backups/profile-style-20261001-211912`. Browser computed styles confirm all four account actions match. Syntax/diff checks pass; public files match local, health/catalog return 200, six services healthy, no recent API/auth errors.

Metadata post-deploy verification: API startup took about 77 seconds with transient 502 responses, then all six services became healthy. Public health/catalog/engagement return 200 and recent API/auth logs have no errors. Confirmed ending counts: Train 404=2, cat=5, toilet=6, new-story=1. Completion statuses remain null pending owner input.

Account/favorites UI release: backup `backups/account-favorites-20261001-205524`; engine-58, story-cards v3, story-dialog v2 and index. Verified player/author/admin visibility with local fixtures, favorite toggle persistence response without carousel movement, four current story descriptions fitting the desktop dialog. 34 frontend tests and Java auth/API suites pass. Metadata API release backup `backups/story-metadata-20261001-205609`, StoryEngagementService and V12; only API is rebuilt. completion_status must be assigned from the owner's explicit classification, never inferred from PUBLISHED. No Git commit/push; existing unrelated worktree changes preserved.

Carousel gap correction deployed (`cosmos-20`, home.css/index): backup `backups/carousel-gaps-20261001-191158`. Four browser viewport checks confirm 36px mobile link gaps and preserved landscape geometry. Baseline 17 tests, syntax, production validation and diff checks pass; public assets match, health/catalog return 200, six services healthy and recent logs error-free.

Story dialog release: `engine-57`, new `story-dialog.css?v=1`, index; backup `backups/story-dialog-20261001-190837`. Browser verified 470×600 desktop and 358×600 mobile, home/library origins, direct route, guest auth overlay and Escape return. 34 tests, syntax, production validator and diff check passed. Public assets match local; health/catalog return 200, all six services healthy, recent API/auth logs error-free. Deploy CSS before index; no backend rebuild.

Compact carousel spacing release (`cosmos-19`): deployed `home.css` and `index.html`; backup `backups/compact-spacing-20261001-185951`. Checked six viewport sizes, frontend syntax, 17 baseline tests, production validator and diff whitespace. Public files match local bytes; homepage, health and catalog return 200, six services healthy, recent API/auth logs contain no errors. No rebuild needed.

Fairy loader release: `engine-56`, `loading.css?v=1`, `assets/home/loading-fairy.png`; backup `backups/fairy-loader-20261001-184126`. Deploy asset/CSS/engine before index. Browser preview verified desktop 35px ring/190px stage and mobile 26px ring/114px stage; 1440×1024 and 390×844 screens have no overflow. Reduced-motion has static fallback. 34 tests, syntax, production validator and diff checks passed; public files matched local; homepage, health and engagement returned 200. No backend rebuild or artificial auth delay.

Typography rollout 2026-10-01: backup `backups/typography-20261001-181025`; `cosmos-18`, `engine-55`, `home-fit.js?v=3`, shared `typography.css?v=1`. Publish new font files/licenses and stylesheet before frontend/legal/Builder HTML. Builder index/map both reference the root-served shared stylesheet; rebuild/recreate story-builder after changing their HTML. Public font/CSS/JS bytes matched local; all seven frontend/legal/editor routes returned 200 with the shared stylesheet. 34 tests, JS syntax, production validator and diff checks passed. Browser verified Figma-sized homepage geometry, wide viewport fit, mobile text wrapping, library font roles and Settings dialog. Core auth/API behavior unchanged.

Wide homepage release: `cosmos-17`, `engine-54`, imported `home-fit.js?v=2`; backup `backups/home-wide-20261001-162405`. Publish home CSS/fit script/engine before index. Public assets matched local; health, homepage and engagement endpoints returned 200. Syntax and 34 frontend/builder checks passed. Browser measured footer within viewport at 1728×974 and 1000×924, plus checked unchanged mobile geometry at 390px. No backend rebuild.

Library Favorites dropdown release: `engine-53`, `library.css?v=5`; backup `backups/favorites-sort-20261001-154029`. Published library CSS, engine and index; public files match local and health/catalog endpoints return 200. 34 frontend/builder checks passed. Verify “Избранные” in Sort, guest empty state, and Profile Favorites selecting that option. Library Filters markup/styles/listeners were removed.

Modal close focus fix deployed with `home.css?v=cosmos-16`; backup `backups/modal-close-20261001-152833`. Public CSS/index match local, health 200, browser computed styles confirm identical transparent 44px controls with no border/outline for account and settings. Keyboard focus remains visible through thicker cross strokes and shadow.

Cookie/favorites UI release: back up and publish frontend `home.css`, `library.css`, `story-cards.css`, `engine.js`, `privacy-policy.html`, then `index.html` last. Asset versions: cosmos-15, library 4, story-cards 2, engine-52. No service rebuild or migration. Verify identical cookie styling on home/library, guest Favorites empty state, compact gradient guest-login button, and profile Favorites shortcut. Cookie acknowledgement still does not gate view analytics; do not describe this release as implementing consent management or server retention.

Published 2026-10-01; backup `backups/cookie-favorites-ui-20261001-152357`. Validation: 34 frontend/builder checks, engine syntax, production validator, and diff whitespace checks passed. Browser verified shared notice styling, guest empty results, and dialog button. Profile shortcut covered by a handler test without modifying a real account.

This file is a practical checklist for production operations. Read `PROJECT_CONTEXT.md` first.

This runbook is safe to commit: it uses placeholders and environment variables instead of private host/user/IP values. Concrete local values may exist in `LOCAL_OPERATOR_NOTES.private.md`, which is intentionally ignored by git.

## Required local variables

Set these before running production commands:

```bash
export FRAERAPP_SSH='<ssh-target>'
export FRAERAPP_REMOTE_DIR='<remote-runtime-directory>'
export FRAERAPP_DOMAIN='<public-domain>'
export FRAERAPP_LAN_IP='<server-lan-ip>'
```

## Quick production status

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps"
```

Check local origin from the server:

```bash
ssh "$FRAERAPP_SSH" 'curl -skSI https://127.0.0.1:8443/ | sed -n "1,20p"'
ssh "$FRAERAPP_SSH" 'curl -sSI http://127.0.0.1:8088/ | sed -n "1,20p"'
```

Check public site:

```bash
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/"
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/api/catalog/stories"
```

Check current public IP:

```bash
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org; echo'
```

## Shared homelab host

FraerApp shares its Docker host with Nginx Proxy Manager, Homepage, AdGuard, Home Assistant, Forgejo, Beszel, Portainer, Uptime Kuma, and other services. Before starting or recreating FraerApp, inspect host port ownership and running containers:

```bash
ssh "$FRAERAPP_SSH" 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
ssh "$FRAERAPP_SSH" 'ss -lnt | grep -E ":(80|443|3000|8088|8443|8090)[[:space:]]" || true'
```

Start only the FraerApp core when observability is not required:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose up -d postgres auth-postgres api auth-service story-builder edge"
```

Confirm the core restart policy after bringing old containers back online:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && for service in postgres auth-postgres api auth-service story-builder edge; do cid=\$(docker compose ps -q \"\$service\"); docker inspect -f \"\$service restart={{.HostConfig.RestartPolicy.Name}} status={{.State.Status}}\" \"\$cid\"; done"
```

Do not start `grafana`, `prometheus`, `loki`, `promtail`, `node-exporter`, `cadvisor`, `nginx-exporter`, `postgres-exporter`, or `auth-postgres-exporter` as part of this minimal startup. Grafana's configured port may conflict with another homelab service.

Nginx Proxy Manager owns the server LAN ports 80/443 for local `*.home.arpa` services. FraerApp edge must bind high ports 8088/8443 only to `$FRAERAPP_LAN_IP`; verify this in the private runtime `.env`:

```bash
ssh "$FRAERAPP_SSH" "grep -E '^(HOST_BIND_IP|HTTP_PORT|HTTPS_PORT)=' '$FRAERAPP_REMOTE_DIR/.env'"
```

Expected values are `HOST_BIND_IP=$FRAERAPP_LAN_IP`, `HTTP_PORT=8088`, and `HTTPS_PORT=8443`. Confirm reachability from a different LAN host before changing the router:

```bash
curl -k --resolve "$FRAERAPP_DOMAIN:8443:$FRAERAPP_LAN_IP" "https://$FRAERAPP_DOMAIN:8443/healthz"
```

The intended router mappings for the public FraerApp domain are:

```text
external TCP 80  -> $FRAERAPP_LAN_IP:8088
external TCP 443 -> $FRAERAPP_LAN_IP:8443
```

Do not bind FraerApp directly to the host LAN ports 80/443 while Nginx Proxy Manager owns them.

Known exception: `homeassistant.home.arpa` may time out even while Home Assistant responds directly on the LAN, because the NPM proxy network cannot currently reach Home Assistant's host-network listener. This issue is outside FraerApp operations. Verify the direct Home Assistant endpoint before treating it as a service outage, and do not change Home Assistant networking as part of a FraerApp deploy.

## Logs

Recent relevant logs:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h edge | tail -200"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h api | tail -200"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h auth-service | tail -200"
```

Search for errors:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h edge 2>/dev/null | grep -Ei ' 4[0-9][0-9] | 5[0-9][0-9] |error|warn|upstream|timed out|refused|forbidden' | tail -200 || true"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h api auth-service 2>/dev/null | grep -Ei 'error|exception|warn| 4[0-9][0-9] | 5[0-9][0-9] |forbidden|unauthorized|failed|timeout|refused' | tail -200 || true"
```

Interpretation:

- `401 /auth/me` is usually normal when no valid session exists.
- `401 /auth/verify` usually means login link expired or already used.
- `403 /auth/passkeys/registration/options` usually means recent auth is required.
- Cloudflare `522` means Cloudflare cannot connect to origin.
- Cloudflare `525` means Cloudflare reached an origin listener but could not complete TLS. Verify that external TCP 443 maps to `$FRAERAPP_LAN_IP:8443`; mapping it to Nginx Proxy Manager's LAN port 443 sends the FraerApp hostname to the wrong TLS endpoint.
- nginx `client request body is buffered to a temporary file` during story import is usually non-critical.

## Cloudflare 522 / site unavailable

1. Check public response:

```bash
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/"
```

2. Check runtime services:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps"
```

3. Check local origin:

```bash
ssh "$FRAERAPP_SSH" 'curl -skSI https://127.0.0.1:8443/'
```

4. Check public origin IP:

```bash
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org; echo'
```

5. If origin local is 200 but Cloudflare is 522, update Cloudflare DNS A records to the current public IP.

Direct test of new IP before DNS update:

```bash
curl -k --resolve "$FRAERAPP_DOMAIN:443:<CURRENT_PUBLIC_IP>" "https://$FRAERAPP_DOMAIN/"
```

## Frontend deploy

Deployed story-card release: backup `backups/story-cards-20261001-145923` includes changed runtime files and an API database dump. API and builder rebuilt successfully; frontend `engine-51`, new card stylesheet, heart and regular Inter font served with matching SHA-256 hashes. Public metrics returns 200 with `private, no-store`; guests receive no account favorite/rating state. API tests (including anonymous view deduplication, rating replacement, authorization and private favorites) pass, as do 32 frontend/builder tests. Verified guest dialog on production: no heading, larger text, compact outlined button. Actual account preference mutations were tested in isolated test data, not production accounts.

Story engagement release (2026-10-01): back up changed Java, frontend and builder files plus the API database before deploying V11. Build/recreate `api` and `story-builder`, wait for healthy containers, reload edge after builder recreation, and verify `/api/catalog/engagement` before installing `engine-51`/`story-cards.css?v=1`. Include `assets/home/favorite.svg` and `inter-regular.ttf`. Do not exercise votes/favorites against real accounts as a deployment smoke test. Rollback can restore frontend and API files; additive V11 tables may remain without losing collected data. Verify public metrics are zero/null initially, anonymous favorite/rating writes return 401, assets match local hashes, and the guest heart opens the shared dialog. Local preview proxies only the public metrics GET; authenticated writes are never proxied.

Passkey recovery revision (2026-09-28, deployed): `engine.js` and `index.html` (`engine-50`), backup `backups/passkey-recovery-20260928-180024`. All 32 frontend/builder tests, syntax, production validation and diff checks pass. Public hashes match; health/catalog return 200, six services healthy, no recent API/auth errors. Expired registration opens reauthentication and successful explicit login reopens settings without automatically invoking WebAuthn. Keep the server's recent-auth protection enabled. Actual device key creation requires the user's confirmation and was not exercised by the agent.

Library spacing deployment (2026-09-28): `index.html`, `library.css` (`v=3`), backup `backups/library-spacing-20260928-175137`. Browser measured Figma y positions 187/271/444/572 at 1440×1024; document height remains 1024. Diff check passes. Public hashes match; history/health/catalog return 200, all six services healthy, recent API/auth logs error-free.

Library Figma revision deployment (2026-09-28): `index.html`, `library.css` (`v=2`), `engine.js` (`engine-49`), backup `backups/library-update-20260928-174519`. Measured design geometry at 1440×1024, footer fit at 1440×800 and no horizontal overflow at 390px. All 31 tests and production validation pass. Public hashes match; history/health/catalog return 200, core services healthy and recent API/auth logs error-free.

Library deployment (2026-09-28): `index.html`, `home.css` (`cosmos-14`), `engine.js` (`engine-48`), new `library.css` (`v=1`); backup `backups/library-20260928-170821`. Include the new stylesheet before installing index. Public hashes match; `/history`, health and catalog return 200; core services healthy, no recent API/auth errors. Browser checked sorting, settings, desktop footer fit, mobile two-column layout and a temporary 15-story fixture showing natural scrolling. Syntax, frontend/builder tests, production validation and diff checks passed.

Spacing deployment (2026-09-28): `index.html` and `home.css` (`cosmos-13`), backup `backups/spacing-20260928-164917`. Browser at 1728×965 measured a 53px carousel gap, 44px link gap and document/footer height 965px. Public hashes match; health/catalog return 200, core services healthy, no recent API/auth errors.

Viewport-fit deployment (2026-09-28): `index.html`, `home.css` (`cosmos-12`), `engine.js` (`engine-47`), new `home-fit.js` (`v=1`); backup `backups/fit-20260928-163933`. Deploy the new module before engine/index. Public asset hashes match, health/catalog return 200, six core services healthy and no recent API/auth errors. Thirty frontend/builder tests pass. Browser layout checks at 1728×965, 1440×800 and 1024×768 confirm document height equals viewport height and footer bottom remains visible. Recheck after fonts load and after search results change.

Filter dropdown deployment (2026-09-27): `index.html`, `home.css` (`cosmos-11`), `engine.js` (`engine-46`) and new `filter-select.js` (`v=1`), backup `backups/select-20260927-225255`. Always deploy the new module before engine/index; verify its versioned URL returns JavaScript and matches local bytes. All four public hashes match; 30 tests and production validation pass. Health/catalog return 200, six core services healthy, no recent API/auth errors. Browser checked both dropdowns, keyboard selection, reset, and mobile width.

Filter panel deployment (2026-09-27): `index.html`, `home.css` (`cosmos-10`), `engine.js` (`engine-45`), backup `backups/filters-20260927-221739`. Browser confirms side placement, viewport fit at 390px and preserved filtered carousel after Show stories. Frontend syntax, public-surface tests and diff checks pass. Public asset hashes match, health/catalog return 200, core services healthy and no recent API/auth errors.

Homepage search deployment (2026-09-27): `index.html`, `home.css` (`cosmos-9`), `engine.js` (`engine-44`), backup `backups/search-20260927-221303`. Verified search stays on `/`, focuses the input, filters results, handles no matches and resets; mobile width 390px has no horizontal overflow. Regression coverage combines text and author filters, sorting, and matches beyond twelve cards. Public asset hashes match, health/catalog return 200, core services healthy and no recent API/auth errors.

Interaction deployment (2026-09-27): `index.html`, `home.css` (`cosmos-8`), `engine.js` (`engine-43`), backup `backups/interaction-20260927-220312`. Verified selected RU switches to EN and selected EN switches to RU in the browser; dialog closes normally. All 29 relevant tests pass. Public asset hashes match, health/catalog return 200, core services healthy and no recent API/auth errors.

Control geometry deployment (2026-09-27): `index.html` and `home.css` (`cosmos-7`), backup `backups/controls-20260927-215930`. Browser measured equal 78×38px track outer sizes and 37×34px handles for the three controls. Public hashes match; health/catalog return 200, all six core services healthy, no recent API/auth errors.

Language control deployment (2026-09-27): `index.html` and `home.css` (`cosmos-6`), backup `backups/language-20260927-214631`. Public hashes match; health/catalog return 200, six core services healthy, no recent API/auth errors. Browser confirms RU/EN background-image is none.

Switch refinement deployment (2026-09-27): `index.html` and `home.css` (`cosmos-5`), backup `backups/switch-20260927-214534`. Both public files match local hashes; health/catalog return 200, all six services healthy, no recent API/auth errors. Browser computed styles confirm no background gradient on sound/notification tracks.

Settings dialog deployment (2026-09-27): installed `index.html`, `home.css` (`cosmos-4`) and `engine.js` (`engine-42`), backed up to `backups/settings-20260927-214253`. Public asset bytes match local files, all six core services are healthy, health/catalog/Telegram endpoints return 200, and recent API/auth logs have no errors. Browser checks cover RU/EN, sound, notification preference and guest passkey onboarding, including 390×844 layout. Actual credential creation still requires the user's device interaction; do not treat the guest onboarding check as completed credential registration. Support contact and notification delivery remain unconfigured.

Latest deployment (2026-09-27): `index.html`, `styles.css` (`game-25`), `home.css` (`cosmos-3`), and `engine.js` (`engine-41`). Backup: `backups/home-20260927-211043` under the runtime directory. All four public asset hashes match local files. Public health, catalog and Telegram configuration checks passed; all core containers were healthy, with no recent API/auth errors. Loopback port 8443 was not reachable because the service binds the configured LAN address; public `/healthz` returned 200. The published page now includes the responsive and account-dialog changes previously available only in local preview.

When comparing guest and signed-in views, use the same origin and viewport and verify loaded asset versions. Telegram sign-in returns to the public domain; a localhost preview and an older production release are not equivalent. Never use real account cookies in a local fixture. A temporary preview with a fictional player `/auth/me` response can verify layout without granting production access.

Frontend files are mounted into nginx. Rebuild is usually not required.

The cosmic homepage also requires `frontend/home.css` and the complete `frontend/assets/home/` directory (background, exported SVGs, local fonts). Back up existing versions and install these alongside `index.html` and `engine.js`; deploying only the legacy file list below is insufficient. Verify the versioned `home.css` URL referenced by `index.html` and `/assets/home/cosmos.png` return 200, and inspect the homepage at desktop and mobile widths. Keep the legal footer links functional.

For the responsive homepage revision, deploy `index.html` and `home.css` together and verify the served `/home.css?v=cosmos-2` bytes match the local file. Check 1440×1024, 1024×768, 768×1024, 390×844, 320×568 and a short landscape window. Confirm no horizontal overflow, search height 48px at the design size (44px minimum), readable text, carousel navigation, and settings. Below 701px verify a smaller central card with one visible neighbor on each side (when enough stories exist), including after cycling through the ends of the catalog. Medium windows retain larger headings and cards with more vertical spacing. Vertical scrolling in short windows is expected.

1. Check local git status:

```bash
git status --short --branch
```

2. Run frontend checks:

```bash
node --check frontend/engine.js
node --check frontend/legal.js
node --check frontend/legal-config.js
node --check scripts/validate-production.mjs
node scripts/validate-production.mjs
node --test frontend/*.test.js story-builder/*.test.js
git diff --check
```

3. Copy files to the server:

```bash
scp frontend/index.html frontend/engine.js frontend/styles.css frontend/legal-config.js frontend/legal.js frontend/privacy-policy.html frontend/personal-data-consent.html frontend/terms.html frontend/robots.txt "$FRAERAPP_SSH:/tmp/"
```

4. Backup and install:

```bash
ssh "$FRAERAPP_SSH" "set -euo pipefail
cd '$FRAERAPP_REMOTE_DIR'
ts=\$(date +%Y%m%d-%H%M%S)
mkdir -p backups/deploy-\$ts
cp frontend/index.html frontend/engine.js frontend/styles.css backups/deploy-\$ts/
cp frontend/legal-config.js frontend/legal.js frontend/privacy-policy.html frontend/personal-data-consent.html frontend/terms.html frontend/robots.txt backups/deploy-\$ts/
install -m 0644 /tmp/index.html frontend/index.html
install -m 0644 /tmp/engine.js frontend/engine.js
install -m 0644 /tmp/styles.css frontend/styles.css
install -m 0644 /tmp/legal-config.js frontend/legal-config.js
install -m 0644 /tmp/legal.js frontend/legal.js
install -m 0644 /tmp/privacy-policy.html frontend/privacy-policy.html
install -m 0644 /tmp/personal-data-consent.html frontend/personal-data-consent.html
install -m 0644 /tmp/terms.html frontend/terms.html
install -m 0644 /tmp/robots.txt frontend/robots.txt
curl -skS https://127.0.0.1:8443/healthz
"
```

5. Verify public asset version:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/" | rg 'engine.js|styles.css'
```

## Legal/public SEO checks

Before publishing public frontend changes, run:

```bash
node scripts/validate-production.mjs
```

This fails if required legal values in `frontend/legal-config.js` are missing, if legal pages contain unpublished warnings or empty реквизиты, if the homepage exposes service/admin text in public visible content, or if production nginx noindex headers for `/auth/admin...` and `/builder/` are missing from `nginx/nginx.prod.conf`.

If nginx config changes are deployed, rebuild/recreate `edge` and verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build edge && docker compose up -d edge"
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/builder/" | grep -i x-robots-tag
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/auth/admin" | grep -i x-robots-tag
```

## API deploy

Use this when changing `src/main/java`, DB migrations, or main game/story API behavior.

1. Run tests:

```bash
sh gradlew test --no-daemon
git diff --check
```

2. Commit and push first unless emergency.

3. Copy changed repo files or update the production checkout/files according to the current deployment method.

4. Rebuild/recreate:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build api && docker compose up -d api"
```

5. Wait and verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps && curl -skS https://127.0.0.1:8443/actuator/health/readiness"
```

## Auth-service deploy

Use this when changing `auth-service/**`.

1. Run tests:

```bash
sh gradlew :auth-service:test --no-daemon
git diff --check
```

2. Rebuild/recreate:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build auth-service && docker compose up -d auth-service"
```

3. Verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps && curl -skS https://127.0.0.1:8443/auth/me"
```

`/auth/me` without a session may return 401; that only proves routing works. For auth health, use container health plus a known authenticated flow if needed.

## Telegram login deploy

For the account dialog frontend revision, deploy `frontend/index.html`, `frontend/engine.js` (version `engine-41`) and `frontend/home.css` (version `cosmos-3`) together. Verify profile-icon click for guests and signed-in users opens a centered translucent dialog over the blurred homepage at desktop and mobile widths; both surfaces use Figma `171:2` fill #7F64A4 at 68% opacity while retaining the responsive 400px maximum width. Check small legal links, Escape/focus restoration and internal scrolling in short windows. "Create yours" must stay visible after sign-in: author/admin accounts open the builder; player accounts see editor-access guidance without being asked to sign in again. Failed passkey requests must display short localized guidance, never HTML or raw server details.

Local frontend preview: `python3 scripts/preview-frontend.py`, then open `http://localhost:8765`. This reads only the public catalog and Telegram configuration using the same browser User-Agent as the public checks above; Cloudflare may reject Python's default User-Agent with 403. The Telegram button opens the real bot, whose login link returns to production. The preview does not proxy authentication or production cookies; production passkeys cannot authenticate localhost. Confirm new-account registration by following the bot's link on the public origin, then register a passkey there. A successful configuration request alone does not prove the complete personal login flow.

Telegram login runs through `auth-service`, is the public sign-in path, and uses the same temporary-link verification as recovery/admin email login. Public email login is intentionally hidden from the main frontend.

Required environment variables:

```bash
export AUTH_TELEGRAM_BOT_ENABLED=true
export AUTH_TELEGRAM_BOT_USERNAME='<bot-username-without-@>'
export AUTH_TELEGRAM_BOT_TOKEN='<telegram-bot-token>'
export AUTH_TELEGRAM_WEBHOOK_SECRET='<random-webhook-secret>'
export AUTH_TELEGRAM_LOGIN_REDIRECT_PATH='/'
```

Keep the bot token and webhook secret in private local/runtime env only. Do not commit them.

After deploying `auth-service`, register the webhook:

```bash
curl -sS -X POST "https://api.telegram.org/bot$AUTH_TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://$FRAERAPP_DOMAIN/auth/telegram/webhook\",\"secret_token\":\"$AUTH_TELEGRAM_WEBHOOK_SECRET\"}"
```

Verify without printing secrets:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/auth/telegram/login"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=30m auth-service | grep -Ei 'telegram|error|exception|warn' | tail -100 || true"
```

Expected behavior:

- `/auth/telegram/login` returns `enabled: true` and the public bot URL;
- the homepage shows Telegram and passkey login, not the email form;
- a Telegram message to the bot produces a one-time FraerApp link;
- auth DB receives a `telegram_identities` binding, an `email_login_tokens` row, and a `login_link_requested` audit event with `source=telegram_bot`.

Production note: the webhook should return Telegram's `sendMessage` method JSON directly. Do not make auth-service depend on outbound HTTPS to `api.telegram.org`; the production host may be unable to reach it even though inbound Telegram webhooks arrive through Cloudflare.

Telegram retries failed webhook updates. The webhook must avoid returning `429` for normal user messages, because Telegram will keep retrying and the bot will appear silent.

## Story creation and publication

### Builder frontend changes

The builder is copied into its nginx image by `story-builder/Dockerfile`; it is not mounted like the public frontend. Back up the remote `story-builder/` directory before copying changed files, then rebuild only this service:

```bash
node --check story-builder/app.js
node --check story-builder/board.js
node --test story-builder/*.test.js
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose up -d --build --no-deps story-builder && docker compose exec -T edge nginx -s reload"
```

Reloading edge refreshes nginx's resolution of the recreated builder container. Verify builder health and both `/builder/` and `/builder/board.html`, including the versioned script URL from the deployed HTML. Verify the public catalog before and after. Do not use validation, import or publication on real stories as a deploy smoke test; exercise author mutations against isolated test data. “Validate last import” must issue only the validation call and leave publication state unchanged.

After a static release, compare the bytes or SHA-256 of the served versioned assets with the local files, in addition to checking HTTP status. A 200 response alone can conceal an old cached asset or an SPA fallback page.

Story files live in:

```text
story-builder/scenarios/
```

Validate a story JSON:

```bash
python3 -m json.tool story-builder/scenarios/<story>.json >/tmp/story.validated.json
```

For repository validation, also check scene/asset references with a small script or builder tests.

### Draft, review and publication

Use Builder or `/api/author/stories/import` with the author's active session to save
a private draft. Send the returned revision/generation through `/review`. Inspect
the exact submitted revision in `/moderation/` before an explicit decision. Only
moderator/admin can approve, publish, restrict or restore availability. New admin
HTTP imports belong to the importing administrator; existing ownership is retained.
Admin self-approval requires the visible override and reason. Direct author publish
is forbidden; the legacy admin publish route returns 409. Do not use those old
routes or generate a standalone JWT: API authorization requires an actual active
auth session and fresh roles. Test mutations use isolated fixtures, never real
production accounts/stories.

After publication, verify:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/api/catalog/stories"
```

Check owner/revision with a parameterized SQL query in the remote runtime. Do not
print database passwords, tokens, emails or raw auth logs.

### Moderation rollout (V15 API / V8 auth)

1. Run full API/auth tests, frontend/Builder tests, production validator and diff
   check. Run moderation races and legacy published/archived migration fixtures
   against an isolated PostgreSQL 16 database. Verify role/UI behavior on desktop
   and mobile with synthetic users. Commit/push the exact release dependencies.
2. Reinspect all six production services, recent sanitized logs, live domain/origin
   DNS and current publication manifest. Confirm the four publications still match
   the owner's approved set before using the one-time legacy approval policy.
3. Back up both databases, `.env`, compose/nginx configs, API/auth source and
   frontend/Builder files to a restricted timestamped runtime backup. Verify dumps
   are nonempty/readable; never include backups or private env in Git.
   Restrict backups with `umask 077`, then restore `umask 022` before extracting
   application files. Static files must be 0644 and their directories 0755 so nginx
   can read them. Never apply those public modes to `.env`, certificates, uploads
   or backups. A copied static index with mode 0600 makes Builder return 403 and
   fail its healthcheck even when nginx itself starts normally.
4. Install release sources and build `auth-service`, `api`, `story-builder`.
   Deploy auth first and wait for health. Before the API cutover briefly stop old
   API writes, take a final API dump and compare the approved manifest. Set
   `MODERATION_LEGACY_POLICY=approve` only for this owner-approved migration and
   recreate API. Default remains `review` for all other environments.
5. Wait for API readiness, then deploy Builder and frontend assets, reload/recreate
   edge so upstream addresses and protected private routes take effect. Frontend
   and nginx configuration are mounted; Builder files are baked into its image.
   Test nginx configuration before reloading/recreating edge; no edge build is needed.
6. Verify V15/V8 success; exactly four baseline `migration_approved` events; published
   slugs/owners/content preserved; every legacy save pinned; no unexpected public
   seed; workspace records not duplicated on restart. Reset the runtime legacy
   policy to `review` after successful initialization (existing workspaces are not
   reprocessed). Preserve all audit, revision, upload and save data.
7. Verify six healthy services, API readiness, public domain, three guest demo
   catalogue entries, non-demo protection, anonymous workspace/API denial,
   no-store/noindex headers, protected upload routes and matching public asset
   hashes. Inspect recent logs without printing secrets. Remove the disposable
   PostgreSQL fixture and its SSH tunnel after checks.

Private-page 401/403 handling must use a named nginx error handler that explicitly
returns 302 with a `Location` header to the recovery page. An internal
`error_page ... =302 /workspace-access.html` serves that page at the original URL,
so the browser cannot read its `next` parameter. Verify the Location header and the
actual browser URL, not only the response status or nginx syntax.
Because nginx.conf is mounted as a single file, replacing it by extraction can
leave the container bound to the previous inode. Recreate edge after replacing
the file; a reload alone may still read the old configuration. Verify the mounted
file or effective configuration in the running container before the URL smoke test.

Rollback after V15 must keep publication enforcement. Do not start the old API,
which can publish drafts directly and ignores revision pointers. Fix forward or
keep story/API access temporarily unavailable while restoring a coordinated backup
under maintenance. Retain both database dumps and immutable upload bytes. Restoring
a database after new writes requires a separate recovery decision to avoid losing
users' work. Frontend rollback alone must not re-enable direct publication.

If the server cannot download Gradle because of an outbound TLS failure, do not
disable TLS checks. Build `:bootJar :auth-service:bootJar` locally with Java 17 from
the verified release, transfer the two artifacts and compare SHA-256 before use.
Build runtime images using the unchanged final stages of the existing Dockerfiles
(replace only `COPY --from=build ...` with the respective prebuilt JAR). Preserve
the API entrypoint, upload ownership, memory options and Java runtime; add the
release commit image label. Rebuild Builder normally. Record artifact hashes in
the restricted deployment receipt and still perform every migration/health check.
This is an operational packaging alternative, not permission to change dependency
versions, omit tests or replace an image with an unverified artifact.

## Git handoff checklist

Before telling the user work is done:

```bash
git status --short --branch
git log --oneline --decorate -5
git branch -vv
git diff --check
```

If pushed, verify the remote ref:

```bash
git ls-remote origin refs/heads/main
```

Report:

- branch;
- latest commit;
- whether working tree is clean;
- whether local and remote match;
- whether production was updated.
