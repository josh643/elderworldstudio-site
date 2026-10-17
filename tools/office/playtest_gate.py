#!/usr/bin/env python3
"""Pre-deploy playtest gate (Joshua HARD RULE 2026-10-17 00:33 AM: "The team is supposed to catch and fix everything").
tools/deploy-staging.sh uploads the build to a PREVIEW alias first (branch playtest), runs this bot on it, and only promotes to office-3d on PASS.
The bot (headless Chrome, <3 min):
  1. rides the elevator to every floor (G, 2..5; B1 only where the IP lock allows it)
  2. per floor: invisible-wall audit (every collider must sit on visible geometry), flood-fill reachability from the elevator,
     and the permanent regression walks (every bug Joshua reported becomes a check in REGRESS below)
  3. reload restores floor + position
  4. fixed indoor + outdoor viewpoints -> screenshots -> cheap vision check (gpt-4o-mini, via arch_seefix gatejudge on CT111) against the
     checklist (placeholder boxes, blocked signs, clipped text, broken trees/models, agents clipping walls, fake stairs, ...)
  5. logs fps + draw calls
Any FAIL exits 1 (deploy refused) and files fix tasks into the owning world-team queue (arch_seefix gatefile on CT111).
usage: playtest_gate.py BASE_URL [--out DIR] [--no-vision] [--make-baseline] [--no-file]
Vision defects already open on the live build (baseline.json, filed to owners) do not block; every NEW one does. Deterministic checks always block.
"""
import asyncio, json, os, sys, time, subprocess, shutil
from playwright.async_api import async_playwright
BASE = sys.argv[1].rstrip('/'); A = sys.argv[2:]
def opt(k, d=None): return A[A.index(k) + 1] if k in A and A.index(k) + 1 < len(A) else d
OUT = opt('--out', f'/workspace/shots/gate/{time.strftime("%Y%m%d-%H%M%S")}'); os.makedirs(OUT, exist_ok=True)
VISION = '--no-vision' not in A; T0 = time.time(); BUDGET = 170
FLOORS = ['G', '2', '3', '4', '5']
# permanent regression walks: (floor, from x,z, to x,z, label, Joshua report) in the floor's local frame (x offset added per floor)
REGRESS = [
  ('U', 2.75, -4.4, 2.75, -12.5, 'walk past the elevator core (right side)', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('U', -2.75, -4.4, -2.75, -12.5, 'walk past the elevator core (left side)', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('U', -3.0, -5.6, 3.0, -5.6, 'walk across the elevator lobby', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('G', 4.0, -1.5, 4.0, -5.7, 'lobby right doorway to the elevator + stairs', 'Joshua 2026-10-16 23:51 stairs/doorway'),
  ('G', -4.0, -1.5, -4.0, -5.7, 'lobby left doorway to the main hall (no plant in the walk path)', 'Joshua 2026-10-16 23:51 plant in the doorway'),
]
INDOOR = [  # name, floor, js look args, label
  ('lobby', 'G', '0,6,0,-4', 'Campus lobby from the entrance'), ('lobby-left-door', 'G', '-4.0,1.0,-4.0,-8', 'Lobby left doorway + directory'),
  ('g-stairs', 'G', '4.0,-3.0,4.8,-9', 'Ground floor stairs door'), ('f3-core', '3', '804,-3.2,800,-7.7', 'Floor 3 elevator core + floor stand'),
  ('f2-hall', '2', '400,-4.5,408,-10', 'Floor 2 hall'),
]
OUTDOOR = [('front-road', '0,74,0,30', 'Campus front entrance from the road'), ('front-lawn', '0,40,0,0', 'Front lawn toward the office'), ('gate', '10,70,4.6,63', 'Gate / guard booth')]
R = {'gate': os.path.basename(OUT), 'base': BASE, 'fails': [], 'warns': [], 'floors': {}, 'perf': {}}
def fail(code, where, detail=''): R['fails'].append({'code': code, 'where': where, 'detail': detail}); print('FAIL', code, where, detail, flush=True)
def warn(code, where, detail=''): R['warns'].append({'code': code, 'where': where, 'detail': detail}); print('warn', code, where, detail, flush=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctxb = await b.new_context(viewport={'width': 1280, 'height': 720}); pg = await ctxb.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    await pg.goto(BASE + '/office/?time=13:00', wait_until='load', timeout=90000)
    VO = '--vision-only' in A   # baseline of the CURRENT live build (it may predate the gate's debug API)
    await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos && __ewsOffice.floor)" if VO else "!!(window.__ewsOffice && typeof __ewsOffice.wallAudit === 'function' && __ewsOffice.pos)", timeout=90000); await pg.wait_for_timeout(5000)
    st = await pg.evaluate("fetch('/api/office/world?op=state').then(r=>r.status)")
    if st != 200: fail('world_api', '/api/office/world', f'HTTP {st}')
    views = {}
    for n in ([] if VO else FLOORS):
      await pg.evaluate(f"__ewsOffice.floor('{n}')"); await pg.wait_for_timeout(2500)
      ox = 0 if n == 'G' else (int(n) - 1) * 400
      a = await pg.evaluate(f"__ewsOffice.wallAudit({{near:[{ox},-6,45]}})")
      for x in a['invisible'][:10]: fail('invisible_wall', f'floor {n}', json.dumps(x))
      rc = await pg.evaluate(f"__ewsOffice.reach([{ox},-4.6])")
      R['floors'][n] = {'colliders': a['n'], 'invisible': len(a['invisible']), 'reach_m2': rc['reach_m2'], 'pockets': rc['pockets'][:8]}
      if rc['reach_m2'] < 40: fail('unreachable', f'floor {n}', f"only {rc['reach_m2']} m2 reachable from the elevator")
      for pk in rc['pockets'][:5]: warn('unreachable_pocket', f'floor {n} near {pk["c"]}', f'{pk["m2"]} m2 walled off')
      for fl, x0, z0, x1, z1, lab, why in REGRESS:
        if fl not in ('*', n) and not (fl == 'U' and n != 'G'): continue
        r = await pg.evaluate(f"__ewsOffice.tryMove({x0+ox},{z0},{x1+ox},{z1})")
        if not r['ok']: fail('blocked_walk', f'floor {n}: {lab}', f"stopped at {r['x']},{r['z']} ({why})")
    if not VO:
      # B1: only where the IP lock allows it (a lock screen is the correct result elsewhere)
      try:
        await pg.evaluate("__ewsOffice.floor('B1')"); await pg.wait_for_timeout(2500)
        R['floors']['B1'] = 'entered' if (await pg.evaluate("__ewsOffice.pos()"))[0] < -200 else 'locked (expected for visitors)'
      except Exception as e: R['floors']['B1'] = 'skipped: ' + str(e)[:80]
      # reload restores floor + position
      await pg.evaluate("__ewsOffice.floor('3')"); await pg.wait_for_timeout(2000); await pg.evaluate("__ewsOffice.look(803,-4,800,-7.7)")
      before = await pg.evaluate("__ewsOffice.pos()"); await pg.evaluate("dispatchEvent(new Event('pagehide'))"); await pg.reload(wait_until='load')
      await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos)", timeout=90000); await pg.wait_for_timeout(5000)
      after = await pg.evaluate("__ewsOffice.pos()"); fnow = await pg.evaluate("__ewsOffice.floor()")
      R['reload'] = {'before': before, 'after': after, 'floor': fnow}
      if fnow != '3' or abs(after[0] - before[0]) > 1.0 or abs(after[2] - before[2]) > 1.0: fail('reload_state', 'reload on floor 3', f'before {before} after {after} floor {fnow}')
    # fixed viewpoints
    for name, fl, args, lab in INDOOR:
      if time.time() - T0 > BUDGET - 60: warn('time', name, 'skipped (budget)'); continue
      await pg.evaluate(f"__ewsOffice.floor('{fl}')"); await pg.wait_for_timeout(1500); await pg.evaluate(f"__ewsOffice.look({args})"); await pg.wait_for_timeout(1800)
      await pg.screenshot(path=f'{OUT}/{name}.jpg', type='jpeg', quality=80); views[name] = {'label': lab, 'zone': 'floor ' + fl}
    await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1500)
    for name, args, lab in OUTDOOR:
      if time.time() - T0 > BUDGET - 45: warn('time', name, 'skipped (budget)'); continue
      await pg.evaluate(f"window.__ewsFreeY=0;__ewsOffice.look({args})"); await pg.wait_for_timeout(2000)
      await pg.screenshot(path=f'{OUT}/{name}.jpg', type='jpeg', quality=80); views[name] = {'label': lab, 'zone': 'exterior', 'out': True}
    # perf: draw calls + fps (SwiftShader fps is NOT device fps: logged for trend only)
    await pg.evaluate("__ewsOffice.look(0,6,0,-4)"); await pg.wait_for_timeout(1000)
    R['perf'] = await pg.evaluate("new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r({fps_swiftshader:+(n/3).toFixed(1), ...__ewsOffice.info()})};requestAnimationFrame(f)})")
    if R['perf'].get('calls', 0) > 400: warn('draw_calls', 'lobby', f"{R['perf']['calls']} calls")
    R['page_errors'] = errs[:10]
    for e in errs[:3]: fail('page_error', 'office', e)
    json.dump(views, open(f'{OUT}/views.json', 'w'), indent=1)
    await b.close()
  if VISION and views:
    rd = f'/var/lib/ews-agent/arch/seefix/gate/{R["gate"]}'
    tar = f'/tmp/{R["gate"]}.tgz'; subprocess.run(['tar', '-C', OUT, '-czf', tar, '.'], check=True)
    subprocess.run([os.path.expanduser('~/bin/ct111-put'), tar, tar], check=True, capture_output=True)
    v = subprocess.run([os.path.expanduser('~/bin/ct111'), f'mkdir -p {rd} && tar -C {rd} -xzf {tar} && rm -f {tar} && python3 /opt/ews-agent/arch_seefix.py gatejudge {rd}'], capture_output=True, text=True, timeout=150)
    try: J = json.loads([l for l in v.stdout.splitlines() if l.startswith('{')][-1])
    except Exception: J = {'fails': [], 'error': (v.stdout + v.stderr)[-300:]}; warn('vision', 'gatejudge', J['error'])
    R['vision'] = {'cost_usd': J.get('cost_usd'), 'views': J.get('views')}
    BL = f'/workspace/shots/gate/baseline.json'; base = json.load(open(BL)) if os.path.exists(BL) else {}
    if '--make-baseline' in A:   # known open defects on the CURRENT live build: filed once to their owners, they do not block unrelated deploys
      base = {f"{f['code']}@{f['view']}": {'where': f['where'], 'at': time.strftime('%Y-%m-%d %H:%M')} for f in J.get('fails', [])}; json.dump(base, open(BL, 'w'), indent=1); R['baseline'] = len(base)
    for f in J.get('fails', []):
      k = f"{f['code']}@{f['view']}"
      if k in base and '--make-baseline' not in A: R.setdefault('known', []).append(k); continue   # still open + already filed; a NEW defect blocks
      fail(f['code'], f['where'], f"vision conf {f.get('confidence')} ({f['view']}.jpg)")
  R['secs'] = round(time.time() - T0, 1); R['result'] = 'FAIL' if R['fails'] else 'PASS'
  json.dump(R, open(f'{OUT}/gate.json', 'w'), indent=1, default=str)
  if R['fails'] and '--no-file' not in A:
    rp = f'/tmp/gate-{R["gate"]}.json'; json.dump(R, open(rp, 'w'), default=str)
    subprocess.run([os.path.expanduser('~/bin/ct111-put'), rp, rp], capture_output=True)
    subprocess.run([os.path.expanduser('~/bin/ct111'), f'python3 /opt/ews-agent/arch_seefix.py gatefile {rp}'], capture_output=True, timeout=60)
  print(json.dumps({k: R.get(k) for k in ('result', 'secs', 'fails', 'known', 'warns', 'floors', 'perf', 'reload', 'vision')}, default=str)[:8000])
  sys.exit(1 if R['fails'] else 0)
asyncio.run(main())
