# FraerApp Homelab Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the FraerApp core stack, recover the existing Nginx Proxy Manager, and add FraerApp to Homepage without interrupting other homelab services.

**Architecture:** FraerApp continues to terminate its own local TLS on loopback ports 8088/8443, while Nginx Proxy Manager continues to own LAN ports 80/443 for `*.home.arpa`. Only the six FraerApp core services run; the complete FraerApp observability group stays stopped. NPM receives a free fixed address on its existing external Docker network, and Homepage gains one public FraerApp link.

**Tech Stack:** Docker Engine, Docker Compose, nginx, Spring Boot, PostgreSQL, Nginx Proxy Manager, Homepage, POSIX shell, YAML.

**Spec:** `docs/superpowers/specs/2026-09-21-fraerapp-homelab-integration-design.md`

## Global Constraints

- Read `PROJECT_CONTEXT.md`, `DEPLOY_RUNBOOK.md`, and the local-only `LOCAL_OPERATOR_NOTES.private.md` before production work.
- Load `FRAERAPP_SSH`, `FRAERAPP_REMOTE_DIR`, `FRAERAPP_DOMAIN`, and `FRAERAPP_LAN_IP` from the local-only operator notes; never write their concrete private values into committed files or command output.
- Preserve all existing containers, data volumes, certificates, proxy routes, Homepage entries, and user data.
- Never run `docker compose down`, remove a volume, prune Docker state, or recreate an unrelated Compose project.
- Make timestamped server-side backups before changing NPM or Homepage configuration.
- Do not start the FraerApp observability services: `grafana`, `prometheus`, `loki`, `promtail`, `node-exporter`, `cadvisor`, `nginx-exporter`, `postgres-exporter`, or `auth-postgres-exporter`.
- Router and Cloudflare mutations remain outside this plan.
- Stop and restore the relevant backup if any existing `*.home.arpa` route or unrelated container regresses.

## Review Focus

- The chosen NPM address may become occupied between inspection and recreation; recheck the external proxy network immediately before editing and refuse the edit if `172.21.0.10` is present.
- Recreating NPM may preserve the address but lose routing if persistent mounts are wrong; verify the same data and certificate mount sources before and after recreation.
- FraerApp databases may need recovery after their prior long stop; wait for both database health checks and inspect their fresh logs before accepting API health.
- The six-service Compose command may start dependencies but must not start observability services; compare the exact running-service list afterward.
- Homepage YAML indentation errors could hide all entries; validate YAML before replacing the live file and confirm every pre-existing service name remains afterward.

---

### Task 1: Capture baseline and create recoverable backups

**Files:**
- Read: `LOCAL_OPERATOR_NOTES.private.md`
- Create remotely: a timestamped directory under `$FRAERAPP_REMOTE_DIR/backups/` with prefix `homelab-integration-`.
- Back up remotely: `$FRAERAPP_REMOTE_DIR/.env`
- Back up remotely: `/opt/stacks/npm/compose.yaml`
- Back up remotely: `/opt/stacks/npm/data/database.sqlite`
- Back up remotely: `/opt/stacks/homepage/config/services.yaml`

**Interfaces:**
- Consumes: operator variables from `LOCAL_OPERATOR_NOTES.private.md`.
- Produces: a timestamped backup directory path and baseline container snapshot used by all later tasks.

- [ ] **Step 1: Load private operator values without printing them**

Extract only the four required exports from the Markdown file; never source the complete document as shell code:

```bash
eval "$(sed -n "/^export FRAERAPP_\(SSH\|REMOTE_DIR\|DOMAIN\|LAN_IP\)=/p" LOCAL_OPERATOR_NOTES.private.md)"
```

Expected: all four variables are non-empty when checked with `test -n`, without printing their values.

- [ ] **Step 2: Capture the running-container identity baseline**

Run:

```bash
ssh "$FRAERAPP_SSH" 'docker ps --format "{{.ID}} {{.Names}} {{.Image}} {{.Status}}" | sort' > /tmp/fraerapp-homelab-before.txt
```

Expected: the snapshot includes the running homelab containers and no running FraerApp containers.

- [ ] **Step 3: Verify backup sources and disk capacity**

Run:

```bash
ssh "$FRAERAPP_SSH" "test -s '$FRAERAPP_REMOTE_DIR/.env' && test -s /opt/stacks/npm/compose.yaml && test -s /opt/stacks/npm/data/database.sqlite && test -s /opt/stacks/homepage/config/services.yaml && df -Pk '$FRAERAPP_REMOTE_DIR'"
```

Expected: exit 0 and at least 1 GiB free.

- [ ] **Step 4: Create timestamped backups**

Run:

