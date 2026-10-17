// Receptionist feature (plugin): Freyja at the desk, text chat (Worker /api/office/freyja: rate-limited, $-capped,
// FAQ fallback) and the demo-request lead form (stored as a lead record; no email). Remove from modules.json to disable.
import { openKiosk } from './kiosk-ui.js?v=3';
import * as V from './voice.js?v=2';
import { setupFloors } from '../../core/floors.js?v=2';
import { filterChatText } from '../../data/chat-safety.js?v=1';
import { mountChatSafetyControls } from '../../data/chat-safety-controls.js?v=1';
export default {
  setup(ctx, cfg, [x, z]) {
    const { box, mat, esc } = ctx, A = ctx.use('avatar');
    /* curved wood reception desk (layout v2): an arc of radius 3.1 m (outer) / 2.3 m (inner) bulging toward the doors, brass
       top edge + kick band; Freyja stands inside the curve. One extrusion per part, all on shared materials (batched). */
    const dk = (() => { const T = ctx.THREE, cx = x, cz = z - 1.6, A = 0.96;
      const arc = (r1, r2, y, h, m) => { const sh = new T.Shape(); for (let i = 0; i <= 24; i++) { const a = -A + 2 * A * i / 24, px = cx + r1 * Math.sin(a), pz = cz + r1 * Math.cos(a); i ? sh.lineTo(px, -pz) : sh.moveTo(px, -pz); }
        for (let i = 24; i >= 0; i--) { const a = -A + 2 * A * i / 24; sh.lineTo(cx + r2 * Math.sin(a), -(cz + r2 * Math.cos(a))); }
        const g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2); g.translate(0, y, 0); const o = new T.Mesh(g, m); ctx.scene.add(o); return o; };
      const body = arc(3.1, 2.3, 0, 1.02, mat.wood); arc(3.16, 2.26, 1.02, 0.06, mat.trim).userData.noCollide = 1; arc(3.12, 3.09, 0.06, 0.06, mat.trim).userData.noCollide = 1; arc(3.12, 3.09, 0.92, 0.03, mat.trim).userData.noCollide = 1;
      return body; })();
    const me = { id: 'receptionist', name: cfg.name || ctx.roster.receptionist?.name || 'Freyja', role: 'receptionist' };
    const f = A.make({ ...me, female: 1 }, 0x2f7d6a, () => chat()); f.position.set(x, 0, z); f.rotation.y = 0; f.userData.pose = 'host'; ctx.scene.add(f);
    const history = (() => { try { return JSON.parse(sessionStorage.getItem('ews-freyja') || '[]'); } catch { return []; } })();   /* chat survives reloads */
    const safetyKey = 'ews-chat-safety';
    const safetyState = () => { try { return JSON.parse(localStorage.getItem(safetyKey) || '{}'); } catch { return {}; } };
    const setSafety = patch => { const next = { ...safetyState(), ...patch }; try { localStorage.setItem(safetyKey, JSON.stringify(next)); } catch {} return next; };
    const reportIdentity = () => { try { let id = localStorage.getItem('ews-chat-id'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('ews-chat-id', id); } return id; } catch { return 'anonymous-device'; } };
    addEventListener('pagehide', () => { try { sessionStorage.setItem('ews-freyja', JSON.stringify(history.slice(-20))); } catch {} });
    const leadForm = () => {
      const c = ctx.card(`<h3>Request a demo</h3><p>Tell us what you need. Our client team builds a quick demo for your business first.</p>
      <form class="office-lead"><label>Your name *<input name="name" required maxlength="100" autocomplete="name"></label><label>Email *<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <label>Business name *<input name="business" required maxlength="150"></label><label>What do you need?<select name="type"><option>Website</option><option>AI tool</option><option>Custom software</option><option selected>Not sure</option></select></label>
      <label>Tell us about it *<textarea name="description" required maxlength="2000" rows="4"></textarea></label><div class="hp" aria-hidden="true"><input name="website_url" tabindex="-1" autocomplete="off"></div>
      <button class="ob gold" type="submit">Send to the client team</button><p class="msg" role="status"></p></form>`);
      const fm = c.querySelector('form'), t0 = Date.now();
      fm.onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); d.t = t0; d.source = 'office'; d.client_language = V.lang(); const m = fm.querySelector('.msg'); m.textContent = 'Sending…';
        try { const j = await (await fetch(cfg.lead || '/api/office/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })).json(); if (j.ok) sent(j.id, d.type); m.textContent = j.ok ? 'Thanks! Our client team has your request and will reply by email.' : (j.error || 'Could not send.'); if (j.ok) fm.querySelector('button').disabled = true; }
        catch { m.textContent = 'Could not send right now. You can also use the classic services page.'; } };
    };
    const speak = ms => { f.userData.speaking = true; clearTimeout(f.userData.st); f.userData.st = setTimeout(() => { f.userData.speaking = false; }, ms); };
    /* front-desk flow: request sent -> she prints a ticket -> it travels to the right team's room -> status is trackable at the kiosk */
    const TEAM = { Website: 'client', 'AI tool': 'client', 'Custom software': 'client', 'Not sure': 'client' }, tickets = [];
    const reqs = () => { try { return JSON.parse(localStorage.getItem('ews-req') || '[]'); } catch { return []; } };
    const sent = (id, type) => { const team = TEAM[type] || 'client'; if (id) localStorage.setItem('ews-req', JSON.stringify([...reqs(), { id, team, t: Date.now() }].slice(-10)));
      V.playLine('form_sent', () => V.playLine('ticket_' + (['client', 'games', 'ops'].includes(team) ? team : 'client'))); speak(6000);
      const T = ctx.THREE, tk = new T.Mesh(new T.PlaneGeometry(0.16, 0.24), new T.MeshBasicMaterial({ color: 0xfaf6ea, side: T.DoubleSide })); tk.userData.noCollide = 1;
      const from = new T.Vector3(x - 1.3, 1.2, z + 0.8), spot = ctx.teamSpot?.[team] || [x, z - 20], to = new T.Vector3(spot[0], 1.3, spot[1]);
      tk.position.copy(from); ctx.scene.add(tk); tickets.push({ tk, from, to, t: -0.25 }); };
    const statusCard = () => { const L = reqs(); const c = ctx.card(`<h3>Your requests</h3><div class="st">${L.length ? '' : '<p>No requests from this device yet. Tap “Start a request” to begin.</p>'}</div><button class="ob" type="button">Refresh</button>`);
      const box = c.querySelector('.st'), LBL = { received: 'Received', 'in development': 'In development', review: 'In review', ready: 'Ready', unknown: 'Received' };
      const load = async () => { box.innerHTML = ''; let last;
        for (const r of L.slice().reverse()) { const j = await (await fetch('/api/office/lead-status?id=' + encodeURIComponent(r.id))).json().catch(() => ({})); last ||= j.status;
          const p = document.createElement('p'); p.textContent = `#${r.id.slice(-6)} · ${new Date(r.t).toLocaleDateString()} · ${LBL[j.status] || 'Received'}`; box.append(p); }
        const k = { 'in development': 'status_dev', ready: 'status_ready', review: 'status_review' }[last] || (last ? 'status_received' : null); if (k) V.playLine(k); };
      c.querySelector('button').onclick = load; if (L.length) load(); };
    this.tickets = tickets; this.sent = sent;
    const chat = () => {
      if (ctx.xbox && !ctx.xboxChatEnabled()) return;
      if (safetyState().blockedFreyja) return;
      f.userData.talking = true; clearTimeout(f.userData.tt); f.userData.tt = setTimeout(() => { f.userData.talking = false; }, 30000);
      const c = ctx.card(`<h3>${esc(me.name)} · receptionist</h3><div class="office-chat"><div class="log" aria-live="polite"></div><form><input name="q" maxlength="400" placeholder="Ask about our games, services or the studio" aria-label="Message ${esc(me.name)}" autocomplete="off"><button class="ob gold" type="submit">Send</button></form><p style="font-size:12px;opacity:.7">${esc(me.name)} is an AI receptionist. Don't share passwords or payment details.</p></div>`);
      const log = c.querySelector('.log'), fm = c.querySelector('form');
      { const row = document.createElement('div'); row.className = 'row'; const listen = V.mic(t => { fm.q.value = t; fm.requestSubmit(); }, on => { mb.textContent = on ? '…' : ctx.t('🎤 Hold to talk'); });
        const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'ob'; mb.textContent = ctx.t('🎤 Hold to talk'); if (listen) { mb.onpointerdown = () => listen(); } else mb.hidden = true;
        const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'ob'; sb.textContent = ctx.t('My request status'); sb.onclick = () => statusCard();
        const kb = document.createElement('button'); kb.type = 'button'; kb.className = 'ob gold'; kb.textContent = ctx.t('Start a request'); kb.onclick = () => { V.playLine('form_open'); openKiosk(ctx, cfg.lead, sent); };
        row.append(mb, kb, sb); fm.after(row);
        /* quick options (replace the old red-carpet kiosks): Services, Games, Merch, Teams open in place at the desk */
        const LI = ctx.use('lobbyInfo'); if (LI) { const qr = document.createElement('div'); qr.className = 'row quick';
          for (const [k, t] of [['services', 'Services'], ['games', 'Games'], ['merch', 'Merch'], ['teams', 'Teams']]) if (LI.keys.includes(k)) { const q = document.createElement('button'); q.type = 'button'; q.className = 'ob'; q.textContent = ctx.t(t); q.onclick = () => LI(k); qr.append(q); }
          row.after(qr); } }
      const status = document.createElement('p'); status.className = 'chat-safety-status'; status.setAttribute('role', 'status');
      const addActions = (m, t) => {
        const holder = document.createElement('div');
        mountChatSafetyControls(holder, { target: me, reporter: reportIdentity(), excerpt: filterChatText(t), muteKey: 'mutedFreyja', blockKey: 'blockedFreyja',
          onStatus: message => { status.textContent = message; },
          onMute: value => { setSafety({ mutedFreyja: value }); updateMute(); log.querySelectorAll('.m:not(.me)').forEach(row => { row.hidden = value; }); if (value) status.textContent = 'Freyja is muted on this device.'; },
          onBlocked: () => { setSafety({ blockedFreyja: true }); ctx.closeCard(); } });
        m.after(holder);
      };
      const add = (t, mine, actions = false) => {
        const m = document.createElement('div'); m.className = 'm' + (mine ? ' me' : ''); m.textContent = filterChatText(t); m.hidden = !mine && !!safetyState().mutedFreyja; log.append(m);
        if (!mine && actions) addActions(m, t);
        log.scrollTop = 1e6; return m;
      };
      const muteToggle = document.createElement('button'); muteToggle.type = 'button'; muteToggle.className = 'ob'; muteToggle.style.minHeight = '48px';
      const updateMute = () => { muteToggle.textContent = safetyState().mutedFreyja ? 'Unmute Freyja' : 'Mute Freyja'; };
      muteToggle.onclick = () => { setSafety({ mutedFreyja: !safetyState().mutedFreyja }); updateMute(); log.querySelectorAll('.m:not(.me)').forEach(row => { row.hidden = safetyState().mutedFreyja; }); };
      fm.before(muteToggle, status); updateMute();
      if (!history.length) { V.playLine('welcome'); speak(9500); } if (!history.length) history.push({ role: 'assistant', content: `Welcome to ${cfg.hall || 'Fólkvangr'}! I'm ${me.name}. I can tell you about Elder World Studio, show you our games, or book a demo for your business. What brings you in?` });
      history.forEach(h => add(h.content, h.role === 'user', h.role === 'assistant'));
      fm.onsubmit = async e => { e.preventDefault(); const q = filterChatText(fm.q.value.trim()); if (!q) return; fm.q.value = ''; add(q, true); history.push({ role: 'user', content: q }); const w = add('…');
        try { const j = await (await fetch(cfg.chat || '/api/office/freyja', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-8), lang: V.lang(), playerId: reportIdentity() }) })).json();
          w.textContent = filterChatText(j.reply || 'Sorry, I lost my train of thought.'); if (safetyState().mutedFreyja) w.hidden = true; addActions(w, w.textContent); V.playReply(j.tts, () => speak(Math.min(30000, 600 + w.textContent.length * 70)), j.ttsReady); if (j.action?.lead) { const k = document.createElement('button'); k.type = 'button'; k.className = 'ob gold'; k.textContent = ctx.t('Open the request kiosk'); k.onclick = () => { V.playLine('form_open'); openKiosk(ctx, cfg.lead, sent); }; w.after(k); } history.push({ role: 'assistant', content: w.textContent });
          if (j.action?.tour) { const go = document.createElement('button'); go.type = 'button'; go.className = 'ob go'; go.textContent = ctx.t('Take me there'); go.onclick = () => ctx.goTo(j.action.tour); w.after(go); }   /* guided moves only on an explicit click */ if (j.action?.lead) setTimeout(leadForm, 900); }
        catch { w.textContent = 'I can\u2019t reach my notes right now. Try the tour buttons below!'; } };
      fm.q.focus();
    };
    if (ctx.xbox) addEventListener('ews-xbox-privileges', () => { if (!ctx.xboxChatEnabled()) ctx.closeCard(); });
    ctx.onClick(dk, () => chat()); box(1.7, 0.5, 0.04, mat.trim, x, 0.62, z + 1.52); ctx.sign(me.name, `Reception · ${ctx.verb} to chat`, x, 0.62, z + 1.55, 0, () => chat(), 1.6);
    /* digital demo kiosk on the desk: angled touchscreen facing the visitor */
    { const T = ctx.THREE, K = new T.Group(); K.position.set(x - 1.3, 1.08, z + 0.8); ctx.scene.add(K);
      const st = new T.Mesh(new T.BoxGeometry(0.08, 0.16, 0.08), mat.rack); st.position.y = 0.08; K.add(st);
      const hd = new T.Mesh(new T.BoxGeometry(0.76, 0.5, 0.03), mat.dark); hd.position.set(0, 0.36, 0); hd.rotation.x = -0.35; K.add(hd);
      const sc = ctx.panel(ctx.textCanvas(['Instant sample', 'Tap: your site, kiosk or POS'], { w: 600, h: 400, size: 76, body: 50, bg: '#0b1626' }), 0.72, 0.46, 0, 0.36, 0.018, 0, K); sc.rotation.x = -0.35; sc.material.toneMapped = false; sc.userData.plate = 'Instant sample';
      [hd, sc].forEach(o => ctx.onClick(o, () => { V.playLine('form_type'); openKiosk(ctx, cfg.lead, sent); })); }
    /* lobby logo wall straight down the red carpet behind Freyja: wood panel, backlit brass tree crest, ELDER WORLD STUDIO. Walk around either side. */
    { const T = ctx.THREE, wz = z - 3.2; box(6.4, 3.7, 0.25, mat.wood, x, 1.85, wz); box(6.4, 0.3, 0.25, mat.wall, x, 3.85, wz); box(6.6, 0.1, 0.3, mat.trim, x, 0.05, wz);
      /* wood-slat feature wall (layout v2): vertical slats over the panel, a dark backer behind the name, and a planter trough of
         greenery along the top. Slats/backer/trough are plain boxes on shared materials (batched into the wood/dark draw calls). */
      for (let sx = -3.13; sx <= 3.14; sx += 0.145) box(0.075, 3.5, 0.05, mat.wood, x + sx, 1.85, wz + 0.15).userData.noCollide = 1;
      box(4.7, 0.8, 0.03, mat.dark, x, 2.3, wz + 0.19).userData.noCollide = 1; box(4.78, 0.04, 0.04, mat.trim, x, 2.72, wz + 0.19).userData.noCollide = 1; box(4.78, 0.04, 0.04, mat.trim, x, 1.88, wz + 0.19).userData.noCollide = 1;
      { box(6.4, 0.22, 0.34, mat.dark, x, 3.66, wz + 0.25).userData.noCollide = 1; box(6.44, 0.03, 0.38, mat.trim, x, 3.78, wz + 0.25).userData.noCollide = 1;
        const lm = [0x3f7a3a, 0x2f6630, 0x5a8f45].map(c => (ctx.M.standard ? new T.MeshStandardMaterial({ color: c, roughness: 0.8 }) : new T.MeshLambertMaterial({ color: c }))), lg = [new T.IcosahedronGeometry(0.15, 0), new T.IcosahedronGeometry(0.11, 0)];
        let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 90; i++) { const lx = -3.1 + 6.2 * i / 89 + (r() - 0.5) * 0.1, trail = Math.abs(lx) > 1.0 && r() < 0.45; const n = trail ? 3 : 1;
          for (let k = 0; k < n; k++) { const o = new T.Mesh(lg[(i + k) % 2], lm[Math.floor(r() * 3)]); o.position.set(x + lx + (r() - 0.5) * 0.08, 3.84 - k * 0.17 - r() * 0.06, wz + 0.3 + r() * 0.12); o.rotation.set(r() * 3, r() * 6, 0); o.scale.setScalar(0.85 + r() * 0.5); o.userData.noCollide = 1; ctx.scene.add(o); } } }
      const hc = document.createElement('canvas'); hc.width = hc.height = 256; { const g = hc.getContext('2d'), r = g.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, 'rgba(255,214,140,.85)'); r.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); }
      const ht = new T.CanvasTexture(hc); ht.colorSpace = T.SRGBColorSpace; const halo = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), new T.MeshBasicMaterial({ map: ht, transparent: true, depthWrite: false, toneMapped: false })); halo.position.set(x, 3.05, wz + 0.2); halo.userData.dn = 'halo'; ctx.scene.add(halo);
      const lg = ctx.panel(ctx.image(ctx.site.brand.logo || '/assets/img/logo.png'), 1.1, 1.1, x, 3.0, wz + 0.21, 0); lg.material.toneMapped = false; lg.userData.label = 'Elder World Studio logo';
      const nm = ctx.panel(ctx.textCanvas(['ELDER WORLD STUDIO'], { w: 1600, h: 200, size: 104, bg: null, border: false, fg: '#e9c46a' }), 4.2, 0.6, x, 2.3, wz + 0.215, 0); nm.material.toneMapped = false; nm.userData.plate = 'ELDER WORLD STUDIO'; nm.visible = ctx.site.brand.wallText !== false; }
    /* central elevator + stairs core (the building spine) right behind the logo wall; reached by stepping around the wall
       through the RIGHT-side doorway. Same position on floors 2-5. Kept out of the entrance sightline (fully hidden by the wall). */
    { const T = ctx.THREE, cz = z - 3.2 - 2.5, W = 4.6, D = 3.0, stone = mat.stone || mat.wall, metal = mat.trim;
      const fz = cz, bz = cz - D;                                                   // front face (doors) and back face
      box(1.0, 4.0, 0.25, stone, x - W / 2 + 0.5, 2.0, fz); box(1.0, 4.0, 0.25, stone, x + W / 2 - 0.5, 2.0, fz); box(0.4, 4.0, 0.25, stone, x, 2.0, fz);   // pillars between doors
      box(W, 1.6, 0.25, stone, x, 3.2, fz);                                         // lintel above the doors (door height 2.4 m)
      box(W, 4.0, 0.25, stone, x, 2.0, bz); for (const sx of [-1, 1]) box(0.25, 4.0, D, stone, x + sx * W / 2, 2.0, cz - D / 2);
      const doors = []; for (const sx of [-0.65, 0.65]) { const d = box(1.25, 2.38, 0.06, metal, x + sx * 1.1, 1.19, fz + 0.02); doors.push(d);
        box(0.02, 2.38, 0.07, mat.dark, x + sx * 1.1, 1.19, fz + 0.03); }          // brushed brass doors with a centre seam
      for (const sx of [-1, 1]) { const ind = ctx.panel(ctx.textCanvas(['G'], { w: 128, h: 96, size: 64, bg: '#0b1626', fg: '#9fe8ff' }), 0.24, 0.18, x + sx * 1.1 * 0.65 * 2 / 1.3, 2.65, fz + 0.14, 0); ind.material.toneMapped = false; }
      const btn = box(0.08, 0.18, 0.04, mat.dark, x, 1.15, fz + 0.15); 
      const plate = ctx.panel(ctx.textCanvas([ctx.t ? ctx.t('Elevator') : 'Elevator', ctx.t ? ctx.t('Floors G to 5') : 'Floors G to 5'], { w: 640, h: 200, size: 64, body: 40 }), 1.3, 0.4, x, 3.25, fz + 0.14, 0); plate.userData.plate = 'Elevator';
      ctx.core = { x, fz, W, D }; this.floors = setupFloors(ctx, ctx.core); const call = () => this.floors.panel(); ctx.provide('floorPanel', call);
      [...doors, btn, plate].forEach(o => ctx.onClick(o, call));
      /* the old stepped blocks beside the core (a flight that went nowhere) are gone: the real stairs are modules/stairs (Joshua 2026-10-16 11:51 PM) */
      /* small elevator sign beside the right-side doorway, visible from the red carpet (faces the entrance) */
      const sg = ctx.panel(ctx.textCanvas([(ctx.t ? ctx.t('Elevator') : 'Elevator') + ' · ' + (ctx.t ? ctx.t('Stairs') : 'Stairs') + '  ›', ctx.t ? ctx.t('Floors 2 to 5') : 'Floors 2 to 5'], { w: 512, h: 200, size: 66, body: 42 }), 1.4, 0.55, x + 4.0, 3.2, z - 3.2 + 0.12, 0); sg.material.toneMapped = false; sg.userData.plate = 'Elevator';   /* on the lintel over the right-hand doorway (layout v2) */
      ctx.onClick(sg, call); }
    ctx.provide('leadForm', leadForm);
    ctx.hudButton(`Talk to ${me.name}`, chat, true);
    // greeting: she turns to look at the visitor, waves and shows a speech bubble when they come within ~4 m
    const bubble = ctx.label(`Hi, I'm ${me.name}!`, ctx.touch ? 'Tap me to chat' : 'Click me or press E to chat', '#ffffff'); bubble.position.set(0, 2.45, 0); bubble.scale.set(1.9, 0.48, 1);
    bubble.material.transparent = true; bubble.material.opacity = 0; f.add(bubble);
    let greeted = 0, near = false; const cam = ctx.cam;
    this.onFrame = dt => { this.floors?.tick(dt);
      for (let i = tickets.length - 1; i >= 0; i--) { const k = tickets[i]; k.t += dt / 6; const tk = k.tk;
        if (k.t < 0) { tk.position.y = k.from.y + (0.25 + k.t) * 0.8; tk.rotation.x = -0.6; }           /* printing: rises out of the kiosk slot */
        else if (k.t < 1) { tk.position.lerpVectors(k.from, k.to, k.t); tk.position.y += Math.sin(k.t * Math.PI) * 1.4 + 0.4; tk.rotation.y += dt * 2; }
        else { ctx.scene.remove(tk); tk.geometry.dispose(); tk.material.dispose(); tickets.splice(i, 1); V.playLine('handoff_done'); speak(4500); } } const dx = cam.position.x - f.position.x, dz = cam.position.z - f.position.z, d = Math.hypot(dx, dz), u = f.userData;
      let want = 0; if (d < 9) want = Math.max(-1.7, Math.min(1.7, Math.atan2(dx, dz)));            // look toward the visitor, never turn her back to the desk
      let diff = want - f.rotation.y; f.rotation.y += diff * Math.min(1, dt * 3);
      const isNear = d < 4; if (isNear && !near && performance.now() - greeted > 15000) { greeted = performance.now(); u.greetUntil = greeted + 2600; ctx.announce?.(`${me.name}: Hi! Welcome to Elder World Studio.`); if (navigator.userActivation?.hasBeenActive) { V.playLine('greet'); speak(2400); } }
      near = isNear; u.greeting = (u.greetUntil || 0) > performance.now();
      const tgt = d < 4.5 ? 1 : 0; bubble.material.opacity += (tgt - bubble.material.opacity) * Math.min(1, dt * 4); bubble.visible = bubble.material.opacity > 0.02; };
  },
};
