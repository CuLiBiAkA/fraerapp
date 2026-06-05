# FraerApp Runtime Configs

This project has two intended Docker Compose modes.

## Local Mode

Use this for one-device development only. Published ports bind to `127.0.0.1`.

```bash
cp .env.example .env
docker compose up -d --build
```

Default local URLs:

- Runtime health: `http://localhost:8088/healthz`
- Runtime UI: `https://localhost/`
- Admin UI: `https://localhost/auth/admin`
- Story Builder: `http://localhost:8090/`

Local nginx still needs certificate files at:

- `nginx/certs/fraerapp.fullchain.crt`
- `nginx/certs/fraerapp.key`

For local mode these can be self-signed certificates. Browser certificate warnings are expected.

## Production Mode

Use this as the base for public deployment. Published edge ports bind to `0.0.0.0`.

```bash
cp .env.production.example .env
docker compose up -d --build
```

Production URLs expected by the config:

- Runtime UI: `https://fraerapp.ru/`
- Admin UI: `https://fraerapp.ru/auth/admin`
- Story Builder: `https://fraerapp.ru/builder/`
- Health: `https://fraerapp.ru/healthz`

DNS records needed:

- `A fraerapp.ru -> <server-public-ip>`
- `A www.fraerapp.ru -> <server-public-ip>`

Router/firewall rules needed when hosting behind a home router:

- TCP `80` to the Docker host
- TCP `443` to the Docker host

Certificate files expected by nginx:

- `nginx/certs/fraerapp.fullchain.crt`
- `nginx/certs/fraerapp.key`

The production certificate must cover `fraerapp.ru` and `www.fraerapp.ru`.

Before public launch, replace all placeholder secrets and passwords in `.env`.
