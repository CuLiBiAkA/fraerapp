# FraerApp Story

## Passwordless auth service

FraerApp now uses a separate `auth-service` container for users, email identity, sessions, refresh tokens, roles, and magic-link login. The player API no longer trusts client-supplied `X-Player-Id`, and admin APIs no longer use `dev-admin-token`.

Local dev flow:

1. Set `AUTH_JWT_SECRET` to the same long random value for `api` and `auth-service`.
2. Set `AUTH_BOOTSTRAP_ADMIN_EMAIL` for the first admin account.
3. Run `docker compose up -d --build`.
4. Request a link through `POST /auth/login-link` or the frontend email form.
5. In dev mode, read the link from auth-service logs or `GET /auth/dev/magic-links?email=you@example.com`.
6. Open the link. Auth sets httpOnly `fraer_access` and `fraer_refresh` cookies.

Roles:

- `player` is granted automatically after the first verified email login.
- `author` is required for `/api/author/**` and the story builder.
- `admin` is required for `/api/admin/**` and role management.
- The first admin is bootstrapped from `AUTH_BOOTSTRAP_ADMIN_EMAIL`.

Role admin UI:

- Open `http://localhost:8088/auth/admin`.
- Sign in with `culibiaka2012@yandex.ru` in local Docker unless `AUTH_BOOTSTRAP_ADMIN_EMAIL` was overridden.
- In dev mode the page shows a direct magic-link shortcut after submitting the email.
- Use the form to grant or remove `author` and `admin` roles for any email.

Important env:

- `AUTH_JWT_SECRET` - shared JWT HMAC secret used by auth-service and the main API.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - PostgreSQL database credentials for the main API.
- `AUTH_POSTGRES_DB`, `AUTH_POSTGRES_USER`, `AUTH_POSTGRES_PASSWORD` - PostgreSQL database credentials for auth-service.
- `AUTH_PUBLIC_BASE_URL` - public URL used in emailed magic links.
- `AUTH_DEV_MODE` - when `true`, links are logged and available through the dev endpoint instead of SMTP.
- `AUTH_COOKIE_SECURE` and `AUTH_COOKIE_SAME_SITE` - cookie policy.
- `CORS_ALLOWED_ORIGINS` and `AUTH_CORS_ALLOWED_ORIGINS` - origins allowed to send credentialed requests.
- `AUTH_BOOTSTRAP_ADMIN_EMAIL` - email that receives the initial `admin` role.

## PostgreSQL

Runtime storage uses PostgreSQL for both the main API and `auth-service`. Flyway owns the schema, including catalog/session/story-author indexes and auth-session/token/audit indexes. H2 is kept only as an in-memory test dependency.

Docker Compose creates two local PostgreSQL volumes:

- `postgres-data` for story runtime data.
- `auth-postgres-data` for users, roles, sessions, refresh tokens and auth audit events.

Local backup examples:

```powershell
docker compose exec postgres pg_dump -U fraerapp -d fraerapp -Fc -f /tmp/fraerapp.dump
docker compose cp postgres:/tmp/fraerapp.dump .\backups\fraerapp.dump
docker compose exec auth-postgres pg_dump -U fraerapp_auth -d fraerapp_auth -Fc -f /tmp/fraerapp_auth.dump
docker compose cp auth-postgres:/tmp/fraerapp_auth.dump .\backups\fraerapp_auth.dump
```

Local restore examples:

```powershell
docker compose cp .\backups\fraerapp.dump postgres:/tmp/fraerapp.dump
docker compose exec postgres pg_restore -U fraerapp -d fraerapp --clean --if-exists /tmp/fraerapp.dump
docker compose cp .\backups\fraerapp_auth.dump auth-postgres:/tmp/fraerapp_auth.dump
docker compose exec auth-postgres pg_restore -U fraerapp_auth -d fraerapp_auth --clean --if-exists /tmp/fraerapp_auth.dump
```

