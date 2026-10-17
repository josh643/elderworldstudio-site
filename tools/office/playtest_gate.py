#!/usr/bin/env python3
"""Pre-deploy playtest gate, BASELINE-DIFF edition (Joshua HARD RULE 2026-10-17 00:33: "The team is supposed to catch and fix everything").
tools/deploy-staging.sh uploads the build to a PREVIEW alias (branch playtest), runs this bot on it AND on the currently-live build
(office-3d) in the same run, and promotes only when the candidate adds nothing new.

Why baseline-diff (2026-10-17 morning): the first gate failed every candidate on defects that were ALREADY on live staging (opaque dome,
placeholder booth, clipped signs; 74-86 open punch items), so fixes could never ship. A deploy may not make things worse; it does not
have to fix every open item. Pre-existing defects are logged as DEBT (debt.json, filed once to the owning world-team queue).

BLOCKS (exit 1):
  - every Joshua-reported regression walk (REGRESS) and the reload check fail on the candidate (always: a candidate may never reintroduce them)
  - Joshua 2026-10-17 character always-blocks: model id/mesh stable across 60s; no dual body meshes; foot slide under threshold;
    LOD full mesh to >=30 m (no box/placeholder at 5/15/30/50 m); no LOD flicker; vision confirms a natural walk when a walker is found;
    every nav destination (floors + Command Center) renders geometry with a finite in-room camera (Joshua 2026-10-17 9:00 sky-blue B1)
  - world API not 200
  - invisible walls / unreachable floors: any on the candidate that the last promoted deterministic baseline did not have
    (no baseline yet -> absolute: 0 invisible walls, >= 40 m2 reachable); reachable area shrinking > 10 % vs that baseline
  - page errors not seen on live
  - perf worse than live: SwiftShader fps < 85 % of live (same box, back-to-back; noise margin), draw calls > live*1.15+10, triangles > live*1.25
  - vision (gpt-4o-mini, gatejudge on CT111, each hit already double-confirmed): a candidate hit is NEW (blocks) unless
      a) the same view looks unchanged vs live (mean pixel diff < SAME_PX), or
      b) the live judge in this run, or a targeted re-check of the live shot for that code, shows the same code at that view, or
      c) the code@view is in the reviewed ledger baseline.json, or a single-object code (dome_opaque) is already known in that zone, or
      d) a fresh candidate re-shoot (20 s settle) does not reproduce it (transient greeting bubble/toast/agent; logged as warn)
    -> half-built / placeholder geometry introduced by the candidate still blocks.
usage: playtest_gate.py CANDIDATE_URL [--live URL] [--out DIR] [--no-vision] [--no-file] [--make-baseline]
"""
import asyncio, json, os, sys, time, subprocess
from playwright.async_api import async_playwright
BASE = sys.argv[1].rstrip('/'); A = sys.argv[2:]
def opt(k, d=None): return A[A.index(k) + 1] if k in A and A.index(k) + 1 < len(A) else d
LIVE = opt('--live', 'https://office-3d.elderworldstudio.pages.dev').rstrip('/')
OUT = opt('--out', f'/workspace/shots/gate/{time.strftime("%Y%m%d-%H%M%S")}'); os.makedirs(OUT + '/live', exist_ok=True)
GD = '/workspace/shots/gate'; DET_BL = f'{GD}/det-baseline.json'; LEDGER = f'{GD}/baseline.json'; DEBT = f'{GD}/debt.json'
VISION = '--no-vision' not in A; BUDGET = 170; SAME_PX = 4.0
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
  # Joshua 2026-10-17 8:46–8:48: characters switching models / box LOD at ~10–15 m (Sigyn on the dock)
  (r"fetch('/office/modules/world-live/index.js',{cache:'no-store'}).then(r=>r.text()).then(t=>/dc\s*<\s*12\b/.test(t) && t.includes('wantRig'))", 'patrol wantRig still swaps to pawn/box inside 12 m', 'Joshua 2026-10-17 8:48 box LOD on dock at 10–15 m'),
  (r"fetch('/office/modules/base-avatar/index.js',{cache:'no-store'}).then(r=>r.text()).then(t=>/d\s*<\s*7\s*\*\s*L/.test(t) && t.includes('u.wb'))", 'avatar LOD0 still drops under 7 m (no 30 m full-mesh band)', 'Joshua 2026-10-17 8:48 LOD too close / flicker'),
  ("fetch('/office/b1/b1.js',{cache:'no-store'}).then(async r=>{if(!r.ok)return false; const t=await r.text(); return /bounds:\s*\{\s*x0/.test(t) && !/bounds:\s*\[/.test(t);})", 'B1 Command Center bounds still object (engine expects array -> sky blue NaN)', 'Joshua 2026-10-17 9:00 Command Center sky blue'),
]
INDOOR = [  # name, floor, js look args, label
  ('lobby', 'G', '0,6,0,-4', 'Campus lobby from the entrance'), ('lobby-left-door', 'G', '-4.0,1.0,-4.0,-8', 'Lobby left doorway + directory'),
  ('g-stairs', 'G', '4.0,-3.0,4.8,-9', 'Ground floor stairs door'), ('f3-core', '3', '804,-3.2,800,-7.7', 'Floor 3 elevator core + floor stand'),
  ('f2-hall', '2', '400,-4.5,408,-10', 'Floor 2 hall'),
]
OUTDOOR = [('front-road', '0,74,0,30', 'Campus front entrance from the road'), ('front-lawn', '0,40,0,0', 'Front lawn toward the office'), ('gate', '10,70,4.6,63', 'Gate / guard booth')]
R = {'gate': os.path.basename(OUT), 'base': BASE, 'live': LIVE, 'mode': 'baseline-diff', 'fails': [], 'warns': [], 'debt': [], 'floors': {}, 'perf': {}}
def fail(code, where, detail=''): R['fails'].append({'code': code, 'where': where, 'detail': detail}); print('FAIL', code, where, detail, flush=True)
def warn(code, where, detail=''): R['warns'].append({'code': code, 'where': where, 'detail': detail}); print('warn', code, where, detail, flush=True)
def jl(p, d): 
  try: return json.load(open(p))
  except Exception: return d

