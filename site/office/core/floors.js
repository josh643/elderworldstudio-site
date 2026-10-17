// Floor switch + upper floors (campus order step 3). Floors 2-5 are built lazily, each at its own x offset (400 m per floor,
// far beyond the 120 m camera far plane) so the ground floor culls itself away and costs nothing while you're upstairs.
// Same core position on every floor: you step out of the elevator facing the floor. Static parts are merged per material;
// colliders are explicit rects (ctx.extraCols) because merged meshes have floor-sized bounds.
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
export const FLOORS = [
  { n: 'G', name: 'Lobby', sub: 'Reception, merch store, studio' },
  { n: '2', name: 'Games', sub: 'Games team', floor: 0x5a4632 },
  { n: '3', name: 'Architecture, Design & Marketing', sub: 'Architecture studio · Design · Marketing', floor: 0x4a4f5a },
  { n: '4', name: 'Client Sites & Call Center', sub: 'Client Sites team · Call Center', floor: 0x3f4a44 },
  { n: '5', name: 'Ops & Leadership', sub: 'Ops room · Money & leadership', floor: 0x3a3a48 },
  { n: 'B1', name: 'Command (staff only)', sub: 'Restricted: World Operations', restricted: true },
];
export const CASUAL = ['Astro Dodge', 'Tile 2048', 'Brick Blitz', 'Color Gate', 'Crystal Merge', 'Gem Hopper', 'Neon Snake', 'Spiral Drop', 'Stack Tower', 'Void Flip'];
const PAL = { 'Astro Dodge': 0x2f6fd6, 'Tile 2048': 0xd99a2b, 'Brick Blitz': 0xd6452f, 'Color Gate': 0x9b3fd6, 'Crystal Merge': 0x2fc4d6, 'Gem Hopper': 0x3fd67a, 'Neon Snake': 0x7ad62f, 'Spiral Drop': 0xd62f8e, 'Stack Tower': 0xd6c22f, 'Void Flip': 0x5a2fd6 };
const hx = c => '#' + c.toString(16).padStart(6, '0');

