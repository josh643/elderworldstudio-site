#!/usr/bin/env node
// Elderverse worlds host: static client + local world stub + moderator editor.
// No Cloudflare Pages/Workers/DO at runtime. Bind PUBLIC_BIND (default 0.0.0.0 in Docker, 127.0.0.1 for systemd+Caddy).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const env = (k, d = '') => (process.env[k] ?? d).trim();
const envNum = (k, d) => { const n = Number(process.env[k]); return Number.isFinite(n) && process.env[k] ? n : d; };
const log = (level, msg, extra = {}) => process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }) + '\n');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = env('WORLDS_REPO', path.resolve(HERE, '../../..'));
const STATIC_ROOT = path.resolve(env('STATIC_ROOT', path.join(REPO, 'site')));
const DATA = env('EWS_WORLD_DATA', path.join(REPO, '.worlds-data'));
const BIND = env('PUBLIC_BIND', '0.0.0.0');
const PORT = envNum('PUBLIC_PORT', 8080);
const started = Date.now();
fs.mkdirSync(DATA, { recursive: true });

const MOD_TOKENS = new Set(env('WORLD_MODERATORS').split(/[,;\s]+/).filter(Boolean));
const sessions = new Map(); // sid -> { role, at }
const SESSION_MS = 12 * 3600e3;

const CATALOG = new Set(['block', 'pad', 'tree', 'shrub', 'arch', 'bench', 'lot-small', 'lot-medium', 'awning', 'well', 'shrine']);
const REGIONS = new Set(['town', 'omnivael']);
const HEIGHT_N = 48;

function emptyTerrain() {
  return { n: HEIGHT_N, h: Array(HEIGHT_N * HEIGHT_N).fill(0) };
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'editor.json'), 'utf8')); }
  catch {
    return { seq: 0, props: {}, terrain: { town: emptyTerrain(), omnivael: emptyTerrain() }, water: { town: { level: -2 }, omnivael: { level: -1 } }, audit: [], undo: [], redo: [] };
  }
}
let st = loadState();
const persist = () => {
  const tmp = path.join(DATA, 'editor.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify({ ...st, audit: st.audit.slice(-400) }));
  fs.renameSync(tmp, path.join(DATA, 'editor.json'));
};
setInterval(persist, 15e3).unref();

const world = { seq: 0, ents: {} };
try { Object.assign(world, JSON.parse(fs.readFileSync(path.join(DATA, 'stub-world.json'), 'utf8'))); } catch { /* first run */ }
const persistWorld = () => fs.writeFileSync(path.join(DATA, 'stub-world.json'), JSON.stringify(world));
setInterval(() => { try { persistWorld(); } catch {} }, 20e3).unref();

const wss = new WebSocketServer({ noServer: true, maxPayload: 64e3 });
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s); };
const snap = () => ({ t: 'snap', seq: world.seq, now: Date.now(), ents: Object.values(world.ents), editor: publicEditor() });
const publicEditor = () => ({ seq: st.seq, props: st.props, terrain: st.terrain, water: st.water });

