import { currentCustomer } from '../../../_lib/auth.js';
import { canDownload } from '../../../_lib/plans.js';
import { shopFromEnv } from '../../../_lib/shop.js';
import { siteFiles } from '../../../_lib/render.js';
import { zipFiles } from '../../../_lib/zip.js';
import { json } from '../../../_lib/http.js';

export async function onRequestGet({ request, env, params }) {
  const shop = await shopFromEnv(env);
  const customer = shop && await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false }, 401);
  if (!canDownload(customer)) return json({ ok: false, error: 'Download needs a paid plan.' }, 403);
  const site = await shop.findSite(params.id);
  if (!site || site.customer_id !== customer.id) return json({ ok: false }, 404);
  const zip = zipFiles(siteFiles(site));
  const name = (site.slug || 'site') + '.zip';
  return new Response(zip, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
