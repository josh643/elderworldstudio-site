import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forwardLeadToCallCenter,
  leadForwardConfigured,
  leadForwardPayload,
  normalizeE164,
  onRequestPost,
} from './lead.js';

const MAIL = 'https://api.agentmail.to/v0/inboxes/annaews%40agentmail.to/messages/send';
const LEADS = 'https://voice.example.test/voice/leads';

afterEach(() => {
  mock.restoreAll();
});

function form(fields = {}) {
  const f = new FormData();
  const data = {
    name: 'Dana',
    email: 'dana@example.com',
    phone: '(901) 555-0188',
    business: 'Dana Co',
    type: 'Website',
    description: 'Need a small-business site',
    t: String(Date.now() - 5000),
    ...fields,
  };
  for (const [k, v] of Object.entries(data)) {
    if (v != null) f.set(k, String(v));
  }
  return f;
}

function post(fields, headers = {}) {
  return new Request('https://elderworldstudio.com/api/lead', {
    method: 'POST',
    headers: { accept: 'application/json', ...headers },
    body: form(fields),
  });
}

function mockFetch(handler) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    const rec = { url: String(url), opts };
    calls.push(rec);
    return handler(rec);
  });
  return calls;
}

test('normalizeE164 maps US numbers and drops junk', () => {
  assert.equal(normalizeE164('(901) 555-0188'), '+19015550188');
  assert.equal(normalizeE164('901.555.0188'), '+19015550188');
  assert.equal(normalizeE164('19015550188'), '+19015550188');
  assert.equal(normalizeE164('+447911123456'), '+447911123456');
  assert.equal(normalizeE164(''), '');
  assert.equal(normalizeE164('anonymous'), '');
  assert.equal(normalizeE164('0000000000'), '');
});

test('leadForwardConfigured requires both env vars', () => {
  assert.equal(leadForwardConfigured({}), false);
  assert.equal(leadForwardConfigured({ EWS_LEADS_URL: LEADS }), false);
  assert.equal(leadForwardConfigured({ EWS_LEADS_SECRET: 'test-secret' }), false);
  assert.equal(leadForwardConfigured({ EWS_LEADS_URL: LEADS, EWS_LEADS_SECRET: 'test-secret' }), true);
});

test('leadForwardPayload is E.164 + message + timestamp', () => {
  const now = new Date('2026-10-30T16:00:00.000Z');
  const body = leadForwardPayload({
    name: 'Dana',
    phone: '901-555-0188',
    email: 'dana@example.com',
    description: 'Need a site',
    business: 'Dana Co',
    type: 'Website',
  }, now);
  assert.equal(body.phone, '+19015550188');
  assert.equal(body.name, 'Dana');
  assert.equal(body.email, 'dana@example.com');
  assert.equal(body.message, 'Need a site');
  assert.equal(body.timestamp, '2026-10-30T16:00:00.000Z');
  assert.equal(body.description, 'Need a site');
  assert.equal(body.submitted_at, body.timestamp);
  assert.equal(body.source, 'services');
});

