// Lobby (Fólkvangr): brand banner + logo + about plaque + signposts. Content from site.json (brand).
export default {
  setup(ctx, cfg, [x, z]) {
    const { site, box, M, mat, panel, textCanvas, kit } = ctx;
    /* red carpet runner from the brand wall to Freyja's desk; kiosks line both sides (wayfinding) */
    box(2.6, 0.04, 9.8, ctx.rug ? ctx.rug(0x8a3040) : M(0x5a1f2c), x, 0.02, z + 4.5); box(2.8, 0.02, 10, mat.trim || M(0xb08d3c), x, 0.01, z + 4.5);
    ctx.lobbyAt = { x, z };
    // back wall feature: framed logo mounted on the wall, brand banner, then the directory (wayfinding adds tiles via ctx.directory)
    /* main entrance (floor_g reference): glass double doors on the front wall, straight down the red carpet to Freyja */
    { const T = ctx.THREE, ez = z + 9.74, glass = new T.MeshBasicMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.35, depthWrite: false });
      box(3.6, 0.14, 0.16, mat.trim, x, 2.75, ez); for (const sx of [-1.8, -0.02, 0.02, 1.8]) box(0.08, 2.75, 0.16, mat.trim, x + sx, 1.375, ez);
      for (const sx of [-0.9, 0.9]) { const gp = new T.Mesh(new T.PlaneGeometry(1.7, 2.6), glass); gp.position.set(x + sx, 1.35, ez - 0.01); gp.rotation.y = Math.PI; ctx.scene.add(gp); gp.userData.noCollide = 1; box(0.04, 0.5, 0.06, mat.trim, x + sx * 0.12, 1.1, ez - 0.06); }
      const vw = ctx.kit.windowPane(ctx, x, 1.4, ez + 0.02, Math.PI, 3.4, 2.6); vw.position.z = ez + 0.03; vw.children.slice(1).forEach(c => c.visible = false);   /* outside view through the glass */
      for (const sx of [-2.6, 2.6]) ctx.kit.plant(ctx, x + sx, ez - 0.5, 1.1);
      const pl = panel(textCanvas(['Entrance', 'Elder World Studio'], { w: 640, h: 160, size: 60 }), 1.6, 0.4, x, 3.15, ez - 0.03, Math.PI); pl.userData.plate = 'Entrance'; }
    ctx.directoryAt = { x, y: 1.7, z: z + 9.72, ry: Math.PI };
    // pillars only in room corners, flush to the walls (the east side opens onto the services hall, so none there)
    for (const pz of [-3.6, 9.4]) box(0.5, 4.2, 0.5, mat.stone, x - 7.7, 2.1, z + pz);
    /* the offering wall display moved onto the carpet kiosks (one section each) */
    ctx.extend(x - 8, z - 4, x + 8, z + 10);
    ctx.spot('lobby', [x, 1.65, z + 8.6], [x, 1.45, z - 2], 'Lobby');   // spawn just inside the entrance, looking down the carpet at Freyja
  },
};
