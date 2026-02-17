#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PLAYWRIGHT_PORT:-3301}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:${PORT}}"
LOG_FILE="${ROOT_DIR}/.next/playwright-dev.log"

cd "$ROOT_DIR"

# Turbopack dev cache can retain a wrong workspace root in this environment.
# Resetting these folders keeps Playwright runs deterministic.
rm -rf "${ROOT_DIR}/.next/dev" "${ROOT_DIR}/.next/turbopack"

E2E_FIXTURE_MODE=1 NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next dev --port "$PORT" >"$LOG_FILE" 2>&1 &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" >/dev/null 2>&1 || true
  wait "$DEV_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

for _ in $(seq 1 45); do
  if curl --connect-timeout 1 --max-time 1 -fsS "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --connect-timeout 1 --max-time 1 -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "Dev server failed to start at $BASE_URL" >&2
  echo "Next.js log: $LOG_FILE" >&2
  cat "$LOG_FILE" >&2
  exit 1
fi

PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL="$BASE_URL" ./node_modules/.bin/playwright test "$@"