test('success: after email, waitUntil POSTs the lead and does not delay the reply', { timeout: 3000 }, async () => {
  let releaseLead;
  const leadGate = new Promise((resolve) => { releaseLead = resolve; });
  const calls = mockFetch(async ({ url }) => {
    if (url.includes('agentmail.to')) return new Response('{}', { status: 200 });
    if (url.startsWith(LEADS)) {
      await leadGate;
      return new Response(JSON.stringify({ ok: true, stored: true }), { status: 200 });
    }
    return new Response('no', { status: 404 });
  });
  const pending = [];
  const res = await onRequestPost({
    request: post(),
    env: {
      AGENTMAIL_SEND_KEY: 'test-mail-key',
      EWS_LEADS_URL: LEADS,
      EWS_LEADS_SECRET: 'test-leads-secret',
    },
    waitUntil: (p) => pending.push(p),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, error: null });
  assert.equal(calls.filter((c) => c.url.includes('agentmail.to')).length, 1);
  assert.equal(pending.length, 1, 'forward is scheduled on waitUntil, not awaited');
  releaseLead();
  await pending[0];
  const lead = calls.find((c) => c.url.startsWith(LEADS));
  assert.ok(lead);
  assert.equal(lead.opts.method, 'POST');
  assert.equal(lead.opts.headers['X-EWS-Leads-Secret'], 'test-leads-secret');
  assert.equal(lead.opts.headers['content-type'], 'application/json');
  const body = JSON.parse(lead.opts.body);
  assert.equal(body.name, 'Dana');
  assert.equal(body.phone, '+19015550188');
  assert.equal(body.email, 'dana@example.com');
  assert.equal(body.message, 'Need a small-business site');
  assert.ok(body.timestamp);
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('no-op: unset env vars skip the POST and still email', async () => {
  const calls = mockFetch(async ({ url }) => {
    if (url.includes('agentmail.to')) return new Response('{}', { status: 200 });
    return new Response('no', { status: 500 });
  });
  const pending = [];
  const res = await onRequestPost({
    request: post(),
    env: { AGENTMAIL_SEND_KEY: 'test-mail-key' },
    waitUntil: (p) => pending.push(p),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, error: null });
  assert.equal(pending.length, 0);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('agentmail.to'));
});

test('no-op: only one of the two env vars is unset', async () => {
  const skipped = await forwardLeadToCallCenter({ EWS_LEADS_URL: LEADS }, { name: 'Dana' });
  assert.deepEqual(skipped, { ok: false, skipped: true, why: 'unset' });
  const skippedSecret = await forwardLeadToCallCenter({ EWS_LEADS_SECRET: 'test-leads-secret' }, { name: 'Dana' });
  assert.deepEqual(skippedSecret, { ok: false, skipped: true, why: 'unset' });
});

test('failure: leads POST throws and the email reply still succeeds', async () => {
  const calls = mockFetch(async ({ url }) => {
    if (url.includes('agentmail.to')) return new Response('{}', { status: 200 });
    throw new Error('voice down');
  });
  const pending = [];
  const res = await onRequestPost({
    request: post(),
    env: {
      AGENTMAIL_SEND_KEY: 'test-mail-key',
      EWS_LEADS_URL: LEADS,
      EWS_LEADS_SECRET: 'test-leads-secret',
    },
    waitUntil: (p) => pending.push(p),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, error: null });
  await pending[0];
  assert.equal(calls.filter((c) => c.url.includes('agentmail.to')).length, 1);
  assert.equal(calls.filter((c) => c.url.startsWith(LEADS)).length, 1);
});

test('failure: leads HTTP 500 does not change the email reply', async () => {
  mockFetch(async ({ url }) => {
    if (url.includes('agentmail.to')) return new Response('{}', { status: 200 });
    return new Response('no', { status: 500 });
  });
  const pending = [];
  const res = await onRequestPost({
    request: post(),
    env: {
      AGENTMAIL_SEND_KEY: 'test-mail-key',
      EWS_LEADS_URL: LEADS,
      EWS_LEADS_SECRET: 'test-leads-secret',
    },
    waitUntil: (p) => pending.push(p),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, error: null });
  await pending[0];
});

test('failure: hung leads fetch is aborted and the email reply still succeeds', { timeout: 4000 }, async () => {
  mockFetch(async ({ url, opts }) => {
    if (url.includes('agentmail.to')) return new Response('{}', { status: 200 });
    await new Promise((_, reject) => {
      if (opts.signal) opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  });
  const pending = [];
  const t0 = Date.now();
  const res = await onRequestPost({
    request: post(),
    env: {
      AGENTMAIL_SEND_KEY: 'test-mail-key',
      EWS_LEADS_URL: LEADS,
      EWS_LEADS_SECRET: 'test-leads-secret',
    },
    waitUntil: (p) => pending.push(p),
  });
  assert.ok(Date.now() - t0 < 500, 'response must not wait for the leads timeout');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, error: null });
  await pending[0];
});

test('direct forward helper reports network failure', async () => {
  const rec = await forwardLeadToCallCenter(
    { EWS_LEADS_URL: LEADS, EWS_LEADS_SECRET: 'test-leads-secret' },
    { name: 'Dana', phone: '9015550188', email: 'dana@example.com', description: 'x' },
    async () => { throw new Error('boom'); },
  );
  assert.deepEqual(rec, { ok: false, why: 'network' });
});
