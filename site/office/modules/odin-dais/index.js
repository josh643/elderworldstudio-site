// Odin's dais (review stage) + release gate (released stage). Provides 'dais' and 'gate' positions.
export default {
  setup(ctx, cfg, [x, z]) {
    const { box, mat, roster } = ctx, A = ctx.use('avatar');
    box(3, 0.4, 3, mat.stone, x, 0.2, z); box(3.1, 0.06, 3.1, mat.trim, x, 0.42, z);
    const s = roster.subceo, o = A.make({ ...s, female: 0 }, 0x8a1c2c, () => ctx.card(`<h3>${ctx.esc(s.name)}</h3><p>${ctx.esc(s.role)}: makes the day-to-day calls and reviews work before it ships.</p>`));
    o.position.set(x, 0.42, z); o.rotation.y = 0; o.userData.home = o.position.clone(); o.userData.homeRot = 0; ctx.scene.add(o);
    const g = new ctx.THREE.Group(); box(0.4, 3.5, 0.4, mat.trim, -1.6, 1.75, 0, g); box(0.4, 3.5, 0.4, mat.trim, 1.6, 1.75, 0, g); box(3.6, 0.4, 0.4, mat.trim, 0, 3.5, 0, g);
    g.position.set(x + 8, 0, z); ctx.scene.add(g); ctx.kit.sign(ctx, 'Release Gate', x + 8, 4.2, z);
    ctx.provide('dais', new ctx.THREE.Vector3(x + 1.6, 0, z + 1.2)); ctx.provide('gate', new ctx.THREE.Vector3(x + 8, 0, z + 1));
    ctx.extend(x - 3, z - 3, x + 11, z + 3);
  },
};
