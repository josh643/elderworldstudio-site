// Lobby (Fólkvangr): brand banner + logo + about plaque + signposts. Content from site.json (brand).
export default {
  setup(ctx, cfg, [x, z]) {
    const { site, box, M, mat, panel, textCanvas, kit } = ctx;
    /* red carpet runner from the brand wall to Freyja's desk; kiosks line both sides (wayfinding) */
    box(2.6, 0.04, 9.8, ctx.rug ? ctx.rug(0x8a3040) : M(0x5a1f2c), x, 0.02, z + 4.5); box(2.8, 0.02, 10, mat.trim || M(0xb08d3c), x, 0.01, z + 4.5);
    ctx.lobbyAt = { x, z };
    // back wall feature: framed logo mounted on the wall, brand banner, then the directory (wayfinding adds tiles via ctx.directory)
    /* main entrance (floor_g + approved glass exterior): the engine opens the front shell wall over ctx.entrance and builds a
       full-height glass wall with two-panel sliding doors centred on the red carpet (core/engine.js). Nothing stands on the
       glass line: no column, plants or bench within 1 m of it. */
    ctx.entrance = { x, w: 11 };
    for (const sx of [-4.2, 4.2]) ctx.kit.plant(ctx, x + sx, z + 7.6, 1.1);
    ctx.directoryAt = { x: x - 4.6, y: 1.2, z: z + 6.2, ry: Math.PI / 2 };   /* Classic plaque on a stand by the left wall, off the glass line */
    // pillars only in room corners, flush to the walls (the east side opens onto the services hall, so none there)
    for (const pz of [-3.6, 9.4]) box(0.5, 4.2, 0.5, mat.stone, x - 7.7, 2.1, z + pz);
    /* the offering wall display moved onto the carpet kiosks (one section each) */
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 8.6], [x, 1.45, z - 2], 'Lobby');   // spawn just inside the entrance, looking down the carpet at Freyja
  },
};