function sessionOf(req, body) {
  const hdr = String(req.headers.authorization || '');
  const bearer = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const cookie = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('ews_sid='));
  const sid = bearer || body?.sid || (cookie ? decodeURIComponent(cookie.slice(8)) : '');
  const s = sessions.get(sid);
  if (!s || Date.now() - s.at > SESSION_MS) { if (sid) sessions.delete(sid); return null; }
  s.at = Date.now();
  return { sid, ...s };
}
function requireMod(req, body) {
  const s = sessionOf(req, body);
  return s && s.role === 'moderator' ? s : null;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function num(v, a, b) { const x = Number(v); return Number.isFinite(x) ? clamp(x, a, b) : null; }

function applyEdit(ev, who) {
  const type = ev && ev.type;
  const inverse = [];
  if (type === 'prop.place') {
    const catalog = CATALOG.has(ev.catalog) ? ev.catalog : null;
    const region = REGIONS.has(ev.region) ? ev.region : 'town';
    const x = num(ev.x, -400, 400), y = num(ev.y ?? 0, -20, 80), z = num(ev.z, -400, 400), ry = num(ev.ry ?? 0, -7, 7) ?? 0;
    if (!catalog || x == null || z == null) return { ok: false, error: 'invalid place' };
    if (Object.keys(st.props).length >= 400) return { ok: false, error: 'prop cap' };
    const id = 'p-' + crypto.randomBytes(4).toString('hex');
    st.props[id] = { id, catalog, region, x, y: y ?? 0, z, ry };
    inverse.push({ type: 'prop.delete', id });
    return { ok: true, id, inverse };
  }
  if (type === 'prop.move') {
    const p = st.props[ev.id]; if (!p) return { ok: false, error: 'missing' };
    inverse.push({ type: 'prop.move', id: p.id, x: p.x, y: p.y, z: p.z, ry: p.ry });
    if (ev.x != null) p.x = num(ev.x, -400, 400) ?? p.x;
    if (ev.y != null) p.y = num(ev.y, -20, 80) ?? p.y;
    if (ev.z != null) p.z = num(ev.z, -400, 400) ?? p.z;
    if (ev.ry != null) p.ry = num(ev.ry, -7, 7) ?? p.ry;
    return { ok: true, id: p.id, inverse };
  }
  if (type === 'prop.delete') {
    const p = st.props[ev.id]; if (!p) return { ok: false, error: 'missing' };
    inverse.push({ type: 'prop.place', ...p, catalog: p.catalog });
    delete st.props[ev.id];
    return { ok: true, id: ev.id, inverse };
  }
  if (type === 'terrain.sculpt') {
    const region = REGIONS.has(ev.region) ? ev.region : null;
    const mode = ['raise', 'lower', 'flatten', 'smooth'].includes(ev.mode) ? ev.mode : null;
    const cx = num(ev.x, 0, 1), cz = num(ev.z, 0, 1), r = num(ev.r ?? 0.08, 0.02, 0.35), amt = num(ev.amt ?? 0.4, -4, 4);
    if (!region || !mode || cx == null || cz == null) return { ok: false, error: 'invalid sculpt' };
    const T = st.terrain[region], n = T.n, prev = T.h.slice();
    const ix = cx * (n - 1), iz = cz * (n - 1), rad = r * n;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - ix, z - iz); if (d > rad) continue;
      const w = 1 - d / rad, i = z * n + x;
      if (mode === 'raise') T.h[i] = clamp(T.h[i] + amt * w, -8, 24);
      else if (mode === 'lower') T.h[i] = clamp(T.h[i] - Math.abs(amt) * w, -8, 24);
      else if (mode === 'flatten') T.h[i] += (0 - T.h[i]) * w * 0.6;
      else T.h[i] = T.h[i] * (1 - w * 0.45) + neighborAvg(T, x, z) * w * 0.45;
    }
    inverse.push({ type: 'terrain.replace', region, h: prev });
    return { ok: true, inverse };
  }
  if (type === 'terrain.replace') {
    const region = REGIONS.has(ev.region) ? ev.region : null;
    if (!region || !Array.isArray(ev.h) || ev.h.length !== st.terrain[region].h.length) return { ok: false, error: 'invalid replace' };
    const prev = st.terrain[region].h.slice();
    st.terrain[region].h = ev.h.map(v => clamp(Number(v) || 0, -8, 24));
    inverse.push({ type: 'terrain.replace', region, h: prev });
    return { ok: true, inverse };
  }
  if (type === 'water.set') {
    const region = REGIONS.has(ev.region) ? ev.region : null;
    const level = num(ev.level, -8, 12);
    if (!region || level == null) return { ok: false, error: 'invalid water' };
    inverse.push({ type: 'water.set', region, level: st.water[region].level });
    st.water[region].level = level;
    return { ok: true, inverse };
  }
  return { ok: false, error: 'unknown edit' };
}
function neighborAvg(T, x, z) {
  const n = T.n; let s = 0, c = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue;
    s += T.h[zz * n + xx]; c++;
  }
  return s / c;
}

function commitEdit(ev, who, { undoable = true } = {}) {
  const r = applyEdit(ev, who);
  if (!r.ok) return r;
  st.seq++;
  if (undoable) { st.undo.push(r.inverse); st.redo.length = 0; if (st.undo.length > 80) st.undo.shift(); }
  st.audit.push({ at: new Date().toISOString(), who: who.role, sid: who.sid.slice(0, 8), type: ev.type, id: r.id || ev.id || ev.region || '' });
  if (st.audit.length > 400) st.audit.splice(0, st.audit.length - 400);
  persist();
  broadcast({ t: 'editor', seq: st.seq, state: publicEditor() });
  return { ok: true, seq: st.seq, id: r.id, state: publicEditor() };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};
