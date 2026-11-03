import { currentCustomer } from '../../_lib/auth.js';
import { canEdit } from '../../_lib/plans.js';
import { shopFromEnv } from '../../_lib/shop.js';
import { json, readJson } from '../../_lib/http.js';

export async function onRequestGet({ request, env, params }) {
  const shop = await shopFromEnv(env);
  const customer = shop && await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  const site = await shop.findSite(params.id);
  if (!site || site.customer_id !== customer.id) return json({ ok: false }, 404);
  return json({ ok: true, site });
}

export async function onRequestPost({ request, env, params }) {
  const shop = await shopFromEnv(env);
  const customer = shop && await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  if (!canEdit(customer)) return json({ ok: false, error: 'No active website plan yet.' }, 403);
  const site = await shop.findSite(params.id);
  if (!site || site.customer_id !== customer.id) return json({ ok: false }, 404);
  const body = await readJson(request) || {};
  if (body.name) site.name = String(body.name).slice(0, 150);
  if (body.draft) site.draft = typeof body.draft === 'string' ? body.draft : JSON.stringify(body.draft);
  if (body.spec) site.spec = typeof body.spec === 'string' ? body.spec : JSON.stringify(body.spec);
  site.updated = new Date().toISOString();
  await shop.upsertSite(site);
  return json({ ok: true, site: { id: site.id, name: site.name, status: site.status } });
}
