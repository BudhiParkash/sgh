#!/usr/bin/env bash
# Starts a disposable MongoDB + Redis + API for end-to-end tests (used by Playwright's webServer).
# Never points at real data: everything lives in a temp directory that is deleted on exit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d -t sgh-e2e)"
MONGO_PORT="${E2E_MONGO_PORT:-27117}"
REDIS_PORT="${E2E_REDIS_PORT:-6390}"
mkdir -p "$TMP/db"

cleanup() {
  [[ -n "${MONGO_PID:-}" ]] && kill "$MONGO_PID" 2>/dev/null || true
  [[ -n "${REDIS_PID:-}" ]] && kill "$REDIS_PID" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

# CI provides service containers via E2E_MONGODB_URI / E2E_REDIS_URL; locally we start throwaway processes.
if [[ -z "${E2E_MONGODB_URI:-}" ]]; then
  mongod --dbpath "$TMP/db" --port "$MONGO_PORT" --bind_ip 127.0.0.1 --quiet --logpath "$TMP/mongod.log" &
  MONGO_PID=$!
  for _ in $(seq 1 50); do (echo > /dev/tcp/127.0.0.1/"$MONGO_PORT") 2>/dev/null && break; sleep 0.2; done
fi
if [[ -z "${E2E_REDIS_URL:-}" ]]; then
  redis-server --port "$REDIS_PORT" --save "" --appendonly no --logfile "$TMP/redis.log" &
  REDIS_PID=$!
fi

export NODE_ENV=development SITE_ENV=local PORT=4000 LOG_LEVEL=warn
export SITE_URL=http://localhost:3100 CORS_ORIGINS=http://localhost:3100
export MONGODB_URI="${E2E_MONGODB_URI:-mongodb://127.0.0.1:${MONGO_PORT}/sgh_e2e}" REDIS_URL="${E2E_REDIS_URL:-redis://127.0.0.1:${REDIS_PORT}}"
export HASH_SECRET="e2e-hash-secret-0123456789abcdefghijklmnopqr"
export ENCRYPTION_KEY="$(printf 'e2e-encryption-key-32-bytes-long' | base64)"
export REVALIDATE_SECRET="e2e-revalidate-secret-0123456789abcdefghij"
export REVALIDATE_URL="http://localhost:3100/api/revalidate"
export LOCAL_MEDIA_DIR="$TMP/media"
export SGH_ADMIN_PASSWORD="E2E-Super-Admin-Passphrase-42"

cd "$ROOT/backend"
npx tsx scripts/seed.ts >/dev/null
npx tsx scripts/create-super-admin.ts --email e2e-root@sgh.test --name "E2E Root" >/dev/null
exec npx tsx src/server.ts