export function setupFloors(ctx, core) {
  const { THREE, esc } = ctx, T = k => (ctx.t ? ctx.t(k) : k); const built = {}; let cur = 'G'; ctx.extraCols ||= [];
  const fade = document.createElement('div'); fade.style.cssText = 'position:fixed;inset:0;background:#05030a;opacity:0;pointer-events:none;transition:opacity .35s;z-index:50';
  document.body.append(fade);
  const offX = n => (n === 'G' ? 0 : n === 'B1' ? -400 : (+n - 1) * 400);
  // B1 is IP-locked server-side (functions/office/b1/_middleware.js + /api/office/b1/*): the room module and its data are only served to
  // allowlisted IPs, so a visitor can't build or teleport there. They see the locked staff door message instead.
  let b1Ok = null; const b1Check = async () => { if (b1Ok !== null) return b1Ok; try { const r = await fetch('/api/office/b1/access', { cache: 'no-store' }); b1Ok = r.ok; } catch { b1Ok = false; } return b1Ok; };
  b1Check();
  const b1Locked = () => ctx.card(`<h3>${esc(T('Restricted: World Operations'))}</h3><p>${esc(T('This level is for Elder World Studio staff only. Sorry, the door is locked.'))}</p>`);
  async function go(n) {
    if (n === cur) { ctx.closeCard(); return; }
    if (n === 'B1') { if (!(await b1Check())) { b1Locked(); return; }
      if (!built.B1) { try { const m = await import('/office/b1/b1.js?v=3'); built.B1 = m.buildB1(ctx, core, offX('B1')); } catch { b1Ok = false; b1Locked(); return; } } }
    ctx.closeCard(); fade.style.opacity = 1;
    setTimeout(() => {
      if (n !== 'G' && n !== 'B1' && !built[n]) built[n] = buildFloor(ctx, core, FLOORS.find(f => f.n === n), offX(n), go);
      const ox = offX(n); ctx.teleport(core.x + ox, core.fz + 1.6, core.x + ox, core.fz + 8);
      cur = n; ctx.curFloor = n; ctx.curBounds = n === 'G' ? null : built[n].bounds; ctx.rebuildColliders(); ctx.daynight?.apply?.();
      ctx.announce?.(`${T('Floor')} ${n}: ${T(FLOORS.find(f => f.n === n).name)}`);
      setTimeout(() => (fade.style.opacity = 0), 120);
    }, 380);
  }
  function panel() {
    const rows = FLOORS.map(f => `<button type="button" class="btn" data-f="${f.n}" style="display:flex;gap:.8em;align-items:center;width:100%;margin:.3em 0;text-align:left${f.n === cur ? ';outline:2px solid #d9b45a' : ''}"><b style="font-size:1.4em;min-width:1.4em">${f.n}</b><span>${esc(T(f.name))}<br><small>${esc(T(f.sub))}</small></span></button>`).join('');
    const c = ctx.card(`<h3>${esc(T('Elevator'))}</h3><p>${esc(T('Choose a floor.'))}</p>${rows}`);
    c.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => go(b.dataset.f)));
  }
  /* session restore after a soft reload (Joshua 2026-10-17 00:28: an update left him outdoors on open grass). The old restore put the
     saved x/z back on the GROUND floor and only rebuilt the upper floor 1.5 s later; in between the ground-floor clamp (exterior
     bounds, |x| < 175) pushed a Floor 3/4 position (x = 800/1200) out onto the edge of the campus, so the late check saw x < 200 and
     never rebuilt the floor. Now the engine calls restore(floor, at) synchronously before the first frame: the floor is built at
     once (no fade), the player is placed at the saved spot if it is inside that floor's walkable bounds, otherwise at that floor's
     elevator; B1 needs the access check, so the player waits at the ground-floor elevator and goes down only if allowed (denied ->
     stays there, the nearest allowed spot). Anything unknown -> the lobby, never open terrain. */
  const floorOfX = x => (x < -200 ? 'B1' : x > 200 ? String(Math.round(x / 400) + 1) : 'G');
  const inB = (b, x, z) => { if (!b) return false; const [x0, x1, z0, z1] = Array.isArray(b) ? b : [b.x0, b.x1, b.z0, b.z1]; return x > x0 + 0.3 && x < x1 - 0.3 && z > z0 + 0.3 && z < z1 - 0.3; };
  const place = (n, at) => { const ox = offX(n), b = n === 'G' ? null : built[n]?.bounds;
    const lobbyOk = n === 'G' && at && Math.abs(at.x - (ctx.lobbyAt?.x ?? 0)) < 60 && at.z > core.fz - 12 && at.z < (ctx.town?.Z0 ?? 10) + 40;   /* G: the building + plaza/lawn/parking, not the far grass */
    if (at && (n === 'G' ? lobbyOk : inB(b, at.x, at.z))) { ctx.player.teleport(at.x, at.z); return 'saved'; }
    ctx.teleport(core.x + ox, core.fz + 1.6, core.x + ox, core.fz + 8); return 'elevator'; };
  const settle = n => { cur = n; ctx.curFloor = n; ctx.curBounds = n === 'G' ? null : built[n].bounds; ctx.rebuildColliders(); ctx.daynight?.apply?.(); };
  const restore = (n, at) => { n = n && (n === 'B1' || n === 'G' || FLOORS.some(f => f.n === n)) ? n : at ? floorOfX(at.x) : 'G';
    if (n === 'B1') { place('G', null); (async () => { if (!(await b1Check())) return; try { if (!built.B1) { const m = await import('/office/b1/b1.js?v=2'); built.B1 = m.buildB1(ctx, core, offX('B1')); } settle('B1'); place('B1', at); } catch { b1Ok = false; } })(); return 'B1-pending'; }
    if (n !== 'G' && !built[n]) { const F = FLOORS.find(f => f.n === n); if (!F) { place('G', null); return 'lobby'; } built[n] = buildFloor(ctx, core, F, offX(n), go); }
    settle(n); return n + ':' + place(n, at); };
  ctx.floorRestore = restore; ctx.floorOfX = floorOfX;
  const reg = () => { if (window.__ewsOffice?.health) window.__ewsOffice.floor = n => (n ? go(String(n)) : cur); else setTimeout(reg, 500); }; reg();
  /* stairs (modules/stairs): build the floors next to the one you are on before you reach them, and switch frames with no fade */
  const ensure = n => { if (n !== 'G' && !built[n] && FLOORS.some(f => f.n === n)) built[n] = buildFloor(ctx, core, FLOORS.find(f => f.n === n), offX(n), go); };
  const hop = n => { ensure(n); cur = n; ctx.curFloor = n; ctx.curBounds = n === 'G' ? null : built[n].bounds; ctx.rebuildColliders(); ctx.daynight?.apply?.(); ctx.announce?.(`${T('Floor')} ${n}: ${T(FLOORS.find(f => f.n === n).name)}`); };
  const api = { panel, go, ensure, hop, tick: dt => built[cur]?.onFrame?.(dt) }; ctx.floorsApi = api; return api;
}

