# Backend (Supabase + Express)

## Что делает
- Auth через Supabase (`/auth/sign-up`, `/auth/sign-in`, `/auth/refresh`, `/auth/me`)
- CRUD API для `news`, `tasks`, `documents`
- Endpoint `/api/bootstrap` для загрузки набора данных
- Admin API (`/api/admin/users`) для создания и управления пользователями

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
2. Выполните `backend/supabase/schema.sql`.
3. Выполните `backend/supabase/seed.sql` (опционально).
4. Скопируйте `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Важно: в `schema.sql` включены ужесточенные RLS-политики по ролям/офисам. После обновления backend обязательно повторно примените актуальную схему (или соответствующие SQL-изменения) в Supabase.

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
- `GET /api/bootstrap` (Bearer token)
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
- `GET /api/admin/users` / `POST /api/admin/users` / `PATCH /api/admin/users/:id`
- `GET /api/admin/audit`
- `GET /api/admin/audit/export`
- `POST /api/ops/escalations/run`
- `POST /api/ops/reminders/run`
