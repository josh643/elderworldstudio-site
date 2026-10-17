import { worldDO } from './world.js';
// GET /api/office/layout-status: public approval status for the holo table tablet (who, when, why, revoke-by) + last 10 log lines.
export async function onRequestGet({ env }) {
  const H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!env.OFFICE_RL) return new Response('{"ok":false}', { headers: H });
  try { const r = await worldDO(env).fetch('https://rl/world/approvals'), t = await r.text(); let j; try { j = JSON.parse(t); } catch { return new Response(JSON.stringify({ ok: false, status: r.status, body: t.slice(0, 200) }), { status: 502, headers: H }); }
    return new Response(JSON.stringify({ ok: true, layout: j.layout, latest: j.latest, log: (j.log || []).slice(0, 10) }), { headers: H });
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 200) }), { status: 500, headers: H }); }
}
