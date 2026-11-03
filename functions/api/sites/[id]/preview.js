import { currentCustomer } from '../../../_lib/auth.js';
import { shopFromEnv } from '../../../_lib/shop.js';
import { renderPage } from '../../../_lib/render.js';
import { json } from '../../../_lib/http.js';

export async function onRequestGet({ request, env, params }) {
  const shop = await shopFromEnv(env);
  const customer = shop && await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  const site = await shop.findSite(params.id);
  if (!site || site.customer_id !== customer.id) return json({ ok: false }, 404);
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || 'Home';
  const html = renderPage(site, page);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
