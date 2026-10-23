# Район: состояние работы

Задача: промпт, аудит каталога, одна сохранённая старая история, новая большая игра в конструкторе, изображения для каждой сцены, проверка и публикация.

TaskStartSnapshot: main, tracked worktree clean, pre-existing untracked output/ preserved. Production: six services healthy, health/catalogue 200, no recent API/auth error markers. All work is authorized by the user's initial request and «продолжай».

Baseline: AGENTS.md; PROJECT_CONTEXT.md author model/moderation/engine; DEPLOY_RUNBOOK.md story publication and operator-release procedure; private runtime notes (never copied here); docs/prompts/authoring-guide.md; StoryDocument, GameService.advance, WorkPackageService, Builder serializers and cat-story tests.

Scope: content and assets using existing engine. One collection with one branching chapter. No engine, auth, guest-policy or schema redesign. Archive rather than purge. Never alter roles or use forged JWTs. Architecture review not required: existing native package contract.

- [x] Local and live read-only inspection.
- [x] User prompt saved in docs/prompts/kto-ty-po-zhizni.md.
- [ ] Clarify retained story (async question pending; no exact «щелочение» title).
- [x] Author 60 scenes, 16 endings, 159 choices, economy and 16 route fixtures covering all scenes.
- [x] Generate and inspect 60 distinct JPEG images (built-in image_gen), including three contact sheets.
- [x] Builder round-trip, resources, graph/economy and real API verification.
- [x] Backup and authenticated native publication.
- [ ] Archive scoped old publications after retained-title clarification.
- [x] Public/browser/runtime verification and context/runbook documentation.
- Git receipt is reported in the final handoff; inspect git log/status on resume. Only task paths are staged, never the pre-existing output/.

Known catalogue: four standalone published stories (Train 404, cat petting, toilet, New Story); one three-chapter published collection «Мира и искусство открытых дверей». Private/archived drafts also exist and are outside catalogue cleanup. Guest catalogue shows only three demo stories; do not infer full inventory from anonymous listing.

Evidence: Builder round-trip passed; deterministic routes cover 60 scenes/16 endings; 10,000 random traversals preserved nonnegative spendable balances, one-time jobs and available choices. All scenes have an unconditional path to an ending. 53 baseline Node tests and production validator passed. Real API DistrictStoryTests passed after matching the API's lowercase status; the filtered Gradle command also selected auth tests and reported no matching auth test, so a complete explicit :test :auth-service:test run is in progress. Existing active unblocked admin independently confirmed; no roles changed.

Final verification: 148 API and 78 auth tests passed; 53 baseline Node tests and all 5 scenario tests passed. Production private replays reached all 16 endings with expected balances. Live browser widths 320/390/1440 passed; 390 completed 43 transitions. Real Builder download preserves all 60 scenes and variables. Inspected contact sheets and desktop/mobile screenshots. All 60 public JPEGs match local bytes, 62 runtime files match. Six services healthy, recent error markers zero.

Publication: collection 08ffb627-7f28-4f0c-b804-d263c4a1bf8c, chapter 3169f83f-09e3-42aa-8198-11af3346877e, revision 1, /collections/kto_ty_po_zhizni. Backup backups/district-20261023-001058. Temporary operator sessions revoked; roles and other stories unchanged. A first prepublication comparison stopped because the server inserts null ending fields and default metadata; exact normalized comparison then passed. No story/engine repair was necessary.

Catalogue cleanup remains explicitly incomplete because the retained title is ambiguous and the early async question is unanswered. Do not silently choose a story or claim the full request is complete. Resume with the user's selected story, inspect fresh states, then archive the other scoped publications with a new backup. Existing guest policy means collections require sign-in.
