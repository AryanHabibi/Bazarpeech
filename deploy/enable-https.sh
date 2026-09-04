#!/usr/bin/env bash
# Run ON THE SERVER as root, AFTER dns for bazarpeech.com points at this box.
# Obtains a Let's Encrypt certificate and switches the site to HTTPS.
set -euo pipefail

DOMAIN="${DOMAIN:-bazarpeech.com}"
EMAIL="${EMAIL:-}"

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }
[ -n "$EMAIL" ] || { echo "Set EMAIL first, e.g.  EMAIL=you@example.com bash enable-https.sh"; exit 1; }

# Refuse to run before DNS resolves here — certbot would just fail the challenge.
MYIP="$(curl -fsS https://api.ipify.org || true)"
DNSIP="$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || true)"
echo "server public ip : ${MYIP:-unknown}"
echo "${DOMAIN} resolves to: ${DNSIP:-nothing}"
if [ -n "$MYIP" ] && [ -n "$DNSIP" ] && [ "$MYIP" != "$DNSIP" ]; then
  echo "DNS does not point at this server yet. Fix the A record and retry." >&2
  exit 1
fi

certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
        --agree-tos -m "$EMAIL" --redirect --non-interactive

systemctl reload nginx
systemctl list-timers 'certbot*' --no-pager || true
echo "HTTPS live: https://${DOMAIN}"
