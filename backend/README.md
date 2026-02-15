# Backend (Supabase + Express)

## Что делает
- Auth через Supabase (`/auth/sign-up`, `/auth/sign-in`, `/auth/refresh`, `/auth/me`)
- Встроенный rate limit для `/api/*` и усиленные лимиты для auth-эндпоинтов
- CRUD API для `news`, `tasks`, `documents`
- Endpoint `/api/bootstrap` для загрузки набора данных
- Admin API (`/api/admin/users`) для создания и управления пользователями
- LMS Builder версии: автоснимки и откат курса
- Пагинация для списков (`/api/tasks`, `/api/news`, `/api/documents`) через `?paginated=true&limit=50&offset=0`

## Локальный запуск
```bash
cd backend
npm ci
cp .env.example .env
# заполните .env
npm run dev
```

## Supabase setup
1. Откройте Supabase SQL Editor.
2. Для первого разворота выполните `backend/supabase/migrations/0001_initial_schema.sql`.
3. Выполните `backend/supabase/seed.sql` (опционально).
4. Скопируйте `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Важно: миграции ведутся в `backend/supabase/migrations/`, описание процесса в `backend/supabase/MIGRATIONS.md`.
Локальные проверки миграций/snapshot:
- `npm run check:migrations`
- `npm run check:schema-sync`
- `npm test` — backend integration tests (`node:test`) с подъемом test-server:
  - `GET /auth/me` (401 без токена и 200 с smoke bypass токеном)
  - `GET /api/tasks?paginated=true` (контракт paginated shape)
  - `GET /api/admin/ops/slo-status` (401/200 контракт для admin-protected endpoint)
  - `GET /api/admin/ops/slo-status` (403 для роли `operator`)
  - `GET /api/tasks?paginated=true` (401 без токена)
  - `POST /api/lms-builder/import-markdown` (400 на невалидный schema payload)
  - `POST /api/lms-builder/import-markdown` (403 для роли `operator`)
  - `POST /api/notifications/read-all?dryRun=true` (401 без токена и 200 dry-run контракт)
  - `POST /api/lms-builder/courses` (403 для роли `operator`)
  - `GET /api/reports/schedules` (401 без токена, 403 для `operator`)
  - `POST /api/reports/schedules` (401 без токена, 403 для `operator`, 400 на невалидный payload schema)
  - `POST /api/reports/schedules/:id/run` (401 без токена, 403 для `operator`, 400 на невалидный `id`, 404 на отсутствующий schedule `id`)
  - `GET /api/reports/runs` (401 без токена, 403 для `operator`)
  - `GET /api/reports/runs?scheduleId=abc` (400 guard на невалидный query `scheduleId`)
  - `GET /api/reports/runs?dryRun=true[&scheduleId=12]` (200 deterministic list contract + фильтрация по `scheduleId`)
  - `GET /api/reports/runs/:id/download` (401 без токена)
  - `GET /api/reports/runs/abc/download` (400 guard на невалидный `run id`)
  - `GET /api/reports/runs/:id/download` (404 на отсутствующий `run id`)
  - `GET /api/reports/runs/:id/download?dryRun=true&mockRecipient=other` (403 contract для foreign run в smoke test-mode)
  - `GET /api/reports/runs/:id/download?dryRun=true&mockRecipient=self` (200 contract: `text/csv` + `content-disposition: attachment` + CSV body)
  - `PATCH /api/reports/schedules/:id` (401 без токена, 403 для `operator`, 400 на невалидный `id`, 400 на невалидный payload schema)
  - `GET/POST/PATCH /api/admin/notification-integrations` (401/403 guards + 400 schema/id validation)
  - `GET/POST/PATCH/DELETE /api/ops/slo-routing-policies` (401/403 guards + 400 schema/id validation)
  - `GET/POST/PATCH /api/ops/sla-matrix` (401/403 guards + 400 schema/id/no-fields validation)
  - `POST /api/ops/reminders/run` и `POST /api/ops/escalations/run` (401 без токена, 403 для `operator`)
  - `POST /api/ops/reminders/run?dryRun=true` и `POST /api/ops/escalations/run?dryRun=true` (200 deterministic dry-run contract для smoke token)
  - `POST /api/ops/slo-check` (401 без токена, 403 для `operator`)
  - `GET /api/admin/ops/slo-status?windowMinutes=0` и `POST /api/ops/slo-check?windowMinutes=0` (400 validation guard)
  - `GET /api/admin/ops/slo-status?windowMinutes=1441` и `POST /api/ops/slo-check?windowMinutes=1441` (400 upper-bound validation guard)
  - `GET /api/admin/ops/slo-status?windowMinutes=abc` и `POST /api/ops/slo-check?windowMinutes=abc` (400 type validation guard)
  - `GET /api/admin/ops/slo-status?windowMinutes=5.5` и `POST /api/ops/slo-check?windowMinutes=5.5` (400 int-only validation guard)
  - `GET /api/admin/ops/slo-status?windowMinutes=5|1440` (200 boundary happy-path для валидных минимального/максимального значений)
  - `GET /api/admin/ops/slo-status?windowMinutes=005|060` (200 query coercion: строковые значения приводятся к числу `5|60`)
  - Для невалидного `windowMinutes` зафиксирован contract error-shape: zod format object с полем `windowMinutes._errors` (проверяется integration tests)
  - Для невалидного payload на `POST /api/reports/schedules` и `POST /api/ops/sla-matrix` зафиксирован zod error-shape (`name._errors`, `recipientUserId._errors` / `entityType._errors`)
  - Для невалидного payload на `PATCH /api/reports/schedules/:id` и `PATCH /api/ops/sla-matrix/:id` зафиксирован zod error-shape (`daysWindow._errors`, `thresholdHours._errors`)
  - Для пустого payload на `PATCH /api/reports/schedules/:id` и `PATCH /api/ops/sla-matrix/:id` зафиксирован бизнес-контракт ответа: `{ error: "No fields to update" }`
- `npm run smoke:api` (после `npm run build`; запускает backend локально с тестовыми env и проверяет базовые endpoint'ы)
  - единый контракт checks/sections/version хранится в `scripts/smoke-contract.mjs`
  - включает test-only auth bypass только в процессе smoke (`SMOKE_AUTH_BYPASS_*`)
  - проверяет shape paginated-ответа для `GET /api/tasks?paginated=true`
  - проверяет admin-protected `GET /api/admin/ops/slo-status` с mock admin session
  - проверяет safe dry-run write: `POST /api/notifications/read-all?dryRun=true`
  - пишет JSON summary (`SMOKE_SUMMARY_PATH`, default: `.logs/smoke-api-summary.json`)
  - проставляет версию формата summary (`summaryVersion`)
  - проставляет hash контракта (`contractHash`) для anti-drift валидации
  - включает агрегаты по секциям smoke (`sections`: Public/Unauthorized/Authenticated)
- `npm run check:smoke-summary` — проверяет, что summary имеет `status=passed` и все обязательные smoke-check labels.
  - проверяет совместимую версию формата summary (`summaryVersion=1`).
  - проверяет `contractHash` на совпадение с текущим `scripts/smoke-contract.mjs`.
  - также валидирует тайминги: `serverStartupMs` и `totalDurationMs`.
  - поддерживает budget-лимиты через env: `SMOKE_MAX_STARTUP_MS` (default `5000`), `SMOKE_MAX_TOTAL_MS` (default `15000`), `SMOKE_MAX_CHECK_MS` (default `5000`).
  - валидирует покрытие обязательных секций smoke и отсутствие failed checks в агрегатах секций.
  - валидирует ожидаемые totals по секциям для текущего smoke-контракта (`Public=1`, `Unauthorized=2`, `Authenticated=4`).
  - валидирует порядок обязательных checks (Public -> Unauthorized -> Authenticated сценарий).
  - выполняет strict contract enforcement: любые extra checks или unexpected sections приводят к ошибке.
  - валидирует схему каждого check: `label/section/status/timeoutMs/durationMs/error` и консистентность `durationMs <= timeoutMs (+grace)`.
- `npm run print:smoke-summary` — печатает компактную таблицу summary в логи (удобно для CI), включая top slow checks и блок ошибок для failed checks.
  - в GitHub Actions дополнительно публикует markdown-отчёт в Step Summary (`GITHUB_STEP_SUMMARY`).
  - дополнительно подсвечивает drift от контракта smoke (`missing/extra checks` относительно `scripts/smoke-contract.mjs`).

## Reliability Runbooks
- Backup/restore drill: `docs/ops/backup-restore-drill.md`
- Incident playbooks: `docs/ops/incident-playbooks.md`
- Скрипты drill:
  - PowerShell: `scripts/ops/backup-restore-drill.ps1`
  - Bash: `scripts/ops/backup-restore-drill.sh`
- CI workflow: `.github/workflows/backup-drill.yml` (cron + manual; secrets `SOURCE_DB_URL`, `TARGET_DB_URL`)
- Smoke checks: `scripts/ops/smoke-check-endpoints.sh` / `scripts/ops/smoke-check-endpoints.ps1`
- Summary generator: `scripts/ops/generate-drill-summary.mjs`

## Deploy в Coolify (у вас уже установлен)
1. В Coolify создайте **New Resource -> Application**.
2. Source: этот репозиторий.
3. Branch: `main`.
4. Build Pack: `Nixpacks`.
5. Base Directory: `backend`.
6. Port: `4000`.
7. Environment Variables:
   - `PORT=4000`
   - `CORS_ORIGIN=https://<ваш-frontend-домен>`
   - `SUPABASE_URL=...`
   - `SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `AUTO_ESCALATION_ENABLED=false`
   - `AUTO_ESCALATION_INTERVAL_MINUTES=60`
   - `AUTO_ESCALATION_SYSTEM_ACTOR_USER_ID=<uuid профиля админа, опционально>`
   - `AUTO_REMINDERS_ENABLED=false`
   - `AUTO_REMINDERS_INTERVAL_MINUTES=180`
   - `AUTO_REPORT_DELIVERY_ENABLED=false`
   - `AUTO_REPORT_DELIVERY_INTERVAL_MINUTES=60`
   - `AUTO_REPORT_DELIVERY_SYSTEM_ACTOR_USER_ID=<uuid профиля админа, опционально>`
   - `NOTIFICATION_WEBHOOK_URL=<опционально>`
   - `NOTIFICATION_WEBHOOK_SECRET=<опционально>`
   - `NOTIFICATION_EMAIL_WEBHOOK_URL=<опционально>`
   - `NOTIFICATION_EMAIL_WEBHOOK_SECRET=<опционально>`
   - `NOTIFICATION_MESSENGER_WEBHOOK_URL=<опционально>`
   - `NOTIFICATION_MESSENGER_WEBHOOK_SECRET=<опционально>`
   - `SLO_WINDOW_MINUTES=60`
   - `SLO_API_ERROR_RATE_THRESHOLD_PERCENT=1`
   - `SLO_API_LATENCY_P95_THRESHOLD_MS=800`
   - `SLO_NOTIFICATION_FAILURE_RATE_THRESHOLD_PERCENT=5`
   - `AUTO_SLO_ALERTS_ENABLED=false`
   - `AUTO_SLO_ALERTS_INTERVAL_MINUTES=15`
   - `AUTO_SLO_ALERTS_SYSTEM_ACTOR_USER_ID=<uuid профиля админа, опционально>`
   - `SLO_ALERT_WEBHOOK_URL=<опционально>`
   - `SLO_ALERT_WEBHOOK_SECRET=<опционально>`
   - `SLO_ALERT_CHANNELS_WARNING=webhook,email`
   - `SLO_ALERT_CHANNELS_CRITICAL=webhook,email,messenger`
   - `SLO_ALERT_CHANNELS_API_ERROR_RATE=<опционально, например webhook,messenger>`
   - `SLO_ALERT_CHANNELS_API_LATENCY_P95=<опционально>`
   - `SLO_ALERT_CHANNELS_NOTIFICATION_FAILURE_RATE=<опционально>`
8. Deploy.

Проверка после деплоя:
- `GET https://<backend-domain>/health` -> `{ "ok": true, ... }`

