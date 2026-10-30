"""E2E: walk the /build/ flow on desktop + phone. Usage: python3 tests/e2e_build.py BASE [--live]
Without --live the /api/build-lead call is mocked; with --live it writes one real row (notes 'E2E TEST') to D1."""
import asyncio, sys, json
from playwright.async_api import async_playwright
BASE = sys.argv[1].rstrip('/') + '/'; LIVE = '--live' in sys.argv; OUT = '/workspace/ews-web-builder/'
REGRESS = ['', 'services/', 'contact/', 'merch/', 'developer-assets/', 'privacy-policy/']
async def run(b, name, vp, mobile, submit):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errs = []; ids = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    if not LIVE:
        await pg.route('**/api/build-lead', lambda r: r.fulfill(json={'ok': True, 'id': 'W-TEST-0001'}))
    await pg.goto(BASE + 'build/', wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
    pf = pg.frame_locator('#preview')
    await pg.click('[data-type=salon]'); await pg.click('#next')
    await pg.click('[data-style=bold]'); await pg.click('[data-page=Gallery]'); await pg.click('#next')
    await pg.click('#next'); assert await pg.is_visible('#err'), 'name required'
    await pg.fill('#f-name', 'Southern Fade Barbers'); await pg.fill('#f-phone', '(901) 555-0142'); await pg.fill('#f-address', 'Cooper-Young, Memphis')
    assert 'Southern Fade Barbers' in await pf.locator('header').inner_text(), 'live preview updates while typing'
    await pg.click('#next')
    await pg.click('[data-tab=Menu]'); assert 'Services' in await pf.locator('h2').inner_text()
    await pg.click('[data-tab=Home]'); await pg.click('[data-change=darker]'); v = (await pg.text_content('#rev-badge')); assert v == 'v2', v
    await pg.click('[data-change=bigger]'); await pg.click('#undo'); assert ((await pg.text_content('#rev-badge'))) == 'v2', 'undo'
    await pg.reload(wait_until='networkidle'); assert ((await pg.text_content('#rev-badge'))) == 'v2', 'draft persists across reload'
    sw = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]'); assert sw[0] <= sw[1] + 1, f'horizontal overflow {sw}'
    await pg.screenshot(path=f'{OUT}{name}-preview.png', full_page=True)
    await pg.click('#next'); assert await pg.input_value('input[name=domain]') == 'southernfadebarbers.com'
    await pg.click('#send'); assert 'email' in await pg.inner_text('#err'), 'client validation'
    await pg.screenshot(path=f'{OUT}{name}-claim.png', full_page=True)
    if submit:
        await pg.fill('input[name=name]', 'E2E Test'); await pg.fill('input[name=email]', 'e2e-test@example.com')
        await pg.fill('textarea[name=notes]', 'E2E TEST - safe to delete'); await pg.wait_for_timeout(3100)
        await pg.click('#send'); await pg.wait_for_selector('#lead-id', timeout=15000); ids.append(await pg.inner_text('#lead-id'))
        await pg.screenshot(path=f'{OUT}{name}-sent.png', full_page=True)
    assert not errs, errs
    for p in REGRESS:
        r = await pg.goto(BASE + p); assert r.status == 200, (p, r.status)
        assert await pg.locator('.site-header a[href$="build/index.html"]').count() == 1, f'nav link on {p}'
    await ctx.close(); return ids
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ids = await run(b, 'desktop', {'width': 1366, 'height': 900}, False, True)
        ids += await run(b, 'mobile', {'width': 390, 'height': 844}, True, not LIVE)
        await b.close(); print('E2E PASS', 'live' if LIVE else 'mocked', json.dumps(ids))
asyncio.run(main())
