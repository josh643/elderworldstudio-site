export const json = (o, s = 200, extra = {}) => Response.json(o, {
  status: s,
  headers: { 'Cache-Control': 'no-store', ...extra },
});

export function originOf(request, env) {
  const fromEnv = String(env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  try { return new URL(request.url).origin; } catch { return 'https://elderworldstudio.com'; }
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export function e2eBypass(request, env) {
  return Boolean(env.E2E_TOKEN && request.headers.get('x-ews-e2e') === env.E2E_TOKEN);
}
