#!/usr/bin/env bash
set -euo pipefail

TARGET_API_URL="${TARGET_API_URL:-}"
API_BEARER_TOKEN="${API_BEARER_TOKEN:-}"
OUT_FILE="${1:-}"

if [[ -z "$TARGET_API_URL" ]]; then
  echo "TARGET_API_URL is required" >&2
  exit 1
fi
if [[ -z "$OUT_FILE" ]]; then
  echo "output file path is required as first argument" >&2
  exit 1
fi

base="${TARGET_API_URL%/}"
auth_header=()
if [[ -n "$API_BEARER_TOKEN" ]]; then
  auth_header=(-H "Authorization: Bearer $API_BEARER_TOKEN")
fi

run_check() {
  local name="$1"
  local path="$2"
  local status
  status="$(curl -sS -o /dev/null -w "%{http_code}" "${auth_header[@]}" "$base$path" || true)"

  if [[ "$status" =~ ^2|3 ]]; then
    echo "$name|PASS|$status" >> "$OUT_FILE"
  else
    echo "$name|FAIL|$status" >> "$OUT_FILE"
  fi
}

echo "check|result|http_status" > "$OUT_FILE"
run_check "health" "/health"
run_check "bootstrap" "/api/bootstrap"
run_check "tasks" "/api/tasks?paginated=true&limit=1&offset=0"
run_check "documents" "/api/documents?paginated=true&limit=1&offset=0"
run_check "news" "/api/news?paginated=true&limit=1&offset=0"

