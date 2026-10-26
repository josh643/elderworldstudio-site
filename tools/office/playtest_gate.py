#!/usr/bin/env python3
"""Pre-deploy playtest gate, BASELINE-DIFF edition (Joshua HARD RULE 2026-10-17 00:33: "The team is supposed to catch and fix everything").
tools/deploy-staging.sh uploads the build to a PREVIEW alias (branch playtest), runs this bot on it AND on the currently-live build
(office-3d) in the same run, and promotes only when the candidate adds nothing new.

Why baseline-diff (2026-10-17 morning): the first gate failed every candidate on defects that were ALREADY on live staging (opaque dome,
placeholder booth, clipped signs; 74-86 open punch items), so fixes could never ship. A deploy may not make things worse; it does not
have to fix every open item. Pre-existing defects are logged as DEBT (debt.json, filed once to the owning world-team queue).

BLOCKS (exit 1):
  - every Joshua-reported regression walk (REGRESS) and the reload check fail on the candidate (always: a candidate may never reintroduce them)
  - world API not 200
  - invisible walls / unreachable floors: any on the candidate that the last promoted deterministic baseline did not have
    (no baseline yet -> absolute: 0 invisible walls, >= 40 m2 reachable); reachable area shrinking > 10 % vs that baseline
  - page errors not seen on live
  - performance: the candidate must measure >= 45 fps on an identified pve-mini-3070 GPU, must not regress >15% vs live, draw calls > live*1.15+10, triangles > live*1.25
  - vision (gpt-4o-mini, gatejudge on CT111, each hit already double-confirmed): a candidate hit is NEW (blocks) unless
      a) the same view looks unchanged vs live (mean pixel diff < SAME_PX), or
      b) the live judge in this run, or a targeted re-check of the live shot for that code, shows the same code at that view, or
      c) the code@view is in the reviewed ledger baseline.json, or a single-object code (dome_opaque) is already known in that zone, or
      d) a fresh candidate re-shoot (20 s settle) does not reproduce it (transient greeting bubble/toast/agent; logged as warn)
    -> half-built / placeholder geometry introduced by the candidate still blocks.
usage: playtest_gate.py CANDIDATE_URL [--live URL] [--out DIR] [--state-dir DIR] [--no-vision] [--no-file] [--make-baseline]
"""
import asyncio, json, os, sys, time, subprocess
from playwright.async_api import async_playwright
try:
  from .gate_rules import MIN_FPS, VISUAL_RULES, http_error, is_pve_mini_3070, meets_perf_floor, missing_views
except ImportError:  # direct execution: Python puts tools/office on sys.path
  from gate_rules import MIN_FPS, VISUAL_RULES, http_error, is_pve_mini_3070, meets_perf_floor, missing_views
BASE = sys.argv[1].rstrip('/'); A = sys.argv[2:]
def opt(k, d=None): return A[A.index(k) + 1] if k in A and A.index(k) + 1 < len(A) else d
LIVE = opt('--live', 'https://office-3d.elderworldstudio.pages.dev').rstrip('/')
GD = opt('--state-dir', '/workspace/shots/gate').rstrip('/')
OUT = opt('--out', f'{GD}/{time.strftime("%Y%m%d-%H%M%S")}'); os.makedirs(OUT + '/live', exist_ok=True)
os.makedirs(GD, exist_ok=True)
DET_BL = f'{GD}/det-baseline.json'; LEDGER = f'{GD}/baseline.json'; DEBT = f'{GD}/debt.json'
VISION = '--no-vision' not in A; BUDGET = 170; SAME_PX = 4.0
# Passed to the vision judge with every view so Joshua's visual rules stay part of
# each pre-deploy review, including exterior trees, lamps, and poles.
VISUAL_RULES = ('stylized-realistic look', 'no billboard trees', 'no bare poles',
                'real lamps', 'nothing floating', 'no pointless animation')
