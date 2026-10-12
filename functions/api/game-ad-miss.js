// POST /api/game-ad-miss — Unity Ads miss beacon from mobile games (JSON body).
// Emails annaews@agentmail.to with subject "[unity-ad-miss] ..." so CT111 inbox_watch opens a store card.
// Secrets: AGENTMAIL_SEND_KEY. Never grants a free continue; this is reporting only.
const INBOX = 'annaews@agentmail.to';
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) body = await request.json();
    else if (ct.includes('text/plain')) body = JSON.parse(await request.text());
    else {
      const t = await request.text();
      try { body = JSON.parse(t); } catch { body = { raw: t.slice(0, 500) }; }
    }
  } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const reason = clean(body.reason, 300) || 'unknown';
  const game = clean(body.game, 120) || 'unknown-game';
  const pkg = clean(body.package || body.pkg, 120);
  const id = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + crypto.randomUUID().slice(0, 6);
  const text = [
    `UNITY AD MISS ${id}`,
    'A mobile game hit a rewarded/interstitial miss. Free continue was NOT granted.',
    '',
    `Game: ${game}`,
    `Package: ${pkg || '-'}`,
    `Reason: ${reason}`,
    `At: ${body.at || new Date().toISOString()}`,
    `IP/country: ${request.headers.get('CF-Connecting-IP') || '?'} / ${request.cf?.country || '?'}`,
    '',
    'Fix checklist: unity_ads.py verify-placements <gameId>; ensure Interstitial_Android + Rewarded_Android are active.',
  ].join('\n');

  if (!env.AGENTMAIL_SEND_KEY) return Response.json({ ok: false, error: 'not configured' }, { status: 503 });
  const r = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX)}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AGENTMAIL_SEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: [INBOX],
      subject: `[unity-ad-miss] ${game}: ${reason}`.slice(0, 180),
      text,
    }),
  });
  if (!r.ok) return Response.json({ ok: false, error: 'send failed' }, { status: 502 });
  return Response.json({ ok: true, id });
}

export const onRequestGet = () => Response.json({ ok: true, hint: 'POST JSON {reason, game, package}' });
