import { json, authed } from './_util.js';
import names from '../../../site/office/data/names.json';
// Desk-screen snapshots. POST (CT111 publisher, bearer): {b64: jpeg atlas, idx: {agent: cell}} ~1/min.
// GET: the JPEG atlas (edge-cached 50 s). The cell map rides in /api/office/state as thumbs.
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const { b64, idx } = await request.json(); if (!b64 || b64.length > 700000) return json({ ok: false }, 400);
  const map = {}; for (const [a, i] of Object.entries(idx || {})) if (names[a] && Number.isInteger(i) && i >= 0 && i < 256) map[a] = i;
  const v = Date.now().toString(36);
  await env.OFFICE_KV.put('thumbs', Uint8Array.from(atob(b64), c => c.charCodeAt(0)), { expirationTtl: 1800 });
  await env.OFFICE_KV.put('thumbs:idx', JSON.stringify({ v, map }), { expirationTtl: 1800 });
  return json({ ok: true, n: Object.keys(map).length });
}
export async function onRequestGet({ env }) {
  const b = await env.OFFICE_KV.get('thumbs', { type: 'arrayBuffer' }); if (!b) return new Response('', { status: 404 });
  return new Response(b, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=50' } });
}
