# FraerApp project context

Last updated: 2026-07-03.

FraerApp is an interactive story/game platform with:

- public story catalog and game runtime;
- email-link, Telegram-link, and passkey authentication;
- author story builder;
- admin/auth panel;
- production Docker deployment behind nginx and Cloudflare.

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

- email login links;
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
- Telegram login is an alternate delivery path for the same temporary-link flow. The bot webhook creates rows in `email_login_tokens`, records `login_link_requested` audit events with source `telegram_bot`, and sends the one-time `/auth/verify` link back to the Telegram chat. Telegram users are mapped to stable internal identities shaped like `telegram-<id>@telegram.fraerapp.local`; do not accept arbitrary email addresses through the bot.

### `story-builder`

Static authoring app available through `/builder/`.

Uses current FraerApp auth session, not a separate builder login.

## Production topology

Production is a Docker Compose runtime behind nginx and Cloudflare.

Use these variables in commands:

```bash
FRAERAPP_SSH=<ssh-target>
FRAERAPP_REMOTE_DIR=<remote-runtime-directory>
FRAERAPP_DOMAIN=<public-domain>
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

## Auth and users

Auth lives in a separate Postgres database (`auth-postgres`).

Main app players live in the main Postgres database (`postgres`) and are linked by:

```text
players.user_id = auth.users.id
```

Roles used:

```text
player
author
admin
```

Author story ownership is:

```text
stories.owner_player_id -> players.id
```

If a story must belong to a user, prefer importing through `/api/author/stories/import` using that user's authorized session. Admin import creates system-owned stories unless ownership is set through the author path.

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
