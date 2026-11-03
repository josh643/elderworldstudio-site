#!/usr/bin/env node
// Local shop harness for Playwright: static site/ + the same Functions handlers + a fake Stripe pay page.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryShop } from '../functions/_lib/shop.js';
import { handleStripeEvent } from '../functions/_lib/stripe.js';
import { onRequestGet as shopConfigGet } from '../functions/api/shop-config.js';
import { onRequestGet as authGet, onRequestPost as authPost } from '../functions/api/auth.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestPost as webhookPost } from '../functions/api/stripe-webhook.js';
import { onRequestPost as portalPost } from '../functions/api/portal.js';
import { onRequestGet as meGet } from '../functions/api/me.js';
import { onRequestGet as sitesGet, onRequestPost as sitesPost } from '../functions/api/sites.js';
import { onRequestGet as siteGet, onRequestPost as sitePost } from '../functions/api/sites/[id].js';
import { onRequestGet as previewGet } from '../functions/api/sites/[id]/preview.js';
import { onRequestPost as publishPost } from '../functions/api/sites/[id]/publish.js';
import { onRequestGet as downloadGet } from '../functions/api/sites/[id]/download.js';
import { onRequestGet as publishedGet } from '../functions/s/[slug].js';
import { onRequestPost as leadPost } from '../functions/api/lead.js';
import { onRequestPost as buildAiPost } from '../functions/api/build-ai.js';

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('agentmail.to')) return new Response('{}', { status: 200 });
  if (u.includes('challenges.cloudflare.com')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  return realFetch(url, opts);
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const PORT = Number(process.env.E2E_PORT || 8877);
const HOST = process.env.E2E_HOST || '127.0.0.1';
const shop = createMemoryShop();
const mail = [];
const env = {
  SHOP: shop,
  EWS_LIVE_PAYMENTS: '1',
  EWS_STRIPE_MOCK: '1',
  EWS_AUTH_DEMO: '1',
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: '',
  STRIPE_PRICE_STARTER_SETUP: 'price_test_starter_setup',
  STRIPE_PRICE_STARTER_MONTHLY: 'price_test_starter_mo',
  STRIPE_PRICE_BUSINESS_SETUP: 'price_test_business_setup',
  STRIPE_PRICE_BUSINESS_MONTHLY: 'price_test_business_mo',
  STRIPE_PRICE_PLUS_SETUP: 'price_test_plus_setup',
  STRIPE_PRICE_PLUS_MONTHLY: 'price_test_plus_mo',
  STRIPE_PRICE_TAKE_IT: 'price_test_take_it',
  PUBLIC_ORIGIN: `http://${HOST}:${PORT}`,
  AGENTMAIL_SEND_KEY: '',
  E2E_TOKEN: 'e2e-shop',
  _mail: mail,
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

function toReq(req, body) {
  const url = `http://${HOST}:${PORT}${req.url}`;
  const headers = new Headers(req.headers);
  return new Request(url, { method: req.method, headers, body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined });
}

async function send(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = headers[k] ? headers[k] + ', ' + v : v; });
  res.writeHead(response.status, headers);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

function payPage(sid, plan, email) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Test pay</title></head><body>
  <h1>Test card</h1><p>Plan ${plan}</p>
  <form id="pay" method="post" action="/__pay/${sid}">
    <input name="email" value="${email || 'buyer@example.com'}">
    <input name="card" id="card" value="4242424242424242">
    <input name="plan" value="${plan}">
    <button type="submit">Pay</button>
  </form></body></html>`;
}

function portalPage(customer) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Test portal</title></head><body>
  <h1>Customer portal</h1>
  <form method="post" action="/__pay/portal"><input type="hidden" name="customer" value="${customer}">
  <button type="submit" id="cancel">Cancel plan</button></form></body></html>`;
}

