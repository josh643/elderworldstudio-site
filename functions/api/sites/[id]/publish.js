import { currentCustomer } from '../../../_lib/auth.js';
import { canPublish } from '../../../_lib/plans.js';
import { shopFromEnv } from '../../../_lib/shop.js';
import { renderPage } from '../../../_lib/render.js';
import { json } from '../../../_lib/http.js';

export async function onRequestPost({ request, env, params }) {
  const shop = await shopFromEnv(env);
  const customer = shop && await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  if (!canPublish(customer)) return json({ ok: false, error: 'Publishing needs an active monthly plan.' }, 403);
  const site = await shop.findSite(params.id);
  if (!site || site.customer_id !== customer.id) return json({ ok: false }, 404);
  site.status = 'live';
  site.published_html = renderPage(site, 'Home');
  site.updated = new Date().toISOString();
  await shop.upsertSite(site);
  return json({ ok: true, url: `/s/${site.slug}`, slug: site.slug });
}
