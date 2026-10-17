# Elderverse world server <-> world DO: shared delta schema (v1, 2026-10-16)

Server: CT119 `ews-world` (pve-mini, 10.0.0.88), source `/workspace/ews-world` (box). Typed copy: `schema.ts` here.
It is authoritative for town state, construction stages and agent movement, and connects **outbound only**.

## Transport (matches `workers/office-limiter/world.js` + `functions/api/office/world*.js` as written)
- Subscribe: `GET /api/office/world` with `Upgrade: websocket` -> `{t:'snap',seq,now,ents,build,road}` then `{t:'delta',seq,now,up,rm}`. Server sends `ping` every 25 s, expects `{"t":"pong"}`.
- Publish: `POST /api/office/world-event`, `Authorization: Bearer <key>`, one event or a list (max 50). Same `clean()` allowlist.
- Events used today (DO already accepts): `lot.lease`, `site.progress`, `lot.release`, `road.upsert`, `road.progress`, `road.remove`.
  Progress is `overall` (0..1) plus `next:{o,eta}`; the server never sends `next.o` beyond the job's real progress (demo jobs use their clock).
- Round-trip check (every 30 min + on start): `road.upsert` id `rt-xxxxxx` at a=[1900,1900] (outside the map), wait for the delta, then `road.remove`. Clients may ignore ids starting `rt-`.

## Asks for the DO builder (not done by the world server; your files are untouched)
1. **Key:** accept a second bearer `WORLD_SERVER_KEY` on `world-event` (Pages secret, staging env) so CT119 does not need the CT111 `OFFICE_INGEST_KEY`. The value is in box `/home/box/secrets/ews-world/world-key` (never print; set it with `wrangler pages secret put WORLD_SERVER_KEY` from that file).
2. **Agent poses (proposed extension):** add to `clean()` + `applyEvent()`:
   - `{type:'agent.pose', poses:[{id, zone, x, z, h, act, to?, v?, lot?}]}` (<=200 per event). `zone` = `team:<key>` | `lobby` | `town`; x/z metres zone-local; h radians;
     `act` in `desk|walk|idle|field|meet|away`; `to` = walk target, `v` = m/s so clients tween; `lot` when act=field. Entity id `agent:<id>`, kind `agent`.
   - `{type:'agent.gone', id}` removes it.
   The server sends ~1 batch/s only for moving or changed agents (+30 s keepalive). Until the DO accepts these, the server keeps them off for the DO (`WORLD_AGENT_EVENTS=0`) and only the localhost stub gets them.
3. Optional: a `?since=<seq>` on the WS so a reconnect can skip the full snapshot. The server already handles full snapshots.

## Switch-over
When world.js is on staging and (1) is set: in CT119 `ews-world-ctl use-do https://office-3d.elderworldstudio.pages.dev`; then `ews-world-ctl roundtrip`.
