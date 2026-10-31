#!/bin/bash
# Debian 13 LXC: systemd unit + Caddy reverse proxy for worlds-host.
# Run as root from a checkout (or a release tree) of this repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
id ewsworlds >/dev/null 2>&1 || useradd --system --home /var/lib/ews-worlds --shell /usr/sbin/nologin ewsworlds
install -d -o ewsworlds -g ewsworlds -m 750 /var/lib/ews-worlds
install -d -m 755 /opt/ews-worlds
rsync -a --delete --exclude node_modules --exclude .git --exclude .worlds-data "$ROOT/" /opt/ews-worlds/
cd /opt/ews-worlds
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
node tools/worlds-build.mjs --assets
chown -R root:root /opt/ews-worlds
chmod -R u=rwX,go=rX /opt/ews-worlds
install -d -m 700 /etc/ews-worlds
if [ ! -f /etc/ews-worlds/env ]; then
  umask 077
  sed -e "s|^EWS_WORLD_DATA=.*|EWS_WORLD_DATA=/var/lib/ews-worlds|" \
      -e "s|^PUBLIC_BIND=.*|PUBLIC_BIND=127.0.0.1|" \
      "$ROOT/deploy/worlds/env.example" > /etc/ews-worlds/env
  echo "Wrote /etc/ews-worlds/env — set WORLD_MODERATORS before enabling the unit."
fi
chmod 600 /etc/ews-worlds/env
install -m 644 "$ROOT/deploy/worlds/ews-worlds.service" /etc/systemd/system/ews-worlds.service
if command -v caddy >/dev/null 2>&1; then
  install -m 644 "$ROOT/deploy/worlds/Caddyfile" /etc/caddy/Caddyfile.d/ews-worlds.caddy 2>/dev/null \
    || install -m 644 "$ROOT/deploy/worlds/Caddyfile" /etc/caddy/Caddyfile
  systemctl enable --now caddy || true
fi
systemctl daemon-reload
systemctl enable --now ews-worlds
sleep 1
systemctl is-active ews-worlds
curl -fsS 127.0.0.1:8080/healthz >/dev/null
echo "worlds-host is up on 127.0.0.1:8080. Point cloudflared at it (deploy/worlds/cloudflared-ingress.yml)."
echo "Backup: /var/lib/ews-worlds and /etc/ews-worlds/env. Restore those paths and restart ews-worlds."
