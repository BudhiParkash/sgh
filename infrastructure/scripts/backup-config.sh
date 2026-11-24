#!/usr/bin/env bash
# Nightly extra backup of small, critical collections (settings, legal pages + versions, redirects, roles)
# to the private backup bucket. Atlas continuous backup (PITR) remains the primary backup.
# Cron (sgh): 15 3 * * * /srv/sgh/current/infrastructure/scripts/backup-config.sh
set -euo pipefail
source <(grep -E '^(MONGODB_URI)=' /srv/sgh/shared/backend.env | sed 's/^/export /')
BUCKET="${SGH_BACKUP_BUCKET:?set SGH_BACKUP_BUCKET}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="/tmp/sgh-config-$STAMP"
mkdir -p "$OUT"
for c in website_settings legal_pages legal_page_versions redirects roles categories games scopes; do
  mongoexport --uri="$MONGODB_URI" --collection="$c" --jsonArray --out="$OUT/$c.json" --quiet
done
tar -czf "$OUT.tar.gz" -C /tmp "$(basename "$OUT")"
aws s3 cp "$OUT.tar.gz" "s3://$BUCKET/config/$STAMP.tar.gz" --sse aws:kms
rm -rf "$OUT" "$OUT.tar.gz"
echo "✓ Config backup $STAMP"
