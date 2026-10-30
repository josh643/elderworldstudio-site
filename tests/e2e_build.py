"""E2E: /build/ with the AI designer, 3 different businesses on desktop + phone. Usage: python3 tests/e2e_build.py BASE [--live-lead] [--mock-ai]
Default: real /api/build-ai on desktop (3 generates + 1 regenerate + 1 edit), phone replays the specs desktop got (keeps under the per-IP limit).
/api/build-lead is mocked unless --live-lead. Screenshots + specs go to /workspace/ews-web-builder/e2e/."""
import asyncio, sys, json, os, hashlib
from playwright.async_api import async_playwright
BASE = sys.argv[1].rstrip('/') + '/'; LIVE_LEAD = '--live-lead' in sys.argv; MOCK_AI = '--mock-ai' in sys.argv
OUT = '/workspace/ews-web-builder/e2e/'; os.makedirs(OUT, exist_ok=True)
LOGO = os.path.join(os.path.dirname(__file__), 'fixture-logo.png')
REGRESS = ['', 'services/', 'contact/', 'merch/', 'games/', 'testers/', 'privacy-policy/']
BIZ = [
  dict(slug='barbershop', type='salon', style='bold', name='Riverside Fades', phone='(901) 555-0142', address='Memphis, TN', vibes=['Old-school', 'Bold'],
       story='Old-school family barbershop since 1998 on the riverside. Hot towel shaves, sharp fades, Grizzlies on the TV and fair prices.', logo=True, consent=True),
  dict(slug='bakery', type='bakery', style='rustic', name='Broad Ave Bread Co', phone='', address='Broad Ave, Memphis, TN', vibes=['Cozy', 'Classic'],
       story='Small sourdough bakery in the Broad Ave arts district. Naturally leavened loaves, cardamom buns, local coffee. Sells out by noon on Saturdays.', logo=False, consent=False),
  dict(slug='capshop', type='retail', style='minimal', name='Midsouth Lids', phone='', address='Cooper-Young, Memphis, TN', vibes=['Bold', 'Modern'],
       story='Fitted caps and custom embroidery for Memphis teams, crews and events. Streetwear energy, quick turnaround, embroidery done in-house.', logo=False, consent=False)]
SPECS = {}; COSTS = []; LOG = []
async def wait_design(pg, timeout=150000):
    await pg.wait_for_function("() => { const s = JSON.parse(localStorage.getItem('ews-builder-draft-v2') || '{}'); return s.spec && !document.querySelector('#regen[disabled]'); }", timeout=timeout)
