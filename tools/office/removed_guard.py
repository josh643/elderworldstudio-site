#!/usr/bin/env python3
"""Removed-items guard (run by tools/deploy-staging.sh before every upload).
Things Joshua had removed must not come back through a stale tree, a merge or a copy-paste. Each rule names the file and the
pattern that must stay absent. Exit 1 = refuse to deploy. Add a rule whenever something is removed on purpose.
Mirror of the check the architecture see-fix loop runs against live staging (code removed_item_reappeared)."""
import json, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2] / 'site' / 'office'
RULES = [
    # 2026-10-16/17 (Joshua): the Arcade is not in the campus building; it gets its own town lot (world lot 11 'Elder Arcade').
    ('arcade-in-campus', 'modules.json', lambda t: any(m.get('id') == 'game-showrooms' for m in json.loads(t)['modules']), 'game-showrooms module registered'),
    ('arcade-in-campus', 'core/floors.js', lambda t: re.search(r"^\s*(if \([^)]*\)\s*)?buildArcade\(ctx", t, re.M), 'Floor 2 buildArcade() called'),
    ('arcade-in-campus', 'modules/wayfinding/index.js', lambda t: 'Play the arcade here' in t, "lobby kiosk says 'Play the arcade here'"),
    # 2026-10-17 (Joshua 11:51 PM): no fake stairs (flat stepped boxes with no way up) beside the elevator core
    ('fake-stairs', 'modules/receptionist/index.js', lambda t: re.search(r"for \(let k = 0; k < 10; k\+\+\) box\(1\.2, 0\.18", t), 'fake 10-riser stair blocks by the core'),
    # 2026-10-17 00:24 (Joshua): 'leased' toasts for sites that are not leased
    ('false-lease-toast', 'modules/world-live/index.js', lambda t: "'leased · surveyors on site'" in t and "e.leased === true ? 'leased · surveyors on site'" not in t, "toast says 'leased' without e.leased === true"),
    # 2026-10-17 00:32 (Joshua): invisible wall by the elevator core = NaN floor offset for B1 in the tablets pedestal collider
    ('nan-collider', 'modules/tablets/index.js', lambda t: "const ox = n === 'G' ? 0 : (+n - 1) * 400," in t, 'pedestal floor offset computed without the B1/finite guard'),
    ('nan-collider', 'core/engine.js', lambda t: 'dropped non-finite collider' not in t, 'engine no longer drops non-finite colliders'),
]
bad = []
for rid, f, hit, what in RULES:
    p = ROOT / f
    if p.exists() and hit(p.read_text()): bad.append(f'{rid}: {what} ({f})')
if bad:
    print('removed_guard: REFUSING TO DEPLOY, removed items came back:\n  ' + '\n  '.join(bad)); sys.exit(1)
print(f'removed_guard: OK ({len(RULES)} rules)')
