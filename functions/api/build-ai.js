// POST /api/build-ai — AI site spec for the website builder. Server-side only (Workers AI binding AI); no keys reach the browser.
// actions: generate | regenerate | edit (needs spec + request) | outcome (training log only). Limits + daily $ cap in D1 (BUILD_LEADS).
import { parseInput, validateSpec, fallbackSpec, prompt, SCHEMA, MODEL, costUSD, checkLimits, addCost, direction, applyDirection, pickDistinct, recentSigs, saveSig, signature, ensureTables, cleanText, trainRow, logTrain, safePrompt, unsafeSpec, validatePage, pagePrompt, PAGE_SCHEMA, DRAFT_PAGE_MAX } from '../_lib/sitespec.js';
const json = (o, s = 200) => Response.json(o, { status: s, headers: { 'Cache-Control': 'no-store' } });
// Model: ews-llm gateway (alias luna) when EWS_LLM_URL + EWS_LLM_KEY are set; Workers AI only as a fallback.
export const GATEWAY_MODEL = 'luna';
const parseRaw = (raw) => { if (typeof raw === 'string') { raw = raw.replace(/^```(?:json)?|```$/g, '').trim(); raw = JSON.parse(raw); } return raw; };
export async function runGateway(env, messages, temperature, fetcher = fetch, schema = SCHEMA) {
  const url = env.EWS_LLM_URL.replace(/\/$/, '') + '/v1/chat/completions';
  const r = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.EWS_LLM_KEY },
    body: JSON.stringify({ model: env.EWS_LLM_MODEL || GATEWAY_MODEL, messages, response_format: { type: 'json_schema', json_schema: { name: 'site_spec', schema } }, max_completion_tokens: 3000 }) });
  if (!r.ok) throw new Error('gateway ' + r.status);
  const j = await r.json();
  return { raw: parseRaw(j.choices?.[0]?.message?.content), usage: j.usage, usd: typeof j.cost_usd === 'number' ? j.cost_usd : null, via: 'ews-llm' };
}
export async function runModel(env, messages, temperature = 0.9, fetcher = fetch, schema = SCHEMA) {
  if (env.EWS_LLM_URL && env.EWS_LLM_KEY) {
    try { return await runGateway(env, messages, temperature, fetcher, schema); } catch (e) { if (!env.AI) throw e; }
  }
  let r;
  try { r = await env.AI.run(MODEL, { messages, response_format: { type: 'json_schema', json_schema: schema }, max_tokens: 3000, temperature }); }
  catch (e) { r = await env.AI.run(MODEL, { messages: [...messages, { role: 'user', content: 'Reply with only the JSON object.' }], max_tokens: 3000, temperature }); } // JSON mode can fail inside Workers AI
  return { raw: parseRaw(r && (r.response ?? r.choices?.[0]?.message?.content)), usage: r && r.usage, via: 'workers-ai' };
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'Bad request.' }, 400);
  const action = ['generate', 'regenerate', 'edit', 'outcome', 'page'].includes(b.action) ? b.action : 'generate';
  const inp = parseInput(b.input), db = env.BUILD_LEADS;
  const train = { consent: b.consent === true, nameConsent: b.nameConsent === true, session: b.session, inp };
  const prev = b.spec ? validateSpec(b.spec).spec : null;
  if (action === 'outcome') {
    const outcome = ['lead', 'abandoned', 'kept'].includes(b.outcome) ? b.outcome : 'kept';
    const stored = await logTrain(db, trainRow({ ...train, event: 'final', spec: prev, outcome })).catch(() => false);
    return json({ ok: true, stored });
  }
  if (!inp.name) return json({ ok: false, error: 'Add your business name first.' }, 400);
  let request_ = '';
  if (action === 'edit' || action === 'page') {
    const sp = safePrompt(b.request, action === 'page' ? 200 : 300); if (!sp.ok) return json({ ok: false, error: sp.error }, 400); request_ = sp.text;
    if (!prev) return json({ ok: false, error: 'Make a design first.' }, 400);
  }
  if (action === 'page') return json(await pageAction(env, db, request, inp, prev, request_, b));
  const fb = (reason) => ({ ok: true, source: 'fallback', reason, spec: action === 'edit' && prev ? prev : fallbackSpec(inp) });
  if ((!env.AI && !(env.EWS_LLM_URL && env.EWS_LLM_KEY)) || !db) return json(fb('ai-off'));
  await ensureTables(db);
  const lim = await checkLimits(db, request.headers.get('cf-connecting-ip') || '', Number(env.AI_DAILY_CAP_USD || 3));
  if (!lim.ok) return json({ ...fb(lim.reason), error: lim.reason === 'rate' ? 'You’re going fast! Try again in a few minutes.' : 'Our designer is resting for today. Here’s a starter layout.' }, lim.reason === 'rate' ? 429 : 200);
  let out;
  try {
    const msgs = prompt(inp, action === 'edit' ? prev : null, request_);
    let v = { ok: false, errors: ['no output'] }, cost = 0, via = null, distinct = null;
    for (const t of [0.9, 0.5]) { // one retry at lower temperature if the model output is cut off or invalid
      try { const { raw, usage, usd, via: m } = await runModel(env, msgs, t); via = m; const c = usd ?? costUSD(usage); cost += c; await addCost(db, lim.day, c); v = validateSpec(raw); if (v.ok && unsafeSpec(v.spec)) v = { ok: false, errors: ['unsafe'] }; }
      catch (e) { cost += costUSD(null); await addCost(db, lim.day, costUSD(null)).catch(() => {}); v = { ok: false, errors: [String(e && e.message || e).slice(0, 80)] }; }
      if (v.ok) break;
    }
    if (v.ok && action !== 'edit') {
      const recent = await recentSigs(db, 10).catch(() => []);
      if (action === 'regenerate' && prev && prev.palette) { try { recent.unshift(signature(prev)); } catch {} } // never regenerate into the same look
      const d = pickDistinct(v.spec, inp, recent); v.spec = d.spec; distinct = { tries: d.tries, score: d.score };
      await saveSig(db, signature(v.spec)).catch(() => {});
    }
    out = v.ok ? { ok: true, source: 'ai', model: via, distinct, spec: v.spec, cost: Number(cost.toFixed(5)) } : { ...fb('invalid'), invalid: v.errors };
  } catch (e) { out = { ...fb('error'), detail: String(e && e.message || e).replace(/[^\w .:-]/g, '').slice(0, 80) }; }
  if (out.source === 'ai') await logTrain(db, trainRow({ ...train, event: action, request: request_, spec: out.spec, prev: action === 'edit' ? prev : null, source: 'ai' })).catch(() => {});
  return json(out);
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/build/' } });

