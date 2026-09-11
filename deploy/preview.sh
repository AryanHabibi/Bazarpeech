#!/usr/bin/env bash
# Publish the working copy to an unlisted preview URL. The live homepage is
# not touched.   bash deploy/preview.sh   ->   https://bazarpeech.com/preview-v2/
set -euo pipefail

HOST="${HOST:-root@31.56.179.90}"
DOMAIN="${DOMAIN:-bazarpeech.com}"
NAME="${NAME:-preview-v2}"
SRC="${SRC:-index.html}"
DEST="/var/www/${DOMAIN}/public/${NAME}"   # nginx root is .../public since Sept 8

[ -f "$SRC" ] || { echo "Can't find $SRC — run from the project root." >&2; exit 1; }

# a preview must never be indexed, even if someone links to it
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
perl -pe 's#(<meta name="viewport")#<meta name="robots" content="noindex, nofollow">\n$1#' "$SRC" > "$TMP"
grep -q 'noindex' "$TMP" || { echo "failed to inject noindex — aborting" >&2; exit 1; }

ssh "$HOST" "mkdir -p '$DEST'"
scp -q "$TMP" "${HOST}:${DEST}/.index.html.new"
ssh "$HOST" "set -e
  mv '${DEST}/.index.html.new' '${DEST}/index.html'
  chown -R www-data:www-data '${DEST}'; chmod 644 '${DEST}/index.html'"

echo "preview: https://${DOMAIN}/${NAME}/"
curl -s -o /dev/null -w "  -> %{http_code}\n" "https://${DOMAIN}/${NAME}/"
