// /api/auth — magic-link sign-in for /account. POST { action, email, token }.
import { consumeLoginLink, currentCustomer, demoAuth, isEmail, requestLoginLink, cookieHeader } from '../_lib/auth.js';
import { shopFromEnv } from '../_lib/shop.js';
import { sendLoginLink } from '../_lib/email.js';
import { json, originOf, readJson } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false, error: 'Account store is not configured.' }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get('token')) {
    const r = await consumeLoginLink(shop, url.searchParams.get('token'), { secure: url.protocol === 'https:' });
    if (!r.ok) return json(r, 400);
    return json({ ok: true, email: r.customer.email }, 200, { 'Set-Cookie': r.cookie });
  }
  const customer = await currentCustomer(request, env, shop);
  return json(customer ? { ok: true, email: customer.email, plan: customer.plan, status: customer.status } : { ok: false });
}

export async function onRequestPost({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false, error: 'Account store is not configured.' }, 503);
  const body = await readJson(request) || {};
  const action = body.action || 'request-link';
  const secure = new URL(request.url).protocol === 'https:';

  if (action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', { clear: true }) });
  }
  if (action === 'verify') {
    const r = await consumeLoginLink(shop, body.token, { secure });
    return r.ok ? json({ ok: true, email: r.customer.email }, 200, { 'Set-Cookie': r.cookie }) : json(r, 400);
  }
  if (action === 'request-link') {
    if (!isEmail(body.email)) return json({ ok: false, error: 'Enter a valid email address.' }, 400);
    env.PUBLIC_ORIGIN = env.PUBLIC_ORIGIN || originOf(request, env);
    const r = await requestLoginLink(shop, body.email, env);
    if (!r.ok) return json(r, 400);
    if (demoAuth(env)) return json({ ok: true, demoLink: '/account/?token=' + r.token });
    const mailed = await sendLoginLink(env, r.email, r.link);
    if (!mailed.ok && !mailed.skipped) return json({ ok: false, error: 'Could not send the link.' }, 502);
    return json({ ok: true });
  }
  return json({ ok: false, error: 'Unknown action.' }, 400);
}
