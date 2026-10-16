// Devlog screen: big wall screen linking the YouTube channel (site.json devlog).
export default {
  setup(ctx, cfg, [x, z]) {
    const s = ctx.box(3.8, 2.2, 0.12, ctx.mat.dark, x, 1.55, z); s.rotation.y = -Math.PI / 2;   /* screen at eye height */
    const p = ctx.panel(ctx.textCanvas(['▶ Devlogs', `Watch us build our games on YouTube. ${ctx.verb} to open the channel.`], { w: 1024, h: 590, bg: '#1b0b0b', size: 90, body: 52 }), 3.6, 2.07, x - 0.08, 1.55, z, -Math.PI / 2);
    ctx.onClick(p, () => ctx.card(`<h3>Devlogs</h3><p>Short videos of how we build our games.</p><div class="row">${ctx.btn({ href: ctx.site.devlog.href, label: 'Open YouTube' })}</div>`));
    /* devlog lounge in front of the screen: rug, two sofas, coffee table, plants, floor lamp */
    { const { box, mat, THREE: T } = ctx, fab = mat.fabric || mat.dark, lx = x - 3.2;
      box(4.4, 0.03, 4.2, ctx.rug ? ctx.rug(0x6a4a3a) : fab, lx, 0.03, z);
      for (const sz of [-1, 1]) { box(2.2, 0.42, 0.85, fab, lx, 0.21, z + sz * 1.55); box(2.2, 0.5, 0.2, fab, lx, 0.6, z + sz * 1.9); for (const sx of [-1, 1]) box(0.2, 0.6, 0.85, fab, lx + sx * 1.1, 0.3, z + sz * 1.55); }
      box(1.2, 0.05, 0.7, mat.wood, lx, 0.42, z); for (const sx of [-0.5, 0.5]) for (const sz of [-0.28, 0.28]) box(0.05, 0.4, 0.05, mat.rack, lx + sx, 0.2, z + sz);
      const pot = new T.MeshStandardMaterial({ color: 0xa0593a, roughness: 0.9 }), leaf = new T.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 });
      for (const sz of [-2.3, 2.3]) { const p = new T.Mesh(new T.CylinderGeometry(0.25, 0.2, 0.5, 12), pot); p.position.set(x - 0.6, 0.25, z + sz); ctx.scene.add(p); const b = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), leaf); b.position.set(x - 0.6, 0.9, z + sz); ctx.scene.add(b); } }
    ctx.extend(x - 4, z - 3, x + 0.5, z + 3);
    ctx.spot('devlog', [x - 7, 1.6, z], [x, 2, z]);
  },
};
