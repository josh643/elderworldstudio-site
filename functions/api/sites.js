// GET /api/sites — list. POST /api/sites — create or save draft for the signed-in customer.
import { currentCustomer } from '../_lib/auth.js';
import { canEdit } from '../_lib/plans.js';
import { newSite, shopFromEnv } from '../_lib/shop.js';
import { json, readJson } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false }, 503);
  const customer = await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  const sites = await shop.listSites(customer.id);
  return json({ ok: true, sites });
}

export async function onRequestPost({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false }, 503);
  const customer = await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false, error: 'Sign in first.' }, 401);
  if (!canEdit(customer)) return json({ ok: false, error: 'No active website plan yet.' }, 403);
  const body = await readJson(request) || {};
  const existing = body.id ? await shop.findSite(body.id) : (await shop.listSites(customer.id))[0];
  if (existing && existing.customer_id !== customer.id) return json({ ok: false }, 403);
  const site = existing || newSite({ customer_id: customer.id, name: body.name || customer.name || 'My website', plan: customer.plan });
  if (body.name) site.name = String(body.name).slice(0, 150);
  if (body.draft) site.draft = typeof body.draft === 'string' ? body.draft : JSON.stringify(body.draft);
  if (body.spec) site.spec = typeof body.spec === 'string' ? body.spec : JSON.stringify(body.spec);
  site.plan = customer.plan || site.plan;
  site.updated = new Date().toISOString();
  await shop.upsertSite(site);
  return json({ ok: true, site: { id: site.id, name: site.name, plan: site.plan, status: site.status, slug: site.slug } });
}
