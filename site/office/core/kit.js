import * as PL from './plants.js?v=1';
import { chairs } from './chairs.js?v=1';
export { chairs };
// Snap-together kit pieces. Every piece is a pure function of (ctx, options) and returns its THREE.Group.
// Grid unit = 1 m. Rooms snap on their centre; walls/doors are optional per side.
export function room(ctx, { x = 0, z = 0, w = 10, d = 8, floor = 0x2a2236, walls = '', title, sub, enclose = false, doorX = 0, noExtend = false }) {
  const { THREE, box, M } = ctx, g = new THREE.Group(); g.position.set(x, 0, z);
  box(w - 0.2, 0.04, d - 0.2, ctx.rug ? ctx.rug(new ctx.THREE.Color(0x8a8f9c).lerp(new ctx.THREE.Color(floor).multiplyScalar(3), 0.18).getHex()) : M(floor), 0, 0.02, 0, g);
  const W = (lx, lz, len, rot) => { const m = box(len, 3, 0.2, ctx.mat.wall, lx, 1.5, lz, g); m.rotation.y = rot; };
  if (walls.includes('n')) W(0, -d / 2, w, 0); if (walls.includes('s')) W(0, d / 2, w, 0);
  if (walls.includes('w')) W(-w / 2, 0, d, Math.PI / 2); if (walls.includes('e')) W(w / 2, 0, d, Math.PI / 2);
  // team accent strip at the room's front edge (the carpet itself is neutral office tiles)
  if (enclose) {   /* walled room v2 (Joshua 2026-10-16: "no more bare boxes"): inset walls (neighbours sit back to back), wood
       wainscot + brass rail on both faces of the solid walls, a glass storefront on the south side (wood base, glass, brass
       mullions, dark-wood header with the crest + team name), a framed doorway and a halo pendant inside. Every part uses shared
       materials (glass is flagged batch), so a room adds ~0 draw calls once the engine batches the scene. */
    const t = 0.12, h = 3, hx = w / 2 - t / 2, hz = d / 2 - t / 2, dw = 1.6, T = THREE, mt = ctx.mat;
    const K = (ctx._roomKit ||= { glass: new T.MeshBasicMaterial({ color: 0xbfdcea, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }),
      hide: new T.MeshBasicMaterial({ visible: false }), dk: M(0x3a2618), ring: new T.MeshBasicMaterial({ color: 0xffe6b8, toneMapped: false }), ringG: new T.TorusGeometry(1.0, 0.04, 8, 48).rotateX(Math.PI / 2) });
    const P = (len, lx, lz, rot) => { const m = box(len, h, t, mt.wall, lx, h / 2, lz, g); m.rotation.y = rot; m.userData.wall = 1; return m; };
    const wains = (len, lx, lz, rot) => { for (const sd of [-1, 1]) { const o = rot ? [lx + sd * (t / 2 + 0.016), lz] : [lx, lz + sd * (t / 2 + 0.016)];
      const a = box(len, 1.0, 0.03, mt.wood, o[0], 0.5, o[1], g); a.rotation.y = rot; a.userData.noCollide = 1; const b = box(len, 0.05, 0.045, mt.trim, o[0], 1.02, o[1], g); b.rotation.y = rot; b.userData.noCollide = 1; } };
    P(w, 0, -hz, 0); wains(w - 0.3, 0, -hz, 0); P(d, -hx, 0, Math.PI / 2); wains(d - 0.3, -hx, 0, Math.PI / 2); P(d, hx, 0, Math.PI / 2); wains(d - 0.3, hx, 0, Math.PI / 2);
    const dx = doorX, L = w / 2 + dx - dw / 2, Rr = w / 2 - dx - dw / 2;   /* doorway centre can be offset (doorX) */
    const front = (a, b) => { const len = b - a, c = (a + b) / 2; if (len < 0.05) return;
      box(len, 0.9, t, mt.wood, c, 0.45, hz, g); box(len, 0.04, t + 0.04, mt.trim, c, 0.9, hz, g).userData.noCollide = 1;   // wood base + brass sill
      const gl = new T.Mesh(new T.PlaneGeometry(len, 1.6), K.glass); gl.position.set(c, 1.7, hz); gl.userData.noCollide = 1; gl.userData.batch = 1; gl.userData.dn = 'glass'; g.add(gl);
      box(len, 0.5, t, K.dk, c, 2.75, hz, g); box(len, 0.04, t + 0.04, mt.trim, c, 2.5, hz, g).userData.noCollide = 1;     // dark-wood header
      const n = Math.max(1, Math.round(len / 1.5)); for (let i = 0; i <= n; i++) box(0.05, 1.6, t + 0.02, mt.trim, a + len * i / n, 1.7, hz, g).userData.noCollide = 1;   // mullions
      const cb = box(len, h, t, K.hide, c, h / 2, hz, g); cb.userData.keep = 1; };   /* invisible blocker: the glass is solid to walk into */
    front(-w / 2, -w / 2 + L); front(w / 2 - Rr, w / 2);
    box(dw, h - 2.3, t, K.dk, dx, 2.3 + (h - 2.3) / 2, hz, g);   /* dark-wood lintel over the doorway */
    for (const s of [-1, 1]) box(0.09, 2.36, t + 0.06, mt.trim, dx + s * (dw / 2 + 0.045), 1.18, hz, g);   /* brass door frame */
    box(dw + 0.18, 0.07, t + 0.06, mt.trim, dx, 2.36, hz, g);
    { const r = new T.Mesh(K.ringG, K.ring); r.position.set(0, 2.85, 0); r.userData.noCollide = 1; g.add(r); for (let k = 0; k < 3; k++) { const an = k * 2.094; box(0.008, 0.15, 0.008, mt.dark, Math.cos(an), 2.93, Math.sin(an), g).userData.noCollide = 1; } }
    if (title) { const fz = d / 2 + 0.012, sx = dx;   /* header signage: crest + team name over the doorway, both faces lit (unlit materials) */
      const pl = ctx.panel(ctx.textCanvas([title, sub || ''], { w: 768, h: 192, size: 64 }), 1.6, 0.4, sx + 0.25, 2.75, fz, 0, g); pl.userData.plate = title;
      if (ctx.site?.brand?.logo) { const lg = ctx.panel(ctx.image(ctx.site.brand.logo), 0.42, 0.42, sx - 0.85, 2.75, fz, 0, g); lg.material.toneMapped = false; lg.userData.label = title + ' crest'; } }
  } else if (title) { const pl = ctx.panel(ctx.textCanvas([title, sub || ''], { w: 768, h: 192, size: 64 }), 1.5, 0.375, 0, 2.62, d / 2 + 0.012, 0, g); pl.userData.plate = title; }
  ctx.scene.add(g); if (!noExtend) ctx.extend(x - w / 2, z - d / 2, x + w / 2, z + d / 2); return g;   /* noExtend: rooms on upper floors (x + 400 n) must not stretch the ground-floor shell */
}
export function corridor(ctx, { x1, z1, x2, z2, width = 3 }) {
  const { box, M } = ctx, l = Math.hypot(x2 - x1, z2 - z1), m = box(l, 0.03, width, ctx.mat.floor, (x1 + x2) / 2, 0.015, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); ctx.extend(Math.min(x1, x2) - width, Math.min(z1, z2) - width, Math.max(x1, x2) + width, Math.max(z1, z2) + width); return m;
}
export function sign(ctx, text, x, y, z, ry = 0) { return ctx.panel(ctx.textCanvas([text], { w: 512, h: 128, size: 56 }), 2.4, 0.6, x, y, z, ry); }
// Desk station: wood top on legs, modesty panel, office chair (5-star base, gas lift, cushioned seat/back),
// slim monitor on a stand, keyboard, and a soft contact-shadow blob (fake AO, no shadow maps on phones).
let G = null;
function shared(ctx) { if (G) return G; const T = ctx.THREE;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const ao = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false });
  const cyl = (rt, rb, h, n = 12) => new T.CylinderGeometry(rt, rb, h, n);
  G = { ao, aoGeo: new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), lift: cyl(0.025, 0.025, 0.36), leg: new T.BoxGeometry(0.3, 0.025, 0.04), caster: cyl(0.025, 0.025, 0.03, 8).rotateZ(Math.PI / 2),
    seat: new T.CylinderGeometry(0.26, 0.25, 0.08, 20), back: new T.BoxGeometry(0.44, 0.5, 0.07), screen: new T.PlaneGeometry(0.62, 0.35), bezel: new T.BoxGeometry(0.66, 0.39, 0.03), kb: new T.BoxGeometry(0.44, 0.02, 0.14),
    neck: new T.BoxGeometry(0.04, 0.22, 0.03), foot: new T.BoxGeometry(0.22, 0.012, 0.16), tleg: new T.BoxGeometry(0.05, 0.72, 0.05),
    mouse: new T.BoxGeometry(0.06, 0.025, 0.1), mug: cyl(0.04, 0.035, 0.1, 14), paper: new T.BoxGeometry(0.21, 0.03, 0.3), book: new T.BoxGeometry(0.17, 0.02, 0.24), pen: cyl(0.005, 0.005, 0.14, 6).rotateZ(Math.PI / 2) };
  const S = (c, r = 0.6, mt = 0) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
  G.mats = { paper: S(0xf2efe6, 0.9), mug: [S(0xd9b45a, 0.4, 0.2), S(0xf0ece4, 0.35), S(0x2c3e66, 0.4), S(0x8a1c2c, 0.4)], book: [S(0x1d2a44, 0.7), S(0x6b2a2a, 0.7), S(0x2f4a3a, 0.7)], pen: S(0x111111, 0.4) };
  return G; }
