import { json } from './_util.js';
// GET /api/office/state: sanitized public snapshot. Served from the Cloudflare edge cache (5 s), backed by one KV key
// written by the CT111 publisher. Visitors never reach CT111/CT112. Multiplayer later: a Durable Object room per hall
// can fan this same snapshot out over WebSockets.
export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default, key = new Request(new URL('/api/office/state', request.url).toString());
  let r = await cache.match(key); if (r) return r;
  const s = env.OFFICE_KV ? await env.OFFICE_KV.get('state', { type: 'json', cacheTtl: 30 }) : null;
  const th = env.OFFICE_KV ? await env.OFFICE_KV.get('thumbs:idx', { type: 'json', cacheTtl: 30 }) : null;
  r = json({ ...(s || { updated: null, work: [] }), thumbs: th || null }, 200, { 'cache-control': 'public, max-age=5, s-maxage=5' });
  waitUntil(cache.put(key, r.clone())); return r;
}
