# FraerApp project context

Last updated: 2026-10-09.

Unified reader catalogue, deployed from 921a81d on 2026-10-09 after the user's screenshot:
the separate "Stories in chapters" block is removed. Both public scenario and
collection entries use fillStoryCard in the same library grid and signed-in
home carousel: same cover/genre/title/favorite layout, search and title/favorite
ordering. Collection cards open their contents; scenarios retain /history links.
Guest access remains restricted to the existing three demos. Collection pages
are loaded in batches of 100 into the shared catalogue, rather than stopping at
the old separate 20-item view. Favorite identity includes the route/type so an
equal scenario/collection key cannot update the wrong heart. Contents favorite
changes invalidate the shared cache. Existing backend chapter exclusion remains
the authority; published chapters are not reinserted into the catalogue.
Collections have no aggregate rating/view API: the shared card footer shows
chapter format and publication completion status instead of fabricated metrics.
Unknown collection dates retain the existing sort fallback. This is a frontend
repair, with no story-data writes or API/auth/Builder rebuild. Assets: engine-90,
collection-reader v5, library.css v11. Node 96/96; new mixed-catalogue browser
regression passes RU/EN 320/390/768/1440, including cover, same card dimensions,
search, title sort, favorite failure/retry, key collision and first-chapter start.
Related frontend, serial story, notification and reader layout suites also pass.
Static release backup: `backups/unified-catalog-20261009-131547`. All six services
remain healthy; origin/public hashes match all four changed files; home, readiness
and public catalogue return 200; anonymous account access returns 401. Recent
API/auth logs contain no ERROR lines. A temporary nonprivileged QA session read
the real catalogue (four standalone stories and one collection), verified the
cat cover and absence of its individual chapters, then was revoked. Published
static assets plus this real metadata snapshot passed Chromium at 390/1440:
five matching cards in one grid, correct cover, search and no page exceptions.
This last check isolates the rendering; authenticated API reads were verified
separately. WebKit is unavailable locally, so no Safari verification is claimed.

Frontend/wording audit, deployed from e3aac92 on 2026-10-09:
see `docs/frontend-audit-2026-10-09.md`. Responsive layout now handles enlarged
text in catalogue/subscription/admin; shared header height drives reader stats.
Account dialogs support keyboard access to the notifications disclosure/actions,
and language buttons choose the requested language rather than toggling blindly.
Support opens actual contacts. Seven lossless WebP interface assets save 27.1%
over their PNG sources without changing visible pixels or alpha. Originals stay
versioned. Builder fixes preview choice labels, scoped text substitutions on
variable rename, editor navigation from the board, and visible recovery from
localStorage failures. Shared nested asset imports must be deployed together.

Legal documents and policy configuration use version 2026-10-09. Telegram now
requires a separate explicit versioned consent message after showing document
links, before first account/link creation. Old `telegram_bot` consent records do
not count as explicit consent. The auth transaction includes account, consent
and link issuance; replay receipts prevent duplicate delivery from invalidating
the earlier link. Existing sessions/passkeys remain valid. Replies still use
Telegram webhook method responses, without outbound Bot API calls. No schema
change or JWT rotation is required. Runtime AUTH_PRIVACY_POLICY_VERSION must
match documents, .env.example, compose and auth defaults. Terms describe current
test-only subscriptions and moderation; privacy describes actual data/features.
Legal text alignment is not a certification of provider geography/contracts or
regulatory filings. Withdrawal also needs session/link revocation and data
handling in both services; changing a consent timestamp alone is insufficient.

`npm run test:browser` runs 13 current isolated Chromium suites, including
frontend layout/keyboard, Builder editing/storage and 48 legal-page combinations.
The obsolete chapters-ui script is intentionally excluded. UI API calls are
synthetic; no real accounts, payments or messages are used for smoke tests.
All 13 suites, 92 Node, 59 auth and 96 API checks pass; axe reports no violations
in 48 inspected states. Six services are healthy, runtime policy is 2026-10-09,
running auth JAR and 46 released source files match. Auth/Builder images are
fraerapp-<service>:frontend-e3aac92; API was not recreated. Backup:
backups/frontend-audit-20261009-102654. Public guest journeys passed at
1440/390/320. CDN verification additionally found Cloudflare email obfuscation
hid legal contact links without JavaScript; targeted email_off directives now
preserve these public contacts (bd0d3b4, committed/pushed/deployed). Live public
documents pass without JavaScript at 1440/390/320; source comparisons normalize
only these CDN marker comments. Do not remove them merely because local fixtures
already show the plain email. Other zone protections remain unchanged.

Security audit release 2026-10-09 (supersedes runtime image details below):
eight confirmed security findings closed in API/auth/nginx; see
`docs/codebase-audit-2026-10-09.md` for evidence, limits and residual P2/P3 work.
HS256 signing secrets are never JWKS: edge blocks `/auth/jwks`, auth returns an
empty key set. The production shared JWT secret was rotated in API and auth.
Telegram login requires a configured webhook secret and a private matching chat;
magic/refresh tokens are atomically consumed with issuance. Reader/Builder use
single-flight refresh plus live-session recovery for cross-tab races. Legacy
tasks CRUD is admin-only. Public author/reader attribution uses a neutral random
player-ID alias instead of email/Telegram-derived login names. Query strings and
Referer are excluded from nginx access logs; entry HTML suppresses referrers.
GameService now compares JSON numbers by value and gives scene-local media
priority. Frontend engine-88 and Builder-52 are deployed with tested API/auth JARs.

Backup `backups/code-audit-20261009-095441` contains verified dumps of both DBs,
previous runtime/configuration and rollback images; release/publication receipts
record JAR hashes and exact collection IDs. All six services healthy; 96 API,
52 auth and 86 Node tests pass, plus current Builder/browser journeys.
Published test story «Мира и искусство открытых дверей», collection
`ba19a890-10d3-4374-9b8c-e168d6f7c713`, key `koshka_i_otkrytye_dveri`:
3 chapters, 2 seasons, 30 scenes, 46 choices, 3 endings. Package and coverage
matrix are versioned; actual production reader API visited all scenes and endings.
It follows existing signed-in catalogue access and is not added to the three
guest demos. A dedicated nonprivileged QA reader owns four verification runs;
temporary operator/reader sessions were revoked. Existing users' content was
not edited. Known residual issues and exact unsupported story mechanics are
documented in the audit and `docs/cat-open-doors-coverage.md`.

Release 2026-10-09: moderation quota, test subscriptions and reader advertising
are committed, pushed to main and deployed. API/auth/Builder images use
`fraerapp-<service>:reader-fc2d78e`; the final frontend fix is `d7107d0`.
Backup `backups/reader-subscriptions-20261009-005048` contains verified PostgreSQL
dumps for both databases, prior runtime files/configuration, release sources and
a receipt with JAR/static hashes. Rollback tags are
`fraerapp-<service>:before-reader-20261009-005048`. Six services are healthy;
API migration 20 and auth migration 9 succeeded. Origin/public assets, running
JARs and image revisions match. Home, readiness, catalog, subscription page,
admin page and tariff endpoint return 200; anonymous advertising/admin/account
access remains denied. Recent API/auth error counts are zero. Published static
files pass the RU/EN reader-ad and admin browser fixtures at 1440/390/320px; all
account/API mutations in browser verification remain synthetic. Checks: 89 API,
42 auth, 73 Node tests plus subscription, admin, moderation quota and chapter-tab
browser journeys. Local output/ notes remain outside the release.

Reader advertisements (deployed): new registrations
remain Reader (`player`). `/auth/me` exposes live `subscriptionActive`; the API
only offers ads when auth explicitly confirms false. Missing entitlement during
an auth/API rolling deployment suppresses ads. A manual author role alone does
not remove ads. API V20 stores a single versioned configuration and counters per
reader. Default is enabled, every five successful scene transitions across saves
and stories. First entry, reload and rendering do not count; endings suppress the
pause and carry it forward. Paid/disabled transitions clear the counter.
The reader lock serializes choices and atomic one-time delivery. Claim rechecks
subscription/config; browser failures never block reading and can retry on a
later transition, including loops to the same scene. Language-only rendering
does not retry. Native RU/EN dialog closes immediately with Continue or Escape.
No external ad network, timers, scripts or tracking. Delivery is not a billing
impression. Admin `/auth/admin#advertising` controls enablement, interval 1–100,
optional plain-text creative and safe HTTPS/same-site link, with preview and
version-conflict protection. Subscription benefits/expiry FAQ explain ad-free
reading. Assets: reader-ads JS/CSS v1, admin-reader-ads v1, admin-panel JS/CSS v3,
engine-87, subscription.js v2. Design: docs/reader-ads.md. Verification: 89 API,
42 auth and 73 frontend/Builder tests; scripts/check-reader-ads.cjs exercises the
real engine request adapter and admin UI in RU/EN at 1440/390/320px, including
reload, dismissal, network recovery, late responses, URL safety and role loss.

Author subscriptions (deployed): `/subscription/`
offers the owner-approved Author tariff of 139 RUB per calendar month. Checkout
is explicitly a test: zero charged, no card data/provider or automatic renewal.
Auth V9 stores per-user subscriptions, immutable test orders (price 13900 kopecks,
charge 0) and events. SubscriptionService serializes checkout and revocation on
the user row; request IDs deduplicate retries, including reload retries via
user-scoped sessionStorage. Active renewals add a calendar month in UTC to the
existing expiry. Expired access is renewed from now. User confirmed expiry should
remove subscription access until renewal, retaining stories and manual roles.
The effective_user_roles view unions explicit roles with unexpired/unrevoked
subscription author access. /auth/me and JWT issuance use current effective roles;
API already resolves live roles through auth on every request. No expiry job is
needed. Manual grants survive expiry/revocation. Explicit removal of Author or
demotion to Reader revokes a current subscription too, with the admin as actor.
Blocking retains its existing session denial; deletion cascades subscription data.

