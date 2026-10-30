// node --test tests/unit  — unit tests for functions/api/lead.js routing of web-builder leads
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/api/lead.js';

function req(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('https://x/api/lead', { method: 'POST', body: fd });
}
const base = { name: 'A', email: 'a@b.co', business: 'Shop', description: 'hi' };
async function run(fields) {
  const sent = [];
  globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response('{}', { status: 200 }); };
  const r = await onRequestPost({ request: req(fields), env: { AGENTMAIL_SEND_KEY: 'k' } });
  return { r, sent };
}
test('web-builder type is kept and redirects back to /build/', async () => {
  const { r, sent } = await run({ ...base, type: 'web-builder', return_to: '/build/' });
  assert.equal(r.headers.get('Location'), '/build/?sent=1#reserve');
  assert.match(sent[0].subject, /web-builder: Shop/);
  assert.match(sent[0].text, /elderworldstudio\.com\/build\/ form/);
});
test('unknown return_to falls back to /services/', async () => {
  const { r } = await run({ ...base, type: 'Website', return_to: 'https://evil.example/' });
  assert.equal(r.headers.get('Location'), '/services/?sent=1#request');
});
test('services form default unchanged', async () => {
  const { r, sent } = await run({ ...base, type: 'Website', budget: '$500 – $1,500' });
  assert.equal(r.headers.get('Location'), '/services/?sent=1#request');
  assert.match(sent[0].text, /Budget: \$500 – \$1,500/);
});
test('unknown type becomes Not sure', async () => {
  const { sent } = await run({ ...base, type: 'hack' });
  assert.match(sent[0].subject, /Not sure: Shop/);
});
