// Authoritative construction-stage simulation. Each job (lot build or road works) carries REAL progress (`real`, 0..1 overall)
// reported by the pipeline doing the work (POST /admin/job on the local admin port, later CT111 pipelines). The sim moves the
// shown progress toward `real` at a bounded speed and always announces `next` (where it will be at the next tick) so every
// viewer creeps smoothly; it never runs ahead of real progress. Demo jobs (staging only) get `real` from a linear clock.
import { BUILD, ROAD, World, WorldEvent, applyEvent, overallOf } from './schema.js';

export interface Job { id: string; kind: 'site' | 'road'; lot?: number; tenant?: string; public?: boolean; style?: any; parts?: any;
  name?: string; a?: [number, number]; b?: [number, number]; w?: number; resurface?: boolean;
  real: number; shown: number; demo?: { t0: number; secs: number } | null; created: number; updated: number; lastSent: number; done?: boolean }

export class Construction {
  jobs: Record<string, Job> = {};
  constructor(public town: World, public emit: (ev: WorldEvent) => void, public stepSec = 2, public maxRate = 0.02 /* overall per sec */) {}
  key(kind: string, idOrLot: string | number) { return kind === 'site' ? 'lot:' + idOrLot : 'road:' + idOrLot; }
  lease(j: Partial<Job> & { lot: number }) {
    const id = this.key('site', j.lot), now = Date.now();
    const job: Job = { id, kind: 'site', lot: j.lot, tenant: j.tenant || '', public: !!j.public, style: j.style || {}, parts: j.parts || {}, real: Math.max(0, Math.min(1, j.real || 0)), shown: 0,
      demo: j.demo || null, created: now, updated: now, lastSent: 0 };
    this.jobs[id] = job;
    this.send({ type: 'lot.lease', lot: j.lot, tenant: job.tenant, public: job.public, style: job.style, parts: job.parts, stage: 'survey', progress: 0 });
    return job;
  }
  road(j: Partial<Job> & { id: string; a: [number, number]; b: [number, number] }) {
    const id = this.key('road', j.id), now = Date.now();
    const job: Job = { id, kind: 'road', name: j.name || 'Road works', a: j.a, b: j.b, w: j.w || 8, resurface: !!j.resurface, real: Math.max(0, Math.min(1, j.real || 0)), shown: 0,
      demo: j.demo || null, created: now, updated: now, lastSent: 0 };
    this.jobs[id] = job;
    this.send({ type: 'road.upsert', id: j.id, name: job.name, a: job.a!, b: job.b!, w: job.w, resurface: job.resurface, stage: 'survey', progress: 0 });
    return job;
  }
  report(id: string, real: number) { const j = this.jobs[id]; if (!j) return null; j.real = Math.max(j.real, Math.max(0, Math.min(1, real))); j.updated = Date.now(); return j; }
  remove(id: string) { const j = this.jobs[id]; if (!j) return false; delete this.jobs[id];
    this.send(j.kind === 'site' ? { type: 'lot.release', lot: j.lot! } : { type: 'road.remove', id: id.slice(5) }); return true; }
  private send(ev: WorldEvent) { applyEvent(this.town, ev, Date.now()); this.town.seq++; this.emit(ev); }
  // Re-assert every owned entity (after a DO (re)connect or snapshot mismatch).
  reassert() { for (const j of Object.values(this.jobs)) {
    if (j.kind === 'site') this.emit({ type: 'lot.lease', lot: j.lot!, tenant: j.tenant, public: j.public, style: j.style, parts: j.parts, overall: j.shown });
    else this.emit({ type: 'road.upsert', id: j.id.slice(5), name: j.name, a: j.a!, b: j.b!, w: j.w, resurface: j.resurface, overall: j.shown }); } }
  tick(now = Date.now()) {
    for (const j of Object.values(this.jobs)) {
      if (j.done) continue;
      if (j.demo) j.real = Math.min(1, (now - j.demo.t0) / 1000 / j.demo.secs);
      const step = this.stepSec, cap = this.maxRate * step, nextShown = Math.min(j.real, j.shown + cap);
      const moved = nextShown - j.shown > 1e-4; j.shown = nextShown;
      const realNext = j.demo ? Math.min(1, (now + step * 1000 - j.demo.t0) / 1000 / j.demo.secs) : j.real;   // demo clock is known ahead; real jobs never pass `real`
      const ahead = Math.min(realNext, j.shown + cap);
      if (!moved && now - j.lastSent < 15000) continue;
      const next = ahead > j.shown + 1e-4 ? { o: +ahead.toFixed(4), eta: step } : null;
      const ev: WorldEvent = j.kind === 'site' ? { type: 'site.progress', lot: j.lot!, overall: +j.shown.toFixed(4), next } : { type: 'road.progress', id: j.id.slice(5), overall: +j.shown.toFixed(4), next };
      this.send(ev); j.lastSent = now; if (j.shown >= 1) j.done = true;
    }
  }
  summary() { return Object.values(this.jobs).map(j => { const e = this.town.ents[j.id]; return { id: j.id, kind: j.kind, real: +j.real.toFixed(3), shown: +j.shown.toFixed(3),
    stage: e ? (j.kind === 'site' ? BUILD : ROAD)[e.si] : null, overall: e ? +overallOf(e, j.kind === 'site' ? BUILD : ROAD).toFixed(3) : null, demo: !!j.demo, done: !!j.done }; }); }
}