Admin `/auth/admin#subscriptions` offers search, status filters, pagination,
counts, dates, last 100 orders/events and version-checked revocation with a reason.
Actor identity/email is visible only in admin history. The customer page shows
access, confirmation, renewal, history and FAQ; failures preserve retry identity.
The account dialog and home footer link to subscriptions. Create for a reader
now opens subscriptions after refreshing roles; old public author-request modal
is removed. The old API/admin request list remains for pending requests and
manual grants. Checkout sign-in resumes only the fixed subscription route with
a 30-minute intent. New assets: subscription JS/CSS/page v1, admin-subscriptions
v1, admin-panel JS/CSS v2, account-dialogs JS/CSS v2, standalone-dialogs v2, engine-86.
`AUTH_SUBSCRIPTION_MOCK_ENABLED=false` disables new mock purchases, without
revoking existing periods. A real payment provider must use independently
verified server events before granting access; test orders must not be treated
as revenue or silently converted to paid charges. Design: docs/subscriptions.md.
Browser fixtures: scripts/check-subscriptions.cjs (RU/EN 1440/390/320px), plus
the existing four-width admin checks. Production payment processing is untested
and intentionally absent.
Checks: 41 auth, 81 API and 73 frontend/Builder tests pass, plus production
validation and browser journeys for subscriptions and existing admin sections.

Author moderation capacity (deployed): one story per
owner may await a moderator's response. Chapters of a schemaVersion 2 story share
one slot; legacy nested collections use their top-level collection. Standalone
scenarios each occupy one slot. Draft creation/saving is unaffected. Approval
(including approval without publication), rejection or complete withdrawal frees
the slot. Moderator hiding/archiving/deleting a pending item completes its review
as rejected; other pending parts of that story still occupy the slot. Replacing
the pending revision of the same story remains possible.
ReviewCapacityService enforces this in both submission owners under the existing
collection structure lock, including admin compatibility routes and atomic batch
submissions. V19 adds review_scope to freeze the submitted story identity when
chapters are later moved. Legacy null scopes are derived from memberships and
adopted on the next successful submission; existing pending submissions are not
removed. Multiple legacy pending stories block new submissions until resolved.
Quota conflicts return private/no-store HTTP 409 with REVIEW_LIMIT_REACHED.
Author summaries expose reviewLimitReached; Builder and author workspaces show
a localized explanation and disable submission while keeping drafts editable.
Collection Refresh list and window focus refresh eligibility without replacing
unsaved edits; Builder refreshes status on focus. Backend checks remain final.
Assets: app builder-51, workspace-entry v6, collection-workspace v7,
story-workspace v2, collection-ui v5, review-limit v1. Verification: 81 API,
35 auth and 72 frontend/Builder tests; scripts/check-review-limit.cjs covers
RU/EN at 1440/390px with isolated fixtures.
The older scripts/check-chapters-ui.mjs is stale: it still expects the folder
picker removed before this change and times out at that selector. It is not
evidence for the current story editor; use check-review-limit.cjs and
check-chapter-tabs.cjs for these author workflows.

Admin usability redesign (deployed from 1880be3, pushed to main): `/auth/admin`
now serves `auth-service/src/main/resources/admin.html`, with frontend
`admin-panel.js?v=1` and `admin-panel.css?v=1`. The old Java-embedded renderer is
removed. Users, author requests, login-link history, invitations/recovery and
personal passkeys have separate views; story moderation retains its existing
workspace. User cards combine account/story metrics, messages and role/access
actions. Role changes, blocking and key removal explain consequences; permanent
account deletion requires the selected email. Messages retain text after failure.
`GET /auth/admin/users` accepts role/status filters before pagination and clamps
empty last pages. Existing admin/session and last-active-admin checks remain.
Auth errors expose only allowlisted reason codes/messages; recent-auth-required
does not revoke the admin UI. Late searches/mutations cannot overwrite a different
user or draft; links are cleared on navigation. No schema migration. Implementation
and section audit: `docs/admin-usability.md`; synthetic browser journeys:
`scripts/check-admin-panel.cjs`. Backup: backups/admin-usability-20261008-215037
(auth database, runtime files, environment/compose and release receipt). Release
image: fraerapp-auth-service:admin-1880be3; rollback image:
fraerapp-auth-service:before-admin-20261008-215037. The image layers the verified
local bootJar over the existing runtime, preserving entrypoint and configuration.
All six services are healthy; running JAR/commit and public JS/CSS hashes match.
Home/readiness/catalog/admin return 200, private admin routes reject anonymous
requests with 401, noindex remains set, and recent API/auth logs have no errors.
Checks: 35 auth, 74 API and 71 frontend/Builder tests; four-width browser fixtures.
Published guest/login layout also passes in a clean browser at 1440/390px.

Release status (2026-10-08): commit ffaaf23 captures all accumulated project
changes and was pushed to main, including the preceding 13 local commits.
The new notification API/frontend are deployed; the earlier runtime sources and
active assets were already present and matched the checkout before this release.
Earlier uncommitted/unpushed notes below describe their historical release state.
At that release only local image-generation notes in output/ remained outside Git.

Account inbox clearing (account-ui v6 / engine-85): every notice has Delete;
Clear all removes all of the current user's read/unread notices, including rows
beyond the 100-item display limit. Authenticated DELETE /api/account/notifications
and /api/account/notifications/{id} return the updated private/no-store account.
Queries scope deletion by the active user ID; missing/foreign IDs are idempotent
no-ops. Shared SPA/standalone account UI updates the unread badge, preserves the
list on failure and ignores stale polling responses after a mutation. New notices
remain enabled; moderation history and release deduplication records are untouched.
No schema migration. Deployed from ffaaf23 with backup
backups/notifications-20261008-211946. Six services are healthy, public
home/readiness/catalog return 200 and all four published frontend files match
local SHA-256. Running API JAR and release label match the verified artifact;
story IDs, owners, publication revisions and visibility are unchanged. Recent
API/auth logs contain no errors. Anonymous account/delete calls return 401.
Verification: 74 API and 33 auth tests pass; 17 baseline frontend tests pass;
browser fixtures using both local and published static files pass in RU/EN at
1440/390/320px without mutating real accounts. All 71 frontend/Builder tests pass;
Builder help, chapter tabs and reader layout browser checks also pass. The suite
now checks the shared account-dialogs.js template and its engine mount instead of
looking for modal-sound-toggle in index.html. Accumulated project changes are
included in the release at the owner's explicit request; local image-generation
notes in output/ and private operator notes are excluded from Git.

Builder Russian terminology: use «Медиафайлы», «Медиафайлы истории» and
«Медиафайлы сцены» throughout editor, scenario board, help and example description.
Only visible wording changed; JSON assets keys and existing file IDs are unchanged.
Versions: app builder-50, board-12, help v3.

Builder classification (app builder-49, theme v22, genre-topic.js v1): Genre and
Topic are single selects in one responsive two-column row. All 13 agreed genres
and 15 topics are offered, with an empty option. Existing custom genre/topic
values are retained on import. Labels support RU/EN; stored values remain stable.
Optional StoryDocument.topic survives normalization, drafts, revisions, publication
and entity export. V18 adds nullable stories.topic; existing stories need no edit.
This does not add topic filters or badges to the public catalog.

