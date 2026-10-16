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
      ctx.kit.room(ctx, { x: cx, z: cz, w: W, d: D, floor: new THREE.Color(col).multiplyScalar(0.25).getHex(), title: t.name, sub: `${t.members.length} agents`, enclose: true });
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
        const notes = [t.name, ...(t.members || []).slice(0, 4).map(m => '• ' + m.name + ': ' + (m.role || '')), 'Ship small. Test on a phone.'];
        for (const sx of [-0.95, 0.95]) add(G2.post, mt.rack, cx + sx, 0.95, bz);
        const wb = ctx.panel(ctx.textCanvas(notes, { w: 1024, h: 560, size: 58, bg: '#f4f6f8', fg: '#1d2a44' }), 1.8, 0.98, cx, 1.35, bz + 0.03, 0); wb.userData.label = t.name + ' whiteboard';
        add(G2.cyl, G2.white, cx + W / 2 - 0.6, 0.48, bz); add(G2.jug, G2.water, cx + W / 2 - 0.6, 1.14, bz);
        const pr = add(new T3.BoxGeometry(0.55, 0.35, 0.45), G2.grey, cx - W / 2 + 0.7, 0.92, bz); add(new T3.BoxGeometry(0.6, 0.74, 0.5), mt.wood, cx - W / 2 + 0.7, 0.37, bz);
        add(new T3.BoxGeometry(0.45, 1.1, 0.55), mt.rack, cx - W / 2 + 1.4, 0.55, bz);
        add(G2.pot, G2.clay, cx + W / 2 - 1.3, 0.17, bz); add(G2.leaf, G2.green, cx + W / 2 - 1.3, 0.62, bz); }
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
  onState(s) {
    const agents = this.ctx.use('agents'), dais = this.ctx.use('dais'), gate = this.ctx.use('gate');
    for (const av of this.A.all) if (av.userData.team) { av.userData.state = {}; av.userData.target = av.userData.home; }
    for (const w of s.work || []) {
      const av = agents.get(w.agent); if (!av || !av.userData.team) continue; const u = av.userData, r = this.rooms[u.team]; u.state = w;
      u.target = w.stage === 'QA' && r ? r.qa : w.stage === 'ready' && r ? r.tray : w.stage === 'review' && dais ? dais : w.stage === 'released' && gate ? gate : u.home;
    }
  },
};
