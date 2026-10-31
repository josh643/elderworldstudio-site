// Agent movement + decisions. Inputs: the CT111 office publisher's public status feed (/api/office/state: who is working on what,
// stage, progress) and the roster (/office/data/roster.json). Decisions per agent each tick:
//   working -> walk to own desk and sit (act desk); architecture team on survey/site/lot work -> walk to the town lot (act field);
//   blocked/waiting -> stand at the team board (meet); idle -> wander between room points with pauses (idle/walk).
// Coordinates are zone-local metres (zone = 'team:<key>', 'lobby', 'town'); the browser maps zones onto its floor plans.
import { AgentPose } from './schema.js';
import { log } from './util.js';

interface Work { agent: string; name?: string; team?: string; stage?: string; progress?: number; blocked?: boolean; task?: string }
interface Member { id: string; name: string; role: string; lead?: boolean }
interface Roster { teams: { key: string; name: string; members: Member[] }[]; receptionist?: { id: string }; subceo?: { id: string } }
interface Sim { id: string; team: string; zone: string; slot: number; x: number; z: number; h: number; act: AgentPose['act']; to: [number, number] | null;
  goal: AgentPose['act']; lot: number | null; waitUntil: number; dirty: boolean; lastSent: number; wp?: number; checkAt?: [number, number] | null }

const WALK = 1.3;                     // m/s
const FIELD = /\b(survey|site|lot|lots|stake|field|inspect|walk the|street|road|district|plot)\b/i;
const ARCH = new Set(['architecture', 'arch']);
export const deskOf = (slot: number): [number, number] => [(slot % 4) * 2.4 - 3.6, Math.floor(slot / 4) * 3 - 3];
const boardOf = (): [number, number] => [0, 5.5];
// Town frame (2026-10-16) = the campus frame of the layout specs: origin = lobby entrance centre (exterior.js X0,Z0), +x right facing
// out, +z away from the building. Same numbering as the lot plates (exterior.js): 4 lots per block, blocks 5 across, 65 m grid.
const XS = [-162.5, -97.5, -32.5, 32.5, 97.5, 162.5], AVE = 62, BLK = 65, RW = 10, SW = 2.5, LW = ((BLK - RW) - 2 * SW - 3) / 2;
export const lotCentre = (lot: number): [number, number] => { const n = lot - 1, c = Math.floor(n / 4), r = n % 4, a = Math.floor(r / 2), b = r % 2, k = Math.floor(c / 5), j = c % 5;
  return [XS[j] + RW / 2 + SW + 1 + LW / 2 + a * (LW + 1), AVE + k * BLK + RW / 2 + SW + 1 + LW / 2 + b * (LW + 1)]; };
// walking point on the sidewalk in front of a lot (2 m in from the curb, clear of the lamp poles at 1.2 m)
export const lotPos = (lot: number): [number, number] => { const [x] = lotCentre(lot), n = lot - 1, b = n % 2, k = Math.floor(Math.floor(n / 4) / 5);
  return [x, b === 0 ? AVE + k * BLK + RW / 2 + 2 : AVE + (k + 1) * BLK - RW / 2 - 2]; };
