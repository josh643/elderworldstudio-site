// Team halls: one snap-together room per team in roster.json (from CT111 policy/teams.json), one desk per member,
// QA bench + "waiting on Joshua" tray per room. New team in teams.json = new room on rebuild.
const COLS = [0x5b8def, 0xe0794a, 0x6cc48a, 0xc86ad9, 0xe2c35a, 0x4ac4c8, 0xe25a7a, 0x9a8cff, 0x8fd14f];
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { THREE, box, M, roster } = ctx, A = ctx.use('avatar'), cols = cfg.cols || 3, W = cfg.w || 10, D = cfg.d || 9, teams = roster.teams;
    const totalW = cols * W, rooms = {}; this.rooms = rooms; this.A = A; this.ctx = ctx;
    teams.forEach((t, i) => {
      const cx = x0 - totalW / 2 + (i % cols) * W + W / 2, cz = z0 - Math.floor(i / cols) * D - D / 2, col = COLS[i % COLS.length];
      ctx.kit.room(ctx, { x: cx, z: cz, w: W, d: D, floor: new THREE.Color(col).multiplyScalar(0.25).getHex(), title: t.name + ' hall', sub: `${t.members.length} agents` });
      // QA bench: a real work table with a test tablet; review tray: a low filing cabinet with an in-tray on top
      const qx = cx + W / 2 - 1.3, qz = cz + D / 2 - 1.4, tx = cx - W / 2 + 1.1, tz = cz + D / 2 - 1.3, mt = ctx.mat;
      const qa = box(1.4, 0.04, 0.7, mt.wood, qx, 0.74, qz); for (const sx of [-0.65, 0.65]) for (const sz of [-0.3, 0.3]) box(0.04, 0.72, 0.04, mt.rack, qx + sx, 0.36, qz + sz);
      box(0.32, 0.015, 0.22, mt.glow || mt.dark, qx - 0.2, 0.77, qz); box(0.36, 0.01, 0.26, mt.dark, qx - 0.2, 0.765, qz);
      ctx.sign('QA bench', '', qx, 1.25, qz - 0.36, 0, null, 0.9);
      const tray = box(0.8, 0.72, 0.5, mt.rack, tx, 0.36, tz); box(0.5, 0.06, 0.34, mt.trim, tx, 0.75, tz); for (const y of [0.2, 0.5]) box(0.7, 0.012, 0.01, mt.trim, tx, y, tz + 0.255);
      ctx.sign('Review', 'waiting on Joshua', tx, 1.2, tz - 0.26, 0, null, 0.9);
      rooms[t.key] = { qa: qa.position.clone().setY(0).add(new THREE.Vector3(0, 0, 0.8)), tray: tray.position.clone().setY(0).add(new THREE.Vector3(0.6, 0, 0.6)) };
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
