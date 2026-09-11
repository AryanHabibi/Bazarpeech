#!/usr/bin/env bash
# Roll the homepage back to a previous version.
#   bash deploy/restore-previous.sh              # lists available backups
#   bash deploy/restore-previous.sh <backup>     # restores that one
set -euo pipefail
HOST="${HOST:-root@31.56.179.90}"
REMOTE="/var/www/bazarpeech.com/public"   # nginx root moved here on Sept 8

if [ $# -eq 0 ]; then
  echo "Backups on the server:"
  ssh "$HOST" "ls -la /root/index.html.backup-* 2>/dev/null || echo '  (none)'"
  echo
  echo "Restore with:  bash deploy/restore-previous.sh /root/index.html.backup-YYYYMMDD-HHMMSS"
  exit 0
fi

BACKUP="$1"
ssh "$HOST" "set -e
  [ -f '$BACKUP' ] || { echo 'no such backup: $BACKUP' >&2; exit 1; }
  cp -a '$BACKUP' '${REMOTE}/.index.html.new'
  chown www-data:www-data '${REMOTE}/.index.html.new'
  chmod 644 '${REMOTE}/.index.html.new'
  mv '${REMOTE}/.index.html.new' '${REMOTE}/index.html'
  echo 'restored $BACKUP'"
curl -fsS -o /dev/null -w "live now: %{http_code}  %{size_download} bytes\n" https://bazarpeech.com/