For managed PostgreSQL, set `SPRING_DATASOURCE_URL`/`SPRING_DATASOURCE_USERNAME`/`SPRING_DATASOURCE_PASSWORD` for the API and `AUTH_DATASOURCE_URL`/`AUTH_DATASOURCE_USERNAME`/`AUTH_DATASOURCE_PASSWORD` for auth-service.

## Story Builder

Story Builder is a separate static service for creating Story JSON in the browser with forms and buttons.

Location:

```text
story-builder/
```

Default URL:

```text
http://localhost:8090
```

Runtime remains available here:

```text
http://localhost:8088
```

Run both:

```powershell
docker compose up --build
```

Builder features:

- edit story metadata;
- add variables;
- add assets;
- add scenes;
- add choices;
- add conditions;
- add effects;
- mark scenes as endings;
- preview generated Story JSON;
- copy/download/import JSON;
- autosave draft in `localStorage`;
- import JSON into FraerApp runtime;
- validate and publish the last imported story.

Runtime import settings in the Builder:

```text
Runtime API: http://localhost:8088
Admin token: dev-admin-token
```

Workflow:

1. Open `http://localhost:8090`.
2. Click `Load Example` or create a story manually.
3. Fix validation errors if any.
4. Click `Import to Runtime`.
5. Click `Publish Last Import`.
6. Open `http://localhost:8088`.
7. Login and choose the published story.

## Документация Story JSON

FraerApp работает как движок сценариев: сюжет хранится в JSON, импортируется в базу данных и исполняется backend-ом через игровые сессии. Frontend только показывает текущую сцену и отправляет выбранные действия.

Админский токен по умолчанию:

```text
dev-admin-token
```

Для админских запросов нужен header:

```http
X-Admin-Token: dev-admin-token
```

Импорт сценария:

```http
POST /api/admin/stories/import
```

Публикация сценария:

```http
POST /api/admin/stories/{storyId}/publish
```

После публикации сценарий появляется в списке доступных историй.

### Общая Структура

```json
{
  "key": "night_train",
  "title": "Train 404",
  "description": "A small branching story.",
  "version": 1,
  "startSceneId": "platform",
  "variables": {},
  "assets": [],
  "scenes": []
}
```

Поля:

- `key` - уникальный ключ сценария. По нему создается игровая сессия.
- `title` - название сценария.
- `description` - краткое описание.
- `version` - версия сценария.
- `startSceneId` - id стартовой сцены.
- `variables` - начальные переменные игровой сессии.
- `assets` - картинки, музыка, звуки, видео или спрайты.
- `scenes` - сцены сценария.

Лучше использовать стабильные id в стиле `night_train`, `platform`, `open_door`.

### Переменные

`variables` задают начальное состояние игрока в новой сессии.

```json
{
  "trust": 0,
  "hasTicket": false,
  "visitedHall": false
}
```

Переменные можно проверять в `conditions` и изменять через `effects`.

### Ассеты

Ассет описывает файл. В базе хранится ссылка на файл, а не сам бинарный файл.

```json
{
  "id": "platform_bg",
  "type": "image",
  "url": "/assets/platform.svg",
  "metadata": {
    "author": "local"
  }
}
```

Поля:

- `id` - уникальный id ассета внутри сценария.
- `type` - тип ассета: `image`, `music`, `sound`, `video`, `sprite`.
- `url` - путь или URL, доступный браузеру.
- `metadata` - необязательные дополнительные данные.

Сцены ссылаются на ассеты по `id`:

```json
{
  "background": "platform_bg",
  "music": "rain_theme"
}
```

### Сцены

Сцена - это узел дерева или графа сценария.

```json
{
  "id": "platform",
  "title": "Rainy platform",
  "text": "The night train left without you.",
  "background": "platform_bg",
  "music": null,
  "animation": {
    "type": "fade-in",
    "durationMs": 800
  },
  "effects": [],
  "choices": []
}
```

Поля:

- `id` - уникальный id сцены внутри сценария.
- `title` - заголовок сцены.
- `text` - текст сцены.
- `background` - id ассета фоновой картинки или `null`.
- `music` - id музыкального ассета или `null`.
- `animation` - настройки анимации для frontend.
- `effects` - эффекты, которые применяются при входе в сцену.
- `choices` - варианты выбора из этой сцены.
- `ending` - признак концовки, если сцена завершает прохождение.

Сейчас frontend поддерживает простую анимацию:

```json
{
  "type": "fade-in",
  "durationMs": 800
}
```

Backend не исполняет анимации. Он только хранит JSON и отдает его frontend-у.

### Выборы

`choices` описывают переходы из одной сцены в другую.

```json
{
  "id": "inspect_ticket",
  "label": "Inspect the ticket",
  "target": "ticket",
  "conditions": [],
  "effects": [
    {
      "set": "hasTicket",
      "value": true
    }
  ]
}
```

Поля:

- `id` - уникальный id выбора внутри сцены.
- `label` - текст кнопки.
- `target` - id сцены, куда ведет выбор.
- `conditions` - условия доступности выбора.
- `effects` - изменения переменных после выбора.

Важно: runtime API для игрока не отдает frontend-у `target`. Переход контролирует backend.

### Эффекты

Эффекты изменяют переменные игровой сессии.

Установить значение:

```json
{
  "set": "hasTicket",
  "value": true
}
```

Увеличить число:

```json
{
  "inc": "trust",
  "value": 1
}
```

Поддерживаются эффекты:

- `set`
- `inc`

Эффекты можно добавлять на сцену или на выбор.

### Условия

`conditions` определяют, будет ли выбор доступен игроку.

```json
{
  "var": "trust",
  "op": ">=",
  "value": 2
}
```

Поддерживаемые операторы:

- `==`
- `!=`
- `>=`
- `<=`
- `>`
- `<`

Пример выбора, который доступен только если у игрока есть ключ:

```json
{
  "id": "open_door",
  "label": "Open the door",
  "target": "good_end",
  "conditions": [
    {
      "var": "hasKey",
      "op": "==",
      "value": true
    }
  ],
  "effects": []
}
```

Если условие не выполняется:

- выбор не приходит в `state`;
- backend отклонит этот выбор, даже если отправить его вручную.

### Концовки

Если в сцене есть поле `ending`, то при входе в эту сцену сессия становится завершенной.

```json
{
  "id": "good_end",
  "title": "Good Ending",
  "text": "The key turns. You step into warm light.",
  "background": "end_bg",
  "music": null,
  "animation": {
    "type": "fade-in",
    "durationMs": 600
  },
  "effects": [],
  "ending": {
    "type": "good",
    "title": "You opened the way"
  },
  "choices": []
}
```

Ответ backend-а будет содержать:

```json
"status": "finished"
```

### Минимальный Пример

