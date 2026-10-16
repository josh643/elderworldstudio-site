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
      const qa = box(1.4, 0.9, 0.7, M(0x2e5a46), cx + W / 2 - 1.3, 0.45, cz + D / 2 - 1.4), tray = box(0.8, 0.8, 0.5, ctx.mat.trim, cx - W / 2 + 1.1, 0.4, cz + D / 2 - 1.3);
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