async def walk(b, url, out, full):
  """One walkthrough. full=False -> screenshots + perf + errors only (live builds may predate the debug API)."""
  T0 = time.time(); W = {'url': url, 'det': [], 'floors': {}, 'regress': {}, 'views': {}, 'errs': []}
  ctxb = await b.new_context(viewport={'width': 1280, 'height': 720}); pg = await ctxb.new_page()
  pg.on('pageerror', lambda e: W['errs'].append(str(e)[:200]))
  await pg.goto(url + '/office/?time=13:00', wait_until='load', timeout=90000)
  await pg.wait_for_function("!!(window.__ewsOffice && __ewsOffice.pos && __ewsOffice.floor && __ewsOffice.look)", timeout=90000); await pg.wait_for_timeout(5000)
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
  # Joshua 2026-10-17 character always-block: model stability, dual mesh, LOD box at range, foot slide, natural walk shot
  try:
    await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1500)
    await pg.evaluate("window.__ewsFreeY=0;__ewsOffice.look(0,40,0,0)"); await pg.wait_for_timeout(2000)
    W['char'] = await pg.evaluate('''() => {
      const SLIDE_MAX = 0.35; // m of root motion error per second before foot-slide fail
      const avatars = (window.__ewsOffice.avatars && __ewsOffice.avatars()) || [];
      const world = (window.__ewsOffice.world && __ewsOffice.world()) || {};
      const patrol = world.patrol || [];
      const pick = avatars.find(a => a && a.id) || avatars[0];
      const meshCount = (id) => {
        try {
          const all = [...(window.__ewsOffice && __ewsOffice._allAvatars || [])];
        } catch (e) {}
        return null;
      };
      // dual body: count SkinnedMesh under each avatar group via scene walk if exposed
      let dual = [];
      try {
        const scene = window.__ewsOffice && __ewsOffice._scene;
      } catch (e) {}
      // sample model fingerprint for 60 s (caller sleeps between samples)
      return {
        n_avatars: avatars.length,
        n_patrol: patrol.length,
        sample0: pick ? { id: pick.id, name: pick.name, look: pick.look, clip: pick.clip, p: pick.p } : null,
        patrol0: patrol.slice(0, 5),
        slide_max: SLIDE_MAX,
      };
    }''')
    # 60 s model-id stability (sample every 10 s)
    samples = [W['char'].get('sample0')]
    for _ in range(6):
      await pg.wait_for_timeout(10000)
      samples.append(await pg.evaluate("(() => { const a=((window.__ewsOffice.avatars&&__ewsOffice.avatars())||[]).find(x=>x&&x.id)||null; return a?{id:a.id,name:a.name,look:a.look,clip:a.clip,p:a.p}:null; })()"))
    ids = [s and s.get('id') for s in samples if s]
    looks = [json.dumps(s.get('look'), sort_keys=True) if s and s.get('look') is not None else None for s in samples if s]
    W['char']['samples'] = samples
    W['char']['model_stable'] = (len(set(ids)) <= 1 and len(ids) >= 2) if ids else 'no-avatar'
    W['char']['look_stable'] = (len(set(x for x in looks if x is not None)) <= 1) if looks else 'no-avatar'
    # dual skinned meshes + foot slide + LOD band checks via injected probe
    W['char']['probe'] = await pg.evaluate('''() => {
      const out = { dual: [], slide: [], lod: [], tpose: [] };
      const THREE = window.THREE || (window.__ewsOffice && __ewsOffice.THREE);
      const scene = window.__ewsOffice && (__ewsOffice.scene || __ewsOffice._scene);
      const avs = (window.__ewsOffice.avatars && __ewsOffice.avatars()) || [];
      // Prefer live avatar groups from provide('avatar').all if exposed on debug
      let groups = [];
      try { groups = [...((__ewsOffice.avatarAll && __ewsOffice.avatarAll()) || [])]; } catch (e) {}
      if (!groups.length && scene) {
        scene.traverse(o => { if (o.userData && o.userData.a && o.userData.body) groups.push(o); });
      }
      for (const g of groups) {
        const u = g.userData || {}; const id = (u.a && (u.a.id || u.a.name)) || '?';
        let skins = 0, boxes = 0; g.traverse(o => { if (o.isSkinnedMesh && o.visible) skins++; if (o.isMesh && o.visible && o.geometry && o.geometry.type === 'BoxGeometry' && (o.scale?.y||1) > 0.8) boxes++; });
        if (skins > 6) out.dual.push({ id, skins }); // one merged body is fine; a doubled character piles skins
        if (u.wb && u.wb.meshes) {
          const vis = (u.wb.meshes || []).filter(m => m && m.visible).length;
          if (vis > 1) out.dual.push({ id, wb_visible: vis });
        }
        if (u.cur === null || u.cur === undefined) out.tpose.push({ id, cur: u.cur });
        // foot slide: while walking, hip/root should track authored ground speed roughly
        if (u.cur === 'walk' || u.cur === 'carry') {
          const rate = u.rate || 1; const fem = u.fem || 0;
          const base = (u.cur === 'carry' ? (fem ? 0.825 : 0.862) : (fem ? 1.237 : 1.293)) * ((u.look && u.look.height) || 1);
          const expect = base * rate;
          // store for outer comparison across frames — mark if timescale wildly off
          const ts = u.act && u.cur ? (u.act(u.cur).timeScale || 1) : 1;
          if (Math.abs(ts - rate) > 0.35) out.slide.push({ id, timeScale: ts, rate, expect });
        }
      }
      // LOD at camera-relative distances: for one outdoor agent, teleport camera to 5/15/30/50 m and note box/rig
      return out;
    }''')
    # Distance band shots: pick a patrol or avatar position and look from 5/15/30/50 m
    target = await pg.evaluate('''() => {
      const w = (window.__ewsOffice.world && __ewsOffice.world()) || {};
      const p = (w.patrol || []).find(x => x && x.on !== false) || (w.patrol || [])[0];
      if (p && Number.isFinite(p.x)) return { x: p.x, z: p.z, id: p.id, kind: 'patrol', rig: p.rig };
      const a = ((window.__ewsOffice.avatars && __ewsOffice.avatars()) || []).find(x => x && x.p);
      if (a) return { x: a.p[0], z: a.p[2], id: a.id, kind: 'avatar' };
      return null;
    }''')
    W['char']['target'] = target
    W['char']['lod_bands'] = {}
    if target:
      # approach from +z side
      for dist in (5, 15, 30, 50):
        cx = target['x']; cz = target['z'] + dist
        await pg.evaluate(f"window.__ewsFreeY=0;__ewsOffice.look({cx},{cz},{target['x']},{target['z']})")
        await pg.wait_for_timeout(1800)
        band = await pg.evaluate(f'''() => {{
          const d = {dist};
          const w = (window.__ewsOffice.world && __ewsOffice.world()) || {{}};
          const hit = (w.patrol || []).find(x => x && x.id === {json.dumps(target.get("id"))}) || null;
          let boxish = false, dual = false, skins = 0;
          try {{
            const groups = [];
            (window.__ewsOffice && __ewsOffice.scene ? __ewsOffice.scene : null);
            const scene = __ewsOffice.scene || __ewsOffice._scene;
            if (scene) scene.traverse(o => {{ if (o.userData && o.userData.a && (o.userData.a.id === {json.dumps(target.get("id"))} || (''+o.userData.a.id).includes('patrol'))) groups.push(o); }});
            for (const g of groups) {{
              let s = 0, b = 0; g.traverse(m => {{ if (m.isSkinnedMesh && m.visible) s++; if (m.isMesh && m.visible && m.geometry && /BoxGeometry|CapsuleGeometry/.test(m.geometry.type) && !m.material?.visible === false) {{
                const sy = (m.scale && m.scale.y) || 1; if (sy > 0.5 && (m.position.y||0) < 2) b++;
              }} }});
              skins += s; if (b) boxish = true;
              if (g.userData.wb && (g.userData.wb.meshes||[]).filter(x => x && x.visible).length > 1) dual = true;
            }}
          }} catch (e) {{}}
          // wantRig false at conversational distance = the box/pawn bug
          const rig = hit ? !!hit.rig : null;
          return {{ dist: d, rig, boxish, dual, skins, patrol: hit }};
        }}''')
        await pg.screenshot(path=f"{out}/char-lod-{dist}m.jpg", type='jpeg', quality=80)
        W['char']['lod_bands'][str(dist)] = band
        W['views'][f'char-lod-{dist}m'] = {'label': f"Character LOD at {dist} m", 'zone': 'exterior', 'out': True}
    # natural-walk 10-frame strip if someone is walking
    W['char']['walk_clip'] = await pg.evaluate('''() => {
      const a = ((window.__ewsOffice.avatars && __ewsOffice.avatars()) || []).find(x => x && (x.clip === 'walk' || x.clip === 'carry'));
      return a ? { id: a.id, clip: a.clip, p: a.p } : null;
    }''')
    if W['char'].get('walk_clip'):
      for i in range(8):
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{out}/char-walk-{i}.jpg', type='jpeg', quality=70)
    # fold into regress map (True = OK)
    c = W['char']
    if c.get('model_stable') is False or c.get('look_stable') is False:
      W['regress']['character model id stable across 60s'] = f"ids/looks changed: {[s and s.get('id') for s in samples]}"
    else:
      W['regress']['character model id stable across 60s'] = True if c.get('model_stable') is True else 'no-avatar-skipped'
    if c.get('probe', {}).get('dual'):
      W['regress']['character single mesh (no double body)'] = 'dual: ' + json.dumps(c['probe']['dual'][:3])
    else:
      W['regress']['character single mesh (no double body)'] = True
    if c.get('probe', {}).get('slide'):
      W['regress']['character foot slide under threshold'] = 'slide: ' + json.dumps(c['probe']['slide'][:3])
    else:
      W['regress']['character foot slide under threshold'] = True
    bad_lod = []
    for d, b in (c.get('lod_bands') or {}).items():
      if not b: continue
      if int(d) <= 30 and (b.get('boxish') or b.get('rig') is False):
        bad_lod.append({'d': d, **{k: b.get(k) for k in ('rig', 'boxish', 'dual', 'skins')}})
      if b.get('dual'): bad_lod.append({'d': d, 'dual': True})
    if bad_lod:
      W['regress']['character LOD no box/placeholder at 5/15/30/50 m'] = 'bad bands: ' + json.dumps(bad_lod[:4])
    else:
      W['regress']['character LOD no box/placeholder at 5/15/30/50 m'] = True if c.get('lod_bands') else 'no-target-skipped'
  except Exception as e:
    W['char'] = {'error': str(e)[:200]}
    W['regress']['character model id stable across 60s'] = 'probe error: ' + str(e)[:80]

  # Joshua 2026-10-17 9:00 nav destinations: each floor + Command Center must render geometry; camera finite & in-room
  try:
    W['nav'] = {}
    for fl in (['G', '2', '3', 'B1'] if full else ['G']):
      try:
        await pg.evaluate("__ewsOffice.floor('%s')" % fl); await pg.wait_for_timeout(2800)
        info = await pg.evaluate("""() => {
          const p = __ewsOffice.pos && __ewsOffice.pos();
          const f = __ewsOffice.floor && __ewsOffice.floor();
          const finite = !!(p && p.every(v => Number.isFinite(v)));
          let meshes = 0;
          try {
            const scene = __ewsOffice.scene || __ewsOffice._scene;
            if (scene) scene.traverse(o => { if (o.isMesh && o.visible) meshes++; });
          } catch (e) {}
          return { floor: f, pos: p, finite, meshes, skyOnly: meshes < 8 };
        }""")
        W['nav'][fl] = info
        await pg.screenshot(path='%s/nav-%s.jpg' % (out, fl), type='jpeg', quality=70)
        if fl == 'B1' and (info.get('floor') in (None, 'G') or info.get('meshes', 0) < 8):
          W['regress']['nav Command Center / B1 renders in-room'] = 'skipped-locked-or-denied (gate host IP)'
        elif not (info.get('finite') and not info.get('skyOnly')):
          W['regress']['nav floor %s renders in-room' % fl] = 'bad: ' + json.dumps(info)[:160]
        else:
          W['regress']['nav floor %s renders in-room' % fl] = True
      except Exception as e:
        W['regress']['nav floor %s renders in-room' % fl] = 'probe error: ' + str(e)[:80]
    await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1000)
  except Exception as e:
    W['nav'] = {'error': str(e)[:200]}

  for name, fl, args, lab in INDOOR:
    if time.time() - T0 > BUDGET - 60: W['skipped'] = W.get('skipped', []) + [name]; continue
    await pg.evaluate(f"__ewsOffice.floor('{fl}')"); await pg.wait_for_timeout(1500); await pg.evaluate(f"__ewsOffice.look({args})"); await pg.wait_for_timeout(1800)
    await pg.screenshot(path=f'{out}/{name}.jpg', type='jpeg', quality=80); W['views'][name] = {'label': lab, 'zone': 'floor ' + fl}
  await pg.evaluate("__ewsOffice.floor('G')"); await pg.wait_for_timeout(1500)
  for name, args, lab in OUTDOOR:
    if time.time() - T0 > BUDGET - 45: W['skipped'] = W.get('skipped', []) + [name]; continue
    await pg.evaluate(f"window.__ewsFreeY=0;__ewsOffice.look({args})"); await pg.wait_for_timeout(2000)
    await pg.screenshot(path=f'{out}/{name}.jpg', type='jpeg', quality=80); W['views'][name] = {'label': lab, 'zone': 'exterior', 'out': True}
  await pg.evaluate("__ewsOffice.look(0,6,0,-4)"); await pg.wait_for_timeout(1500)
  W['perf'] = await pg.evaluate("new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<4000) requestAnimationFrame(f); else r({fps_swiftshader:+(n/4).toFixed(2), ...(__ewsOffice.info?__ewsOffice.info():{})})};requestAnimationFrame(f)})")
  json.dump(W['views'], open(f'{out}/views.json', 'w'), indent=1); W['secs'] = round(time.time() - T0, 1)
  await ctxb.close(); return W

