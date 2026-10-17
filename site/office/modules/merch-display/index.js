// Merch display: one plinth per product on the merch page; links to the shop when the site has buy links.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc } = ctx, T = ctx.THREE, spin = [];
    const HOLO_BASE = new T.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false });
    /* backplate v2: glowing light-blue gradient with a bright halo right behind the product so black items silhouette clearly */
    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 160; { const g = bc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#eaf7ff'); gr.addColorStop(1, '#a9dcf2'); g.fillStyle = gr; g.fillRect(0, 0, 128, 160);
      const r = g.createRadialGradient(64, 70, 6, 64, 70, 70); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 160);
      g.strokeStyle = '#6fd3ff'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 156); }
    const bt = new T.CanvasTexture(bc); bt.colorSpace = T.SRGBColorSpace; const BACK = new T.MeshBasicMaterial({ map: bt, toneMapped: false });
    /* product shader v2 (unlit, 5 taps): uses pre-cut transparent product PNGs (assets/img/merch/*-cut.png, backdrop removed offline), front "key light" lift on dark fabric,
       a bright cyan silhouette outline (alpha-edge, the cheap fresnel for a flat card) and a faint scanline that never darkens below 96%. */
    const holoMat = map => new T.ShaderMaterial({ transparent: true, side: T.FrontSide,   /* single-sided: the card sways +-34 deg, so it never shows a mirrored back */ depthWrite: false, uniforms: { map: { value: map }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float t; varying vec2 vUv; ' +
        ' float a(vec2 u){ return texture2D(map, u).a; }' +
        ' void main(){ vec4 c = texture2D(map, vUv); float al = a(vUv);' +
        ' float o = .016, nb = max(max(a(vUv+vec2(o,0.)), a(vUv-vec2(o,0.))), max(a(vUv+vec2(0.,o)), a(vUv-vec2(0.,o)))); float rim = clamp(nb - al, 0., 1.);' +
        ' float lum = dot(c.rgb, vec3(.3,.59,.11)); vec3 col = c.rgb * 1.08 + vec3(.004,.006,.009);' +
        ' col *= .96 + .04 * sin(vUv.y * 240.0); col = mix(col, vec3(.45,.9,1.0), rim);' +
        ' gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), max(al, rim)); }' });
    this.onFrame = () => { for (const p of spin) { if (p.userData.ar) continue;   /* static (Joshua 2026-10-16: no pointless motion): products face the case front (+z, the backdrop is behind them); they used to turn toward the camera with a +-17 deg sway, which read as the shelf moving */ p.rotation.y = p.userData.ry0 ?? 0;
        const im = p.material.uniforms.map.value.image; if (!p.userData.ar && im?.width) { const r = im.width / im.height; p.userData.ar = r; if (r < 1) p.scale.x = r; else p.scale.y = 1 / r; p.position.y = (p.userData.y0 ?? 0.985) + (p.userData.half ?? 0.6) * p.scale.y; }   /* product sits on the glowing base */ } };
    /* layout v2 (lobby): when the lobby provides store slots (ctx.merchStore.cases), each product sits in a glass display case
       (wood base, brass rim, clear glass box, warm top light) inside Hermod's Merch Store; otherwise the old open plinth rows. */
    const ST = ctx.merchStore, cases = ST?.cases || [];
    const glass = new T.MeshBasicMaterial({ color: 0xcfe9f5, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }), warm = new T.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });
    site.merch.forEach((m, i) => {
      const slot = cases[i], T = ctx.THREE; let x, z, y0, S, half;
      if (slot) { [x, z] = slot; S = 0.62; half = 0.31; y0 = 0.99;
        box(0.8, 0.92, 0.8, mat.wood, x, 0.46, z); box(0.84, 0.04, 0.84, mat.trim, x, 0.94, z); box(0.82, 0.06, 0.82, mat.dark, x, 0.03, z);
        const top = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.03, 28), HOLO_BASE); top.position.set(x, 0.975, z); ctx.scene.add(top);
        const bd = new T.Mesh(new T.PlaneGeometry(0.72, 0.78), BACK); bd.position.set(x, 1.36, z - 0.36); ctx.scene.add(bd);
        const gb = new T.Mesh(new T.BoxGeometry(0.78, 0.84, 0.78), glass); gb.position.set(x, 1.38, z); gb.renderOrder = 3; gb.userData.noCollide = 1; gb.userData.batch = 1; ctx.scene.add(gb);
        for (const sx of [-0.385, 0.385]) for (const sz of [-0.385, 0.385]) box(0.018, 0.84, 0.018, mat.trim, x + sx, 1.38, z + sz).userData.noCollide = 1;
        box(0.8, 0.03, 0.8, mat.trim, x, 1.815, z).userData.noCollide = 1; box(0.6, 0.012, 0.05, warm, x, 1.795, z + 0.2).userData.noCollide = 1; }
      else { x = x0 + (i % 3) * 3; z = z0 - Math.floor(i / 3) * 3.2; S = 1.2; half = 0.6; y0 = 0.985; box(0.9, 0.9, 0.9, mat.wood, x, 0.45, z);
      /* holographic display: emissive brass-ringed pedestal top, light gradient backdrop, product on a slow turntable with a
         cheap rim/scanline hologram shader so dark items (black shirt) read clearly. No realtime lights. */
        box(0.86, 0.04, 0.86, mat.trim, x, 0.92, z); const top = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.03, 32), HOLO_BASE); top.position.set(x, 0.95, z); ctx.scene.add(top);
        const bd = new T.Mesh(new T.PlaneGeometry(1.6, 1.7), BACK); bd.position.set(x, 1.8, z - 0.55); ctx.scene.add(bd); }
      const p = new T.Mesh(new T.PlaneGeometry(S, S), holoMat(ctx.image(m.img.replace(/\.jpg$/, '-cut.png?v=2')))); p.position.set(x, y0 + half, z); ctx.scene.add(p); p.userData.ph = i; p.userData.y0 = y0; p.userData.half = half; spin.push(p);
      const pl = slot ? panel(textCanvas([m.title, `${m.price} · ${m.tag}`], { w: 768, h: 160, size: 40 }), 0.76, 0.16, x, 0.72, z + 0.405) : panel(textCanvas([m.title, `${m.price} · ${m.tag}`], { w: 768, h: 160, size: 40 }), 1.9, 0.4, x, 0.75, z + 0.52);
      const open = () => ctx.card(`<h3>${esc(m.title)}</h3><p><b>${esc(m.price)}</b> · ${esc(m.tag)}</p><img src="${esc(m.img)}" alt=""><p>${esc(m.text)}</p><div class="row">${ctx.btn({ href: m.href, label: m.href.startsWith('http') ? 'Buy' : 'View on the merch page' })}</div>`);
      [p, pl].forEach(o => ctx.onClick(o, open));
    });
    const storeCard = () => ctx.card(`<h3>Merch Store</h3><p>Tees, hoodies, mugs and stickers. Hermod runs the store.</p><div class="row">${ctx.btn({ href: '/merch/', label: 'Open the merch page' })}</div>`);
    if (ST?.sign) { const [sx, sy, sz, sry] = ST.sign; const sg = panel(textCanvas(['Merch Store', 'Hermod · tees, hoodies, mugs'], { w: 768, h: 200, size: 62 }), 2.2, 0.57, sx, sy, sz, sry); sg.userData.plate = 'Merch Store'; ctx.onClick(sg, storeCard);
      ctx.spot('merch', ...ST.spot, 'Merch'); return; }
    ctx.onClick(panel(textCanvas(['Merch Store', 'Wear the worlds we build'], { w: 768, h: 200, size: 62 }), 4, 1, x0 + 3, 3.4, z0 + 0.8), storeCard);
    ctx.extend(x0 - 1, z0 - Math.ceil(site.merch.length / 3) * 3.2, x0 + 8, z0 + 1);
    ctx.spot('merch', [x0 + 3, 1.6, z0 + 4], [x0 + 3, 1.2, z0 - 2], 'Merch');
  },
};
