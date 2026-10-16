import { json, authed, ttsDO } from './_util.js';
// CT111 Piper worker only (bearer OFFICE_INGEST_KEY). GET: take pending jobs. POST {h, b64}: store rendered mp3 (24 h). Durable Object backed.
export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  return new Response((await ttsDO(env, 'take')).body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const { h, b64 } = await request.json(); if (!/^[0-9a-f]{24}$/.test(h || '') || !b64 || b64.length > 1.5e6) return json({ ok: false }, 400);
  return json(await (await ttsDO(env, 'put', { method: 'POST', body: JSON.stringify({ h, b64 }) })).json());
}
