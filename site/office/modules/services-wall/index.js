// Services wall (from the services page panels) + demo kiosk. Kiosk opens the receptionist's lead form if present.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc, M } = ctx, lead = () => (ctx.use('leadForm') || (() => location.href = '/services/#request'))();
    const SHORT = { 'Demo first': 'We build a quick demo for your business first.', 'Websites': 'Mobile-friendly sites with booking, menus and quote forms.', 'AI tools & chat assistants': 'A chat assistant that answers customers 24/7.', 'Automation': 'Connect your forms, email and spreadsheets.', 'Custom software & dashboards': 'Portals and dashboards that replace paper forms.' };
    const short = (t, title) => SHORT[title] || String(t).split(/(?<=[.!?])\s/)[0];   /* hand-written one-liners, no truncation */
    const n = site.services.length, W = 2.75, gap = 0.2, span = n * (W + gap);
    // feature wall + neon trims behind the service panels, carpet in front
    box(span + 0.6, 3.6, 0.1, mat.wall, x0 - 1.3 + span / 2 - W / 2 + 0.05, 1.8, z0 + 0.12);
    for (const y of [0.25, 3.45]) box(span + 0.6, 0.08, 0.04, mat.wood, x0 - 1.3 + span / 2 - W / 2 + 0.05, y, z0 + 0.05);
    if (ctx.rug) box(span, 0.03, 4.5, ctx.rug(0x8a5a44), x0 - 1.3 + span / 2 - W / 2 + 0.05, 0.035, z0 - 2.6);
    site.services.forEach((s, i) => { const p = panel(textCanvas([s.title, short(s.text, s.title)], { w: 1024, h: 690, size: 96, body: 68 }), W, W * 0.674, x0 - 1.3 + i * (W + gap), 1.85, z0, Math.PI); p.userData.plate = s.title;
      p.userData.label = s.title;
      ctx.onClick(p, () => ctx.card(`<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="row"><button class="ob gold" type="button" data-lead>Request a demo</button>${s.links.map(l => ctx.btn({ ...l, primary: false })).join('')}</div>`).querySelector('[data-lead]').onclick = lead); });
    // demo kiosk: plinth, column, angled touchscreen with a lit bezel, gold base ring
    const T = ctx.THREE, kx = x0 - 1.3 + span - W / 2 + 0.9, kz = z0 - 1.6, K = new T.Group(); K.position.set(kx, 0, kz); K.rotation.y = Math.atan2((x0 + 4) - kx, (z0 - 7) - kz);   // at the end of the wall, turned to the visitor ctx.scene.add(K);
    const dark = new T.MeshStandardMaterial({ color: 0x15121c, roughness: 0.35, metalness: 0.5 });
    const add = (geo, m, x, y, z, rx = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; K.add(o); return o; };
    add(new T.CylinderGeometry(0.42, 0.46, 0.08, 32), mat.trim, 0, 0.04, 0);
    add(new T.CylinderGeometry(0.11, 0.14, 1.0, 20), dark, 0, 0.58, 0);
    const head = add(new T.BoxGeometry(0.78, 0.52, 0.06), dark, 0, 1.25, 0.02, -0.5);
    const scr = panel(textCanvas(['Book a demo', `${ctx.verb} to request one. We build a quick demo for your business so you can see it working first.`], { w: 900, h: 580, size: 84, bg: '#0b1626' }), 0.7, 0.45, 0, 1.25, 0.06, 0, K);
    scr.rotation.x = -0.5; scr.position.set(0, 1.263, 0.055); scr.material.toneMapped = false; scr.userData.label = 'Book a demo';
    [head, scr].forEach(o => ctx.onClick(o, lead));
    ctx.sign('Services', `${ctx.verb} a panel`, x0 + span / 2 - 1.3, 3.2, z0 - 0.02, Math.PI, null, 2.4);   /* sits above the panels (they top out at 2.78 m) */
    ctx.extend(x0 - 2, z0 - 5, x0 + site.services.length * 2.9, z0 + 0.4);
    ctx.spot('services', [x0 + 4, 1.6, z0 - 7], [x0 + 4, 1.8, z0], 'Services');
  },
};
