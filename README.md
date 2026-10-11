# FraerApp

FraerApp is a browser application for interactive stories. The reader and author
interfaces use JavaScript; the API and authentication service use Java 17 and
Spring Boot. Each service has its own PostgreSQL database. H2 is used in tests.

## Start here

- [Project context](PROJECT_CONTEXT.md): architecture, current behavior and release history.
- [Deploy runbook](DEPLOY_RUNBOOK.md): production inspection, backup, deployment and rollback.
- [Authoring guide](docs/prompts/authoring-guide.md): current chapter/package format and supported mechanics.
- [Story experience](docs/story-experience-unification.md): shared reader/author contracts and verification.
- [Agent instructions](AGENTS.md): repository workflow and proportional checks.

Private runtime values belong in ignored `LOCAL_OPERATOR_NOTES.private.md` and
local environment files. Verify live infrastructure before a release; historical
addresses and container tags are not current configuration.

## Services and ownership

| Component | Responsibility |
| --- | --- |
| `frontend/` | Reader, catalogue, account, subscriptions and author/moderator workspaces |
| `story-builder/` | Chapter editing, scene map and local prompt preparation |
| Main API, `src/main/java/` | Story documents, moderation, reading state, media access and engagement |
| `auth-service/` | Identities, sessions, live roles, consent, passkeys and test subscriptions |
| `postgres`, `auth-postgres` | Separate runtime databases managed by Flyway |
| `edge` | Static frontend, same-origin proxies and private route access checks |

`StoryWorkflowService` owns story revision/publication decisions.
`ChapterReadingService` owns chapter progression, state transfer and replay forks.
The API checks the active auth session and current roles on every authenticated
request. Client-supplied player IDs and JWT role claims are not an access authority.

Public frontend files are mounted into nginx. Builder files are baked into its
image. API/auth code changes require rebuilding the corresponding service. Follow
the runbook for asset versions, protected media, backups and coordinated release.

## Local development

Install Java 17, Docker Compose and Node.js. Copy `.env.example` to `.env`;
supply local database passwords and one shared random `AUTH_JWT_SECRET` for API
and auth. Keep these values out of Git. The example enables development login and
insecure local cookies; production settings are described in the runbook.

Start the six application services explicitly:

```sh
docker compose up -d --build postgres auth-postgres api auth-service story-builder edge
```

Open `http://localhost:8088/`. Use `/builder/` through the same origin for the
author editor and `/auth/admin` for administration. Builder's service also exposes
port 8090, but its shared frontend modules are served through the edge origin;
use `/builder/` for the complete interface. A configured API runtime must match
the allowed auth, CORS and passkey origins.

Telegram is the public sign-in path. Local development can use the admin/recovery
email form at `/auth/admin`: set `AUTH_BOOTSTRAP_ADMIN_EMAIL`, request a link and,
only with `AUTH_DEV_MODE=true`, use its development shortcut or the development
magic-link endpoint. The first verified identity receives the Reader role.
Bootstrap administrator access is initialized once; later revocation is retained.

The optional `scripts/preview-frontend.py` preview reads public catalogue and
Telegram configuration only. The bot link completes login on the public site;
production sessions and passkeys do not authenticate the local preview.

## Authentication and access

- Roles are `player`, `author`, `moderator` and `admin`. Moderator access does
  not imply author or administrator access.
- Auth issues httpOnly access/refresh cookies. API clients may use a valid bearer
  token backed by an active session. Cookie mutations need a same-origin signal.
- Public registration uses explicit, versioned consent. Configure
  `AUTH_PRIVACY_POLICY_VERSION` consistently with the published legal documents.
- Passkeys require a recent full authentication. Refreshing a session does not
  renew that age. Configure exact `AUTH_PASSKEY_RP_ID` and
  `AUTH_PASSKEY_ORIGINS`; existing credentials are bound to that relying party.
- Admin/manual email links remain available for recovery. Without SMTP, public
  email requests give a generic response without issuing a usable link.
  `AUTH_ADMIN_LOGIN_LINK_LOG_ENABLED` is an explicit operational fallback for
  administrator bootstrap, documented in the runbook.
