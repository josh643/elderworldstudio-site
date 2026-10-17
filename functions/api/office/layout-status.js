import { worldDO } from './world.js';
// GET /api/office/layout-status: public approval status for the holo table tablet (who, when, why, revoke-by) + last 10 log lines.
export async function onRequestGet({ env }) {
  if (!env.OFFICE_RL) return Response.json({ ok: false });
  const j = await (await worldDO(env).fetch('https://rl/world/approvals')).json();
  return new Response(JSON.stringify({ ok: true, layout: j.layout, latest: j.latest, log: (j.log || []).slice(0, 10) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
