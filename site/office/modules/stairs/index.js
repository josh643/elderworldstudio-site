// Real stairs (Joshua 2026-10-16 11:51 PM: "why do we have stairs if they don't work"). One enclosed switchback stair shaft per floor:
// floor-level landing -> flight A (11 modeled treads + risers, 0.182 m rise / 0.28 m going) -> mid landing -> flight B -> the next
// floor's landing. Brass handrails both sides, wall sconces, a 'Stairs' sign + floor number at every door, a 'Roof · Staff only'
// door on the top floor (no fake flight that leads nowhere).
// Floors live in separate frames (core/floors.js: floor n at x + (n-1)*400), so the shaft is the same in every frame and each frame
// draws the segment below, its own and the one above. Walking past the middle of flight B hands you to the next floor's frame at
// the identical spot (no fade, nothing changes on screen); going down, the mid landing hands you back. The player's eye height
// follows the stair pitch (ctx.groundAt, core/engine.js). Agents use the same shaft: __ewsOffice.agents.travel(id, floor,
// {via: 'stairs' | 'elevator'}) walks them to the stairs (treads, y follows the pitch) or the lift (doors, ride, arrival).
const RISE = 4 / 22, GO = 0.28, W = 4.2, D = 6.8, T0 = 0.2, BA = [2.3, 4.0], BB = [0.2, 1.9], ZL = -2.0, ZM = -2.0 - 11 * GO;   // ZM = -5.08
const FLOORS = ['G', '2', '3', '4', '5'];
export default {
  setup(ctx) {
    const THREE = ctx.THREE, mat = ctx.mat, M = ctx.M || (c => new THREE.MeshLambertMaterial({ color: c })), T = k => (ctx.t ? ctx.t(k) : k);
    const core = ctx.core || { x: 0, fz: -7.7, W: 4.6 };
    /* shaft origin (front-left outer corner) per floor frame; local x 0..W, local z 0..-D. G: right of the elevator core, door facing the
       lobby's right doorway; upper floors: west strip between the window wall and the west team room, door facing the open floor. */
    const O = n => n === 'G' ? { x: core.x + 4.8, z: core.fz - 0.5 } : { x: core.x + (+n - 1) * 400 - 17.7, z: core.fz + 0.7 };
    ctx.extend(O('G').x - 0.4, O('G').z - D - 0.4, O('G').x + W + 0.4, O('G').z + 0.2);
    const fi = n => FLOORS.indexOf(String(n)), top = FLOORS.length - 1;
    ctx.stairShaft = { O, W, D, hole: [T0, ZL, W - T0, -D + T0], ceilHole: [T0, -T0, W - T0, -D + T0], top: FLOORS[top] };
    const wood = mat.wood, riserM = M(0xe9e1d2), stone = mat.stone || mat.wall, plaster = M(0xcfc6b6), brass = mat.trim, dark = mat.dark;
    const lampM = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
    const built = {}; this.built = built;
    /* geometry for one frame: merged per material */
    const buildFrame = n => {
      if (built[n]) return built[n]; const o = O(n), i = fi(n), list = new Map(), g = new THREE.Group(); g.userData.mod = 'stairs-' + n; ctx.scene.add(g);
      const put = (w, h, d, m, x, y, z, rx = 0) => { const geo = new THREE.BoxGeometry(w, h, d); if (rx) geo.rotateX(rx); geo.translate(o.x + x, y, o.z + z); if (!list.has(m)) list.set(m, []); list.get(m).push(geo.toNonIndexed()); };
      const cyl = (r, h, m, x, y, z, rx = 0) => { const geo = new THREE.CylinderGeometry(r, r, h, 8); if (rx) geo.rotateX(rx); geo.translate(o.x + x, y, o.z + z); if (!list.has(m)) list.set(m, []); list.get(m).push(geo.toNonIndexed()); };
      const rail = (x, y0, z0, y1, z1) => { const L = Math.hypot(y1 - y0, z1 - z0), a = Math.atan2(y1 - y0, -(z1 - z0)); cyl(0.025, L, brass, x, (y0 + y1) / 2 + 0.9, (z0 + z1) / 2, Math.PI / 2 - a);
        for (const [y, z] of [[y0, z0], [y1, z1]]) put(0.03, 0.06, 0.03, brass, x, y + 0.9, z); };
      const segs = []; for (const k of [-1, 0, 1]) if (i + k >= 0 && i + k <= top) segs.push(k);
      for (const k of segs) { const b = 4 * k, flights = i + k < top;
        put(W - 2 * T0, 0.2, -ZL - T0, stone, W / 2, b - 0.1, (ZL - T0) / 2);                                       // floor-level landing
        if (!flights) continue;
        put(W - 2 * T0, 0.2, D - T0 + ZM, stone, W / 2, b + 2 - 0.1, (ZM - D + T0) / 2);                                // mid landing
        for (const [band, up] of [[BA, -1], [BB, 1]]) { const w = band[1] - band[0], cx = (band[0] + band[1]) / 2;
          for (let s = 0; s < 11; s++) { const y = b + (up < 0 ? 0 : 2) + (s + 1) * RISE, z = up < 0 ? ZL - s * GO : ZM + s * GO;   // step s: riser at its front edge, tread on top
            put(w, RISE, 0.03, riserM, cx, y - RISE / 2, up < 0 ? z - 0.015 : z + 0.015);
            put(w, 0.045, GO + 0.03, wood, cx, y - 0.0225, up < 0 ? z - GO / 2 - 0.015 : z + GO / 2 + 0.015);
            put(w, 0.012, 0.03, brass, cx, y - 0.006, up < 0 ? z - 0.02 : z + 0.02); }                                    // nosing strip
          const L = Math.hypot(11 * GO, 2), a = Math.atan2(2, 11 * GO);                                                       // stringer / soffit under the flight
          put(w, 0.16, L, plaster, cx, b + (up < 0 ? 0 : 2) + 1 - 0.18, (ZL + ZM) / 2, up < 0 ? a : -a);
          const y0 = b + (up < 0 ? 0 : 2), y1 = y0 + 2, z0 = up < 0 ? ZL : ZM, z1 = up < 0 ? ZM : ZL;
          rail(band[0] + 0.06, y0, z0, y1, z1); rail(band[1] - 0.06, y0, z0, y1, z1); }
        for (const x of [0.25, W - 0.25]) put(0.04, 0.04, -ZM - D + T0 + 1.5, brass, x, b + 2.9, (ZM - D + T0) / 2);         // landing wall rails
        put(0.14, 0.2, 0.06, dark, W / 2, b + 3.4, -D + T0 + 0.04); put(0.32, 0.1, 0.05, lampM, W / 2, b + 3.4, -D + T0 + 0.09);   // mid-landing sconce
      }
      // shaft walls (stone outside, warm plaster inside), divider between the flights, cap
      const yLo = segs.includes(-1) ? -4.1 : 0, yHi = i < top ? (segs.includes(1) && i + 1 < top ? 8.05 : 4.05 + (i + 1 <= top ? 4 : 0)) : 4.05, H = yHi - yLo, yc = (yLo + yHi) / 2;
      for (const [x, d] of [[T0 / 2, D], [W - T0 / 2, D]]) put(T0, H, d, stone, x, yc, -D / 2);
      put(W, H, T0, stone, W / 2, yc, -D + T0 / 2);
      put(0.4, H, -ZM + ZL, plaster, (BB[1] + BA[0]) / 2, yc, (ZL + ZM) / 2);
      put(W, 0.1, D, plaster, W / 2, yHi, -D / 2);
      // front wall with one doorway per floor in this frame: the own floor is open, the others are closed fire doors
      const DX = [2.45, 3.75];
      for (const k of segs) { const b = 4 * k;
        put(DX[0], 4, T0, stone, DX[0] / 2, b + 2, -T0 / 2); put(W - DX[1], 4, T0, stone, (W + DX[1]) / 2, b + 2, -T0 / 2); put(DX[1] - DX[0], 1.6, T0, stone, (DX[0] + DX[1]) / 2, b + 3.2, -T0 / 2);
        for (const x of DX) put(0.06, 2.4, T0 + 0.06, brass, x, b + 1.2, -T0 / 2); put(DX[1] - DX[0] + 0.06, 0.06, T0 + 0.06, brass, (DX[0] + DX[1]) / 2, b + 2.4, -T0 / 2);
        if (k !== 0) put(DX[1] - DX[0] - 0.04, 2.38, 0.05, M(0x5a4632), (DX[0] + DX[1]) / 2, b + 1.19, -T0 / 2); }
      if (yLo < -0.1) put(W, -0.1 - yLo, T0, stone, W / 2, (yLo - 0.1) / 2, -T0 / 2);
      if (i === 0) put(BB[1] - BB[0], 2.0, 0.12, plaster, (BB[0] + BB[1]) / 2, 1.0, ZL - 0.06);                                   // G: closed under-stair store (no flight down)
      if (i === top) { put(BA[1] - BA[0], 4, 0.12, stone, (BA[0] + BA[1]) / 2, 2, ZL - 0.06);                                     // top floor: roof door, staff only
        put(0.95, 2.1, 0.05, M(0x3b4148), (BA[0] + BA[1]) / 2, 1.05, ZL + 0.01); put(0.04, 0.2, 0.05, brass, (BA[0] + BA[1]) / 2 + 0.36, 1.0, ZL + 0.05); }
      for (const [m, geos] of list) { const mesh = new THREE.Mesh(BufferMerge(THREE, geos), m); mesh.userData.noCollide = 1; mesh.userData.keep = 1; g.add(mesh); geos.forEach(x => x.dispose()); }
      // signs: 'Stairs' + floor over the door outside, floor number inside on each landing, staff-only plate on the roof door
      const sg = ctx.panel(ctx.textCanvas([T('Stairs'), `${T('Floor')} ${n} · ${T('all floors')}`], { w: 640, h: 200, size: 66, body: 40 }), 1.3, 0.4, o.x + (DX[0] + DX[1]) / 2, 3.2, o.z + 0.04, 0, g); sg.material.toneMapped = false; sg.userData.plate = 'Stairs';
      const fl = ctx.panel(ctx.textCanvas([n === 'G' ? 'G' : n], { w: 160, h: 160, size: 110, bg: '#140c22' }), 0.42, 0.42, o.x + W - T0 - 0.02, 1.7, o.z - 1.0, -Math.PI / 2, g); fl.material.toneMapped = false;
      if (i === top) { const so = ctx.panel(ctx.textCanvas([T('Roof'), T('Staff only')], { w: 400, h: 200, size: 64, body: 44 }), 0.6, 0.3, o.x + (BA[0] + BA[1]) / 2, 1.75, o.z + ZL + 0.04, 0, g); so.userData.plate = 'Staff only'; ctx.onClick(so, () => ctx.card(`<h3>${ctx.esc(T('Roof access'))}</h3><p>${ctx.esc(T('Staff only. The stairs go down to every floor.'))}</p>`)); }
      // colliders (2D rects, every height): outer walls, door jambs, divider; G: the store under flight B; top: the roof door wall
      const R = (x0, z0, x1, z1) => ctx.extraCols.push([o.x + Math.min(x0, x1), o.z + Math.min(z0, z1), o.x + Math.max(x0, x1), o.z + Math.max(z0, z1)]);
      ctx.extraCols ||= []; R(0, 0, T0, -D); R(W - T0, 0, W, -D); R(0, -D + T0, W, -D); R(0, 0, DX[0], -T0); R(DX[1], 0, W, -T0); R(BB[1], ZL, BA[0], ZM);
      if (i === 0) R(BB[0], ZL, BB[1], ZL - 0.12); if (i === top) R(BA[0], ZL, BA[1], ZL - 0.12);
      ctx.rebuildColliders?.(); return (built[n] = { g, o });
    };
    ctx.extraCols ||= []; buildFrame('G'); for (const n of FLOORS.slice(1)) buildFrame(n);
    /* ---- height field: local (lx, lz) -> surface heights in the frame of floor index i ---- */
    const segH = (lx, lz, i, k) => { const f = i + k; if (f < 0 || f > top) return null; const b = 4 * k;
      if (lz > ZL) return b; if (f === top) return null;
      if (lz < ZM) return b + 2; if (lx >= BA[0] - 0.05) return b + 2 * (ZL - lz) / (ZL - ZM); if (lx <= BB[1] + 0.05) return b + 2 + 2 * (lz - ZM) / (ZL - ZM); return null; };
    const surf = (n, x, z, y) => { const o = O(n), lx = x - o.x, lz = z - o.z; if (lx < 0 || lx > W || lz > 0.05 || lz < -D) return null; const i = fi(n);
      let best = null; for (const k of [-1, 0, 1]) { const h = segH(lx, lz, i, k); if (h == null) continue; if (best == null || Math.abs(h - y) < Math.abs(best - y)) best = h; } return best; };
    this.surf = surf; this.O = O; this.fi = fi;
    /* player: eye height follows the stairs; frame hand-over in the middle of the flights */
    let py = 0; const FA = () => ctx.floorsApi;
    ctx.groundAt = pos => { const n = ctx.curFloor || 'G', h = surf(n, pos.x, pos.z, py); if (h == null) { py += (0 - py) * 0.5; if (Math.abs(py) < 0.01) py = 0; return py; }
      py = h; const i = fi(n);
      if (py > 2.2 && i < top) hand(n, FLOORS[i + 1], -4, pos); else if (py < -1.8 && i > 0) hand(n, FLOORS[i - 1], 4, pos);
      if (i > 0) FA()?.ensure?.(FLOORS[i - 1]); if (i < top) FA()?.ensure?.(FLOORS[i + 1]);
      return py; };
    const hand = (from, to, dy, pos) => { const a = O(from), b = O(to); pos.x += b.x - a.x; pos.z += b.z - a.z; py += dy; FA()?.hop?.(to); };
    /* ---- agents on the stairs (y follows the pitch; hand-over at the flight ends) and agentControl.travel ---- */
    const flOf = x => (x > 200 ? FLOORS[Math.round(x / 400)] : 'G');
    this.trips = new Map();
    const pt = (n, lx, lz) => { const o = O(n); return new THREE.Vector3(o.x + lx, 0, o.z + lz); };
    const door = n => { const off = n === 'G' ? 0 : (+n - 1) * 400; return new THREE.Vector3(core.x + off, 0, core.fz + 0.9); };
    const travel = (id, to, opt = {}) => {
      const AC = ctx.agentControl, agents = ctx.use('agents'), av = agents?.get(String(id).replace(/^agent:/, '')); to = String(to);
      if (!av || !AC || fi(to) < 0) return false; const from = flOf(av.position.x); if (from === to) return true;
      const d = Math.abs(fi(to) - fi(from)), via = opt.via || (d === 1 ? (Math.random() < 0.6 ? 'stairs' : 'elevator') : (Math.random() < 0.2 ? 'stairs' : 'elevator'));
      const legs = [], hops = [];
      if (via === 'stairs') { const dir = fi(to) > fi(from) ? 1 : -1; let n = from; legs.push(pt(n, 3.1, 0.9), pt(n, 3.1, -1.0));
        while (n !== to) { const nx = FLOORS[fi(n) + dir], landingZ = ZL - 0.45;
          if (dir > 0) { legs.push(pt(n, 3.15, ZL), pt(n, 3.15, ZM - 0.5), pt(n, 1.05, ZM - 0.5), pt(n, 1.05, landingZ)); const h = pt(nx, 1.05, landingZ); h.hopFrom = legs[legs.length - 1]; hops.push(h); legs.push(h, pt(nx, 1.05, -1.0)); }
          else { legs.push(pt(n, 1.05, -1.0), pt(n, 1.05, landingZ)); const h0 = legs[legs.length - 1]; const h = pt(nx, 1.05, landingZ); h.hopFrom = h0; h.dy = 4; hops.push(h); legs.push(h, pt(nx, 1.05, ZM - 0.5), pt(nx, 3.15, ZM - 0.5), pt(nx, 3.15, ZL), pt(nx, 3.1, -1.0)); }
          n = nx; }
        legs.push(pt(to, 3.1, 0.9)); }
      else { const a = door(from), b = door(to); legs.push(a); b.hopFrom = a; b.ride = 2.5 + d * 0.8; hops.push(b); legs.push(b, b.clone().setZ(b.z + 1.2)); }
      if (!AC.moveTo(id, { zone: 'lobby', x: 0, z: 0 })) return false;
      const u = av.userData, fin = legs[legs.length - 1]; u.target = fin; u._tgt = fin; u.path = legs.slice(); u.goalSeat = null; u.faceRot = null;
      ctx.routeAgentPath?.(av);   // A* the room/landing legs; the marked floor handoffs stay explicit.
      this.trips.set(av, { hops, then: opt.then ?? 'home', fin, to, via, y: 0, t0: performance.now() / 1000 }); return via; };
    this.travel = travel; ctx.stairsTravel = travel;
    const reg = () => { const O_ = window.__ewsOffice; if (O_?.agents) { O_.agents.travel = travel; O_.stairs = () => ({ floor: ctx.curFloor || 'G', y: +py.toFixed(2), shafts: Object.fromEntries(FLOORS.map(n => [n, O(n)])), trips: [...this.trips].map(([a, t]) => ({ id: a.userData.a?.id, to: t.to, via: t.via, left: a.userData.path?.length || 0 })) }); } else setTimeout(reg, 500); }; reg();
    /* lobby + hall wayfinding: a proper directory, one line per floor (replaces the crammed 'Elevator ↓ 2 · Games 3 ...' board) */
    this.ctx = ctx;
  },
  onFrame(dt) {
    const ctx = this.ctx; if (!ctx || !this.trips) return; const agents = ctx.use('agents'); if (!agents) return; const t = performance.now() / 1000;
    for (const [av, tr] of this.trips) { const u = av.userData;
      u.serverAt = t;   // keep world-agents from releasing the agent mid-trip
      const h = tr.hops[0];
      if (h && u.path && !u.path.includes(h.hopFrom) && Math.hypot(av.position.x - h.hopFrom.x, av.position.z - h.hopFrom.z) < 0.12) {
        av.position.x = h.x; av.position.z = h.z; tr.y += h.dy ? h.dy : (h.ride ? 0 : -4); tr.hops.shift();
        if (h.ride) { tr.rideUntil = t + h.ride; av.visible = false; } }
      if (tr.rideUntil) { if (t < tr.rideUntil) { av.visible = false; if (u.path?.[0] === h) {} continue; } tr.rideUntil = 0; av.visible = true; }
      const n = av.position.x > 200 ? ['G', '2', '3', '4', '5'][Math.round(av.position.x / 400)] : 'G', s = this.surf(n, av.position.x, av.position.z, tr.y);
      tr.y = s == null ? 0 : s; av.position.y = tr.y;
      if (!(u.path && u.path.length) && Math.hypot(av.position.x - tr.fin.x, av.position.z - tr.fin.z) < 0.1) { av.position.y = 0; this.trips.delete(av);
        if (tr.then === 'home' && u.home && Math.abs(u.home.x - av.position.x) < 200) u.target = u.home; ctx.agentControl?.release?.(u.a?.id); } }
  },
};
function BufferMerge(THREE, geos) {   /* tiny non-indexed merge (position + normal + uv) so this module has no extra import */
  let n = 0; for (const g of geos) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of geos) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.computeBoundingSphere(); return out;
}
