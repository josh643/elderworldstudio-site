// Digital demo kiosk on Freyja's desk: pick a business type, name, colours and needs, get an instant branded sample
// (website homepage, order kiosk or POS screen) built client-side from templates (no AI, no cost). "Send to client team"
// posts to the same lead endpoint as the demo form. No prices, no free offers.
const TYPES = { barber: ['Barber / salon', ['Haircut', 'Beard trim', 'Fade', 'Kids cut', 'Hot towel shave', 'Line up']], food: ['Restaurant / cafe', ['Burger', 'Wings', 'Fries', 'Salad', 'Lemonade', 'Coffee']],
  retail: ['Retail shop', ['T-shirt', 'Hoodie', 'Cap', 'Mug', 'Sticker pack', 'Gift card']], auto: ['Auto service', ['Oil change', 'Tire rotation', 'Brake check', 'Detail', 'Diagnostics', 'Wash']], other: ['Other business', ['Service A', 'Service B', 'Service C', 'Consultation', 'Package', 'Add-on']] };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function sample(kind, o) {
  const [label, items] = TYPES[o.type] || TYPES.other, n = esc(o.name || 'Your Business'), a = o.c1, b = o.c2;
  const base = `*{box-sizing:border-box;margin:0;font-family:system-ui,sans-serif}body{background:#f6f4ef;color:#1b1b1b}.btn{background:${a};color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700}`;
  if (kind === 'site') return `<style>${base}header{background:${a};color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center}nav a{color:#fff;margin-left:14px;font-size:14px}
    .hero{padding:48px 24px;background:linear-gradient(120deg,${a},${b});color:#fff}.hero h1{font-size:34px;margin-bottom:10px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:24px}.card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px #0001}</style>
    <header><b>${n}</b><nav><a>Services</a><a>Book</a><a>Contact</a></nav></header><div class="hero"><h1>${n}</h1><p>${esc(label)} · book online in seconds</p><br><button class="btn" style="background:#fff;color:${a}">Book now</button></div>
    <div class="grid">${items.slice(0, 6).map(i => `<div class="card"><b>${esc(i)}</b><p style="font-size:13px;opacity:.7">Book online</p></div>`).join('')}</div>`;
  if (kind === 'kiosk') return `<style>${base}body{background:${b}}.top{background:${a};color:#fff;padding:20px;text-align:center;font-size:26px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px}
    .tile{background:#fff;border-radius:16px;padding:22px 10px;text-align:center;font-weight:700;font-size:18px;box-shadow:0 3px 10px #0002}.tile i{display:block;width:44px;height:44px;border-radius:50%;margin:0 auto 10px;background:${a}}.bar{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}</style>
    <div class="top">${n} · Tap to order</div><div class="grid">${items.map(i => `<div class="tile"><i></i>${esc(i)}</div>`).join('')}</div><div class="bar"><span>Your order: 0 items</span><button class="btn">Checkout</button></div>`;
  return `<style>${base}body{display:grid;grid-template-columns:2fr 1fr;height:100vh}.l{padding:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:start}.k{background:${a};color:#fff;border-radius:10px;padding:20px 8px;text-align:center;font-weight:700}
    .r{background:#fff;border-left:4px solid ${b};padding:14px;display:flex;flex-direction:column}.r h3{margin-bottom:10px}.line{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}.r .btn{margin-top:auto}</style>
    <div class="l">${items.map(i => `<div class="k">${esc(i)}</div>`).join('')}</div><div class="r"><h3>${n} · Register</h3><div class="line"><span>${esc(items[0])}</span><span>1</span></div><div class="line"><span>${esc(items[1])}</span><span>1</span></div><button class="btn">Charge</button></div>`;
}
export function openKiosk(ctx, leadUrl) {
  const c = ctx.card(`<h3>Elder kiosk · instant sample</h3><form class="office-lead ews-kiosk"><label>Business type<select name="type">${Object.entries(TYPES).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label>Business name<input name="name" maxlength="60" placeholder="e.g. Fresh Fades"></label><label>Colours <input name="c1" type="color" value="#2f7d6a"> <input name="c2" type="color" value="#d9b45a"></label>
    <label>Show me<select name="kind"><option value="site">Website homepage</option><option value="kiosk">Order kiosk</option><option value="pos">POS screen</option></select></label>
    <iframe class="ews-sample" title="Sample preview" sandbox="" style="width:100%;height:240px;border:1px solid #444;border-radius:8px;background:#fff"></iframe>
    <details><summary>Send this to our client team</summary><label>Your name *<input name="cname" maxlength="100" autocomplete="name"></label><label>Email *<input name="email" type="email" maxlength="200" autocomplete="email"></label>
    <div class="hp" aria-hidden="true"><input name="website_url" tabindex="-1" autocomplete="off"></div><button class="ob gold" type="button" data-send>Send to client team</button><p class="msg" role="status"></p></details></form>`);
  const fm = c.querySelector('form'), fr = c.querySelector('iframe'), t0 = Date.now();
  const o = () => Object.fromEntries(new FormData(fm)), draw = () => { fr.srcdoc = sample(o().kind, o()); };
  fm.addEventListener('input', draw); draw();
  c.querySelector('[data-send]').onclick = async () => { const d = o(), m = c.querySelector('.msg'); m.textContent = 'Sending…';
    const body = { name: d.cname, email: d.email, business: d.name || 'Not given', type: d.kind === 'site' ? 'Website' : 'Custom software', website_url: d.website_url, t: t0, source: 'office-kiosk',
      description: `Instant sample from the office kiosk: ${TYPES[d.type]?.[0] || d.type}, ${d.kind} sample, colours ${d.c1} / ${d.c2}.` };
    try { const j = await (await fetch(leadUrl || '/api/office/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); m.textContent = j.ok ? 'Sent. Our client team will reply by email.' : (j.error || 'Could not send.'); }
    catch { m.textContent = 'Could not send right now.'; } };
}