```json
{
  "key": "test_story",
  "title": "Test Story",
  "description": "Small imported story",
  "version": 1,
  "startSceneId": "start",
  "variables": {
    "score": 0,
    "hasKey": false
  },
  "assets": [
    {
      "id": "start_bg",
      "type": "image",
      "url": "/assets/platform.svg"
    },
    {
      "id": "door_bg",
      "type": "image",
      "url": "/assets/door.svg"
    },
    {
      "id": "end_bg",
      "type": "image",
      "url": "/assets/departure.svg"
    }
  ],
  "scenes": [
    {
      "id": "start",
      "title": "Start",
      "text": "You stand before a locked door.",
      "background": "start_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 800
      },
      "effects": [],
      "choices": [
        {
          "id": "take_key",
          "label": "Take the key",
          "target": "door",
          "conditions": [],
          "effects": [
            {
              "set": "hasKey",
              "value": true
            },
            {
              "inc": "score",
              "value": 1
            }
          ]
        },
        {
          "id": "go_without_key",
          "label": "Go without the key",
          "target": "door",
          "conditions": [],
          "effects": []
        }
      ]
    },
    {
      "id": "door",
      "title": "The Door",
      "text": "The door waits. If you have the key, a better ending is available.",
      "background": "door_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "choices": [
        {
          "id": "open_door",
          "label": "Open the door",
          "target": "good_end",
          "conditions": [
            {
              "var": "hasKey",
              "op": "==",
              "value": true
            }
          ],
          "effects": [
            {
              "inc": "score",
              "value": 5
            }
          ]
        },
        {
          "id": "wait",
          "label": "Wait outside",
          "target": "bad_end",
          "conditions": [],
          "effects": []
        }
      ]
    },
    {
      "id": "good_end",
      "title": "Good Ending",
      "text": "The key turns. You step into warm light.",
      "background": "end_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "ending": {
        "type": "good",
        "title": "You opened the way"
      },
      "choices": []
    },
    {
      "id": "bad_end",
      "title": "Quiet Ending",
      "text": "You wait until the lamps go out.",
      "background": "door_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "ending": {
        "type": "bad",
        "title": "You stayed outside"
      },
      "choices": []
    }
  ]
}
```

### Правила Валидации

При импорте и публикации проверяется:

- `key` обязателен.
- `title` обязателен.
- `startSceneId` обязателен.
- `startSceneId` должен указывать на существующую сцену.
- id сцен должны быть уникальны внутри сценария.
- id choices должны быть уникальны внутри сцены.
- каждый `choice.target` должен указывать на существующую сцену.
- `background` и `music`, если указаны, должны ссылаться на существующие asset id.
- опубликованный сценарий не должен содержать битых ссылок.

### Хранение Файлов

В H2 хранятся метаданные сценария, сцены, choices, URL ассетов, игровые сессии и JSON переменных.

Бинарные файлы не хранятся в БД. Картинки, музыка и звуки должны лежать в `frontend/assets`, upload-директории, object storage или другом статическом хранилище.

## Story JSON Format

FraerApp works as a Story Engine: the plot is data, not Java code. You can import a Story JSON through the admin panel or through `POST /api/admin/stories/import`, publish it, and then players can start game sessions for that story.

Default admin token:

```text
dev-admin-token
```

Admin requests require:

```http
X-Admin-Token: dev-admin-token
```

### Top-Level Shape

```json
{
  "key": "night_train",
  "title": "Train 404",
  "description": "A small branching story.",
  "version": 1,
  "startSceneId": "platform",
  "variables": {},
  "assets": [],
  "scenes": []
}
```

Fields:

- `key` - unique story identifier. Used when creating a session.
- `title` - visible story title.
- `description` - short description.
- `version` - integer content version.
- `startSceneId` - id of the first scene.
- `variables` - initial session variables.
- `assets` - images, music, sounds, videos or sprites.
- `scenes` - story graph nodes.

Use stable ids like `night_train`, `platform`, `open_door`. Lowercase letters, digits and underscores are safest.

### Variables

Variables are copied into every new game session:

```json
{
  "trust": 0,
  "hasTicket": false,
  "visitedHall": false
}
```

They can be checked by `conditions` and changed by `effects`.

### Assets

Assets describe files. The database stores URLs and metadata, not binary files.

```json
{
  "id": "platform_bg",
  "type": "image",
  "url": "/assets/platform.svg",
  "metadata": {
    "author": "local"
  }
}
```

Fields:

- `id` - unique asset id inside the story.
- `type` - `image`, `music`, `sound`, `video` or `sprite`.
- `url` - path or URL served to the browser.
- `metadata` - optional JSON object.

Scenes reference assets by id:

```json
{
  "background": "platform_bg",
  "music": "rain_theme"
}
```

### Scenes

A scene is one node of the story graph.

```json
{
  "id": "platform",
  "title": "Rainy platform",
  "text": "The night train left without you.",
  "background": "platform_bg",
  "music": null,
  "animation": {
    "type": "fade-in",
    "durationMs": 800
  },
  "effects": [],
  "choices": []
}
```

