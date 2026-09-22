# FraerApp deploy and ops runbook

Last updated: 2026-09-22.

This file is a practical checklist for production operations. Read `PROJECT_CONTEXT.md` first.

This runbook is safe to commit: it uses placeholders and environment variables instead of private host/user/IP values. Concrete local values may exist in `LOCAL_OPERATOR_NOTES.private.md`, which is intentionally ignored by git.

## Required local variables

Set these before running production commands:

```bash
export FRAERAPP_SSH='<ssh-target>'
export FRAERAPP_REMOTE_DIR='<remote-runtime-directory>'
export FRAERAPP_DOMAIN='<public-domain>'
export FRAERAPP_LAN_IP='<server-lan-ip>'
```

## Quick production status

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps"
```

Check local origin from the server:

```bash
ssh "$FRAERAPP_SSH" 'curl -skSI https://127.0.0.1:8443/ | sed -n "1,20p"'
ssh "$FRAERAPP_SSH" 'curl -sSI http://127.0.0.1:8088/ | sed -n "1,20p"'
```

Check public site:

```bash
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/"
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/api/catalog/stories"
```

Check current public IP:

```bash
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org; echo'
```

## Shared homelab host

FraerApp shares its Docker host with Nginx Proxy Manager, Homepage, AdGuard, Home Assistant, Forgejo, Beszel, Portainer, Uptime Kuma, and other services. Before starting or recreating FraerApp, inspect host port ownership and running containers:

```bash
ssh "$FRAERAPP_SSH" 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
ssh "$FRAERAPP_SSH" 'ss -lnt | grep -E ":(80|443|3000|8088|8443|8090)[[:space:]]" || true'
```

Start only the FraerApp core when observability is not required:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose up -d postgres auth-postgres api auth-service story-builder edge"
```

