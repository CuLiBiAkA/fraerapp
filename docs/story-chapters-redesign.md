# Story → chapters → scenes (2026-10-06)

User-approved goal: My Stories creates one work with shared metadata and an
ordered chapter list. Builder edits one chapter. Chapters release incrementally;
seasons are optional labels grouping consecutive chapters. Reader choices persist
automatically across chapter boundaries. No arbitrary folder nesting or manual
transfer setup in the ordinary author flow.

Baseline: main is dirty with prior deployed UI changes; preserve these. Live
read-only inspection found zero work_collections and zero collection_runs.
Existing standalone stories/saves must remain usable. No data deletion authorized
or needed. Reuse CollectionService/ChapterReadingService and existing tables.

Retirement: remove arbitrary-folder author controls and chapter transfer editor.
Retain immutable v1 documents and explicit relation APIs for historical file/save
compatibility; new work documents use schema v2, only scenario children, optional
season label. No DB migration or destructive operation.

Implementation and verification (inline execution):
- [x] v2 document validation, shared genre/season, sequential reading and automatic
  global state transfer; server prevents skipping chapters by direct start.
- [x] Author work list/create work/add chapter/save/open builder; per-chapter state,
  common metadata, optional season. Remove redundant technical controls.
- [x] Builder chapter context/back link; simplify chapter relations UI.
- [x] Reader work card/TOC/continue, incremental release message, seasons.
- [x] API regressions for transfer, order, replay, incremental release, compatibility;
  frontend browser journey and responsive checks; baseline tests/diff checks.
- [x] Production backup, scoped deploy, health/public/API/log checks; update docs.

Verification: 71 API, 33 auth, 70 frontend tests pass. Author/reader browser flows
and Builder help pass at four widths. New per-chapter review endpoint keeps future
drafts private. Release backup: backups/serial-stories-20261006-124720. Existing
publication manifest unchanged; no source-of-truth deletions, commits or pushes.

Verification uses behavior tests for persistence and reader isolation plus browser
fixtures. No strict test-first requirement from user. Do not commit/push unless asked.
