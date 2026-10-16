// Merch display: one plinth per product on the merch page; links to the shop when the site has buy links.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc } = ctx;
    site.merch.forEach((m, i) => {
      const x = x0 + (i % 3) * 3, z = z0 - Math.floor(i / 3) * 3.2; box(1, 1, 1, mat.wood, x, 0.5, z);
      const p = panel(ctx.image(m.img), 1.3, 1.3, x, 1.75, z); p.material.side = ctx.THREE.DoubleSide;
      const pl = panel(textCanvas([m.title, `${m.price} · ${m.tag}`], { w: 768, h: 160, size: 40 }), 1.9, 0.4, x, 0.75, z + 0.52);
      const open = () => ctx.card(`<h3>${esc(m.title)}</h3><p><b>${esc(m.price)}</b> · ${esc(m.tag)}</p><img src="${esc(m.img)}" alt=""><p>${esc(m.text)}</p><div class="row">${ctx.btn({ href: m.href, label: m.href.startsWith('http') ? 'Buy' : 'View on the merch page' })}</div>`);
      [p, pl].forEach(o => ctx.onClick(o, open));
    });
    ctx.onClick(panel(textCanvas(['Studio Merch', 'Wear the worlds we build'], { w: 768, h: 200, size: 62 }), 4, 1, x0 + 3, 3.4, z0 + 0.8), () => ctx.card(`<h3>Studio Merch</h3><p>Tees, hoodies, mugs and stickers.</p><div class="row">${ctx.btn({ href: '/merch/', label: 'Open the merch page' })}</div>`));
    ctx.extend(x0 - 1, z0 - Math.ceil(site.merch.length / 3) * 3.2, x0 + 8, z0 + 1);
    ctx.spot('merch', [x0 + 3, 1.6, z0 + 4], [x0 + 3, 1.2, z0 - 2], 'Merch');
  },
};
