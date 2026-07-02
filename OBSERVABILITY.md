# FraerApp Observability

This stack is the "adult" dashboard option for FraerApp: metrics, logs, errors, infrastructure health, Docker health, PostgreSQL health, and Spring request behavior in one place.

## Implementation Prompt

Use this prompt if the work needs to be repeated or extended in a new thread:

```text
Implement a production-grade observability stack for FraerApp.

Requirements:
1. Run with the normal application Docker Compose startup, not a separate command.
2. Include Grafana, Prometheus, Loki, Promtail, node_exporter, cAdvisor, nginx-prometheus-exporter, and PostgreSQL exporters.
3. Scrape Spring Boot `/actuator/prometheus` for both the main API and auth-service.
4. Scrape VPS metrics: CPU, RAM, swap, disk, IO, network, load average.
5. Scrape Docker metrics: per-container CPU, memory, restarts, and availability.
6. Scrape PostgreSQL metrics for both app and auth databases.
7. Collect Docker container logs into Loki, especially nginx, API, auth-service, and story-builder logs.
8. Add Grafana provisioning for Prometheus and Loki datasources.
9. Add a ready-to-use FraerApp dashboard with status, latency, errors, Docker, VPS, PostgreSQL, and log panels.
10. Add alert rules for targets down, high RAM, swap usage, disk pressure, container restarts, slow requests, and 5xx errors.
11. Make Grafana available from the server IP through Docker port publishing; logs must be available through Grafana/Loki.
12. Keep retention explicit so the stack does not fill a small VPS disk.
```

## Stack

- Grafana: dashboards and log search.
- Prometheus: metrics and alert rule evaluation.
- Loki: log storage.
- Promtail: Docker log collection.
- node_exporter: VPS host metrics.
- cAdvisor: Docker/container metrics.
- nginx-prometheus-exporter: edge/nginx metrics.
- postgres-exporter: main runtime DB metrics.
- auth-postgres-exporter: auth DB metrics.

## Start

Copy and edit env values first:

```sh
cp .env.example .env
```

At minimum, set a strong `GRAFANA_ADMIN_PASSWORD`.

Start app plus observability:

```sh
docker compose up -d --build
```

Open Grafana on the Docker host:

```text
http://localhost:3000
```

For access from another device in the local network, set:

```text
GRAFANA_BIND_IP=0.0.0.0
OBSERVABILITY_INTERNAL_BIND_IP=127.0.0.1
```

Then open:

```text
http://<host-lan-ip>:3000
```

For the current FraerApp server:

```text
http://192.164.0.34:3000
```

Prometheus and Loki are kept on the Docker host by default:

```text
http://localhost:9090
http://localhost:3100
```

## Dashboard

Grafana provisions the dashboard automatically:

```text
FraerApp / FraerApp Overview
```

It includes:

- API, auth-service, nginx, and PostgreSQL up/down status.
- VPS CPU, RAM, swap, and disk usage.
- Spring HTTP request rates by service/status.
- p95 request latency by service/URI.
- 4xx/5xx error rates by service/URI.
- Docker memory and CPU by container.
- PostgreSQL connections.
- Loki log search for errors, warnings, auth failures, 5xx, 401/403, and timeouts.

## Investigation Playbooks

### Site is slow

Check in this order:

1. `VPS CPU / RAM / Swap`: if RAM is above 85% or swap is active, the host is under memory pressure.
2. `Docker Memory`: identify the container using most memory.
3. `p95 Request Latency`: find whether latency is API-wide or endpoint-specific.
4. `Postgres Connections`: look for connection growth or stuck traffic.
5. Logs panel: search for `timeout`, `OutOfMemory`, `connection`, `504`, or `upstream`.

### Auth looks broken

Separate auth behavior from infrastructure:

1. Check `Auth` status first.
2. Check `HTTP Errors` for `auth-service` and `/auth/verify`.
3. Search logs for `401`, `expired`, `magic`, `token`, and the user email if available.
4. If `/auth/me` returns `401` without a cookie, that can be normal.
5. If `/auth/verify` returns `401`, inspect whether the login link is expired, already used, or invalid.

### Site is down

Check:

1. API/Auth/Nginx/Postgres status panels.
2. Prometheus targets at `http://localhost:9090/targets`.
3. Docker restarts and logs.
4. Nginx logs for upstream failures.
5. PostgreSQL exporter status.

## Retention

Prometheus retention defaults to:

```text
PROMETHEUS_RETENTION=15d
```

Loki retention is set in:

```text
observability/loki/config.yml
```

Current Loki retention:

```text
168h
```

This keeps log storage bounded on a small VPS.

## Security

- For LAN Grafana access, set `GRAFANA_BIND_IP=0.0.0.0`.
- Keep `OBSERVABILITY_INTERNAL_BIND_IP=127.0.0.1` unless Prometheus/Loki need separate admin access.
- If the server IP is reachable from the Internet, restrict TCP 3000/9090/3100 with firewall rules or VPN access.
- Do not publish these ports through Cloudflare or public firewall rules unless proper authentication, TLS, and access controls are added.
- Nginx `stub_status` is allowed only from loopback/private Docker/LAN ranges and denied otherwise.
