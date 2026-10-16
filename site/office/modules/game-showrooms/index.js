// One showroom bay per game in site.json (games page). New game on the site = new bay here, no code change.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc } = ctx, bay = cfg.bay || 4;
    const show = g => ctx.card(`<h3>${esc(g.title)}</h3><p><b>${esc(g.tag)}</b></p>${g.img ? `<img src="${esc(g.img)}" alt="${esc(g.alt)}">` : ''}<p>${esc(g.text)}</p><div class="row">${g.buttons.map(ctx.btn).join('') || '<span class="ob">Coming soon</span>'}<a class="ob" href="/games/">All games</a></div>`);
    site.games.forEach((g, i) => {
      const side = i % 2 ? 1 : -1, x = x0 - Math.floor(i / 2) * bay - 2, z = z0 + side * 4.2, fz = z + side * 1.1, ry = side > 0 ? Math.PI : 0;
      box(3.4, 0.3, 2.4, mat.stone, x, 0.15, z);
      box(3.2, 2.2, 0.1, mat.trim, x, 2.1, fz + side * 0.06);
      const art = panel(g.img ? ctx.image(g.img) : textCanvas([g.title], { w: 512, h: 288, size: 48 }), 3, 1.7, x, 2.2, fz, ry);
      const plate = panel(textCanvas([g.title, g.tag], { w: 768, h: 160, size: 52 }), 3, 0.62, x, 0.9, fz - side * 0.02, ry);
      const ped = ctx.kit.pedestal(ctx, x, z - side * 0.3, g.status === 'live'); ped.position.y = 0.8;
      [art, plate, ped].forEach(o => ctx.onClick(o, () => show(g)));
    });
    const len = Math.ceil(site.games.length / 2) * bay + 2; ctx.kit.corridor(ctx, { x1: x0 + 4, z1: z0, x2: x0 - len, z2: z0, width: 3 });
    ctx.extend(x0 - len - 1, z0 - 6, x0 + 4, z0 + 6);
    ctx.spot('games', [x0 - 2, 1.6, z0], [x0 - 12, 1.6, z0], 'Games');
  },
};