// Security = the Elderverse police (Joshua 2026-10-16): no desks, on foot with tablets. Looping routes on sidewalks + the main walk only
// (2 m in from every curb: lamps stand at 1.2 m; the main walk is tree-free), Hoenir at the gate post where the main walk meets the avenue.
const loop = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const blockLoop = (j: number) => loop(XS[j] + RW / 2 + 2, AVE + RW / 2 + 2, XS[j + 1] - RW / 2 - 2, AVE + BLK - RW / 2 - 2);
export const GATE_POST: [number, number] = [4.6, 53.2];
export const PATROLS: Record<string, { route: [number, number][]; start: number; post?: boolean }> = {
  'sec-lead': { route: [GATE_POST], start: 0, post: true },                                   // Hoenir: gate post, faces the avenue
  'sec-vuln': { route: blockLoop(2), start: 0 },                                               // Geri: District 1 centre block, clockwise
  'sec-watch': { route: [...blockLoop(2)].reverse(), start: 2 },                               // Freki: same block, the other way round
  'sec-harden': { route: [[-1.2, 4], [-1.2, 52], [1.2, 52], [1.2, 4]], start: 0 },             // Sigyn: plaza <-> gate on the main walk
  'sec-pentest': { route: blockLoop(3), start: 1 },                                            // Skirnir: District 1 east block
};
const SEC = new Set(['security']), CHECK = /(alert|check|incident|scan|pentest|inspect|harden|watch|audit|probe)/i;
// Deterministic PRNG per agent so wander paths are stable across restarts.
function rnd(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

export class Agents {
  sims: Record<string, Sim> = {}; work: Record<string, Work> = {}; statusAt = 0; rosterAt = 0; statusErr = ''; private rng = rnd('ews-world');
  constructor(public statusUrl: string, public rosterUrl: string) {}
  async pollRoster() {
    try { const r = await fetch(this.rosterUrl, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('http ' + r.status);
      const ro = await r.json() as Roster; const seen = new Set<string>();
      for (const t of ro.teams || []) (t.members || []).forEach((m, i) => { seen.add(m.id); if (!this.sims[m.id]) { const [x, z] = deskOf(i);
        this.sims[m.id] = { id: m.id, team: t.key, zone: 'team:' + t.key, slot: i, x, z, h: 0, act: 'idle', to: null, goal: 'idle', lot: null, waitUntil: 0, dirty: true, lastSent: 0 }; } else { this.sims[m.id].team = t.key; this.sims[m.id].slot = i; } });
      for (const id of Object.keys(PATROLS)) { seen.add(id); if (!this.sims[id]) { const P = PATROLS[id], [x, z] = P.route[P.start % P.route.length];
        this.sims[id] = { id, team: 'security', zone: 'town', slot: 0, x, z, h: 0, act: 'walk', to: null, goal: 'walk', lot: null, waitUntil: 0, dirty: true, lastSent: 0, wp: P.start }; } else { this.sims[id].team = 'security'; this.sims[id].zone = 'town'; } }
      for (const id of Object.keys(this.sims)) if (!seen.has(id)) delete this.sims[id];
      this.rosterAt = Date.now();
    } catch (e: any) { log('warn', 'roster poll failed', { err: String(e?.message || e) }); }
  }
  async pollStatus() {
    try { const r = await fetch(this.statusUrl, { signal: AbortSignal.timeout(15000), headers: { 'cache-control': 'no-cache' } }); if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json() as { work?: Work[] }; this.work = {}; for (const w of d.work || []) if (w && w.agent) this.work[w.agent] = w;
      this.statusAt = Date.now(); this.statusErr = '';
    } catch (e: any) { this.statusErr = String(e?.message || e).slice(0, 160); }
  }
  // security: patrol the loop; a real alert/check in the feed sends that agent to the lot it names (or the lobby door), then back
  private patrol(s: Sim, now: number) {
    const P = PATROLS[s.id], w = this.work[s.id]; s.zone = 'town';
    if (w && !w.blocked && (CHECK.test(w.task || '') || w.stage)) { const lot = Number((w.task || '').match(/\blot\s*(\d{1,2})\b/i)?.[1]);
      const at: [number, number] = lot >= 1 && lot <= 80 ? lotPos(lot) : [0, 3.5]; s.lot = lot >= 1 && lot <= 80 ? lot : null;
      s.goal = 'field'; s.checkAt = at; s.to = at; return; }
    s.lot = null; s.checkAt = null;
    if (P.post) { s.goal = 'idle'; s.to = P.route[0]; if (Math.hypot(s.x - s.to[0], s.z - s.to[1]) < 0.05) { s.to = null; s.h = 0; } return; }
    const tgt = P.route[(s.wp ?? 0) % P.route.length]; s.goal = 'walk'; s.to = tgt;
    if (Math.hypot(s.x - tgt[0], s.z - tgt[1]) < 0.3) { s.wp = ((s.wp ?? 0) + 1) % P.route.length; s.to = P.route[s.wp]; }
  }
  private decide(s: Sim, now: number) {
    if (PATROLS[s.id]) return this.patrol(s, now);
    const w = this.work[s.id];
    if (w && !w.blocked) {
      if (ARCH.has(s.team) && FIELD.test(w.task || '')) { const lot = Number((w.task || '').match(/\blot\s*(\d{1,2})\b/i)?.[1]) || 1 + (Math.abs([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 15);
        s.goal = 'field'; s.lot = lot; s.zone = 'town'; s.to = lotPos(lot); return; }
      s.goal = 'desk'; s.lot = null; s.zone = 'team:' + s.team; s.to = deskOf(s.slot); return;
    }
    s.lot = null; if (s.zone === 'town' && !(w && !w.blocked)) { s.zone = 'team:' + s.team; [s.x, s.z] = [0, 7]; } // back through the door
    if (w && w.blocked) { s.goal = 'meet'; s.to = boardOf(); return; }
    if (s.goal !== 'idle') s.waitUntil = 0;
    if (now < s.waitUntil) return;
    const r = this.rng; s.goal = 'idle'; s.to = [r() * 10 - 5, r() * 9 - 4]; s.waitUntil = now + 20000 + r() * 40000;
  }
  tick(dt: number, now = Date.now()): AgentPose[] {
    const out: AgentPose[] = [];
    for (const s of Object.values(this.sims)) {
      this.decide(s, now);
      const prevAct = s.act;
      if (s.to) { const dx = s.to[0] - s.x, dz = s.to[1] - s.z, d = Math.hypot(dx, dz), stepD = WALK * dt;
        if (d <= stepD || d < 0.05) { s.x = s.to[0]; s.z = s.to[1]; s.act = s.goal === 'idle' ? 'idle' : s.goal === 'walk' ? 'walk' : s.goal; if (s.goal === 'desk') s.h = Math.PI; s.to = s.goal === 'idle' ? null : s.to; }
        else { s.x += dx / d * stepD; s.z += dz / d * stepD; s.h = Math.atan2(dx, dz); s.act = 'walk'; } }
      else s.act = s.goal === 'idle' ? 'idle' : s.goal;
      const moving = s.act === 'walk';
      if (moving || s.act !== prevAct || now - s.lastSent > 30000) { s.lastSent = now;
        out.push({ id: s.id, zone: s.zone, x: +s.x.toFixed(2), z: +s.z.toFixed(2), h: +s.h.toFixed(3), act: s.act, to: moving && s.to ? s.to : null, v: moving ? WALK : 0, lot: s.lot }); }
    }
    return out;
  }
  summary() { const c: Record<string, number> = {}; for (const s of Object.values(this.sims)) c[s.act] = (c[s.act] || 0) + 1;
    return { agents: Object.keys(this.sims).length, working: Object.keys(this.work).length, acts: c, statusAgeSec: this.statusAt ? Math.round((Date.now() - this.statusAt) / 1000) : null, rosterAgeSec: this.rosterAt ? Math.round((Date.now() - this.rosterAt) / 1000) : null, statusErr: this.statusErr || undefined }; }
}
