import { json, authed } from './_util.js';
// CT111 Piper worker only (bearer OFFICE_INGEST_KEY). GET: take pending jobs. POST {h, b64}: store rendered mp3 (24 h).
export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const raw = await env.OFFICE_KV.get('tts:q'); if (!raw || raw === '[]') return json({ jobs: [] });
  await env.OFFICE_KV.put('tts:q', '[]', { expirationTtl: 600 }); return json({ jobs: JSON.parse(raw) });
}
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const { h, b64 } = await request.json(); if (!/^[0-9a-f]{24}$/.test(h || '') || !b64 || b64.length > 1.5e6) return json({ ok: false }, 400);
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  await env.OFFICE_KV.put('tts:a:' + h, bin, { expirationTtl: 86400 }); return json({ ok: true });
}