function buildFloor(ctx, core, F, ox, go) {
  const { THREE } = ctx, T = k => (ctx.t ? ctx.t(k) : k), cx = core.x + ox, fz = core.fz;
  const g = new THREE.Group(); g.userData.mod = 'floor-' + F.n; ctx.scene.add(g);
  const X0 = cx - 18, X1 = cx + 18, Z0 = fz - 8.6,   /* deep enough for the team rooms flanking the core (modules/team-halls cfg.floors) */ Z1 = fz + 22;   // core sits at the back; floor opens out toward +z
  const statics = new Map(), cols = ctx.extraCols;
  const M = c => ctx.M ? ctx.M(c) : new THREE.MeshLambertMaterial({ color: c });
  const put = (geo, m, x, y, z, ry = 0, rx = 0) => { geo = geo.clone(); const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.updateMatrix(); geo.applyMatrix4(o.matrix);
    if (!statics.has(m)) statics.set(m, []); statics.get(m).push(geo.index ? geo.toNonIndexed() : geo); };
  const B = (w, h, d, m, x, y, z, ry = 0, solid = false) => { put(new THREE.BoxGeometry(w, h, d), m, x, y, z, ry); if (solid) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2; cols.push([x - hw, z - hd, x + hw, z + hd]); } };
  const C = (rt, rb, h, m, x, y, z, seg = 12) => put(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
  const mat = ctx.mat, wood = M(F.floor || 0x4a4040), wall = mat.wall, trim = mat.trim, dark = mat.dark, stone = mat.stone || mat.wall;
  // slab, ceiling, light panels; the stair shaft (modules/stairs) gets an opening in the slab and the ceiling
  const SH = ctx.stairShaft, so = SH && SH.O(F.n), top = SH && SH.top === F.n;
  const holed = (h, m, y, hole) => { if (!hole) { B(X1 - X0, h, Z1 - Z0, m, cx, y, (Z0 + Z1) / 2); return; } const hx0 = so.x + hole[0], hx1 = so.x + hole[2], hz1 = so.z + hole[1], hz0 = so.z + hole[3];
    const R = (x0, z0, x1, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) B(x1 - x0, h, z1 - z0, m, (x0 + x1) / 2, y, (z0 + z1) / 2); };
    R(X0, Z0, X1, hz0); R(X0, hz1, X1, Z1); R(X0, hz0, hx0, hz1); R(hx1, hz0, X1, hz1); };
  holed(0.2, wood, -0.1, SH && SH.hole);
  holed(0.1, new THREE.MeshBasicMaterial({ color: 0xd9d2c4 }), 4.05, SH && !top && SH.ceilHole);
  const lit = new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false });
  for (let x = X0 + 4; x < X1 - 2; x += 6) for (let z = Z0 + 4; z < Z1 - 2; z += 6) if (!(so && x > so.x - 1 && x < so.x + SH.W + 1 && z < so.z + 0.5 && z > so.z - SH.D - 0.5)) put(new THREE.PlaneGeometry(1.6, 0.6), lit, x, 3.99, z, 0, Math.PI / 2);
  // perimeter: solid back wall; sides + front are window walls (sill, mullions, head) with the day/night lake view outside
  B(X1 - X0, 4, 0.25, wall, cx, 2, Z0, 0, true);
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const view = ctx.extOn ? null : new THREE.MeshBasicMaterial({ map: ctx.kit.viewTex(ctx), toneMapped: false });
  const winWall = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    B(L, 0.75, 0.3, wall, mx, 0.375, mz, ry, true); B(L, 0.4, 0.3, wall, mx, 3.8, mz, ry); B(L, 0.06, 0.34, trim, mx, 0.77, mz, ry);
    const n = Math.round(L / 2.2); for (let i = 0; i <= n; i++) { const t = i / n; B(0.08, 2.9, 0.12, trim, ax + (bx - ax) * t, 2.2, az + (bz - az) * t, ry); }
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.85), glass); gp.position.set(mx, 2.2, mz); gp.rotation.y = ry; gp.userData.dn = 'glass'; gp.userData.noCollide = 1; g.add(gp);
    if (ctx.extOn) return;   /* real 3D exterior outside (core/exterior.js follows you upstairs at the right height): no painted view plane */
    const vv = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, 6), view); vv.position.set(mx + nx * 3, 2.0, mz + nz * 3); vv.rotation.y = ry + (nx || nz < 0 ? 0 : Math.PI); vv.userData.noCollide = 1; vv.rotation.y = Math.atan2(-nx, -nz); g.add(vv); };
  winWall(X0, Z0, X0, Z1, -1, 0); winWall(X1, Z0, X1, Z1, 1, 0); winWall(X0, Z1, X1, Z1, 0, 1);
  // elevator core (same footprint as the lobby core), doors face +z
  const W = core.W, D = core.D, bz = fz - D;
  B(1.0, 4, 0.25, stone, cx - W / 2 + 0.5, 2, fz, 0, true); B(1.0, 4, 0.25, stone, cx + W / 2 - 0.5, 2, fz, 0, true); B(0.4, 4, 0.25, stone, cx, 2, fz, 0, true); B(W, 1.6, 0.25, stone, cx, 3.2, fz);
  B(W, 4, 0.25, stone, cx, 2, bz, 0, true); for (const sx of [-1, 1]) B(0.25, 4, D, stone, cx + sx * W / 2, 2, fz - D / 2, 0, true);
  const brass = M(0xb8924a); const doors = []; for (const sx of [-0.65, 0.65]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.38, 0.06), brass); d.position.set(cx + sx * 1.1, 1.19, fz + 0.02); g.add(d); doors.push(d); cols.push([cx + sx * 1.1 - 0.63, fz - 0.05, cx + sx * 1.1 + 0.63, fz + 0.05]); }
  const ind = ctx.panel(ctx.textCanvas([F.n], { w: 128, h: 96, size: 64, bg: '#0b1626', fg: '#9fe8ff' }), 0.24, 0.18, cx, 2.65, fz + 0.14, 0); ind.material.toneMapped = false; g.attach?.(ind);
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.04), dark); btn.position.set(cx + W / 2 - 0.5, 1.15, fz + 0.15); g.add(btn);
  const call = () => ctx.use?.('floorPanel')?.();
  [...doors, btn].forEach(o => ctx.onClick(o, call));
  // floor directory sign facing the arrivals
  const sign = ctx.panel(ctx.textCanvas([`${F.n} · ${T(F.name)}`, T(F.sub)], { w: 1024, h: 220, size: 78, body: 44 }), 2.6, 0.56, cx, 3.35, fz + 0.15, 0); sign.material.toneMapped = false; sign.userData.plate = F.name;
  const res = { bounds: [X0, X1, Z0, Z1], group: g };
  /* 2026-10-17 (Joshua 12:10 AM): no arcade anywhere in the campus building. The Arcade lives on its own town lot (world lot 11,
     'Elder Arcade'); buildArcade stays below only as the cabinet design reference for that lot. tools/office/removed_guard.py fails the
     deploy if it is called again or game-showrooms returns to modules.json. */
  if (!ctx.upperTeams?.[F.n]) buildSoon(ctx, { g, B, M, cx, fz, X0, X1, Z1, F });
  // merge statics per material
  for (const [m, list] of statics) { const geo = mergeGeometries(list, false); const mesh = new THREE.Mesh(geo, m); mesh.userData.noCollide = 1; mesh.userData.keep = 1; g.add(mesh); list.forEach(x => x.dispose()); }
  ctx.spot?.('floor' + F.n, [cx, 2.2, fz + 2], [cx, 1.2, fz + 10], `Floor ${F.n}`);
  return res;
}