Fields:

- `id` - unique scene id inside the story.
- `title` - scene title.
- `text` - scene text.
- `background` - asset id for background image, or `null`.
- `music` - asset id for music, or `null`.
- `animation` - JSON config passed to frontend.
- `effects` - effects applied when the scene is entered.
- `choices` - outgoing choices.
- `ending` - optional ending marker.

Current frontend supports simple fade animation:

```json
{
  "type": "fade-in",
  "durationMs": 800
}
```

Backend stores animation JSON and returns it to frontend. Backend does not execute animations.

### Choices

A choice is an edge from one scene to another.

```json
{
  "id": "inspect_ticket",
  "label": "Inspect the ticket",
  "target": "ticket",
  "conditions": [],
  "effects": [
    {
      "set": "hasTicket",
      "value": true
    }
  ]
}
```

Fields:

- `id` - unique choice id inside this scene.
- `label` - button text.
- `target` - target scene id.
- `conditions` - rules for showing and allowing the choice.
- `effects` - variable changes after selecting the choice.

The player runtime API does not return `target` to frontend. Backend is the source of truth.

### Effects

Effects change session variables.

Set a variable:

```json
{
  "set": "hasTicket",
  "value": true
}
```

Increment a number:

```json
{
  "inc": "trust",
  "value": 1
}
```

Supported effects in v1:

- `set`
- `inc`

Effects can be placed on scenes or choices.

### Conditions

Conditions decide whether a choice is visible and selectable.

```json
{
  "var": "trust",
  "op": ">=",
  "value": 2
}
```

Supported operators:

- `==`
- `!=`
- `>=`
- `<=`
- `>`
- `<`

Example:

```json
{
  "id": "open_door",
  "label": "Open the door",
  "target": "good_end",
  "conditions": [
    {
      "var": "hasKey",
      "op": "==",
      "value": true
    }
  ],
  "effects": []
}
```

If condition fails:

- the choice is not returned in session state;
- backend rejects it if frontend sends it manually.

### Endings

An ending scene marks the session as finished.

```json
{
  "id": "good_end",
  "title": "Good Ending",
  "text": "The key turns. You step into warm light.",
  "background": "end_bg",
  "music": null,
  "animation": {
    "type": "fade-in",
    "durationMs": 600
  },
  "effects": [],
  "ending": {
    "type": "good",
    "title": "You opened the way"
  },
  "choices": []
}
```

When a player reaches a scene with `ending`, response status becomes:

```json
"status": "finished"
```

### Full Minimal Example

```json
{
  "key": "test_story",
  "title": "Test Story",
  "description": "Small imported story",
  "version": 1,
  "startSceneId": "start",
  "variables": {
    "score": 0,
    "hasKey": false
  },
  "assets": [
    {
      "id": "start_bg",
      "type": "image",
      "url": "/assets/platform.svg"
    },
    {
      "id": "door_bg",
      "type": "image",
      "url": "/assets/door.svg"
    },
    {
      "id": "end_bg",
      "type": "image",
      "url": "/assets/departure.svg"
    }
  ],
  "scenes": [
    {
      "id": "start",
      "title": "Start",
      "text": "You stand before a locked door.",
      "background": "start_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 800
      },
      "effects": [],
      "choices": [
        {
          "id": "take_key",
          "label": "Take the key",
          "target": "door",
          "conditions": [],
          "effects": [
            {
              "set": "hasKey",
              "value": true
            },
            {
              "inc": "score",
              "value": 1
            }
          ]
        },
        {
          "id": "go_without_key",
          "label": "Go without the key",
          "target": "door",
          "conditions": [],
          "effects": []
        }
      ]
    },
    {
      "id": "door",
      "title": "The Door",
      "text": "The door waits. If you have the key, a better ending is available.",
      "background": "door_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "choices": [
        {
          "id": "open_door",
          "label": "Open the door",
          "target": "good_end",
          "conditions": [
            {
              "var": "hasKey",
              "op": "==",
              "value": true
            }
          ],
          "effects": [
            {
              "inc": "score",
              "value": 5
            }
          ]
        },
        {
          "id": "wait",
          "label": "Wait outside",
          "target": "bad_end",
          "conditions": [],
          "effects": []
        }
      ]
    },
    {
      "id": "good_end",
      "title": "Good Ending",
      "text": "The key turns. You step into warm light.",
      "background": "end_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "ending": {
        "type": "good",
        "title": "You opened the way"
      },
      "choices": []
    },
    {
      "id": "bad_end",
      "title": "Quiet Ending",
      "text": "You wait until the lamps go out.",
      "background": "door_bg",
      "music": null,
      "animation": {
        "type": "fade-in",
        "durationMs": 600
      },
      "effects": [],
      "ending": {
        "type": "bad",
        "title": "You stayed outside"
      },
      "choices": []
    }
  ]
}
```

