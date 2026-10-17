# EWS 3D office (`/office/`, and the 3D layer over the home page)

Rendering runs in the visitor's browser (Three.js r169, vendored in `vendor/`). The servers only send small JSON.

```
boot.js        decides 3D vs classic (no WebGL, Save-Data, low-end device, bots, ?classic=1 -> classic 2D page stays)
office.js      stable entry -> core/engine.js
core/engine.js renderer, quality tiers + FPS watchdog, controls, HUD, tours, cards, module loader, loop
core/kit.js    snap-together kit pieces: room, corridor, sign, desk, pedestal
modules.json   THE REGISTRY: which modules load, in what order, where they snap (anchor) and their config
modules/<id>/index.js   one self-contained module per folder
data/site.json   generated from the built site pages (tools/office_data.py): brand, games, services, merch
data/roster.json generated from tools/office/{teams,agent-names,nodes}.json: teams, agents, nodes
```

## Add or remove things (no core edits)
- **New team / agent:** update `tools/office/teams.json` + `agent-names.json` (copies of CT111 `policy/`), run `python3 tools/build.py`. A room and desks appear.
- **New game / service / merch item:** edit the site as usual in `tools/build.py`; the rebuild re-parses the pages and the showroom/wall/plinth appears.
- **New server:** add it to `tools/office/nodes.json`; the datacenter grows a rack.
- **New feature or display:** create `modules/<id>/index.js` and add `{ "id", "src", "anchor", "config" }` to `modules.json`. Delete the entry to remove it.

## Module contract
```js
export default {
  setup(ctx, config, [x, z]) { /* build meshes; ctx.spot(name, pos, look, tourLabel); return { minZ }? */ },
  onState(snapshot) {},   // optional: sanitized live feed {updated, work:[{agent,name,role,team,stage,progress,blocked}]}
  onFrame(dt, t) {},      // optional: per-frame animation
};
```
`ctx` gives you `THREE, kit, scene, cam, mat, M, box, panel, image, textCanvas, label, site, roster, esc, onClick(obj, fn), card(html),
goTo(spot), hudButton(text, fn), provide(name, value)/use(name), extend(bounds)`. Shared services today: `avatar` (base-avatar),
`agents`, `leadForm` (receptionist), `dais`/`gate` (odin-dais). A module that throws is skipped and the office still loads.
Anchors can be `"after:<module>"` to snap below that module's returned `minZ` (datacenter after team-halls).

## Back end (Cloudflare Pages Functions, `functions/api/office/`)
- `state` GET: sanitized snapshot from KV, edge-cached for 5 s. Visitors never reach CT111/CT112.
- `ingest` POST (bearer): CT111 `ews-office-publisher` pushes when the queue changes (re-sanitized by an allowlist).
- `freyja` POST: receptionist chat, gpt-4o-mini if `OPENAI_API_KEY` is set. Per-IP limits, daily $ cap (`OFFICE_FREYJA_CAP_USD`, default 0.50), canned FAQ fallback.
- `lead` POST: demo request -> KV lead record (no email). `leads` GET/POST (bearer): CT111 pulls and acknowledges.
- Multiplayer later: a Durable Object room per hall pushing the same snapshot shape over WebSockets (swap the `live-status` module).

## VR and kiosk (feature modules)
- `webxr`: shows "Enter VR" only when the browser supports immersive-vr (Quest Browser, PC VR). Teleport by pointing a controller at the floor and pulling the trigger; snap turn on the thumbstick; "VR comfort" sets snap angle, seated mode and teleport fade. Nothing VR-related runs on phones.
- `kiosk`: open `/?kiosk=1` on store screens. It goes fullscreen on first touch, hides the classic-site button, resets after 90 s idle and loops through the tour stops (attract mode). Set the timings in `modules.json`.