async def run(b, biz, device):
    mobile = device == 'phone'; vp = {'width': 390, 'height': 844} if mobile else {'width': 1366, 'height': 900}
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errs = []; calls = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    if not LIVE_LEAD: await pg.route('**/api/build-lead', lambda r: r.fulfill(json={'ok': True, 'id': 'W-TEST-0001'}))
    async def on_ai(route):
        body = json.loads(route.request.post_data or '{}'); calls.append(body)
        if mobile or MOCK_AI:
            if body.get('action') == 'outcome': return await route.fulfill(json={'ok': True, 'stored': False})
            return await route.fulfill(json={'ok': True, 'source': 'ai', 'spec': SPECS.get((biz['slug'], body.get('action')), SPECS.get((biz['slug'], 'generate'))) or {}, 'cost': 0})
        resp = await route.fetch(timeout=120000); j = await resp.json()
        if body.get('action') != 'outcome':
            SPECS[(biz['slug'], body['action'])] = j.get('spec'); COSTS.append((biz['slug'], body['action'], j.get('source'), j.get('cost'), j.get('reason'), j.get('invalid')))
        await route.fulfill(status=resp.status, json=j)
    await pg.route('**/api/build-ai', on_ai)
    await pg.goto(BASE + 'build/', wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
    pf = pg.frame_locator('#preview')
    await pg.click(f"[data-type={biz['type']}]"); await pg.click('#next')
    await pg.click(f"[data-style={biz['style']}]"); await pg.click('[data-page=Gallery]'); await pg.click('#next')
    await pg.fill('#f-name', biz['name']); await pg.fill('#f-address', biz['address'])
    if biz['phone']: await pg.fill('#f-phone', biz['phone'])
    await pg.click('#next')
    await pg.click('#next'); assert await pg.is_visible('#err'), 'story required'
    await pg.fill('#f-story', biz['story'])
    for v in biz['vibes']: await pg.click(f'[data-vibe="{v}"]')
    if biz['logo']: await pg.set_input_files('#f-logo', LOGO); await pg.wait_for_selector('text=Logo added')
    if biz['consent']: await pg.check('#f-consent'); await pg.check('#f-nameconsent')
    assert await pg.input_value('#f-story') == biz['story'], 'story survives redraw'
    await pg.click('#next'); await wait_design(pg)
    if not (mobile or MOCK_AI): assert COSTS[-1][2] == 'ai', ('AI fell back', COSTS[-1])
    gen = calls[-1]; assert gen['action'] == 'generate' and gen['input']['story'] == biz['story'] and gen['consent'] is biz['consent']
    assert 'data:image' not in json.dumps(gen), 'images never leave the browser'
    assert gen['input']['hasLogo'] is biz['logo']
    head = await pf.locator('header').inner_text(); assert biz['name'] in head, head
    if biz['logo']: assert await pf.locator('header img').count() == 1, 'logo shown'
    await pg.screenshot(path=f"{OUT}{biz['slug']}-{device}.png", full_page=True)
    html = await pg.evaluate("document.getElementById('preview').srcdoc"); LOG.append((biz['slug'], device, hashlib.sha1(html.encode()).hexdigest()[:10]))
    sw = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]'); assert sw[0] <= sw[1] + 1, f'horizontal overflow {sw}'
    if biz['slug'] == 'barbershop':
        before = html
        await pg.click('#regen'); await wait_design(pg); assert (await pg.text_content('#rev-badge')) == 'v2'
        await pg.fill('#f-ask', 'Make it darker and put the reviews first'); await pg.click('#ask'); await wait_design(pg)
        assert calls[-1]['action'] == 'edit' and calls[-1]['request'].startswith('Make it darker') and calls[-1]['spec'], 'edit sends current spec'
        assert (await pg.text_content('#rev-badge')) == 'v3'
        await pg.screenshot(path=f"{OUT}{biz['slug']}-{device}-edited.png", full_page=True)
        await pg.click('#undo'); await pg.click('#undo'); assert (await pg.text_content('#rev-badge')) == 'v1'
        assert await pg.evaluate("document.getElementById('preview').srcdoc") == before, 'undo restores first design'
        await pg.reload(wait_until='networkidle'); assert (await pg.text_content('#rev-badge')) == 'v1', 'persists across reload'
        if biz['logo']: assert await pf.locator('header img').count() == 1, 'logo persists'
    await pg.click('[data-tab=Gallery]'); await pf.locator('.gal').first.wait_for(timeout=5000)
    await pg.click('[data-tab=Home]'); await pg.click('#next')
    assert 'opted in' in await pg.inner_text('#claim'), 'privacy line on form'
    for price in ['$349', '$19/mo', '$699', '$39/mo', '$1,299', '$69/mo', '$249', '+ $2/yr']: assert price in await pg.inner_text('#pricing'), price
    await pg.fill('input[name=name]', 'E2E Test'); await pg.fill('input[name=email]', 'e2e-test@example.com'); await pg.fill('textarea[name=notes]', 'E2E TEST - safe to delete')
    await pg.wait_for_timeout(3100); await pg.click('#send'); await pg.wait_for_selector('#lead-id', timeout=15000)
    if biz['consent']: assert any(c.get('action') == 'outcome' and c.get('outcome') == 'lead' for c in calls), 'outcome label sent'
    assert not errs, errs
    if biz['slug'] == 'barbershop':
        for p in REGRESS:
            r = await pg.goto(BASE + p); assert r.status == 200, (p, r.status)
            assert await pg.locator('.site-header a[href$="build/index.html"]').count() == 1, f'nav link on {p}'
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for device in ['desktop', 'phone']:
            for biz in BIZ: await run(b, biz, device); print('ok', biz['slug'], device, flush=True)
        await b.close()
    by = {}
    for s, d, h in LOG: by.setdefault(d, set()).add(h)
    assert all(len(v) == 3 for v in by.values()), ('designs not distinct', LOG)
    gens = [s for s in SPECS.items() if s[0][1] == 'generate']
    keys = {(v['hero'], v['fonts']['head'], v['palette']['accent'], tuple(x['kind'] for x in v['sections'])) for k, v in gens}
    assert len(keys) == 3, ('skeletons not distinct', keys)
    json.dump({'costs': COSTS, 'specs': {f'{k[0]}:{k[1]}': v for k, v in SPECS.items()}}, open(OUT + 'specs.json', 'w'), indent=1)
    print('costs', COSTS); print('E2E PASS')
asyncio.run(main())
