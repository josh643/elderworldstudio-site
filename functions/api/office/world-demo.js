import { json, memRate } from './_util.js';
import { worldDO } from './world.js';
// POST /api/office/world-demo  STAGING ONLY (OFFICE_MODE=staging on the Pages preview env; production has no binding at all).
// Simulated lease of a demo lot + avenue resurfacing so Joshua can watch a full build: {} | {lot, secs} | {clear:true}.
// Only touches entities flagged demo; refuses a lot that is leased for real. No store/user data involved.
const AVE_Z = 62 + 19.5;   // campus avenue centre line (engine fZ + 62; fZ = 19.5 for the current lobby shell; client sends exact)
export async function onRequestPost({ request, env }) {
  if (env.OFFICE_MODE !== 'staging' || !env.OFFICE_RL) return json({ ok: false, error: 'staging only' }, 404);
  const ip = request.headers.get('cf-connecting-ip') || 'x'; if (!memRate('wdemo:' + ip, 6, 600e3)) return json({ ok: false, error: 'slow down' }, 429);
  let j = {}; try { j = await request.json(); } catch {}
  if (j.clear) return json(await (await worldDO(env).fetch('https://rl/world/demo', { method: 'POST', body: '{"clear":true}' })).json());
  const lot = Number.isInteger(j.lot) && j.lot >= 1 && j.lot <= 80 ? j.lot : 9, secs = Math.max(60, Math.min(900, Number(j.secs) || 240));
  const z = Number.isFinite(j.aveZ) && Math.abs(j.aveZ) < 400 ? j.aveZ : AVE_Z, x0 = Number.isFinite(j.roadX0) ? Math.max(-150, Math.min(150, j.roadX0)) : -34, x1 = Number.isFinite(j.roadX1) ? Math.max(-150, Math.min(150, j.roadX1)) : 34;
  const body = { lot, secs, tenant: 'Demo Shop', road: j.road === false ? null : { name: 'Avenue resurfacing', a: [x0, z], b: [x1, z], w: 10 },
    style: { floors: 2, color: 'sandstone', kind: 'shop' }, parts: { landscaping: '/office/assets/exterior/shrub_03.glb?v=1' } };
  const r = await worldDO(env).fetch('https://rl/world/demo', { method: 'POST', body: JSON.stringify(body) }); return json(await r.json(), r.status);
}
