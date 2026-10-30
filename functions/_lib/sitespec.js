// Site spec for the AI website builder: schema, sanitizer/validator, preset fallback, rate limit + daily cost cap.
// Everything the model returns passes through validateSpec() before it reaches a browser; the browser escapes again on render.
export const KINDS = ['services', 'menu', 'gallery', 'testimonials', 'about', 'map', 'booking', 'hours', 'faq', 'stats', 'story'];
export const HERO = ['split', 'center', 'full', 'minimal', 'banner'];
export const VARIANTS = ['cards', 'list', 'grid', 'strip', 'columns', 'quote', 'band'];
export const FONTS = { // id -> [Google family for headings, CSS stack]
  playfair: ['Playfair Display', '"Playfair Display", Georgia, serif'], fraunces: ['Fraunces', 'Fraunces, Georgia, serif'],
  bebas: ['Bebas Neue', '"Bebas Neue", Impact, sans-serif'], oswald: ['Oswald', 'Oswald, "Arial Narrow", sans-serif'],
  poppins: ['Poppins', 'Poppins, Arial, sans-serif'], inter: ['Inter', 'Inter, Arial, sans-serif'], lora: ['Lora', 'Lora, Georgia, serif'],
  dmserif: ['DM Serif Display', '"DM Serif Display", Georgia, serif'], archivo: ['Archivo Black', '"Archivo Black", Arial Black, sans-serif'],
  pacifico: ['Pacifico', 'Pacifico, cursive'], space: ['Space Grotesk', '"Space Grotesk", Arial, sans-serif'], nunito: ['Nunito', 'Nunito, Arial, sans-serif'],
  cormorant: ['Cormorant Garamond', '"Cormorant Garamond", Georgia, serif'], worksans: ['Work Sans', '"Work Sans", Arial, sans-serif'] };
