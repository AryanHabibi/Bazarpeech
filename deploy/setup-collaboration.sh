#!/usr/bin/env bash
# Install / update the collaboration endpoint on the server.
#
#   BOT_TOKEN='...' CHAT_IDS='111,222' bash deploy/setup-collaboration.sh
#
# The token is passed through the environment and written only to
# /etc/bazarpeech/collaboration.env (root-owned, 0600). It is never committed
# here and never reaches the browser.
set -euo pipefail

HOST="${HOST:-root@31.56.179.90}"
DOMAIN="${DOMAIN:-bazarpeech.com}"
: "${BOT_TOKEN:?set BOT_TOKEN}"
: "${CHAT_IDS:?set CHAT_IDS (comma separated)}"

echo "==> uploading service files"
ssh "$HOST" 'mkdir -p /opt/bazarpeech /etc/bazarpeech'
scp -q deploy/server/collaboration.py                 "$HOST:/opt/bazarpeech/collaboration.py"
scp -q deploy/server/bazarpeech-collaboration.service "$HOST:/etc/systemd/system/bazarpeech-collaboration.service"

echo "==> writing environment file (0600, root only)"
ssh "$HOST" "umask 077; cat > /etc/bazarpeech/collaboration.env" <<ENV
BOT_TOKEN=${BOT_TOKEN}
CHAT_IDS=${CHAT_IDS}
PORT=8787
ENV
ssh "$HOST" 'chmod 600 /etc/bazarpeech/collaboration.env && chown root:root /etc/bazarpeech/collaboration.env'

echo "==> starting service"
ssh "$HOST" 'systemctl daemon-reload && systemctl enable --now bazarpeech-collaboration && sleep 1 && systemctl is-active bazarpeech-collaboration'

echo "==> wiring nginx"
ssh "$HOST" "DOMAIN=$DOMAIN bash -s" <<'REMOTE'
set -euo pipefail
CONF="/etc/nginx/sites-available/${DOMAIN}"

# rate limit lives in the http context
cat > /etc/nginx/conf.d/collaboration-limit.conf <<'LIM'
limit_req_zone $binary_remote_addr zone=collaboration:1m rate=6r/m;
LIM
rm -f /etc/nginx/conf.d/waitlist-limit.conf   # superseded by the file above

cp -a "$CONF" "${CONF}.bak-$(date +%s)"

python3 - "$CONF" <<'PYX'
import sys
path = sys.argv[1]
src  = open(path).read()
# The public URL stays /api/waitlist — only the service's internal name
# changed, and renaming the URL would require a coordinated frontend change.
if "location = /api/waitlist" in src:
    src = src.replace("limit_req zone=waitlist", "limit_req zone=collaboration")
    open(path, "w").write(src)
    print("   rate-limit zone renamed"); raise SystemExit(0)

block = """
    # collaboration endpoint -> local python service (bot token stays server-side)
    location = /api/waitlist {
        limit_req zone=collaboration burst=3 nodelay;
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 20s;
    }
"""
anchor = "    index index.html;\n"
if anchor not in src:
    print("   !! anchor not found, refusing to guess"); raise SystemExit(1)
open(path, "w").write(src.replace(anchor, anchor + block, 1))
print("   location block inserted")
PYX

if ! nginx -t; then
  echo "   !! nginx config invalid — restoring backup" >&2
  cp -a "$(ls -t ${CONF}.bak-* | head -1)" "$CONF"
  nginx -t
  exit 1
fi
systemctl reload nginx
echo "   nginx reloaded"
REMOTE

echo "==> health check (localhost only — /health is deliberately not proxied)"
ssh "$HOST" 'curl -fsS --max-time 5 http://127.0.0.1:8787/api/waitlist/health; echo'
echo "==> public endpoint rejects a bad address as expected"
curl -s -o /dev/null -w "   POST bad email -> %{http_code} (want 400)\n" --max-time 10 \
     -H 'Content-Type: application/json' -d '{"email":"nope"}' \
     "https://${DOMAIN}/api/waitlist"
echo "done."
