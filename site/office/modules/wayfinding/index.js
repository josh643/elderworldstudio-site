// Wayfinding: hanging 3D banners. In the lobby, an arc of banners (one per tour stop registered by other modules);
// tap = walk there. Every area gets a small "↩ Lobby" banner. Also the "Classic site" sign at the entrance.
// Runs last in modules.json so it sees every registered stop. New area module = new banner, automatically.
export default {
  setup(ctx, cfg) {
    const { THREE, box, mat } = ctx, stops = ctx.tours.filter(([k]) => k !== 'lobby'), n = stops.length, R = 4.2;
    const hang = (x, y, z, ry, text, sub, fn, w = 2.2) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; ctx.scene.add(g);
      box(w + 0.2, 0.05, 0.05, mat.trim, 0, w * 0.13 + 0.05, 0, g);                                    // rod
      for (const s of [-1, 1]) box(0.012, 1.4, 0.012, mat.dark, s * w / 2.2, w * 0.13 + 0.75, 0, g);   // cords
      const p = ctx.panel(ctx.textCanvas([text, sub || ''], { w: 768, h: 200, size: 66 }), w, w * 0.26, 0, 0, 0.01, 0, g); ctx.onClick(p, fn);
      p.material.side = THREE.DoubleSide; return g;
    };
    // lobby directory: tiles on the brand wall (fits a portrait phone), 3 per row
    const D = ctx.directoryAt || { x: 0, y: 1.85, z: 9.72, ry: Math.PI }, cols = 3, tw = 1.5, th = 0.4;
    stops.forEach(([k, label], i) => {
      const c = i % cols, r = Math.floor(i / cols), nr = Math.min(cols, n - r * cols);
      const lx = (c - (nr - 1) / 2) * (tw + 0.08), y = D.y - r * (th + 0.08);
      const p = ctx.panel(ctx.textCanvas([label, `${ctx.verb} to go`], { w: 600, h: 160, size: 62 }), tw, th, D.x - lx, y, D.z, D.ry); ctx.onClick(p, () => ctx.goTo(k));
      const s = null; if (s) { const g = hang(s.pos[0], 3.3, s.pos[2] - 1.2, Math.atan2(s.pos[0] - s.look[0], s.pos[2] - s.look[2]), '↩ Lobby', '', () => ctx.goTo('lobby'), 1.4); g.children.at(-1).material.side = THREE.FrontSide; }
    });
    ctx.sign('Classic site', 'Simple text version', D.x - 2.95, 0.85, D.z, D.ry, () => ctx.classic(), 1.2);
  },
};