function safeJoin(root, urlPath) {
  const dec = decodeURIComponent(urlPath.split('?')[0]);
  const p = path.normalize(path.join(root, dec));
  if (!p.startsWith(root)) return null;
  return p;
}
function sendFile(req, res, file) {
  let stt; try { stt = fs.statSync(file); } catch { return false; }
  if (stt.isDirectory()) { file = path.join(file, 'index.html'); try { stt = fs.statSync(file); } catch { return false; } }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = { 'content-type': type, 'x-content-type-options': 'nosniff' };
  if (ext === '.html') headers['cache-control'] = 'no-cache';
  else if (/\.(glb|wasm|ktx2|jpg|png|webp)$/.test(ext)) headers['cache-control'] = 'public, max-age=604800';
  else headers['cache-control'] = 'public, max-age=86400';
  const enc = req.headers['accept-encoding'] || '';
  const compressible = /text\/|javascript|json|svg/.test(type);
  if (compressible && stt.size < 2e6 && enc.includes('br')) {
    const buf = zlib.brotliCompressSync(fs.readFileSync(file), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
    headers['content-encoding'] = 'br'; headers['vary'] = 'Accept-Encoding';
    res.writeHead(200, headers); res.end(buf); return true;
  }
  if (compressible && stt.size < 2e6 && enc.includes('gzip')) {
    const buf = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
    headers['content-encoding'] = 'gzip'; headers['vary'] = 'Accept-Encoding';
    res.writeHead(200, headers); res.end(buf); return true;
  }
  headers['content-length'] = stt.size;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
  return true;
}
const json = (res, code, body, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }); res.end(JSON.stringify(body)); };
async function readBody(req) { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 1e6) throw new Error('too big'); } return raw ? JSON.parse(raw) : {}; }

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://x');
  try {
    if (u.pathname === '/healthz') {
      return json(res, 200, { ok: true, service: 'ews-worlds', uptimeSec: Math.round((Date.now() - started) / 1000), standalone: true, staticRoot: STATIC_ROOT, editorSeq: st.seq, props: Object.keys(st.props).length, worldSeq: world.seq, modsConfigured: MOD_TOKENS.size > 0, memMB: Math.round(process.memoryUsage().rss / 1048576) });
    }
    if (u.pathname === '/api/office/state') return json(res, 200, { work: [], updated: Date.now(), standalone: true });
    if (u.pathname === '/api/office/world' && req.method === 'GET') return json(res, 200, { ...snap(), viewers: wss.clients.size, stub: true });
    if (u.pathname === '/api/worlds/editor' && req.method === 'GET') return json(res, 200, publicEditor());
    if (u.pathname === '/api/worlds/catalog') return json(res, 200, { items: [...CATALOG] });
    if (u.pathname === '/api/worlds/session' && req.method === 'POST') {
      const b = await readBody(req);
      if (!MOD_TOKENS.size) return json(res, 503, { ok: false, error: 'no moderators configured' });
      if (!MOD_TOKENS.has(String(b.token || ''))) return json(res, 401, { ok: false, error: 'rejected' });
      const sid = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, { role: 'moderator', at: Date.now() });
      return json(res, 200, { ok: true, role: 'moderator', sid }, { 'set-cookie': `ews_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` });
    }
    if (u.pathname === '/api/worlds/me') {
      const s = sessionOf(req, {});
      return json(res, 200, { ok: true, role: s ? s.role : 'visitor', moderator: !!(s && s.role === 'moderator') });
    }
    if (u.pathname === '/api/worlds/edit' && req.method === 'POST') {
      const b = await readBody(req);
      const mod = requireMod(req, b);
      if (!mod) return json(res, 403, { ok: false, error: 'moderator required' });
      if (b.op === 'undo') {
        const inv = st.undo.pop(); if (!inv) return json(res, 400, { ok: false, error: 'nothing to undo' });
        const r = commitEdit(Array.isArray(inv) ? inv[0] : inv, mod, { undoable: false });
        if (r.ok) st.redo.push(b.last || { type: 'noop' });
        return json(res, r.ok ? 200 : 400, r);
      }
      if (b.op === 'redo') {
        const nx = st.redo.pop(); if (!nx) return json(res, 400, { ok: false, error: 'nothing to redo' });
        return json(res, 200, commitEdit(nx, mod));
      }
      return json(res, 200, commitEdit(b, mod));
    }
    if (u.pathname === '/api/worlds/audit') {
      const mod = requireMod(req, {});
      if (!mod) return json(res, 403, { ok: false, error: 'moderator required' });
      return json(res, 200, { audit: st.audit.slice(-100) });
    }
    if (u.pathname === '/api/office/world-event' && req.method === 'POST') {
      const key = env('WORLD_KEY');
      if (key && (req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { ok: false });
      return json(res, 200, { ok: true, seq: world.seq, standalone: true });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false });
    let file = safeJoin(STATIC_ROOT, u.pathname);
    if (file && sendFile(req, res, file)) return;
    if (u.pathname === '/' || u.pathname === '/worlds' || u.pathname === '/worlds/') {
      const idx = path.join(STATIC_ROOT, 'worlds', 'index.html');
      if (sendFile(req, res, idx)) return;
    }
    json(res, 404, { ok: false });
  } catch (e) {
    json(res, 400, { ok: false, error: String(e.message || e).slice(0, 160) });
  }
});
srv.on('upgrade', (req, sock, head) => {
  if (new URL(req.url || '/', 'http://x').pathname !== '/api/office/world') return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => {
    ws.send(JSON.stringify(snap()));
    ws.on('message', m => { if (String(m) === 'ping') ws.send('{"t":"pong"}'); });
  });
});
srv.listen(PORT, BIND, () => log('info', 'worlds-host up', { bind: BIND, port: PORT, static: STATIC_ROOT, mods: MOD_TOKENS.size }));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { try { persist(); persistWorld(); } catch {} process.exit(0); });