Confirm the core restart policy after bringing old containers back online:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && for service in postgres auth-postgres api auth-service story-builder edge; do cid=\$(docker compose ps -q \"\$service\"); docker inspect -f \"\$service restart={{.HostConfig.RestartPolicy.Name}} status={{.State.Status}}\" \"\$cid\"; done"
```

Do not start `grafana`, `prometheus`, `loki`, `promtail`, `node-exporter`, `cadvisor`, `nginx-exporter`, `postgres-exporter`, or `auth-postgres-exporter` as part of this minimal startup. Grafana's configured port may conflict with another homelab service.

Nginx Proxy Manager owns the server LAN ports 80/443 for local `*.home.arpa` services. FraerApp edge must bind high ports 8088/8443 only to `$FRAERAPP_LAN_IP`; verify this in the private runtime `.env`:

```bash
ssh "$FRAERAPP_SSH" "grep -E '^(HOST_BIND_IP|HTTP_PORT|HTTPS_PORT)=' '$FRAERAPP_REMOTE_DIR/.env'"
```

Expected values are `HOST_BIND_IP=$FRAERAPP_LAN_IP`, `HTTP_PORT=8088`, and `HTTPS_PORT=8443`. Confirm reachability from a different LAN host before changing the router:

```bash
curl -k --resolve "$FRAERAPP_DOMAIN:8443:$FRAERAPP_LAN_IP" "https://$FRAERAPP_DOMAIN:8443/healthz"
```

The intended router mappings for the public FraerApp domain are:

```text
external TCP 80  -> $FRAERAPP_LAN_IP:8088
external TCP 443 -> $FRAERAPP_LAN_IP:8443
```

Do not bind FraerApp directly to the host LAN ports 80/443 while Nginx Proxy Manager owns them.

Known exception: `homeassistant.home.arpa` may time out even while Home Assistant responds directly on the LAN, because the NPM proxy network cannot currently reach Home Assistant's host-network listener. This issue is outside FraerApp operations. Verify the direct Home Assistant endpoint before treating it as a service outage, and do not change Home Assistant networking as part of a FraerApp deploy.

## Logs

Recent relevant logs:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h edge | tail -200"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h api | tail -200"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h auth-service | tail -200"
```

Search for errors:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h edge 2>/dev/null | grep -Ei ' 4[0-9][0-9] | 5[0-9][0-9] |error|warn|upstream|timed out|refused|forbidden' | tail -200 || true"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=2h api auth-service 2>/dev/null | grep -Ei 'error|exception|warn| 4[0-9][0-9] | 5[0-9][0-9] |forbidden|unauthorized|failed|timeout|refused' | tail -200 || true"
```

Interpretation:

- `401 /auth/me` is usually normal when no valid session exists.
- `401 /auth/verify` usually means login link expired or already used.
- `403 /auth/passkeys/registration/options` usually means recent auth is required.
- Cloudflare `522` means Cloudflare cannot connect to origin.
- Cloudflare `525` means Cloudflare reached an origin listener but could not complete TLS. Verify that external TCP 443 maps to `$FRAERAPP_LAN_IP:8443`; mapping it to Nginx Proxy Manager's LAN port 443 sends the FraerApp hostname to the wrong TLS endpoint.
- nginx `client request body is buffered to a temporary file` during story import is usually non-critical.

## Cloudflare 522 / site unavailable

1. Check public response:

```bash
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/"
```

2. Check runtime services:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps"
```

3. Check local origin:

```bash
ssh "$FRAERAPP_SSH" 'curl -skSI https://127.0.0.1:8443/'
```

4. Check public origin IP:

```bash
ssh "$FRAERAPP_SSH" 'curl -sS https://api.ipify.org; echo'
```

5. If origin local is 200 but Cloudflare is 522, update Cloudflare DNS A records to the current public IP.

Direct test of new IP before DNS update:

```bash
curl -k --resolve "$FRAERAPP_DOMAIN:443:<CURRENT_PUBLIC_IP>" "https://$FRAERAPP_DOMAIN/"
```

## Frontend deploy

Frontend files are mounted into nginx. Rebuild is usually not required.

1. Check local git status:

```bash
git status --short --branch
```

2. Run frontend checks:

```bash
node --check frontend/engine.js
node --check frontend/legal.js
node --check frontend/legal-config.js
node --check scripts/validate-production.mjs
node scripts/validate-production.mjs
node --test frontend/engine.i18n.test.js frontend/passkeys.test.js frontend/public-surface.test.js story-builder/core.test.js story-builder/auth-session.test.js
git diff --check
```

3. Copy files to the server:

```bash
scp frontend/index.html frontend/engine.js frontend/styles.css frontend/legal-config.js frontend/legal.js frontend/privacy-policy.html frontend/personal-data-consent.html frontend/terms.html frontend/robots.txt "$FRAERAPP_SSH:/tmp/"
```

4. Backup and install:

```bash
ssh "$FRAERAPP_SSH" "set -euo pipefail
cd '$FRAERAPP_REMOTE_DIR'
ts=\$(date +%Y%m%d-%H%M%S)
mkdir -p backups/deploy-\$ts
cp frontend/index.html frontend/engine.js frontend/styles.css backups/deploy-\$ts/
cp frontend/legal-config.js frontend/legal.js frontend/privacy-policy.html frontend/personal-data-consent.html frontend/terms.html frontend/robots.txt backups/deploy-\$ts/
install -m 0644 /tmp/index.html frontend/index.html
install -m 0644 /tmp/engine.js frontend/engine.js
install -m 0644 /tmp/styles.css frontend/styles.css
install -m 0644 /tmp/legal-config.js frontend/legal-config.js
install -m 0644 /tmp/legal.js frontend/legal.js
install -m 0644 /tmp/privacy-policy.html frontend/privacy-policy.html
install -m 0644 /tmp/personal-data-consent.html frontend/personal-data-consent.html
install -m 0644 /tmp/terms.html frontend/terms.html
install -m 0644 /tmp/robots.txt frontend/robots.txt
curl -skS https://127.0.0.1:8443/healthz
"
```

5. Verify public asset version:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/" | rg 'engine.js|styles.css'
```

## Legal/public SEO checks

Before publishing public frontend changes, run:

```bash
node scripts/validate-production.mjs
```

This fails if required legal values in `frontend/legal-config.js` are missing, if legal pages contain unpublished warnings or empty реквизиты, if the homepage exposes service/admin text in public visible content, or if production nginx noindex headers for `/auth/admin...` and `/builder/` are missing from `nginx/nginx.prod.conf`.

If nginx config changes are deployed, rebuild/recreate `edge` and verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build edge && docker compose up -d edge"
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/builder/" | grep -i x-robots-tag
curl -sSI -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/auth/admin" | grep -i x-robots-tag
```

## API deploy

Use this when changing `src/main/java`, DB migrations, or main game/story API behavior.

1. Run tests:

```bash
sh gradlew test --no-daemon
git diff --check
```

2. Commit and push first unless emergency.

3. Copy changed repo files or update the production checkout/files according to the current deployment method.

4. Rebuild/recreate:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build api && docker compose up -d api"
```

5. Wait and verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps && curl -skS https://127.0.0.1:8443/actuator/health/readiness"
```

## Auth-service deploy

Use this when changing `auth-service/**`.

1. Run tests:

```bash
sh gradlew :auth-service:test --no-daemon
git diff --check
```

2. Rebuild/recreate:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose build auth-service && docker compose up -d auth-service"
```

3. Verify:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose ps && curl -skS https://127.0.0.1:8443/auth/me"
```

`/auth/me` without a session may return 401; that only proves routing works. For auth health, use container health plus a known authenticated flow if needed.

## Telegram login deploy

Telegram login runs through `auth-service`, is the public sign-in path, and uses the same temporary-link verification as recovery/admin email login. Public email login is intentionally hidden from the main frontend.

Required environment variables:

```bash
export AUTH_TELEGRAM_BOT_ENABLED=true
export AUTH_TELEGRAM_BOT_USERNAME='<bot-username-without-@>'
export AUTH_TELEGRAM_BOT_TOKEN='<telegram-bot-token>'
export AUTH_TELEGRAM_WEBHOOK_SECRET='<random-webhook-secret>'
export AUTH_TELEGRAM_LOGIN_REDIRECT_PATH='/'
```

Keep the bot token and webhook secret in private local/runtime env only. Do not commit them.

After deploying `auth-service`, register the webhook:

```bash
curl -sS -X POST "https://api.telegram.org/bot$AUTH_TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://$FRAERAPP_DOMAIN/auth/telegram/webhook\",\"secret_token\":\"$AUTH_TELEGRAM_WEBHOOK_SECRET\"}"
```

Verify without printing secrets:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/auth/telegram/login"
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR' && docker compose logs --since=30m auth-service | grep -Ei 'telegram|error|exception|warn' | tail -100 || true"
```

Expected behavior:

- `/auth/telegram/login` returns `enabled: true` and the public bot URL;
- the homepage shows Telegram and passkey login, not the email form;
- a Telegram message to the bot produces a one-time FraerApp link;
- auth DB receives a `telegram_identities` binding, an `email_login_tokens` row, and a `login_link_requested` audit event with `source=telegram_bot`.

Production note: the webhook should return Telegram's `sendMessage` method JSON directly. Do not make auth-service depend on outbound HTTPS to `api.telegram.org`; the production host may be unable to reach it even though inbound Telegram webhooks arrive through Cloudflare.

Telegram retries failed webhook updates. The webhook must avoid returning `429` for normal user messages, because Telegram will keep retrying and the bot will appear silent.

## Story creation and publication

Story files live in:

```text
story-builder/scenarios/
```

Validate a story JSON:

```bash
python3 -m json.tool story-builder/scenarios/<story>.json >/tmp/story.validated.json
```

For repository validation, also check scene/asset references with a small script or builder tests.

### Publish as system/admin

Use `/api/admin/stories/import` only when a system-owned story is acceptable.

### Publish under an author account

Use `/api/author/stories/import` and `/api/author/stories/{storyId}/publish` with that author's authenticated context, so `owner_player_id` is set correctly.

If a temporary JWT is explicitly authorized for a production action:

- generate it inside the remote shell;
- do not print it;
- use the shortest practical expiration;
- use only for the requested import/publish action.

After publication, verify:

```bash
curl -sS -A 'Mozilla/5.0' "https://$FRAERAPP_DOMAIN/api/catalog/stories"
```

Check owner with a parameterized SQL query in the remote runtime. Do not print database passwords or tokens.

## Git handoff checklist

Before telling the user work is done:

```bash
git status --short --branch
git log --oneline --decorate -5
git branch -vv
git diff --check
```

If pushed, verify the remote ref:

```bash
git ls-remote origin refs/heads/codex/passkey-auth-compliance
```

Report:

- branch;
- latest commit;
- whether working tree is clean;
- whether local and remote match;
- whether production was updated.
