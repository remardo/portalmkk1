# Supabase Migrations Workflow

## Структура
- `backend/supabase/migrations/*.sql` — миграции в порядке применения.
- `backend/supabase/migrations/0001_initial_schema.sql` — базовый слепок схемы.
- `backend/supabase/seed.sql` — тестовые данные (опционально).

## Рекомендуемый процесс
1. Установить Supabase CLI.
2. Для новой миграции создать следующий файл по номеру, например:
   - `backend/supabase/migrations/0002_lms_versioning.sql`
3. Писать только инкрементальные изменения (без полного пересоздания схемы).
4. Применять миграции в окружении последовательно через SQL Editor или Supabase CLI.

## Пример через Supabase CLI
```bash
supabase migration new lms_versioning
# перенести SQL в созданный файл
supabase db push
```

## Правила
- Не редактировать уже примененные миграции в проде.
- Все изменения схемы в PR должны идти отдельным migration-файлом.
- `schema.sql` можно обновлять как snapshot, но источником правды для rollout считаются `migrations/*.sql`.
- Проверка последовательности номеров миграций:
  - `npm run check:migrations` (выполняется также в CI).
- Проверка синхронизации snapshot-схемы:
  - в `schema.sql` должен быть маркер `-- schema_snapshot_migration: XXXX`
  - `npm run check:schema-sync` проверяет, что маркер равен номеру последней миграции.
