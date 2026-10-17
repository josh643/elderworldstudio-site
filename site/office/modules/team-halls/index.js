// Team halls: one snap-together room per team in roster.json (from CT111 policy/teams.json), one desk per member,
// QA bench + "waiting on Joshua" tray per room. New team in teams.json = new room on rebuild.
const COLS = [0x5b8def, 0xe0794a, 0x6cc48a, 0xc86ad9, 0xe2c35a, 0x4ac4c8, 0xe25a7a, 0x9a8cff, 0x8fd14f];
let G2 = null;
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { THREE, box, M, roster } = ctx, A = ctx.use('avatar'), cols = cfg.cols || 3, W = cfg.w || 10, D = cfg.d || 9, teams = roster.teams;
    const totalW = cols * W, rooms = {}; this.rooms = rooms; this.A = A; this.ctx = ctx;
    teams.forEach((t, i) => {
      const cx = x0 - totalW / 2 + (i % cols) * W + W / 2, cz = z0 - Math.floor(i / cols) * D - D / 2, col = COLS[i % COLS.length];
      (ctx.teamSpot ||= {})[t.key || t.id] = [cx, cz];   /* Freyja's ticket handoff target */
      ctx.kit.room(ctx, { x: cx, z: cz, w: W, d: D, floor: new THREE.Color(col).multiplyScalar(0.25).getHex(), title: ctx.publicMode && /money|cfo/i.test(t.key + t.name) ? 'Private Office' : t.name, sub: ctx.publicMode ? '' : `${t.members.length} agents`, enclose: true, doorX: Math.abs(cx - x0) < 0.5 ? W / 2 - 1.4 : 0 });   /* the room straight behind the lobby logo wall gets its door at the side */
      // QA bench: a real work table with a test tablet; review tray: a low filing cabinet with an in-tray on top
      const qx = cx + W / 2 - 1.3, qz = cz + D / 2 - 1.4, tx = cx - W / 2 + 1.1, tz = cz + D / 2 - 1.3, mt = ctx.mat;
      /* QA station: a full seated desk (chair, monitor with test results, keyboard, mouse) plus a test phone and tablet on stands */
      const qd = ctx.kit.desk(ctx, qx, qz + 0.3), qa = qd.desk; qd.monitor.userData.role = 'qa';
      { const st = (w, h, x) => { box(0.05, 0.08, 0.06, mt.rack, x, 0.8, qz - 0.2); const d = box(w, h, 0.012, mt.dark, x, 0.84 + h / 2, qz - 0.22); d.rotation.x = -0.25; const sc = box(w * 0.88, h * 0.9, 0.004, mt.glow || mt.trim, x, 0.84 + h / 2, qz - 0.213); sc.rotation.x = -0.25; };
        st(0.08, 0.16, qx - 0.52); st(0.24, 0.17, qx + 0.5); }
      const tray = box(0.8, 0.72, 0.5, mt.rack, tx, 0.36, tz); box(0.5, 0.06, 0.34, mt.trim, tx, 0.75, tz); for (const y of [0.2, 0.5]) box(0.7, 0.012, 0.01, mt.trim, tx, y, tz + 0.255);
      // room dressing (batched): whiteboard with the team's notes, water cooler, printer, filing cabinet, plant
      { const bz = cz - D / 2 + 0.55, T3 = THREE, add = (geo, m, x, y, z) => { const o = new T3.Mesh(geo, m); o.position.set(x, y, z); ctx.scene.add(o); return o; };
        G2 ||= { post: new T3.BoxGeometry(0.05, 1.9, 0.05), cyl: new T3.CylinderGeometry(0.15, 0.15, 0.95, 16), jug: new T3.CylinderGeometry(0.13, 0.11, 0.38, 16), leaf: new T3.IcosahedronGeometry(0.32, 1), pot: new T3.CylinderGeometry(0.18, 0.14, 0.34, 14),
          white: new T3.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.5 }), water: new T3.MeshStandardMaterial({ color: 0x8ec9ee, roughness: 0.1, metalness: 0.1 }), green: new T3.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8, flatShading: true }), clay: new T3.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 }), grey: new T3.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.5 }) };
        /* live whiteboard: Now / Next / Done from the status feed (redacted task titles only); redrawn on each state change */
        const wc = document.createElement('canvas'); wc.width = 1024; wc.height = 560; const wtx = new THREE.CanvasTexture(wc); wtx.colorSpace = THREE.SRGBColorSpace;
        /* whiteboard is WALL-MOUNTED with an aluminium frame + marker tray (the free-standing post version read as a stray pole, Joshua 2026-10-16) */
        const wz = cz - D / 2 + 0.14, alu = G2.alu ||= new T3.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.6 });
        add(new T3.BoxGeometry(1.92, 1.1, 0.03), alu, cx, 1.35, wz - 0.02); add(new T3.BoxGeometry(1.5, 0.04, 0.07), alu, cx, 0.79, wz + 0.03);
        const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.98), new THREE.MeshBasicMaterial({ map: wtx, toneMapped: false })); wb.position.set(cx, 1.35, cz - D / 2 + 0.14); ctx.scene.add(wb); wb.userData.label = t.name + ' whiteboard'; wb.userData.keep = 1;
        (this.boards ||= {})[t.key] = { c: wc, tx: wtx, name: t.name, ids: new Set((t.members || []).map(m => m.id)) };
        add(G2.cyl, G2.white, cx + W / 2 - 0.6, 0.48, bz); add(G2.jug, G2.water, cx + W / 2 - 0.6, 1.14, bz);
        const pr = add(new T3.BoxGeometry(0.55, 0.35, 0.45), G2.grey, cx - W / 2 + 0.7, 0.92, bz); add(new T3.BoxGeometry(0.6, 0.74, 0.5), mt.wood, cx - W / 2 + 0.7, 0.37, bz);
        add(new T3.BoxGeometry(0.45, 1.1, 0.55), mt.rack, cx - W / 2 + 1.4, 0.55, bz);
        ctx.kit.plant(ctx, cx + W / 2 - 1.3, bz, 1); }
      rooms[t.key] = { qa: new THREE.Vector3(qx, 0, qz + 0.3), tray: tray.position.clone().setY(0).add(new THREE.Vector3(0.6, 0, 0.6)) };
      const per = Math.ceil(t.members.length / 2);
      t.members.forEach((a, j) => {
        const dx = cx + ((j % per) - (per - 1) / 2) * 1.8, dz = cz + (Math.floor(j / per) ? -2.2 : 0.4);
        const { monitor } = ctx.kit.desk(ctx, dx, dz);
        const av = A.make(a, col, () => { const s = av.userData.state || {}; ctx.card(`<h3>${ctx.esc(a.name)}</h3><p>${ctx.esc(a.role)} · ${ctx.esc(t.name)}</p><p>${s.stage ? `Working · stage <b>${ctx.esc(s.stage)}</b> · ${Math.round((s.progress || 0) * 100)}%${s.blocked ? ' · <b>blocked</b>' : ''}` : 'Idle at the desk'}</p>`); });
        av.position.set(dx, 0, dz); av.rotation.y = Math.PI; Object.assign(av.userData, { home: new THREE.Vector3(dx, 0, dz), team: t.key, monitor }); ctx.scene.add(av);
      });
      ctx.spot('team-' + t.key, [cx, 2.2, cz + D / 2 + 1.5], [cx, 0.8, cz - 1]);
    });
    const minZ = z0 - Math.ceil(teams.length / cols) * D;
    ctx.spot('teams', [x0, 4.5, z0 + 5], [x0, 0, (z0 + minZ) / 2], 'Teams');
    return { minZ };
  },
  // live stage -> where the avatar walks (desk / QA bench / tray / Odin's dais / release gate)
  drawBoards(s) {
    const work = s.work || [], last = s.last || {};
    for (const [k, b] of Object.entries(this.boards || {})) { const g = b.c.getContext('2d'); g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 1024, 560);
      g.fillStyle = '#1d2a44'; g.font = '700 46px Inter, sans-serif'; g.fillText(b.name, 30, 60); g.fillStyle = '#c9ced6'; g.fillRect(30, 80, 964, 3);
      if (this.ctx.publicMode) { g.fillStyle = '#4a5568'; g.font = '500 30px Inter, sans-serif'; g.fillText('Plan · Build · Test · Ship', 30, 150); b.tx.needsUpdate = true; continue; }
      const mine = work.filter(w => w.team === k || b.ids.has(w.agent));
      const cols = [['Now', mine.filter(w => !['waiting', 'ready', 'released'].includes(w.stage))], ['Next', mine.filter(w => w.stage === 'waiting')], ['Done', [...mine.filter(w => ['ready', 'released'].includes(w.stage)), ...Object.entries(last).filter(([a]) => b.ids.has(a)).map(([a, t]) => ({ task: t }))]]];
      cols.forEach(([h, L], i) => { const x = 30 + i * 330; g.fillStyle = ['#b8452f', '#a07a1c', '#2f7d4a'][i]; g.font = '700 34px Inter, sans-serif'; g.fillText(this.ctx.t ? this.ctx.t(h) : h, x, 130);
        g.fillStyle = '#1d2a44'; g.font = '500 24px Inter, sans-serif'; let y = 172;
        if (!L.length) { g.fillStyle = '#8a93a3'; g.fillText('—', x, y); }
        for (const w of L.slice(0, 5)) { const txt = String(w.task || '').trim(); if (!txt) continue; let ln = '', n = 0; for (const wd of txt.split(' ')) { if (g.measureText(ln + wd).width > 300 && ln) { g.fillText(ln, x, y); y += 28; ln = ''; if (++n >= 2) break; } ln += wd + ' '; } if (n < 2) { g.fillText(ln, x, y); y += 28; } y += 14; if (y > 530) break; } });
      b.tx.needsUpdate = true; }
  },
  onFrame(dt) {
    if (!this.A) return; const t = performance.now() / 1000;
    for (const av of this.A.all) { const u = av.userData; if (!u.team || !u.home || (u.state && u.state.stage)) continue; const r = this.rooms[u.team]; if (!r) continue;
      if (!u.wander || t > u.wander.until) { const pts = [r.qa, r.tray, u.home, u.home.clone().add(new this.ctx.THREE.Vector3(0, 0, 1.4))], p = pts[Math.floor(Math.random() * pts.length)];
        u.wander = { until: t + 12 + Math.random() * 18 }; u.target = p; } }
  },
  onState(s) {
    this.drawBoards(s);
    const agents = this.ctx.use('agents'), dais = this.ctx.use('dais'), gate = this.ctx.use('gate');
    for (const av of this.A.all) if (av.userData.team) { av.userData.state = {}; av.userData.target = av.userData.home; }
    for (const w of s.work || []) {
      const av = agents.get(w.agent); if (!av || !av.userData.team) continue; const u = av.userData, r = this.rooms[u.team]; u.state = w;
      /* quality checklist (Joshua 2026-10-16): an agent whose desk screen shows active work is SEATED at that desk facing it;
         only a released task sends them to the gate. Agents with no work wander their room (see onFrame). */
      u.target = w.stage === 'released' && gate ? gate : u.home; u.wander = null;
    }
  },
};