```bash
ssh "$FRAERAPP_SSH" "set -euo pipefail; ts=\$(date +%Y%m%d-%H%M%S); backup='$FRAERAPP_REMOTE_DIR/backups/homelab-integration-'\$ts; mkdir -p \"\$backup/npm\" \"\$backup/homepage\"; cp -a '$FRAERAPP_REMOTE_DIR/.env' \"\$backup/fraerapp.env\"; cp -a /opt/stacks/npm/compose.yaml \"\$backup/npm/compose.yaml\"; sudo -n cp -a /opt/stacks/npm/data/database.sqlite \"\$backup/npm/database.sqlite\"; cp -a /opt/stacks/homepage/config/services.yaml \"\$backup/homepage/services.yaml\"; sudo -n chown -R \$(id -u):\$(id -g) \"\$backup\"; printf '%s\n' \"\$backup\""
```

Expected: one absolute backup directory is printed; record it for rollback.

- [ ] **Step 5: Verify backup readability**

Run `test -s` over all four copied files in the recorded backup directory.

Expected: exit 0.

### Task 2: Recover the existing Nginx Proxy Manager

**Files:**
- Modify remotely: `/opt/stacks/npm/compose.yaml`
- Preserve remotely: `/opt/stacks/npm/data/`
- Preserve remotely: `/opt/stacks/npm/letsencrypt/`

**Interfaces:**
- Consumes: external Docker network `proxy` and the Task 1 NPM backup.
- Produces: the existing `npm` container running at fixed proxy-network address `172.21.0.10` with its existing routes and LAN port bindings.

- [ ] **Step 1: Recheck the candidate address and port ownership**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; ! docker network inspect proxy --format "{{range .Containers}}{{.IPv4Address}} {{end}}" | tr " " "\n" | grep -q "^172.21.0.10/"; ! ss -lnt | grep -Eq "LISTEN.+:80[[:space:]]|LISTEN.+:443[[:space:]]"'
```

Expected: exit 0. Stop if the address or either port is occupied.

- [ ] **Step 2: Verify persistent mount sources before recreation**

Run:

```bash
ssh "$FRAERAPP_SSH" 'docker inspect -f "{{range .Mounts}}{{.Source}}:{{.Destination}};{{end}}" npm'
```

Expected: `/opt/stacks/npm/data:/data` and `/opt/stacks/npm/letsencrypt:/etc/letsencrypt`.

- [ ] **Step 3: Apply the single-address configuration edit**

Use a remote temporary file and atomic install:

```bash
ssh "$FRAERAPP_SSH" 'set -euo pipefail; src=/opt/stacks/npm/compose.yaml; tmp=$(mktemp); sed "s/ipv4_address: 172\.21\.0\.2$/ipv4_address: 172.21.0.10/" "$src" > "$tmp"; grep -q "ipv4_address: 172.21.0.10" "$tmp"; test "$(grep -c "ipv4_address:" "$tmp")" -eq 1; install -m 0644 "$tmp" "$src"; rm -f "$tmp"'
```

Expected: exit 0 and exactly one `ipv4_address` line with `172.21.0.10`.

- [ ] **Step 4: Validate and recreate only NPM**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; cd /opt/stacks/npm; docker compose config --quiet; docker compose up -d npm'
```

Expected: only container `npm` is recreated and reaches running state.

- [ ] **Step 5: Verify routes, mounts, address, and local endpoints**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; docker inspect -f "status={{.State.Status}} restart={{.HostConfig.RestartPolicy.Name}} ip={{(index .NetworkSettings.Networks \"proxy\").IPAddress}} mounts={{range .Mounts}}{{.Source}}:{{.Destination}};{{end}}" npm; for host in proxy.home.arpa beszel.home.arpa adguard.home.arpa portainer.home.arpa uptime.home.arpa homeassistant.home.arpa git.home.arpa home.home.arpa share.home.arpa; do code=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "http://$host/"); case "$code" in 200|301|302|401|403) ;; *) echo "$host returned $code" >&2; exit 1;; esac; done'
```

Expected: NPM is running with `restart=unless-stopped`, IP `172.21.0.10`, unchanged mounts, and every route returns an expected HTTP status.

### Task 3: Start and verify only the FraerApp core

**Files:**
- Read remotely: `$FRAERAPP_REMOTE_DIR/compose.yaml`
- Read remotely: `$FRAERAPP_REMOTE_DIR/.env`
- Preserve Docker volumes: `fraerapp_postgres-data`, `fraerapp_auth-postgres-data`, and `fraerapp_story-uploads`.

**Interfaces:**
- Consumes: existing FraerApp images, Compose configuration, environment, certificates, and volumes.
- Produces: six running core services on loopback ports 8088/8443, with the observability group stopped.

- [ ] **Step 1: Validate Compose and required runtime assets**

Run:

```bash
ssh "$FRAERAPP_SSH" "set -e; cd '$FRAERAPP_REMOTE_DIR'; docker compose config --quiet; test -s .env; test -s nginx/certs/fraerapp.fullchain.crt; test -s nginx/certs/fraerapp.key"
```

Expected: exit 0.

- [ ] **Step 2: Start the exact core-service set**

Run:

```bash
ssh "$FRAERAPP_SSH" "set -e; cd '$FRAERAPP_REMOTE_DIR'; docker compose up -d postgres auth-postgres api auth-service story-builder edge"
```

Expected: the two databases start first, followed by API/auth, builder, and edge.

- [ ] **Step 3: Wait for core health with a bounded loop**

Run:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR'; for attempt in \$(seq 1 30); do ready=1; for service in postgres auth-postgres api auth-service story-builder edge; do cid=\$(docker compose ps -q \"\$service\"); test -n \"\$cid\" || { ready=0; continue; }; state=\$(docker inspect -f '{{.State.Status}}' \"\$cid\"); health=\$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \"\$cid\"); test \"\$state\" = running && { test \"\$health\" = healthy || test \"\$health\" = none; } || ready=0; done; test \"\$ready\" -eq 1 && exit 0; sleep 10; done; docker compose ps --all; exit 1"
```

