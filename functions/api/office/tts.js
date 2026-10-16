import { json } from './_util.js';
// GET /api/office/tts?h=<id> -> audio/mpeg once CT111 Piper has rendered it (short cache: 1 day in KV), else 202 pending.
export async function onRequestGet({ request, env }) {
  const h = new URL(request.url).searchParams.get('h') || ''; if (!/^[0-9a-f]{24}$/.test(h)) return json({ error: 'bad id' }, 400);
  const b = await env.OFFICE_KV.get('tts:a:' + h, { type: 'arrayBuffer' });
  if (!b) return json({ pending: true }, 202);
  return new Response(b, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400, immutable' } });
}
