// Wayfinding: hanging 3D banners. In the lobby, an arc of banners (one per tour stop registered by other modules);
// tap = in-place info overlay (never moves the camera). Every area gets a small "↩ Lobby" banner. Also the "Classic site" sign at the entrance.
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
    /* lobby: the wall signs are replaced by freestanding kiosks lining both sides of the red carpet to Freyja (same design
       family as her desk kiosk: dark navy screen, gold title, tap to open; slimmer pedestal, one simple section). Never auto-move. */
    const LINE = { games: ['Games & Arcade', 'Star Wayfarer, Omnivael & more. Play the arcade here.'], services: ['Services', 'Elder POS registers and order kiosks'],
      merch: ['Merch', 'Studio shirts, mugs & stickers'], teams: ['Teams', 'Watch our AI team work, live'], datacenter: ['Data Center', 'The servers that run the studio'],
      devlog: ['Devlog', 'Our videos and build diaries'], callcenter: ['Call Center', 'AI phone agents that answer and book 24/7'], clients: ['Client Sites', 'Websites we build for businesses'],
      custom: ['Custom Software & Automation', 'Tools, automations and 3D assets built to order'] };
    const items = [{ k: null, t: site => [site.brand.name, site.brand.tagline] }, ...stops.map(([k, label]) => ({ k, label }))];
    const L = ctx.lobbyAt || { x: 0, z: 0 }, side = Math.ceil(items.length / 2), z0 = L.z + 1.2, gap = side > 1 ? Math.min(2.2, 7.2 / (side - 1)) : 0;
    const brass = mat.trim, screenBg = '#0b1626';
    items.forEach((it, i) => {
      const left = i % 2 === 0, row = Math.floor(i / 2), kx = L.x + (left ? -1.85 : 1.85), kz = z0 + row * gap, ry = left ? Math.PI / 2 : -Math.PI / 2;
      const [title, line] = it.k === null ? it.t(ctx.site) : (LINE[it.k] || [it.label, ctx.verb + ' for details']);
      const K = new THREE.Group(); K.position.set(kx, 0, kz); K.rotation.y = ry; ctx.scene.add(K); (ctx.kiosks ||= []).push([kx, kz, title]);
      box(0.46, 0.05, 0.34, mat.wood, 0, 0.025, 0, K); box(0.5, 0.012, 0.38, brass, 0, 0.056, 0, K);          // wood plinth, brass edge
      box(0.05, 1.0, 0.05, brass, 0, 0.56, 0, K);                                                               // slim brass pedestal
      const hd = box(0.78, 0.54, 0.035, mat.dark, 0, 1.14, 0.02, K); hd.rotation.x = -0.3;
      const sc = ctx.panel(ctx.textCanvas([title, line], { w: 600, h: 400, size: 66, body: 50, bg: screenBg }), 0.74, 0.49, 0, 1.14, 0.042, 0, K); sc.rotation.x = -0.3; sc.material.toneMapped = false; sc.userData.plate = title;
      /* in-place overlay at the kiosk with the real content: no camera move, no wall anchor. Close / Esc leaves you where you stood. */
      const E = ctx.esc, T = x => E(ctx.t(x)), S = ctx.site, li = (h, p) => `<li><b>${h}</b>${p ? ' · ' + p : ''}</li>`;
      const BODY = {
        services: () => `<ul>${(S.services || []).map(v => li(T(v.title), E(String(v.text).split(/(?<=[.!?])\s/)[0]))).join('')}</ul><button class="ob gold" type="button" data-lead>${T('Book a demo')}</button>`,
        games: () => `<ul>${(S.games || []).map(g => li(E(g.title || g.name), E(g.tag || g.platform || ''))).join('')}</ul>`,
        merch: () => `<ul>${(S.merch || []).map(m => li(E(m.title), E(m.price))).join('')}</ul>${ctx.btn({ href: '/merch/', label: ctx.t('Open the merch page') })}`,
        /* public, role-based (PUBLIC-CONTENT-RULES: roles only, Freyja is the only named character) */
        teams: () => `<ul>${[['Reception', 'Freyja greets visitors and takes requests'], ['Games', 'Designers, coders and QA building our PC and mobile games'], ['Design & Marketing', 'Artists, animators and marketing'], ['Client Sites', 'Websites, kiosks and POS screens for businesses'], ['Call Center', 'AI phone agents that answer and book'], ['Ops & Leadership', 'Keeps the studio running']].map(([h, p]) => li(T(h), T(p))).join('')}</ul>` };
      const open = () => { const extra = it.k && BODY[it.k] ? BODY[it.k]() : (it.k ? '' : `<p>${T('Ask Freyja at the desk ahead, or tap any kiosk to explore.')}</p>`);
        const c = ctx.card(`<h3>${T(title)}</h3><p>${T(line)}</p>${extra}`);
        const ld = c?.querySelector?.('[data-lead]'); if (ld) ld.onclick = () => { ctx.closeCard?.(); (ctx.use('leadForm') || (() => {}))(); }; };
      [hd, sc].forEach(o => ctx.onClick(o, open));
    });
    const D = ctx.directoryAt || { x: 0, y: 1.85, z: 9.72, ry: Math.PI };
    ctx.sign('Switch to Classic', 'Simple text version', D.x - 3.3, 0.5, D.z, D.ry, () => ctx.classic(), 1.2);
  },
};
