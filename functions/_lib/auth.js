import { COOKIE, SESSION_DAYS } from './plans.js';
import { newCustomer, shopFromEnv } from './shop.js';

const enc = new TextEncoder();

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isEmail(s) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(s || '').trim());
}

export function cookieHeader(token, { clear = false, secure = true } = {}) {
  if (clear) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const max = SESSION_DAYS * 86400;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${secure ? '; Secure' : ''}`;
}

export function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export async function currentCustomer(request, env, shop) {
  shop = shop || await shopFromEnv(env);
  if (!shop) return null;
  const token = readCookie(request);
  if (!token) return null;
  const sess = await shop.getSession(await sha256Hex(token));
  if (!sess) return null;
  return shop.findCustomerById(sess.customer_id);
}

export async function issueSession(shop, customerId, { secure = true } = {}) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await shop.createSession(customerId, await sha256Hex(token), expires);
  return { token, cookie: cookieHeader(token, { secure }) };
}

export async function requestLoginLink(shop, email, env) {
  email = String(email || '').trim().toLowerCase();
  if (!isEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  let customer = await shop.findCustomerByEmail(email);
  if (!customer) {
    customer = await shop.upsertCustomer(newCustomer({ email }));
  }
  const token = randomToken();
  const expires = new Date(Date.now() + 3600 * 1000).toISOString();
  await shop.createLoginToken(email, await sha256Hex(token), expires, customer.id);
  const origin = String(env.PUBLIC_ORIGIN || 'https://elderworldstudio.com').replace(/\/$/, '');
  const link = `${origin}/account/?token=${token}`;
  return { ok: true, email, customer, token, link };
}

export async function consumeLoginLink(shop, token, { secure = true } = {}) {
  if (!token) return { ok: false, error: 'Missing sign-in link.' };
  const row = await shop.consumeLoginToken(await sha256Hex(token));
  if (!row) return { ok: false, error: 'That sign-in link is invalid or expired.' };
  let customer = row.customer_id ? await shop.findCustomerById(row.customer_id) : await shop.findCustomerByEmail(row.email);
  if (!customer) customer = await shop.upsertCustomer(newCustomer({ email: row.email }));
  const sess = await issueSession(shop, customer.id, { secure });
  return { ok: true, customer, ...sess };
}

export function demoAuth(env) {
  return !env.AGENTMAIL_SEND_KEY || env.EWS_AUTH_DEMO === '1';
}
