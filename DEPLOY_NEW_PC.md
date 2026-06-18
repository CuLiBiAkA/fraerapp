# Перенос FraerApp на новый ПК

Цель: поднять игру на другом компьютере в той же сети и переключить проброс портов роутера на новый LAN-IP.

## Что переносим

- Код репозитория `fraerapp`.
- Локальные секреты: `.env`, `mailserver.env`.
- TLS-сертификаты: папка `nginx/certs/`.
- Данные Docker-томов, если нужны текущие пользователи, истории, загрузки и почта:
  - `postgres-data`
  - `auth-postgres-data`
  - `story-uploads`
  - опционально `mail-data`, `mail-state`, `mail-logs`, `mail-config`

## Важно перед стартом

На серверном ПК не включать full-tunnel VPN/Amnezia до проверки сайта снаружи. Если VPN нужен постоянно, его надо настраивать через split tunneling или отдельную схему с reverse tunnel/VPS. Иначе входящий запрос придет через роутер, а ответ может уйти через VPN.

## На старом ПК: сделать бэкап данных

Из папки проекта:

```powershell
.\scripts\export-runtime-data.ps1 -IncludeMail
```

Скрипт создаст папку вида:

```text
backups\fraerapp-runtime-YYYYMMDD-HHMMSS\
```

В нее попадут дампы PostgreSQL и архивы Docker-томов. Если почту переносить не нужно, запусти без `-IncludeMail`.

## На новом ПК: подготовить систему

1. Установить Docker Desktop с WSL2 backend.
2. Включить Docker Desktop и дождаться, пока он запустит engine.
3. Скопировать или клонировать репозиторий.
4. В папку проекта положить:
   - `.env`
   - `mailserver.env`, если нужен локальный mailserver
   - `nginx/certs/fraerapp.fullchain.crt`
   - `nginx/certs/fraerapp.key`
   - папку бэкапа из `backups`, если переносим данные

Для нового публичного запуска значения в `.env` должны быть примерно такими:

```env
HTTP_PORT=80
HTTPS_PORT=443
BUILDER_PORT=8090
AUTH_PUBLIC_BASE_URL=https://fraerapp.ru
AUTH_DEV_MODE=false
AUTH_COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=http://localhost:8088,http://localhost:8090,https://fraerapp.ru
AUTH_CORS_ALLOWED_ORIGINS=http://localhost:8088,http://localhost:8090,https://fraerapp.ru
```

Пароли и `AUTH_JWT_SECRET` лучше оставить теми же, если переносим существующие базы.

## На новом ПК: проверка перед запуском

```powershell
.\scripts\new-pc-preflight.ps1
```

Этот скрипт ничего не меняет. Он проверяет наличие файлов, Docker, занятые порты, локальный IP и подозрительные VPN-маршруты.

## На новом ПК: запуск

Без почтового контейнера:

```powershell
.\scripts\start-production.ps1
```

С почтовым контейнером:

```powershell
.\scripts\start-production.ps1 -WithMail
```

## На новом ПК: восстановить данные

Если нужно перенести текущие данные:

```powershell
.\scripts\import-runtime-data.ps1 -BackupPath .\backups\fraerapp-runtime-YYYYMMDD-HHMMSS -IncludeMail -Force
```

Если почту не переносим:

```powershell
.\scripts\import-runtime-data.ps1 -BackupPath .\backups\fraerapp-runtime-YYYYMMDD-HHMMSS -Force
```

После восстановления запусти:

```powershell
.\scripts\start-production.ps1 -WithMail
```

## Роутер

На роутере нужно привязать новому ПК постоянный LAN-IP через DHCP reservation. Например:

```text
Новый ПК -> 192.168.0.X
```

Потом поменять проброс:

```text
TCP 80  -> 192.168.0.X:80
TCP 443 -> 192.168.0.X:443
```

Если используем локальный mailserver на домашнем ПК:

```text
TCP 25  -> 192.168.0.X:25
TCP 465 -> 192.168.0.X:465
TCP 587 -> 192.168.0.X:587
```

Для production на VPS DNS должен указывать на публичный IP VPS. Домашний внешний IP роутера нужен только для локального/домашнего размещения.

## Проверки

На новом ПК:

```powershell
curl.exe --noproxy "*" -I http://127.0.0.1/healthz
curl.exe --noproxy "*" -I http://192.168.0.X/healthz
```

С телефона на мобильном интернете, не через Wi-Fi:

```text
http://<public-server-ip>/healthz
https://fraerapp.ru/healthz
https://www.fraerapp.ru/healthz
```

Ожидаемо для `/healthz`:

```text
HTTP/1.1 200 OK
```

## Быстрый откат

Если новый ПК не поднялся, верни проброс портов на старый LAN-IP:

```text
TCP 80  -> 192.168.0.7:80
TCP 443 -> 192.168.0.7:443
```

DNS трогать не надо.
