// Services wall (from the services page panels) + demo kiosk. Kiosk opens the receptionist's lead form if present.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { site, box, mat, panel, textCanvas, esc } = ctx, lead = () => (ctx.use('leadForm') || (() => location.href = '/services/#request'))();
    site.services.forEach((s, i) => { const p = panel(textCanvas([s.title, s.text], { w: 768, h: 512, size: 52 }), 2.6, 1.75, x0 + i * 2.9, 2.2, z0, Math.PI);
      ctx.onClick(p, () => ctx.card(`<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="row"><button class="ob gold" type="button" data-lead>Request a free demo</button>${s.links.map(l => ctx.btn({ ...l, primary: false })).join('')}</div>`).querySelector('[data-lead]').onclick = lead); });
    const k = box(1, 1.4, 0.6, mat.trim, x0 + 4, 0.7, z0 - 3); ctx.onClick(k, lead);
    ctx.onClick(panel(textCanvas(['Request a free demo', `${ctx.verb}: we build a quick demo for your business first.`], { w: 512, h: 256, size: 44 }), 1.6, 0.8, x0 + 4, 2, z0 - 3), lead);
    ctx.extend(x0 - 2, z0 - 5, x0 + site.services.length * 2.9, z0 + 0.4);
    ctx.spot('services', [x0 + 4, 1.6, z0 - 6], [x0 + 4, 1.8, z0], 'Services');
  },
};
