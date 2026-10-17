// Desk monitors: every screen in the office is drawn into ONE shared canvas atlas and merged into ONE mesh (1 draw
// call for all monitors). Each cell shows that agent's live work from the public feed (stage, progress) as an
// real snapshot thumbnail (CT111) + redacted task title, stage, progress. Idle desks: 'Idle' + last job. No filler.
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
export default {
  setup(ctx) {
    const { THREE } = ctx, screens = ctx.screens || []; if (!screens.length) return;
    const low = ctx.tier === 0, cw = low ? 160 : 256, ch = low ? 90 : 144, cols = 8, rows = Math.ceil(screens.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch; const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    ctx.scene.updateMatrixWorld(true);
    const geos = screens.map((m, i) => { const geo = m.geometry.clone(), uv = geo.attributes.uv, c = i % cols, r = Math.floor(i / cols);
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / cols, 1 - (r + 1 - uv.getY(k)) / rows);
      geo.applyMatrix4(m.matrixWorld); m.parent?.remove(m); return geo; });
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.userData.keep = 1; mesh.userData.noCollide = 1; ctx.scene.add(mesh);
    const owner = new Map(); for (const av of ctx.use('avatar')?.all || []) if (av.userData.monitor) owner.set(screens.indexOf(av.userData.monitor), av);
    const thumbs = { img: null, map: {}, v: null }; let last = {};
    /* ONE source of truth (2026-10-16): screens only show what the publisher's snapshot says. A step that leaves the feed (done) gets a short
       'Done' fill to 100% and then the desk goes Idle with the same 'Last:' line the board's Done column shows. Live bars ease by time from
       the publisher's anchors (since/eta/p0/p1), never past p1 (the next real milestone) and never backwards for the same task + stage. */
    const shown = new Map(), flash = new Map(); let prevWork = new Map();
    const fmt = ms => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
    const SUBL = { plan: 'planning', build: 'build', fix: 'fix pass', check: 'QA check', 'self-check': 'self-check', release: 'release step', waiting: 'queued', QA: 'QA check', review: 'review', ready: 'ready' };
    const live = (id, s) => { const key = s.task + '|' + s.stage, now = Date.now(); let e = shown.get(id);
      if (!e || e.key !== key) { e = { key, v: Math.max(0, Math.min(1, s.progress || 0)), at: now }; shown.set(id, e); }
      let tgt = Math.max(0, Math.min(1, s.progress || 0));
      const t0 = s.since ? Date.parse(s.since) : NaN;
      if (!s.blocked && s.eta && s.p1 != null && !Number.isNaN(t0)) { const x = Math.max(0, now - t0) / 1000 / s.eta, est = (s.p0 || 0) + (s.p1 - (s.p0 || 0)) * (1 - Math.exp(-1.4 * x)) / (1 - Math.exp(-1.4 * 1.6));
        tgt = Math.max(tgt, Math.min(s.p1, est)); }
      const dt = Math.min(1, (now - e.at) / 1000); e.at = now; e.v = Math.max(e.v, e.v + (tgt - e.v) * Math.min(1, dt * 1.5)); return e.v; };   /* eased, monotonic */
    const activity = s => { const t0 = s.since ? Date.parse(s.since) : NaN, el = Number.isNaN(t0) ? '' : ' · ' + fmt(Date.now() - t0); const sb = s.sub || {};
      const over = !s.blocked && s.eta && !Number.isNaN(t0) && (Date.now() - t0) / 1000 > s.eta * 1.6 ? ' · over ETA' : '';
      return (s.blocked ? 'blocked' + el : (SUBL[sb.k] || SUBL[s.stage] || s.stage) + (sb.n > 1 ? ' #' + sb.n : '') + el + over); };
    /* maker/checker pairs (Joshua 2026-10-16): when the feed puts a maker and its checker on the same job (same start time, or the same
       subject after the verb), each screen shows ITS OWN step. The checker shows its check (and findings when the publisher sends
       s.check = {n, ok, issues}); the maker shows what it handed over (s.made, else 'Submitted') and 'Waiting on <checker>'s review',
       with no copied progress bar or timer. Applies to every team (coder/reviewer, asset maker/checker, architect/layout QA ...). */
    const CHECKER = (id, role) => /(^|-)(qa|review|reviews|check|audit)(-|$)|qa$/i.test(id || '') || /\b(qa|review|reviewer|checker|inspector)\b/i.test(role || '');
    const subj = t => String(t || '').toLowerCase().replace(/^\s*(surveying|inspecting|checking|reviewing|testing|auditing|building|drafting|revising|fixing|making|qa|review)\s+/, '').trim();
    const pairs = new Map(); this.pairs = pairs;
    const findPairs = work => { pairs.clear(); const groups = new Map();
      for (const w of work) { for (const k of [w.since ? 's:' + w.since : null, w.task ? 't:' + subj(w.task) + '|' + (w.team || '') : null]) if (k) { if (!groups.has(k)) groups.set(k, new Set()); groups.get(k).add(w); } }
      for (const g of groups.values()) { if (g.size < 2) continue; const L = [...g], chk = L.filter(w => CHECKER(w.agent, w.role)), mk = L.filter(w => !CHECKER(w.agent, w.role)); if (!chk.length || !mk.length) continue;
        for (const m of mk) pairs.set(m.agent, { role: 'maker', other: chk.map(c => c.name || c.agent).join(' & ') });
        for (const c of chk) pairs.set(c.agent, { role: 'checker', other: mk.map(m => m.name || m.agent).join(' & ') }); }
      for (const av of ctx.use('avatar')?.all || []) { const id = av.userData.a?.id; av.userData.waitOn = pairs.get(id)?.role === 'maker' ? pairs.get(id).other : null; } };
    this.onState = st => { last = st.last || {}; findPairs(st.work || []);
      const nowW = new Map((st.work || []).map(w => [w.agent, w]));
      for (const [id, w] of prevWork) if (!nowW.has(id)) flash.set(id, { task: w.task, until: Date.now() + 8000, from: shown.get(id)?.v || w.progress || 0, t0: Date.now() });
      for (const id of nowW.keys()) flash.delete(id); prevWork = nowW; const th = st.thumbs; if (th && th.v !== thumbs.v) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { thumbs.img = im; thumbs.map = th.map || {}; thumbs.v = th.v; }; im.src = '/api/office/thumbs?v=' + th.v; } };
    const draw = (i, t) => { const av = owner.get(i), u = av?.userData || {}, a = u.a || {}, s = u.state || {}, x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, f = cw / 256;
      g.save(); g.beginPath(); g.rect(x0, y0, cw, ch); g.clip(); g.translate(x0, y0); g.scale(f, f);
      const work = !!s.stage;
      if (ctx.publicMode) { g.fillStyle = '#0f1420'; g.fillRect(0, 0, 256, 144); for (let r = 0; r < 9; r++) { const w0 = 30 + ((i * 37 + r * 53) % 150); g.fillStyle = ['#3a5a8c', '#6a8f5a', '#8c6a3a', '#5a5a7a'][(i + r) % 4]; g.fillRect(14 + ((r * 17) % 30), 14 + r * 13, w0, 6); } g.restore(); return; }   /* public: stylized generic UI only */
      if (!av) { g.fillStyle = '#07090d'; g.fillRect(0, 0, 256, 144); g.restore(); return; }          /* unowned screen: switched off, never filler */
      const STG = { waiting: 'Queued', plan: 'Planning', build: 'Building', 'self-check': 'Self-check', QA: 'In QA', review: 'Waiting for review', ready: 'Ready to ship', released: 'Released' };
      const cell = work && thumbs.img ? thumbs.map[a.id] : undefined;
      g.fillStyle = '#0f1420'; g.fillRect(0, 0, 256, 144);
      if (cell != null) { const n = 8, sw = thumbs.img.width / n; g.drawImage(thumbs.img, (cell % n) * sw, Math.floor(cell / n) * (sw * 108 / 192), sw, sw * 108 / 192, 0, 0, 256, 144);   /* real snapshot of the job (CT111, ~1/min) */
        g.fillStyle = 'rgba(8,11,18,.82)'; g.fillRect(0, 96, 256, 48); }
      g.fillStyle = 'rgba(20,28,44,.92)'; g.fillRect(0, 0, 256, 16); g.fillStyle = '#d9e2f2'; g.font = '600 10px Inter, system-ui, sans-serif'; g.fillText(a.name || '', 6, 12);
      const fl = !work && flash.get(a.id); if (fl && Date.now() > fl.until) flash.delete(a.id);
      if (fl && Date.now() <= fl.until) { const k = Math.min(1, (Date.now() - fl.t0) / 1500), v = fl.from + (1 - fl.from) * k;
        g.fillStyle = '#ffffff'; g.font = '700 14px Inter, sans-serif'; g.fillText(String(fl.task || '').slice(0, 30), 8, 48);
        g.fillStyle = '#5fd38a'; g.font = '700 20px Inter, sans-serif'; g.fillText('\u2713 Done', 8, 90); g.font = '600 12px Inter, sans-serif'; g.fillText(Math.round(v * 100) + '%', 210, 128);
        g.fillStyle = '#26324a'; g.fillRect(6, 136, 244, 4); g.fillStyle = '#5fd38a'; g.fillRect(6, 136, 244 * v, 4); }
      else if (!work) { g.fillStyle = '#9fb0cc'; g.font = '700 28px Inter, sans-serif'; g.fillText(ctx.t ? ctx.t('Idle') : 'Idle', 96, 70);
        const l = last[a.id]; if (l) { g.font = '11px Inter, sans-serif'; g.fillStyle = '#7f8ea8'; g.fillText(('Last: ' + l).slice(0, 44), 8, 110); } }
      else if (s.asset) { const A = s.asset, alive = A.step === 'generating' || A.step === 'checking';   /* asset desk (2026-10-16): asset name + live step */
        const SL = { generating: ['Generating', '#d9b45a'], checking: ['Checking', '#6fb7ff'], PASS: ['PASS', '#5fd38a'], FAIL: ['FAIL', '#ff7a7a'], HOLD: ['On hold', '#c0a0ff'] }[A.step] || [A.step, '#d9b45a'];
        const y1 = cell != null ? 112 : 46; g.fillStyle = '#ffffff'; g.font = '700 ' + (cell != null ? 15 : 20) + 'px Inter, sans-serif'; g.fillText(String(A.name).slice(0, 26), 8, y1);
        if (cell == null) { g.font = '500 11px Inter, sans-serif'; g.fillStyle = '#8ea0c0'; g.fillText(A.kind + (A.more ? ' · +' + A.more + ' more building' : ''), 8, 64); }
        g.font = '700 13px Inter, sans-serif'; g.fillStyle = SL[1]; const lab = SL[0] + (alive ? ' · try ' + A.try : '') + (alive ? '.'.repeat(1 + Math.floor(performance.now() / 500) % 3) : '');
        g.fillText(lab, 8, cell != null ? 129 : 100); if (A.left && cell == null) { g.font = '500 11px Inter, sans-serif'; g.fillStyle = '#7f8ea8'; g.fillText(A.left + ' in queue', 190, 100); }
        const P = alive ? live(a.id, s) : 1; if (alive && s.since) { g.font = '500 10px Inter, sans-serif'; g.fillStyle = '#8ea0c0'; g.fillText(fmt(Date.now() - Date.parse(s.since)) + ' · ' + Math.round(P * 100) + '%', 196, cell != null ? 129 : 116); }
        g.fillStyle = '#26324a'; g.fillRect(6, 136, 244, 4); g.fillStyle = SL[1]; g.fillRect(6, 136, 244 * P, 4); }
      else if (pairs.get(a.id)?.role === 'maker') { const pr = pairs.get(a.id), y0 = cell != null ? 112 : 40;   /* maker on a job its checker is checking: its own step, no mirrored bar/timer */
        g.fillStyle = '#ffffff'; g.font = '700 14px Inter, sans-serif'; let t1 = String(s.made || ('Submitted: ' + subj(s.task))); while (g.measureText(t1).width > 240 && t1.length > 8) t1 = t1.slice(0, -2); g.fillText(t1, 8, y0);
        g.fillStyle = '#8ea0c0'; g.font = '600 12px Inter, sans-serif'; let t2 = (s.revising ? 'Revising: ' + s.revising : 'Waiting on ' + pr.other + "'s review"); while (g.measureText(t2).width > 240 && t2.length > 8) t2 = t2.slice(0, -2); g.fillText(t2, 8, cell != null ? 129 : 112); }
      else { const title = String(s.task || ''), y0 = cell != null ? 112 : 40, maxL = cell != null ? 1 : 3; g.fillStyle = '#ffffff'; g.font = '700 14px Inter, sans-serif';
        let ln = '', y = y0, L = 0; for (const w of title.split(/\s+/)) { if (g.measureText(ln + w).width > 240 && ln) { g.fillText(ln.trim(), 8, y); y += 18; ln = ''; if (++L >= maxL) break; } ln += w + ' '; } if (L < maxL && ln.trim()) g.fillText(ln.trim(), 8, y);
        const P = live(a.id, s), ck = s.check, lab = ck && ck.n ? 'Checking ' + ck.n + ': ' + (ck.ok ?? 0) + ' OK' + (ck.issues ? ', ' + ck.issues + ' flagged' : '') : (STG[s.stage] || s.stage) + (s.blocked ? ' · blocked' : '') + ' · ' + Math.round(P * 100) + '%', ac = activity(s);
        g.fillStyle = s.blocked ? '#ff8a8a' : '#d9b45a';
        if (cell != null) { g.font = '600 11px Inter, sans-serif'; let line = lab + '  ' + ac; while (g.measureText(line).width > 240 && line.length > 8) line = line.slice(0, -2); g.fillText(line, 8, 129); }
        else { g.font = '600 12px Inter, sans-serif'; g.fillText(lab, 8, 112); g.font = '500 11px Inter, sans-serif'; g.fillStyle = '#8ea0c0'; g.fillText(ac, 8, 127); }   /* live activity: sub-step + elapsed, ticks every second */
        g.fillStyle = '#26324a'; g.fillRect(6, 136, 244, 4); g.fillStyle = s.blocked ? '#ff8a8a' : '#d9b45a'; g.fillRect(6, 136, 244 * Math.max(0.03, Math.min(1, P)), 4); }
      g.restore(); };
    for (let i = 0; i < screens.length; i++) draw(i, 0); tex.needsUpdate = true;
    let acc = 0, next = 0; this.onFrame = (dt, t) => { acc += dt; if (acc < 0.5) return; acc = 0; for (let k = 0; k < 4; k++) { draw(next, t); next = (next + 1) % screens.length; } for (const [i, av] of owner) { const u = av.userData; if (u.state?.stage || flash.has(u.a?.id)) draw(i, t); } tex.needsUpdate = true; };
  },
};
