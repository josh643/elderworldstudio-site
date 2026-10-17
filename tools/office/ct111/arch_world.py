#!/usr/bin/env python3
"""Architecture jobs -> Elderverse live world (CT111, 2026-10-16). READ-ONLY on the architecture team's files.
Every 10 s: read /var/lib/ews-agent/arch/{queue,queue/done,log.jsonl}, map each known job (area) to a world entity (a town lot
building or a work zone) and post its REAL design-phase progress to the staging world DO (/api/office/world-event, OFFICE_INGEST_KEY):
  queued/started (lead-arch step)  -> survey      (architects walk out, stakes go in)
  arch-building step               -> ground prep
  arch-landscape step              -> ground prep done
  Ve QA PASS (spec approved)       -> foundation done = 3/8, "awaiting builder"
The build phase (framing..open) is posted by the BUILDER as it really builds (box: tools/office/world_job.py). This feeder never
lowers progress that is already in the world (monotonic), never invents a timer, and only posts on change (+10 min re-assert).
Jobs: JOBS below, overridable/extendable with /etc/ews-agent/arch_world.json {area: {...}}. Stop: systemctl disable --now ews-arch-world."""
import json, os, glob, time, hashlib, urllib.request
CFG = dict(l.strip().split('=', 1) for l in open('/etc/ews-agent/office.env') if '=' in l and not l.startswith('#'))
URL, KEY = CFG['OFFICE_URL'].rstrip('/'), CFG['OFFICE_INGEST_KEY']
A = '/var/lib/ews-agent/arch'
JOBS = {
  'district-1-arcade-lot': {'kind': 'site', 'lot': 11, 'tenant': 'Elder Arcade', 'style': {'floors': 2, 'color': 'teal', 'kind': 'gallery'}},
  'campus-ground-floor': {'kind': 'zone', 'id': 'ground-floor', 'name': 'Ground floor rebuild', 'rect': [-12, -18, 12, 0], 'floor': 'G'},
}
STEP = {'lead-arch': 1 / 8, 'arch-building': 1.5 / 8, 'arch-landscape': 2 / 8}
def call(method, path, body=None):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'authorization': f'Bearer {KEY}', 'content-type': 'application/json', 'user-agent': 'ews-arch-world/1'})
    with urllib.request.urlopen(req, timeout=15) as r: return json.load(r)
def jobs():
    j = dict(JOBS)
    try: j.update(json.load(open('/etc/ews-agent/arch_world.json')))
    except Exception: pass
    return j
def progress():
    """area -> overall design progress (0..3/8) from the team's own queue + log."""
    out, plan_area = {}, {}
    for f in glob.glob(f'{A}/queue/*.json'):
        try: q = json.load(open(f)); out[q.get('area')] = max(out.get(q.get('area'), 0), 0.02)
        except Exception: pass
    for f in glob.glob(f'{A}/queue/done/*.json'):
        try: q = json.load(open(f)); r = os.path.basename(q.get('result') or ''); plan_area[r] = q.get('area')
        except Exception: pass
    try: lines = open(f'{A}/log.jsonl').read().splitlines()[-4000:]
    except Exception: lines = []
    for l in lines:
        try: ev = json.loads(l)
        except Exception: continue
        p = ev.get('plan'); area = plan_area.get(p) or next((a for a in jobs() if p and p.endswith(a)), None)
        if not area: continue
        v = STEP.get(ev.get('role'), 0)
        if ev.get('verdict') == 'PASS': v = 3 / 8
        out[area] = max(out.get(area, 0), v)
    return out
def current():
    try: s = call('GET', '/api/office/world'); return {e['id']: e for e in s.get('ents', [])}
    except Exception: return None
def overall(e): n = 6 if e.get('kind') == 'road' else 8; return (e.get('si', 0) + e.get('p', 0)) / n
last, last_t = None, 0
def tick():
    global last, last_t
    prog, cur, evs = progress(), current(), []
    if cur is None: return
    for area, j in jobs().items():
        o = prog.get(area)
        if o is None: continue
        if j['kind'] == 'site':
            eid = f"lot:{j['lot']}"; have = cur.get(eid)
            if not have or not have.get('arch'): evs.append({'type': 'lot.lease', 'lot': j['lot'], 'tenant': j.get('tenant', ''), 'public': True, 'arch': True, 'job': area, 'style': j.get('style', {}), 'overall': o})
            elif o > overall(have) + 1e-3: evs.append({'type': 'site.progress', 'lot': j['lot'], 'overall': o})
        else:
            eid = f"zone:{j['id']}"; have = cur.get(eid)
            if not have: evs.append({'type': 'zone.upsert', 'id': j['id'], 'name': j['name'], 'rect': j['rect'], 'floor': j.get('floor', 'G'), 'arch': True, 'overall': o})
            elif o > overall(have) + 1e-3: evs.append({'type': 'zone.progress', 'id': j['id'], 'overall': o})
    h = hashlib.sha1(json.dumps(evs, sort_keys=True).encode()).hexdigest()
    if evs and (h != last or time.time() - last_t > 600):
        r = call('POST', '/api/office/world-event', evs); print(time.strftime('%H:%M:%S'), 'posted', len(evs), r, flush=True); last, last_t = h, time.time()
if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['once']: print(progress()); tick(); raise SystemExit
    while True:
        try: tick()
        except Exception as e: print('arch_world error:', type(e).__name__, str(e)[:200], flush=True)
        time.sleep(10)