Expected: all six services become healthy before timeout. On timeout, collect logs and stop without modifying volumes.

- [ ] **Step 4: Verify local HTTP behavior**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; curl -skS --max-time 10 https://127.0.0.1:8443/healthz | grep -qx ok; curl -skS --max-time 10 https://127.0.0.1:8443/actuator/health/readiness | grep -q '"'"'"status"'"'":"'"'"UP"'"'"'; curl -skS --max-time 10 https://127.0.0.1:8443/api/catalog/stories | grep -q '"'"'^\['"'"''
```

Expected: edge returns `ok`, readiness is `UP`, and the catalog is a JSON array.

- [ ] **Step 5: Prove observability stayed stopped**

Run:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR'; test -z \"\$(docker compose ps --services --status running | grep -E '^(grafana|prometheus|loki|promtail|node-exporter|cadvisor|nginx-exporter|postgres-exporter|auth-postgres-exporter)$' || true)\""
```

Expected: exit 0 with no matching running services.

- [ ] **Step 6: Inspect fresh startup logs**

Run:

```bash
ssh "$FRAERAPP_SSH" "cd '$FRAERAPP_REMOTE_DIR'; docker compose logs --since=10m postgres auth-postgres api auth-service edge story-builder 2>&1 | grep -Ei 'error|exception|fatal|panic|unhealthy| 5[0-9][0-9] ' | tail -120 || true"
```

Expected: no unresolved fatal error, repeated exception, unhealthy transition, or HTTP 5xx response.

### Task 4: Add FraerApp to Homepage

**Files:**
- Modify remotely: `/opt/stacks/homepage/config/services.yaml`
- Preserve: all existing Homepage groups and entries.

**Interfaces:**
- Consumes: Task 1 Homepage backup and the existing `Разработка` group.
- Produces: one new `FraerApp` tile linking to `https://fraerapp.ru`.

- [ ] **Step 1: Confirm the entry does not already exist**

Run:

```bash
ssh "$FRAERAPP_SSH" '! grep -q "^[[:space:]]*- FraerApp:" /opt/stacks/homepage/config/services.yaml'
```

Expected: exit 0. If it exists, inspect it and avoid creating a duplicate.

- [ ] **Step 2: Build a candidate file with the FraerApp entry**

Insert these four lines immediately before the `Обмен` group, preserving YAML indentation:

```yaml
    - FraerApp:
        icon: mdi-book-open-page-variant
        href: https://fraerapp.ru
        description: Интерактивные истории
```

Create the candidate with:

```bash
ssh "$FRAERAPP_SSH" 'set -euo pipefail; src=/opt/stacks/homepage/config/services.yaml; candidate=/tmp/homepage-services-fraerapp.yaml; awk '\''BEGIN { added=0 } /^- Обмен:/ && !added { print "    - FraerApp:"; print "        icon: mdi-book-open-page-variant"; print "        href: https://fraerapp.ru"; print "        description: Интерактивные истории"; print ""; added=1 } { print } END { if (!added) exit 42 }'\'' "$src" > "$candidate"; test "$(grep -c "^[[:space:]]*- FraerApp:" "$candidate")" -eq 1'
```

Expected: `/tmp/homepage-services-fraerapp.yaml` exists with exactly one FraerApp entry; the mounted live file is unchanged.