Инициализация первого администратора (один раз после схемы):
```bash
cd backend
ADMIN_EMAIL=admin@company.com ADMIN_PASSWORD='<strong-password>' ADMIN_FULL_NAME='Главный администратор' npm run bootstrap-admin
```

## Основные маршруты
- `POST /auth/sign-up`
- `POST /auth/sign-in`
- `POST /auth/refresh`
- `GET /auth/me` (Bearer token)
- `GET /api/offices` (Bearer token)
- `GET /api/bootstrap` (Bearer token)
- `GET /api/document-templates` / `POST /api/document-templates`
- `GET /api/document-approval-routes` / `POST /api/document-approval-routes`
- `GET /api/news` / `POST /api/news`
- `PATCH /api/news/:id` / `DELETE /api/news/:id`
- `GET /api/tasks` / `POST /api/tasks` / `PATCH /api/tasks/:id` / `PATCH /api/tasks/:id/status` / `DELETE /api/tasks/:id`
- `GET /api/documents` / `POST /api/documents`
- `POST /api/documents/:id/submit` / `POST /api/documents/:id/approve` / `POST /api/documents/:id/reject` / `GET /api/documents/:id/history`
- `GET /api/notifications` / `POST /api/notifications/:id/read` / `POST /api/notifications/read-all`
- `POST /api/kb-articles` / `PATCH /api/kb-articles/:id` / `GET /api/kb-articles/:id/versions` / `POST /api/kb-articles/:id/restore/:version`
- `POST /api/courses` / `PATCH /api/courses/:id`
- `POST /api/courses/:id/assignments` / `GET /api/courses/:id/assignments`
- `POST /api/courses/:id/attempts` / `GET /api/courses/:id/attempts`
- `GET /api/lms-builder/courses` / `GET /api/lms-builder/courses/:id`
- `POST /api/lms-builder/courses` / `PATCH /api/lms-builder/courses/:id`
- `POST /api/lms-builder/courses/:id/sections` / `PATCH /api/lms-builder/sections/:id`
- `POST /api/lms-builder/sections/:id/subsections` / `PATCH /api/lms-builder/subsections/:id`
- `POST /api/lms-builder/subsections/:id/media/image` / `POST /api/lms-builder/subsections/:id/media/video`
- `POST /api/lms-builder/import-markdown`
- `GET /api/lms-builder/courses/:id/versions` / `POST /api/lms-builder/courses/:id/rollback/:version`
- `GET /api/lms-builder/courses/:id/assignments` / `POST /api/lms-builder/courses/:id/assignments`
- `GET /api/lms-progress/courses/:id` / `POST /api/lms-progress/subsections/:id`
- `GET /api/admin/users` / `POST /api/admin/users` / `PATCH /api/admin/users/:id`
- `GET /api/admin/audit`
- `GET /api/admin/audit/export`
- `GET /api/admin/notification-integrations` / `POST /api/admin/notification-integrations` / `PATCH /api/admin/notification-integrations/:id`
- `GET /api/admin/ops/slo-status`
- `POST /api/ops/slo-check`
- `GET /api/ops/slo-routing-policies` / `POST /api/ops/slo-routing-policies` / `PATCH /api/ops/slo-routing-policies/:id` / `DELETE /api/ops/slo-routing-policies/:id`
- `GET /api/ops/sla-matrix` / `POST /api/ops/sla-matrix` / `PATCH /api/ops/sla-matrix/:id`
- `POST /api/ops/escalations/run`
- `POST /api/ops/reminders/run`
- `GET /api/search/unified?q=...&limit=...`
- `GET /api/reports/kpi?days=30&officeId=<id>`
- `GET /api/reports/drilldown?days=30&officeId=<id>&role=<role>`
- `GET /api/reports/schedules` / `POST /api/reports/schedules` / `PATCH /api/reports/schedules/:id`
- `POST /api/reports/schedules/:id/run`
- `GET /api/reports/runs` / `GET /api/reports/runs/:id/download`

Примечание по pagination:
- По умолчанию `GET /api/tasks|news|documents` возвращают массив (backward-compatible) c hard cap `1000`.
- Для серверной пагинации используйте `paginated=true`, тогда ответ: `{ items, total, limit, offset, hasMore }`.
