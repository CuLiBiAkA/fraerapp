# FraerApp Codebase Notes

## Purpose

This project is a small story-game platform:

- `src/main/java/.../game` is the main story runtime and admin import/publish backend.
- `frontend/` is the player-facing static client served by nginx.
- `story-builder/` is a separate static authoring tool that builds Story JSON in the browser.
- `src/main/java/.../task` is a simple task CRUD module, likely legacy/demo functionality.

## Runtime Shape

- Backend: Spring Boot 4, Java 17, JPA, Flyway, H2 file DB by default.
- Edge: nginx serves `frontend/` and proxies `/api/*` to the Spring app.
- Builder: separate Docker service on port `8090`.
- Default compose URLs from `README.md`:
  - runtime: `http://localhost:8088`
  - builder: `http://localhost:8090`

## Important Backend Entry Points

- `src/main/java/com/fraergod/fraerapp/game/AuthController.java`
  - `POST /api/auth/login`
  - creates or loads a player, returns `playerId`

- `src/main/java/com/fraergod/fraerapp/game/GameController.java`
  - `GET /api/stories`
  - `POST /api/sessions`
  - `GET /api/sessions/{sessionId}/state`
  - `POST /api/sessions/{sessionId}/choice`
  - `POST /api/sessions/{sessionId}/reset`

- `src/main/java/com/fraergod/fraerapp/game/AdminStoryController.java`
  - `POST /api/admin/stories/import`
  - `POST /api/admin/stories/{storyId}/validate`
  - `POST /api/admin/stories/{storyId}/publish`
  - guarded by `X-Admin-Token`

- `src/main/java/com/fraergod/fraerapp/task/TaskController.java`
  - legacy/simple CRUD under `POST/GET/PUT/DELETE /api/tasks`

## Core Domain Flow

Main gameplay logic is in `src/main/java/com/fraergod/fraerapp/game/GameService.java`.

- Player logs in and gets `playerId`.
- Client requests published stories.
- Client creates a session with story key and `X-Player-Id`.
- Session stores variables JSON, current scene key, status.
- Choosing an option:
  - visible choices are filtered by `conditions`
  - choice `effects` are applied
  - target scene is loaded
  - scene `effects` are applied
  - if target scene has `ending`, session becomes `finished`

Conditions/effects format:

- conditions support `==`, `!=`, `>`, `>=`, `<`, `<=`
- effects support:
  - `{ "set": "varName", "value": ... }`
  - `{ "inc": "varName", "value": 1 }`

## Story Import/Publish

Main admin logic is in `src/main/java/com/fraergod/fraerapp/game/StoryAdminService.java`.

- Import parses Story JSON into `StoryDocument`.
- Validation checks:
  - story key/title/start scene
  - duplicate scene IDs
  - duplicate choice IDs within a scene
  - missing target scenes
  - missing referenced assets
- Re-import of an existing story key deletes child rows (`choices`, `scenes`, `assets`) and rewrites them.
- Publish is allowed only after validation passes.

## Data Model

Flyway story schema is defined in `src/main/resources/db/migration/V3__create_story_engine.sql`.

Main tables:

- `stories`
- `assets`
- `scenes`
- `choices`
- `game_sessions`

Earlier migrations:

- `V1__create_tasks.sql`
- `V2__create_players.sql`

JSON-heavy fields are stored as CLOB:

- story variables
- scene animation/effects/ending
- choice conditions/effects
- asset metadata

## Frontend Notes

Current player client is `frontend/app.js` + `frontend/engine.js`.

- `frontend/engine.js` matches current backend contract:
  - uses `/api/stories`
  - uses session-based endpoints under `/api/sessions/...`
  - supports admin import/publish from the same UI
  - stores `playerId`, `username`, `sessionId` in `localStorage`

- `frontend/app.js` appears older/outdated:
  - calls `/api/game/state`, `/api/game/choice`, `/api/game/reset`
  - expects fields like `scene.imageUrl` and `state.username`
  - does not match `GameController`

Likely real entry point is `frontend/index.html` with `engine.js`, while `app.js` looks like stale code.

## Story Builder Notes

Main file: `story-builder/app.js`.

- Entire builder state is client-side.
- Draft is autosaved to `localStorage`.
- Can:
  - edit metadata, variables, assets, scenes, choices
  - validate locally
  - import/validate/publish against runtime API
  - load example story
  - import/export JSON

Builder serializes to the same structure expected by backend admin import.

## Infra / Config

- `build.gradle`
  - Spring Boot 4.0.5
  - Java 17 toolchain
  - actuator, JPA, Flyway, validation, H2 console, Web MVC, springdoc

- `src/main/resources/application.properties`
  - default port `8080`
  - H2 file DB under `/data/fraerapp`
  - swagger at `/swagger-ui.html`
  - docs at `/api-docs`
  - admin token default: `dev-admin-token`

- `compose.yaml`
  - `edge` exposes runtime on `8088` by default
  - `story-builder` exposes `8090`
  - `api` stores H2 DB in Docker volume `h2-data`

- `nginx/nginx.conf`
  - serves static frontend
  - proxies `/api/`, `/api-docs`, `/swagger-ui*`
  - has basic rate limiting for API

## Tests

Most meaningful coverage is in `src/test/java/com/fraergod/fraerapp/GameFlowTests.java`.

Covered flows:

- published seeded story is listed
- admin import/validate/publish
- invalid story is rejected
- session choice/effect/condition behavior
- session ownership enforcement
- ending marks session as finished

## Useful Working Assumptions

- The story engine is the real product; `task` module is secondary.
- `build/` contains generated artifacts and prior test outputs, not source of truth.
- There is no `.git` directory in the current workspace snapshot, so local git history/status is unavailable here.
- `README.md` contains useful product context, but part of its Russian text is misencoded in the current file view.

## Good First Places To Read Next Time

- `src/main/java/com/fraergod/fraerapp/game/GameService.java`
- `src/main/java/com/fraergod/fraerapp/game/StoryAdminService.java`
- `src/test/java/com/fraergod/fraerapp/GameFlowTests.java`
- `story-builder/app.js`
- `frontend/engine.js`
