import { json, authed } from './_util.js';
import { worldDO } from './world.js';
// POST /api/office/world-release  (office ingest key). Called by tools/deploy-staging.sh after each deploy: the world DO tells every
// connected visitor 'module/asset X has a new version'; their live-update module fetches it in the background and swaps it in place.
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  if (!env.OFFICE_RL) return json({ ok: false, error: 'no world binding' }, 503);
  let j = {}; try { j = await request.json(); } catch {}
  const body = { code: typeof j.code === 'string' ? j.code : '', modules: j.modules && typeof j.modules === 'object' ? j.modules : {}, assets: Number(j.assets) || 0 };
  const r = await worldDO(env).fetch('https://rl/world/release', { method: 'POST', body: JSON.stringify(body) }); return json(await r.json(), r.status);
}
