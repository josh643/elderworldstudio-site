#!/usr/bin/env python3
"""Builder progress for architecture jobs in the Elderverse live world (box side, 2026-10-16).
The architecture feeder (CT111 ews-arch-world) moves a job to 'foundation done' when Ve passes the spec. As the BUILDER really
builds it, report each real milestone here so visitors watch it go up in step with the work (never ahead of it):
  python3 tools/office/world_job.py arcade --stage framing --progress 0.5     # half the frame/massing is built in the module
  python3 tools/office/world_job.py arcade --stage walls                      # walls done locally ... signage, landscaping
  python3 tools/office/world_job.py ground-floor --overall 0.7
  python3 tools/office/world_job.py arcade --stage open                       # deployed to staging (verified)
Jobs: arcade = lot 11 (Elder Arcade, District 1 L06), ground-floor = zone ground-floor. Monotonic unless --force.
Key: /home/box/secrets/ews-world/world-key (WORLD_SERVER_KEY, staging). Target: office-3d staging."""
import argparse, json, urllib.request
BASE = 'https://office-3d.elderworldstudio.pages.dev'
JOBS = {'arcade': ('site', 11), 'ground-floor': ('zone', 'ground-floor')}
BUILD = ['survey', 'groundwork', 'foundation', 'framing', 'walls', 'glazing', 'signage', 'landscaping', 'open']
ap = argparse.ArgumentParser(); ap.add_argument('job', choices=list(JOBS)); ap.add_argument('--stage', choices=BUILD); ap.add_argument('--progress', type=float, default=0.0)
ap.add_argument('--overall', type=float); ap.add_argument('--force', action='store_true'); ap.add_argument('--base', default=BASE); a = ap.parse_args()
key = open('/home/box/secrets/ews-world/world-key').read().strip()
o = a.overall if a.overall is not None else (1.0 if a.stage == 'open' else (BUILD.index(a.stage) + max(0.0, min(1.0, a.progress))) / 8 if a.stage else None)
if o is None: raise SystemExit('give --stage or --overall')
kind, ref = JOBS[a.job]; eid = f'lot:{ref}' if kind == 'site' else f'zone:{ref}'
snap = json.load(urllib.request.urlopen(a.base + '/api/office/world', timeout=15)); cur = next((e for e in snap['ents'] if e['id'] == eid), None)
if not cur: raise SystemExit(f'{eid} is not in the world yet (the architecture feeder creates it when the spec is planned)')
have = (cur['si'] + cur['p']) / 8
if o < have - 1e-3 and not a.force: raise SystemExit(f'not lowering {eid}: world has {have:.3f}, you sent {o:.3f} (use --force for real rework)')
ev = {'type': 'site.progress', 'lot': ref, 'overall': o} if kind == 'site' else {'type': 'zone.progress', 'id': ref, 'overall': o}
req = urllib.request.Request(a.base + '/api/office/world-event', data=json.dumps(ev).encode(), method='POST', headers={'authorization': 'Bearer ' + key, 'content-type': 'application/json'})
print(json.load(urllib.request.urlopen(req, timeout=15)), eid, f'{have:.3f} -> {o:.3f}')
