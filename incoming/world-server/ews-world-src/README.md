# ews-world — Elderverse world server (staging)

CT **119** `ews-world` on **pve-mini** @ `10.0.0.88` (unprivileged Debian 13, 2 vCPU / 4 GB / 20 GB local-lvm, onboot).
Node 20 + TypeScript (source `src/`, built `dist/`). Box source: `/workspace/ews-world`. Shell: `~/bin/ct119 'cmd'`.

## What it does
- **Authoritative** town state (lots, roads, buildings), construction-stage simulation (`construction.ts`, shown progress never
  passes real progress; `next` hints so viewers creep), and agent movement/decisions (`agents.ts`, driven by the CT111 office
  publisher's feed `/api/office/state` + roster).
- Publishes events **outbound** to the world Durable Object (`POST {WORLD_BASE}/api/office/world-event`, Bearer `WORLD_KEY`)
  and subscribes to its WebSocket (`{WORLD_BASE}/api/office/world`) for snap/deltas. Reconnects with backoff, re-asserts owned
  entities after every snapshot. No inbound internet ports; admin/health listen on 127.0.0.1 only; sshd disabled.
- Until the real DO is on staging it talks to `ews-world-stub` (127.0.0.1:8788), a byte-compatible stand-in.
- Shared delta schema: `src/schema.ts` (mirrored as `ews-office-build/incoming/world-server/DELTA-SCHEMA.md`).

## Operate (inside CT119)
`ews-world-ctl status|health|logs [n]|roundtrip|snapshot|use-stub|use-do <base>`
- Health: `curl -s 127.0.0.1:8790/healthz` (200 = DO socket fresh, status feed fresh, last round-trip OK; 503 otherwise).
- Admin (Bearer WORLD_KEY): POST /admin/lease {lot,tenant,public,style,real|demo,secs}, /admin/road {id,a,b,w,name}, /admin/progress {id,real}, /admin/remove {id}, /admin/roundtrip, /admin/snapshot.
- Units: ews-world.service, ews-world-stub.service (Restart=always), ews-world-health.timer (2 min; restart after 3 fails), ews-world-snapshot.timer (02:10 CT).
- Secrets/config: `/etc/ews-world/env` (root 600). Box copy of the key: `/home/box/secrets/ews-world/world-key` (600). Never print.
- Data: `/var/lib/ews-world/{state.json,stub-world.json,snapshots/}`. Backups: vzdump job `pve-mini-nightly-usb` (02:30, all guests) + optional R2 (R2_* vars, unset).

## Switch to the real DO (after ews-office-build deploys world.js + accepts WORLD_KEY)
`ews-world-ctl use-do https://office-3d.elderworldstudio.pages.dev` (agent.pose stays off until the DO accepts it: set WORLD_AGENT_EVENTS=1).

## Revert
In CT: `systemctl disable --now ews-world ews-world-stub ews-world-health.timer ews-world-snapshot.timer; rm /etc/systemd/system/ews-world*; systemctl daemon-reload`.
On pve-mini: `pct stop 119 && pct destroy 119 --purge` (removes the CT, its disk and any vzdump job references). Box: `rm -rf /home/box/secrets/ews-world ~/bin/ct119`.