function buildSoon(ctx, { g, B, M, cx, fz, X0, X1, Z1, F }) {
  const T = k => (ctx.t ? ctx.t(k) : k), tape = M(0xe0b020), blk = M(0x1a1a1a);
  const zones = { '3': ['Design studio', 'Marketing room', 'Video & capture'], '4': ['Client sites team', 'Call center', 'Meeting rooms'], '5': ['Ops room', 'Server room', 'Leadership'] }[F.n] || [];
  zones.forEach((nm, i) => { const x = cx - 11 + i * 11, z = fz + 12, w = 8, d = 7; if (F.n === '3' && i === 0 && ctx.archStudio) return;   /* this zone is the open Architecture studio (modules/arch-studio) */
    for (const [px, pz, L, ry] of [[x, z - d / 2, w, 0], [x, z + d / 2, w, 0], [x - w / 2, z, d, Math.PI / 2], [x + w / 2, z, d, Math.PI / 2]]) { B(L, 0.08, 0.06, tape, px, 0.9, pz, ry, true); for (let k = -1; k <= 1; k += 2) B(0.06, 0.9, 0.06, blk, px + (ry ? 0 : k * L / 2), 0.45, pz + (ry ? k * L / 2 : 0)); }
    const s = ctx.panel(ctx.textCanvas([T(nm), T('Opening soon')], { w: 640, h: 200, size: 58, body: 40 }), 1.6, 0.5, x, 1.5, z + d / 2 + 0.05, 0); s.material.toneMapped = false; g.attach?.(s);
    B(0.06, 1.2, 0.06, blk, x, 0.6, z + d / 2 + 0.02); });
}

