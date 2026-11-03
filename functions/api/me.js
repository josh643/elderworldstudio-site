// GET /api/me — current customer + sites + invoices for the account UI.
import { currentCustomer } from '../_lib/auth.js';
import { canDownload, canEdit, canPublish, PLANS } from '../_lib/plans.js';
import { shopFromEnv } from '../_lib/shop.js';
import { json } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false, error: 'Store is not configured.' }, 503);
  const customer = await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  const [sites, invoices] = await Promise.all([shop.listSites(customer.id), shop.listInvoices(customer.id)]);
  return json({
    ok: true,
    email: customer.email,
    name: customer.name,
    plan: customer.plan,
    planName: customer.plan ? PLANS[customer.plan]?.name : null,
    status: customer.status,
    canDownload: canDownload(customer),
    canEdit: canEdit(customer),
    canPublish: canPublish(customer),
    sites: sites.map(publicSite),
    invoices,
  });
}

function publicSite(s) {
  return {
    id: s.id, name: s.name, plan: s.plan, status: s.status, slug: s.slug,
    preview: `/api/sites/${s.id}/preview`,
    published: s.status === 'live' ? `/s/${s.slug}` : null,
    updated: s.updated,
  };
}
