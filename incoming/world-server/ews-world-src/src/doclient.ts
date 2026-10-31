// Outbound-only link to the world Durable Object: WebSocket subscribe (snap + deltas) and authenticated POST of events.
import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import { DO_TYPES, EXT_TYPES, ServerMsg, WorldEvent } from './schema.js';
import { log, sleep } from './util.js';

export interface DoClientOpts { base: string; key: string; allowExt: boolean }
export class DoClient extends EventEmitter {
  ws: WebSocket | null = null; connected = false; lastMsgAt = 0; lastSeq = -1; connects = 0; postOk = 0; postErr = 0; lastErr = '';
  private queue: WorldEvent[] = []; private backoff = 1000; private stopped = false; private pinger?: NodeJS.Timeout;
  constructor(public o: DoClientOpts) { super(); }
  get wsUrl() { return this.o.base.replace(/^http/, 'ws') + '/api/office/world'; }
  get eventUrl() { return this.o.base + '/api/office/world-event'; }
  start() { this.loop(); setInterval(() => this.flush(), Number(process.env.WORLD_FLUSH_MS) || 5000).unref(); }   // 2026-10-17 CF free-plan request cap: was 1000 ms (1 POST/s)
  stop() { this.stopped = true; this.ws?.close(); }
  private async loop() {
    while (!this.stopped) {
      await new Promise<void>(done => {
        const ws = new WebSocket(this.wsUrl, { headers: { 'user-agent': 'ews-world/0.1', authorization: 'Bearer ' + this.o.key }, handshakeTimeout: 15000, maxPayload: 32 * 1024 * 1024 });
        this.ws = ws;
        ws.on('open', () => { this.connected = true; this.lastErr = ''; this.connects++; this.backoff = 1000; this.lastMsgAt = Date.now(); log('info', 'DO connected', { url: this.wsUrl });
          this.pinger = setInterval(() => { if (Date.now() - this.lastMsgAt > 75000) { log('warn', 'DO silent, reconnecting'); ws.terminate(); } else ws.send('ping'); }, 25000); });
        ws.on('message', raw => { this.lastMsgAt = Date.now(); let m: ServerMsg; try { m = JSON.parse(String(raw)); } catch { return; }
          if (m.t === 'snap') { this.lastSeq = m.seq; this.emit('snap', m); } else if (m.t === 'delta') { this.lastSeq = m.seq; this.emit('delta', m); } });
        ws.on('unexpected-response', (_q, r) => { this.lastErr = 'ws http ' + r.statusCode; });
        ws.on('error', e => { this.lastErr = String(e.message || e).slice(0, 200); });
        ws.on('close', () => { if (this.pinger) clearInterval(this.pinger); if (this.connected) log('warn', 'DO disconnected', { err: this.lastErr }); this.connected = false; done(); });
      });
      if (this.stopped) return; await sleep(this.backoff + Math.random() * 500); this.backoff = Math.min(60000, this.backoff * 2);
    }
  }
  // Extension events only go out when the DO says it understands them (WORLD_AGENT_EVENTS=1); DO-native events always.
  enqueue(ev: WorldEvent) { if (ev.type === 'agent.pose' && this.o.allowExt) { const q = this.queue.find(e => e.type === 'agent.pose') as any; if (q) { const m = new Map<string, any>(q.poses.map((p: any) => [p.id, p])); for (const p of (ev as any).poses) m.set(p.id, p); q.poses = [...m.values()].slice(0, 200); return; } }   // 2026-10-17 coalesce: latest pose per agent per flush
    if (DO_TYPES.has(ev.type) || (this.o.allowExt && EXT_TYPES.has(ev.type))) this.queue.push(ev); }
  async post(evs: WorldEvent[]): Promise<{ ok: boolean; status: number; body: any }> {
    try {
      const r = await fetch(this.eventUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.o.key, 'user-agent': 'ews-world/0.1' }, body: JSON.stringify(evs), signal: AbortSignal.timeout(15000) });
      const body = await r.json().catch(() => ({})); if (r.ok) this.postOk++; else { this.postErr++; this.lastErr = 'post http ' + r.status; }
      return { ok: r.ok, status: r.status, body };
    } catch (e: any) { this.postErr++; this.lastErr = 'post ' + String(e?.message || e).slice(0, 160); return { ok: false, status: 0, body: null }; }
  }
  private flushing = false;
  private async flush() {
    if (this.flushing || !this.queue.length) return; this.flushing = true;
    try { let n = this.queue.length; while (n > 0 && this.queue.length) { const batch = this.queue.splice(0, Math.min(50, n)); n -= batch.length; const r = await this.post(batch);
      if (!r.ok) { if (r.status === 0 || r.status >= 500 || r.status === 429) { this.queue.unshift(...batch); if (this.queue.length > 2000) this.queue.splice(0, this.queue.length - 2000); }
        else log('warn', 'DO rejected batch', { status: r.status, body: r.body }); break; } } }
    finally { this.flushing = false; }
  }
  get pending() { return this.queue.length; }
}