- [ ] **Step 3: Validate candidate YAML and preservation invariants**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -euo pipefail; src=/opt/stacks/homepage/config/services.yaml; candidate=/tmp/homepage-services-fraerapp.yaml; docker exec -i homepage node -e '\''const fs=require("fs"); const yaml=require("yaml"); yaml.parse(fs.readFileSync(0,"utf8"));'\'' < "$candidate"; grep -E "^[[:space:]]{4}- .*:$" "$src" | while IFS= read -r heading; do test "$(grep -Fxc "$heading" "$candidate")" -eq 1 || { echo "missing or duplicated: $heading" >&2; exit 1; }; done; test "$(grep -c "^[[:space:]]*- FraerApp:" "$candidate")" -eq 1'
```

Expected: valid YAML, every original service retained, and one FraerApp entry.

- [ ] **Step 4: Atomically install and reload Homepage**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; install -m 0644 /tmp/homepage-services-fraerapp.yaml /opt/stacks/homepage/config/services.yaml; for attempt in 1 2 3 4 5 6; do docker logs --since=15s homepage 2>&1 | grep -Eqi "yaml|parse.*error|exception" && exit 1; curl -sS --max-time 5 http://home.home.arpa/ >/dev/null && exit 0; sleep 5; done; cd /opt/stacks/homepage; docker compose restart homepage; for attempt in 1 2 3 4 5 6; do curl -sS --max-time 5 http://home.home.arpa/ >/dev/null && exit 0; sleep 5; done; exit 1'
```

Expected: Homepage remains healthy and no unrelated container is recreated.

- [ ] **Step 5: Verify rendered configuration and logs**

Run:

```bash
ssh "$FRAERAPP_SSH" 'set -e; grep -A3 "^[[:space:]]*- FraerApp:" /opt/stacks/homepage/config/services.yaml | grep -q "href: https://fraerapp.ru"; docker logs --since=5m homepage 2>&1 | grep -Ei "yaml|parse|error|exception" && exit 1 || exit 0'
```

Expected: the FraerApp URL is present and there are no YAML/parser errors.

### Task 5: Regression verification, documentation, and git closeout

**Files:**
- Modify: `PROJECT_CONTEXT.md`
- Modify: `DEPLOY_RUNBOOK.md`
- Preserve: `LOCAL_OPERATOR_NOTES.private.md` as ignored local-only state.

**Interfaces:**
- Consumes: Task 1 baseline and the running services from Tasks 2–4.
- Produces: verified operational state and durable documentation of the new integration.

- [ ] **Step 1: Compare unrelated container identities**

Capture a new `docker ps` snapshot and compare container IDs for every pre-existing non-`npm`, non-`homepage`, non-FraerApp container against `/tmp/fraerapp-homelab-before.txt`.

Expected: all unrelated running containers retain their original IDs and running state.

- [ ] **Step 2: Check NPM and Homepage through their normal local names**

Request `http://proxy.home.arpa` and `http://home.home.arpa` from the LAN environment.

Expected: each returns HTTP 200/301/302 and the Homepage config contains the FraerApp tile.

- [ ] **Step 3: Check public FraerApp without overstating readiness**

Run:

```bash
curl -sS --connect-timeout 5 --max-time 20 -o /dev/null -w '%{http_code}\n' "https://$FRAERAPP_DOMAIN/"
```

Expected: HTTP 200 only if router and Cloudflare routing are already correct. A timeout or Cloudflare 52x is recorded as pending router/DNS work, while local FraerApp health remains independently verified.

- [ ] **Step 4: Update operational documentation**

Document in `PROJECT_CONTEXT.md` that FraerApp shares a homelab host, its core services may run without the observability profile, NPM owns LAN ports 80/443 for `*.home.arpa`, and Homepage links to the public FraerApp domain. Document in `DEPLOY_RUNBOOK.md` the explicit six-service startup command, the requirement to check shared-host port ownership, and the router mapping using `$FRAERAPP_LAN_IP` placeholders.

Expected: no concrete private IP, token, password, or SSH target appears in committed documentation.

- [ ] **Step 5: Run repository documentation checks**

Run:

```bash
git diff --check
rg -n '192\.168\.[0-9]+\.[0-9]+|[0-9]{8,10}:[A-Za-z0-9_-]{30,}|[a-f0-9]{64}' PROJECT_CONTEXT.md DEPLOY_RUNBOOK.md docs/superpowers
```

Expected: `git diff --check` passes and the secret/private-value scan returns no matches.

- [ ] **Step 6: Commit task-owned documentation**

Stage only `PROJECT_CONTEXT.md`, `DEPLOY_RUNBOOK.md`, the approved spec correction, and this plan. Commit with:

```bash
git commit -m "docs: record FraerApp homelab operations"
```

Expected: one local commit containing only task-owned documentation; `LOCAL_OPERATOR_NOTES.private.md` remains ignored.

- [ ] **Step 7: Report deployment state**

Report separately: local documentation state, commits, push state, FraerApp deployment state, NPM state, Homepage integration, public-domain state, router/DNS follow-up, backup path, and any residual risk.
