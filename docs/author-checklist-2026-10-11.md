# Author and reader checklist — 2026-10-11

Status: local work on `main`; not committed, pushed or deployed by this task.
The checkout also contains a concurrent architecture/auth cleanup. Preserve that
work and verify the combined release before deployment.

## Implemented scope

| Request | Local behavior |
| --- | --- |
| Safe image area | Shared preparation dialog displays centred desktop/tablet/phone crops for scenes and author-card/mobile-library/detail crops for covers. Green intersection is safe for the shown aspect ratios; other viewport ratios can differ. |
| Image dimensions and weight | Browser preserves proportions, never upscales, bounds raster output to 1920×1080 and 500 KiB. Opaque output is JPEG; transparency uses PNG. Server decodes and enforces the same raster limits. Source cap is 10 MiB / 40 megapixels. |
| Same homepage by role | One geometry for guest, reader, author and moderator. Permissions and catalogue eligibility remain server controlled. |
| Continue / register | Continue closes nested story details and opens the three-demo catalogue. Registration still opens sign-in. Actual guest reading retains existing authorization rules. |
| Metadata before variables | Builder structure and active context begin with metadata; variable groups follow. |
| Hidden story key | New drafts receive a unique key once on first save or explicit JSON export; retries and reimports retain it. Imported and existing keys remain unchanged. |
| Scene key label | Scene identifier is labelled “Ключ сцены” / “Scene key”. |
| Trash and withdrawal | Existing withdrawal remains. Own unrestricted unpublished trash can be restored with generation checking. Expired trash disappears after 30 days. |
| One story/day | One new work scope per rolling 24 hours, alongside existing one-pending-work capacity. Updating the same work and its chapters does not consume another admission. Withdrawal/decision does not reset the daily window. |
| Draft playthrough | Saved immutable scenarios and whole sequential stories open the existing reader renderer. Chapter progression carries global variables using the published reading policy. Backend reuses choice/effect/condition evaluation without storing reader sessions, endings, views, votes or ad state. |
| Mobile Builder controls | Toolbar wraps in two accessible columns at narrow widths. |
| Builder cover | Shared library/upload picker writes metadata.coverUrl and preserves other metadata and identity. |
| Mobile library text | Full 18 px card titles, one column on narrow phones and equal card heights. |

## Decisions and open requirements

The numerical defaults above were proposed to the user while implementation of
the explicit fixes continued. No answer had arrived when this record was written.
“Monthly cleanup” is implemented as a 30-day recovery window, checked on access
and by a daily scheduler, not deletion of all recent trash on one calendar date.

Two requirements still need definition and are **not implemented**:

- “Цензор истории”: age/content labels, automated text checks, or moderator tools?
- “Таймеры в локальные сцены”: countdown with automatic choice, delayed content,
  or another behavior? Existing local timer declarations are numeric values;
  they do not tick in real time.

Private playtests cover independently startable scenarios/chapters and whole
sequential stories (collection schema 2). The whole-story manifest freezes the
saved parent revision and chapter revisions; each request rechecks access and
replays the chapter prefix, requiring completion before advancing. Global values
carry forward under the same policy as published runs; local scene values do not.
Standalone input-contract defaults use the normal transfer logic. Legacy nested
collections and standalone chapters requiring an external source save do not gain
a whole-collection preview. Playtest history is private in browser memory and
bounded to 500 choices across chapters; restarting clears it. This is not a reader
save or publication.

GIF is explicitly converted to a still image by the picker. WebP input is decoded
by the browser and uploaded as PNG/JPEG. Direct raw WebP multipart uploads require
preparation first because the current Java runtime has no WebP decoder; the API
returns a validation error. Previously uploaded files remain readable. Existing
raw SVG/audio storage is retained; raster normalization is not an SVG/audio policy.

## Data and permission boundaries

API V22 stores daily admission per owner and deleted_at on stories/collections.
Existing trash receives its retention start at migration time. Expiration marks
records `purged`; immutable revisions, moderation audit, uploaded media and reader
saves are retained. This clears the author's bin without deleting historical
evidence. Moderator audit access remains; author reads/exports/media/restore reject
expired trash, including indirect references from surviving works. A live parent
remains readable when a referenced child expires. Restoring never republishes a
work or lifts moderator restrictions.

Every playtest request rechecks the current account and ownership/moderator role,
then replays a specific immutable revision with no public-availability bypass.
Normal session endpoints still reject unpublished stories. Image cancellation
does not create/save a draft or upload bytes. Asynchronous Builder cover/upload
results cannot bind to a different draft.

## Verification record

Focused browser suites are `check-guest-catalog`, `check-draft-playtest`,
`check-image-preparation`, `check-author-playtest-trash` and
`story-builder/check-builder-usability.cjs`. They use synthetic local API replies;
no production accounts, sessions, content or moderation actions are exercised.
Java tests cover actual private playtest API/side effects, image decode/storage,
daily admission races/rollback and trash restoration/expiry. The serial regression
compares private chapter states against published reading and verifies that
private replay leaves stored rows unchanged.

Final combined checkout verification on 2026-10-11:

- JavaScript: 151 tests passed.
- API: 128 tests passed, using isolated Gradle outputs and local H2 fixtures.
- Auth service: 69 tests passed; no auth source changed after that run.
- Browser: all 25 suites passed, including standalone/serial previews at
  320/390/768/1440 px, image preparation, actual author preview links, trash,
  guest navigation and Builder usability.
- JavaScript syntax, production configuration validation and `git diff --check`
  passed. Production configuration validation is a local check, not a deployment.

These results cover the combined working copy, including the concurrent cleanup.
No production database, accounts or runtime were changed. Work remains local and
uncommitted; censor and real-time timer behavior remain open as described above.
