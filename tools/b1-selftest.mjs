// node tools/b1-selftest.mjs : B1 IP lock selftest (Joshua 2026-10-17 00:17)
import { inList, allowed } from '../functions/api/office/_b1.js';
import { onRequest as mw } from '../functions/office/b1/_middleware.js';
import { onRequest as api } from '../functions/api/office/b1/[[op]].js';
const t = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok', m); };
const kv = new Map(); const KV = { get: async k => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) };
const env = { B1_ALLOW_IPS: '73.5.29.68 2601:3cb:d85:a440::/64', B1_OWNER_KEY: 'x'.repeat(32), OFFICE_KV: KV };
const req = (ip, path = '/office/b1/b1.js', init = {}) => new Request('https://h' + path, { ...init, headers: { 'cf-connecting-ip': ip, ...(init.headers || {}) } });
t(inList('73.5.29.68', env.B1_ALLOW_IPS) && !inList('73.5.29.69', env.B1_ALLOW_IPS), 'ipv4 exact');
t(inList('2601:3cb:d85:a440::9', env.B1_ALLOW_IPS) && !inList('2601:3cb:d85:a441::9', env.B1_ALLOW_IPS), 'ipv6 /64');
t(!inList('104.28.252.2', env.B1_ALLOW_IPS) && !inList('', env.B1_ALLOW_IPS) && !inList('garbage', env.B1_ALLOW_IPS), 'others + junk denied');
let r = await mw({ request: req('8.8.8.8'), env, next: async () => new Response('ROOM') }); const body = await r.text();
t(r.status === 403 && !body.includes('ROOM'), 'asset denied for outsider, no B1 data'); t(JSON.parse(kv.get('b1:denied')).length === 1, 'denial logged');
r = await mw({ request: req('73.5.29.68'), env, next: async () => new Response('ROOM') }); t(r.status === 200 && (await r.text()) === 'ROOM', 'asset served to allowlisted IP');
r = await api({ request: req('8.8.8.8', '/api/office/b1/feed'), env, params: { op: ['feed'] } }); t(r.status === 403, 'feed denied for outsider');
r = await api({ request: req('9.9.9.9', '/api/office/b1/owner-ip', { method: 'POST', body: JSON.stringify({ key: 'wrong' }) }), env, params: { op: ['owner-ip'] } }); t(r.status === 403, 'owner-ip needs the owner key');
r = await api({ request: req('9.9.9.9', '/api/office/b1/owner-ip', { method: 'POST', body: JSON.stringify({ key: env.B1_OWNER_KEY }) }), env, params: { op: ['owner-ip'] } }); t(r.status === 200, 'owner can set new home IP');
t((await allowed(req('9.9.9.9'), env)).ok, 'owner IP now allowed'); t(!(await allowed(req('9.9.9.10'), env)).ok, 'neighbour still denied');
console.log('b1 selftest OK');
