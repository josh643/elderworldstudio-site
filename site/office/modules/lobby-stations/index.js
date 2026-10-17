// Lobby stations (layout v2): seats agents at the lobby's own desks instead of their team room.
//   coders: the Games team's building roles at the six Coders desks (back right of the lobby)
//   store:  Hermod (role 'store') at the desk behind the Merch Store counter
// Runs after team-halls (agents exist) and before monitors (screens get merged), so each moved agent owns the new desk's
// monitor and chair; the room desk they leave keeps its chair and shows a switched-off screen. Moved agents get a
// '<team>@lobby' team key, so team-halls never sends them wandering back through walls to their old room; they work
// (seated, typing) or idle at the lobby desk. Remove this entry from modules.json to put everyone back in their rooms.
export default {
  setup(ctx, cfg) {
    const L = ctx.lobbyStations, A = ctx.use('avatar'); if (!L || !A) return; const T = ctx.THREE;
    const groups = [['coders', cfg.coders || ['games lead', 'game coder', 'coder', 'animation', 'animation polish', 'qa']], ['store', cfg.store || ['store']]];
    const pool = [...A.all].filter(av => av.userData.team && av.userData.a), used = new Set(); this.moved = [];
    let CH = null; try { CH = ctx.kit.chairs ? ctx.kit.chairs(ctx) : null; } catch {}
    for (const [k, roles] of groups) { const slots = (L[k] || []).slice();
      for (const role of roles) for (const av of pool) { if (!slots.length) break; const u = av.userData;
        if (used.has(av) || String(u.a.role || '').toLowerCase() !== role) continue; used.add(av);
        const [x, z] = slots.shift(), r = ctx.kit.desk(ctx, x, z);
        try { const old = CH?.at?.(u.home); if (old && old.owner === u.a.id) { old.owner = null; old.label = 'spare'; } } catch {}
        if (r.seat) { r.seat.owner = u.a.id; r.seat.label = u.a.name; }
        const home = r.seat ? r.seat.root : new T.Vector3(x, 0, z);
        av.position.set(home.x, 0, home.z); av.rotation.y = Math.PI;
        Object.assign(u, { home, homeRot: Math.PI, monitor: r.monitor, homeTeam: u.team, team: u.team + '@lobby', station: k, target: home, wander: null });
        this.moved.push({ name: u.a.name, role: u.a.role, station: k, at: [+x.toFixed(2), +z.toFixed(2)] }); } }
    const reg = () => { if (window.__ewsOffice?.health) window.__ewsOffice.lobbyStations = () => this.moved; else setTimeout(reg, 500); }; reg();
  },
};
