# Elderverse worlds

Standalone browser world for **worlds.elderworldstudio.com**. It is the existing office/town engine (`/office/`) with worlds mode (`?worlds=1` or this folder), not a second renderer.

## Run locally

```bash
npm install
npm run worlds:assets          # copy incoming/elderverse-baked GLBs + write lod-clusters.json
WORLD_MODERATORS=dev-token npm run worlds:host
# http://127.0.0.1:8080/worlds/?autostart=1
```

Office-only still works at `/office/`.

## What is in this tree

| Path | Role |
|---|---|
| `site/worlds/` | Entry HTML + futuristic HUD CSS |
| `site/office/modules/worlds-*` | Travel, HUD, editor, Phase 1 LOD |
| `site/office/modules/baked-props/` | Lazy EWS-owned GLBs |
| `incoming/world-server/ews-world-src/worlds-host.mjs` | Static + stub world + moderator editor |
| `docs/ews-render-design.md` | Phase 2 WebGPU renderer plan |
| `deploy/worlds/` | Docker, systemd, Caddy, cloudflared, env |

## Self-host (EWS datacenter)

Target: Debian 13 LXC, 2 vCPU / 2 GB, no inbound ports, Cloudflare Tunnel.

- **Docker:** `docker compose -f deploy/worlds/docker-compose.yml up --build`
- **systemd + Caddy:** `sudo deploy/worlds/install.sh` (reads `deploy/worlds/env.example` → `/etc/ews-worlds/env`)
- Bind `PUBLIC_BIND=127.0.0.1` and put Caddy or cloudflared in front. Example ingress: `deploy/worlds/cloudflared-ingress.yml`
- Data: `EWS_WORLD_DATA` (default `.worlds-data`, production `/var/lib/ews-worlds`). Backup that directory + `/etc/ews-worlds/env`. Restore = copy them back and restart the unit.
- Moderators: `WORLD_MODERATORS` is a comma-separated token list. **No names in code.**

Static-only deploy (no editor): serve `site/` (or `dist/worlds/` after `npm run worlds:build`) with gzip/brotli. `/api/worlds/*` will 404 and the client fail-softs to visitor mode.

## Tests

```bash
npx playwright install --with-deps chromium
npm test
```

Covers: worlds load + walk + space + Omnivael, office still loads, moderator persist + visitor reject, `/healthz`, SSIM ≥ 0.98 vs max LOD at distance.