# codes that name ONE specific object (there is one campus dome): already-known anywhere in the same zone = the same defect, even from another viewpoint
UNIQUE_OBJ = {'dome_opaque'}
FLOORS = ['G', '2', '3', '4', '5']
# permanent regression walks: (floor, from x,z, to x,z, label, Joshua report) in the floor's local frame (x offset added per floor)
REGRESS = [
  ('U', 2.75, -4.4, 2.75, -12.5, 'walk past the elevator core (right side)', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('U', -2.75, -4.4, -2.75, -12.5, 'walk past the elevator core (left side)', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('U', -3.0, -5.6, 3.0, -5.6, 'walk across the elevator lobby', 'Joshua 2026-10-17 00:32 invisible wall beside the elevator core'),
  ('G', 4.0, -1.5, 4.0, -5.7, 'lobby right doorway to the elevator + stairs', 'Joshua 2026-10-16 23:51 stairs/doorway'),
  ('G', -4.0, -1.5, -4.0, -5.7, 'lobby left doorway to the main hall (no plant in the walk path)', 'Joshua 2026-10-16 23:51 plant in the doorway'),
]
# Joshua-reported page-level regressions (string probes on the candidate's own code; a candidate that brings one back blocks)
REGRESS_JS = [   # (js -> true when the bug is BACK, label, Joshua report); fetch-based so they also run on older live builds
  ("fetch('/office/modules.json',{cache:'no-store'}).then(r=>r.text()).then(t=>t.includes('game-showrooms'))", 'arcade/game-showrooms back in the campus lobby', 'Joshua 2026-10-16 arcade out of the campus'),
  ("fetch('/office/modules/world-live/index.js',{cache:'no-store'}).then(r=>r.text()).then(t=>t.includes(\"si === 0 ? 'leased · surveyors on site'\"))", "fake 'leased · surveyors on site' toast for every survey site", 'Joshua 2026-10-17 00:24 fake Lot 73 lease toasts'),
]
INDOOR = [  # name, floor, js look args, label
  ('lobby', 'G', '0,6,0,-4', 'Campus lobby from the entrance'), ('lobby-left-door', 'G', '-4.0,1.0,-4.0,-8', 'Lobby left doorway + directory'),
  ('g-stairs', 'G', '4.0,-3.0,4.8,-9', 'Ground floor stairs door'), ('f3-core', '3', '804,-3.2,800,-7.7', 'Floor 3 elevator core + floor stand'),
  ('f2-hall', '2', '400,-4.5,408,-10', 'Floor 2 hall'),
]
OUTDOOR = [('front-road', '0,74,0,30', 'Campus front entrance from the road'), ('front-lawn', '0,40,0,0', 'Front lawn toward the office'), ('gate', '10,70,4.6,63', 'Gate / guard booth')]
REQUIRED_VIEWS = tuple(v[0] for v in INDOOR) + tuple(v[0] for v in OUTDOOR)
R = {'gate': os.path.basename(OUT), 'base': BASE, 'live': LIVE, 'mode': 'baseline-diff', 'fails': [], 'warns': [], 'debt': [], 'floors': {}, 'perf': {}}
def fail(code, where, detail=''): R['fails'].append({'code': code, 'where': where, 'detail': detail}); print('FAIL', code, where, detail, flush=True)
def warn(code, where, detail=''): R['warns'].append({'code': code, 'where': where, 'detail': detail}); print('warn', code, where, detail, flush=True)
def jl(p, d): 
  try: return json.load(open(p))
  except Exception: return d

async def walk(b, url, out, full):
  """One walkthrough. full=False -> screenshots + perf + errors only (live builds may predate the debug API)."""
  T0 = time.time(); W = {'url': url, 'det': [], 'floors': {}, 'regress': {}, 'views': {}, 'errs': [], 'http_errors': [], 'api': False, 'world_status': None, 'perf': {}}
  ctxb = await b.new_context(viewport={'width': 1280, 'height': 720}); pg = await ctxb.new_page()
  pg.on('pageerror', lambda e: W['errs'].append(str(e)[:200]))
  def record_response(response):
    req = response.request
    item = http_error(response.status, response.url, req.method, req.resource_type)
    if item and item not in W['http_errors']: W['http_errors'].append(item)
  pg.on('response', record_response)
  try:
    response = await pg.goto(url + '/office/?time=13:00', wait_until='load', timeout=90000)
    if response:
      item = http_error(response.status, response.url, response.request.method, response.request.resource_type)
      if item and item not in W['http_errors']: W['http_errors'].append(item)
      if response.status >= 400:
        W['walk_error'] = f"office page returned HTTP {response.status}"
        W['secs'] = round(time.time() - T0, 1)
        await ctxb.close()
        return W
    await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos && __ewsOffice.floor && __ewsOffice.look)", timeout=90000)
  except Exception as e:
    W['walk_error'] = f"office page/bootstrap failed: {type(e).__name__}: {str(e)[:160]}"
    W['secs'] = round(time.time() - T0, 1)
    await ctxb.close()
    return W
  await pg.wait_for_timeout(5000)
  W['api'] = await pg.evaluate("typeof __ewsOffice.wallAudit === 'function' && typeof __ewsOffice.tryMove === 'function'")
  full = full and W['api']
  W['world_status'] = await pg.evaluate("fetch('/api/office/world?op=state').then(r=>r.status)")
  for js, lab, why in REGRESS_JS:
    try: W['regress'][lab] = not await pg.evaluate(js)
    except Exception as e: W['regress'][lab] = 'probe error: ' + str(e)[:80]
  for n in (FLOORS if full else []):
    await pg.evaluate(f"__ewsOffice.floor('{n}')"); await pg.wait_for_timeout(2500)
    ox = 0 if n == 'G' else (int(n) - 1) * 400
    a = await pg.evaluate(f"__ewsOffice.wallAudit({{near:[{ox},-6,45]}})")
    rc = await pg.evaluate(f"__ewsOffice.reach([{ox},-4.6])")
    W['floors'][n] = {'colliders': a['n'], 'invisible': [json.dumps(x, sort_keys=True) for x in a['invisible'][:20]], 'reach_m2': rc['reach_m2'], 'pockets': rc['pockets'][:8]}
    for fl, x0, z0, x1, z1, lab, why in REGRESS:
      if fl not in ('*', n) and not (fl == 'U' and n != 'G'): continue
      r = await pg.evaluate(f"__ewsOffice.tryMove({x0+ox},{z0},{x1+ox},{z1})")
      W['regress'][f'floor {n}: {lab}'] = r['ok'] or f"stopped at {r['x']},{r['z']} ({why})"
  if full:
    try:
      await pg.evaluate("__ewsOffice.floor('B1')"); await pg.wait_for_timeout(2500)
      W['floors']['B1'] = 'entered' if (await pg.evaluate("__ewsOffice.pos()"))[0] < -200 else 'locked (expected for visitors)'
    except Exception as e: W['floors']['B1'] = 'skipped: ' + str(e)[:80]
    await pg.evaluate("__ewsOffice.floor('3')"); await pg.wait_for_timeout(2000); await pg.evaluate("__ewsOffice.look(803,-4,800,-7.7)")
    before = await pg.evaluate("__ewsOffice.pos()"); await pg.evaluate("dispatchEvent(new Event('pagehide'))"); await pg.reload(wait_until='load')
    await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos)", timeout=90000); await pg.wait_for_timeout(5000)
    after = await pg.evaluate("__ewsOffice.pos()"); fnow = await pg.evaluate("__ewsOffice.floor()")
    W['reload'] = {'before': before, 'after': after, 'floor': fnow, 'ok': not (fnow != '3' or abs(after[0] - before[0]) > 1.0 or abs(after[2] - before[2]) > 1.0)}
  for name, fl, args, lab in INDOOR:
    if time.time() - T0 > BUDGET - 60: W['skipped'] = W.get('skipped', []) + [name]; continue
    await pg.evaluate(f"__ewsOffice.floor('{fl}')"); await pg.wait_for_timeout(1500); await pg.evaluate(f"__ewsOffice.look({args})"); await pg.wait_for_timeout(1800)
    await pg.screenshot(path=f'{out}/{name}.jpg', type='jpeg', quality=80); W['views'][name] = {'label': lab + '; visual rules: ' + ', '.join(VISUAL_RULES), 'zone': 'floor ' + fl, 'checks': list(VISUAL_RULES)}
  await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1500)
  for name, args, lab in OUTDOOR:
    if time.time() - T0 > BUDGET - 45: W['skipped'] = W.get('skipped', []) + [name]; continue
    await pg.evaluate(f"window.__ewsFreeY=0;__ewsOffice.look({args})"); await pg.wait_for_timeout(2000)
    await pg.screenshot(path=f'{out}/{name}.jpg', type='jpeg', quality=80); W['views'][name] = {'label': lab + '; visual rules: ' + ', '.join(VISUAL_RULES), 'zone': 'exterior', 'out': True, 'checks': list(VISUAL_RULES)}
  await pg.evaluate("__ewsOffice.look(0,6,0,-4)"); await pg.wait_for_timeout(1500)
  W['perf'] = await pg.evaluate("new Promise(async resolve=>{const samples=[];for(let s=0;s<3;s++){let n=0,t0=performance.now();await new Promise(done=>{const f=()=>{n++;if(performance.now()-t0<4000)requestAnimationFrame(f);else done()};requestAnimationFrame(f)});samples.push(+(n/4).toFixed(2))}const sorted=[...samples].sort((a,b)=>a-b),c=document.querySelector('canvas'),gl=c&&(c.getContext('webgl2')||c.getContext('webgl')),ext=gl&&gl.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'';resolve({fps:sorted[1],fps_samples:samples,gpu_renderer:String(gpu),...(__ewsOffice.info?__ewsOffice.info():{})})})")
  json.dump(W['views'], open(f'{out}/views.json', 'w'), indent=1); W['secs'] = round(time.time() - T0, 1)
  await ctxb.close(); return W

