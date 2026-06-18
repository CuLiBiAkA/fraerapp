# FraerApp VPS migration runbook

This file is intentionally command-oriented. Replace every placeholder before running the commands.

Placeholders:

- `NEW_VPS_IP` - public IPv4 of the new VPS.
- `DOMAIN` - production domain, usually `fraerapp.ru`.
- `ADMIN_EMAIL` - bootstrap admin email.
- `LOCAL_PROJECT` - local checkout path, usually `/Users/aleksejalbitov/IdeaProjects/fraerapp`.
- `REMOTE_PROJECT` - remote app path, usually `/opt/fraerapp`.

Do not commit real `.env`, certificate private keys, SMTP passwords, database passwords, or Cloudflare tokens.

## 1. Prepare local variables

Run on the Mac:

```bash
export NEW_VPS_IP="CHANGE_ME"
export DOMAIN="fraerapp.ru"
export ADMIN_EMAIL="CHANGE_ME"
export LOCAL_PROJECT="/Users/aleksejalbitov/IdeaProjects/fraerapp"
export REMOTE_PROJECT="/opt/fraerapp"
```

Check SSH access:

```bash
ssh root@"$NEW_VPS_IP" 'uname -a'
```

## 2. Install server packages

Run on the VPS:

```bash
apt-get update
apt-get install -y ca-certificates curl git openssl rsync ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Optional swap for small 1 GB VPS:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
ufw allow 465/tcp
ufw allow 587/tcp
ufw --force enable
ufw status
```

If you will not run the local mailserver, skip ports `25`, `465`, and `587`.

## 3. Copy project files

Run on the Mac:

```bash
ssh root@"$NEW_VPS_IP" "mkdir -p '$REMOTE_PROJECT'"
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude 'mailserver.env' \
  --exclude 'nginx/certs/*' \
  "$LOCAL_PROJECT"/ root@"$NEW_VPS_IP":"$REMOTE_PROJECT"/
```

## 4. Create production env

Run on the VPS:

```bash
cd /opt/fraerapp
cp .env.production.example .env
```

Edit `.env` and set real values:

```bash
nano .env
```

Required production values:

```dotenv
NGINX_CONF=nginx.prod.conf
HOST_BIND_IP=127.0.0.1
HTTP_PORT=8088
HTTPS_PORT=8443
BUILDER_BIND_IP=127.0.0.1
BUILDER_PORT=8090
AUTH_PUBLIC_BASE_URL=https://fraerapp.ru
AUTH_BOOTSTRAP_ADMIN_EMAIL=ADMIN_EMAIL
AUTH_DEV_MODE=false
AUTH_MANUAL_LOGIN_LINKS=true
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=Lax
CORS_ALLOWED_ORIGINS=https://fraerapp.ru,https://www.fraerapp.ru
AUTH_CORS_ALLOWED_ORIGINS=https://fraerapp.ru,https://www.fraerapp.ru
```

Generate strong secrets on the VPS:

```bash
openssl rand -base64 48
openssl rand -base64 32
openssl rand -base64 32
```

Use those generated values for:

```dotenv
AUTH_JWT_SECRET=<generated-long-secret>
POSTGRES_PASSWORD=<generated-db-password>
AUTH_POSTGRES_PASSWORD=<generated-auth-db-password>
```

For manual login links, SMTP can stay configured but is not required for sign-in:

```dotenv
AUTH_MANUAL_LOGIN_LINKS=true
```

## 5. Install TLS certificates

Create cert directory:

```bash
mkdir -p /opt/fraerapp/nginx/certs
chmod 700 /opt/fraerapp/nginx/certs
```

Copy issued certificate files from the Mac to the VPS. The target filenames expected by `nginx.prod.conf` are:

```text
/opt/fraerapp/nginx/certs/fullchain.pem
/opt/fraerapp/nginx/certs/privkey.pem
```

Example copy commands from the Mac:

```bash
scp /path/to/fullchain.pem root@"$NEW_VPS_IP":/opt/fraerapp/nginx/certs/fullchain.pem
scp /path/to/privkey.pem root@"$NEW_VPS_IP":/opt/fraerapp/nginx/certs/privkey.pem
```

Fix permissions on the VPS:

```bash
chmod 600 /opt/fraerapp/nginx/certs/privkey.pem
chmod 644 /opt/fraerapp/nginx/certs/fullchain.pem
```

## 6. Install host nginx

The Docker `edge` service listens only on localhost. Host nginx terminates public ports `80` and `443` and proxies to Docker.

Run on the VPS:

