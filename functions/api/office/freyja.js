import { enqueueTTS } from './_util.js';
import { json, doLimit, visitor } from './_util.js';
import site from '../../../site/office/data/site.json';
import { filterChatText } from '../../../site/office/data/chat-safety.js';
// POST /api/office/freyja {messages:[{role,content}]} -> {reply, action?:{tour?, lead?}}
// Freyja, the receptionist at Fólkvangr. gpt-4o-mini, max 220 output tokens, 30 msgs/IP/day,
// hard daily cost cap (OFFICE_FREYJA_CAP_USD, default $0.50) tracked in KV; over the cap or with no
// OPENAI_API_KEY she falls back to canned FAQ answers ($0). She never sends email; leads go through the form.
const TOURS = ['lobby', 'games', 'services', 'merch', 'teams', 'datacenter', 'devlog'];
const facts = () => [
  `Studio: ${site.brand.name} (Memphis, TN). Tagline: ${site.brand.tagline}. ${site.brand.about}`,
  'The studio is run day to day by AI agents with Norse names (Odin is the Sub-CEO), overseen by the founder. Visitors can watch them work in the Team Halls.',
  'Games: ' + site.games.map(g => `${g.title} [${g.tag}]` + (g.buttons[0] ? ` link: ${g.buttons[0].href.split('?')[0]}` : '')).join('; '),
  'Services: ' + site.services.map(s => `${s.title}: ${s.text}`).join(' | '),
  'Merch: ' + site.merch.map(m => `${m.title} ${m.price} (${m.tag})`).join('; ') + '. Page: /merch/',
  'What EWS does for businesses: (1) Websites for local businesses, built and hosted for you. (2) Elder POS: point-of-sale registers and self-order kiosks; the only per-sale cost is a $1 application fee per sale (always call it an application fee). (3) AI call center: AI phone agents that answer calls, take bookings and messages 24/7. (4) ElderAI: AI chat assistants and agents for a business website or social pages. (5) Custom software and 3D assets. Games: Star Wayfarer, Omnivael and casual titles.',
  'Example for a barber shop: online booking website, AI phone agent that books appointments after hours, a POS register or check-in kiosk, and an ElderAI chat assistant answering questions and reminders. Next step is always Book a demo (collects name, email, business).',
  'Never offer anything free, no free trials or free periods. Do not quote any price except the $1 application fee. Make no promises about results or dates.',
  `Devlogs: ${site.devlog.href}. Contact page: /contact/. Services and demo requests: /services/.`,
].join('\n');
const SYSTEM = () => `You are Freyja, the friendly receptionist of Elder World Studio's 3D office (your hall is Fólkvangr). Greet visitors, explain the studio, give tours, answer FAQs from the FACTS only, point game fans to Steam/Google Play links, and help businesses request a free demo.
Rules: Keep replies under 70 words, warm and plain. Never invent prices, dates, clients, or features not in FACTS; say you'll pass the question to the team instead. Never discuss internal systems, money, clients, code, servers' details, or secrets. Never collect payment info or passwords. You cannot send emails. If a visitor wants a website/AI tool/demo or to hire us, set lead=true so the demo form opens. If they want to see something, set tour to one of: ${TOURS.join(', ')}.
Respond as JSON: {"reply": string, "tour": string|null, "lead": boolean}
FACTS:
${facts()}`;
function faq(q) {
  q = q.toLowerCase();
  if (/demo|website|hire|quote|price|cost|business|shop|store|salon|barber|restaurant|future|phone|call|chat ?bot|assistant|kiosk|pos|help me|what can you/.test(q)) return { reply: 'For a business like yours we build: a booking website, an AI phone agent that answers calls and books appointments 24/7, Elder POS registers and check-in kiosks, and an ElderAI chat assistant for your site. Book a demo and we\u2019ll show you it working for your business. I\u2019ll open the request form.', action: { lead: true, tour: 'services' } };
  if (/game|steam|play|download|omnivael|wayfarer|chronicles|astro/.test(q)) return { reply: 'Our games are in the showrooms to the west: Star Wayfarer and Astro Dodge are on Google Play, and Omnivael and Chronicles of the Realm are coming to Steam. Tap a showroom to get the store link!', action: { tour: 'games' } };
  if (/merch|shirt|tee|hoodie|mug|sticker/.test(q)) return { reply: 'The merch display is just east of the lobby. Tap any item for details.', action: { tour: 'merch' } };
  if (/agent|team|odin|who works|ai/.test(q)) return { reply: 'Our studio is run day to day by AI agents with Norse names, led by Odin, our Sub-CEO. Head north to the Team Halls to watch them work.', action: { tour: 'teams' } };
  if (/video|youtube|devlog/.test(q)) return { reply: 'Our devlogs are on YouTube. The big screen on the east wall opens the channel.', action: { tour: 'devlog' } };
  return { reply: 'I can show you our games, our services for businesses, the merch display, or the team halls. What would you like to see?', action: null };
}
async function inner({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: filterChatText(String(m.content || '').slice(0, 500)) }));
  const last = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
  if (!last) return json({ error: 'empty' }, 400);
  const playerId = /^[A-Za-z0-9_-]{8,64}$/.test(String(b.playerId || '')) ? String(b.playerId) : '';
  if (playerId && env.OFFICE_RL) {
    const doid = env.OFFICE_RL.idFromName('world:' + (env.OFFICE_MODE || 'prod'));
    const check = await env.OFFICE_RL.get(doid).fetch('https://rl/world/chat/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player: playerId, target: 'receptionist' }) });
    if ((await check.json().catch(() => ({}))).blocked) return json({ error: 'chat unavailable' }, 403);
  }
  const ip = visitor(request);
  const lim = await doLimit(env, 'ip:' + ip, [['min', 6, 60000], ['day', 30, 864e5]]);
  if (!lim.ok) return json({ reply: 'I\u2019m getting a lot of questions! Give me a minute. Meanwhile the tour buttons below still work, or request a demo with the form.', action: { lead: false }, limited: true, retryMs: lim.retryMs }, 429);
  /* answer cache: first-turn questions are normalised and cached at the edge for 6 h (no per-visitor data in the key) */
  const ES = b.lang === 'es';
  const norm = (ES ? 'es:' : '') + last.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(), firstTurn = msgs.filter(m => m.role === 'user').length === 1;
  const ckey = firstTurn && norm.length < 160 ? new Request('https://cache.ews/freyja/' + encodeURIComponent(norm)) : null, cache = globalThis.caches?.default;
  if (ckey && cache) { const hit = await cache.match(ckey); if (hit) { const j = await hit.json(); return json({ ...j, cached: true, remaining: lim.remaining }); } }
  const put = (o) => { if (ckey && cache && o.mode === 'llm') cache.put(ckey, new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=21600' } })).catch(() => {}); return json(o); };
  const cap = Math.round(Number(env.OFFICE_FREYJA_CAP_USD || 0.5) * 1e6);
  const spent = env.OPENAI_API_KEY ? (await doLimit(env, 'global-budget', [])).spent : cap;   // daily $ budget, one global DO
  if (!env.OPENAI_API_KEY || spent >= cap) { const f = faq(last); return json({ ...f, mode: 'faq', remaining: lim.remaining }); }
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 220, temperature: 0.5, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM() + (ES ? '\nThe visitor chose Spanish: write "reply" in natural Latin American Spanish (keep product names and the term \'application fee\' explained as \'tarifa de aplicación\').' : '') }, ...msgs] }) });
    const j = await r.json(); if (!r.ok) throw new Error('upstream');
    const u = j.usage || {}; const micro = Math.ceil((u.prompt_tokens || 0) * 0.15 + (u.completion_tokens || 0) * 0.6);
    await doLimit(env, 'global-budget', [], micro);
    let o = {}; try { o = JSON.parse(j.choices[0].message.content); } catch {}
    const reply = filterChatText(String(o.reply || '').slice(0, 600)) || faq(last).reply;
    return put({ reply, action: { tour: TOURS.includes(o.tour) ? o.tour : null, lead: !!o.lead }, mode: 'llm' });
  } catch { const f = faq(last); return json({ ...f, mode: 'faq' }); }
}

// Wrap: every reply gets a Piper audio id; CT111 renders it (no device TTS). Client polls /api/office/tts?h=<id>.
export async function onRequestPost(c) {
  let lang = 'en'; try { lang = (await c.request.clone().json()).lang === 'es' ? 'es' : 'en'; } catch {}
  const r = await inner(c); let o; try { o = await r.clone().json(); } catch { return r; }
  if (!o.reply) return r;
  const id = await enqueueTTS(c.env, o.reply, lang === 'es' ? 'receptionist@es' : 'receptionist').catch(() => null);
  if (id) { o.tts = id.replace('!', ''); o.ttsReady = id.endsWith('!'); }
  return new Response(JSON.stringify(o), { status: r.status, headers: r.headers });
}