/* Floor 2 arcade: a real cabinet for every casual game. Stylized-realistic upright cabinets: side panels in the game's colour with
   side art, angled CRT bezel with a live attract-mode screen, glowing marquee with the title, control deck with stick + buttons,
   coin door, kick plate and T-molding light strips. Two facing rows of five under a neon ARCADE sign. Click a cabinet for the game card. */
function buildArcade(ctx, { g, B, C, put, M, cx, fz, X0, X1, Z1, cols, res }) {
  const { THREE, esc } = ctx, T = k => (ctx.t ? ctx.t(k) : k), site = ctx.site;
  const info = Object.fromEntries((site.games || []).map(gm => [gm.title, gm]));
  const black = M(0x111114), deck = M(0x24242a), chrome = M(0xc8c8d0), screens = [];
  // carpet zone + neon sign over the arcade
  const ax = cx, az = fz + 11;
  B(14, 0.03, 12, M(0x1b1035), ax, 0.015, az);
  const sc = ctx.panel(ctx.textCanvas(['ARCADE', T('Every casual game we make, playable soon')], { w: 1024, h: 220, size: 96, body: 40, bg: '#120a24' }), 3.6, 0.78, ax, 3.3, az - 5.6, 0); sc.material.toneMapped = false; g.attach?.(sc);
  CASUAL.forEach((title, i) => {
    const row = i < 5 ? -1 : 1, k = i % 5, x = ax + row * 2.4, z = az - 4.4 + k * 2.2, ry = row < 0 ? Math.PI / 2 : -Math.PI / 2;   // two columns facing each other across a centre aisle that runs from the elevator to the windows
    const col = PAL[title], body = M(col);
    const L = (lx, y, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), y, z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const P = (w, h, d, m, lx, y, lz, rx = 0) => { const [px, py, pz] = L(lx, y, lz); put(new THREE.BoxGeometry(w, h, d), m, px, py, pz, ry, rx); };
    // cabinet body: two side panels + back + base
    for (const s of [-1, 1]) P(0.05, 1.85, 0.8, body, s * 0.37, 0.925, 0);
    P(0.7, 1.85, 0.05, black, 0, 0.925, -0.38); P(0.7, 0.5, 0.75, black, 0, 0.25, 0.02); P(0.7, 0.08, 0.06, M(0x2a2a30), 0, 0.04, 0.38);   // back, base, kick plate
    P(0.32, 0.36, 0.02, M(0x3a3a40), 0, 0.28, 0.4); P(0.06, 0.03, 0.025, M(0xffd060), 0, 0.36, 0.41);                                         // coin door + slot glow
    P(0.7, 0.12, 0.42, deck, 0, 0.98, 0.25, -0.18);                                                                                         // control deck
    P(0.66, 0.6, 0.04, black, 0, 1.38, 0.1, 0.28);                                                                                          // screen bezel (tilted back)
    P(0.7, 0.3, 0.3, black, 0, 1.76, 0.12);                                                                                                 // marquee housing
    for (const s of [-1, 1]) { const [px, , pz] = L(s * 0.395, 0, 0); P(0.012, 1.85, 0.012, M(col), s * 0.398, 0.925, 0.4); }
    // T-molding light strips (emissive, game colour)
    const glow = new THREE.MeshBasicMaterial({ color: col, toneMapped: false }); for (const s of [-1, 1]) P(0.015, 1.8, 0.015, glow, s * 0.4, 0.93, 0.405);
    // joystick + buttons
    { const [px, py, pz] = L(-0.14, 1.07, 0.26); C(0.012, 0.012, 0.09, chrome, px, py, pz, 6); put(new THREE.SphereGeometry(0.03, 8, 6), M(0xd62f2f), px, py + 0.05, pz); }
    [[0.05, 0xd62f2f], [0.13, 0x2f6fd6], [0.21, 0xd6c22f]].forEach(([bx, bc]) => { const [px, py, pz] = L(bx, 1.065, 0.27); C(0.022, 0.022, 0.02, M(bc), px, py, pz, 10); });
    // side art (both sides, outward)
    const sa = document.createElement('canvas'); sa.width = 256; sa.height = 512; { const c2 = sa.getContext('2d'); const gr = c2.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, hx(col)); gr.addColorStop(1, '#0c0818'); c2.fillStyle = gr; c2.fillRect(0, 0, 256, 512);
      c2.strokeStyle = 'rgba(255,255,255,.35)'; c2.lineWidth = 6; for (let s = 0; s < 6; s++) { c2.beginPath(); c2.moveTo(-20, 120 + s * 60); c2.lineTo(276, 60 + s * 60); c2.stroke(); }
      c2.save(); c2.translate(150, 470); c2.rotate(-Math.PI / 2); c2.fillStyle = '#fff'; c2.font = '700 54px Inter, sans-serif'; c2.fillText(title.toUpperCase(), 0, 0); c2.restore(); }
    const sat = new THREE.CanvasTexture(sa); sat.colorSpace = THREE.SRGBColorSpace; const sam = new THREE.MeshLambertMaterial({ map: sat });
    for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.5), sam); const [px, py, pz] = L(s * 0.4, 1.0, 0); pl.position.set(px, py, pz); pl.rotation.y = ry + s * Math.PI / 2; g.add(pl); }
    // marquee (lit)
    const mq = document.createElement('canvas'); mq.width = 512; mq.height = 128; { const c2 = mq.getContext('2d'); const gr = c2.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#0c0818'); gr.addColorStop(0.5, hx(col)); gr.addColorStop(1, '#0c0818'); c2.fillStyle = gr; c2.fillRect(0, 0, 512, 128);
      c2.fillStyle = '#fff'; c2.font = '800 64px Inter, sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.shadowColor = '#fff'; c2.shadowBlur = 16; c2.fillText(title.toUpperCase(), 256, 66); }
    const mqt = new THREE.CanvasTexture(mq); mqt.colorSpace = THREE.SRGBColorSpace; const mqm = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.22), new THREE.MeshBasicMaterial({ map: mqt, toneMapped: false }));
    { const [px, py, pz] = L(0, 1.77, 0.276); mqm.position.set(px, py, pz); mqm.rotation.y = ry; g.add(mqm); }
    // live screen (attract mode, redrawn round-robin while on this floor)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200; const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.44), new THREE.MeshBasicMaterial({ map: st, toneMapped: false }));
    { const [px, py, pz] = L(0, 1.385, 0.125); scr.position.set(px, py, pz); scr.rotation.set(0, ry, 0); scr.rotateX(-0.28); g.add(scr); }
    const icon = info[title]?.img ? Object.assign(new Image(), { src: info[title].img }) : null;
    screens.push({ title, cv, st, col, icon, t: Math.random() * 10 });
    // collider + click -> game card
    { const [px, , pz] = L(0, 0, 0); cols.push([px - 0.42, pz - 0.42, px + 0.42, pz + 0.42]); }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.85), new THREE.MeshBasicMaterial({ visible: false })); { const [px, , pz] = L(0, 0, 0); hit.position.set(px, 0.95, pz); hit.rotation.y = ry; } hit.userData.noCollide = 1; hit.userData.label = title; g.add(hit);
    ctx.onClick(hit, () => { const gm = info[title] || {}; const btn = (gm.buttons || []).map(b => `<a class="btn" href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.label)}</a>`).join(' ');
      ctx.card(`<h3>${esc(title)}</h3><p><small>${esc(gm.tag || 'Coming soon to Google Play')}</small></p><p>${esc(gm.text || '')}</p>${btn}`); });
  });
  // bench + two plants of new species are handled by the plant module later; lounge bench now
  B(2.4, 0.45, 0.6, M(0x2a2236), ax, 0.225, az + 7.2, 0, true);
  // attract-mode drawing
  const draw = s => { const c = s.cv.getContext('2d'), w = 256, h = 200, t = s.t, H = hx(s.col); c.fillStyle = '#05040c'; c.fillRect(0, 0, w, h);
    switch (s.title) {
      case 'Astro Dodge': c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect((i * 53) % w, (i * 37 + t * 80) % h, 2, 2); c.fillStyle = '#8a8a9a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((i * 70 + 30) % w, (i * 50 + t * 60) % h, 12, 0, 7); c.fill(); } c.fillStyle = H; c.beginPath(); c.moveTo(128 + Math.sin(t * 2) * 60, 160); c.lineTo(118 + Math.sin(t * 2) * 60, 182); c.lineTo(138 + Math.sin(t * 2) * 60, 182); c.fill(); break;
      case 'Tile 2048': { const v = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]; for (let i = 0; i < 16; i++) { const n = v[(i * 7 + Math.floor(t)) % 11]; c.fillStyle = `hsl(${30 + Math.log2(n) * 4},80%,${70 - Math.log2(n) * 3}%)`; c.fillRect(48 + (i % 4) * 40, 20 + Math.floor(i / 4) * 40, 36, 36); c.fillStyle = '#222'; c.font = '700 13px sans-serif'; c.fillText(n, 52 + (i % 4) * 40, 42 + Math.floor(i / 4) * 40); } break; }
      case 'Brick Blitz': for (let r = 0; r < 4; r++) for (let q = 0; q < 8; q++) if ((r * 8 + q + Math.floor(t * 2)) % 7) { c.fillStyle = `hsl(${r * 60},90%,55%)`; c.fillRect(8 + q * 30, 14 + r * 14, 28, 12); } c.fillStyle = '#fff'; c.beginPath(); c.arc(128 + Math.sin(t * 3) * 100, 120 + Math.cos(t * 2.2) * 50, 5, 0, 7); c.fill(); c.fillRect(100 + Math.sin(t * 3) * 90, 186, 56, 6); break;
      case 'Color Gate': for (let i = 0; i < 3; i++) { const y = (t * 70 + i * 70) % h; ['#e33', '#3e3', '#33e'].forEach((cc, j) => { c.fillStyle = cc; c.fillRect(j * 86, y, 84, 8); }); } c.fillStyle = ['#e33', '#3e3', '#33e'][Math.floor(t) % 3]; c.beginPath(); c.arc(128, 170, 10, 0, 7); c.fill(); break;
      case 'Crystal Merge': for (let i = 0; i < 20; i++) { c.fillStyle = `hsl(${(i * 47 + t * 40) % 360},90%,60%)`; const x = 30 + (i % 5) * 48, y = 30 + Math.floor(i / 5) * 40 + Math.sin(t * 3 + i) * 3; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 12, y); c.lineTo(x, y + 14); c.lineTo(x - 12, y); c.fill(); } break;
      case 'Gem Hopper': for (let i = 0; i < 6; i++) { c.fillStyle = `hsl(${i * 60},80%,60%)`; c.beginPath(); c.arc(30 + i * 40, 140 - (i % 2) * 40, 10, 0, 7); c.fill(); } { const p = (t * 1.2) % 6, k = Math.floor(p), fr = p - k; c.fillStyle = '#fff'; c.beginPath(); c.arc(30 + (k + fr) * 40, 120 - (k % 2) * 40 - Math.sin(fr * Math.PI) * 40, 7, 0, 7); c.fill(); } break;
      case 'Neon Snake': c.fillStyle = H; for (let i = 0; i < 14; i++) { const a = t * 1.5 - i * 0.18; c.fillRect(128 + Math.cos(a) * 70 - 5 + Math.cos(a * 3) * 10, 100 + Math.sin(a) * 60 - 5, 10, 10); } c.fillStyle = '#f44'; c.fillRect(60, 40, 10, 10); break;
      case 'Spiral Drop': c.strokeStyle = H; c.lineWidth = 3; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(128, 20 + i * 24, 70, 10, 0, t + i, t + i + 4.6); c.stroke(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(128 + Math.sin(t * 4) * 50, (t * 50) % h, 7, 0, 7); c.fill(); break;
      case 'Stack Tower': { const n = Math.floor(t * 1.5) % 10; for (let i = 0; i < n; i++) { c.fillStyle = `hsl(${i * 36},80%,55%)`; c.fillRect(78 + Math.sin(i) * 6, 180 - i * 16, 100 - i * 3, 14); } c.fillStyle = '#fff'; c.fillRect(78 + Math.sin(t * 3) * 70, 180 - n * 16 - 20, 100 - n * 3, 14); break; }
      case 'Void Flip': { c.strokeStyle = H; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = (i * 64 - t * 60) % 320; c.strokeRect(x < -40 ? x + 320 : x, 0, 6, 70); c.strokeRect(x < -40 ? x + 320 : x, 130, 6, 70); } const up = Math.floor(t * 1.3) % 2; c.fillStyle = '#9ff'; c.beginPath(); c.arc(70, up ? 40 : 160, 8, 0, 7); c.fill(); break; }
    }
    if (s.icon?.complete && s.icon.naturalWidth) c.drawImage(s.icon, 6, 6, 34, 34);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 12px Inter, sans-serif'; if (Math.floor(t * 2) % 2) c.fillText('INSERT COIN', 88, 196);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);   // scanlines
    s.st.needsUpdate = true; };
  screens.forEach(s => draw(s));
  let rr = 0, acc = 0; res.onFrame = dt => { if (ctx.curFloor !== '2') return; acc += dt; screens.forEach(s => (s.t += dt)); if (acc < 0.05) return; acc = 0; draw(screens[rr]); draw(screens[(rr + 5) % 10]); rr = (rr + 1) % 10; };
  ctx.spot?.('arcade2', [ax, 2.2, az + 6], [ax, 1.2, az - 2], 'Arcade');
}
