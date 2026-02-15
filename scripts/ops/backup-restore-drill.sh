#!/usr/bin/env bash
set -euo pipefail

SOURCE_DB_URL="${SOURCE_DB_URL:-}"
TARGET_DB_URL="${TARGET_DB_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-./.drills/backup}"

if [[ -z "$SOURCE_DB_URL" ]]; then
  echo "SOURCE_DB_URL is required" >&2
  exit 1
fi
if [[ -z "$TARGET_DB_URL" ]]; then
  echo "TARGET_DB_URL is required" >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found"; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore not found"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql not found"; exit 1; }

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d_%H%M%S)"
dump_path="$BACKUP_DIR/backup_${ts}.dump"
sha_path="$BACKUP_DIR/backup_${ts}.sha256"
restore_log="$BACKUP_DIR/restore_${ts}.log"
validation_out="$BACKUP_DIR/validation_${ts}.txt"
smoke_out="$BACKUP_DIR/smoke_${ts}.txt"
summary_out="$BACKUP_DIR/drill_summary_${ts}.md"

echo "[drill] creating dump: $dump_path"
backup_started_at="$(date +%s)"
pg_dump --format=custom --no-owner --no-privileges --file "$dump_path" "$SOURCE_DB_URL"
backup_finished_at="$(date +%s)"
backup_duration_sec="$((backup_finished_at - backup_started_at))"

echo "[drill] generating checksum: $sha_path"
sha256sum "$dump_path" > "$sha_path"

echo "[drill] restoring into target (clean if exists)"
restore_started_at="$(date +%s)"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET_DB_URL" "$dump_path" 2>&1 | tee "$restore_log"
restore_finished_at="$(date +%s)"
restore_duration_sec="$((restore_finished_at - restore_started_at))"

echo "[drill] running validation SQL"
validation_started_at="$(date +%s)"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "scripts/ops/restore-validation.sql" 2>&1 | tee "$validation_out"
validation_finished_at="$(date +%s)"
validation_duration_sec="$((validation_finished_at - validation_started_at))"

smoke_duration_sec=0
if [[ -n "${TARGET_API_URL:-}" ]]; then
  echo "[drill] running smoke checks: $TARGET_API_URL"
  smoke_started_at="$(date +%s)"
  bash ./scripts/ops/smoke-check-endpoints.sh "$smoke_out"
  smoke_finished_at="$(date +%s)"
  smoke_duration_sec="$((smoke_finished_at - smoke_started_at))"
else
  echo "[drill] skipping smoke checks (TARGET_API_URL is not set)"
fi

echo "[drill] generating summary: $summary_out"
node ./scripts/ops/generate-drill-summary.mjs \
  --output "$summary_out" \
  --timestamp "$ts" \
  --dumpFile "$dump_path" \
  --checksumFile "$sha_path" \
  --restoreLog "$restore_log" \
  --validationFile "$validation_out" \
  --smokeFile "$smoke_out" \
  --backupDurationSec "$backup_duration_sec" \
  --restoreDurationSec "$restore_duration_sec" \
  --validationDurationSec "$validation_duration_sec" \
  --smokeDurationSec "$smoke_duration_sec"

echo "[drill] completed"
echo " dump: $dump_path"
echo " sha : $sha_path"
echo " log : $restore_log"
echo " val : $validation_out"
if [[ -f "$smoke_out" ]]; then
  echo " smoke: $smoke_out"
fi
echo " sum : $summary_out"
