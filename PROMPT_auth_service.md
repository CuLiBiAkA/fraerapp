# Auth service prompt

Implement production-grade passwordless authorization for FraerApp as a separate backend service.

Architecture decisions:

- Add a new Java/Spring Boot `auth-service` in this repository with its own Dockerfile and container in `compose.yaml`.
- Use Postgres-compatible Flyway migrations. In local/dev tests H2 compatibility is acceptable, but the schema must be production-friendly.
- Keep `players` in the main API as the player profile/runtime ownership model, but add a stable `user_id` link and migrate runtime trust away from client-provided `X-Player-Id`.
- Browser sessions use secure httpOnly cookies. Do not store auth tokens in localStorage.
- The auth service signs short-lived access JWTs and exposes `/auth/jwks`; the main API verifies JWTs and derives identity/roles from them.
- Public catalog/read-only published story endpoints may remain anonymous. Game sessions, saves, author endpoints, and admin endpoints require authenticated identity.
- `player` is granted by default. `author` and `admin` are explicit roles. The first admin is bootstrapped from `AUTH_BOOTSTRAP_ADMIN_EMAIL`.

Required auth-service behavior:

- `POST /auth/login-link`: accept email and optional redirect path, normalize email, always return a generic success response, create a one-time magic-link token with a short TTL, store only a token hash, rate-limit requests, and send email in prod through SMTP.
- Dev mode must not send real email. It should log the magic link and expose a safe dev-only endpoint to fetch recent magic links.
- `POST /auth/verify`: exchange the magic-link token for an authenticated session, mark token as used, protect against replay, create/update the user, create server-side session and refresh token, set secure httpOnly cookies, and redirect/return the requested destination.
- `POST /auth/refresh`: rotate refresh token and issue a fresh access cookie.
- `GET /auth/me`: return current user id, email and roles.
- `POST /auth/logout`: revoke the current session/refresh token and clear cookies.
- `POST /auth/logout-all`: revoke all user sessions.
- Admin-only role management endpoints must allow granting/removing `author` and `admin`.
- Add audit rows for login-link requested, verified, refreshed, logout, logout-all, and role changes.

Main API integration:

- Add an auth filter/middleware that accepts the auth access cookie or Bearer token, verifies the JWT, and exposes current user id and roles to controllers/services.
- Remove runtime trust in `X-Player-Id`; keep it only as an optional legacy migration hint if needed.
- Link or create a `Player` profile for the authenticated user. Existing `game_sessions.player_id`, story ownership, catalog progress, saves, and analytics must continue to work through the profile.
- Replace `dev-admin-token` checks with role `admin`.
- Author endpoints require role `author`; admin endpoints require role `admin`; player game endpoints require authenticated `player`.

Frontend:

- Replace username login with email magic-link login in `frontend`.
- Add sent-email, callback verification, current user, and logout states.
- Update `story-builder` to use the same auth session, show current user, require `author`, remove admin token input, and use role-based protected actions.
- Keep Russian user-facing errors and redirects back to the page that started login.

Tests and docs:

- Add integration tests for magic-link generation, one-time use, TTL, refresh rotation, logout, logout-all, role checks, and protected API access.
- Add a dev e2e/test flow that obtains a dev magic link, logs in, plays, opens author UI, and verifies admin protection.
- Update README/env docs for auth-service, SMTP, cookies, JWKS, roles, bootstrap admin, dev magic-link flow, and migration from `X-Player-Id`.
