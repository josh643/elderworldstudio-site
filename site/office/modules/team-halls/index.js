// Team halls: one snap-together room per team in roster.json (from CT111 policy/teams.json), one desk per member,
// QA bench + "waiting on Joshua" tray per room. New team in teams.json = new room on rebuild.
const COLS = [0x5b8def, 0xe0794a, 0x6cc48a, 0xc86ad9, 0xe2c35a, 0x4ac4c8, 0xe25a7a, 0x9a8cff, 0x8fd14f];
let G2 = null;
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { THREE, box, M, roster } = ctx, A = ctx.use('avatar'), cols = cfg.cols || 3, W = cfg.w || 10, D = cfg.d || 9, teams = roster.teams;   /* every roster team (filter removed 2026-10-16, arch-studio request): upper-floor teams (floor != 'G', e.g. architecture on Floor 3) get their avatars here but no ground room; their floor module (modules/arch-studio) gives them desks and chairs */
    const totalW = cols * W, rooms = {}; this.rooms = rooms; this.A = A; this.ctx = ctx; let gi = 0, ui = 0; const upSlots = {};
    teams.forEach(t => {
      if (t.floor && t.floor !== 'G') { const col = COLS[(gi + 4) % COLS.length]; for (const a of t.members) { const av = A.make(a, col, () => { const s = av.userData.state || {}; ctx.card(`<h3>${ctx.esc(a.name)}</h3><p>${ctx.esc(a.role)} · ${ctx.esc(t.name)} (Floor ${ctx.esc(t.floor)})</p><p>${s.stage ? `Working · stage <b>${ctx.esc(s.stage)}</b>` : 'In the studio'}</p>`); }); av.userData.team = t.key; av.userData.floorTeam = t.floor; ctx.scene.add(av); } return; }
      /* 2026-10-16 (Joshua): the teams moved to their own floors; G keeps only the lobby. cfg.floors maps team key -> floor;
         each upper floor has two room slots flanking the elevator core along the back wall, doors facing the open floor
         (floor n sits at x + (n-1)*400, core/floors.js). Unmapped teams still get a ground-floor room behind the lobby. */
      const fl = cfg.floors?.[t.key], core = ctx.core, up = fl && fl !== 'G' && core;
      let cx, cz, col;
      if (up) { const k = (upSlots[fl] = (upSlots[fl] ?? -1) + 1), sx = cfg.slots?.[fl]?.[k] ?? (k ? 1 : -1); cx = core.x + (+fl - 1) * 400 + sx * (core.W / 2 + 0.9 + W / 2); cz = core.fz + 1.1 - D / 2; col = COLS[(ui++ + 1) % COLS.length]; }
      if (up) ((ctx.upperTeams ||= {})[fl] ||= []).push({ key: t.key, name: t.name, x: cx, z: cz });
      else { const i = gi++; cx = x0 - totalW / 2 + (i % cols) * W + W / 2; cz = z0 - Math.floor(i / cols) * D - D / 2; col = COLS[i % COLS.length]; }
      (ctx.teamSpot ||= {})[t.key || t.id] = [cx, cz];   /* Freyja's ticket handoff target */
      ctx.kit.room(ctx, { x: cx, z: cz, w: W, d: D, floor: new THREE.Color(col).multiplyScalar(0.25).getHex(), title: ctx.publicMode && /money|cfo/i.test(t.key + t.name) ? 'Private Office' : t.name, sub: ctx.publicMode ? '' : `${t.members.length} agents`, enclose: true, doorX: !up && Math.abs(cx - x0) < 0.5 ? W / 2 - 1.4 : 0, noExtend: !!up });   /* the room straight behind the lobby logo wall gets its door at the side */
      // QA bench: a real work table with a test tablet; review tray: a low filing cabinet with an in-tray on top
      const qx = cx + W / 2 - 1.3, qz = cz + D / 2 - 1.4, tx = cx - W / 2 + 0.38, tz = cz + D / 2 - 1.3, mt = ctx.mat;
      /* QA station: a full seated desk (chair, monitor with test results, keyboard, mouse) plus a test phone and tablet on stands */
      const qd = ctx.kit.desk(ctx, qx, qz + 0.3), qa = qd.desk; qd.monitor.userData.role = 'qa'; if (qd.seat) { qd.seat.kind = 'qa'; qd.seat.aisle = 0.7; qd.seat.aislePt.set(qx, 0, qz + 0.3 + 0.7); qd.seat.label = t.name + ' QA'; }
      { const st = (w, h, x) => { box(0.05, 0.08, 0.06, mt.rack, x, 0.8, qz - 0.2); const d = box(w, h, 0.012, mt.dark, x, 0.84 + h / 2, qz - 0.22); d.rotation.x = -0.25; const sc = box(w * 0.88, h * 0.9, 0.004, mt.glow || mt.trim, x, 0.84 + h / 2, qz - 0.213); sc.rotation.x = -0.25; };
        st(0.08, 0.16, qx - 0.52); st(0.24, 0.17, qx + 0.5); }
      /* review tray = a proper two-drawer filing cabinet against the side wall (front faces into the room) with a wire
         in-tray and papers on top; it used to stand 1.1 m out in the open and read as a stray grey box (Joshua 2026-10-16) */
      const tray = box(0.5, 0.72, 0.8, mt.rack, tx, 0.36, tz);
      for (const y of [0.18, 0.54]) { box(0.012, 0.32, 0.74, mt.dark || mt.rack, tx + 0.256, y, tz); box(0.02, 0.025, 0.2, mt.trim, tx + 0.27, y + 0.1, tz); box(0.014, 0.05, 0.1, M(0xf2efe6), tx + 0.264, y + 0.13, tz - 0.22); }
      box(0.36, 0.012, 0.3, mt.trim, tx, 0.726, tz - 0.12); for (const sx of [-1, 1]) box(0.012, 0.06, 0.3, mt.trim, tx + sx * 0.18, 0.756, tz - 0.12); box(0.3, 0.025, 0.22, M(0xf2efe6), tx, 0.745, tz - 0.12);
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
      /* places an idle agent can go: the shared QA chair (seat lock) or a standing spot with a facing and a moment;
         every spot holds one agent at a time */
      const SP = (x, z, rot, k, label) => Object.assign(new THREE.Vector3(x, 0, z), { rot, k, label, holder: null });
      const deskRects = [[qx - 0.95, qz + 0.3 - 1.2, qx + 0.95, qz + 0.3 - 0.05]];
      rooms[t.key] = { cx, cz, W, D, doorX: !up && Math.abs(cx - x0) < 0.5 ? W / 2 - 1.4 : 0, floor: up ? fl : 'G', deskRects, qa: qd.seat ? qd.seat.root : new THREE.Vector3(qx, 0, qz + 0.3), tray: SP(tx + 0.75, tz, -Math.PI / 2, 'inspect', 'review tray'),
        spots: [SP(cx - 0.35, cz - D / 2 + 1.0, Math.PI, 'inspect', 'whiteboard'), SP(cx + 0.45, cz - D / 2 + 1.05, Math.PI, 'present', 'whiteboard'), SP(cx + W / 2 - 0.6, cz - D / 2 + 1.05, Math.PI, 'stand', 'water cooler'), SP(tx + 0.75, tz, -Math.PI / 2, 'inspect', 'review tray'), SP(cx - W / 2 + 0.7, cz - D / 2 + 1.0, Math.PI, 'stand', 'printer')] };
      const per = Math.ceil(t.members.length / 2);
      t.members.forEach((a, j) => {
        const dx = cx + ((j % per) - (per - 1) / 2) * 1.8, dz = cz + (Math.floor(j / per) ? -2.2 : 0.4);
        rooms[t.key].deskRects.push([dx - 0.95, dz - 1.2, dx + 0.95, dz - 0.05]);
        const { monitor, seat } = ctx.kit.desk(ctx, dx, dz); if (seat) { seat.owner = a.id; seat.label = a.name; }
        const av = A.make(a, col, () => { const s = av.userData.state || {}; ctx.card(`<h3>${ctx.esc(a.name)}</h3><p>${ctx.esc(a.role)} · ${ctx.esc(t.name)}</p>${s.asset ? `<p>Asset desk · <b>${ctx.esc(s.asset.name)}</b> (${ctx.esc(s.asset.kind)}) · ${ctx.esc(s.asset.step)}${s.asset.left ? ` · ${s.asset.left} in queue` : ''}</p>` : ''}<p>${s.stage ? `Working · stage <b>${ctx.esc(s.stage)}</b> · ${Math.round((s.progress || 0) * 100)}%${s.blocked ? ' · <b>blocked</b>' : ''}` : 'Idle at the desk'}</p>`); });
        const home = seat ? seat.root : new THREE.Vector3(dx, 0, dz); av.position.set(home.x, 0, home.z); av.rotation.y = Math.PI; Object.assign(av.userData, { home   /* start ON the own chair (seated from frame 1), not at the desk centre */, team: t.key, monitor }); ctx.scene.add(av);
      });
      ctx.spot('team-' + t.key, [cx, 2.2, cz + D / 2 + 1.5], [cx, 0.8, cz - 1]);
    });
    /* walking routes inside a room: a straight leg that would cut through a desk goes round by the side lane instead,
       and legs into/out of the room go through the doorway */
    const inRoom = (r, p) => Math.abs(p.x - r.cx) < r.W / 2 - 0.1 && Math.abs(p.z - r.cz) < r.D / 2 - 0.1;
    const hits = (r, a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1); for (let i = 1; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n; for (const q of r.deskRects) if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) return true; } return false; };
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    ctx.provide('route', (a, b) => { const r = Object.values(rooms).find(q => inRoom(q, a)) || Object.values(rooms).find(q => inRoom(q, b)); if (!r) return [];
      const out = [], ia = inRoom(r, a), ib = inRoom(r, b), front = r.cz + r.D / 2 - 0.75, dx = r.cx + r.doorX;
      const lane = p => { const lx = r.cx + (p.x >= r.cx ? 1 : -1) * (r.W / 2 - 0.65); return lx; };
      if (ia && ib) { if (!hits(r, a, b)) return []; const lx = lane(Math.abs(a.x - r.cx) > Math.abs(b.x - r.cx) ? a : b); return [V(lx, a.z), V(lx, b.z)]; }
      if (ia && !ib) { const p1 = V(dx, front); if (hits(r, a, p1)) { const lx = lane(a); out.push(V(lx, a.z), V(lx, front)); } out.push(p1, V(dx, r.cz + r.D / 2 + 0.8)); return out; }
      const p0 = V(dx, r.cz + r.D / 2 + 0.8), p1 = V(dx, front); out.push(p0, p1); if (hits(r, p1, b)) { const lx = lane(b); out.push(V(lx, front), V(lx, b.z)); } return out; });
    const minZ = z0 - Math.ceil(gi / cols) * D;
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
    for (const av of this.A.all) { const u = av.userData; if (!u.team || !u.home || u.selfDriven || (u.state && u.state.stage)) continue; const r = this.rooms[u.team]; if (!r) continue;
      if (!u.wander || t > u.wander.until) {
        /* idle agents: mostly at their own desk (seated life moments), sometimes the whiteboard, cooler, printer, tray or QA chair.
           Spots and chairs are exclusive: a taken one is skipped, never shared. */
        if (u.spot) { u.spot.holder = null; u.spot = null; } u.spotK = null;
        const roll = Math.random(); let p = u.home;
        if (roll < 0.35) { const free = r.spots.filter(q => !q.holder); if (free.length) { const q = free[Math.floor(Math.random() * free.length)]; q.holder = av; u.spot = q; p = q; } }
        /* (idle agents no longer borrow the QA chair: sitting in another desk's chair read as 'seated off his desk', Joshua 2026-10-16) */
        const atHome = p === u.home; u.wander = { until: t + (atHome ? 25 + Math.random() * 35 : 10 + Math.random() * 12) }; u.target = p; }
      /* the moment at a standing spot starts once they arrive and face it */
      if (u.spot && u.target === u.spot) u.spotK = Math.hypot(av.position.x - u.spot.x, av.position.z - u.spot.z) < 0.06 ? u.spot.k : null; }
  },
  onState(s) {
    this.drawBoards(s); const t0 = performance.now() / 1000;
    const agents = this.ctx.use('agents'), dais = this.ctx.use('dais'), gate = this.ctx.use('gate');
    for (const av of this.A.all) if (av.userData.team && !av.userData.selfDriven) { const u = av.userData; u.state = {}; if (u.wander && t0 < u.wander.until) continue; if (u.spot) { u.spot.holder = null; u.spot = null; } u.spotK = null; u.target = u.home; }
    for (const av of this.A.all) if (av.userData.serverAct) av.userData.state = {};
    for (const w of s.work || []) {
      const av = agents.get(w.agent); if (!av || !av.userData.team) continue; const u = av.userData, r = this.rooms[u.team]; if (u.selfDriven) { if (u.serverAct) u.state = w; continue; } u.state = w;   /* server-driven agents keep their live state (desk screen + clip), the server decides where they go */
      /* quality checklist (Joshua 2026-10-16): an agent whose desk screen shows active work is SEATED at that desk facing it;
         only a released task sends them to the gate. Agents with no work wander their room (see onFrame). */
      if (u.spot) { u.spot.holder = null; u.spot = null; } u.spotK = null; u.target = w.stage === 'released' && gate && Math.abs(gate.x - u.home.x) < 150 ? gate : u.home;   /* the release gate is on G: agents on upper floors stay at their desk */ u.wander = null;
    }
  },
};
