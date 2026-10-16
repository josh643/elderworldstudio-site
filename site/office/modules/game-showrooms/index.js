// Games showroom: one arcade cabinet per game in site.json (games page). New game on the site = new cabinet, no code change.
// Each cabinet: lit marquee with the title, angled screen (store art, or a live "attract mode" gameplay loop drawn on a
// canvas when the game has no art yet), control deck, store QR + button plate. Neon trims, runner rug, wall posters.
import qrcode from '../../vendor/qrcode.js?v=1';
import { attract } from './attract.js?v=1';
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { THREE, site, box, mat, panel, textCanvas, esc, M, renderer: R } = ctx, bay = cfg.bay || 3.2;
    const show = g => ctx.card(`<h3>${esc(g.title)}</h3><p><b>${esc(g.tag)}</b></p>${g.img ? `<img src="${esc(g.img)}" alt="${esc(g.alt)}">` : ''}<p>${esc(g.text)}</p><div class="row">${g.buttons.map(ctx.btn).join('') || '<span class="ob">Coming soon</span>'}<a class="ob" href="/games/">All games</a></div>`);
    const aniso = R.capabilities.getMaxAnisotropy();
    const sharp = t => { t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
    const NEON = [0xff3ea5, 0x3ee8ff, 0x9b5cff, 0x3dff8a, 0xffb43e];
    const neon = new Map(), glow = c => { if (!neon.has(c)) neon.set(c, new THREE.MeshBasicMaterial({ color: c })); return neon.get(c); };
    const body = new THREE.MeshStandardMaterial({ color: 0x14101c, roughness: 0.45, metalness: 0.3 });
    const qrTex = url => { const q = qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount(), s = 8, c = document.createElement('canvas'); c.width = c.height = (n + 8) * s;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + 4) * s, (r + 4) * s, s, s);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
    const loops = [];
    site.games.forEach((g, i) => {
      const side = i % 2 ? 1 : -1, x = x0 - 2 - Math.floor(i / 2) * bay, z = z0 + side * 2.6, ry = side > 0 ? Math.PI : 0, col = NEON[i % NEON.length];
      const G = new THREE.Group(); G.position.set(x, 0, z); G.rotation.y = ry; ctx.scene.add(G);   // local +z faces the aisle
      box(0.95, 1.05, 0.75, body, 0, 0.525, 0, G);                                   // base
      box(0.95, 0.9, 0.5, body, 0, 1.5, -0.12, G);                                   // screen housing
      box(0.95, 0.34, 0.6, body, 0, 2.12, -0.06, G);                                 // marquee box
      for (const sx of [-0.49, 0.49]) box(0.025, 2.28, 0.04, glow(col), sx, 1.14, 0.36, G);   // neon edges
      box(1.0, 0.03, 0.8, glow(col), 0, 0.015, 0, G);
      const mq = panel(sharp(textCanvas([g.title], { w: 1024, h: 300, size: 110, bg: '#0b0612' })), 0.9, 0.28, 0, 2.12, 0.245, 0, G);
      // screen: art if we have it, else a live attract-mode loop
      let tex; if (g.img) tex = sharp(ctx.image(g.img)); else { const a = attract(g.title, col); tex = sharp(new THREE.CanvasTexture(a.canvas)); loops.push({ a, tex, G }); }
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.62), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      scr.position.set(0, 1.52, 0.135); scr.rotation.x = -0.12; G.add(scr);
      // control deck: buttons + stick
      const deck = box(0.95, 0.06, 0.34, body, 0, 1.07, 0.22, G); deck.rotation.x = 0.25;
      [-0.2, -0.08, 0.04].forEach((bx, j) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), glow(NEON[(i + j + 1) % NEON.length])); b.position.set(bx + 0.18, 1.11, 0.24); G.add(b); });
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), M(0x222222)); st.position.set(-0.25, 1.15, 0.22); G.add(st);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glow(0xff3030)); ball.position.set(-0.25, 1.22, 0.22); G.add(ball);
      // store plate + QR on the base front
      const live = g.status === 'live', link = g.buttons[0]?.href;
      const plate = panel(sharp(textCanvas([live ? (g.buttons[0]?.store === 'steam' ? 'On Steam' : 'Get it on Google Play') : 'Coming soon', g.tag], { w: 768, h: 220, size: 70 })), 0.62, 0.18, -0.13, 0.7, 0.38, 0, G);
      if (link) { const qr = panel(qrTex(link), 0.24, 0.24, 0.32, 0.68, 0.38, 0, G); ctx.onClick(qr, () => show(g)); }
      [mq, scr, plate].forEach(o => ctx.onClick(o, () => show(g)));
      // poster on the wall behind
      if (g.img) panel(sharp(ctx.image(g.img)), 0.9, 0.9, 0, 2.2, -0.9, 0, G);
    });
    const len = Math.ceil(site.games.length / 2) * bay + 2;
    ctx.kit.corridor(ctx, { x1: x0 + 4, z1: z0, x2: x0 - len, z2: z0, width: 3 });
    if (ctx.rug) box(len, 0.03, 1.6, ctx.rug(0x2a1840), x0 + 2 - len / 2, 0.035, z0);
    for (const sz of [-1, 1]) { box(len, 3.2, 0.12, M(0x1a1426), x0 + 2 - len / 2, 1.6, z0 + sz * 3.6); box(len, 0.04, 0.04, glow(sz > 0 ? 0x9b5cff : 0x3ee8ff), x0 + 2 - len / 2, 3.1, z0 + sz * 3.53); }
    for (const sz of [-1, 1]) box(len, 0.03, 0.03, glow(sz > 0 ? 0x3ee8ff : 0xff3ea5), x0 + 2 - len / 2, 0.06, z0 + sz * 0.82);
    // lighting: a few warm/neon point lights (no shadow maps)
    for (let k = 0; k < 3; k++) { const L = new THREE.PointLight(k % 2 ? 0xbfa6ff : 0xffd7a8, 6, 9, 1.6); L.position.set(x0 - 2 - k * len / 3, 3, z0); ctx.scene.add(L); }
    ctx.sign('Arcade', `${site.games.length} games · ${ctx.verb} a cabinet`, x0 + 1.5, 2.9, z0, -Math.PI / 2, null, 2.4);
    ctx.extend(x0 - len - 1, z0 - 6, x0 + 4, z0 + 6);
    ctx.spot('games', [x0 - 1, 1.6, z0], [x0 - 10, 1.4, z0], 'Games');
    // attract loops: only animate cabinets near the player, ~20 fps
    let acc = 0; const cam = ctx.cam, p = new THREE.Vector3();
    this.onFrame = dt => { acc += dt; if (acc < 0.05) return; const step = acc; acc = 0;
      for (const l of loops) { l.G.getWorldPosition(p); if (p.distanceTo(cam.position) > 14) continue; l.a.step(step); l.tex.needsUpdate = true; } };
  },
};
