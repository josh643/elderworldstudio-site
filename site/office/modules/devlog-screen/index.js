// Devlog screen: big wall screen linking the YouTube channel (site.json devlog).
export default {
  setup(ctx, cfg, [x, z]) {
    const s = ctx.box(5, 2.8, 0.15, ctx.mat.dark, x, 2.2, z); s.rotation.y = -Math.PI / 2;
    const p = ctx.panel(ctx.textCanvas(['▶ Devlogs', 'Watch us build our games on YouTube. Tap to open the channel.'], { w: 1024, h: 560, bg: '#1b0b0b', size: 80 }), 4.7, 2.55, x - 0.1, 2.2, z, -Math.PI / 2);
    ctx.onClick(p, () => ctx.card(`<h3>Devlogs</h3><p>Short videos of how we build our games.</p><div class="row">${ctx.btn({ href: ctx.site.devlog.href, label: 'Open YouTube' })}</div>`));
    ctx.extend(x - 4, z - 3, x + 0.5, z + 3);
    ctx.spot('devlog', [x - 7, 1.6, z], [x, 2, z]);
  },
};
