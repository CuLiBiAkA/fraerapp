# FraerApp agent instructions

Last updated: 2026-07-02.

This repository is the working checkout for FraerApp. Any new Codex thread working in this project must read these files first:

1. `PROJECT_CONTEXT.md` — project structure, deployment shape, domains, and known decisions.
2. `DEPLOY_RUNBOOK.md` — safe operational checklist using placeholders and environment variables.
3. `LOCAL_OPERATOR_NOTES.private.md` — local-only private parameters, if present in this checkout. This file is intentionally ignored by git and must not be pushed.

## Operating rules

- Always report whether changes are local-only, committed, pushed, and/or deployed to production.
- Before changing production, inspect current state first: git status locally, runtime status remotely, and relevant logs.
- Production state may drift. Do not rely only on these docs for current IP, DNS, container state, or runtime health; verify live.
- Do not expose secrets, private hostnames, private IPs, tokens, cookies, or temporary JWTs in logs or final answers.
- Preserve user changes. If the worktree is dirty, identify unrelated changes and do not overwrite them.
- Use `apply_patch` for file edits.
- Use `rg`/`rg --files` for repository search.
- For network, SSH, git push, Docker, or production checks, request escalated execution when required by the sandbox.

## Context maintenance

After any meaningful project, deployment, auth, infrastructure, story-engine, or production-process change, update the relevant context files in the same commit:

- `PROJECT_CONTEXT.md` for architecture, service behavior, known issues, domains, deployment shape, and important decisions.
- `DEPLOY_RUNBOOK.md` for commands, deploy steps, verification steps, incident handling, and operational procedures.
- `LOCAL_OPERATOR_NOTES.private.md` only for private local values that must not be pushed.

If no context file needs an update, mention that explicitly in the final handoff.

## Repository defaults

- Main working branch used in recent work: `codex/passkey-auth-compliance`.
- Production runtime path is documented as a variable in `DEPLOY_RUNBOOK.md`; read local private notes for the concrete value.
- Production SSH target is documented as `$FRAERAPP_SSH`; read local private notes for the concrete value.
- Production domain is documented as `$FRAERAPP_DOMAIN`; read local private notes for the concrete value.
- Cloudflare fronts the public domain; origin DNS must match the current public origin IP.

## Verification baseline

Use checks proportional to the change:

- Frontend syntax/tests:
  - `node --check frontend/engine.js`
  - `node --test frontend/engine.i18n.test.js frontend/passkeys.test.js story-builder/core.test.js story-builder/auth-session.test.js`
- Auth service:
  - `sh gradlew :auth-service:test --no-daemon`
- API/auth-service Java changes:
  - `sh gradlew :auth-service:test test --no-daemon` when relevant
- Always run:
  - `git diff --check`

If `node` is not on PATH, use the bundled runtime from the Codex workspace dependencies.

## Production deploy rules

- Make a backup before overwriting remote runtime files.
- Frontend files are mounted into nginx and usually do not require container rebuild.
- `api` and `auth-service` changes require Docker rebuild/recreate of the changed service.
- After deploy, verify:
  - runtime service/container status;
  - service health endpoint;
  - public domain response;
  - relevant API endpoint;
  - recent logs.
