// Every /office/b1/* asset (room module, textures, data) is served ONLY to allowlisted IPs (functions/api/office/_b1.js). Others: 403 + log.
import { allowed, logDenied, denied } from '../../api/office/_b1.js';
export async function onRequest(ctx) {
  const a = await allowed(ctx.request, ctx.env);
  if (!a.ok) { await logDenied(ctx.env, ctx.request, new URL(ctx.request.url).pathname); return denied(false); }
  const r = await ctx.next(); const h = new Headers(r.headers); h.set('cache-control', 'private, no-store'); h.set('x-robots-tag', 'noindex');
  return new Response(r.body, { status: r.status, headers: h });
}
