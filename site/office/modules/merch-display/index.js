// Merch display: one plinth per product on the merch page; links to the shop when the site has buy links.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc } = ctx, T = ctx.THREE, spin = [];
    const HOLO_BASE = new T.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false });
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 128; { const g = bc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#f4efe6'); gr.addColorStop(1, '#c9d8e6'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); }
    const bt = new T.CanvasTexture(bc); bt.colorSpace = T.SRGBColorSpace; const BACK = new T.MeshBasicMaterial({ map: bt, toneMapped: false });
    const holoMat = map => new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, uniforms: { map: { value: map }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float t; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); float lum = dot(c.rgb, vec3(.3,.59,.11));' +
        ' float bg = smoothstep(.90,.97, lum) * (1.0 - smoothstep(.04,.12, length(c.rgb - vec3(lum))));' +   /* key out the product photo's white studio backdrop */
        ' vec3 base = c.rgb + vec3(.30,.55,.70) * (1.0 - smoothstep(.07,.30,lum)) * .55;' +               /* lift dark fabric (black shirt) with a cool rim tone */
        ' float scan = .93 + .07 * sin(vUv.y * 220.0 - t * 3.0); vec3 col = base * scan; float edge = 1.0 - smoothstep(.0,.04, min(min(vUv.x,1.0-vUv.x), min(vUv.y,1.0-vUv.y)));' +
        ' col += vec3(.4,.85,1.0) * edge * .35; gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), max(c.a * (1.0 - bg), edge * .5) * (.95 + .05 * sin(t * 7.0))); }' });
    this.onFrame = (dt, t) => { for (const p of spin) { p.rotation.y += dt * 0.35; p.material.uniforms.t.value = t; } };
    site.merch.forEach((m, i) => {
      const x = x0 + (i % 3) * 3, z = z0 - Math.floor(i / 3) * 3.2; box(0.9, 0.9, 0.9, mat.wood, x, 0.45, z);
      /* holographic display: emissive brass-ringed pedestal top, light gradient backdrop, product on a slow turntable with a
         cheap rim/scanline hologram shader so dark items (black shirt) read clearly. No realtime lights. */
      const T = ctx.THREE; box(0.86, 0.04, 0.86, mat.trim, x, 0.92, z); const top = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.03, 32), HOLO_BASE); top.position.set(x, 0.95, z); ctx.scene.add(top);
      const bd = new T.Mesh(new T.PlaneGeometry(1.6, 1.7), BACK); bd.position.set(x, 1.8, z - 0.55); ctx.scene.add(bd);
      const p = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), holoMat(ctx.image(m.img))); p.position.set(x, 1.7, z); ctx.scene.add(p); spin.push(p);
      const pl = panel(textCanvas([m.title, `${m.price} · ${m.tag}`], { w: 768, h: 160, size: 40 }), 1.9, 0.4, x, 0.75, z + 0.52);
      const open = () => ctx.card(`<h3>${esc(m.title)}</h3><p><b>${esc(m.price)}</b> · ${esc(m.tag)}</p><img src="${esc(m.img)}" alt=""><p>${esc(m.text)}</p><div class="row">${ctx.btn({ href: m.href, label: m.href.startsWith('http') ? 'Buy' : 'View on the merch page' })}</div>`);
      [p, pl].forEach(o => ctx.onClick(o, open));
    });
    ctx.onClick(panel(textCanvas(['Studio Merch', 'Wear the worlds we build'], { w: 768, h: 200, size: 62 }), 4, 1, x0 + 3, 3.4, z0 + 0.8), () => ctx.card(`<h3>Studio Merch</h3><p>Tees, hoodies, mugs and stickers.</p><div class="row">${ctx.btn({ href: '/merch/', label: 'Open the merch page' })}</div>`));
    ctx.extend(x0 - 1, z0 - Math.ceil(site.merch.length / 3) * 3.2, x0 + 8, z0 + 1);
    ctx.spot('merch', [x0 + 3, 1.6, z0 + 4], [x0 + 3, 1.2, z0 - 2], 'Merch');
  },
};
