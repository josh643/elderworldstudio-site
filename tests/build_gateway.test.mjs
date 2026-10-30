// node --test tests/ — ews-llm gateway (luna) is the default model path; Workers AI is only a fallback.
import test from 'node:test'; import assert from 'node:assert/strict';
import { runModel, GATEWAY_MODEL } from '../functions/api/build-ai.js';
const spec = { headline: 'Hi' };
const okFetch = (calls) => async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(spec) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }; };
test('uses gateway with luna + max_completion_tokens when configured', async () => {
  const calls = []; const env = { EWS_LLM_URL: 'https://gw.test/', EWS_LLM_KEY: 'k', AI: { run: () => { throw new Error('should not call workers ai'); } } };
  const r = await runModel(env, [{ role: 'user', content: 'x' }], 0.9, okFetch(calls));
  assert.equal(GATEWAY_MODEL, 'luna'); assert.equal(r.via, 'ews-llm'); assert.deepEqual(r.raw, spec);
  assert.equal(calls[0].url, 'https://gw.test/v1/chat/completions'); assert.equal(calls[0].body.model, 'luna');
  assert.equal(calls[0].body.max_completion_tokens, 3000); assert.equal(calls[0].body.max_tokens, undefined); assert.equal(calls[0].auth, 'Bearer k');
});
test('falls back to Workers AI when the gateway errors', async () => {
  const env = { EWS_LLM_URL: 'https://gw.test', EWS_LLM_KEY: 'k', AI: { run: async () => ({ response: spec }) } };
  const r = await runModel(env, [], 0.9, async () => ({ ok: false, status: 502 }));
  assert.equal(r.via, 'workers-ai'); assert.deepEqual(r.raw, spec);
});
test('gateway error with no Workers AI surfaces', async () => {
  await assert.rejects(runModel({ EWS_LLM_URL: 'https://gw.test', EWS_LLM_KEY: 'k' }, [], 0.9, async () => ({ ok: false, status: 401 })));
});
test('no gateway config uses Workers AI', async () => {
  const r = await runModel({ AI: { run: async () => ({ response: JSON.stringify(spec) }) } }, [], 0.9);
  assert.equal(r.via, 'workers-ai');
});
test('customers never see markup wording', async () => {
  const fs = await import('node:fs'); const s = fs.readFileSync(new URL('../site/build/builder.js', import.meta.url), 'utf8');
  assert.ok(!/Registrar cost|\+ \$2\/yr|markup/i.test(s)); assert.ok(s.includes('From $13/yr'));
  for (const p of ['$349 one-time + $19/mo', '$699 one-time + $39/mo', '$1,299 one-time + $69/mo']) assert.ok(s.includes(p));
});
test('no client names in builder or tests', async () => {
  const fs = await import('node:fs');
  for (const f of ['../site/build/builder.js', '../site/build/index.html', '../tests/e2e_build.py']) assert.ok(!/marlon|cap bar/i.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8')), f);
});
