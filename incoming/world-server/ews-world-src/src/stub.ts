// Local stand-in for the Cloudflare world Durable Object (same HTTP/WS API as ews-office-build functions/api/office/world*.js),
// bound to 127.0.0.1 only. Used until the real DO is deployed to staging; flip WORLD_BASE in /etc/ews-world/env to switch.
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { BUILD, ROAD, World, applyEvent, clean, Ent } from './schema.js';
import { env, envNum, log, readJson, writeAtomic, DATA } from './util.js';

const KEY = env('WORLD_KEY'); if (!KEY) { log('error', 'WORLD_KEY missing'); process.exit(2); }
const PORT = envNum('STUB_PORT', 8788), FILE = DATA + '/stub-world.json';
const w: World = readJson(FILE, { seq: 0, ents: {} });
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
let dirty = false; setInterval(() => { if (dirty) { writeAtomic(FILE, JSON.stringify(w)); dirty = false; } }, 5000).unref();
const send = (res: http.ServerResponse, code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const snap = () => ({ t: 'snap', seq: w.seq, now: Date.now(), ents: Object.values(w.ents), build: BUILD, road: ROAD });
function broadcast(msg: unknown) { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s); }

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://x');
  if (u.pathname === '/healthz') return send(res, 200, { ok: true, stub: true, seq: w.seq, ents: Object.keys(w.ents).length, viewers: wss.clients.size });
  if (u.pathname === '/api/office/world' && req.method === 'GET') return send(res, 200, { ...snap(), viewers: wss.clients.size, stub: true });
  if (u.pathname === '/api/office/world-event' && req.method === 'POST') {
    if ((req.headers.authorization || '') !== 'Bearer ' + KEY) return send(res, 401, { ok: false });
    let raw = ''; for await (const ch of req) { raw += ch; if (raw.length > 256e3) return send(res, 413, { ok: false }); }
    let body: unknown; try { body = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'bad json' }); }
    const evs = ([] as unknown[]).concat(body).slice(0, 50).map(e => clean(e, true));
    if (evs.some(e => !e)) return send(res, 400, { ok: false, error: 'invalid event', index: evs.findIndex(e => !e) });
    const now = Date.now(), up = new Map<string, Ent>(), rm = new Set<string>();
    for (const ev of evs) { const r = applyEvent(w, ev, now); r.up.forEach(e => up.set(e.id, e)); r.rm.forEach(id => { rm.add(id); up.delete(id); }); }
    if (!up.size && !rm.size) return send(res, 200, { ok: true, changed: 0, seq: w.seq });
    w.seq++; dirty = true; broadcast({ t: 'delta', seq: w.seq, now, up: [...up.values()], rm: [...rm] });
    return send(res, 200, { ok: true, changed: up.size + rm.size, seq: w.seq });
  }
  send(res, 404, { ok: false });
});
srv.on('upgrade', (req, sock, head) => {
  if (new URL(req.url || '/', 'http://x').pathname !== '/api/office/world') return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => {
    ws.send(JSON.stringify(snap()));
    ws.on('message', m => { if (String(m) === 'ping') ws.send('{"t":"pong"}'); });
  });
});
srv.listen(PORT, '127.0.0.1', () => log('info', 'world DO stub listening', { port: PORT, seq: w.seq }));
for (const s of ['SIGTERM', 'SIGINT'] as const) process.on(s, () => { writeAtomic(FILE, JSON.stringify(w)); process.exit(0); });
