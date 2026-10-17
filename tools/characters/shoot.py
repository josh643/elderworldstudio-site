# Local/staging character shots: close-up + distance per named agent, console errors, wardrobe stats.
# usage: shoot.py <base_url> <tag> [chars] [names comma]
import asyncio, json, sys, os
from playwright.async_api import async_playwright
BASE, TAG = sys.argv[1], sys.argv[2]; CH = sys.argv[3] if len(sys.argv) > 3 else 'all'; NAMES = (sys.argv[4] if len(sys.argv) > 4 else 'Brokkr,Freyja').split(',')
OUT = '/workspace/shots/characters'
async def main():
    p = await async_playwright().start()
    b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = await b.new_page(viewport={'width': 1280, 'height': 800}); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    await pg.goto(f'{BASE}/?office=1&chars={CH}', timeout=120000)
    await pg.wait_for_function("window.__ewsOffice && __ewsOffice.desks && __ewsOffice.avatars && __ewsOffice.avatars().length > 5", timeout=180000)
    await pg.wait_for_timeout(8000)
    av = await pg.evaluate("__ewsOffice.avatars()")
    print('AGENTS', len(av), sum(1 for a in av if a['look'] and a['look'].get('wardrobe')))
    for n in NAMES:
        a = next((x for x in av if x['name'] == n), None)
        if not a: print('missing', n); continue
        x, _, z = a['p']; ry = a['ry']; import math
        fx, fz = math.sin(ry), math.cos(ry)
        for lab, d in (('close', 1.25), ('far', 9.0)):
            await pg.evaluate(f"__ewsOffice.look({x + fx * d}, {z + fz * d}, {x}, {z})"); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'{OUT}/{TAG}_{n}_{lab}.png')
        print('LOOK', n, json.dumps(a['look'].get('wardrobe') if a['look'] else None), a['clip'], a['p'])
    info = await pg.evaluate("__ewsOffice.info()"); print('INFO', json.dumps(info))
    try: print('SEAT', json.dumps(await pg.evaluate("__ewsOffice.seatAudit ? __ewsOffice.seatAudit() : null"))[:800])
    except Exception as e: print('SEAT err', e)
    for e in errs[:25]: print('CONSOLE', e[:300])
    await b.close()
asyncio.run(main())
