// Shared delta schema between the ews-world server (CT119) and the Cloudflare world-state Durable Object
// (ews-office-build: workers/office-limiter/world.js + functions/api/office/world*.js). Keep in sync with
// ews-office-build/incoming/world-server/DELTA-SCHEMA.md. Version bump on any breaking change.
export const SCHEMA_VERSION = 1;
export const BUILD = ['survey', 'groundwork', 'foundation', 'framing', 'walls', 'glazing', 'signage', 'landscaping', 'open'] as const;
export const ROAD = ['survey', 'grading', 'base', 'paving', 'striping', 'open'] as const;
export type BuildStage = typeof BUILD[number];
export type RoadStage = typeof ROAD[number];
export const COLORS = ['sandstone', 'brick', 'slate', 'cream', 'timber', 'teal'] as const;
export const KINDS = ['shop', 'cafe', 'studio', 'office', 'gallery'] as const;
export const LOT_MAX = 80;

export interface Next { o: number; eta: number }          // pipeline's own estimate: overall o in eta seconds (clients creep, never pass)
export interface Prog { stage?: string; progress?: number; overall?: number; next?: Next | null }
// ---- Events (server -> DO, POST /api/office/world-event, Bearer key). Accepted by the DO today: ----
export type LotLease = Prog & { type: 'lot.lease'; lot: number; tenant?: string; public?: boolean; style?: { floors?: number; color?: string; kind?: string }; parts?: Record<string, string> };
export type SiteProgress = Prog & { type: 'site.progress'; lot: number };
export type LotRelease = { type: 'lot.release'; lot: number };
export type RoadUpsert = Prog & { type: 'road.upsert'; id: string; name?: string; a: [number, number]; b: [number, number]; w?: number; resurface?: boolean };
export type RoadProgress = Prog & { type: 'road.progress'; id: string };
export type RoadRemove = { type: 'road.remove'; id: string };
// ---- PROPOSED v1 extension (stub accepts; DO must add to clean()/applyEvent before the server sends it there): ----
// agent.pose: batched office/town avatar positions decided by the world server. Numbers + enums only.
export const ACTS = ['desk', 'walk', 'idle', 'field', 'meet', 'away'] as const;
export interface AgentPose { id: string; zone: string; x: number; z: number; h: number; act: typeof ACTS[number]; to?: [number, number] | null; v?: number; lot?: number | null }
export type AgentPoses = { type: 'agent.pose'; poses: AgentPose[] };
export type AgentGone = { type: 'agent.gone'; id: string };
export type WorldEvent = LotLease | SiteProgress | LotRelease | RoadUpsert | RoadProgress | RoadRemove | AgentPoses | AgentGone;
export const DO_TYPES = new Set(['lot.lease', 'site.progress', 'lot.release', 'road.upsert', 'road.progress', 'road.remove']);
export const EXT_TYPES = new Set(['agent.pose', 'agent.gone']);

// ---- Entities + messages (DO -> everyone over GET /api/office/world WebSocket) ----
export interface Ent { id: string; kind: 'site' | 'road' | 'agent'; si: number; p: number; at: number; since: number; next?: Next | null; [k: string]: unknown }
export type Snap = { t: 'snap'; seq: number; now: number; ents: Ent[]; build: string[]; road: string[] };
export type Delta = { t: 'delta'; seq: number; now: number; up: Ent[]; rm: string[] };
export type ServerMsg = Snap | Delta | { t: 'pong' };