My stories uses author-workspace.css v1: Builder palette (#684e86 background,
#f9eaea panels, #4f3a68 text, #7f64a4 borders), shared fonts, 37px block heading
line height and a single-column phone layout. The collection workspace no longer
renders a duplicate Home link or folder/document emoji; details use CSS chevrons
on the author page. Shared top navigation and account/settings dialogs remain
the common components. workspace-entry v5 loads collection-workspace v6.

Reader CSS v4 slightly strengthens radial edge shading and sets bottom panel
clearance to 38px (approximately 1 CSS cm), or the device safe-area inset if larger.

Reading layout v3 (reader.css v4, reader-presentation.js v2, engine-84) supersedes
the two-stage v2 presentation below: description and all actual choices appear
together in a centered lower panel. Desktop choices wrap in rows; mobile choices
stack. Characteristics start collapsed behind a star icon at the left, with a
two-column list on mobile. Radial edge shading overlays centered artwork.
The cat demo replaces only its known technical background URLs in the reader
with /assets/stories/cat-sofa-background-v2.png; custom art and other stories
keep their authored URLs. Published story JSON and player state are unchanged.
Removed Continue/reread presentation and per-stat icons per the new mockup.

Reading presentation v2 (reader.css v2, reader-presentation.js v1, engine-83):
full-width centered author artwork, shared navigation over the image, compact
bottom-right panels on desktop and bottom-center panels on mobile. Narration
with Continue precedes choices; Continue/reread never submits a choice or
changes state. Real choices retain server handling. Compact characteristics
have neutral icons, are collapsed on phones, and cat-demo stat labels are
localized. Routine saved status is visually hidden but remains accessible;
errors stay visible. Current API has no speaker or paid currency metadata;
speech tails and paid choices are not implemented. Author artwork is preserved.

Loading screen (loading.css v2): hide only the shared Home link while
#auth-loading-screen is visible. It reappears on screens that use Home after
loading completes. Verified with delayed authentication at 390px and 1440px.

Shared Home button (site-controls v5, engine-81): matches Figma library 176:13
with the existing Builder Figma arrow SVG, 2px stroke, Inter Medium 23/25,
#FEE3E2 text and 10px icon gap. Mobile text is 18/25. The library Home link
aligns to its content inset; Home/settings/account remain one row on all pages.
Verified across eleven routes at 1440/768/390/320px; 17 frontend tests and auth
tests/build pass. Working changes remain uncommitted and unpushed.

Guest carousel spacing (home cosmos-34, home-fit v6, engine-82): use normal-flow
margin-top clamp(40px, 6svh, 64px), with 32px on mobile. The prior v5 transform
moved cards below the home section's clipping boundary at tablet widths.
Remove that transform and its JS positioning calculation; card sizing now
accounts for the actual margin. Verified card bottoms stay inside the section
and above the footer before/after carousel navigation at seven viewport sizes.

Shared Home navigation (site-controls v4, engine-79, library v9): outside the
homepage, Home shares the settings/account flex row; Builder retains its existing
Home link in a non-wrapping header. Duplicate links/empty library nav are hidden.
Empty collection catalog contributes no margin or grid gap; a four-story desktop
library fits a 1440×900 viewport. Small screens and larger catalogs scroll normally.

Builder theme v21: structure uses the normal document scroll. Remove the sticky
band, viewport height caps and the tree's overflow container on all breakpoints.
Expanded items extend the page; mouse wheel over the tree scrolls the document.
This supersedes the earlier request to keep the structure fixed during scrolling.

Guest homepage spacing (home cosmos-32, home-fit v4, engine-78): remove extra
top space for the introduction, reduce the gap before the carousel, and give guest
desktop cards the full content scale subject to footer fit. Phone cards use 66vw
(up to 300px) instead of 58vw. Signed-in spacing and card scale stay as before.
Verified larger, higher cards and no footer overlap at 320–1722px.

Reader/shared dialogs release (engine-77, home cosmos-31, site-controls v3):
the homepage search now shares the icon row at ALL widths. The single account
and settings template lives in account-dialogs.js, styled by account-dialogs.css;
standalone-dialogs.js wires non-runtime pages without their translation dictionaries
overwriting shared labels. Account actions have a consistent 12px gap. Shared
settings include sound, volume, language, notifications, support and passkey.
reader.css provides neutral choices, centered author artwork, side stats (collapsed
initially on phones), and persistent shared icons. Current runtime scenes supply
narrative text; speaker tails and paid opal choices are not part of the data contract
and are not simulated. Existing story artwork, choices, stat values and saves remain
the source of content. Browser checks cover 320–1722px and eleven page routes.

Homepage search remains visible only on the signed-in homepage; guests and other
routes keep it hidden. Its input and handlers are preserved in the shared icon row.
The earlier mobile-only move (engine-76/home cosmos-30) is superseded by this release.

Builder theme v20 uses the revised Figma 221:130 palette (read from native Figma
properties after MCP quota prevented design-context access): background #684E86,
panels #F9EAEA, ink #4F3A68, #7F64A4 at 17%/35% for row fills/selection.
Toolbar fills are #DAAFE4 at 11%, text #FEE3E2, strokes white at 58%.
Builder navigation places Home and shared settings/account on the same flex row;
site-controls v2 mounts into that header only when present. Other pages retain
their existing navigation placement. Toolbar wraps naturally without horizontal
scrolling; very narrow phones may require more than two rows for readable labels.

## Builder chapter workspace

Builder-48 / theme v19 / help v2 replaces the old author picker, runtime actions
and validation cards with one panel. Tabs are ordered My chapter → Validation →
Publication, with icon buttons and keyboard navigation. My chapter shows the
opened parent/season/chapter, server-save state and a scene-text/choice preview.
The preview is a read-only local snapshot, not an interactive engine playthrough.
Validation checks the current unsaved JSON without importing; submission blocks
on local errors, saves the draft and uses existing server review validation.
Publication shows current review status and moderator feedback. Creation/search
remain in My Stories; the obsolete Builder new-story/picker UI is removed.
Browser regression: scripts/check-chapter-tabs.cjs (six widths, keyboard, local
validation, blocked invalid submissions, save/review and preview). Help and serial
story checks cover the surrounding workflow. No backend/data changes.

## Current author model: story → chapters → scenes

The owner replaced the arbitrary-folder UX with a serial story. New work documents
use collection schemaVersion 2: shared title, description, cover, genre and completion
status; ordered scenario chapters; optional per-chapter season label. Nested folder
creation and manual transfer controls are removed from the ordinary UI. V1 immutable
documents, saves and explicit relation APIs remain readable for exported-file and
historical-save compatibility. No database migration or data deletion is required.
Pre-release production inspection found zero work_collections and collection_runs.

My Stories creates a work, then Add chapter saves the work, creates a private chapter
and opens its Builder. Builder resolves its parent and shows Chapter builder.
My Stories is accessed through the account menu; the duplicate Builder header link
is removed in builder-47. New chapters inherit declarations from existing chapter
drafts. Runtime values carry from the exact finished predecessor in the same reading
chain, across season boundaries. Scene-local variables are excluded; incompatible
global type changes are rejected. Direct starts/relations cannot bypass the TOC.

POST /api/author/collections/{id}/chapters/review submits one selected chapter and
changed work metadata atomically, without submitting future chapter drafts. Existing
publication/moderation policy and generation checks still apply. Per-chapter release
regression verifies later chapters remain private, then become readable with inherited
progress when approved. Reader TOCs expose only published chapters, show seasons,
Continue/Start again and an awaiting-release message while the work is in development.

Release clients: engine-75, builder-47, collection UI/reader v4, workspace v5,
workspace-entry v4, folder-review v3. Chapter rows use the current dependency review
state rather than the target picker's incomplete metadata. Verification: 71 API, 33 auth, 70 frontend tests;
scripts/check-serial-stories.cjs covers author/reader journeys at 1440/768/390/320px;
Builder help passes at the same widths in RU/EN. The older check-chapters-ui.mjs
describes the retired folder/manual-transfer UI; use the serial-story browser check
for current author flows. Changes are uncommitted/unpushed.
Published backup: `backups/serial-stories-20261006-124720`. API/static verification
passed; published story identities, owners, slugs, revisions and visibility match
the pre-release manifest. All six services are healthy.

Builder theme v18 sets H3-style block headings to 28px with a 37px line-height,
including wrapped author-workspace headings at narrow widths (replacing 49px).
Theme v16 compacts desktop toolbar spacing (6px gaps, 8px inline
padding) while retaining Inter 23px and natural flex wrapping. All seven actions
fit at a 1722px viewport; 1600/1440/768/390/320px checks confirm wrapping only
when the next button cannot fit, with no toolbar horizontal overflow.

Builder-44 removes the redundant Story JSON preview panel and its DOM update.
Toolbar JSON import/paste/copy/download and story validation remain intact.
Theme v15 reserves bottom space for floating actions so the final validation
panel remains accessible at narrow widths. Verified: 25 Builder tests and
browser help checks in RU/EN at 1440/768/390/320px. Initial backup:
`backups/builder-remove-json-20261006-115808`. Uncommitted/unpushed.

Guest home search is hidden until body.is-authenticated (home.css cosmos-29).
Shared settings/account controls remain visible. collections.css v3 explicitly
honors hidden on chapter-navigation: its display:grid previously exposed an
empty bordered story-entry panel, including for guests. Browser verification
passed for guest/signed-in states at 1440/768/390/320px. Published backup:
`backups/guest-card-20261006-115555`; changes remain uncommitted/unpushed.

Builder theme v14 uses typography from the actual constructor frame 221:130:
Playfair Display SC Regular H1 40/55px, H3 28/59px; Inter Medium tree labels
15px/1.3 and desktop toolbar/home-link text 23/25px. Existing compact mobile
toolbar remains. No palette or component geometry was copied from Figma.
Important preview correction: file:// Builder previously loaded zero font faces
because /typography.css resolved outside the checkout. Both Builder entrypoints
now select ../frontend/typography.css only under file://; typography v2 resolves
font URLs relative to its own stylesheet. Local font loading is verified at
1440/390px, with #684E86 background and #FAF7FC panels retained. Browser help
checks pass at four widths in RU/EN. Backup:
`backups/builder-frame-fonts-20261006-115036`. No commit/push in this correction.

Builder theme v13: owner-requested background #684E86; panels remain #FAF7FC.
Text directly on the purple header uses #FEE3E2 for contrast; typography unchanged.
Published backup: `backups/builder-background-20261006-114616`.

Builder-43 / theme v12 adds contextual help via `story-builder/help.js` v1:
17 RU/EN topics cover metadata, global/local variables and assets, scenes,
choices, conditions, scene/choice effects, endings, structure, relations,
author workspace, server actions, validation and JSON. Small question buttons
beside block titles open one native dialog with an explanation and example.
Escape/close returns focus; help never changes the draft and remains available
when author editing is locked. Text describes persisted per-scene locals and
choice effects before transition conditions, matching GameService behavior.
Browser verification: all topics, RU/EN, 1440/768/390/320px, unchanged drafts,
no horizontal overflow; 25 Builder tests pass. Backup:
`backups/builder-help-20261006-114405`. Changes local/deployed, uncommitted/unpushed.

Builder theme v11 restores the owner's Figma 4:6 typography after the light-theme
change: Playfair Display SC Regular H1 40/55px with .11em tracking; block titles
use H3 28/59px. Body, fields and tree labels use Montserrat; controls retain Inter
from the Figma Button role and compact responsive sizing. Shared account/settings
dialog headings and body use the same font families; all fonts reuse local assets.
The light palette remains. Browser checks passed on 11 pages at four widths.
Published with backup `backups/builder-fonts-20261006-113714`; not committed/pushed.

## Shared settings/account controls (deployed 2026-10-06)

`site-controls.js/css` v1 adds the shared neon Settings/Account pair at the top
right of every HTML entrypoint: reader SPA, Builder, scenario map, author and
moderator workspaces, access recovery, legal pages and auth admin. Engine-73
adapts the SPA buttons to its existing dialogs and hides the older home/library
duplicates. On other pages native dialogs provide account links, shared inbox,
language/volume/notification preferences; sign-in and advanced settings link to
the existing SPA via `?panel=account|settings|favorites`. Builder language also
updates its existing stored locale. The header takes its own row to avoid content
overlap, and the admin request sidebar starts below it.

Account UI v5 paints the shared icon using the same guest/signed/unread states
and notification read API. Outside the SPA, identity/role links come from
`/auth/me`, not cached roles. No auth/role/publication policy changed. Admin Java
changes are only the CSS/script tags in its HTML template.
Checks: 70 frontend/Builder tests, 33 auth tests and
`scripts/check-site-controls.cjs` across 11 pages at 1440/768/390/320px, including
guest/signed/unread states, dialogs and notification read. Backup:
`backups/site-controls-20261006-112656`. Six healthy services; home/health/catalog
and admin HTTP 200; no recent API/auth errors. Local changes are deployed but
not committed/pushed. Unrelated local legal wording was retained locally; only
navigation tags and the legal CSS cache version were applied to production legal
pages, preserving their existing text.

## Builder light theme (deployed 2026-10-06)

Theme v10 / builder-42 replaces the purple builder palette with background
#E8DDEA, lighter #FAF7FC panels, selected #DCD7EB and accent #8879A4. Editor,
scenario map, JSON dialog and Builder-only collection components share the theme;
headings use the control sans-serif family. Clear draft and floating + Scene keep
their peach/pink gradients. The header session/API/language block is hidden;
its bindings remain for existing session initialization and runtime selection.
Floating Down sits between Up and + Scene and scrolls to the document bottom.
Below desktop widths, tree disclosure gutters and nested indents are narrower;
long labels may wrap. Bounded sticky structure and wrapping toolbars are retained.
Verified 11 viewport sizes (320–1920px, including short windows), scrolling in both
directions, sticky collision boundaries, editor/dialog/map and 25 Builder tests.
Backup: `backups/builder-light-20261006-111646`. Four deployed file hashes match;
six services healthy, public/health/catalog HTTP 200, no recent API/auth errors.
Changes are local and deployed, not committed or pushed in this task.

## Ordinary nested folders (deployed 2026-10-06)

Release c5a6f84 is deployed and verified. Backup/receipt:
`backups/plain-folders-20261006-094253`. Six healthy services, readiness UP, V17,
runtime/public hashes match, no recent API/auth errors. Story/folder manifests
preserved; no production sample data created. Checks: 69 API, 33 auth, 70 frontend,
27 PostgreSQL folder regressions plus a final notification regression; browser
1440/390/320px. Temporary fixture/tunnel removed. Committed locally, no Git push.

The owner clarified that volume/cycle names are only possible author-chosen names,
not product types. The UI now has one Folder concept, a free title, ordered own
stories and nested folders. Removed the kind selector, type filter and literary
badges. No nesting ranks or four-level breadcrumb limit remain. The server checks
the actual membership graph for cycles and reserves one parent per item across
draft/published structure. Foreign links remain forbidden; one expandable moderation
application and independent/mapped reading remain. Only neighboring direct scenarios
can transfer values; nested folders are opened through their contents, never started
as scenarios. Imports resolve forward folder references atomically and reject cycles.

Existing immutable documents and DB `collection_type` values are retained for file
compatibility, with identical folder behavior for story/volume/cycle/catalog. New UI
folders use the existing story storage value, which is not a user choice. No schema
migration or history rewrite. Release assets: engine-72, builder-41, collection
modules v3, folder-review/workspace-entry v2. The previous deployed release was
782ab67.

## Public folders correction (deployed 2026-10-06)

Correction `782ab67` is deployed (engine-71, builder-40, collection modules v2).
All six services are healthy, API readiness is UP, V17 remains current, release
asset/source hashes match, and recent API/auth error markers are zero. Story and
folder manifests are unchanged; no production sample works were created. Backup
and restricted receipt: `backups/folders-20261006-092158`. Verification passed:
66 API, 33 auth, 70 frontend tests, 24 collection tests on PostgreSQL and browser
fixtures at 1440/390/320px. Independent requirements/quality reviews passed.
No Git push; unrelated local changes remain intact.

The owner corrected the initial collection UX: work grouping should behave like
folders, exclusively containing/linking the author's own works. Public folders
and one expandable moderation application were explicitly selected. The default
author/moderator workspace now presents a folder tree; ordinary story details
remain available through direct links and the secondary list view. Author actions
are create folder, add own works, save and submit. Keys, dependency history and
transfer policies stay under additional settings. Reader labels use folders.

`FolderWorkspaceService` projects existing records; no new schema or separate
publication mechanism is introduced. `/api/author/folders` and
`/api/moderation/folders` return grouped trees. Moderator folder review returns exact
pending snapshots; one explicit decision checks the complete item set, generations,
pinned dependencies and moderator/self-review policy, then uses StoryWorkflowService
atomically. Unchanged published parts are only context. An updated chapter under
an unchanged published folder still appears in its folder application. Explicit
resubmission can renew a superseded dependency snapshot with a new immutable parent
revision; previous review history remains intact.

All authoring references are owner-only, including raw metadata, catalog membership,
package import and synthetic tests. The picker returns only own works. Legacy
cross-owner links are unavailable in folder/continuation projections; normal direct
reading of another author's published story remains permitted. Historical JSON,
revisions and saves are retained. Deployment status is recorded in the runbook.

## Chapters and collections (deployed 2026-10-06)

Implementation `39f41f7` is deployed: engine-70, builder-39, account-ui v4.
V16–V17 applied; all six services are healthy, API readiness is UP, public files
match the committed release, and recent API/auth logs contain no error markers.
Existing story identities, owners, slugs, publication revisions and visibility
match the pre-release manifest. No sample works were added to production.
Validation: 59 API, 33 auth and 70 frontend/Builder tests, isolated PostgreSQL
migration/workflow regressions and browser fixtures at 1440/390/320px passed.
Privileged mutations were tested on synthetic fixtures, not real user accounts.
Backup and release receipt: `backups/chapters-20261006-012825`; see DEPLOY_RUNBOOK.
The implementation and release documentation are committed locally; no Git push
was performed. Pre-existing unrelated workspace changes remain intact.

V16 adds versioned `work_collections` of type story/volume/cycle/catalog, immutable
collection versions, derived membership/title indexes, moderation audit, favorites,
chapter release notices, pinned reading chains and transfer provenance. Existing
Story records remain executable scenarios: standalone stories or chapters. Existing
IDs, slugs, ownership, publications, saves and ratings are retained. A chapter has
one main story; story/volume main-parent reservations cover both draft and published
structure. Catalog memberships now require the same owner. Collection structural writes
serialize through a dedicated lock; reading writes serialize per reader.
V17 records exact child revisions associated with a batch submission; replacing
a child's submission does not rewrite the parent's historical dependency snapshot.

Story JSON optionally includes `metadata.schemaVersion`, typed `relations`, and an
`inputContract`. Transfers support independent defaults or an explicit typed field
mapping from an owned completed save. Target defaults precede transferred values,
then start-scene effects execute once. Scene-local fields and undeclared contract
inputs do not transfer. Saves pin scenario revisions; reading chains pin their TOC
revision until an explicit update. New chapter attempts fork the chain; existing
later saves remain unchanged. Semantic continuations support explicit new attempts,
and all transition writes use reader-scoped request IDs for safe retries.

`StoryWorkflowService` remains the publication decision entrypoint; collection
decisions use the shared ModerationPolicy. Collection publication never publishes
child drafts. Only accessible public children appear in public TOCs/search/links;
unlisted children are not promoted through public parents. Container hiding does
not silently hide independently published children; moderator-selected descendant
restrictions are explicit and audited. Guest access retains the three legacy demos.
Collection covers use bundled `/assets/` resources, preserving the existing ban on
mutable external publication media.
Public catalog projections suppress a standalone entry after it becomes a published
chapter, without changing stored collection documents. Filtered
reading TOCs expose only accessible actual predecessor IDs; independent chapters
remain startable when an intervening chapter is unavailable.

Author/moderator workspaces include the collections view at
`/my-stories/?view=collections` and `/moderation/?view=collections`. Builder offers
relations, incoming contracts and synthetic transfer tests. `/collections/<key-or-id>`
opens a reader TOC; `/read/<sessionId>?run=<runId>` retains exact branch context.
Collection APIs use `/api/author/collections`, `/api/moderation/collections`,
`/api/catalog/collections`; reader APIs use `/api/collections/<id>/runs`,
`/api/collection-runs/<id>`, and session relation endpoints. Direct story entry
context exposes permitted prerequisites and the current reader's eligible saves.
Package import is previewed before applying generations; changes create private
drafts and stale/foreign conflicts cannot overwrite another author's work.

New personal records are reader-owned chain membership, selected source-save
provenance, target revision and the allowlisted transferred values. They extend the
existing saved-progression data, remain private, and do not introduce external
tracking or email delivery. Public views expose no private tree sizes or titles.
Chapter release notifications are deduplicated independently of scene notifications.

Synthetic examples: `docs/examples/chapters-package.json`. Browser regression:
`scripts/check-chapters-ui.mjs` (isolated fixtures, bundled Playwright via NODE_PATH).
Requirements: `docs/prompts/story-chapters-collections-codex.md`. No sample story is
seeded or published during deployment.

Moderation is deployed (2026-10-06, implementation `ecac99b`, engine-69,
builder-38, workspace modules v1). `/my-stories/` and `/moderation/` are available
through current-role checks; auth administration grants/revokes the independent
moderator role. All four owner-approved legacy publications, their content,
owners, links and saved runs were preserved. Runtime migration policy is back to
`review`; a second API startup created no duplicate migration records. All six
services are healthy, public guest/privacy checks and release asset hashes pass,
and recent API/auth logs have no errors. Production mutating smoke tests did not
use real accounts. See the moderation rollout section in DEPLOY_RUNBOOK.md.

Builder theme v9/app builder-37: all Add actions use the peach/pink gradient, including nested choices, conditions, effects, local variables/assets and scenario-map Add controls. Dynamic controls use the add-button class through addButton; language and creation behavior are unchanged.

Builder theme v8: structure's outer grid item stretches within its own grid row; the inner band is sticky at top 12px. It stays visible during editor scrolling and stops at the row boundary before the author workspace, avoiding the previous cross-row overlap. Tree height remains viewport bounded. Browser checks verify sticky top in side-by-side layouts and collision-free scrolling at 12 widths.

Builder theme v7: native file-selector buttons retain their gradient but return to compact proportions (2px vertical / 6px horizontal padding, 1.2 line-height, 6px radius).

Builder theme v6 fixes scrolling layout: at two-column widths the structure panel stays in document flow, preventing its sticky box from overlapping the author workspace below it. Side-by-side structure/editor persists down to 701px; at <=700px structure is capped at 380px wide with a bounded scrolling tree. Back-to-top is always visible. Regression reproduced at 1024px when the author workspace reaches y=200, then verified fixed with working back-to-top at 12 widths from 320 to 1440px including breakpoint edges.

Builder theme v5: toolbar actions wrap to additional rows whenever needed; horizontal scrolling is removed per owner preference. Compact desktop sizing is retained. Browser checks at 1440/1024/768/390/320px confirm all actions remain within the toolbar width.

Builder theme v4: floating + Scene action shares the Delete gradient styling. Browser checks reconfirm nested Choices/local-variable/asset panels use #5A427C and light text; both HTML entrypoints bump the theme cache version.

Builder theme v3: tree rows share 36px height and 4px spacing; leaves use the full row width, disclosure icons have a dedicated inset column, and scene move buttons have separate borders/fills. Tree scrolling no longer compresses groups in short viewports. Flexible editor columns avoid intermediate-width overflow; dialogs scroll in short windows. Nested scene panels explicitly use #5A427C, and native file-selector buttons use the same gradient as Delete.

Builder theme v2: editor/map panels, fields and JSON dialog use opaque #5A427C against #644F82. Scene summary subtitles now use light #FEE3E2. Main editor toolbar uses compact 12–15px text and 36px buttons in one row; verified all seven fit at 1024px and 1440px. Narrow screens retain one horizontally scrollable toolbar with 44px touch targets.

Builder design from Figma 221:130: shared story-builder/theme.css v1 covers editor, JSON dialog and scenario map. Tokens: background #644f82, text #fee3e2, white 58% borders, lavender 11% surfaces, peach #f5a279 at 43% for selected items and 17% for grouping. Home link moved above title; app builder-36 updates its RU/EN label. Downloaded Figma arrow assets live under story-builder/assets/figma. Theme loads after shared typography; existing responsive layout, auth and editing behavior are retained. Native browser confirm/prompt dialogs remain browser-controlled.

Builder visual foundation (builder-32): the /builder/ editor page uses the account dialog's translucent purple gradient, composited over a stable #33214a base. Header text is light for contrast. This is the first background change; editor panels and the separate scenario board retain their existing styling.

Reader actions (engine-68): any active save offers Restart left and Continue right, including the first run before discovering an ending. A finished save offers only Restart; an untouched story offers only Start. Restart creates a fresh save, retaining personal ending discoveries.

Reader card layout (engine-67, story-dialog v5): removed the redundant total-endings tile; personal endings discovered retains the total. A compact progress bar sits left of the rating in one responsive row. Restart sits left of Continue in a shared action row with identical button styling; existing save/visibility behavior is unchanged.

Refined navigation icons (engine-66, account-ui v2, library v8): search, carousel arrows, settings and generic account silhouette now use the owner's newer thin pink neon references, extracted as transparent assets. Home and library share search/settings/account artwork. Character picker removed from the profile; existing stored avatar preferences are retained server-side but no longer affect the icon. Guest silhouette is pale, signed-in full color, unread notifications add a small peach/pink dot. Existing inbox/read actions and role links remain.

Reader completion (engine-65, story-dialog v4, API V14): cover-top-left status labels are Завершена / В разработке / Приостановлено. Only completed stories show personal progress (existing scene-order completionRate, explicitly approximate until a final; capped at 99 before a final). Any discovered ending makes completion 100%. reader_endings stores distinct player/story/ending keys, seeded from existing finished saves; discovery is serialized by a player lock and survives save reset/new runs. Metrics expose private discoveredEndings filtered to currently published ending scenes. The card replaces global run counts with personal endings discovered, retains total endings, and offers Start again after completion; active replays retain Continue plus Start again. Restart creates a new save. Gameplay clears cached catalogue progress. V14 marks the three named demos completed and Новая история in development, per owner instruction.

Guest story introduction (engine-64, cosmos-27): opening a story detail as a guest shows a compact lilac dialog over the card with a 4px backdrop blur, explaining the three demo stories. Continue dismisses only this introduction, Register opens existing authentication. Signed-in users skip it. Card is inert until dismissal, Escape and route navigation clean up the overlay, and metric refreshes do not reopen it. Existing gameplay authentication remains unchanged.

Homepage navigation artwork (cosmos-26): transparent search-magic.png (40px) and carousel-arrow-magic.png (48×64px) follow the user's pink glass/sparkle references. The previous arrow mirrors the same image. Existing search submission and carousel handlers, accessible button names and focus outlines remain. Library search is unchanged.

Cookie artwork/H3 (cosmos-25): shared cookie notice uses the supplied magical frame as an alpha PNG with nine-slice borders, plus a small transparent cookie illustration before the copy. Content determines height: 600×120px desktop, 350×185px at 390px viewport, 280×205px at 320px. Mobile actions occupy a separate row. Existing acknowledgement, policy link and wording are retained. Homepage tagline uses the heading family at 28px on full desktop, with existing responsive scaling. Assets were extracted from the user's references using imagegen.

Guest catalogue and author requests (engine-63, cosmos-24, library v7): homepage filters removed; library adds descending rating sort (unrated last). Guests see only the three demo cards with keys kak_shodit_v_tualet_pravilno, kak_pogladit_kota_ne_ubiv and night_train; full catalogue and non-demo details require sign-in. Catalogue responses are private/no-store. Guest Read/Create opens registration; author/admin Create opens Builder. Players can send an idempotent author access request from a shared glass dialog with outlined action. Auth migration V7 stores pending requests by user ID. Admin-only request listing powers a right sidebar, highlighted user row and role-grant action; granting author/admin clears pending request, with user-row locks serializing request/grant. Admin page refreshes while visible every 30 seconds. The legacy /api/stories list applies the same guest whitelist and private/no-store. Builder entry refreshes the session first so newly granted roles reach the API immediately. Existing demo card preview and gameplay sign-in behavior remain.

Settings icon (`cosmos-23`): home/library now use transparent settings-magic.png extracted from the user's pink gear/orbit reference; 48px button and artwork, with existing settings action unchanged.

Account avatars and inbox (`engine-61`, account-ui v1, V13): transparent fairy/fae assets replace account icons on home/library. Guest is dimmed; authenticated icon has a pink ring; unread notices add a dot. Avatar is stored by authenticated user ID in API account_preferences, shared across devices. `/api/account` returns private/no-store avatar, unread count and latest 100 notices (unread first); avatar PUT accepts only fairy/fae, per-notice read POST scopes by user. `/api/account/admin/messages` requires admin; auth admin user table has a message action. New scene keys on publication notify current favorites once per publication change; initial snapshot is seeded during migration and initial/repeated publications do not notify. There is no chapter entity: these are explicitly labelled new scenes. Profile inbox provides explicit read actions, polling every 60s while visible and refresh on focus/open. No push/email delivery. Privacy page describes avatar/inbox data.

Account spacing (`cosmos-22`): profile-only top padding reduced from 52px to 36px; account name has 20px bottom margin before Favorites. Other dialogs retain their existing spacing. Verified desktop/mobile geometry.

Heart rendering correction (story-cards v6): gradient/stroke apply only to the SVG path; SVG root has no paint/filter and is transparent. Glow is applied to the transparent button to avoid the reported rectangular SVG filter artifact. Chromium preview verified; local Playwright WebKit is unavailable.

Favorite appearance (`engine-60`, story-cards v5): selected heart uses the Create Yours peach/rose gradient (#f5a279b8 to #9c6285b8), peach outline and stronger 4px/9px peach glow. Each inline SVG has a unique gradient ID, shared across home/library/detail rendering. This replaces the earlier purple selected fill.

Story dialog cover spacing (`story-dialog.css?v=3`): cover takes spare vertical space while information uses its content height, bringing statistics within 36px of Start on desktop. At 1440×900 the current toilet story cover is 235px high; narrow/short windows preserve the visible action and internally scroll long information.

Sort/typography correction (`engine-59`, library v6, story-cards v4): homepage Favorites checkbox removed; favorites is now the second sort mode, matching library modes/order and guest empty-state behavior. Figma 176:13 verified Montserrat Regular 18/25 for search and sort values (16px responsive floor), Medium for labels/description, Inter Medium for back navigation. Sort column has a 240px minimum and no wrapping; mobile stacks full-width fields. Selected heart fill and stroke are both #33214A with the existing small peach halo.

Profile button styling (`cosmos-21`): Builder and Administrator now share the existing Favorites/Logout selector and identical 260×44px geometry, 15px type, light border/text and translucent lilac fill. Role visibility and navigation are unchanged.

Account/favorites/detail refinement (`engine-58`, `story-cards.css?v=3`, `story-dialog.css?v=2`): profile shows Builder for author/admin, Administrator for admin, with existing server authorization unchanged. Favorite toggles update matching controls in place instead of re-sorting the visible carousel. Selected hearts use #33214A fill and a small #F5A279 halo with no circular button background. Story dialog is now 640×660 max with heart beside title, rating after description, and six metrics in three columns; all four current stories fit a 1440×900 viewport. V12 adds nullable completion_status (completed/in_development/abandoned), separate from publication state; values await owner classification. Engagement metadata counts actual ending scenes using the same JSON interpretation as gameplay.

Carousel gap correction (`cosmos-20`): mobile carousel window now matches engagement cards at 1.14× card width, removing the legacy extra empty height. Mobile links sit 36px below cards and carousel top spacing gains 12px. Portrait windows 701–1399px gain 24px above the carousel; landscape/tablet and full-desktop spacing stays unchanged. Verified 1024×846, 803×923, 630×913 and 320×943 without horizontal overflow.

Story detail dialog (`engine-57`, `story-dialog.css?v=1`): public `/history/<slug>` routes now open a centered 470×600 maximum dialog over the current home/library, with shared blur/glass styling. Direct links use the library underneath. Cover, description, all statistics, favorites and rating remain; the start/continue action is outside the internally scrolling information area. Close/backdrop/Escape restore the originating route and focus. Guest auth/engagement dialogs layer above details; closing them preserves the story and scroll lock. Actual play still uses the scene screen.

Compact homepage spacing (`cosmos-19`): below 1400px the carousel receives up to 36px additional height-dependent top spacing (mobile up to 28px); catalog links use a 52px gap. Extra space tapers to zero in short viewports. Existing desktop fit reserves the gaps before sizing cards. Verified 909×930, 1000×924, 768×1024 and 1024×768 retain a visible footer without overflow; 1440×1024 composition is unchanged. Mobile retains natural vertical scrolling.

Fairy loading screen (`engine-56`, `loading.css?v=1`): existing auth-loading state now uses homepage cosmic background, a transparent fairy sprite prepared from the user's reference, an irregular alternating CSS flight path and separate pollen ring with fading tail. Desktop ring diameter is 35px; mobile 26px. Flight stage scales from 114 to 190px (roughly 3–5 CSS cm). RU copy: “Пробуждаем истории…” / “Ещё мгновение — и воображение оживёт.” EN equivalent is localized. Loading exposes a polite status; decorative graphics are aria-hidden; reduced-motion disables animation. No minimum loading delay or authentication behavior changes. Toolbar/footer/cookie notice are hidden only while loading.

Figma 84:293 typography revision (`cosmos-18`, `engine-55`, `home-fit.js?v=3`, shared `typography.css?v=1`): local Playfair Display SC Regular/Bold for heading roles, Montserrat variable for body/card titles/footer, Inter Regular/Medium for controls and captions. All frontend/legal pages and Builder/map documents load the shared stylesheet. Homepage display is 60/94 bold with 3px tracking; remaining heading 40/55 regular with 4.4px tracking; subtitle 35/57 regular with 3.85px tracking. Local Google Fonts binaries include Cyrillic and OFL licenses. At 1440×1024 browser measures hero y103, actions y399, active card y512 at 285×325, links y873 and footer y953; larger/smaller viewports remain responsive. Hero translation splits the first display line into a separate span in both languages. Existing live story data, legal links and dynamic imagery remain intact.

Wide homepage composition (`cosmos-17`, `engine-54`, `home-fit.js?v=2`): at widths >=1400px the home canvas uses full width, putting hero text/buttons at an 8.47% left inset instead of centering a capped 1440px column. Wide-only heading line spacing is tighter and the carousel scale ceiling increases; measured remaining height still reserves footer/links. At 1728×974 hero x146px and active card 307×350px with footer bottom974px/no vertical overflow. At 1000×924 previous layout fits without overflow. Mobile layout rules remain unchanged.

Library Favorites now lives in the existing Sort dropdown (`engine-53`, `library.css?v=5`). The library-only Filters disclosure and checkbox were removed. Favorites mode shows only the signed-in account's favorites (guests see the empty state), combines with search, and preserves default order. Profile Favorites shortcut selects this mode and refreshes the styled dropdown. Homepage filters are unchanged.

Modal close controls (`cosmos-16`) share a transparent, borderless 44px hit area. Keyboard/programmatic visible focus emphasizes the cross strokes and shadow instead of drawing a circular outline. Hover/press animations remain shared with Settings.

Cookie/favorites UI follow-up (`engine-52`, `cosmos-15`, `library.css?v=4`, `story-cards.css?v=2`): the cookie notice uses the same purple styling on every app route. Library favorites moved into a Filters disclosure, available to guests with an explicit empty state. Profile has a Favorites shortcut between account name and logout; it clears old search text and opens the filtered library. Guest favorite dialog uses the compact Support-style gradient button. Privacy policy now describes the view identifier and account favorites/ratings; the notice mentions view counting. Legal follow-up remains: determine/document the basis and server retention period for view analytics, and implement separate consent before collection if relying on consent. The existing “Понятно” action is acknowledgement only; no analytics opt-in or automatic view-record expiry was added in this UI change.

Story cards Figma `192:27`: shared `story-cards.css`, regular Inter 18/25, larger information panel, genre badge, exported heart icon and live server metrics. V11 adds optional story genre plus daily views, per-account ratings (1–5, replaceable), and favorites. `/api/catalog/engagement` returns public totals and only the current account's favorite/rating, with private/no-store caching. Viewing a published detail records one view per UTC day per account or anonymous secure HttpOnly `fraer_viewer` cookie; carousel impressions do not count. Metrics start at zero, unrated stories show a dash. Favorites persist across devices, appear first in default order, and can be filtered on home/library. Guests see the shared blurred dialog; the revised dialog has no heading, 17px body and a compact login button. Genre is editable in Builder and round-trips through imports/exports; existing stories without a genre show «Без жанра». No existing story genre or rating is fabricated.

Passkey registration recovery (`engine-50`): production registration options returned 401 then 403 while existing passkey authentications succeeded. The 600-second recent-auth requirement remains enforced. Registration now opens Telegram reauthentication on expired/recent-auth errors and remembers a 30-minute UI-only intent in localStorage; after an explicit successful login it reopens settings, requiring a new user click for WebAuthn. Device/server errors are normalized in both settings surfaces. No credentials or account identifiers are stored in the intent.

Latest library spacing (deployed, `library.css?v=3`): Figma `176:13` now places the main heading at y187, description at y271 and fields at y444; cards remain at y572 at 1440×1024. Increased heading/description gaps and reduced the gap below the fields accordingly. Browser geometry matches these positions with no desktop overflow.

Updated library Figma revision (deployed, `library.css?v=2`, `engine.js?v=engine-49`): title at y171, 22px two-line description at y239, search/sort at y412 with 55px height and 623/255px widths at 1440×1024; card row starts y572. Typography, white input borders and spacing now follow the latest `176:13` frame. Mobile fields stack; four stories still fit a 1440×800 viewport without scrolling.

Library redesign (deployed, `home.css?v=cosmos-14`, `library.css?v=1`, `engine.js?v=engine-48`): `/history` follows Figma `176:13`, reusing cosmic artwork, fonts and navigation icons. Compact glass cards retain real covers/titles; details and play actions remain on story-detail routes. Guest and authenticated catalogs share this visual grid. All matching stories render in wrapping rows instead of four-card pagination. Default preserves catalog order; the other modes are title, newest publication and latest update, using the shared styled dropdown. At 1440×1024 and 1440×800 four cards fit without scrolling; a local 15-story fixture renders three rows with normal page scrolling. Mobile uses two columns. The active and two left carousel cards additionally receive `-11px 0 12.3px #4f3a68` shadows.

Homepage spacing refinement (deployed, `home.css?v=cosmos-13`): desktop carousel gap is now 40–56px based on viewport height, mobile 56–68px. Links sit 44px below the carousel. The viewport-fit calculation reserves these larger gaps before sizing cards; browser verified the footer remains visible without scrolling at 1728×965.

Desktop viewport fit (deployed, `home.css?v=cosmos-12`, `engine.js?v=engine-47`): `home-fit.js?v=1` measures the actual header/copy, footer, links and result count and allocates remaining viewport height to the carousel above 700px width. Cards are capped at 85% of the former scale; carousel spacing and bottom padding are reduced. ResizeObserver, window resizing and font readiness recalculate the budget. Confirmed no page overflow and a visible footer at 1728×965, 1440×800 and 1024×768. Mobile layout is unchanged; extremely short windows/enlarged text retain a minimum card size and may scroll instead of clipping content. This supersedes earlier desktop sizing notes.

Filter dropdown styling (deployed, `home.css?v=cosmos-11`, `engine.js?v=engine-46`): author and sorting use custom listbox popups from `frontend/filter-select.js?v=1`, with solid #45305D surfaces and #F5A279 peach selection/hover. Native select elements remain hidden value/option sources for existing filter logic. The wrapper refreshes after author loading, translation and reset. Supports mouse, arrows, Home/End, Enter/Space, Escape, Tab and outside-click dismissal. Browser verified selection, keyboard use, reset and 390px viewport fit.

Filter panel placement (deployed, `home.css?v=cosmos-10`, `engine.js?v=engine-45`): filters open above the links on the right, overlapping the carousel without shifting the page. Show stories closes the panel and retains the filtered carousel. Clicking outside or pressing Escape also closes it. Verified at desktop and 390px width, including a two-story filtered carousel.

Homepage search (deployed, `home.css?v=cosmos-9`, `engine.js?v=engine-44`): the search bar is a real search input. Submitting or clicking the magnifier focuses it and filters the home carousel without navigating. Search matches title/key/description/author across the complete loaded catalog, without the former twelve-card limit. Links below the carousel open `/history` (All stories) and a native details panel (Filters). Filters offer actual catalog authors and default/title/newest/recently-updated sorting, plus reset and a result count. Guest and signed-in users share these controls. This supersedes the older note that search opens the catalog.

Settings interaction refinement (deployed, `home.css?v=cosmos-8`, `engine.js?v=engine-43`): clicking either RU or EN in the modal toggles the current language, including clicking the selected segment. The separate top-level language controls retain direct selection. Dialog close buttons scale to 1.25 with a slight rotation and stronger dark shadow while pressed; reduced-motion preferences suppress transforms.

Unified settings control geometry (deployed, `home.css?v=cosmos-7`): sound, language and notifications have identical 78×38px visible tracks and 37×34px lilac handles/selected segments. Sound and notification buttons retain a 44px hit area. Language was reduced to the existing sound track height.

Language control refinement (deployed, `home.css?v=cosmos-6`): RU/EN now uses the same solid translucent dark-purple background as sound and notifications, with no gradient.

Switch appearance refinement (deployed, `home.css?v=cosmos-5`): sound and notification tracks now use solid translucent dark purple instead of the Figma gradient, with the language control's softer border and lilac handle styling. Behavior is unchanged.

Settings dialog update (2026-09-27, deployed): `home.css?v=cosmos-4` and `engine.js?v=engine-42`. All three dialogs share the compact Figma surface and interaction animations with reduced-motion support. Settings show sound, RU/EN and notification preference rows. Switch styling follows Figma `174:7`. Notifications only persist a device preference (`fraerapp.notifications`); delivery is not implemented and the UI explains this. The passkey button uses existing registration for signed-in accounts and opens Telegram onboarding for guests. Support currently shows a placeholder pending the owner's contact URL. No browser notification permissions are requested.

Production homepage update (2026-09-27): deployed the shared guest/account homepage and dialog revision using `styles.css?v=game-25`, `home.css?v=cosmos-3`, and `engine.js?v=engine-41`. Earlier local-only notes below are superseded by this deployment. Both user states share the same search, heading, actions and carousel geometry; the create button remains visible for player accounts. Compared guest and simulated player DOM geometry at 1440×1024: identical. Public asset hashes match local files; health/catalog/Telegram configuration return 200 and all six core services are healthy. Git changes are still uncommitted.

FraerApp is an interactive story/game platform with:

- public story catalog and game runtime;
- Telegram-link and passkey public authentication, with email-link kept as hidden admin/recovery fallback;
- author story builder;
- admin/auth panel;
- production Docker deployment behind nginx and Cloudflare.

The public homepage is a Figma-aligned story preview screen for both guests and signed-in users. Guests can browse real published story cards with titles and cover visuals, but starting a story or creating one opens the authorization modal. Signed-in users keep the same homepage shell with an active profile icon: story cards start/continue stories, "Read stories" opens the catalog, search is available, and "Create yours" remains visible for everyone. Author/admin accounts open the builder; other signed-in accounts see guidance to ask an administrator for editor access in the profile dialog, without reopening sign-in. Server-side author permissions remain required. The in-story runtime keeps the darker immersive game presentation.
The homepage visual reference is Figma `5vh1st4bxxI1OoGHTp4tcw`, frame `84:293` on page `3:3`: a cosmic background, Playfair Display SC heading, glass navigation and buttons, and an overlapping five-position carousel. Its scoped styles live in `frontend/home.css`; original exported artwork/icons and locally served fonts live in `frontend/assets/home/`. Actual catalog covers replace the design's placeholders. Search opens the public catalog for guests too; the guest create button opens sign-in, while signed-in creation remains restricted to author/admin roles. On small screens the carousel displays one card with previous/next controls. Existing legal links are retained.
The homepage responsive styles (`home.css?v=cosmos-2`) scale the toolbar with viewport width and height, capped at the 1440 × 1024 design size. Search is 48px tall at that size, with a 44px minimum for controls. Headings and cards use a gentler width-based scale so medium or short windows retain substantial content. Heading line spacing includes an extra 3px; larger action and carousel gaps place these elements lower. Below 701px the carousel shows a smaller central card with one overlapping neighbor visible on each side; the farther cards are hidden. Readable minimum sizes take priority over fitting short windows without vertical scrolling. The footer follows the content and stays at the bottom on taller windows. This responsive revision is local until explicitly deployed.
Story browsing has stable public routes: `/history` renders the catalog, and `/history/<published-slug>` renders a story detail page. nginx static fallback serves the SPA for these routes, while the frontend loads data from `/api/catalog/stories`.

This file is safe to commit. Concrete SSH targets, private IPs, and other operator-only values belong in `LOCAL_OPERATOR_NOTES.private.md`, which is ignored by git.

## Local checkout

Current workspace path:

```text
/Users/aleksejalbitov/Documents/Codex/2026-06-04/fraerapp/work/fraerapp
```

Recent branch:

```text
codex/passkey-auth-compliance
```

Recent important commits:

- `ff4a034 Add toilet guide story scenario`
- `2f5646c Add production observability stack`
- `504ccb8 Clarify passkey recent auth error`
- `fe561e3 Harden story choice unlock and bust cache`
- `ce4cb16 Fix story choice lock and login request deletion`
- `46a0d5e Add cat petting story scenario`

Always verify current git state with:

```bash
git status --short --branch
git log --oneline --decorate -8
git branch -vv
```

## Repository layout

Key paths:

```text
frontend/                         Main public game frontend
frontend/engine.js                Game UI, auth flow, catalog, runtime choices
frontend/passkeys.js              Browser passkey/WebAuthn helpers
story-builder/                    Author builder static app
story-builder/scenarios/          Reusable story JSON scenarios
auth-service/                     Spring Boot auth service
src/main/java/.../game/           Main API/game/story engine
src/main/resources/db/migration/  Main API Flyway migrations
auth-service/src/main/resources/db/migration/  Auth DB migrations
nginx/                            Production/local nginx configs
compose.yaml                      Docker Compose stack
```

## Main services

### `edge`

nginx entrypoint. It serves `frontend/` and proxies:

- `/auth/**` to `auth-service`;
- `/api/**` to main `api`;
- `/builder/**` to `story-builder`;
- static assets from `frontend/assets`.

Frontend is mounted as a volume, so replacing frontend files in the runtime directory is enough for most frontend-only deploys.

### `api`

Spring Boot main game/story service.

Responsibilities:

- story import/publish/validation;
- public catalog;
- sessions and choices;
- author story operations;
- admin story operations;
- player mapping via auth user id.

Important classes:

```text
StoryAdminService
StoryProductService
GameService
CurrentUserService
AuthorStoryController
AdminStoryController
PublicCatalogController
```

### `auth-service`

Spring Boot auth service.

Responsibilities:

- Telegram login links and hidden email/admin login links;
- cookies and refresh;
- passkeys;
- admin panel `/auth/admin`;
- users, roles, login requests, passkey management.

Important class:

```text
auth-service/src/main/java/com/fraergod/fraerapp/auth/AuthServiceApplication.java
```

Recent behavior:

- passkey registration requires recent auth;
- if backend returns `Recent authentication required`, frontend should show a clear Russian/English text.
- Browser/WebAuthn passkey errors such as `NotAllowedError`, user cancellation, unsupported current context, or missing credentials are normalized in the frontend before display. Do not show raw browser exception text to users.
- Telegram login is the primary public sign-in path. The bot webhook resolves or creates a stable `telegram_identities.telegram_user_id -> users.id` binding, creates rows in `email_login_tokens`, records `login_link_requested` audit events with source `telegram_bot`, and returns a Telegram `sendMessage` method response containing the one-time `/auth/verify` link. This avoids outbound server calls to `api.telegram.org`, which may be unavailable from the production host. Email login remains available as an admin/recovery fallback but is not shown on the public login screen.
- The public homepage is a consumer login/catalog entrypoint. Author/admin controls are not present in the static public HTML and are created by the frontend only after `/auth/me` confirms `author` or `admin` roles. Main API author/admin endpoints still enforce roles server-side through `CurrentUserService`.
- Legal pages use `frontend/legal-config.js` for operator, owner, address, registration, privacy contact, and consent-withdrawal contact. Production validation must fail if these required values are empty or left as placeholders.
- Private/admin pages should not be indexed. nginx adds `X-Robots-Tag: noindex, nofollow` to `/auth/admin...` and `/builder/`, and `frontend/robots.txt` disallows `/auth/`, `/builder/`, and `/api/`.

### `story-builder`

Static authoring app available through `/builder/`.

Uses current FraerApp auth session, not a separate builder login.

Builder correctness fixes (2026-09-22):

- Global variables/assets and scene-local definitions may intentionally share names; import/export preserves both scopes. Scene/asset renames update references in their applicable scope.
- The editor's saved server identity is stored with its local draft as `runtimeStory` (`storyId`, `key`, API `base`). Analytics, preview, version lists and actions on another story never rebind the editor. Changing the key/runtime or replacing the draft invalidates its binding. The old separate `storyBuilderLastStoryId` value is ignored because it could refer to a different story; existing drafts remain intact and can be reopened or explicitly imported to establish a binding.
- “Validate last import” calls validation only and cannot import/unpublish a story. Import saves a draft; review is an explicit separate action. Local unsaved content is checked continuously in the editor's validation panel.
- Review/upload checks the initiating draft, story key and runtime after asynchronous requests; switching context stops the follow-up action instead of targeting the newly opened story. Submission uses the ID and generation returned by its own import.
- JSON parse/shape failures display an error and preserve the active draft. The public website is reachable from the builder even when its author controls are locked.
- `story-builder/workflow.test.js` exercises these regressions against the actual app functions.

Public interaction fixes: catalog, details and account settings link back to the homepage; dialogs trap keyboard focus, close with Escape and restore focus; failed catalog loads leave a usable page with an error instead of an indefinite loading screen. Main action failures are visible outside the in-story status panel.

## Production topology

Production is a Docker Compose runtime behind nginx and Cloudflare.

Use these variables in commands:

```bash
FRAERAPP_SSH=<ssh-target>
FRAERAPP_REMOTE_DIR=<remote-runtime-directory>
FRAERAPP_DOMAIN=<public-domain>
FRAERAPP_LAN_IP=<server-lan-ip>
```

Concrete values for this checkout are kept in `LOCAL_OPERATOR_NOTES.private.md` when available.

Expected main containers:

```text
fraerapp-edge-1
fraerapp-api-1
fraerapp-auth-service-1
fraerapp-story-builder-1
fraerapp-postgres-1
fraerapp-auth-postgres-1
```

Observability containers may also exist:

```text
prometheus
grafana
loki
promtail
node-exporter
cadvisor
postgres-exporter
nginx-exporter
```

Production shares its Docker host with other homelab services. Nginx Proxy Manager owns the host LAN ports 80/443 for local `*.home.arpa` routes, while FraerApp edge binds ports 8088/8443 only to `$FRAERAPP_LAN_IP` and terminates its own TLS. Homepage includes a FraerApp tile that links to the public domain.

The FraerApp core can run without its observability group. The minimal production service set is:

```text
postgres
auth-postgres
api
auth-service
story-builder
edge
```

Do not start Grafana on this shared host without checking port ownership; another homelab service may already own port 3000.

## Domain and DNS

Cloudflare fronts the public domain.

Important: the server public IP can change. Do not hard-code the origin IP in committed docs. Verify current origin IP from the server:

```bash
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org'
```

Cloudflare `522` means Cloudflare cannot connect to the origin. The usual checks are:

```bash
curl -sSI "https://$FRAERAPP_DOMAIN/"
ssh "$FRAERAPP_SSH" 'cd "$FRAERAPP_REMOTE_DIR" && docker compose ps'
ssh "$FRAERAPP_SSH" 'curl -skSI https://127.0.0.1:8443/'
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org'
```

If local origin is 200 but Cloudflare is 522, update Cloudflare A records to the current public IP.

Cloudflare `525` means the TCP origin is reachable but the TLS handshake reached the wrong service or failed. On the shared-host topology, verify that the router maps external TCP 443 to `$FRAERAPP_LAN_IP:8443`, not to the LAN port 443 owned by Nginx Proxy Manager.

Known homelab exception: `homeassistant.home.arpa` is retained in Nginx Proxy Manager but currently times out because containers on the external proxy network cannot reach Home Assistant's host-network port. Home Assistant itself remains reachable directly on the LAN. Treat this as a separate network-policy issue; do not restart or reconfigure Home Assistant during FraerApp operations.

## Auth and users

Moderation release (2026-10-05): current authorization comes from `/auth/me`, which
checks the actual active, unexpired, unrevoked session and returns current database
roles. The API verifies this per request through `CurrentSessionClient`; a stale
JWT role cannot retain access. Auth outages fail closed with 503. Role changes,
blocking, session revocation and last-active-admin protection are enforced by auth.
V8 adds `moderator` and a persistent bootstrap marker so revoked bootstrap roles
are not silently granted again on login/restart. Only administrators manage roles;
moderator does not imply author or admin. Author plus moderator is an explicit
combination. The auth admin page links to the single moderation workspace.

The public sign-in and profile dialogs share a 400px maximum width and the surface from Figma `171:2`: #7F64A4 fill at 68% opacity and horizontal gradient, 58% white border, 26px radius, 6px background blur and four layered shadows. The backdrop blurs the recognizable homepage. On narrow/short screens dialogs fit the viewport and scroll internally. Sign-in legal links and errors use smaller text. Telegram remains visible even when its configuration endpoint is unavailable; clicking it then explains that sign-in is temporarily unavailable. Passkey sign-in maps browser cancellations/missing credentials to Telegram onboarding guidance, and unknown server/network failures to a short localized message without raw response bodies. These dialog changes are local until deployed. Current asset versions are `home.css?v=cosmos-3` and `engine.js?v=engine-41`.

Use `python3 scripts/preview-frontend.py` for the local frontend preview at `http://localhost:8765`. It reads the real public catalog and Telegram entrypoint, replacing the old temporary fixture that disabled Telegram. The bot's one-time link completes registration/sign-in on `https://fraerapp.ru`; local preview sessions remain unauthenticated. Production cookies/tokens and authenticated mutations are never proxied. Passkey requests return `AUTH_PREVIEW` with clear Telegram guidance because production passkeys belong to the production origin. For a new account, Telegram establishes the identity before a passkey can be registered.

Auth lives in a separate Postgres database (`auth-postgres`).

Main app players live in the main Postgres database (`postgres`) and are linked by:

```text
players.user_id = auth.users.id
```

Roles used:

```text
player
author
moderator
admin
```

Author story ownership is:

```text
stories.owner_player_id -> players.id
```

Import through `/api/author/stories/import` with the author's actual session. New
stories imported through `/api/admin/stories/import` belong to that administrator;
updates preserve existing ownership. Only internal seed creation is system-owned.

`/my-stories/` remains readable to an active owner after author-role removal, with
all editing/submission actions disabled. `/moderation/` requires moderator/admin.
nginx checks access before serving either private page; the recovery page refreshes
an expired access session once and rechecks current roles. Private pages, APIs and
uploads are no-store/noindex. Cookie-authenticated writes require a same-origin
signal; bearer API clients keep their existing transport.

## Story moderation and publication

`StoryWorkflowService` is the sole owner of import, submission, decisions and
availability. V15 stores workspace state and audit events, reuses immutable
`story_versions` documents, adds `stories.published_revision` and pins each saved
game to `game_sessions.story_revision`. Draft JSON never replaces the live story.
Submitted, published and newer working drafts can coexist. Saving edits after
submission does not change the reviewed revision. Replacing a submission requires
explicit confirmation. Rollback creates a new private draft.

The author sees every own story in `/my-stories/`, including pending, rejected,
hidden, archived and deleted work, with the exact revision labels, reason and audit.
Builder saves drafts and sends them for review; authors cannot publish directly.
Reviewers use `/moderation/` to search/filter all stories, inspect a complete private
snapshot and its diff, approve, publish, reject, hide, archive, soft-delete, restore
and change visibility. Internal notes never reach the author. Decisions serialize
on the story and check revision plus generation; concurrent/stale requests receive
409 and create no duplicate decision or notification.

Review status (draft/in_review/approved/rejected) is separate from visibility
(private/public/unlisted/hidden/archived/deleted). Approval alone stays private;
approval-and-publication selects public or unlisted. Unlisted stories open by direct
link for signed-in readers but never enter the catalogue. Hidden/archived/deleted
stories require explicit restoration to private before publication. Moderator
self-approval/restoration is forbidden; an administrator's own story requires an
explicit override and nonempty reason. No real moderator role is granted by deploy.

Public catalogues, direct details, gameplay, saves, engagement and media share the
same availability rules. Guests retain only the three demo stories. Existing runs
read their immutable approved snapshot even after a new version is published;
hidden content cannot be read through an old save. Upload bytes are immutable and
served through authorized `/uploads/` checks, not a public static handler. Drafts
allow an empty upload placeholder; review requires valid same-origin media.
Private previews create no views, sessions, ratings or saves.

Migration is idempotent. Default `MODERATION_LEGACY_POLICY=review` sends legacy
publications to private review; all legacy saves (including archived stories) keep
their original baseline revision. A save whose old revision was never approved is
preserved but unavailable (409); a new run uses the newly approved publication.
For this rollout, the owner explicitly approved retaining the four current
publications: Train 404, cat, toilet and New Story. One-time `approve` creates an
audited approved baseline and preserves their identifiers, links and active saves.
Seed data is private and cannot revive an archived/deleted story on restart.

Compatibility `/api/admin/stories` and `/api/author/stories` routes delegate to the
same workflow. Direct author publish is forbidden; legacy admin publish returns
409 requesting a revision-aware decision. The old inline admin story editor has
been removed. `StoryAdminService` retains validation/export/apply utilities only;
it is not a publication authority.

## Story engine

Story JSON top-level shape:

```json
{
  "key": "story_key",
  "title": "Title",
  "description": "Description",
  "version": 1,
  "startSceneId": "start",
  "variables": {},
  "assets": [],
  "scenes": []
}
```

Supported features:

- global variables;
- variables with `{ "value": ..., "showInStats": true }`;
- scene-local variables;
- global and scene-local assets;
- `background`;
- `music`;
- `animation`;
- scene effects;
- choice effects;
- conditions;
- `fallbackTarget`;
- endings.

Effects:

```json
{ "set": "var_name", "value": true }
{ "inc": "score", "value": 1 }
```

Conditions:

```json
{ "var": "score", "op": ">=", "value": 3 }
```

Recent published scenario files:

```text
story-builder/scenarios/kak-pogladit-kota-ne-ubiv.json
story-builder/scenarios/kak-shodit-v-tualet-pravilno.json
```

## Known issues and decisions

### Import overwrite FK bug

There were production `500` errors on repeated story import:

```text
delete from scenes where story_id = ?
ERROR: update or delete on table "scenes" violates foreign key constraint "fk_choices_scene"
```

Cause: deleting scenes while `choices` still reference them. Check `StoryAdminService.deleteChildren`. It should delete choices before scenes. If this appears again, inspect current code and DB state before retrying repeated imports.

### Choice lock bug

A prior frontend bug left choices disabled after a transition. It was fixed by:

- adding `releaseChoices()`;
- removing dependence on stale `choices-busy`;
- bumping frontend asset versions.

If it returns, verify actual DOM:

```text
#choices has choices-busy?
buttons disabled?
pointer-events?
loaded engine.js version?
```

### Passkey recent auth

Passkey registration requires recent authentication. Backend may return:

```text
Recent authentication required
```

Frontend should show:

```text
Чтобы добавить passkey, заново войдите по ссылке и сразу повторите привязку.
```

### Cloudflare cache

`engine.js` may be cached. When changing frontend JS, bump the query string in `frontend/index.html`, for example:

```html
<script src="/engine.js?v=engine-28" type="module"></script>
```

Do the same for CSS when necessary.
