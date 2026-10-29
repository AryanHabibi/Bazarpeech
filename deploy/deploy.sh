#!/usr/bin/env bash
# Push the site from your laptop. Run from the project root:
#   bash deploy/deploy.sh
# SSH asks for the password itself (or uses your key) — it is never stored here.
set -euo pipefail

HOST="${HOST:-root@31.56.179.90}"
DOMAIN="${DOMAIN:-bazarpeech.com}"
SRC="${SRC:-index.html}"
REMOTE="/var/www/${DOMAIN}/public"   # nginx root moved here on Sept 8

[ -f "$SRC" ] || { echo "Can't find $SRC — run this from the project root." >&2; exit 1; }

# The homepage links to the Statistics page. That page runs on generated sample
# data until statistics/results.js holds real results — never publish that.
if [ -z "${ALLOW_SAMPLE_DATA:-}" ] && grep -q 'statistics/' "$SRC"; then
  if grep -qE '^window\.BZP_RESULTS *= *null' statistics/results.js; then
    echo "REFUSING TO DEPLOY: the Statistics page is still on sample data." >&2
    echo "  Put verified monthly returns in statistics/results.js, or remove the" >&2
    echo "  Statistics links from $SRC, then deploy again." >&2
    echo "  (or set ALLOW_SAMPLE_DATA=1 to publish with the sample-data notice showing)" >&2
    exit 1
  fi
fi

SUM=$(shasum -a 256 "$SRC" | awk '{print $1}')
echo "==> backing up the live page"
ssh "$HOST" "cp -a '${REMOTE}/index.html' '/root/index.html.backup-$(date +%Y%m%d-%H%M%S)' 2>/dev/null || true"

echo "==> uploading $SRC -> ${HOST}:${REMOTE}/index.html"
# staged, checksum-verified, then moved: a corrupt or partial upload never goes live
scp -q -o StrictHostKeyChecking=accept-new "$SRC" "${HOST}:${REMOTE}/.index.html.new"
ssh "$HOST" "set -e
  STAGED=\$(sha256sum '${REMOTE}/.index.html.new' | awk '{print \$1}')
  [ \"\$STAGED\" = '$SUM' ] || { echo 'checksum mismatch - aborting, live site untouched' >&2; rm -f '${REMOTE}/.index.html.new'; exit 1; }
  chown www-data:www-data '${REMOTE}/.index.html.new'
  chmod 644 '${REMOTE}/.index.html.new'
  mv '${REMOTE}/.index.html.new' '${REMOTE}/index.html'"

echo "==> uploading the Statistics page"
ssh "$HOST" "mkdir -p '${REMOTE}/statistics'"
scp -q statistics/index.html statistics/results.js "${HOST}:${REMOTE}/statistics/"
ssh "$HOST" "mkdir -p '${REMOTE}/about'"
scp -q about/index.html "${HOST}:${REMOTE}/about/"
ssh "$HOST" "chown -R www-data:www-data '${REMOTE}/statistics' '${REMOTE}/about' && chmod 644 '${REMOTE}/statistics/'* '${REMOTE}/about/'*"

echo "==> deployed. verifying"
curl -fsS -o /dev/null -w "  http  %{http_code}\n" "http://${DOMAIN}/" || echo "  http  no response (DNS not pointed yet?)"
curl -fsS -o /dev/null -w "  https %{http_code}\n" "https://${DOMAIN}/" 2>/dev/null || echo "  https not enabled yet"