const clamp = (v: unknown, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
const words = (s: unknown, n: number) => String(s || '').replace(/[^A-Za-z0-9 &'.-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v: unknown, a: number, b: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : null; };
const pt = (p: unknown): [number, number] | null => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(Number(v)) && Math.abs(Number(v)) < 2000) ? [+p[0], +p[1]] : null;

// Same allowlist as functions/api/office/world-event.js clean(); extension types validated here too. Returns null if invalid.
export function clean(e: any, allowExt: boolean): WorldEvent | null {
  const t = e && e.type, o: any = { type: t };
  const prog = () => { if (e.overall != null) o.overall = num(e.overall, 0, 1); if (e.progress != null) o.progress = num(e.progress, 0, 1);
    if (e.next && e.next.eta) o.next = { o: num(e.next.o, 0, 1) ?? 0, eta: num(e.next.eta, 1, 3600) }; };
  if (['lot.lease', 'site.progress', 'lot.release'].includes(t)) {
    o.lot = num(e.lot, 1, LOT_MAX); if (!o.lot || !Number.isInteger(o.lot)) return null;
    if (t === 'lot.lease') { o.public = e.public === true; o.tenant = o.public ? words(e.tenant, 28) : '';
      const s = e.style || {}; o.style = { floors: Math.round(num(s.floors, 1, 4) || 2), color: (COLORS as readonly string[]).includes(s.color) ? s.color : 'sandstone', kind: (KINDS as readonly string[]).includes(s.kind) ? s.kind : 'shop' };
      o.parts = {}; for (const [k, v] of Object.entries(e.parts || {}).slice(0, 12)) if ((BUILD as readonly string[]).includes(k) && typeof v === 'string' && /^\/office\/assets\/[A-Za-z0-9_\/.-]+\.glb(\?v=[A-Za-z0-9]+)?$/.test(v) && !v.includes('..')) o.parts[k] = v; }
    if (t !== 'lot.release') { if (e.stage != null) { if (!(BUILD as readonly string[]).includes(e.stage)) return null; o.stage = e.stage; } prog(); }
    return o;
  }
  if (['road.upsert', 'road.progress', 'road.remove'].includes(t)) {
    o.id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32); if (!o.id) return null;
    if (t === 'road.upsert') { o.name = words(e.name, 40) || 'Road works'; o.a = pt(e.a); o.b = pt(e.b); o.w = num(e.w, 3, 16) || 8; o.resurface = e.resurface === true; if (!o.a || !o.b) return null; }
    if (t !== 'road.remove') { if (e.stage != null) { if (!(ROAD as readonly string[]).includes(e.stage)) return null; o.stage = e.stage; } prog(); }
    return o;
  }
  if (!allowExt) return null;
  if (t === 'agent.pose') {
    const poses = (Array.isArray(e.poses) ? e.poses : []).slice(0, 200).map((p: any) => {
      const id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32), zone = String(p.zone || '').replace(/[^a-z0-9:-]/gi, '').slice(0, 32);
      const x = num(p.x, -2000, 2000), z = num(p.z, -2000, 2000), h = num(p.h, -7, 7) ?? 0, act = (ACTS as readonly string[]).includes(p.act) ? p.act : null;
      if (!id || !zone || x == null || z == null || !act) return null;
      const r: AgentPose = { id, zone, x: +x.toFixed(2), z: +z.toFixed(2), h: +h.toFixed(3), act };
      const to = pt(p.to); if (to) r.to = to; const v = num(p.v, 0, 6); if (v) r.v = v; const lot = num(p.lot, 1, LOT_MAX); if (lot && Number.isInteger(lot)) r.lot = lot;
      return r; });
    if (poses.some((p: unknown) => !p)) return null; o.poses = poses; return o;
  }
  if (t === 'agent.gone') { o.id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32); return o.id ? o : null; }
  return null;
}

// Mirror of world.js applyEvent so the server's town copy and the DO agree exactly. w = { seq, ents }.
export interface World { seq: number; ents: Record<string, Ent> }
function stamp(e: Ent, stages: readonly string[], ev: any, now: number) {
  const N = stages.length - 1;
  if (ev.overall != null) { const o = clamp(ev.overall); e.si = Math.min(N, Math.floor(o * N + 1e-9)); e.p = e.si >= N ? 1 : +(o * N - e.si).toFixed(4); }
  else { if (ev.stage != null) { const i = stages.indexOf(ev.stage); if (i >= 0) e.si = i; } if (ev.progress != null) e.p = clamp(ev.progress); }
  if (e.si >= N) { e.si = N; e.p = 1; }
  e.at = now; e.next = ev.next && ev.next.eta > 0 ? { o: clamp(ev.next.o), eta: Math.min(3600, Math.floor(ev.next.eta)) } : null;
}
export function applyEvent(w: World, ev: any, now: number): { up: Ent[]; rm: string[] } {
  const up: Ent[] = [], rm: string[] = [];
  if (ev.type === 'lot.lease' || ev.type === 'site.progress') {
    const id = 'lot:' + ev.lot; let e = w.ents[id];
    if (!e) { if (ev.type !== 'lot.lease') return { up, rm }; e = w.ents[id] = { id, kind: 'site', lot: ev.lot, si: 0, p: 0, at: now, since: now }; }
    if (ev.type === 'lot.lease') { Object.assign(e, { tenant: ev.tenant || '', public: !!ev.public, style: ev.style || e.style || {}, parts: ev.parts || e.parts || {}, demo: !!ev.demo });
      if (ev.overall == null && ev.stage == null) ev = { ...ev, stage: 'survey', progress: 0 }; }
    stamp(e, BUILD, ev, now); up.push(e);
  } else if (ev.type === 'lot.release') { const id = 'lot:' + ev.lot; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  else if (ev.type === 'road.upsert' || ev.type === 'road.progress') {
    const id = 'road:' + ev.id; let e = w.ents[id];
    if (!e) { if (ev.type !== 'road.upsert') return { up, rm }; e = w.ents[id] = { id, kind: 'road', si: 0, p: 0, at: now, since: now }; }
    if (ev.type === 'road.upsert') Object.assign(e, { name: ev.name || e.name || 'Road works', a: ev.a || e.a, b: ev.b || e.b, w: ev.w || e.w || 8, resurface: !!ev.resurface, demo: !!ev.demo });
    stamp(e, ROAD, ev, now); up.push(e);
  } else if (ev.type === 'road.remove') { const id = 'road:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  else if (ev.type === 'agent.pose') {
    for (const p of ev.poses as AgentPose[]) { const id = 'agent:' + p.id; const e = w.ents[id] || (w.ents[id] = { id, kind: 'agent', si: 0, p: 0, at: now, since: now });
      Object.assign(e, p, { id, kind: 'agent', at: now }); up.push(e); }
  } else if (ev.type === 'agent.gone') { const id = 'agent:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  return { up, rm };
}
export function overallOf(e: Ent, stages: readonly string[]) { const N = stages.length - 1; return Math.min(1, (e.si + e.p) / N); }