// AI page builder: one new or edited page in the site's existing design system. Same rate limits + daily cap as designs.
export async function pageAction(env, db, request, inp, spec, request_, b) {
  if ((!env.AI && !(env.EWS_LLM_URL && env.EWS_LLM_KEY)) || !db) return { ok: false, error: 'Our page designer is offline right now.' };
  if (Number(b.count || 0) >= DRAFT_PAGE_MAX && !b.page) return { ok: false, error: 'This draft has the most pages we can add for free. Tell us the rest when you get it built.' };
  await ensureTables(db);
  const lim = await checkLimits(db, request.headers.get('cf-connecting-ip') || '', Number(env.AI_DAILY_CAP_USD || 3));
  if (!lim.ok) return { ok: false, error: lim.reason === 'rate' ? 'You’re going fast! Try again in a few minutes.' : 'Our designer is resting for today.' };
  const cur = b.page ? validatePage(b.page).page : null;
  const msgs = pagePrompt(inp, spec, request_, cur); let v = { ok: false, errors: ['no output'] }, cost = 0, via = null;
  for (const t of [0.8, 0.4]) {
    try { const { raw, usage, usd, via: m } = await runModel(env, msgs, t, fetch, PAGE_SCHEMA); via = m; const c = usd ?? costUSD(usage); cost += c; await addCost(db, lim.day, c); v = validatePage(raw); }
    catch (e) { v = { ok: false, errors: [String(e && e.message || e).slice(0, 80)] }; }
    if (v.ok) break;
  }
  return v.ok ? { ok: true, source: 'ai', model: via, page: v.page, cost: Number(cost.toFixed(5)) } : { ok: false, error: 'Couldn’t design that page. Try different words.', invalid: v.errors };
}
