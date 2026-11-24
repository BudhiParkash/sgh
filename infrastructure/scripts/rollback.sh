#!/usr/bin/env bash
# Points `current` back to a previous release and reloads PM2.
#   rollback.sh              → previous release
#   rollback.sh <sha>        → specific release
# Safe because database changes are always backward compatible (expand → migrate → contract).
set -euo pipefail
BASE=/srv/sgh
TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  CUR="$(basename "$(readlink -f "$BASE/current")")"
  TARGET="$(ls -1t "$BASE/releases" | grep -v "^$CUR$" | head -1)"
fi
[[ -d "$BASE/releases/$TARGET" ]] || { echo "Release $TARGET not found" >&2; exit 1; }
ln -sfn "$BASE/releases/$TARGET" "$BASE/current.new" && mv -Tf "$BASE/current.new" "$BASE/current"
pm2 startOrReload "$BASE/current/infrastructure/pm2/ecosystem.config.cjs" --update-env && pm2 save
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:4000/api/v1/health >/dev/null && { echo "✓ Rolled back to $TARGET"; exit 0; }; sleep 2; done
echo "✗ Rolled back to $TARGET but health check is still failing — check 'pm2 logs'" >&2
exit 1