export function desk(ctx, x, z, parent) { const T = ctx.THREE, g0 = shared(ctx), m = ctx.mat, par = parent || ctx.scene;
  const mesh = (geo, mt, px, py, pz, ry = 0) => { const o = new T.Mesh(geo, mt); o.position.set(px, py, pz); o.rotation.y = ry; par.add(o); return o; };
  const ao = mesh(g0.aoGeo, g0.ao, x, 0.045, z - 0.3); ao.scale.set(2.0, 1, 2.0); ao.userData.batch = 1;
  const d = ctx.box(1.4, 0.04, 0.7, m.wood, x, 0.74, z - 0.6, parent); (ctx.desks ||= []).push([x, z]);
  /* desk frame (v31): sled legs (post + foot + top rail) instead of four sticks, darker edge band on the top, and a
     three-drawer pedestal on the left that clears the seated agent's knees (inner face 0.29 m from the seat centre) */
  for (const sx of [-0.66, 0.66]) { ctx.box(0.05, 0.7, 0.05, m.rack, x + sx, 0.37, z - 0.6, parent); ctx.box(0.05, 0.03, 0.64, m.rack, x + sx, 0.015, z - 0.6, parent); ctx.box(0.05, 0.03, 0.6, m.rack, x + sx, 0.705, z - 0.6, parent); }
  ctx.box(1.4, 0.012, 0.012, m.dark, x, 0.735, z - 0.25, parent);
  { const px = x - 0.45, pz = z - 0.62; ctx.box(0.32, 0.62, 0.5, m.rack, px, 0.34, pz, parent);
    for (const [y, h] of [[0.57, 0.12], [0.43, 0.13], [0.2, 0.3]]) { ctx.box(0.3, h, 0.012, m.wood, px, y, pz + 0.255, parent); ctx.box(0.12, 0.012, 0.02, m.trim || m.rack, px, y + h / 2 - 0.03, pz + 0.27, parent); } }
  ctx.box(1.26, 0.35, 0.02, m.wood, x, 0.52, z - 0.9, parent);
  /* chair: one instance of the shared InstancedMesh chair (core/chairs.js); it rolls out, swivels and tucks in for its sitter */
  const seat = chairs(ctx).add(new T.Vector3(x, 0, z), Math.PI, { aisle: 1.0 });
  // monitor + keyboard
  mesh(g0.foot, m.rack, x, 0.766, z - 0.82); mesh(g0.neck, m.rack, x, 0.87, z - 0.84);
  mesh(g0.bezel, m.dark, x, 1.08, z - 0.83); const mon = mesh(g0.screen, m.dark, x, 1.08, z - 0.813); mon.userData.keep = 1; (ctx.screens ||= []).push(mon);
  /* PR #6 anchors (seat centre z+0.1, agent faces -z, right = +x): keyboard 0.58 m ahead, 0.095 m right; mouse 0.29 m right of it; mug 0.40 ahead, 0.26 right */
  const kb = mesh(g0.kb, m.dark, x + 0.095, 0.77, z - 0.48); kb.userData.anchor = 'keyboard';
  // desk clutter (varied per desk, all batched into a handful of draw calls): mouse, mug, paper stack, notebook, pen
  const v = (Math.abs(Math.round(x * 7 + z * 13)) % 97), M2 = g0.mats; mesh(g0.mouse, m.dark, x + 0.385, 0.765, z - 0.48);
  mesh(g0.mug, M2.mug[v % 4], x + 0.26, 0.81, z - 0.30);
  if (v % 3) mesh(g0.paper, M2.paper, x + (v % 2 ? -0.5 : 0.48), 0.775 + (v % 5) * 0.004, z - 0.55, (v % 7) * 0.1 - 0.3);
  if (v % 4 !== 1) { const b = mesh(g0.book, M2.book[v % 3], x - 0.28, 0.77, z - 0.38, 0.2 - (v % 5) * 0.08); mesh(g0.pen, M2.pen, x - 0.26, 0.785, z - 0.38, 0.4); }
  return { desk: d, monitor: mon, seat }; }
