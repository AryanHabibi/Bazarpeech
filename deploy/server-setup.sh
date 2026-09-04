#!/usr/bin/env bash
# One-time provisioning for bazarpeech.com. Run ON THE SERVER as root:
#   bash server-setup.sh
# Safe to re-run: every step is idempotent.
set -euo pipefail

DOMAIN="${DOMAIN:-bazarpeech.com}"
WEBROOT="/var/www/${DOMAIN}/public"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m !  %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

# ---------------------------------------------------------------- packages ---
say "Installing nginx, certbot, ufw"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nginx ufw certbot python3-certbot-nginx
  WEBUSER=www-data
elif command -v dnf >/dev/null; then
  dnf install -y nginx certbot python3-certbot-nginx firewalld
  WEBUSER=nginx
else
  echo "Unsupported distro: need apt-get or dnf." >&2; exit 1
fi

# ----------------------------------------------------------------- webroot ---
say "Creating ${WEBROOT}"
mkdir -p "$WEBROOT"
if [ ! -f "$WEBROOT/index.html" ]; then
  cat > "$WEBROOT/index.html" <<'PLACEHOLDER'
<!doctype html><meta charset="utf-8"><title>bazarpeech.com</title>
<body style="background:#0d1117;color:#5a6878;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">
server is up — waiting for first deploy</body>
PLACEHOLDER
fi
chown -R "$WEBUSER":"$WEBUSER" "/var/www/${DOMAIN}"
find "/var/www/${DOMAIN}" -type d -exec chmod 755 {} +
find "/var/www/${DOMAIN}" -type f -exec chmod 644 {} +

# ------------------------------------------------------------------- nginx ---
say "Writing nginx site config"
CONF_DIR=/etc/nginx/conf.d
[ -d /etc/nginx/sites-available ] && CONF_DIR=/etc/nginx/sites-available

cat > "${CONF_DIR}/${DOMAIN}.conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${WEBROOT};
    index index.html;

    # single-page deploys: never serve a stale shell
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location / {
        try_files \$uri \$uri/ =404;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    gzip on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/html text/css text/plain application/javascript image/svg+xml application/json;

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log;
}
NGINX

if [ -d /etc/nginx/sites-enabled ]; then
  ln -sf "${CONF_DIR}/${DOMAIN}.conf" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
  rm -f /etc/nginx/sites-enabled/default
fi

say "Testing nginx config"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ---------------------------------------------------------------- firewall ---
say "Opening 80/443 (SSH stays open)"
if command -v ufw >/dev/null; then
  ufw allow OpenSSH      >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
  ufw allow 'Nginx Full' >/dev/null 2>&1 || { ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; }
  ufw --force enable
  ufw status
elif command -v firewall-cmd >/dev/null; then
  systemctl enable --now firewalld
  firewall-cmd --permanent --add-service=ssh   >/dev/null
  firewall-cmd --permanent --add-service=http  >/dev/null
  firewall-cmd --permanent --add-service=https >/dev/null
  firewall-cmd --reload
fi

say "Done. http://${DOMAIN} should serve the placeholder once DNS points here."
echo "Next:  1) deploy the site   2) bash enable-https.sh   3) rotate the root password"
if [ ! -s /root/.ssh/authorized_keys ]; then
  warn "No SSH key installed for root yet — run ssh-copy-id from your laptop before"
  warn "disabling password login, or you will lock yourself out."
fi