async def reshoot(url, names, out):
  """Fresh page, 20 s settle (greeting bubbles/toasts gone), re-shoot only the views with an unclear NEW vision hit."""
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = await (await b.new_context(viewport={'width': 1280, 'height': 720})).new_page()
    await pg.goto(url + '/office/?time=13:00', wait_until='load', timeout=90000)
    await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos && __ewsOffice.floor && __ewsOffice.look)", timeout=90000); await pg.wait_for_timeout(20000)
    for name, fl, args, lab in INDOOR:
      if name not in names: continue
      await pg.evaluate(f"__ewsOffice.floor('{fl}')"); await pg.wait_for_timeout(1500); await pg.evaluate(f"__ewsOffice.look({args})"); await pg.wait_for_timeout(4000)
      await pg.screenshot(path=f'{out}/{name}__cand.jpg', type='jpeg', quality=80)
    await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1500)
    for name, args, lab in OUTDOOR:
      if name not in names: continue
      await pg.evaluate(f"window.__ewsFreeY=0;__ewsOffice.look({args})"); await pg.wait_for_timeout(4000)
      await pg.screenshot(path=f'{out}/{name}__cand.jpg', type='jpeg', quality=80)
    await b.close()

def judge(d, gid):
  """Ship a shot dir to CT111 and run the cheap vision judge (gatejudge, double-confirmed hits)."""
  rd = f'/var/lib/ews-agent/arch/seefix/gate/{gid}'; tar = f'/tmp/{gid}.tgz'
  try:
    subprocess.run(['tar', '-C', d, '--exclude=live', '-czf', tar, '.'], check=True, capture_output=True)
    subprocess.run([os.path.expanduser('~/bin/ct111-put'), tar, tar], check=True, capture_output=True)
    v = subprocess.run([os.path.expanduser('~/bin/ct111'), f'mkdir -p {rd} && tar -C {rd} -xzf {tar} && rm -f {tar} && python3 /opt/ews-agent/arch_seefix.py gatejudge {rd}'], capture_output=True, text=True, timeout=330)
  except subprocess.TimeoutExpired:
    warn('vision', gid, 'vision transfer or gatejudge timed out'); return None
  except (OSError, subprocess.CalledProcessError) as e:
    warn('vision', gid, f'vision judge unavailable: {str(e)[:180]}'); return None
  try: return json.loads([l for l in v.stdout.splitlines() if l.startswith('{')][-1])
  except Exception: warn('vision', gid, (v.stdout + v.stderr)[-300:]); return None

