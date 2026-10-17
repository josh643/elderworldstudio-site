import asyncio, sys, json
from playwright.async_api import async_playwright
async def main():
    p = await async_playwright().start(); b = await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = await b.new_page(viewport={'width': 1600, 'height': 700}); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    for url, out in zip(sys.argv[1::2], sys.argv[2::2]):
        await pg.goto(url); await pg.wait_for_function("document.title==='done'", timeout=90000)
        await pg.screenshot(path=out); print(out, json.dumps(await pg.evaluate("window.__chars"))[:300], json.dumps(await pg.evaluate("window.__dbg")))
    for e in errs[:10]: print('ERR', e[:300])
    await b.close()
asyncio.run(main())
