// Architecture studio, Floor 3 (incoming/architecture/FIELD_BEHAVIOR.md, request in 289b060; Joshua 2026-10-16).
// Máni (lead-arch), Vili (arch-building), Jörð (arch-landscape) and Vé (arch-qa) each get their own desk, monitor and chair
// (exclusive seat locks from core/chairs.js) in the open studio left of the Floor 3 elevator. Their state comes from the office
// feed (team 'architecture'): drafting/build stages = seated working at the own desk; plan, survey and site-check = standing at
// the studio plan table or whiteboard (until the live-construction walk-out to lots L05/L06 lands); review/QA = inspecting the
// town model; no work = at the desk, now and then a look at the plan table. Floor 3 sits at x + 800 (core/floors.js offX).
const STAND = { plan: 'plan', survey: 'plan', 'site-check': 'plan', sitecheck: 'plan', review: 'model', compare: 'model', QA: 'model', qa: 'model' };
export default {
  setup(ctx, cfg) {
    const { THREE: T, roster } = ctx, A = ctx.use('avatar'), core = ctx.core; if (!A || !core) return;
    const team = (roster.teams || []).find(t => t.key === 'architecture'); if (!team) return;
    const zx = core.x + 800 - 11, zz = core.fz + 12; ctx.archStudio = { x: zx, z: zz, w: 8, d: 7 };   /* the left Floor 3 zone */
    const M = ctx.M, mat = ctx.mat, box = ctx.box;
    /* studio rug, plan table with sheets, town model on a plinth, wall-style whiteboard on a frame, sign */
    box(8.2, 0.02, 7.2, M(0x3f4652), zx, 0.01, zz);
    const ptx = zx - 2.0, ptz = zz + 2.3, mpx = zx + 2.4, mpz = zz + 2.3;
    box(2.4, 0.05, 1.2, mat.wood, ptx, 0.92, ptz); for (const sx of [-1.1, 1.1]) for (const sz of [-0.5, 0.5]) box(0.06, 0.9, 0.06, mat.rack, ptx + sx, 0.45, ptz + sz);
    box(0.9, 0.006, 0.62, M(0xe9eef4), ptx - 0.45, 0.948, ptz - 0.05); box(0.8, 0.006, 0.55, M(0xdfe8f0), ptx + 0.5, 0.948, ptz + 0.08); box(0.05, 0.05, 0.6, M(0x2a5db0), ptx + 0.1, 0.97, ptz + 0.1);
    box(1.6, 0.9, 1.6, mat.stone || mat.wall, mpx, 0.45, mpz); box(1.5, 0.02, 1.5, M(0x6f8f5a), mpx, 0.91, mpz);
    for (let i = 0; i < 9; i++) { const bx = mpx - 0.5 + (i % 3) * 0.5, bz = mpz - 0.5 + Math.floor(i / 3) * 0.5, h = 0.06 + ((i * 7) % 5) * 0.05; box(0.28, h, 0.28, M([0xd9d2c4, 0xbfc6cf, 0xc9b79a][i % 3]), bx, 0.92 + h / 2, bz); }
    const wbx = zx - 3.9, wbz = zz + 0.6; box(0.05, 1.1, 1.9, M(0xb8bcc4), wbx, 1.35, wbz); box(0.02, 0.98, 1.8, M(0xeef2f6), wbx + 0.03, 1.35, wbz); for (const s of [-0.85, 0.85]) box(0.05, 0.9, 0.05, M(0xb8bcc4), wbx, 0.45, wbz + s);
    for (let i = 0; i < 4; i++) box(0.004, 0.03, 0.5 + (i % 2) * 0.4, M([0x2a5db0, 0xb8452f][i % 2]), wbx + 0.045, 1.6 - i * 0.16, wbz - 0.3 + (i % 2) * 0.2);
    const sign = ctx.panel(ctx.textCanvas(['Architecture studio', 'Máni · Vili · Jörð · Vé'], { w: 768, h: 192, size: 60, body: 36 }), 1.8, 0.45, zx, 2.6, zz - 3.45, Math.PI); sign.material.toneMapped = false;
    /* four desks in a row facing the elevator wall; seat owner = the agent; the avatar starts on its own chair */
    const ids = ['lead-arch', 'arch-building', 'arch-landscape', 'arch-qa'], xs = [-3.0, -1.0, 1.0, 3.0], agents = ctx.use('agents'), out = []; this.list = out;
    team.members.forEach((a, j) => { const i = ids.indexOf(a.id) >= 0 ? ids.indexOf(a.id) : j % 4, r = ctx.kit.desk(ctx, zx + xs[i], zz - 1.4);
      if (r.seat) { r.seat.owner = a.id; r.seat.label = a.name; }
      let av = agents?.get(a.id); if (!av) { av = A.make(a, 0x6a8fb8, () => { const s = av.userData.state || {}; ctx.card(`<h3>${ctx.esc(a.name)}</h3><p>${ctx.esc(a.role)} · Architecture (Floor 3)</p><p>${s.stage ? 'Working · stage <b>' + ctx.esc(s.stage) + '</b>' : 'In the studio'}</p>`); }); ctx.scene.add(av); }
      const home = r.seat ? r.seat.root : new T.Vector3(zx + xs[i], 0, zz - 0.9); av.position.set(home.x, 0, home.z); av.rotation.y = Math.PI;
      Object.assign(av.userData, { home, homeRot: Math.PI, monitor: r.monitor, team: 'architecture', homeTeam: 'architecture', station: 'arch-studio', selfDriven: true, wander: null });
      out.push({ av, a, i }); });
    const SP = (x, z, rot, k) => Object.assign(new T.Vector3(x, 0, z), { rot, k });
    this.spots = { plan: [SP(ptx - 0.5, ptz - 0.95, 0, 'inspect'), SP(ptx + 0.6, ptz - 0.95, 0, 'present'), SP(wbx + 0.9, wbz - 0.4, -Math.PI / 2, 'present'), SP(wbx + 0.9, wbz + 0.5, -Math.PI / 2, 'inspect')],
      model: [SP(mpx - 1.25, mpz, Math.PI / 2, 'inspect'), SP(mpx, mpz - 1.25, 0, 'point'), SP(mpx + 1.25, mpz, -Math.PI / 2, 'inspect'), SP(mpx - 0.6, mpz - 1.2, 0.4, 'inspect')] };
    this.ctx = ctx;
    const reg = () => { if (window.__ewsOffice?.health) window.__ewsOffice.archStudio = () => ({ studio: ctx.archStudio, agents: out.map(o => ({ id: o.a.id, name: o.a.name, stage: o.av.userData.state?.stage || null, force: o.force || null, p: o.av.position.toArray().map(v => +v.toFixed(2)), clip: o.av.userData.cur, away: !!o.away, seat: o.av.userData.seat?.i ?? null })) }),
      window.__ewsOffice.archStage = (id, st) => { const o = out.find(q => q.a.id === id || q.a.name === id); if (!o) return false; o.force = st || null; return true; }; else setTimeout(reg, 500); }; reg();
  },
  onState(s) { if (!this.list) return; const W = new Map((s.work || []).map(w => [w.agent, w])); for (const o of this.list) o.av.userData.state = W.get(o.a.id) || {}; },
  onFrame() {
    if (!this.list) return; const t = performance.now() / 1000;
    /* out in the town (world-live field figure, CT119 agent.pose zone 'town'): the studio avatar steps out of view so the
       same person is never in two places; checked once a second */
    if (!(this.fT > t)) { this.fT = t + 1; let f = []; try { f = window.__ewsOffice?.world?.().field || []; } catch {} this.field = new Set(f.filter(F => !F.leaving).map(F => String(F.id).replace(/^agent:/, ''))); }
    for (const o of this.list) { if (o.av.userData.serverAct) continue;   /* world server is driving this agent (modules/world-agents) */
      const u = o.av.userData, st = o.force || u.state?.stage || null, want = st ? STAND[st] || null : (o.idleUntil > t ? 'plan' : null);
      if (!st && !(o.idleUntil > t) && !(o.idleNext > t)) { o.idleNext = t + 40 + Math.random() * 50; if (Math.random() < 0.3) o.idleUntil = t + 12 + Math.random() * 10; }
      const away = this.field?.has(o.a.id); o.away = away; o.av.scale.setScalar(away ? 1e-4 : 1);
      const spot = want && !away ? this.spots[want][o.i % 4] : u.home;
      if (u.target !== spot) u.target = spot;
      u.spotK = want && Math.hypot(o.av.position.x - spot.x, o.av.position.z - spot.z) < 0.06 ? spot.k : null; }
  },
};
