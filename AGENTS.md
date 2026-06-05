# FraerApp Codex Project Guide

## Project Shape

FraerApp is a small story-game platform.

- Main API: Spring Boot 4, Java 17, Gradle, PostgreSQL, Flyway.
- Auth API: separate Spring Boot service in `auth-service/`.
- Player UI: static frontend in `frontend/`, served by nginx.
- Story Builder: static authoring tool in `story-builder/`, served as a separate Docker service.
- Edge: nginx in `edge` service proxies `/api/`, `/auth/`, `/uploads/`, Swagger, and health endpoints.

The story engine is the primary product surface. The `task` module is legacy/demo functionality unless the task explicitly targets it.

## Key Paths

- Main runtime: `src/main/java/com/fraergod/fraerapp/game/`
- Main API config: `src/main/resources/application.properties`
- Main DB migrations: `src/main/resources/db/migration/`
- Auth service: `auth-service/`
- Auth DB migrations: `auth-service/src/main/resources/db/migration/`
- Player frontend: `frontend/index.html`, `frontend/engine.js`, `frontend/styles.css`
- Story Builder: `story-builder/index.html`, `story-builder/app.js`, `story-builder/core.js`
- Docker stack: `compose.yaml`, `Dockerfile`, `auth-service/Dockerfile`, `story-builder/Dockerfile`, `nginx/nginx.conf`

## Local Docker Run

Use Docker Compose from the repository root:

```bash
docker compose up -d --build
```

Runtime modes are documented in `DEPLOY_CONFIGS.md`. Local mode binds ports to `127.0.0.1`; production mode binds edge ports to `0.0.0.0` and uses `nginx/nginx.prod.conf`.

Useful URLs on this machine after startup:

- Runtime health: `http://localhost:8088/healthz`
- Runtime UI: `https://localhost/`
- LAN runtime UI: `https://192.168.0.24/` when the host IP has not changed
- Story Builder: `http://localhost:8090/`
- Admin roles UI: `https://localhost/auth/admin`

Current nginx config requires certificate files even for local Docker:

- `nginx/certs/fraerapp.fullchain.crt`
- `nginx/certs/fraerapp.key`

`nginx/certs/` is ignored by git. For a local dev setup, a self-signed certificate is acceptable. Browser warnings are expected.

## Auth Notes

Local dev auth is passwordless magic-link auth through `auth-service`.

- Bootstrap admin email comes from `.env`, defaulting to `admin@example.com`.
- `AUTH_DEV_MODE=true` exposes dev login links in local flows.
- Auth cookies are httpOnly and are set by `/auth/*` routes behind nginx.
- The main API and auth service must share the same `AUTH_JWT_SECRET`.

## Verification Commands

Prefer the narrowest verification that matches the change.

```bash
./gradlew test
./gradlew :bootJar
./gradlew :auth-service:test
docker compose ps
docker compose logs --tail=120 api
docker compose logs --tail=120 auth-service
docker compose logs --tail=120 edge
curl -i http://localhost:8088/healthz
curl -I http://localhost:8090/
```

Frontend and builder tests are plain JavaScript files where present:

```bash
node frontend/engine.i18n.test.js
node story-builder/core.test.js
```

If Docker commands fail with socket permission errors inside Codex, rerun them with the normal Docker escalation path.

## Implementation Guidance

- Keep backend story behavior centered in `GameService` and admin import/publish behavior in `StoryAdminService`.
- Preserve Flyway ownership of database schema changes. Add new migrations instead of editing applied migrations.
- Keep `api` and `auth-service` contracts aligned when touching auth, roles, cookies, JWT, or CORS.
- Avoid client-side trust for identity or admin privileges.
- Keep frontend changes compatible with nginx paths and cookie-based auth.
- Do not treat generated build output, Docker volumes, or local certs as source.
- Avoid broad refactors while fixing deployment, auth, or story-runtime bugs.

## Known Local Fixes

The Docker build needs `gradlew` executable inside Linux build layers. The Dockerfiles should keep:

```dockerfile
RUN chmod +x gradlew
```

before invoking `./gradlew`.