```bash
apt-get install -y nginx
cat >/etc/nginx/sites-available/fraerapp.ru.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name fraerapp.ru www.fraerapp.ru;

    location = /healthz {
        proxy_pass http://127.0.0.1:8088/healthz;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto http;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name fraerapp.ru www.fraerapp.ru;

    ssl_certificate /opt/fraerapp/nginx/certs/fullchain.pem;
    ssl_certificate_key /opt/fraerapp/nginx/certs/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:8443;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
ln -sf /etc/nginx/sites-available/fraerapp.ru.conf /etc/nginx/sites-enabled/fraerapp.ru.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

If `DOMAIN` is not `fraerapp.ru`, replace the `server_name` values and file name.

## 7. Start FraerApp

Run on the VPS:

```bash
cd /opt/fraerapp
docker compose -f compose.yaml -f compose.mail.yaml build
docker compose -f compose.yaml -f compose.mail.yaml up -d
docker compose -f compose.yaml -f compose.mail.yaml ps
```

The bundled mailserver is opt-in and does not start unless the `mail` profile is enabled. If you need it later:

```bash
docker compose -f compose.yaml -f compose.mail.yaml --profile mail up -d mailserver
```

## 8. DNS records

In Cloudflare DNS:

```text
fraerapp.ru      A      NEW_VPS_IP      Proxied
www              A      NEW_VPS_IP      Proxied
mail             A      NEW_VPS_IP      DNS only
fraerapp.ru      MX     mail.fraerapp.ru priority 10
fraerapp.ru      TXT    v=spf1 mx a ip4:NEW_VPS_IP ~all
```

Keep existing DKIM and DMARC records unless you regenerate the mailserver DKIM keys.

For Cloudflare proxied web records, `fraerapp.ru` and `www` should be orange-cloud proxied. The `mail` record must be DNS only.

## 9. Smoke checks

Run from the Mac:

```bash
curl -I "https://fraerapp.ru/"
curl -I "https://fraerapp.ru/builder/"
curl -I "https://fraerapp.ru/auth/admin"
curl -sS -H 'Content-Type: application/json' \
  -X POST "https://fraerapp.ru/auth/login-link" \
  --data '{"email":"ADMIN_EMAIL","redirectPath":"/auth/admin"}'
```

Expected auth response in manual mode:

```json
{"sent":false,"manual":true}
```

Get the admin login link from logs:

```bash
ssh root@"$NEW_VPS_IP" "cd /opt/fraerapp && docker compose -f compose.yaml -f compose.mail.yaml logs --tail=120 auth-service | grep 'FraerApp manual magic link' | tail -1"
```

Check containers and logs:

```bash
ssh root@"$NEW_VPS_IP" "cd /opt/fraerapp && docker compose -f compose.yaml -f compose.mail.yaml ps"
ssh root@"$NEW_VPS_IP" "cd /opt/fraerapp && docker compose -f compose.yaml -f compose.mail.yaml logs --tail=80 edge auth-service api story-builder"
```

## 10. Backup and restore data

Create backups on the old VPS:

```bash
cd /opt/fraerapp
set -a
. ./.env
set +a
docker compose -f compose.yaml -f compose.mail.yaml exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > fraerapp-api.sql
docker compose -f compose.yaml -f compose.mail.yaml exec -T auth-postgres pg_dump -U "$AUTH_POSTGRES_USER" "$AUTH_POSTGRES_DB" > fraerapp-auth.sql
docker run --rm -v fraerapp_story-uploads:/data -v "$PWD":/backup alpine tar czf /backup/story-uploads.tgz -C /data .
```

Copy backup files to the new VPS:

```bash
scp fraerapp-api.sql fraerapp-auth.sql story-uploads.tgz root@"$NEW_VPS_IP":/opt/fraerapp/
```

Restore on the new VPS before opening traffic:

```bash
cd /opt/fraerapp
set -a
. ./.env
set +a
docker compose -f compose.yaml -f compose.mail.yaml up -d postgres auth-postgres
docker compose -f compose.yaml -f compose.mail.yaml exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < fraerapp-api.sql
docker compose -f compose.yaml -f compose.mail.yaml exec -T auth-postgres psql -U "$AUTH_POSTGRES_USER" "$AUTH_POSTGRES_DB" < fraerapp-auth.sql
docker volume create fraerapp_story-uploads || true
docker run --rm -v fraerapp_story-uploads:/data -v "$PWD":/backup alpine sh -c 'cd /data && tar xzf /backup/story-uploads.tgz'
```

## 11. Security cleanup

After migration works:

```bash
passwd
sed -i 's/^#\\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh
```

Keep a separate active SSH session open while changing SSH settings.
