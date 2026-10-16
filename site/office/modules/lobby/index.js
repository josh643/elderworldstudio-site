// Lobby (Fólkvangr): brand banner + logo + about plaque + signposts. Content from site.json (brand).
export default {
  setup(ctx, cfg, [x, z]) {
    const { site, box, M, mat, panel, textCanvas, kit } = ctx;
    box(8, 0.05, 6, M(0x5a1f2c), x, 0.02, z + 2);
    panel(ctx.image(site.brand.logo), 3, 3, x, 4.6, z + 9.7, Math.PI);
    panel(textCanvas([site.brand.name, site.brand.tagline], { w: 1024, h: 220, size: 70 }), 8, 1.7, x, 2.4, z + 9.7, Math.PI);
    for (let i = -3; i <= 3; i++) box(0.5, 4.2, 0.5, mat.stone, x + i * 4, 2.1, z + 9.6);
    const about = panel(textCanvas(['Welcome to Fólkvangr', site.brand.about, 'Freyja at the desk can show you around.'], { w: 1024, h: 512, size: 58 }), 4, 2, x - 6, 2, z + 4, Math.PI / 2);
    ctx.onClick(about, () => ctx.card(`<h3>${ctx.esc(site.brand.name)}</h3><p>${ctx.esc(site.brand.about)}</p><p>Our studio is run day to day by a team of AI agents with Norse names, overseen by our founder. Walk through the halls to see what they're working on right now.</p>`));
    kit.sign(ctx, '← Game Showrooms', x - 4, 3.2, z - 3); kit.sign(ctx, 'Services & Merch →', x + 4, 3.2, z - 3); kit.sign(ctx, '↑ Team Halls', x, 3.2, z + 0.6);
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 7.5], [x, 1.4, z - 2], 'Lobby');
  },
};
