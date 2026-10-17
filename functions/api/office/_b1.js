// B1 Command Center lock (Joshua 2026-10-17 00:17: "Lock the basement to mine and your IPs"). Server-side only.
// Allowlist = env B1_ALLOW_IPS (comma/space list of IPv4/IPv6 addresses or CIDR prefixes) + the owner's current IP in KV (b1:owner_ip),
// updated by Joshua with the owner key (B1_OWNER_KEY) at POST /api/office/b1/owner-ip. Denied attempts are logged to KV b1:denied (last 200).
const v4 = s => { const p = s.split('.'); if (p.length !== 4 || p.some(x => !/^\d{1,3}$/.test(x) || +x > 255)) return null; return p.reduce((a, x) => (a << 8n) | BigInt(+x), 0n); };
const v6 = s => { s = s.toLowerCase().replace(/^\[|\]$/g, ''); if (!/^[0-9a-f:.]+$/.test(s) || !s.includes(':')) return null;
  let [h, t] = s.split('::'); if (s.split('::').length > 2) return null;
  const parts = x => (x ? x.split(':') : []); let a = parts(h), b = parts(t ?? '');
  const tail4 = b.length ? b[b.length - 1] : a[a.length - 1];
  if (tail4 && tail4.includes('.')) { const n = v4(tail4); if (n == null) return null; const hx = [(n >> 16n) & 0xffffn, n & 0xffffn].map(x => x.toString(16)); if (b.length) b.splice(-1, 1, ...hx); else a.splice(-1, 1, ...hx); }
  const fill = t === undefined ? 0 : 8 - a.length - b.length; if (fill < 0 || (t === undefined && a.length !== 8)) return null;
  const all = [...a, ...Array(fill).fill('0'), ...b]; if (all.some(x => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return all.reduce((acc, x) => (acc << 16n) | BigInt(parseInt(x, 16)), 0n); };
export function parseIp(s) { s = String(s || '').trim(); const a = v4(s); if (a != null) return { f: 4, n: a, bits: 32 }; const b = v6(s); if (b != null) return { f: 6, n: b, bits: 128 }; return null; }
export function inList(ip, list) {
  const p = parseIp(ip); if (!p) return false;
  for (const raw of String(list || '').split(/[\s,]+/).filter(Boolean)) {
    const [addr, len] = raw.split('/'); const q = parseIp(addr); if (!q || q.f !== p.f) continue;
    const L = len == null ? q.bits : Math.max(0, Math.min(q.bits, parseInt(len, 10) || 0)); const sh = BigInt(q.bits - L);
    if ((p.n >> sh) === (q.n >> sh)) return true;
  }
  return false;
}
export const clientIp = req => req.headers.get('cf-connecting-ip') || '';
export async function allowed(req, env) {
  const ip = clientIp(req); let owner = '';
  try { owner = (await env.OFFICE_KV?.get('b1:owner_ip')) || ''; } catch {}
  return { ip, ok: !!ip && inList(ip, `${env.B1_ALLOW_IPS || ''} ${owner}`) };
}
export async function logDenied(env, req, what) {
  try { const k = 'b1:denied'; const cur = JSON.parse((await env.OFFICE_KV.get(k)) || '[]');
    cur.unshift({ at: new Date().toISOString(), ip: clientIp(req), what: String(what).slice(0, 80), ua: (req.headers.get('user-agent') || '').slice(0, 120), country: req.cf?.country || '' });
    await env.OFFICE_KV.put(k, JSON.stringify(cur.slice(0, 200))); } catch {}
}
export const DENY_HTML = '<!doctype html><meta charset=utf-8><title>Restricted</title><body style="font:16px system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh"><div><h1>Restricted: World Operations</h1><p>This level is for Elder World Studio staff only. Sorry, you can\'t come down here.</p></div>';
export const denied = (json = false) => json ? new Response(JSON.stringify({ ok: false, allowed: false, error: 'Restricted: World Operations (staff only)' }), { status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  : new Response(DENY_HTML, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