export function pedestal(ctx, x, z, gold, parent) { return ctx.box(0.7, 1, 0.7, gold ? ctx.mat.trim : ctx.mat.stone, x, 0.5, z, parent); }
/* window with a baked view (sky, lake, far campus treeline): one shared texture, unlit, wood frame + mullions. Low-tier safe. */
let VIEW = null;
export function viewTex(ctx) {
  if (VIEW) return VIEW; const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#9cc7ea'; g.fillRect(0, 0, 512, 320);   /* painted by core/daynight.js drawView() for the current time of day */
  VIEW = new ctx.THREE.CanvasTexture(c); VIEW.colorSpace = ctx.THREE.SRGBColorSpace; return VIEW;
}
export function windowPane(ctx, x, y, z, ry, w = 2.2, h = 1.5, parent) {
  const T = ctx.THREE, G = new T.Group(); G.position.set(x, y, z); G.rotation.y = ry; (parent || ctx.scene).add(G);
  const v = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: viewTex(ctx), toneMapped: false })); v.position.z = 0.005; G.add(v); v.userData.noCollide = 1;
  const fr = ctx.mat.wood; ctx.box(w + 0.12, 0.08, 0.06, fr, 0, h / 2 + 0.04, 0.02, G); ctx.box(w + 0.12, 0.1, 0.12, fr, 0, -h / 2 - 0.05, 0.05, G);
  for (const sx of [-1, 1]) ctx.box(0.06, h, 0.06, fr, sx * (w / 2 + 0.03), 0, 0.02, G); ctx.box(0.04, h, 0.03, fr, 0, 0, 0.02, G); ctx.box(w, 0.04, 0.03, fr, 0, h * 0.18, 0.02, G);
  return G;
}
export function plant(ctx, x, z, s = 1, parent) { return PL.place(ctx, x, z, s, parent); }   /* unique species per plant (core/plants.js) */