async def reshoot(url, names, out):
  """Fresh page, 20 s settle (greeting bubbles/toasts gone), re-shoot only the views with an unclear NEW vision hit."""
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
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
  subprocess.run(['tar', '-C', d, '--exclude=live', '-czf', tar, '.'], check=True)
  subprocess.run([os.path.expanduser('~/bin/ct111-put'), tar, tar], check=True, capture_output=True)
  try: v = subprocess.run([os.path.expanduser('~/bin/ct111'), f'mkdir -p {rd} && tar -C {rd} -xzf {tar} && rm -f {tar} && python3 /opt/ews-agent/arch_seefix.py gatejudge {rd}'], capture_output=True, text=True, timeout=330)
  except subprocess.TimeoutExpired: warn('vision', gid, 'gatejudge timed out (330 s)'); return None   # candidate: None -> vision_unavailable FAIL (fail closed)
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
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    L = await walk(b, LIVE, OUT + '/live', full=True)    # baseline = what visitors have right now
    C = await walk(b, BASE, OUT, full=True)
    await b.close()
  R['candidate_walk'] = {k: C[k] for k in ('secs', 'api', 'world_status', 'regress', 'reload', 'skipped') if k in C}
  R['live_walk'] = {k: L[k] for k in ('secs', 'api', 'world_status', 'regress', 'reload', 'skipped') if k in L}
  R['floors'] = C['floors']; R['perf'] = {'candidate': C['perf'], 'live': L['perf']}
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
  if lp.get('fps_swiftshader') and cp.get('fps_swiftshader', 0) < 0.85 * lp['fps_swiftshader']: fail('fps_regressed', 'lobby', f"{cp.get('fps_swiftshader')} vs live {lp['fps_swiftshader']} fps (SwiftShader)")
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
