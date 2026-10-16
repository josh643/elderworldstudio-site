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
    /* wall-mounted offering display on the west wall: every EWS line of work, one line each, with the room it lives in */
    const offer = ['What we do', 'Games: Star Wayfarer, Omnivael & more for PC and mobile, plus an arcade you can play here  \u2192 Games & Arcade',
      'Websites for businesses  \u2192 Client Sites', 'Elder POS registers & order kiosks  \u2192 Services',
      'AI call center & phone agents  \u2192 Call Center', 'ElderAI: AI chat & agents for businesses  \u2192 Services',
      'Custom software & 3D assets  \u2192 Services', 'Run live by our AI team. Watch them work in the halls. Book a demo with Freyja.'];
    box(0.08, 2.6, 4.7, mat.trim || M(0xb08d3c), x - 7.96, 2.1, z + 4);
    const od = panel(textCanvas(offer, { w: 1400, h: 760, size: 84 }), 4.5, 2.44, x - 7.9, 2.1, z + 4, Math.PI / 2); od.userData.plate = 'What we do';
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 2.4], [x, 2.55, z + 9.7], 'Lobby');   // spawn framed on the brand wall
  },
};
