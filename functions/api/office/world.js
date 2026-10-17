import { json } from './_util.js';
// GET /api/office/world: Elderverse live world (lots, roads, buildings + construction stage/progress).
// With "Upgrade: websocket" it joins the Durable Object room (snapshot on connect, then deltas); otherwise a JSON snapshot (poll fallback).
export const worldDO = env => env.OFFICE_RL.get(env.OFFICE_RL.idFromName('world:' + (env.OFFICE_MODE || 'prod')));
export async function onRequestGet({ request, env }) {
  if (!env.OFFICE_RL) return json({ t: 'snap', seq: 0, ents: [], off: true });
  if (request.headers.get('upgrade') === 'websocket') return worldDO(env).fetch('https://rl/world/ws', request);
  const r = await worldDO(env).fetch('https://rl/world/state'); return new Response(r.body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
