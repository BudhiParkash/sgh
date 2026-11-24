#!/usr/bin/env bash
# Deploys a CI-built release (tarball in S3, named by git SHA) with zero downtime.
#   sudo -u sgh /srv/sgh/current/infrastructure/scripts/deploy.sh <sha>     (CI calls this via SSM Run Command)
# Steps: download → install prod deps → write env from SSM → migrate/seed reference data → switch symlink
#        → pm2 reload → health check → automatic rollback on failure. Keeps the last 5 releases.
set -euo pipefail
SHA="${1:?usage: deploy.sh <git-sha>}"
ENV_NAME="${SGH_ENV:-prod}"
BUCKET="${SGH_ARTIFACT_BUCKET:?set SGH_ARTIFACT_BUCKET}"
BASE=/srv/sgh
REL="$BASE/releases/$SHA"
PREV="$(readlink -f "$BASE/current" || true)"

echo "→ Downloading release $SHA"
mkdir -p "$REL"
aws s3 cp "s3://$BUCKET/releases/$SHA.tar.gz" /tmp/sgh-$SHA.tar.gz
tar -xzf /tmp/sgh-$SHA.tar.gz -C "$REL" && rm /tmp/sgh-$SHA.tar.gz

echo "→ Writing environment files from SSM (/sgh/$ENV_NAME/…)"
write_env() { # $1 = ssm path, $2 = output file
  aws ssm get-parameters-by-path --path "$1" --with-decryption --recursive --query "Parameters[].[Name,Value]" --output text |
    awk -F'\t' '{ n=$1; sub(".*/", "", n); print n "=" $2 }' > "$2.tmp"
  chmod 600 "$2.tmp" && mv "$2.tmp" "$2"
}
write_env "/sgh/$ENV_NAME/backend" "$BASE/shared/backend.env"
write_env "/sgh/$ENV_NAME/frontend" "$BASE/shared/frontend.env"
cp "$BASE/shared/frontend.env" "$REL/frontend/.env.production.local"

echo "→ Installing production dependencies"
cd "$REL" && pnpm install --prod --frozen-lockfile

echo "→ Reference data & indexes (idempotent; never creates content)"
(cd "$REL/backend" && node --env-file="$BASE/shared/backend.env" dist/seed.js)

echo "→ Switching release"
ln -sfn "$REL" "$BASE/current.new" && mv -Tf "$BASE/current.new" "$BASE/current"
pm2 startOrReload "$REL/infrastructure/pm2/ecosystem.config.cjs" --update-env && pm2 save

echo "→ Health check"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/api/v1/health >/dev/null && curl -fsS -o /dev/null http://127.0.0.1:3000/; then ok=1; break; fi
  sleep 2
done
if [[ $ok -ne 1 ]]; then
  echo "✗ Health check failed — rolling back to $PREV" >&2
  [[ -n "$PREV" ]] && "$(dirname "$0")/rollback.sh" "$(basename "$PREV")"
  exit 1
fi

echo "→ Cleaning old releases (keep 5)"
ls -1dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf
echo "✓ Deployed $SHA"
