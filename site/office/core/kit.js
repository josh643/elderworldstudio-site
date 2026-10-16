// Snap-together kit pieces. Every piece is a pure function of (ctx, options) and returns its THREE.Group.
// Grid unit = 1 m. Rooms snap on their centre; walls/doors are optional per side.
export function room(ctx, { x = 0, z = 0, w = 10, d = 8, floor = 0x2a2236, walls = '', title, sub }) {
  const { THREE, box, M } = ctx, g = new THREE.Group(); g.position.set(x, 0, z);
  box(w - 0.2, 0.04, d - 0.2, M(floor), 0, 0.02, 0, g);
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
export function desk(ctx, x, z, parent) { const d = ctx.box(1.4, 0.75, 0.7, ctx.mat.wood, x, 0.375, z - 0.6, parent); const mon = ctx.box(0.8, 0.5, 0.05, ctx.mat.dark, x, 1.05, z - 0.85, parent); return { desk: d, monitor: mon }; }
export function pedestal(ctx, x, z, gold, parent) { return ctx.box(0.7, 1, 0.7, gold ? ctx.mat.trim : ctx.mat.stone, x, 0.5, z, parent); }
