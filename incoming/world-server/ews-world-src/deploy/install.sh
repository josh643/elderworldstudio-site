#!/bin/bash
# Runs inside CT119 as root. Bundle unpacked at /tmp/ews-world-bundle. Never prints secrets.
set -euo pipefail
B=/tmp/ews-world-bundle
id ewsworld >/dev/null 2>&1 || useradd --system --home /var/lib/ews-world --shell /usr/sbin/nologin ewsworld
install -d -o ewsworld -g ewsworld -m 750 /var/lib/ews-world /var/lib/ews-world/snapshots
install -d -m 755 /opt/ews-world; rm -rf /opt/ews-world/dist /opt/ews-world/node_modules
cp -r $B/dist $B/src $B/node_modules $B/package.json $B/README.md /opt/ews-world/; chown -R root:root /opt/ews-world; chmod -R u=rwX,go=rX /opt/ews-world
install -d -m 700 /etc/ews-world
if [ ! -f /etc/ews-world/env ]; then
  umask 077; { echo "# ews-world secrets/config (root 600). Never print WORLD_KEY."; echo "WORLD_KEY=$(cat $B/world-key)"
    echo "WORLD_BASE=http://127.0.0.1:8788"; echo "WORLD_AGENT_EVENTS=1"; echo "WORLD_MODE=staging"
    echo "STATUS_URL=https://office-3d.elderworldstudio.pages.dev/api/office/state"; echo "ROSTER_URL=https://office-3d.elderworldstudio.pages.dev/office/data/roster.json"
    echo "ADMIN_PORT=8790"; echo "STUB_PORT=8788"; echo "# Optional offsite (unset = none): R2_ENDPOINT= R2_BUCKET= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY="; } > /etc/ews-world/env
fi
chmod 600 /etc/ews-world/env; rm -f $B/world-key
install -m 755 $B/deploy/ews-world-ctl /usr/local/bin/ews-world-ctl
for u in ews-world.service ews-world-stub.service ews-world-health.service ews-world-health.timer ews-world-snapshot.service ews-world-snapshot.timer; do install -m 644 $B/deploy/$u /etc/systemd/system/$u; done
install -d /etc/systemd/journald.conf.d; install -m 644 $B/deploy/journald.conf /etc/systemd/journald.conf.d/ews-world.conf; systemctl restart systemd-journald
systemctl daemon-reload
systemctl enable --now ews-world-stub.service ews-world.service ews-world-health.timer ews-world-snapshot.timer
sleep 2; systemctl is-active ews-world-stub ews-world
