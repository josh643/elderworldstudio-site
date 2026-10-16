// Receptionist feature (plugin): Freyja at the desk, text chat (Worker /api/office/freyja: rate-limited, $-capped,
// FAQ fallback) and the demo-request lead form (stored as a lead record; no email). Remove from modules.json to disable.
export default {
  setup(ctx, cfg, [x, z]) {
    const { box, mat, esc } = ctx, A = ctx.use('avatar');
    const dk = box(4, 1.1, 1, mat.wood, x, 0.55, z + 1); box(4.2, 0.08, 1.2, mat.trim, x, 1.12, z + 1);
    const me = { id: 'receptionist', name: cfg.name || ctx.roster.receptionist?.name || 'Freyja', role: 'receptionist' };
    const f = A.make({ ...me, female: 1 }, 0x2f7d6a, () => chat()); f.position.set(x, 0, z); f.rotation.y = 0; f.userData.pose = 'host'; ctx.scene.add(f);
    const history = [];
    const leadForm = () => {
      const c = ctx.card(`<h3>Request a demo</h3><p>Tell us what you need. Our client team builds a quick demo for your business first.</p>
      <form class="office-lead"><label>Your name *<input name="name" required maxlength="100" autocomplete="name"></label><label>Email *<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <label>Business name *<input name="business" required maxlength="150"></label><label>What do you need?<select name="type"><option>Website</option><option>AI tool</option><option>Custom software</option><option selected>Not sure</option></select></label>
      <label>Tell us about it *<textarea name="description" required maxlength="2000" rows="4"></textarea></label><div class="hp" aria-hidden="true"><input name="website_url" tabindex="-1" autocomplete="off"></div>
      <button class="ob gold" type="submit">Send to the client team</button><p class="msg" role="status"></p></form>`);
      const fm = c.querySelector('form'), t0 = Date.now();
      fm.onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); d.t = t0; d.source = 'office'; const m = fm.querySelector('.msg'); m.textContent = 'Sending…';
        try { const j = await (await fetch(cfg.lead || '/api/office/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })).json(); m.textContent = j.ok ? 'Thanks! Our client team has your request and will reply by email.' : (j.error || 'Could not send.'); if (j.ok) fm.querySelector('button').disabled = true; }
        catch { m.textContent = 'Could not send right now. You can also use the classic services page.'; } };
    };
    const chat = () => {
      f.userData.talking = true; clearTimeout(f.userData.tt); f.userData.tt = setTimeout(() => { f.userData.talking = false; }, 30000);
      const c = ctx.card(`<h3>${esc(me.name)} · receptionist</h3><div class="office-chat"><div class="log" aria-live="polite"></div><form><input name="q" maxlength="400" placeholder="Ask about our games, services or the studio" aria-label="Message ${esc(me.name)}" autocomplete="off"><button class="ob gold" type="submit">Send</button></form><p style="font-size:12px;opacity:.7">${esc(me.name)} is an AI receptionist. Don't share passwords or payment details.</p></div>`);
      const log = c.querySelector('.log'), fm = c.querySelector('form');
      const add = (t, mine) => { const m = document.createElement('div'); m.className = 'm' + (mine ? ' me' : ''); m.textContent = t; log.append(m); log.scrollTop = 1e6; return m; };
      if (!history.length) history.push({ role: 'assistant', content: `Welcome to ${cfg.hall || 'Fólkvangr'}! I'm ${me.name}. I can tell you about Elder World Studio, show you our games, or help you request a free demo for your business. What brings you in?` });
      history.forEach(h => add(h.content, h.role === 'user'));
      fm.onsubmit = async e => { e.preventDefault(); const q = fm.q.value.trim(); if (!q) return; fm.q.value = ''; add(q, true); history.push({ role: 'user', content: q }); const w = add('…');
        try { const j = await (await fetch(cfg.chat || '/api/office/freyja', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-8) }) })).json();
          w.textContent = j.reply || 'Sorry, I lost my train of thought.'; history.push({ role: 'assistant', content: w.textContent });
          if (j.action?.tour) ctx.goTo(j.action.tour); if (j.action?.lead) setTimeout(leadForm, 900); }
        catch { w.textContent = 'I can\u2019t reach my notes right now. Try the tour buttons below!'; } };
      fm.q.focus();
    };
    ctx.onClick(dk, () => chat()); ctx.sign(`Ask ${me.name}`, `${ctx.verb} to chat`, x, 0.62, z + 1.52, 0, () => chat(), 1.6);
    ctx.provide('leadForm', leadForm);
    ctx.hudButton(`Talk to ${me.name}`, chat, true);
    // greeting: she turns to look at the visitor, waves and shows a speech bubble when they come within ~4 m
    const bubble = ctx.label(`Hi, I'm ${me.name}!`, ctx.touch ? 'Tap me to chat' : 'Click me or press E to chat', '#ffffff'); bubble.position.set(0, 2.45, 0); bubble.scale.set(1.9, 0.48, 1);
    bubble.material.transparent = true; bubble.material.opacity = 0; f.add(bubble);
    let greeted = 0, near = false; const cam = ctx.cam;
    this.onFrame = dt => { const dx = cam.position.x - f.position.x, dz = cam.position.z - f.position.z, d = Math.hypot(dx, dz), u = f.userData;
      let want = 0; if (d < 9) want = Math.max(-1.7, Math.min(1.7, Math.atan2(dx, dz)));            // look toward the visitor, never turn her back to the desk
      let diff = want - f.rotation.y; f.rotation.y += diff * Math.min(1, dt * 3);
      const isNear = d < 4; if (isNear && !near && performance.now() - greeted > 15000) { greeted = performance.now(); u.greetUntil = greeted + 2600; ctx.announce?.(`${me.name}: Hi! Welcome to Elder World Studio.`); }
      near = isNear; u.greeting = (u.greetUntil || 0) > performance.now();
      const tgt = d < 4.5 ? 1 : 0; bubble.material.opacity += (tgt - bubble.material.opacity) * Math.min(1, dt * 4); bubble.visible = bubble.material.opacity > 0.02; };
  },
};
