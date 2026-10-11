# FraerApp code map

Current entry points are summarized here. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
for behavior/decisions and [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md) before production
work. Historical release notes are evidence of a past release, not live state.

## Runtime and authentication

- `frontend/index.html` loads `frontend/engine.js`: reader, catalogue and navigation.
  Shared collection, account and workspace modules own their respective surfaces.
- `frontend/auth-session.js` owns browser refresh coordination and a bounded retry.
  Page adapters still own request serialization, localized errors and UI state.
- `JwtAuthFilter` verifies the access token and clears request-local identity.
  Invalid credentials return 401 at the filter boundary.
- `CurrentUserService` / `CurrentSessionClient` verify the live auth session and
  roles. A JWT alone does not retain access after role removal or revocation.
- `auth-service/.../AuthServiceApplication.java` contains the auth HTTP layer,
  store and token support; subscription and passkey services have separate owners.
- `TaskController` retains legacy CRUD, restricted to live administrators.

## Story documents and publication

- `StoryDocument`, `CollectionDocument`, `WorkMetadata`: serialized contracts.
- `StoryWorkflowService`: immutable draft/review/publication revisions, generation
  checks, ownership, moderation and availability decisions.
- `StoryAdminService`: validation and document/runtime conversion utilities.
  Compatibility HTTP routes delegate to workflow; they are not another publisher.
- `CollectionService`: collection documents and work-level presentation/engagement.
- `WorkPackageService`: atomic package import/export and batch review, including
  forward-reference resolution before returning final generations.
- `StoryAccessService`: current availability and pinned revision access.
- `FolderWorkspaceService`: author projections and filtering before pagination.

The format and supported mechanics are in [the authoring guide](docs/prompts/authoring-guide.md).
New stories use schema 2; historical schema 1 remains compatible.

## Reading state

- `GameService`: session ownership, scene/choice evaluation, effects and endings.
- `ChapterReadingService`: frozen contents, ordered chapters, input transfer and
  replay forks. Shared chain saves cannot be reset in place through the generic
  session endpoint.
- `WorkLinksService`: work references, relation contracts and state transfer.
- `StoryProductService`: standalone catalogue/detail projections.
- `ReaderAdService`: entitlement-checked reader pause state.

Public metadata must obey the same availability rules as reading and media.
Published snapshots remain pinned to existing runs; private draft edits never
replace them.

## Author interfaces

`frontend/story-workspace.js` and collection workspace modules provide author
and moderator screens. `story-builder/app.js` edits chapter documents;
`story-builder/board.js` provides the scene map. Local drafts preserve the bound
server identity and generation. Uploads store bytes; saving references is an
explicit generation-checked document write.

The removed `frontend/app.js` was an unreferenced client of retired player-name
login and `/api/game/*` endpoints. Its removal does not remove a supported route,
story format or saved game.

## Persistence, deployment and verification

PostgreSQL is the runtime database for both services; H2 is test-only. Flyway
migrations under each service own the schema. Media files are immutable bytes in
the upload volume, protected through API access checks. See the runbook for
coordinated database/media backups and runtime paths.

`compose.yaml` defines the six application services plus optional observability.
Frontend files are mounted; Builder and Java changes require image rebuilds.
`build/` contains generated artifacts and test results, not authoritative source.

Use `npm test` for Node tests, `npm run test:browser` for isolated Chromium UI
fixtures, and `sh gradlew :auth-service:test test --no-daemon` for Java checks.
Use `:test --tests '*ClassName'` for an API-only focused run so the filter is not
also applied to the auth-service task. See [README.md](README.md) for setup and
the runbook for verification against a deployed release.
