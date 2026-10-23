# Страницы чтения внутри сцены

Intent: text and choice controls fit the reader viewport; long scenes use presentation-only pages. Builder applies the same page text limit and explains/previews the automatic split. Existing stories benefit without rewriting their gameplay graph or saved documents.

TaskStartSnapshot: main at 9d1a786, tracked tree clean; pre-existing output/ is unrelated. User requests the reader and Builder change; previous authorization covers delivering changes to the site. Optional question asks whether manual breaks are also needed; automatic division is the stated default.

BaselineReadSet: AGENTS.md, PROJECT_CONTEXT.md, DEPLOY_RUNBOOK.md, private operator configuration, frontend/engine.js render/busy/status lifecycle, reader.css, draft-playtest.js, collection-reader.js; Builder app/core/serialization and deployment Dockerfile; existing browser regression fixtures.

Change necessity: reader currently adds 64–67svh top padding before the full prose and choices. District scenes reach 645 characters and nine choices. A fixed character cap alone cannot guarantee fit across viewports.

Design: retain one logical scene and its full text. Shared presentation policy caps each text page at 500 characters; the browser splits further by measured available space, at paragraph/sentence/word boundaries. Final text can share a page with all choices when they fit; otherwise choices use pages of at most four buttons, further divided by measured height. Back/Continue/page count never send gameplay requests. Resize preserves reading position. Builder shows automatic pages and long-label guidance. No hard truncation, new scene IDs, backend/schema changes, duplicate effects or saved-story migration. Readability and accessible scrolling take precedence at extreme zoom/oversized individual controls.

Alternatives: adding real graph nodes would change effects, analytics and saves; only a character limit would miss viewport/font/choice height. Presentation pagination owns this problem. The optional manual-break question had no answer; the communicated automatic default was implemented. ArchitectureReviewRequired: no new persistence or public contract; shared frontend policy plus a local reader controller.

Verification: pure split losslessness/Unicode/bounds; existing Node baseline and Builder suites; isolated browser actual district and Mira text, small/large/landscape screens, many choices, endings, resize, keyboard, failed/retried choice and no requests from page navigation; Builder import/edit/export remains unchanged. Before production: inspect services/logs, back up changed runtime files and Builder image, install shared/frontend assets, rebuild Builder, reload edge, verify public hashes/health/logs. Update context/runbook, scoped commit and push.

- [x] Inspect current renderer, Builder and runtime deployment ownership.
- [x] Implement shared page policy, reader fit and Builder feedback.
- [x] Verify representative reading and authoring paths.
- [x] Back up and deploy, verify production.
- [x] Update context, runbook and authoring guide.
- Git receipt: the scoped main commit containing this entry; exact SHA and verified push are reported in the final handoff. Pre-existing output/ remains outside this task.

Local evidence: 93 Node tests; 90 real story scenes at 390x844 and representative long prose/many choices/endings at 320x568, 430x932, 768x1024, 1440x900 and 844x390. Browser verifies complete prose/choices, no gameplay requests from paging, retry of the exact failed choice, resize anchoring and unchanged Builder export at 390/1440px. Existing Builder usability and private/serial playtest suites pass. Frontend audit passes RU/EN, four widths and doubled text. Corrected combined-page resize anchoring so font/layout changes cannot skip unread prose. Final navigation labels fit small screens.

Production preflight: all six services healthy, no recent API/auth error markers; six existing changed runtime files matched HEAD. Backup backups/reading-pages-20261023-071012 preserves runtime files, both validated databases and the prior Builder image. Nine files installed, only story-builder rebuilt, edge reloaded. All nine public/runtime hashes verified.

Final live evidence: private-reader 320/390/1440px checks pass, with 43 engine transitions to an ending at 390px; geometry checked on presentation pages and transitions. Real Builder export preserves all 60 scenes/variables. Story draft/publication signatures unchanged, six healthy services, zero recent API/auth error markers, home/health/catalogue/Builder probes 200. Temporary QA sessions revoked and prior sessions unchanged. Receipt/screenshots: /private/tmp/fraerapp-reading-release/. An initial checker assumed a scene-title change for completion; self-transitions now wait for the actual playtest POST response and released busy state. One later public TLS interruption required audited revocation of its exact temporary session; the final complete public check succeeded.

Scope/evidence boundary: browser sizes and doubled-text checks cover the delivered responsive behavior, not physical-device or assistive-technology certification. Extreme text enlargement/oversized individual controls retain accessible panel scrolling. No remaining feature work or deployment blocker.
