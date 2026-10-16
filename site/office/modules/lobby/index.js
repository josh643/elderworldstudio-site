// Lobby (Fólkvangr): brand banner + logo + about plaque + signposts. Content from site.json (brand).
export default {
  setup(ctx, cfg, [x, z]) {
    const { site, box, M, mat, panel, textCanvas, kit } = ctx;
    box(8, 0.05, 6, ctx.rug ? ctx.rug(0x8a3040) : M(0x5a1f2c), x, 0.02, z + 2);
    // back wall feature: framed logo mounted on the wall, brand banner, then the directory (wayfinding adds tiles via ctx.directory)
    box(7.4, 5.4, 0.12, mat.dark || M(0x1a1220), x, 2.7, z + 9.82);
    box(2.25, 2.25, 0.06, M(0xb08d3c), x, 4.25, z + 9.74);
    panel(ctx.image(site.brand.logo), 2.0, 2.0, x, 4.25, z + 9.70, Math.PI);
    panel(textCanvas([site.brand.name, site.brand.tagline], { w: 1280, h: 250, size: 92 }), 4.9, 0.96, x, 2.75, z + 9.74, Math.PI);
    ctx.directoryAt = { x, y: 1.85, z: z + 9.72, ry: Math.PI };
    // pillars only in room corners, flush to the walls (the east side opens onto the services hall, so none there)
    for (const pz of [-3.6, 9.4]) box(0.5, 4.2, 0.5, mat.stone, x - 7.7, 2.1, z + pz);
    const about = panel(textCanvas(['Welcome to Fólkvangr', site.brand.about, 'Freyja at the desk can show you around.'], { w: 1024, h: 512, size: 58 }), 4, 2, x - 6, 2, z + 4, Math.PI / 2);
    ctx.onClick(about, () => ctx.card(`<h3>${ctx.esc(site.brand.name)}</h3><p>${ctx.esc(site.brand.about)}</p><p>Our studio is run day to day by a team of AI agents with Norse names, overseen by our founder. Walk through the halls to see what they're working on right now.</p>`));
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 2.4], [x, 2.55, z + 9.7], 'Lobby');   // spawn framed on the brand wall
  },
};
