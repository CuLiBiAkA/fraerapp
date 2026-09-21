# FraerApp homelab integration design

Date: 2026-09-21

## Goal

Restore FraerApp on the current server without interrupting the existing homelab services, keep the observability stack stopped, restore the existing Nginx Proxy Manager instance, and make FraerApp visible from Homepage.

## Current state

- The server is reachable at the operator-only SSH target documented in `LOCAL_OPERATOR_NOTES.private.md`.
- The FraerApp Compose project exists in `/opt/fraerapp`, but all 15 containers are stopped.
- FraerApp stopped gracefully on 2026-08-21; the application and database logs do not indicate a crash at shutdown.
- The current FraerApp Compose configuration is valid.
- Existing homelab services are running and must not be recreated or restarted.
- Nginx Proxy Manager is configured and retains its routes, but it is stopped because its fixed proxy-network address `172.21.0.2` conflicts with Beszel.
- Host ports 80 and 443 are currently free. Nginx Proxy Manager is configured to publish them on the server LAN address.
- FraerApp production edge is configured on loopback ports 8088 and 8443.
- AdGuard occupies the server LAN port 3000. FraerApp Grafana would conflict because it is configured on `0.0.0.0:3000`.

## Design

### Backups

Before changing runtime configuration, create timestamped copies of:

- `/opt/fraerapp/.env`;
- `/opt/stacks/npm/compose.yaml`;
- `/opt/stacks/homepage/config/services.yaml`;
- Nginx Proxy Manager's persistent data directory or SQLite database.

The backups remain on the server and are not committed to the repository.

### FraerApp startup

Start only the core FraerApp services:

- `postgres`;
- `auth-postgres`;
- `api`;
- `auth-service`;
- `story-builder`;
- `edge`.

Do not start Grafana, Prometheus, Loki, Promtail, cAdvisor, node-exporter, nginx-exporter, or either PostgreSQL exporter. This avoids the host port 3000 conflict and reduces memory use.

Use `docker compose up -d` with an explicit core-service list. This applies the current `restart: unless-stopped` policy to the recreated core containers without touching containers belonging to other Compose projects.

### Nginx Proxy Manager recovery

Keep the existing Nginx Proxy Manager installation, data, certificates, routes, LAN bindings, and external `proxy` network.

Change only its fixed address on the external Docker network:

```text
172.21.0.2 -> 172.21.0.10
```

Confirm that `172.21.0.10` is unused immediately before editing. Recreate only the `npm` Compose project. Existing routes continue to address services by their current hostnames or LAN endpoints and therefore do not depend on NPM retaining `172.21.0.2`.

### Homepage integration

Add a FraerApp entry to the existing `Разработка` group in Homepage:

- name: `FraerApp`;
- URL: `https://fraerapp.ru`;
- description: `Интерактивные истории`;
- icon: a built-in Material Design book/story icon, avoiding a new external asset.

Homepage reads its mounted YAML configuration dynamically. Restart only Homepage if a reload is necessary; do not restart its unrelated dependencies or other services.

### Public routing

Public router changes are outside this execution because router access has not been established. FraerApp remains on loopback ports 8088/8443 until the final route is confirmed.

The intended router mapping is:

```text
external TCP 80  -> 192.168.0.15:8088
external TCP 443 -> 192.168.0.15:8443
```

This mapping bypasses Nginx Proxy Manager for the public FraerApp domain and preserves NPM ownership of host ports 80/443 for local `*.home.arpa` services. If the router cannot translate external and internal ports, public routing requires a separate reviewed design instead of binding FraerApp directly to ports already owned by NPM.

Cloudflare A records must match the server's verified current public IP. DNS changes are not part of this execution.

## Verification

After implementation:

1. Compare running non-FraerApp containers with the pre-change snapshot and confirm they were not recreated.
2. Confirm all six FraerApp core services are running and healthy.
3. Check the local edge health endpoint on `https://127.0.0.1:8443/healthz`.
4. Check API readiness and the public catalog through the local edge.
5. Check recent logs for API, auth-service, edge, and both databases.
6. Confirm observability containers remain stopped.
7. Confirm NPM is running on `192.168.0.15:80/443` and all existing `*.home.arpa` routes still respond.
8. Confirm Homepage contains the FraerApp entry and all existing entries remain present.
9. Check the public domain, but report it as pending router/DNS work if the origin is not reachable externally.

## Rollback

- Stop only the six FraerApp core services if startup causes unexpected resource pressure.
- Restore the timestamped NPM Compose file and recreate only NPM if its routes fail.
- Restore the timestamped Homepage services file and reload only Homepage if its configuration becomes invalid.
- Do not remove Docker volumes or alter either FraerApp database volume during rollback.

## Non-goals

- No application source changes.
- No database migrations beyond those already embedded in the deployed application images.
- No deletion or replacement of NPM, certificates, routes, or persistent data.
- No changes to AdGuard, Home Assistant, Forgejo, Beszel, Portainer, Uptime Kuma, Mosquitto, or Local Content Share.
- No Grafana or broader observability startup.
