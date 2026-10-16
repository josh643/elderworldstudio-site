// Lobby (Fólkvangr): brand banner + logo + about plaque + signposts. Content from site.json (brand).
export default {
  setup(ctx, cfg, [x, z]) {
    const { site, box, M, mat, panel, textCanvas, kit } = ctx;
    /* red carpet runner from the brand wall to Freyja's desk; kiosks line both sides (wayfinding) */
    box(2.6, 0.04, 9.8, ctx.rug ? ctx.rug(0x8a3040) : M(0x5a1f2c), x, 0.02, z + 4.5); box(2.8, 0.02, 10, mat.trim || M(0xb08d3c), x, 0.01, z + 4.5);
    ctx.lobbyAt = { x, z };
    // back wall feature: framed logo mounted on the wall, brand banner, then the directory (wayfinding adds tiles via ctx.directory)
    box(7.4, 4.0, 0.12, mat.wood || M(0x6b4a2e), x, 2.0, z + 9.82);   /* warm wood feature wall */
    const lg = panel(ctx.image('/assets/img/logo-gold.png'), 1.6, 1.85, x, 2.3, z + 9.70, Math.PI); lg.userData.label = 'Elder World logo';   /* full shield logo, clear of the ceiling */
    ctx.directoryAt = { x, y: 1.7, z: z + 9.72, ry: Math.PI };
    // pillars only in room corners, flush to the walls (the east side opens onto the services hall, so none there)
    for (const pz of [-3.6, 9.4]) box(0.5, 4.2, 0.5, mat.stone, x - 7.7, 2.1, z + pz);
    /* the offering wall display moved onto the carpet kiosks (one section each) */
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 2.4], [x, 2.55, z + 9.7], 'Lobby');   // spawn framed on the brand wall
  },
};
