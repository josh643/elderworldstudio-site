// Shared helpers for /api/office/*. KV binding: OFFICE_KV. Secret: OFFICE_INGEST_KEY (CT111 publisher).
export const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
export const authed = (request, env) => { const k = env.OFFICE_INGEST_KEY; const a = request.headers.get('authorization') || ''; return !!k && a === `Bearer ${k}`; };
export const day = () => new Date().toISOString().slice(0, 10);
// Per-isolate in-memory limiter: zero KV writes per visitor (scales with traffic). Approximate across isolates by design;
// the daily $ cap below is the hard backstop. Later: swap for the Workers Rate Limiting binding or a Durable Object.
const MEM = new Map();
export function memRate(key, limit, windowMs) {
  const now = Date.now(), e = MEM.get(key);
  if (!e || now > e.reset) { if (MEM.size > 5000) MEM.clear(); MEM.set(key, { n: 1, reset: now + windowMs }); return true; }
  return ++e.n <= limit;
}
export async function rate(env, key, limit, ttl) {          // coarse KV counter, only for LOW-volume actions (lead submits)
  if (!env.OFFICE_KV) return true;
  const n = Number(await env.OFFICE_KV.get(key)) || 0; if (n >= limit) return false;
  await env.OFFICE_KV.put(key, String(n + 1), { expirationTtl: ttl }); return true;
}
// Public feed allowlist: only these fields ever leave. The one free-text field is a short task title, redacted twice
// (publisher on CT111 and here): no paths, URLs, emails, ids, code or long numbers; plain words only, 64 chars.
export function redactTask(t) {
  let s = String(t || '').replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\S+@\S+/g, ' ')
    .replace(/\S*[\/\\]\S*/g, ' ').replace(/\S+\.(py|js|ts|md|json|sh|html|css)\b/gi, ' ').replace(/\b\d{3,}\b/g, ' ')
    .replace(/[^A-Za-z0-9 ,.'&:+-]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.split(/(?<=[.;:])\s/)[0].replace(/[.:;,]+$/, '');
  if (s.length > 64) s = s.slice(0, 64).replace(/\s+\S*$/, '') + '…';
  return s.length >= 4 ? s : '';
}
// Asset desk (2026-10-16): the assets agent's desk screen shows the asset being built and its live step. Allowlisted,
// plain words only; anything else is dropped.
const ASTEPS = ['generating', 'checking', 'PASS', 'FAIL', 'HOLD'], AKINDS = ['Elderverse prop', 'Merch replica', 'Game asset', 'Polish'];
function assetInfo(agent, a) {
  if (agent !== 'assets' || !a || !ASTEPS.includes(a.step)) return {};
  const name = String(a.name || '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return {};
  const n = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));
  return { asset: { name, kind: AKINDS.includes(a.kind) ? a.kind : 'Asset', step: a.step, try: Math.max(1, n(a.try, 5)), left: n(a.left, 999), more: n(a.more, 20) } };
}
// Live bar anchors (2026-10-16): numbers + enums only. Client eases p0 -> p1 over eta seconds from since; never past p1.
const SUBS = ['plan', 'build', 'fix', 'check', 'self-check', 'release', 'waiting', 'QA', 'review', 'ready'];
function liveBar(w) {
  const c = v => Math.max(0, Math.min(1, Number(v) || 0)), since = String(w.since || '').slice(0, 40), out = {};
  if (since && !Number.isNaN(Date.parse(since))) out.since = since;
  const eta = Math.floor(Number(w.eta) || 0); if (eta > 0 && eta <= 86400) out.eta = eta;
  if (w.p0 != null) out.p0 = c(w.p0); if (w.p1 != null) out.p1 = Math.max(out.p0 || 0, c(w.p1));
  if (w.sub && SUBS.includes(w.sub.k)) out.sub = { k: w.sub.k, n: Math.max(1, Math.min(20, Math.floor(Number(w.sub.n) || 1))) };
  return out;
}
const STAGES = ['waiting', 'plan', 'build', 'self-check', 'QA', 'review', 'ready', 'released'];
export function sanitize(raw, names) {
  const out = { updated: String(raw.updated || new Date().toISOString()).slice(0, 40), work: [] };
  const seen = new Set();
  for (const w of (raw.work || []).slice(0, 200)) {
    const agent = String(w.agent || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (!agent || !names[agent] || seen.has(agent)) continue; seen.add(agent);
    const stage = STAGES.includes(w.stage) ? w.stage : null; if (!stage) continue;
    out.work.push({ agent, name: names[agent].name, role: names[agent].role, team: String(w.team || '').replace(/[^a-z0-9-]/gi, '').slice(0, 30),
      stage, progress: Math.max(0, Math.min(1, Number(w.progress) || 0)), blocked: !!w.blocked, task: redactTask(w.task), ...assetInfo(agent, w.asset), ...liveBar(w) });
  }
  out.last = {}; for (const [a, t] of Object.entries(raw.last || {}).slice(0, 200)) { if (names[a] && !seen.has(a)) { const r = redactTask(t); if (r) out.last[a] = r; } }
  if (raw.thumbs) out.thumbs = raw.thumbs;
  return out;
}

// Strongly consistent limiter (Durable Object in worker ews-office-limiter, binding OFFICE_RL). rules = [[name, limit, windowMs]].
// Fails CLOSED for chat (returns ok:false) if the binding is missing, so a misconfig can never become an open LLM proxy.
export async function doLimit(env, key, rules, add = 0) {
  if (!env.OFFICE_RL) return { ok: false, spent: Infinity, missing: true };
  const stub = env.OFFICE_RL.get(env.OFFICE_RL.idFromName(key));
  const r = await stub.fetch(`https://rl/?rules=${encodeURIComponent(JSON.stringify(rules))}${add ? '&add=' + add : ''}`);
  return r.json();
}
// Visitor key: IPv4 as-is, IPv6 by /64 (one household/device network; stops address rotation from dodging limits).
export function visitor(request) {
  const ip = request.headers.get('cf-connecting-ip') || '0';
  if (!ip.includes(':')) return ip;
  const full = ip.includes('::') ? (() => { const [a, b] = ip.split('::'); const A = a ? a.split(':') : [], B = b ? b.split(':') : []; return [...A, ...Array(8 - A.length - B.length).fill('0'), ...B]; })() : ip.split(':');
  return full.slice(0, 4).join(':') + '::/64';
}

// Piper TTS queue (KV). Only server code enqueues (Freyja's replies), so this is never an open TTS proxy.
export async function enqueueTTS(env, text, voice) {
  text = String(text).slice(0, 600); const d = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(voice + '|' + text)));
  const h = [...d].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  const r = await ttsDO(env, 'enqueue', { method: 'POST', body: JSON.stringify({ h, voice, text }) }).then(r => r.json());
  if (r.ready) return h + '!';
  return h;
}

// TTS store lives in the OFFICE_RL Durable Object worker (strongly consistent; no cached misses).
export function ttsDO(env, op, init, qs = '') { const stub = env.OFFICE_RL.get(env.OFFICE_RL.idFromName('tts')); return stub.fetch(`https://rl/tts/${op}${qs}`, init); }