### Validation Rules

Import and publish validate these rules:

- `key` is required.
- `title` is required.
- `startSceneId` is required.
- `startSceneId` must point to an existing scene.
- scene ids must be unique inside one story.
- choice ids must be unique inside one scene.
- every choice `target` must point to an existing scene.
- `background` and `music`, when provided, must point to existing asset ids.
- published stories must have no broken links.

### Storage Notes

The database stores story metadata, scenes, choices, asset URLs, game sessions and session variables JSON.

Binary files are not stored in PostgreSQL. Uploaded images, music and sounds are stored by the API in `ASSET_STORAGE_PATH` (`/data/uploads` in Docker) and served through `ASSET_PUBLIC_PATH` (`/uploads`). In Docker Compose this directory is backed by the named volume `story-uploads`, so uploaded files live on the server/host volume and are available to all users by public URLs like `/uploads/{storyId}/{file}`. Static bundled assets can still live in `frontend/assets`.

Браузерная narrative game / visual novel с веб-интерфейсом на JavaScript, Java REST API, H2 и Nginx как edge proxy.

## Что внутри

- `frontend/` - статичный JS-движок игры, экран входа, сцены, выборы, локальные SVG-ассеты.
- `src/main/java/` - Spring Boot API для авторизации, игрового состояния и обработки выборов.
- `src/main/resources/story/demo-story.json` - дерево демо-сюжета.
- `src/main/resources/db/migration/` - миграции Flyway для H2.
- `nginx/nginx.conf` - reverse proxy, gzip, security headers, rate limit и upstream `least_conn`.
- `compose.yaml` - сборка API, запуск Nginx, healthcheck'и, restart policy, resource limits, volume для H2.

## API игры

- `POST /api/auth/login` - вход по имени игрока.
- `GET /api/game/state` - текущая сцена игрока, нужен header `X-Player-Id`.
- `POST /api/game/choice` - применить выбор из текущей сцены, нужен header `X-Player-Id`.
- `POST /api/game/reset` - сбросить прогресс игрока к стартовой сцене.

## Локальная проверка backend

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat test
```

## Запуск в Docker

Сначала запустите Docker Desktop, затем:

```powershell
docker compose up --build
```

Откройте:

- http://localhost:8088 - веб-интерфейс
- http://localhost:8088/actuator/health - healthcheck API через Nginx
- http://localhost:8088/swagger-ui.html - OpenAPI UI

Порт можно поменять через `.env`:

```powershell
Copy-Item .env.example .env
```

## Масштабирование

Nginx уже настроен как балансировщик:

```nginx
upstream fraer_api {
    least_conn;
    server api:8080 max_fails=3 fail_timeout=10s;
}
```

Для настоящего multi-replica режима лучше заменить H2 на отдельную сетевую БД вроде PostgreSQL. H2 здесь оставлен по задаче и хорошо подходит для демо, локальной разработки и тестов, но не для продакшен-хранилища с несколькими пишущими инстансами.
