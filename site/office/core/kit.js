// Snap-together kit pieces. Every piece is a pure function of (ctx, options) and returns its THREE.Group.
// Grid unit = 1 m. Rooms snap on their centre; walls/doors are optional per side.
export function room(ctx, { x = 0, z = 0, w = 10, d = 8, floor = 0x2a2236, walls = '', title, sub }) {
  const { THREE, box, M } = ctx, g = new THREE.Group(); g.position.set(x, 0, z);
  box(w - 0.2, 0.04, d - 0.2, ctx.rug ? ctx.rug(new ctx.THREE.Color(floor).multiplyScalar(2.2).getHex()) : M(floor), 0, 0.02, 0, g);
  const W = (lx, lz, len, rot) => { const m = box(len, 3, 0.2, ctx.mat.wall, lx, 1.5, lz, g); m.rotation.y = rot; };
  if (walls.includes('n')) W(0, -d / 2, w, 0); if (walls.includes('s')) W(0, d / 2, w, 0);
  if (walls.includes('w')) W(-w / 2, 0, d, Math.PI / 2); if (walls.includes('e')) W(w / 2, 0, d, Math.PI / 2);
  if (title) ctx.panel(ctx.textCanvas([title, sub || ''], { w: 768, h: 180, size: 60 }), 3.6, 0.85, 0, 3.4, d / 2 - 0.4, 0, g);
  ctx.scene.add(g); ctx.extend(x - w / 2, z - d / 2, x + w / 2, z + d / 2); return g;
}
export function corridor(ctx, { x1, z1, x2, z2, width = 3 }) {
  const { box, M } = ctx, l = Math.hypot(x2 - x1, z2 - z1), m = box(l, 0.03, width, M(0x332a40), (x1 + x2) / 2, 0.015, (z1 + z2) / 2);
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
    neck: new T.BoxGeometry(0.04, 0.22, 0.03), foot: new T.BoxGeometry(0.22, 0.012, 0.16), tleg: new T.BoxGeometry(0.05, 0.72, 0.05) };
  return G; }
export function desk(ctx, x, z, parent) { const T = ctx.THREE, g0 = shared(ctx), m = ctx.mat, par = parent || ctx.scene;
  const mesh = (geo, mt, px, py, pz, ry = 0) => { const o = new T.Mesh(geo, mt); o.position.set(px, py, pz); o.rotation.y = ry; par.add(o); return o; };
  const ao = mesh(g0.aoGeo, g0.ao, x, 0.045, z - 0.3); ao.scale.set(2.0, 1, 2.0);
  const d = ctx.box(1.4, 0.04, 0.7, m.wood, x, 0.74, z - 0.6, parent);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.28, 0.28]) mesh(g0.tleg, m.rack, x + sx, 0.36, z - 0.6 + sz);
  ctx.box(1.26, 0.35, 0.02, m.wood, x, 0.52, z - 0.9, parent);
  // chair
  const fab = m.fabric || m.dark; mesh(g0.lift, m.rack, x, 0.24, z + 0.1);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, l = mesh(g0.leg, m.rack, x + Math.sin(a) * 0.15, 0.07, z + 0.1 + Math.cos(a) * 0.15, a + Math.PI / 2); mesh(g0.caster, m.dark, x + Math.sin(a) * 0.29, 0.03, z + 0.1 + Math.cos(a) * 0.29, a); }
  mesh(g0.seat, fab, x, 0.46, z + 0.1); mesh(g0.back, fab, x, 0.8, z + 0.36).rotation.x = -0.12;
  // monitor + keyboard
  mesh(g0.foot, m.rack, x, 0.766, z - 0.82); mesh(g0.neck, m.rack, x, 0.87, z - 0.84);
  mesh(g0.bezel, m.dark, x, 1.08, z - 0.83); const mon = mesh(g0.screen, m.dark, x, 1.08, z - 0.813);
  mesh(g0.kb, m.dark, x, 0.77, z - 0.5);
  return { desk: d, monitor: mon }; }
export function pedestal(ctx, x, z, gold, parent) { return ctx.box(0.7, 1, 0.7, gold ? ctx.mat.trim : ctx.mat.stone, x, 0.5, z, parent); }
