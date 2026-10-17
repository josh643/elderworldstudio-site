# Stage gallery: drive one lot through every stage via the real event API and capture each.
# usage: python3 livebuild_stages.py BASE OUTDIR KEY [time] [lot]
import asyncio, sys, json, time, urllib.request
from playwright.async_api import async_playwright
BASE, O, KEY = sys.argv[1], sys.argv[2], sys.argv[3]; TM = sys.argv[4] if len(sys.argv) > 4 else '14:00'; LOT = int(sys.argv[5]) if len(sys.argv) > 5 else 12
def ev(e): r = urllib.request.Request(BASE + '/api/office/world-event', data=json.dumps(e).encode(), method='POST', headers={'authorization': 'Bearer ' + KEY, 'content-type': 'application/json'}); return json.load(urllib.request.urlopen(r))
STAGES = [('survey', 0.06), ('groundwork', 0.18), ('foundation', 0.31), ('framing', 0.43), ('framing2', 0.48), ('walls', 0.57), ('glazing', 0.69), ('signage', 0.80), ('landscaping', 0.93), ('open', 1.0)]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = await b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    await pg.goto(f"{BASE}/?office=1&time={TM}"); await pg.wait_for_function("window.__ewsOffice&&__ewsOffice.colliders&&__ewsOffice.colliders()>50&&__ewsOffice.world", timeout=240000); await pg.wait_for_timeout(5000)
    print(ev([{'type': 'lot.release', 'lot': LOT}]))
    print(ev({'type': 'lot.lease', 'lot': LOT, 'tenant': 'Hearth & Loaf Bakery', 'public': True, 'style': {'floors': 2, 'color': 'brick', 'kind': 'cafe'}, 'parts': {'landscaping': '/office/assets/exterior/shrub_03.glb?v=1'}}))
    for i, (name, o) in enumerate(STAGES):
      ev({'type': 'site.progress', 'lot': LOT, 'overall': o})
      await pg.wait_for_function(f"(__ewsOffice.world().ents.find(e=>e.id==='lot:{LOT}')||{{}}).shown>={o}-0.004", timeout=120000)
      await pg.evaluate(f"__ewsOffice.watchBuild('lot:{LOT}')"); await pg.wait_for_timeout(1800)
      await pg.screenshot(path=f"{O}/stage_{i:02d}_{name}.png"); print(name, 'ok', flush=True)
    print('world', await pg.evaluate("JSON.stringify(__ewsOffice.world())"))
    print('errors', [e for e in errs if '500' not in e][:10]); await b.close()
asyncio.run(main())
