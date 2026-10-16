import { json } from './_util.js';
// GET /api/office/lead-status?id=<lead id> -> {status} only (no personal data). Client keeps its own ids in localStorage.
export async function onRequestGet({ request, env }) {
  const id = (new URL(request.url).searchParams.get('id') || '').replace(/[^0-9a-f-]/gi, '').slice(0, 40); if (!id) return json({ error: 'bad id' }, 400);
  const st = await env.OFFICE_KV.get('leadst:' + id, 'json');
  return json({ id, status: st?.s || 'unknown', team: st?.team || null });
}
