// POST /api/build-img — one industry-fit hero image for a draft (Workers AI flux-1-schnell). Owner photos always win client-side.
// Prompt is built server-side from the business type + the AI's own imagery line, cleaned and safety-checked. Rate-limited per IP; cost counted in the daily cap.
import { cleanText, safePrompt, ensureTables, addCost, ipKey, bump } from '../_lib/sitespec.js';
const json = (o, s = 200) => Response.json(o, { status: s, headers: { 'Cache-Control': 'no-store' } });
export const IMG_MODEL = '@cf/black-forest-labs/flux-1-schnell', IMG_USD = 0.0006, IMG_PER_10MIN = 10;
const TYPEWORD = { salon: 'salon interior', bakery: 'artisan bakery', restaurant: 'restaurant', auto: 'auto repair garage', retail: 'local shop', pro: 'home services', other: 'small business' };
export function imagePrompt(type, imagery) {
  const s = safePrompt(imagery, 220); if (!s.ok) return null;
  return `Editorial commercial photograph for a ${TYPEWORD[type] || TYPEWORD.other} website hero: ${s.text}. Natural light, rich color, shallow depth of field, wide composition, no text, no logos, no watermarks, safe for work.`;
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const p = imagePrompt(cleanText(b && b.type, 30), b && b.imagery); if (!p) return json({ ok: false, error: 'unsafe' }, 400);
  const db = env.BUILD_LEADS; if (!env.AI || !db) return json({ ok: false, error: 'off' });
  await ensureTables(db);
  const ip = request.headers.get('cf-connecting-ip') || '', now = Date.now(), w = 600000;
  const n = await bump(db, `i:${await ipKey(ip)}:${Math.floor(now / w)}`, w, now); if (n > IMG_PER_10MIN) return json({ ok: false, error: 'rate' }, 429);
  const day = new Date(now).toISOString().slice(0, 10), spent = await db.prepare('SELECT usd FROM ai_cost WHERE day = ?').bind(day).first();
  if (spent && spent.usd >= Number(env.AI_DAILY_CAP_USD || 3)) return json({ ok: false, error: 'budget' });
  try { const r = await env.AI.run(IMG_MODEL, { prompt: p, steps: 4 }); await addCost(db, day, IMG_USD);
    if (!r || !r.image) return json({ ok: false, error: 'empty' }); return json({ ok: true, image: 'data:image/jpeg;base64,' + r.image, cost: IMG_USD, model: IMG_MODEL });
  } catch (e) { return json({ ok: false, error: 'error' }); }
}
