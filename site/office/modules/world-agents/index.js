// World-server agent poses -> the office's own walk/seat system (Joshua 2026-10-16: agents become live entities driven by
// the CT119 world server). Spec: incoming/world-server/AGENT-CONTROL.md. This module never moves an avatar itself: it only
// sets the avatar's target, and base-avatar walks there along the room routes at the walk clip's own ground speed (no
// sliding), always on the floor (y = 0), and sits ONLY on the agent's own reserved chair (core/chairs.js owner lock).
// While an agent has a fresh server pose (< HOLD s old) the room logic (team-halls wander, arch-studio stages) leaves it alone.
const HOLD = 90;
export default {
  setup(ctx) {
    const T = ctx.THREE, agents = ctx.use('agents'); if (!agents) return; const ctl = new Map(); this.ctl = ctl; this.ctx = ctx;
    const find = id => agents.get(String(id).replace(/^agent:/, ''));
    /* zone-local -> world. team:<key> = that team's room centre; lobby = lobby centre; town = the exterior frame (entrance centre,
       +z away from the building, same as spec.json master.frame); floor zones f3 etc. = that floor's studio/elevator origin */
    const origin = zone => { const z = String(zone || '');
      if (z.startsWith('team:')) { const k = z.slice(5), s = ctx.teamSpot?.[k]; if (s) return [s[0], s[1]]; if (k === 'architecture' && ctx.archStudio) return [ctx.archStudio.x, ctx.archStudio.z]; return null; }
      if (z === 'lobby') return [ctx.lobbyAt?.x ?? 0, ctx.lobbyAt?.z ?? 0];
      if (z === 'town') return ctx.town ? [ctx.town.X0, ctx.town.Z0] : null;
      return null; };
    const P = (zone, x, z, h) => { const o = origin(zone); if (!o || !Number.isFinite(+x) || !Number.isFinite(+z)) return null; const v = new T.Vector3(o[0] + +x, 0, o[1] + +z); if (h != null && Number.isFinite(+h)) v.rot = +h; return v; };
    const take = (av, on) => { const u = av.userData, c = ctl.get(av); if (on) { if (!c) ctl.set(av, { self: !!u.selfDriven, wander: u.wander }); u.selfDriven = true; u.wander = null; u.serverAt = performance.now() / 1000; }
      else if (c) { u.selfDriven = c.self; ctl.delete(av); u.spotK = null; u.serverAct = null; av.scale.setScalar(1); if (!c.self) { u.target = u.home; u.wander = null; } } };
    /* the API */
    const api = {
      /* moveTo(id, {zone, x, z, h}) : walk (along routes) to that point and stand there facing h */
      moveTo(id, p) { const av = find(id); if (!av) return false; const v = P(p.zone, p.x, p.z, p.h); if (!v) return false; take(av, true); const u = av.userData; u.serverAct = 'walk'; u.spotK = null; u.target = v; return true; },
      /* sit(id) : walk to the agent's OWN chair and sit (never anyone else's; a held chair = wait in the aisle) */
      sit(id) { const av = find(id); if (!av || !av.userData.home) return false; take(av, true); const u = av.userData; u.serverAct = 'desk'; u.spotK = null; u.target = u.home; return true; },
      /* stand(id) : get up from the chair and stand in the aisle beside it */
      stand(id) { const av = find(id); if (!av) return false; const u = av.userData, st = ctx.kit.chairs?.(ctx).at(u.home); take(av, true); u.serverAct = 'idle'; u.spotK = null; const a = st?.aislePt; u.target = a ? Object.assign(a.clone(), { rot: st.rot }) : av.position.clone(); return true; },
      /* release(id) : hand the agent back to the office's own room logic */
      release(id) { const av = find(id); if (!av) return false; take(av, false); return true; },
      /* apply(poses) : one DELTA-SCHEMA v1 agent.pose batch [{id, zone, x, z, h, act, to?, v?, lot?}] */
      apply(poses) { let n = 0; for (const p of poses || []) { const av = find(p.id); if (!av) continue; const u = av.userData; n++;
        if (p.act === 'desk') api.sit(p.id);
        else if (p.act === 'walk') { const to = p.to || {}; api.moveTo(p.id, { zone: to.zone || p.zone, x: to.x ?? p.x, z: to.z ?? p.z, h: to.h ?? p.h }); }
        else if (p.act === 'idle' || p.act === 'meet') { api.moveTo(p.id, p); u.serverAct = p.act; }
        else if (p.act === 'field' || p.act === 'away' || p.zone === 'town') { take(av, true); u.serverAct = p.act || 'field'; u.target = u.home; }   /* out of the building: world-live draws the field figure; the office avatar is parked unseen at its desk */
        u.serverAt = performance.now() / 1000; }
        return n; },
      gone(id) { return api.release(id); },
      state(id) { const av = find(id); if (!av) return null; const u = av.userData; return { id: u.a?.id, act: u.serverAct || null, server: ctl.has(av), p: av.position.toArray().map(v => +v.toFixed(2)), ry: +av.rotation.y.toFixed(2), phase: u.ph?.m, seat: u.seat?.i ?? null, clip: u.cur }; },
    };
    ctx.provide('agentControl', api); ctx.agentControl = api;
    const reg = () => { if (window.__ewsOffice?.health) window.__ewsOffice.agents = api; else setTimeout(reg, 500); }; reg();
  },
  onFrame() {
    if (!this.ctl?.size) return; const t = performance.now() / 1000;
    for (const [av] of this.ctl) { const u = av.userData;
      if (t - (u.serverAt || 0) > HOLD) { this.ctx.agentControl.release(u.a.id); continue; }
      const away = u.serverAct === 'field' || u.serverAct === 'away'; av.scale.setScalar(away ? 1e-4 : 1);
      const at = u.target && u.target !== u.home && Math.hypot(av.position.x - u.target.x, av.position.z - u.target.z) < 0.06 && !(u.path && u.path.length);
      u.spotK = at ? (u.serverAct === 'meet' ? 'talk' : null) : null; }
  },
};