const routes = [
  ['GET', /^\/api\/shop-config\/?$/, () => shopConfigGet({ env })],
  ['GET', /^\/api\/auth\/?$/, (ctx) => authGet(ctx)],
  ['POST', /^\/api\/auth\/?$/, (ctx) => authPost(ctx)],
  ['POST', /^\/api\/checkout\/?$/, (ctx) => checkoutPost(ctx)],
  ['POST', /^\/api\/stripe-webhook\/?$/, (ctx) => webhookPost(ctx)],
  ['POST', /^\/api\/portal\/?$/, (ctx) => portalPost(ctx)],
  ['GET', /^\/api\/me\/?$/, (ctx) => meGet(ctx)],
  ['GET', /^\/api\/sites\/?$/, (ctx) => sitesGet(ctx)],
  ['POST', /^\/api\/sites\/?$/, (ctx) => sitesPost(ctx)],
  ['GET', /^\/api\/sites\/([^/]+)\/preview\/?$/, (ctx, m) => previewGet({ ...ctx, params: { id: m[1] } })],
  ['POST', /^\/api\/sites\/([^/]+)\/publish\/?$/, (ctx, m) => publishPost({ ...ctx, params: { id: m[1] } })],
  ['GET', /^\/api\/sites\/([^/]+)\/download\/?$/, (ctx, m) => downloadGet({ ...ctx, params: { id: m[1] } })],
  ['GET', /^\/api\/sites\/([^/]+)\/?$/, (ctx, m) => siteGet({ ...ctx, params: { id: m[1] } })],
  ['POST', /^\/api\/sites\/([^/]+)\/?$/, (ctx, m) => sitePost({ ...ctx, params: { id: m[1] } })],
  ['GET', /^\/s\/([^/]+)\/?$/, (ctx, m) => publishedGet({ ...ctx, params: { slug: m[1] } })],
  ['POST', /^\/api\/lead\/?$/, (ctx) => leadPost({ ...ctx, env: { ...env, AGENTMAIL_SEND_KEY: 'test-mail-key' } })],
  ['POST', /^\/api\/build-ai\/?$/, (ctx) => buildAiPost(ctx)],
];

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname.startsWith('/__pay/portal')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(portalPage(url.searchParams.get('customer') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/__pay/portal') {
    const body = new URLSearchParams(raw.toString());
    const cus = body.get('customer');
    await handleStripeEvent(env, {
      id: 'evt_cancel_' + Date.now(),
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_test', customer: cus, status: 'canceled' } },
    }, { shop, mailer: false });
    res.writeHead(303, { Location: '/account/#/billing' });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname.startsWith('/__pay/')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(payPage(url.pathname.slice(7), url.searchParams.get('plan') || 'starter', url.searchParams.get('email') || ''));
  }
  if (req.method === 'POST' && url.pathname.startsWith('/__pay/')) {
    const sid = url.pathname.slice(7);
    const body = new URLSearchParams(raw.toString());
    const email = body.get('email') || 'buyer@example.com';
    const plan = body.get('plan') || 'starter';
    if (!/^4242/.test(body.get('card') || '')) {
      res.writeHead(400, { 'content-type': 'text/plain' });
      return res.end('Use the test card 4242…');
    }
    await handleStripeEvent(env, {
      id: 'evt_' + sid,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mock_' + sid.replace(/^cs_test_mock_/, ''),
          payment_status: 'paid',
          customer: 'cus_test_' + email.replace(/[^a-z0-9]/g, ''),
          customer_email: email,
          customer_details: { email, name: 'Test Buyer' },
          metadata: { plan },
          amount_total: plan === 'take_it' ? 9900 : 0,
          invoice: 'in_test_' + sid.slice(-6),
        },
      },
    }, { shop, mailer: false });
    res.writeHead(303, { Location: `/account/?paid=1&plan=${plan}#/sites` });
    return res.end();
  }

  const request = toReq(req, raw.length ? raw : undefined);
  const ctx = { request, env };
  for (const [method, re, fn] of routes) {
    if (req.method !== method) continue;
    const m = url.pathname.match(re);
    if (!m) continue;
    try { return await send(res, await fn(ctx, m)); }
    catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  }

  let file = path.join(SITE, decodeURIComponent(url.pathname));
  if (file.endsWith('/')) file = path.join(file, 'index.html');
  if (!path.extname(file) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !file.startsWith(SITE)) {
    res.writeHead(404); return res.end('not found');
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`e2e shop server http://${HOST}:${PORT}`);
});
