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
    const holoMat = map => new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, uniforms: { map: { value: map }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float t; varying vec2 vUv; ' +
        ' float a(vec2 u){ return texture2D(map, u).a; }' +
        ' void main(){ vec4 c = texture2D(map, vUv); float al = a(vUv);' +
        ' float o = .016, nb = max(max(a(vUv+vec2(o,0.)), a(vUv-vec2(o,0.))), max(a(vUv+vec2(0.,o)), a(vUv-vec2(0.,o)))); float rim = clamp(nb - al, 0., 1.);' +
        ' float lum = dot(c.rgb, vec3(.3,.59,.11)); vec3 col = c.rgb * 1.08 + vec3(.004,.006,.009);' +
        ' col *= .96 + .04 * sin(vUv.y * 240.0 - t * 3.0); col = mix(col, vec3(.45,.9,1.0), rim);' +
        ' gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), max(al, rim)); }' });
    this.onFrame = (dt, t) => { for (const p of spin) { p.rotation.y = Math.sin(t * 0.35 + p.userData.ph) * 0.6;
        const im = p.material.uniforms.map.value.image; if (!p.userData.ar && im?.width) { const r = im.width / im.height; p.userData.ar = r; if (r < 1) p.scale.x = r; else p.scale.y = 1 / r; } p.material.uniforms.t.value = t; } };
    site.merch.forEach((m, i) => {
      const x = x0 + (i % 3) * 3, z = z0 - Math.floor(i / 3) * 3.2; box(0.9, 0.9, 0.9, mat.wood, x, 0.45, z);
      /* holographic display: emissive brass-ringed pedestal top, light gradient backdrop, product on a slow turntable with a
         cheap rim/scanline hologram shader so dark items (black shirt) read clearly. No realtime lights. */
      const T = ctx.THREE; box(0.86, 0.04, 0.86, mat.trim, x, 0.92, z); const top = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.03, 32), HOLO_BASE); top.position.set(x, 0.95, z); ctx.scene.add(top);
      const bd = new T.Mesh(new T.PlaneGeometry(1.6, 1.7), BACK); bd.position.set(x, 1.8, z - 0.55); ctx.scene.add(bd);
      const p = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), holoMat(ctx.image(m.img.replace(/\.jpg$/, '-cut.png?v=2')))); p.position.set(x, 1.7, z); ctx.scene.add(p); p.userData.ph = i; spin.push(p);
      const pl = panel(textCanvas([m.title, `${m.price} · ${m.tag}`], { w: 768, h: 160, size: 40 }), 1.9, 0.4, x, 0.75, z + 0.52);
      const open = () => ctx.card(`<h3>${esc(m.title)}</h3><p><b>${esc(m.price)}</b> · ${esc(m.tag)}</p><img src="${esc(m.img)}" alt=""><p>${esc(m.text)}</p><div class="row">${ctx.btn({ href: m.href, label: m.href.startsWith('http') ? 'Buy' : 'View on the merch page' })}</div>`);
      [p, pl].forEach(o => ctx.onClick(o, open));
    });
    ctx.onClick(panel(textCanvas(['Merch Store', 'Wear the worlds we build'], { w: 768, h: 200, size: 62 }), 4, 1, x0 + 3, 3.4, z0 + 0.8), () => ctx.card(`<h3>Merch Store</h3><p>Tees, hoodies, mugs and stickers.</p><div class="row">${ctx.btn({ href: '/merch/', label: 'Open the merch page' })}</div>`));
    ctx.extend(x0 - 1, z0 - Math.ceil(site.merch.length / 3) * 3.2, x0 + 8, z0 + 1);
    ctx.spot('merch', [x0 + 3, 1.6, z0 + 4], [x0 + 3, 1.2, z0 - 2], 'Merch');
  },
};
