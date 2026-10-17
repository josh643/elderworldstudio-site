import { json, ttsDO } from './_util.js';
// Public: rendered Piper audio by id. Served straight from the Durable Object; misses are 202 + no-store so nothing caches them.
export async function onRequestGet({ request, env }) {
  const h = new URL(request.url).searchParams.get('h') || ''; if (!/^[0-9a-f]{24}$/.test(h)) return json({ error: 'bad id' }, 400);
  const r = await ttsDO(env, 'get', undefined, '?h=' + h);
  if (r.status !== 200) return new Response(JSON.stringify({ pending: true }), { status: 202, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  return new Response(r.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400, immutable' } });
}
