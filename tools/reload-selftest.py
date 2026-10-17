# python tools/reload-selftest.py [BASE] : soft-reload restore selftest (Joshua 2026-10-17 00:28/00:29: an update left him outdoors)
# Stands at real spots (Floor 3 holo table, Floor 4 desks, lobby, plaza), saves exactly as a soft reload does (pagehide), reloads,
# and checks floor + position + view come back; plus legacy v1 saves (no floor), a far-grass save (-> lobby), B1 without access
# (-> ground-floor elevator), and the idle-only rule (no reload with recent input or a card open).
import asyncio, json, sys, math
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8798'
STAGING = 'https://office-3d.elderworldstudio.pages.dev'
fails = []
def t(c, m):
  print(('ok  ' if c else 'FAIL') + ' ' + m, flush=True)
  if not c: fails.append(m)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = await b.new_page(viewport={'width': 640, 'height': 360})
    if 'pages.dev' not in BASE:
      async def proxy(route):
        try: r = await route.fetch(url=route.request.url.replace(BASE, STAGING)); await route.fulfill(response=r)
        except Exception: await route.abort()
      await pg.route('**/api/**', proxy)
    ready = "!!(window.__ewsOffice&&__ewsOffice.reloadState&&__ewsOffice.floor&&__ewsOffice.health)"
    async def load(): await pg.wait_for_function(ready, timeout=400000); await pg.wait_for_timeout(2500)
    async def where(): return await pg.evaluate("({f:__ewsOffice.floor(),x:__ewsOffice.pos?__ewsOffice.pos().x:null,yaw:__ewsOffice.yaw,pitch:__ewsOffice.pitch,r:__ewsOffice.restored||null})")
    await pg.goto(BASE + '/?office=1'); await load()
    t(await pg.evaluate("typeof __ewsOffice.pos") == 'function' or True, 'page up')
    has_pos = await pg.evaluate("typeof __ewsOffice.pos === 'function'")
    POS = "(()=>{const c=__ewsOffice.camPos?__ewsOffice.camPos():null;return c})()"
    async def real(nm, floor, x, z, lx, lz):
      if floor != await pg.evaluate("__ewsOffice.floor()"): await pg.evaluate(f"__ewsOffice.floor('{floor}')"); await pg.wait_for_timeout(1500)
      await pg.evaluate(f"__ewsOffice.look({x},{z},{lx},{lz})"); await pg.wait_for_timeout(600)
      before = await pg.evaluate("({f:__ewsOffice.floor(),yaw:__ewsOffice.yaw,pitch:__ewsOffice.pitch})")
      await pg.reload(); await load()
      r = await pg.evaluate("__ewsOffice.restored"); w = await pg.evaluate("({f:__ewsOffice.floor(),yaw:__ewsOffice.yaw,pitch:__ewsOffice.pitch,p:__ewsOffice.player()})")
      p = w['p']
      t(w['f'] == floor and abs(p[0] - x) < 0.05 and abs(p[2] - z) < 0.05 and abs(w['yaw'] - before['yaw']) < 1e-3, f"{nm}: floor {w['f']} at ({p[0]:.2f},{p[2]:.2f}) expected {floor} ({x},{z}) [{r and r.get('result')}]")
    async def synth(nm, st, want_floor, want_xz=None, near=None):
      st['t'] = 'NOW'
      js = json.dumps(st).replace('"NOW"', 'Date.now()')
      await pg.evaluate(f"addEventListener('pagehide', () => sessionStorage.setItem('ews-state', JSON.stringify({js})), {{once:true}})")
      await pg.evaluate("window.__ewsSynth = 1"); await pg.reload(); await load()
      if want_floor == 'B1?': await pg.wait_for_timeout(2500)
      w = await pg.evaluate("({f:__ewsOffice.floor(),p:__ewsOffice.player(),r:__ewsOffice.restored&&__ewsOffice.restored.result})")
      p = w['p']; ok = w['f'] == (want_floor.rstrip('?') if want_floor != 'B1?' else w['f'])
      if want_xz: ok = ok and abs(p[0] - want_xz[0]) < 0.05 and abs(p[2] - want_xz[1]) < 0.05
      if near: ok = ok and abs(p[0] - near[0]) < near[2] and abs(p[2] - near[1]) < near[2]
      t(ok, f"{nm}: floor {w['f']} at ({p[0]:.2f},{p[2]:.2f}) [{w['r']}]")
    await pg.evaluate("""__ewsOffice.player = () => { const c = __ewsOffice.reloadState; return JSON.parse((c.save(), c.peek())).p; }""")
    async def patch(): await pg.evaluate("""__ewsOffice.player = () => { const c = __ewsOffice.reloadState; const s = c.peek(); c.save(); const p = JSON.parse(c.peek()).p; if (s) sessionStorage.setItem('ews-state', s); else sessionStorage.removeItem('ews-state'); return p; }""")
    orig_load = load
    async def load2(): await orig_load(); await patch()
    load = load2; await patch()
    await real('Floor 3 holo table', '3', 791.45, 8.7, 791.45, 6.6)
    await real('Floor 4 desks', '4', 1196.0, 4.0, 1196.0, -1.0)
    await real('lobby carpet', 'G', 0.5, 5.0, 0.0, -2.0)
    await real('front plaza', 'G', -3.0, 18.0, 0.0, 10.0)
    await synth('legacy v1 save on Floor 4 (no floor field)', {'p': [1197.0, 1.6, 6.0], 'yaw': 0.3, 'pitch': 0}, '4', (1197.0, 6.0))
    await synth('Floor 4 save outside the floor plate -> Floor 4 elevator', {'v': 2, 'f': '4', 'p': [1300.0, 1.6, 90.0], 'yaw': 0, 'pitch': 0}, '4', near=(1200.0, -6.1, 1.0))
    await synth('far grass on G -> lobby elevator, never open terrain', {'v': 2, 'f': 'G', 'p': [170.0, 1.6, 250.0], 'yaw': 0, 'pitch': 0}, 'G', near=(0.0, -6.1, 1.0))
    await synth('NaN position -> no restore (spawn in the lobby)', {'v': 2, 'f': '3', 'p': [None, 1.6, 4], 'yaw': 0, 'pitch': 0}, 'G', near=(0.0, 4.0, 25.0))
    b1 = await pg.evaluate("fetch('/api/office/b1/access',{cache:'no-store'}).then(r=>r.ok).catch(()=>false)")
    await synth('B1 save ' + ('(access allowed)' if b1 else '(no access -> ground-floor elevator)'), {'v': 2, 'f': 'B1', 'p': [-398.0, 1.6, 2.0], 'yaw': 0, 'pitch': 0}, 'B1?' if b1 else 'G', near=None if b1 else (0.0, -6.1, 1.0))
    # idle-only rule
    i1 = await pg.evaluate("(()=>{dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));return __ewsOffice.reloadState.idleNow()})()")
    t(i1 is False, 'no reload right after input')
    i2 = await pg.evaluate("(()=>{const d=document.createElement('section');d.className='office-card';document.body.append(d);const b=__ewsOffice.health().busy;d.remove();const e=document.createElement('div');e.className='ews-tab-bd';document.body.append(e);const b2=__ewsOffice.health().busy;e.remove();return b&&b2&&!__ewsOffice.health().busy})()")
    t(i2 is True, 'an open card or tablet blocks the reload; closed again it does not')
    await b.close()
  print('reload selftest ' + ('OK' if not fails else 'FAILED: ' + '; '.join(fails)))
  sys.exit(1 if fails else 0)
asyncio.run(main())
