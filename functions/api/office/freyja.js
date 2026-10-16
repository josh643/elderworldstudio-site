import { json, doLimit, visitor } from './_util.js';
import site from '../../../site/office/data/site.json';
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
  `Devlogs: ${site.devlog.href}. Contact page: /contact/. Services and demo requests: /services/.`,
].join('\n');
const SYSTEM = () => `You are Freyja, the friendly receptionist of Elder World Studio's 3D office (your hall is Fólkvangr). Greet visitors, explain the studio, give tours, answer FAQs from the FACTS only, point game fans to Steam/Google Play links, and help businesses request a free demo.
Rules: Keep replies under 70 words, warm and plain. Never invent prices, dates, clients, or features not in FACTS; say you'll pass the question to the team instead. Never discuss internal systems, money, clients, code, servers' details, or secrets. Never collect payment info or passwords. You cannot send emails. If a visitor wants a website/AI tool/demo or to hire us, set lead=true so the demo form opens. If they want to see something, set tour to one of: ${TOURS.join(', ')}.
Respond as JSON: {"reply": string, "tour": string|null, "lead": boolean}
FACTS:
${facts()}`;
function faq(q) {
  q = q.toLowerCase();
  if (/demo|website|hire|quote|price|cost|business|chat ?bot|assistant|kiosk|pos/.test(q)) return { reply: 'We build websites, AI chat assistants and custom tools for small businesses, and we always start with a demo. I\u2019ll open the request form for you.', action: { lead: true, tour: 'services' } };
  if (/game|steam|play|download|omnivael|wayfarer|chronicles|astro/.test(q)) return { reply: 'Our games are in the showrooms to the west: Star Wayfarer and Astro Dodge are on Google Play, and Omnivael and Chronicles of the Realm are coming to Steam. Tap a showroom to get the store link!', action: { tour: 'games' } };
  if (/merch|shirt|tee|hoodie|mug|sticker/.test(q)) return { reply: 'The merch display is just east of the lobby. Tap any item for details.', action: { tour: 'merch' } };
  if (/agent|team|odin|who works|ai/.test(q)) return { reply: 'Our studio is run day to day by AI agents with Norse names, led by Odin, our Sub-CEO. Head north to the Team Halls to watch them work.', action: { tour: 'teams' } };
  if (/video|youtube|devlog/.test(q)) return { reply: 'Our devlogs are on YouTube. The big screen on the east wall opens the channel.', action: { tour: 'devlog' } };
  return { reply: 'I can show you our games, our services for businesses, the merch display, or the team halls. What would you like to see?', action: null };
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 500) }));
  const last = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
  if (!last) return json({ error: 'empty' }, 400);
  const ip = visitor(request);
  const lim = await doLimit(env, 'ip:' + ip, [['min', 6, 60000], ['day', 30, 864e5]]);
  if (!lim.ok) return json({ reply: 'I\u2019m getting a lot of questions! Give me a minute. Meanwhile the tour buttons below still work, or request a demo with the form.', action: { lead: false }, limited: true, retryMs: lim.retryMs }, 429);
  const cap = Math.round(Number(env.OFFICE_FREYJA_CAP_USD || 0.5) * 1e6);
  const spent = env.OPENAI_API_KEY ? (await doLimit(env, 'global-budget', [])).spent : cap;   // daily $ budget, one global DO
  if (!env.OPENAI_API_KEY || spent >= cap) { const f = faq(last); return json({ ...f, mode: 'faq', remaining: lim.remaining }); }
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 220, temperature: 0.5, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM() }, ...msgs] }) });
    const j = await r.json(); if (!r.ok) throw new Error('upstream');
    const u = j.usage || {}; const micro = Math.ceil((u.prompt_tokens || 0) * 0.15 + (u.completion_tokens || 0) * 0.6);
    await doLimit(env, 'global-budget', [], micro);
    let o = {}; try { o = JSON.parse(j.choices[0].message.content); } catch {}
    const reply = String(o.reply || '').slice(0, 600) || faq(last).reply;
    return json({ reply, action: { tour: TOURS.includes(o.tour) ? o.tour : null, lead: !!o.lead }, mode: 'llm' });
  } catch { const f = faq(last); return json({ ...f, mode: 'faq' }); }
}