def pxdiff(a, b):
  try:
    from PIL import Image, ImageChops, ImageStat
    x = Image.open(a).convert('L').resize((320, 180)); y = Image.open(b).convert('L').resize((320, 180))
    return round(sum(ImageStat.Stat(ImageChops.difference(x, y)).mean), 2)
  except Exception: return None

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    L = await walk(b, LIVE, OUT + '/live', full=True)    # baseline = what visitors have right now
    C = await walk(b, BASE, OUT, full=True)
    await b.close()
  R['candidate_walk'] = {k: C[k] for k in ('secs', 'api', 'world_status', 'regress', 'reload', 'skipped', 'walk_error') if k in C}
  R['live_walk'] = {k: L[k] for k in ('secs', 'api', 'world_status', 'regress', 'reload', 'skipped', 'walk_error') if k in L}
  R['candidate_walk']['http_errors'] = C['http_errors']
  R['live_walk']['http_errors'] = L['http_errors']
  R['floors'] = C['floors']; R['perf'] = {'candidate': C['perf'], 'live': L['perf']}
  # A response error must never be interpreted as a missing regression. This
  # also catches bad module/assets routes and HTTP 404s from API probes.
  for e in C['http_errors']:
    fail('http_error', e['url'], f"HTTP {e['status']} ({e['method']} {e['type']})")
  for e in L['http_errors']:
    fail('http_error_live', e['url'], f"live HTTP {e['status']} ({e['method']} {e['type']})")
  for name, walk_result in (('candidate', C), ('live', L)):
    missing = missing_views(REQUIRED_VIEWS, walk_result['views'])
    if missing:
      fail('visual_coverage', name, 'missing required screenshots: ' + ', '.join(missing))
  if C.get('walk_error'): fail('walk_error', 'candidate', C['walk_error'])
  if L.get('walk_error'): fail('live_walk_error', 'live', L['walk_error'])
  if not C['api']: fail('debug_api', 'candidate', 'playtest helpers (wallAudit/reach/tryMove) missing: the gate cannot verify this build')
  if C['world_status'] != 200: fail('world_api', '/api/office/world', f"HTTP {C['world_status']}")
  # Joshua-reported regressions: absolute on the candidate
  for lab, ok in C['regress'].items():
    if ok is not True: fail('blocked_walk' if lab.startswith('floor') else 'regression', lab, ok if isinstance(ok, str) else 'reintroduced')
  if C.get('reload') and not C['reload']['ok']: fail('reload_state', 'reload on floor 3', json.dumps(C['reload']))
  # deterministic geometry vs last promoted baseline (live may predate the helpers)
  DB = jl(DET_BL, {}).get('floors') or ({k: v for k, v in L['floors'].items() if isinstance(v, dict)} if L['api'] else {})
  for n, f in C['floors'].items():
    if not isinstance(f, dict): continue
    old = DB.get(n) or {}; oldinv = set(old.get('invisible', []))
    new = [x for x in f['invisible'] if x not in oldinv]
    for x in new[:10]: fail('invisible_wall', f'floor {n}', x)
    for x in [x for x in f['invisible'] if x in oldinv]: R['debt'].append({'code': 'invisible_wall', 'where': f'floor {n}', 'detail': x})
    if f['reach_m2'] < 40: fail('unreachable', f'floor {n}', f"only {f['reach_m2']} m2 reachable from the elevator")
    if old.get('reach_m2') and f['reach_m2'] < 0.9 * old['reach_m2']: fail('reach_regressed', f'floor {n}', f"{f['reach_m2']} m2 vs {old['reach_m2']} m2 before")
    for pk in f['pockets'][:5]: warn('unreachable_pocket', f'floor {n} near {pk["c"]}', f'{pk["m2"]} m2 walled off')
  # page errors: only new ones
  le = set(L['errs'])
  for e in [e for e in C['errs'] if e not in le][:3]: fail('page_error', 'office (new vs live)', e)
  for e in [e for e in C['errs'] if e in le][:3]: R['debt'].append({'code': 'page_error', 'where': 'office', 'detail': e})
  # perf: not worse than live (same box, back-to-back)
  cp, lp = C['perf'], L['perf']
  if not is_pve_mini_3070(cp.get('gpu_renderer')):
    fail('fps_tier_unverified', 'lobby', f"GPU renderer {cp.get('gpu_renderer') or 'unknown'}; >= {MIN_FPS:g} FPS must be measured on the pve-mini-3070 tier")
  elif not meets_perf_floor(cp.get('fps')):
    fail('fps_floor', 'lobby', f"{cp.get('fps')} fps; pve-mini-3070 requires >= {MIN_FPS:g} fps")
  if lp.get('fps') and cp.get('fps', 0) < 0.85 * lp['fps']: fail('fps_regressed', 'lobby', f"{cp.get('fps')} vs live {lp['fps']} fps (same renderer)")
  if lp.get('calls') and cp.get('calls', 0) > lp['calls'] * 1.15 + 10: fail('draw_calls_regressed', 'lobby', f"{cp.get('calls')} vs live {lp['calls']}")
  if lp.get('tris') and cp.get('tris', 0) > lp['tris'] * 1.25: fail('tris_regressed', 'lobby', f"{cp.get('tris')} vs live {lp['tris']}")
  if cp.get('calls', 0) > 400: warn('draw_calls', 'lobby', f"{cp['calls']} calls")
  # vision: candidate vs live
  R['view_diff'] = {v: pxdiff(f'{OUT}/{v}.jpg', f'{OUT}/live/{v}.jpg') for v in C['views'] if v in L['views']}
  if VISION and C['views']:
    JC = judge(OUT, 'gate-' + R['gate']); JL = judge(OUT + '/live', 'gate-' + R['gate'] + '-live') if JC and JC.get('fails') else {'fails': [], 'cost_usd': 0}
    if JC is None: fail('vision_unavailable', 'gatejudge', 'candidate shots could not be judged (gate stays strict)')
    else:
      JL = JL or {'fails': [], 'cost_usd': 0}
      ledger = jl(LEDGER, {}); live_hits = {f"{f['code']}@{f['view']}" for f in JL.get('fails', [])}
      R['vision'] = {'cost_usd': round((JC.get('cost_usd') or 0) + (JL.get('cost_usd') or 0), 5), 'candidate': JC.get('views'), 'live_hits': sorted(live_hits)}
      unclear = []
      for f in JC.get('fails', []):
        k = f"{f['code']}@{f['view']}"; d = R['view_diff'].get(f['view'])
        zone = (C['views'].get(f['view']) or {}).get('zone'); known_zone = {kk.split('@')[0] for kk in list(live_hits) + list(ledger) if (C['views'].get(kk.split('@')[-1]) or L['views'].get(kk.split('@')[-1]) or {}).get('zone') == zone}
        why = 'unchanged view vs live (px diff %s)' % d if d is not None and d < SAME_PX else 'also on live (this run)' if k in live_hits else 'ledger baseline.json' if k in ledger else \
              f'same single object already known in {zone} (ledger/live)' if f['code'] in UNIQUE_OBJ and f['code'] in known_zone else None
        if why: R['debt'].append({'code': f['code'], 'where': f['where'], 'view': f['view'], 'why': why, 'file': f.get('file')}); continue
        unclear.append(f)
      if unclear:   # targeted second look: LIVE shot (is it pre-existing?) + a fresh CANDIDATE re-shoot (is it persistent, not a transient bubble/toast?)
        sub = OUT + '/recheck'; os.makedirs(sub, exist_ok=True); vm = {}
        try: await reshoot(BASE, {f['view'] for f in unclear}, sub)
        except Exception as e: warn('reshoot', 'candidate', str(e)[:120])
        for f in unclear:
          for src, nm in ((f'{OUT}/live/{f["view"]}.jpg', f['view']), (f'{sub}/{f["view"]}__cand.jpg', f['view'] + '__cand')):
            if not os.path.exists(src): continue
            if src.startswith(OUT + '/live'): subprocess.run(['cp', src, f'{sub}/{nm}.jpg'])
            m = vm.setdefault(nm, dict(C['views'][f['view']], codes=[])); m['codes'].append(f['code'])
        json.dump(vm, open(f'{sub}/views.json', 'w'))
        JR = judge(sub, 'gate-' + R['gate'] + '-recheck') if vm else None
        rh = {f"{x['code']}@{x['view']}" for x in (JR or {}).get('fails', [])}
        if JR: R['vision']['cost_usd'] = round(R['vision']['cost_usd'] + (JR.get('cost_usd') or 0), 5); R['vision']['recheck'] = sorted(rh)
        for f in unclear:
          k = f"{f['code']}@{f['view']}"
          if k in rh: R['debt'].append({'code': f['code'], 'where': f['where'], 'view': f['view'], 'why': 'live re-check shows it too', 'file': f.get('file')}); continue
          if JR is not None and os.path.exists(f'{sub}/{f["view"]}__cand.jpg') and f"{f['code']}@{f['view']}__cand" not in rh:
            warn('vision_transient', f['where'], f"{f['code']} not reproduced on a fresh candidate re-shoot ({f['view']}__cand.jpg): transient (bubble/toast/agent), not blocking"); continue
          fail(f['code'], f['where'], f"NEW vs live: vision conf {f.get('confidence')} ({f['view']}.jpg, px diff {R['view_diff'].get(f['view'])})")
      if '--make-baseline' in A:
        json.dump({**ledger, **{f"{x['code']}@{x['view']}": {'where': x['where'], 'at': time.strftime('%Y-%m-%d %H:%M')} for x in JL.get('fails', [])}}, open(LEDGER, 'w'), indent=1)
  elif C['views']:
    fail('visual_unchecked', 'vision', 'vision checks were disabled; Joshua visual rules cannot be verified')
  R['result'] = 'FAIL' if R['fails'] else 'PASS'
  # debt ledger (pre-existing, non-blocking); filed once to the world-team queues
  D = jl(DEBT, {}); newdebt = []
  for x in R['debt']:
    k = f"{x['code']}@{x.get('view') or x['where']}"
    if k not in D: D[k] = {'first_seen': time.strftime('%Y-%m-%d %H:%M'), 'where': x['where'], 'gate': R['gate']}; newdebt.append(dict(x, view=x.get('view', x['where'])))
    D[k].update(last_seen=time.strftime('%Y-%m-%d %H:%M'), seen=D[k].get('seen', 0) + 1)
  json.dump(D, open(DEBT, 'w'), indent=1)
  if R['result'] == 'PASS' and C['api']:   # this candidate becomes the deterministic baseline once it is promoted (deploy script copies it)
    json.dump({'gate': R['gate'], 'floors': C['floors'], 'perf': C['perf']}, open(f'{OUT}/det-candidate.json', 'w'), indent=1)
  json.dump(R, open(f'{OUT}/gate.json', 'w'), indent=1, default=str)
  tofile = R['fails'] + [dict(x, code=x['code']) for x in newdebt]
  if tofile and '--no-file' not in A:
    rp = f'/tmp/gate-{R["gate"]}.json'; json.dump(dict(R, fails=tofile), open(rp, 'w'), default=str)
    subprocess.run([os.path.expanduser('~/bin/ct111-put'), rp, rp], capture_output=True)
    subprocess.run([os.path.expanduser('~/bin/ct111'), f'python3 /opt/ews-agent/arch_seefix.py gatefile {rp}'], capture_output=True, timeout=60)
  print(json.dumps({k: R.get(k) for k in ('result', 'fails', 'debt', 'warns', 'perf', 'view_diff', 'candidate_walk', 'live_walk', 'vision')}, default=str)[:9000])
  sys.exit(1 if R['fails'] else 0)
asyncio.run(main())
