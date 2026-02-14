# Portal MKK 1

Веб-портал для сети МФО: новости, база знаний, LMS, документооборот, задачи, оргструктура и рейтинги.

## Команды

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
PORT=8080 npm run start
```

## Переменные окружения фронтенда

Создайте `.env` на основе `.env.example`:

```bash
VITE_API_URL=https://<backend-domain>
```

Логин в приложении теперь через email/password Supabase (`/login`).

## Архитектура

- `src/pages/*` — отдельные страницы.
- `src/components/*` — переиспользуемые UI и layout-компоненты.
- `src/services/portalRepository.ts` — data layer (localStorage + async API-стиль).
- `src/contexts/AuthContext.tsx` — авторизация и ролевой доступ.
- `src/app/router.tsx` — роутинг и защищенные маршруты.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`.
Пайплайн проверяет `lint`, `typecheck`, `test`, `build`.

## Deploy в Coolify (Nixpacks)

- `nixpacks.toml` задает фазы `install/build/start`
- production запуск: `npm run start`
- приложение слушает порт из переменной `PORT`

## Backend + Supabase в Coolify

Добавлен отдельный backend-сервис в `backend/`:
- API: `backend/src/server.ts`
- Nixpacks конфиг: `backend/nixpacks.toml`
- SQL схема Supabase: `backend/supabase/schema.sql`
- Seed: `backend/supabase/seed.sql`
- Инструкция деплоя: `backend/README.md`

В Coolify для backend укажите:
1. `Base Directory` = `backend`
2. `Build Pack` = `Nixpacks`
3. `Port` = `4000`
4. env:
   - `PORT=4000`
   - `CORS_ORIGIN=https://<frontend-domain>`
   - `SUPABASE_URL=...`
   - `SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`

После изменений backend/supabase всегда применяйте актуальный `backend/supabase/schema.sql` в проекте Supabase (включая RLS-политики).

После первого деплоя backend создайте администратора:
```bash
cd backend
ADMIN_EMAIL=admin@company.com ADMIN_PASSWORD='<strong-password>' ADMIN_FULL_NAME='Главный администратор' npm run bootstrap-admin
```
