# Prompt: перейти с H2 на PostgreSQL

Проверь и доведи пункт "PostgreSQL вместо H2" до production-ready состояния для FraerApp.

Контекст:
- В проекте два Spring Boot сервиса: основной `api` и `auth-service`.
- Схема управляется Flyway.
- H2 можно оставить только для unit/integration тестов через in-memory JDBC URL.
- Runtime и docker compose должны работать на PostgreSQL.

Что нужно сделать:
1. Заменить runtime H2 на PostgreSQL JDBC driver в обоих Gradle-модулях.
2. Убрать H2 console из runtime API.
3. Перевести дефолтные datasource URLs на PostgreSQL, но оставить возможность переопределять через env.
4. Добавить PostgreSQL сервисы в `compose.yaml` с named volumes, healthcheck и зависимостями `api`/`auth-service`.
5. Обновить `.env.example`: DB name/user/password для API и auth DB.
6. Проверить Flyway миграции на совместимость с PostgreSQL: типы длинного текста/JSON должны быть `text`, timestamps должны оставаться timezone-aware.
7. Добавить индексы под каталоги, игровые сессии, авторские истории, auth-сессии, refresh tokens и audit.
8. Обновить JPA mapping длинных полей так, чтобы `spring.jpa.hibernate.ddl-auto=validate` проходил на PostgreSQL.
9. Запустить тесты и docker compose build/up, проверить healthchecks.
10. Описать backup/restore команды для PostgreSQL volumes/managed DB в README.

Критерии готовности:
- `./gradlew.bat test` проходит.
- `docker compose build api auth-service` проходит.
- `docker compose up -d --force-recreate api auth-service postgres auth-postgres` поднимает сервисы, healthchecks становятся healthy.
- В runtime больше нет H2 file DB volume и H2 console.
- Тесты продолжили использовать H2 in-memory без изменения production defaults.
