#!/usr/bin/env python3
"""Write site/office/manifest.json for the live-update module (2026-10-16).
code   = one hash over every office code/data file (js, json, css, html, wasm) outside assets/ -> changed = deferred idle reload.
assets = per-file content hash for everything under site/office/assets/ -> changed = swapped in place, no reload."""
import hashlib, json, os, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site', 'office'); root = os.path.normpath(root)
code, assets = hashlib.sha256(), {}
for d, _, fs in sorted(os.walk(root)):
    for f in sorted(fs):
        p = os.path.join(d, f); rel = os.path.relpath(p, root)
        if rel == 'manifest.json': continue
        if rel.startswith('assets' + os.sep):
            assets[os.path.relpath(p, os.path.join(root, 'assets')).replace(os.sep, '/')] = hashlib.sha256(open(p, 'rb').read()).hexdigest()[:10]
        elif f.rsplit('.', 1)[-1] in ('js', 'json', 'css', 'html', 'wasm', 'mjs'):
            code.update(rel.encode()); code.update(hashlib.sha256(open(p, 'rb').read()).digest())
out = {'v': 1, 'code': code.hexdigest()[:12], 'assets': assets}
json.dump(out, open(os.path.join(root, 'manifest.json'), 'w'), separators=(',', ':'))
print('office manifest: code', out['code'], 'assets', len(assets))
