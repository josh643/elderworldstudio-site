# Live-build frame sequence: starts the staging demo (or watches what's live) and captures frames while the town builds.
# usage: python3 livebuild_shots.py BASE OUTDIR [secs] [every] [start=1]
import asyncio, sys, json, time
from playwright.async_api import async_playwright
from probe_screenshot import capture_screenshot
BASE, O = sys.argv[1], sys.argv[2]; SECS = int(sys.argv[3]) if len(sys.argv) > 3 else 90; EVERY = float(sys.argv[4]) if len(sys.argv) > 4 else 6; START = (sys.argv[5] if len(sys.argv) > 5 else '1') == '1'
TIME = sys.argv[6] if len(sys.argv) > 6 else ''
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = await b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    await pg.goto(f"{BASE}/?office=1" + (f"&time={TIME}" if TIME else '')); await pg.wait_for_function("window.__ewsOffice&&__ewsOffice.colliders&&__ewsOffice.colliders()>50&&__ewsOffice.world", timeout=240000); await pg.wait_for_timeout(6000)
    if START:
      print('demo', await pg.evaluate(f"__ewsOffice.demoBuild({{secs:{SECS}}})"))
    await pg.wait_for_timeout(2500)
    t0 = time.time(); i = 0
    while time.time() - t0 < SECS + 15:
      view = 'road' if i % 4 == 3 else 'lot'
      await pg.evaluate("__ewsOffice.watchBuild('road:demo-ave')" if view == 'road' else "__ewsOffice.watchBuild('lot:9')"); await pg.wait_for_timeout(700)
      w = await pg.evaluate("JSON.stringify(__ewsOffice.world())"); 
      await capture_screenshot(pg, f"{O}/f{i:03d}_{view}.png"); print(f"{time.time()-t0:5.1f}s", view, w[:400], flush=True); i += 1
      await pg.wait_for_timeout(max(0, EVERY * 1000 - 700))
    print('info', await pg.evaluate("JSON.stringify({info:__ewsOffice.info(),ext:__ewsOffice.exterior(),lu:__ewsOffice.liveUpdate&&__ewsOffice.liveUpdate()})"))
    print('errors', [e for e in errs if '404' not in e][:10]); await b.close()
asyncio.run(main())
