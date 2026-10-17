// Architecture studio, Floor 3 (incoming/architecture/FIELD_BEHAVIOR.md, request in 289b060; Joshua 2026-10-16).
// Máni (lead-arch), Vili (arch-building), Jörð (arch-landscape) and Vé (arch-qa) each get their own desk, monitor and chair
// (exclusive seat locks from core/chairs.js) in the open studio left of the Floor 3 elevator. Their state comes from the office
// feed (team 'architecture'): drafting/build stages = seated working at the own desk; plan, survey and site-check = standing at
// the studio plan table or whiteboard (until the live-construction walk-out to lots L05/L06 lands); review/QA = inspecting the
// town model; no work = at the desk, now and then a look at the plan table. Floor 3 sits at x + 800 (core/floors.js offX).
// On-site work (Joshua 11:49 PM): a survey, site check or inspection about a PHYSICAL place (lawn, lamp posts, plaza, parking,
// the lobby's red carpet ...) is done on site: the agent walks desk -> Floor 3 elevator -> lobby -> sliding doors -> the spot and
// works there with a tablet; the checker (Vé) inspects on site too. A surveyor also sets out a tripod and two stakes with tape.
// Surveys and staking only: town construction is on hold until Joshua approves the layout, so nothing gets built. Props are
// close-range only (hidden past 30 m). When the job moves on, the agent walks the same way back to its own chair.
const ONSITE = new Set(['survey', 'site-check', 'sitecheck', 'QA', 'qa', 'review', 'inspect', 'inspection', 'staking']);
const INDOOR = /\b(red carpet|carpet|lobby|reception|freyja|front desk|entrance|sliding door)/i;
const OUTDOOR = /\b(lawn|lamp|lamps|lamp ?posts?|plaza|path|paths|walkway|tree|trees|garden|planter|parking|car park|lot|lots|street|road|avenue|facade|façade|park|lake|site|bench|benches|bollard|grounds?|L\d\d)\b/i;
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
    /* the town model + its plinth are built by modules/town-model (live scale model + proposed-plan hologram, 2026-10-16) */
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
      model: [SP(mpx + 0.05 - 1.95, mpz, Math.PI / 2, 'inspect'), SP(mpx + 0.05 - 0.5, mpz - 1.3, 0, 'point'), SP(mpx + 0.05 + 1.95, mpz - 0.75, -Math.PI / 2, 'inspect'), SP(mpx + 0.05 + 0.55, mpz - 1.3, -0.15, 'inspect')] };   /* around the 3.2 x 2.0 holo table (modules/town-model) */
    this.ctx = ctx;
    /* ---- on-site walk-out: waypoints Floor 3 -> lift -> lobby -> doors -> site (the lobby's own layout: logo wall with the
       right-hand doorway at x+4, desk + red carpet down the middle, glass front at z = Z0) ---- */
    const L = ctx.lobbyAt || { x: 0, z: 0 }, Z0 = ctx.town?.Z0 ?? (L.z + 10), X0 = ctx.entrance?.x ?? L.x, F = 800, cz = core.fz;
    const V = (x, z) => new T.Vector3(x, 0, z);
    const out3 = [V(zx + 3.6, zz + 0.4), V(core.x + F - 2.9, cz + 3.2), V(core.x + F, cz + 1.0)];             /* studio -> in front of the F3 lift */
    const lift = { lift: true, a: V(core.x + F, cz + 0.6), b: V(core.x, cz + 0.6) };
    const outG = [V(core.x, cz + 1.0), V(L.x + 3.9, cz + 1.0), V(L.x + 3.9, cz + 3.6), V(L.x + 3.8, L.z + 7.4), V(X0 + 0.8, L.z + 8.4), V(X0 + 0.8, Z0 + 1.6)];
    const toLawn = [V(X0 - 4, Z0 + 9), V(X0 - 10.6, Z0 + 9)];
    const SITE = {   /* where on site, per place; [0] = maker/surveyor, [1] = checker */
      lobby: { via: [], at: [SP(L.x - 1.9, L.z + 4.4, Math.PI / 2, 'inspect'), SP(L.x + 1.9, L.z + 6.2, -Math.PI / 2, 'inspect')] },
      lawn: { via: toLawn, at: [SP(X0 - 12.6, Z0 + 14.1, Math.PI / 4, 'inspect'), SP(X0 - 13.7, Z0 + 15.6, Math.PI / 2, 'inspect')] },
      plaza: { via: [V(X0 - 2, Z0 + 4)], at: [SP(X0 - 3.5, Z0 + 9, Math.PI / 2, 'inspect'), SP(X0 + 3.5, Z0 + 9, -Math.PI / 2, 'inspect')] } };
    const siteOf = task => { const t = String(task || ''); if (INDOOR.test(t)) return 'lobby'; if (/\b(lawn|lamp|tree|garden|grounds?|lake|bench|bollard|park)\b/i.test(t)) return 'lawn'; if (OUTDOOR.test(t)) return 'plaza'; return null; };
    this.siteOf = siteOf;
    this.trip = (site, j) => { const S = SITE[site], legs = [...out3, lift, ...(site === 'lobby' ? outG.slice(0, 4) : [...outG, ...S.via])]; legs.push(S.at[j]); return legs; };
    /* field kit: a tablet held in the left hand (one per agent, parented to the hand bone) and the surveyor's tripod + stakes + tape */
    const TM = M(0x1d232c), SM = new T.MeshBasicMaterial({ color: 0x7fc4ff, toneMapped: false });
    const tabG = new T.BoxGeometry(0.2, 0.012, 0.27), scrG = new T.PlaneGeometry(0.18, 0.24).rotateX(-Math.PI / 2);
    this.tablet = av => { const u = av.userData; if (u.tablet) return u.tablet; const b = u.bones || {}, hand = b['mixamorig:lefthand'] || b.lefthand || b.hand_l || b['hand.l'] || Object.entries(b).find(([n]) => /hand/.test(n) && /(^|[^a-z])l(eft)?([^a-z]|$)|left/.test(n) && !/index|thumb|middle|ring|pinky/.test(n))?.[1];
      const g = new T.Group(), body = new T.Mesh(tabG, TM), scr = new T.Mesh(scrG, SM); scr.position.y = 0.007; g.add(body, scr); g.name = 'arch:tablet'; g.userData.keep = 1;
      if (hand) { av.updateMatrixWorld(true); const s = av.scale.x / hand.getWorldScale(new T.Vector3()).x; g.scale.setScalar(Number.isFinite(s) && s > 0 ? s : 1); g.position.set(0, 0.08 * g.scale.x, 0.04 * g.scale.x); g.rotation.set(-0.9, 0, 0); hand.add(g); }
      else { g.position.set(0.18, 1.05, 0.28); g.rotation.x = -0.9; av.add(g); }
      g.visible = false; u.tablet = g; return g; };
    const kit = new T.Group(); kit.name = 'arch:survey-kit'; kit.visible = false; ctx.scene.add(kit);
    { const leg = new T.CylinderGeometry(0.012, 0.016, 1.45, 5), yel = M(0xd9a520), dk = M(0x2a2d33);
      for (let k = 0; k < 3; k++) { const m = new T.Mesh(leg, yel), a = k * 2.094; m.position.set(Math.sin(a) * 0.22, 0.7, Math.cos(a) * 0.22); m.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); kit.add(m); }
      const head = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.22), dk); head.position.y = 1.46; kit.add(head);
      const st = new T.CylinderGeometry(0.015, 0.015, 0.6, 4), wood = M(0xb88a55), tape = new T.MeshLambertMaterial({ color: 0xff7a1a });
      for (const sx of [-1.6, 1.6]) { const m = new T.Mesh(st, wood); m.position.set(sx, 0.3, 0.9); kit.add(m); const f = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.005), tape); f.position.set(sx, 0.55, 0.9); kit.add(f); }
      const tp = new T.Mesh(new T.BoxGeometry(3.2, 0.012, 0.012), tape); tp.position.set(0, 0.5, 0.9); kit.add(tp); }
    this.kit = kit;
    const reg = () => { if (window.__ewsOffice?.health) window.__ewsOffice.archStudio = () => ({ studio: ctx.archStudio, core: ctx.core, entrance: ctx.entrance, lobbyAt: ctx.lobbyAt, town: ctx.town && { X0: ctx.town.X0, Z0: ctx.town.Z0, AVE: ctx.town.AVE }, agents: out.map(o => ({ id: o.a.id, name: o.a.name, stage: o.av.userData.state?.stage || null, force: o.force || null, p: o.av.position.toArray().map(v => +v.toFixed(2)), clip: o.av.userData.cur, away: !!o.away, trip: o.tr ? { site: o.tr.site, i: o.tr.i, n: o.tr.legs.length, dir: o.tr.dir } : null, seat: o.av.userData.seat?.i ?? null })) }),
      window.__ewsOffice.archJump = id => { const o = out.find(q => q.a.id === id || q.a.name === id); if (!o?.tr || o.av.userData.seat || o.av.userData.ph?.m !== 'stand') return false; const n = o.tr.legs.length - 1, P = o.tr.legs[n - 1]; o.tr.i = n; o.av.position.set(P.x, 0, P.z); o.av.userData.path = []; o.av.userData._tgt = null; o.av.userData.target = null; return true; },   /* QA: skip the walk */
      window.__ewsOffice.archStage = (id, st, task) => { const o = out.find(q => q.a.id === id || q.a.name === id); if (!o) return false; o.force = st || null; o.forceTask = task || null; return true; }; else setTimeout(reg, 500); }; reg();
  },
  onState(s) { if (!this.list) return; const W = new Map((s.work || []).map(w => [w.agent, w])); for (const o of this.list) o.av.userData.state = W.get(o.a.id) || {}; },
  onFrame() {
    if (!this.list) return; const t = performance.now() / 1000;
    /* out in the town (world-live field figure, CT119 agent.pose zone 'town'): the studio avatar steps out of view so the
       same person is never in two places; checked once a second */
    if (!(this.fT > t)) { this.fT = t + 1; let f = []; try { f = window.__ewsOffice?.world?.().field || []; } catch {} this.field = new Set(f.filter(F => !F.leaving).map(F => String(F.id).replace(/^agent:/, ''))); }
    for (const o of this.list) { const u = o.av.userData, st = o.force || u.state?.stage || null, want = u.waitOn ? null : st ? STAND[st] || null : (o.idleUntil > t ? 'plan' : null);   /* a maker waiting on its checker's review stays at its own desk */
      if (!st && !(o.idleUntil > t) && !(o.idleNext > t)) { o.idleNext = t + 40 + Math.random() * 50; if (Math.random() < 0.3) o.idleUntil = t + 12 + Math.random() * 10; }
      const away = this.field?.has(o.a.id); o.away = away;
      /* world server driving this agent (modules/world-agents): its walk/meet/field poses win; only a plain desk/idle pose yields
         to an on-site job from the real job record (u.siteJob tells world-agents to hold off until the agent is back at its chair) */
      const srv = u.serverAct && !(u.siteJob || ['desk', 'idle'].includes(u.serverAct));
      if (srv && !o.tr) continue;
      /* on-site job? (physical place in the task text + a survey/inspection stage); maker = slot 0, checker = slot 1 */
      const site = !away && !srv && !u.waitOn && st && ONSITE.has(st) ? this.siteOf(o.force ? (o.forceTask || 'lawn and lamp posts') : u.state?.task) : null;
      if (site && (!o.tr || o.tr.site !== site)) { if (!o.tr) o.tr = { site, legs: this.trip(site, /qa|review|check/i.test(o.a.id) ? 1 : 0), i: 0, dir: 1, wait: 0 }; else this.flip(o.tr); }
      if (!site && o.tr) this.flip(o.tr);
      u.siteJob = !!o.tr; if (o.tr) { this.walk(o, t); u.siteJob = !!o.tr; continue; }
      if (u.serverAct) continue;
      o.av.scale.setScalar(away ? 1e-4 : 1);
      const spot = want && !away ? this.spots[want][o.i % 4] : u.home;
      if (u.target !== spot) u.target = spot;
      u.spotK = want && Math.hypot(o.av.position.x - spot.x, o.av.position.z - spot.z) < 0.06 ? spot.k : null; }
    /* survey kit beside the surveyor on site, close range only */
    const sv = this.list.find(o => o.tr && o.tr.i >= o.tr.legs.length - 1 && o.tr.dir > 0 && /survey|site|staking/.test(o.force || o.av.userData.state?.stage || ''));
    if (sv) { const P = sv.tr.legs[sv.tr.legs.length - 1]; this.kit.position.set(P.x + Math.sin(P.rot) * 1.3, 0, P.z + Math.cos(P.rot) * 1.3); this.kit.rotation.y = P.rot; }
    this.kit.visible = !!sv && this.kit.position.distanceTo(this.ctx.cam.position) < 30;
  },
  flip(R) { if (R.dir < 0) return; R.dir = -1; if (!R.wait) R.i -= 1; },
  walk(o, t) {   /* one step of the on-site trip (out: dir 1, back: dir -1); a lift leg hides the agent 2.5 s and moves floors */
    const u = o.av.userData, R = o.tr, av = o.av, tab = this.tablet(av);
    if (R.wait) { if (t < R.wait) return; R.wait = 0; const L = R.legs[R.i]; const to = R.dir > 0 ? L.b : L.a; av.position.set(to.x, 0, to.z); av.scale.setScalar(1); u.path = []; u.target = null; u._tgt = null; R.i += R.dir; }
    if (R.i < 0) { o.tr = null; tab.visible = false; u.target = u.home; u.spotK = null; return; }   /* back at the studio: to the own chair */
    const L = R.legs[R.i], P = L.lift ? (R.dir > 0 ? L.a : L.b) : L, last = R.i === R.legs.length - 1;
    if (u.target !== P) { u.target = P; u.spotK = null; }
    const d = Math.hypot(av.position.x - P.x, av.position.z - P.z), done = d < 0.08 && !(u.path && u.path.length) && u.ph?.m === 'stand';
    tab.visible = R.i > 0 || R.dir < 0 ? true : d > 1.0 && !u.seat;
    if (!done) return;
    if (L.lift) { av.scale.setScalar(1e-4); R.wait = t + 2.5; return; }
    if (last && R.dir > 0) { const surveyor = /survey|site|staking/.test(o.force || u.state?.stage || '') && !/qa|review|check/i.test(o.a.id); u.spotK = surveyor && Math.sin(t / 5 + o.i) > 0.55 ? 'point' : 'inspect'; return; }
    R.i += R.dir; if (R.i >= R.legs.length) R.i = R.legs.length - 1;
  },
};
