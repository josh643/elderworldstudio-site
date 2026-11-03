import { shopFromEnv } from '../_lib/shop.js';
import { renderPage } from '../_lib/render.js';

export async function onRequestGet({ env, params }) {
  const shop = await shopFromEnv(env);
  if (!shop) return new Response('Not found', { status: 404 });
  const site = await shop.findSiteBySlug(params.slug);
  if (!site || site.status !== 'live') return new Response('Not found', { status: 404 });
  const html = site.published_html || renderPage(site, 'Home');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