- Subscriptions currently use a test checkout: no real charge, card collection
  or automatic renewal. [Subscription contract](docs/subscriptions.md).
- Reader advertising is an internal optional pause with no external ad network.
  [Advertising contract](docs/reader-ads.md).

The API fails closed when it cannot confirm the session. Signing secrets are
never published through JWKS. Private pages, responses and uploads are not public
cacheable content.

## Create and publish a story

1. Sign in with author access and open **My stories**. Create a story and chapters.
2. Open a chapter in Builder; edit scenes, choices, variables and media. The scene
   preview displays text and choices; it does not execute an interactive run.
3. Use **AI prompts** to prepare instructions locally. No AI provider is called.
   Including existing content requires an explicit choice.
4. Import single-chapter JSON into Builder or a complete package into My stories.
   Inspect the import preview, validate the structure and check every branch.
5. Save a private draft and submit its exact revision for moderation. Existing
   documents use generation-checked saves; stale changes are rejected without
   discarding the author's text.
6. A moderator approves and explicitly publishes the submitted revision.
   Draft changes never replace the live publication or existing save snapshots.

New stories use **story → chapters → scenes**, with optional season labels and
automatic global-state transfer. Package schema 1 wraps story schema 2; these are
different version fields. Existing schema-v1 collections and IDs remain supported.

The authoritative format guide is [here](docs/prompts/authoring-guide.md).
Examples: [minimal story package](docs/examples/serial-story-package.json),
[full three-chapter story](story-builder/scenarios/koshka-i-otkrytye-dveri.package.json)
and [mechanics coverage](docs/cat-open-doors-coverage.md).
`story-builder/authoring-prompt-template.js` owns the generated prompt contract.

Stories support global and scene-local variables/assets, typed conditions,
`set`/`inc` effects, text substitutions, guarded transitions with
`fallbackTarget`, backgrounds, scene audio and endings. Local names shadow
global names in their scene. Timer variables are numeric values without a clock;
a sound asset has no independent sound-effect trigger. See the guide for supported
types and exact limits.

## Data and media

Flyway owns both PostgreSQL schemas. Runtime volumes are `postgres-data`,
`auth-postgres-data` and `story-uploads`. Back up both databases and immutable
upload bytes together; follow the runbook before restoring data.

Media bytes live in `frontend/assets` or `ASSET_STORAGE_PATH`, not in database
rows. `ASSET_PUBLIC_PATH` defaults to `/uploads`; API authorization protects
these URLs. An upload from another work cannot be used as an owned cover.
Arbitrary external URLs and path traversal are not supported.

Game endpoints use `/api/sessions`, `/api/sessions/{id}/state` and
`/api/sessions/{id}/choice`. Serial reading uses collection runs and chapter
attempts. Start/replay through the contents flow so transferred state and earlier
attempts remain intact. API definitions are in the controllers and OpenAPI;
there is no player-name login or `X-Player-Id` authentication.

## Verification

```sh
npm test
npm run lint
npm run build
sh gradlew :auth-service:test test --no-daemon
git diff --check
```

`npm run build` validates production-facing static configuration; it is not a
bundle build. `npm run test:browser` runs the current Chromium fixture suites
using Playwright and its installed browser (or dependencies exposed via
`NODE_PATH`). These verify isolated UI behavior, not production mutations or
Safari. `npm run test:ui` is a small helper-level check, not browser coverage.

For Windows, use `gradlew.bat` with Java 17. The runbook lists focused checks,
asset hash verification and deployment health checks.

## Optional services

[Observability](OBSERVABILITY.md) covers Grafana, Prometheus, Loki and exporters.
They are optional and share host resources with other services. Inspect port
ownership before starting them; the six-service command above starts only the app.

`compose.mail.yaml` is an optional self-hosted SMTP configuration. Copy
`mailserver.env.example` to ignored `mailserver.env`; configure A/MX, SPF, DKIM,
DMARC and PTR records using the **current** mail host address. Create the sender
mailbox and DKIM keys with Docker Mailserver's setup command, then verify actual
delivery. Mail credentials stay in private environment files. This is separate
from Telegram's webhook-response delivery and is not required for public login.
