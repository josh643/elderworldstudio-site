// POST /api/build-ai — AI site spec for the website builder. Server-side only (Workers AI binding AI); no keys reach the browser.
// actions: generate | regenerate | edit (needs spec + request) | outcome (training log only). Limits + daily $ cap in D1 (BUILD_LEADS).
import { parseInput, validateSpec, fallbackSpec, prompt, SCHEMA, MODEL, costUSD, checkLimits, addCost, direction, applyDirection, ensureTables, cleanText, trainRow, logTrain } from '../_lib/sitespec.js';
const json = (o, s = 200) => Response.json(o, { status: s, headers: { 'Cache-Control': 'no-store' } });
export async function runModel(env, messages) {
  const r = await env.AI.run(MODEL, { messages, response_format: { type: 'json_schema', json_schema: SCHEMA }, max_tokens: 1800, temperature: 0.9 });
  let raw = r && (r.response ?? r.choices?.[0]?.message?.content);
  if (typeof raw === 'string') { raw = raw.replace(/^```(?:json)?|```$/g, '').trim(); raw = JSON.parse(raw); }
  return { raw, usage: r && r.usage };
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'Bad request.' }, 400);
  const action = ['generate', 'regenerate', 'edit', 'outcome'].includes(b.action) ? b.action : 'generate';
  const inp = parseInput(b.input), db = env.BUILD_LEADS;
  const train = { consent: b.consent === true, nameConsent: b.nameConsent === true, session: b.session, inp };
  const prev = b.spec ? validateSpec(b.spec).spec : null;
  if (action === 'outcome') {
    const outcome = ['lead', 'abandoned', 'kept'].includes(b.outcome) ? b.outcome : 'kept';
    const stored = await logTrain(db, trainRow({ ...train, event: 'final', spec: prev, outcome })).catch(() => false);
    return json({ ok: true, stored });
  }
  if (!inp.name) return json({ ok: false, error: 'Add your business name first.' }, 400);
  const request_ = action === 'edit' ? cleanText(b.request, 300) : '';
  if (action === 'edit' && (!request_ || !prev)) return json({ ok: false, error: 'Tell us what to change.' }, 400);
  const fb = (reason) => ({ ok: true, source: 'fallback', reason, spec: action === 'edit' && prev ? prev : fallbackSpec(inp) });
  if (!env.AI || !db) return json(fb('ai-off'));
  await ensureTables(db);
  const lim = await checkLimits(db, request.headers.get('cf-connecting-ip') || '', Number(env.AI_DAILY_CAP_USD || 3));
  if (!lim.ok) return json({ ...fb(lim.reason), error: lim.reason === 'rate' ? 'You’re going fast! Try again in a few minutes.' : 'Our designer is resting for today. Here’s a starter layout.' }, lim.reason === 'rate' ? 429 : 200);
  let out;
  try {
    const { raw, usage } = await runModel(env, prompt(inp, action === 'edit' ? prev : null, request_));
    const cost = costUSD(usage); await addCost(db, lim.day, cost);
    const v = validateSpec(raw);
    if (v.ok && action !== 'edit') applyDirection(v.spec, direction(inp));
    out = v.ok ? { ok: true, source: 'ai', spec: v.spec, cost: Number(cost.toFixed(5)) } : { ...fb('invalid'), invalid: v.errors };
  } catch (e) { out = fb('error'); }
  if (out.source === 'ai') await logTrain(db, trainRow({ ...train, event: action, request: request_, spec: out.spec, prev: action === 'edit' ? prev : null, source: 'ai' })).catch(() => {});
  return json(out);
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/build/' } });