export const SCHEMA = { type: 'object', required: ['palette', 'fonts', 'hero', 'headline', 'subhead', 'about', 'cta', 'sections', 'imagery', 'tone'], properties: {
  palette: { type: 'object', required: ['bg', 'surface', 'ink', 'accent', 'accent2'], properties: { bg: { type: 'string' }, surface: { type: 'string' }, ink: { type: 'string' }, accent: { type: 'string' }, accent2: { type: 'string' } } },
  fonts: { type: 'object', required: ['head', 'body'], properties: { head: { type: 'string', enum: Object.keys(FONTS) }, body: { type: 'string', enum: Object.keys(FONTS) } } },
  hero: { type: 'string', enum: HERO }, headline: { type: 'string' }, subhead: { type: 'string' }, about: { type: 'string' }, tone: { type: 'string' }, imagery: { type: 'string' },
  radius: { type: 'integer' }, cta: { type: 'object', required: ['label'], properties: { label: { type: 'string' }, note: { type: 'string' } } },
  sections: { type: 'array', items: { type: 'object', required: ['kind', 'title'], properties: { kind: { type: 'string', enum: KINDS }, variant: { type: 'string', enum: VARIANTS }, title: { type: 'string' }, intro: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' }, price: { type: 'string' } } } } } } } } };

const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g;
// Plain text only: strip tags, script-ish URLs and event handlers, angle brackets; cap length.
export function cleanText(v, n = 200) {
  let s = String(v ?? '').replace(CTRL, '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  s = s.replace(/\b(javascript|vbscript|data)\s*:/gi, '').replace(/\bon[a-z]+\s*=/gi, '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
}
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);
function lum(h) { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// Returns { ok, spec, errors }. Unknown keys are dropped, enums forced, text sanitized, readable ink enforced.
export function validateSpec(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['not an object'] };
  const p = raw.palette || {}, f = raw.fonts || {};
  const palette = { bg: hex(p.bg, '#ffffff'), surface: hex(p.surface, '#f4f4f6'), ink: hex(p.ink, '#1a1a1a'), accent: hex(p.accent, '#2f6df6'), accent2: hex(p.accent2, '#111111') };
  if (contrast(palette.ink, palette.bg) < 4.5) palette.ink = lum(palette.bg) > 0.4 ? '#141414' : '#f7f7f7';
  for (const k of ['palette', 'fonts', 'headline', 'sections']) if (!raw[k]) errors.push('missing ' + k);
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).filter(s => s && KINDS.includes(s.kind)).slice(0, 8).map(s => ({
    kind: s.kind, variant: pick(s.variant, VARIANTS, 'cards'), title: cleanText(s.title, 60) || s.kind, intro: cleanText(s.intro, 240),
    items: (Array.isArray(s.items) ? s.items : []).slice(0, 8).map(i => ({ name: cleanText(i && i.name, 60), text: cleanText(i && i.text, 220), price: cleanText(i && i.price, 16) })).filter(i => i.name || i.text) }));
  if (!sections.length) errors.push('no valid sections');
  const headline = cleanText(raw.headline, 90);
  if (!headline) errors.push('empty headline');
  const spec = { palette, fonts: { head: pick(f.head, Object.keys(FONTS), 'inter'), body: pick(f.body, Object.keys(FONTS), 'inter') }, hero: pick(raw.hero, HERO, 'center'),
    radius: Math.max(0, Math.min(32, parseInt(raw.radius, 10) || 8)), headline, subhead: cleanText(raw.subhead, 200), about: cleanText(raw.about, 700),
    tone: cleanText(raw.tone, 80), imagery: cleanText(raw.imagery, 240), cta: { label: cleanText(raw.cta && raw.cta.label, 30) || 'Get in touch', note: cleanText(raw.cta && raw.cta.note, 120) }, sections,
    layout: pick(raw.layout, ['grid', 'editorial', 'split'], 'grid'), mood: cleanText(raw.mood, 30) };
  return { ok: errors.length === 0, spec, errors };
}

// Input from the browser (business details). All free text cleaned and capped.
export function parseInput(b) {
  b = b && typeof b === 'object' ? b : {};
  return { name: cleanText(b.name, 80), type: cleanText(b.type, 30), story: cleanText(b.story, 1200), vibe: cleanText(b.vibe, 60), style: cleanText(b.style, 30),
    location: cleanText(b.address, 120), hours: cleanText(b.hours, 80), phone: cleanText(b.phone, 40), tagline: cleanText(b.tagline, 120), hasPhoto: !!b.hasPhoto, hasLogo: !!b.hasLogo,
    seed: Math.abs(parseInt(b.seed, 10) || 0) % 100000 };
}

// Preset fallback used when the model fails or the budget is spent.
const PRESET = { bakery: ['#fbf6ef', '#f3e3cc', '#3a2418', '#c0662b', '#7a4524', 'fraunces', 'lora', 'menu'], restaurant: ['#fffaf3', '#f1e6d6', '#2a1d14', '#b23a2a', '#3d2a1e', 'dmserif', 'worksans', 'menu'],
  salon: ['#111114', '#1d1d22', '#f4f1ea', '#d4a24c', '#8c6a2c', 'bebas', 'inter', 'services'], retail: ['#ffffff', '#f2f0ff', '#1d1033', '#7c3aed', '#ff2bd6', 'space', 'inter', 'services'],
  auto: ['#f5f6f7', '#e4e7ea', '#14181c', '#e4572e', '#2b3a42', 'oswald', 'inter', 'services'], pro: ['#f7fbff', '#e6f0fa', '#13263a', '#1f7a5a', '#244a73', 'poppins', 'nunito', 'services'],
  other: ['#ffffff', '#f4f4f6', '#1a1a1a', '#2f6df6', '#111111', 'inter', 'inter', 'services'] };
export function fallbackSpec(inp) {
  const t = PRESET[inp.type] || PRESET.other, name = inp.name || 'Your Business';
  return validateSpec({ palette: { bg: t[0], surface: t[1], ink: t[2], accent: t[3], accent2: t[4] }, fonts: { head: t[5], body: t[6] }, hero: 'center', radius: 10,
    headline: name, subhead: inp.tagline || 'Proudly serving ' + (inp.location || 'Memphis'), about: inp.story || name + ' is a local business serving our neighbors.', tone: 'friendly', imagery: 'Photos of your work and space',
    cta: { label: 'Get in touch' }, sections: [{ kind: t[7], title: t[7] === 'menu' ? 'Menu' : 'What we do', items: [{ name: 'Your first offering', text: 'Describe it here' }, { name: 'Your second offering', text: 'Describe it here' }] },
      { kind: 'about', title: 'About us' }, { kind: 'map', title: 'Find us' }] }).spec;
}

export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const NEURON_USD = 0.011 / 1000;                       // Workers AI list price
export function costUSD(usage) {
  if (!usage) return 0.003;
  if (usage.neurons) return usage.neurons * NEURON_USD;
  return (usage.prompt_tokens || 0) * 0.29e-6 + (usage.completion_tokens || 0) * 2.25e-6;
}
// Per-business design direction: deterministic from the business itself + the regenerate seed, so two shops never get the same skeleton
// and Regenerate really changes it. The model writes copy and tunes the palette inside this direction.
const DIRECTIONS = [
  { mood: 'warm heritage', hues: ['#7a2e1f', '#c8963e'], bg: 'light', fonts: ['dmserif', 'worksans'], hero: 'split', layout: 'editorial' },
  { mood: 'garage steel', hues: ['#ff5a1f', '#1c2630'], bg: 'dark', fonts: ['archivo', 'inter'], hero: 'banner', layout: 'grid' },
  { mood: 'workshop yellow', hues: ['#ffc300', '#111111'], bg: 'light', fonts: ['oswald', 'worksans'], hero: 'split', layout: 'grid' },
  { mood: 'glam blush', hues: ['#d63384', '#2b1a2f'], bg: 'light', fonts: ['cormorant', 'nunito'], hero: 'minimal', layout: 'split' },
  { mood: 'dark luxe', hues: ['#c9a227', '#3b2a1a'], bg: 'dark', fonts: ['cormorant', 'inter'], hero: 'full', layout: 'editorial' },
  { mood: 'street bold', hues: ['#e63946', '#1d3557'], bg: 'light', fonts: ['archivo', 'inter'], hero: 'banner', layout: 'grid' },
  { mood: 'neon night', hues: ['#00e5ff', '#ff2bd6'], bg: 'dark', fonts: ['bebas', 'space'], hero: 'full', layout: 'grid' },
  { mood: 'soft pastel', hues: ['#e8899e', '#8fb9a8'], bg: 'light', fonts: ['fraunces', 'nunito'], hero: 'center', layout: 'split' },
  { mood: 'clean modern', hues: ['#2f6df6', '#0f172a'], bg: 'light', fonts: ['space', 'inter'], hero: 'minimal', layout: 'split' },
  { mood: 'earthy craft', hues: ['#6b8f3a', '#8a5a2b'], bg: 'light', fonts: ['lora', 'worksans'], hero: 'split', layout: 'editorial' },
  { mood: 'vintage sign', hues: ['#d1495b', '#00798c'], bg: 'light', fonts: ['pacifico', 'nunito'], hero: 'banner', layout: 'grid' },
  { mood: 'editorial', hues: ['#111111', '#b08968'], bg: 'light', fonts: ['playfair', 'inter'], hero: 'minimal', layout: 'editorial' },
  { mood: 'sporty', hues: ['#0b6e4f', '#f2a541'], bg: 'dark', fonts: ['oswald', 'poppins'], hero: 'split', layout: 'grid' },
  { mood: 'sunny local', hues: ['#f4a259', '#5b8e7d'], bg: 'light', fonts: ['poppins', 'nunito'], hero: 'center', layout: 'split' },
  { mood: 'blues & brick', hues: ['#1f4e79', '#a23e2a'], bg: 'dark', fonts: ['dmserif', 'worksans'], hero: 'full', layout: 'split' }];
const ORDERS = { menu: [['menu', 'story', 'gallery', 'testimonials', 'hours', 'map'], ['story', 'menu', 'testimonials', 'gallery', 'booking'], ['gallery', 'menu', 'stats', 'testimonials', 'faq', 'hours']],
  services: [['services', 'testimonials', 'about', 'booking', 'map'], ['stats', 'services', 'gallery', 'testimonials', 'hours'], ['about', 'gallery', 'services', 'faq', 'booking'], ['services', 'gallery', 'story', 'testimonials', 'hours', 'map']] };
const MOODWORDS = { 'dark luxe': /upscale|luxur|premium|high.end|elegant/i, 'street bold': /street|bold|hip.?hop|urban|crew|team/i, 'neon night': /neon|night|club|bar|gaming|late/i,
  'soft pastel': /sweet|cake|cupcake|pastel|cute|floral|nail|lash/i, 'clean modern': /modern|minimal|tech|clean/i, 'earthy craft': /sourdough|organic|plant|garden|craft|natural|farm/i,
  'vintage sign': /old.?school|vintage|retro|classic|since 19/i, editorial: /boutique|design|studio|gallery|art/i, sporty: /sport|grizzl|fitness|gym|fitted|cap/i,
  'warm heritage': /family|heritage|tradition|soul|bbq|barbecue/i, 'sunny local': /friendly|family.friendly|playful|fun|kids/i, 'blues & brick': /memphis|blues|beale|music/i };
export const LAYOUTS = ['grid', 'editorial', 'split'];
// Industry -> preferred moods, checked against type + name + owner's words before generic mood words.
const INDUSTRY = [[/auto|repair|mechanic|garage|brake|tire|oil change|collision/i, ['garage steel', 'street bold', 'clean modern']],
  [/hardware|lumber|tools?\b|paint|plumb|feed store|supply/i, ['workshop yellow', 'vintage sign', 'warm heritage']],
  [/nail|lash|brow|spa\b|beauty|manicure|pedicure|esthetic/i, ['glam blush', 'soft pastel', 'dark luxe']],
  [/barber|fade|shave/i, ['neon night', 'vintage sign', 'street bold', 'dark luxe']],
  [/bak|bread|pastry|sourdough|cafe|café|coffee|donut/i, ['earthy craft', 'warm heritage', 'soft pastel']],
  [/bbq|barbecue|restaurant|grill|kitchen|diner/i, ['warm heritage', 'blues & brick', 'neon night']],
  [/gym|fitness|yoga|sport/i, ['sporty', 'clean modern', 'neon night']]];
function h32(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function candidates(inp) {
  const text = [inp.type, inp.name, inp.vibe, inp.story, inp.tagline].join(' '), r = h32(inp.name + '|' + inp.type + '|' + (inp.seed || 0));
  const ind = (INDUSTRY.find(([re]) => re.test(text)) || [null, []])[1];
  const mood = DIRECTIONS.filter(d => MOODWORDS[d.mood] && MOODWORDS[d.mood].test(text)).map(d => d.mood);
  const rot = (a, k) => a.length ? a.slice(k % a.length).concat(a.slice(0, k % a.length)) : a;
  const names = [...new Set([...rot(ind, inp.seed || 0), ...rot(mood, r), ...rot(DIRECTIONS.map(d => d.mood), r)])];
  const kind = /bakery|restaurant|cafe|food/.test(inp.type) ? 'menu' : 'services', orders = ORDERS[kind];
  return names.map((m, i) => { const dir = DIRECTIONS.find(d => d.mood === m), heroes = [dir.hero, ...HERO.filter(x => x !== dir.hero)], q = h32(m + r + i);
    return { ...dir, hero: inp.seed ? heroes[(q >>> 5) % 2] : dir.hero, order: orders[(q >>> 9) % orders.length].map(k => (k === 'menu' && kind !== 'menu' ? 'services' : k)), radius: [0, 4, 10, 18, 28][(q >>> 13) % 5] }; });
}
export function direction(inp) { return candidates(inp)[0]; }
// Palette: keep the AI's colors only if they match the direction's light/dark mode and anchor hue; else derive from the direction.
const pRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const pHex = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const pMix = (a, b, t) => pHex(pRgb(a).map((x, i) => x + (pRgb(b)[i] - x) * t));
export function hue(h) { const [r, g, b] = pRgb(h).map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; }
const hueGap = (a, b) => (a < 0 || b < 0 ? (a === b ? 0 : 180) : Math.min(Math.abs(a - b), 360 - Math.abs(a - b)));
export const isDark = h => lum(h) < 0.18;
function fitPalette(P, dir) {
  const wantDark = dir.bg === 'dark', a = dir.hues[0], b = dir.hues[1];
  if (isDark(P.bg) === wantDark && hueGap(hue(P.accent), hue(a)) < 40) return P;
  return wantDark ? { bg: pMix(b, '#000000', 0.7), surface: pMix(b, '#000000', 0.5), ink: '#f5f3ee', accent: a, accent2: pMix(b, '#ffffff', 0.15) }
    : { bg: pMix(a, '#ffffff', 0.95), surface: pMix(a, '#ffffff', 0.85), ink: pMix(b, '#000000', 0.55), accent: a, accent2: b };
}
export function applyDirection(spec, dir) {
  spec.hero = dir.hero; spec.fonts = { head: dir.fonts[0], body: dir.fonts[1] }; spec.radius = dir.radius; spec.layout = dir.layout || 'grid'; spec.mood = dir.mood;
  spec.palette = fitPalette(spec.palette, dir);
  const byKind = {}; for (const sec of spec.sections) (byKind[sec.kind] = byKind[sec.kind] || []).push(sec);
  const out = []; for (const k of dir.order) if (byKind[k] && byKind[k].length) out.push(byKind[k].shift());
  for (const k in byKind) out.push(...byKind[k]);
  spec.sections = out.slice(0, 10); return spec;
}
// Distinctness: signature of the look; a design matching a recent one on 3+ of 5 traits is rejected and the next direction is tried.
export function signature(spec) { return { dark: isDark(spec.palette.bg), head: spec.fonts.head, hero: spec.hero, layout: spec.layout, hue: Math.round(hue(spec.palette.accent)) }; }
export function similarity(a, b) { return (a.dark === b.dark) + (a.head === b.head) + (a.hero === b.hero) + (a.layout === b.layout) + (hueGap(a.hue, b.hue) < 35); }
export const TOO_CLOSE = 3;
export function pickDistinct(spec, inp, recent) {
  const base = JSON.parse(JSON.stringify(spec)), cands = candidates(inp); let best = null, bestScore = 9, tries = 0;
  for (const dir of cands) { tries++; const s = applyDirection(JSON.parse(JSON.stringify(base)), dir), sig = signature(s);
    const score = recent.reduce((m, r) => Math.max(m, similarity(sig, r)), 0);
    if (score < TOO_CLOSE) return { spec: s, tries, score }; if (score < bestScore) { best = s; bestScore = score; } }
  return { spec: best || applyDirection(base, cands[0]), tries, score: bestScore };
}
export async function recentSigs(db, n = 12) {
  await db.prepare('CREATE TABLE IF NOT EXISTS ai_recent (id INTEGER PRIMARY KEY AUTOINCREMENT, sig TEXT NOT NULL, ts INTEGER NOT NULL)').run();
  const r = await db.prepare('SELECT sig FROM ai_recent ORDER BY id DESC LIMIT ?').bind(n).all();
  return (r.results || []).map(x => { try { return JSON.parse(x.sig); } catch { return null; } }).filter(Boolean);
}
export async function saveSig(db, sig) { await db.prepare('INSERT INTO ai_recent (sig, ts) VALUES (?, ?)').bind(JSON.stringify(sig), Date.now()).run(); }
export function prompt(inp, current, request) {
  const dir = direction(inp);
  const sys = 'You are the senior designer at Elder World Studio, a Memphis web studio. You design ONE distinctive small-business website as JSON matching the schema. ' +
    'Make it feel made for this exact business, never a generic template. Follow the design direction you are given. ' +
    'Palette: five hex colors that express the direction and the business (start from the anchor hues, adjust to fit), bg/surface ' + '' + 'matching the light/dark mood, ink readable on bg. Do NOT use #ff9900 or default orange unless the business calls for it. ' +
    'Write real copy in the owner\'s voice using concrete details from their description: a specific headline (not just the name, not a pun template), subhead, about (2-4 sentences), 3-6 realistic items per services/menu section with short descriptions, testimonials as short quotes with first names, stats as short numbers with labels. ' +
    'Section titles must be specific to the business (e.g. "Fresh out the oven", not "Our Services"). Prices only if typical, like "$12". imagery = one sentence of photo art direction for THIS business. Never include HTML, scripts, URLs or emails. Plain text only.';
  const biz = `Business: ${inp.name}\nType: ${inp.type}\nLocation: ${inp.location || 'Memphis, TN'}\nVibe: ${inp.vibe || inp.style || 'owner did not say'}\nTagline idea: ${inp.tagline}\nHours: ${inp.hours}\nAbout (owner's words): ${inp.story || '(none)'}\nHas own logo: ${inp.hasLogo}; has own photo: ${inp.hasPhoto}`;
  const brief = `Design direction: mood "${dir.mood}", ${dir.bg} background, anchor hues ${dir.hues.join(' and ')}, hero "${dir.hero}", ${dir.layout} layout, fonts ${dir.fonts.join(' + ')}, sections in this order: ${dir.order.join(', ')}.`;
  const user = current ? `${biz}\n\nCurrent design JSON:\n${JSON.stringify(current).slice(0, 6000)}\n\nChange request from the owner: "${request}"\nReturn the full updated design JSON. Change only what the request implies (layout, colors, fonts, sections or copy); keep the rest.` : `${biz}\n\n${brief}\n\nDesign the site.`;
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// D1-backed limits. Per IP: 8 generations / 10 min and 40 / day. Global: DAILY_CAP_USD (default $3).
export const LIMITS = { burst: 8, burstWindowMin: 10, perDay: 40 };
export async function ensureTables(db) {
  await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS ai_rl (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ai_cost (day TEXT PRIMARY KEY, usd REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0)')]);
}
async function bump(db, k, ttlMs, now) {
  const r = await db.prepare('INSERT INTO ai_rl (k,n,exp) VALUES (?,1,?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN exp < ? THEN 1 ELSE n + 1 END, exp = CASE WHEN exp < ? THEN excluded.exp ELSE exp END RETURNING n')
    .bind(k, now + ttlMs, now, now).first();
  return r ? r.n : 1;
}
export async function ipKey(ip) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ews-ai:' + ip)); return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function checkLimits(db, ip, capUSD, now = Date.now()) {
  const k = await ipKey(ip || 'unknown'), day = new Date(now).toISOString().slice(0, 10);
  const spent = await db.prepare('SELECT usd FROM ai_cost WHERE day = ?').bind(day).first();
  if (spent && spent.usd >= capUSD) return { ok: false, reason: 'budget' };
  const w = LIMITS.burstWindowMin * 60000;
  const nb = await bump(db, `b:${k}:${Math.floor(now / w)}`, w, now), nd = await bump(db, `d:${k}:${day}`, 86400000, now);
  if (nb > LIMITS.burst || nd > LIMITS.perDay) return { ok: false, reason: 'rate' };
  if (Math.random() < 0.02) await db.prepare('DELETE FROM ai_rl WHERE exp < ?').bind(now).run();
  return { ok: true, day };
}
export async function addCost(db, day, usd) {
  await db.prepare('INSERT INTO ai_cost (day,usd,calls) VALUES (?,?,1) ON CONFLICT(day) DO UPDATE SET usd = usd + excluded.usd, calls = calls + 1').bind(day, usd).run();
}

// ---- Training-data log (opt-in only). No name, email or phone is ever stored; business name is replaced unless name consent is given.
export function stripPII(text, bizName) {
  let s = String(text ?? '');
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
  s = s.replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]');
  s = s.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '[url]');
  s = s.replace(/\b\d{1,6}\s+(?:[A-Z][a-z]+\s){0,3}(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Ln|Lane|Way|Pkwy|Hwy|Ct|Cv|Cove)\b\.?/g, '[street]');
  if (bizName && bizName.trim().length > 1) s = s.split(bizName.trim()).join('{{BUSINESS}}').replace(new RegExp(bizName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '{{BUSINESS}}');
  return s;
}
export function anonInput(inp, nameConsent) {
  const name = nameConsent ? inp.name : '';
  const sc = s => (nameConsent ? stripPII(s, '') : stripPII(s, inp.name));
  const city = (inp.location.match(/[A-Za-z .'-]+(?:,\s*[A-Z]{2})?$/) || [''])[0].trim();
  return { business: name || '{{BUSINESS}}', type: inp.type, vibe: inp.vibe, style: inp.style, city: stripPII(city, inp.name), story: sc(inp.story), tagline: sc(inp.tagline), hasPhoto: inp.hasPhoto, hasLogo: inp.hasLogo };
}
export function anonSpec(spec, inp, nameConsent) { return nameConsent ? JSON.parse(stripPII(JSON.stringify(spec), '')) : JSON.parse(stripPII(JSON.stringify(spec), inp.name)); }
export function specDiff(a, b, path = '') {
  const out = [];
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...specDiff(a[k], b[k], path ? path + '.' + k : k));
    return out;
  }
  return [{ path: path || '.', from: a, to: b }];
}
export const TRAIN_SCHEMA = 'CREATE TABLE IF NOT EXISTS train_events (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT NOT NULL, session TEXT NOT NULL, event TEXT NOT NULL, name_consent INTEGER NOT NULL DEFAULT 0, input TEXT, request TEXT, spec TEXT, diff TEXT, outcome TEXT, source TEXT DEFAULT \'web\', generator TEXT)';
// consent gating: returns null (nothing stored) unless consent === true
export function trainRow({ consent, nameConsent, session, event, inp, request, spec, prev, outcome, source }) {
  if (consent !== true) return null;
  if (!/^[a-z0-9-]{8,40}$/i.test(String(session || ''))) return null;
  const nc = nameConsent === true;
  return { session, event, name_consent: nc ? 1 : 0, input: JSON.stringify(anonInput(inp, nc)), request: request ? stripPII(cleanText(request, 300), nc ? '' : inp.name) : '',
    spec: spec ? JSON.stringify(anonSpec(spec, inp, nc)) : '', diff: prev && spec ? JSON.stringify(anonSpec(specDiff(prev, spec), inp, nc)) : '', outcome: outcome || '', source: 'web', generator: source || '' };
}
export async function logTrain(db, row) {
  if (!db || !row) return false;
  await db.prepare(TRAIN_SCHEMA).run();
  await db.prepare('INSERT INTO train_events (created,session,event,name_consent,input,request,spec,diff,outcome,source,generator) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(new Date().toISOString(), row.session, row.event, row.name_consent, row.input, row.request, row.spec, row.diff, row.outcome, row.source, row.generator).run();
  return true;
}
