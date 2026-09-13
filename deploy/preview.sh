#!/usr/bin/env bash
# Publish the working copy to an unlisted preview URL. The live site is not
# touched.   bash deploy/preview.sh   ->   https://bazarpeech.com/preview-v2/
set -euo pipefail

HOST="${HOST:-root@31.56.179.90}"
DOMAIN="${DOMAIN:-bazarpeech.com}"
NAME="${NAME:-preview-v2}"
DEST="/var/www/${DOMAIN}/public/${NAME}"   # nginx root is .../public since Sept 8

[ -f index.html ] || { echo "Run from the project root." >&2; exit 1; }

STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/statistics"

# a preview must never be indexed, even if someone links to it
noindex(){ perl -pe 's#(<meta name="viewport")#<meta name="robots" content="noindex, nofollow">\n$1#' "$1" > "$2"
           grep -q 'noindex' "$2" || { echo "failed to inject noindex into $1 — aborting" >&2; exit 1; }; }
noindex index.html            "$STAGE/index.html"
noindex statistics/index.html "$STAGE/statistics/index.html"
cp statistics/results.js      "$STAGE/statistics/results.js"

ssh "$HOST" "mkdir -p '$DEST'"
scp -q -r "$STAGE/." "${HOST}:${DEST}/"
ssh "$HOST" "chown -R www-data:www-data '${DEST}' && find '${DEST}' -type f -exec chmod 644 {} +"

echo "preview: https://${DOMAIN}/${NAME}/"
for path in "" "statistics/" "statistics/results.js"; do
  curl -s -o /dev/null -w "  /${NAME}/${path}  -> %{http_code}\n" "https://${DOMAIN}/${NAME}/${path}"
done
