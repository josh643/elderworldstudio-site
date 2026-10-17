#!/usr/bin/env python3
"""Write site/office/manifest.json for the live-update module (2026-10-16).
code    = one hash over every office code/data file outside assets/ and modules/ (core engine, vendor, data) -> changed = soft reload when idle or when the visitor leaves.
modules = per-module hash of site/office/modules/<id>/ -> changed = hot-swapped in place if that module supports dispose(), else soft reload.
assets = per-file content hash for everything under site/office/assets/ -> changed = swapped in place, no reload."""
import hashlib, json, os, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site', 'office'); root = os.path.normpath(root)
code, assets, mods = hashlib.sha256(), {}, {}
for d, _, fs in sorted(os.walk(root)):
    for f in sorted(fs):
        p = os.path.join(d, f); rel = os.path.relpath(p, root)
        if rel == 'manifest.json': continue
        if rel.startswith('assets' + os.sep):
            assets[os.path.relpath(p, os.path.join(root, 'assets')).replace(os.sep, '/')] = hashlib.sha256(open(p, 'rb').read()).hexdigest()[:10]
        elif rel.startswith('modules' + os.sep) and rel.count(os.sep) >= 2:
            mid = rel.split(os.sep)[1]; h = mods.setdefault(mid, hashlib.sha256()); h.update(rel.encode()); h.update(hashlib.sha256(open(p, 'rb').read()).digest())
        elif f.rsplit('.', 1)[-1] in ('js', 'json', 'css', 'html', 'wasm', 'mjs'):
            code.update(rel.encode()); code.update(hashlib.sha256(open(p, 'rb').read()).digest())
out = {'v': 2, 'code': code.hexdigest()[:12], 'modules': {k: h.hexdigest()[:10] for k, h in sorted(mods.items())}, 'assets': assets}
json.dump(out, open(os.path.join(root, 'manifest.json'), 'w'), separators=(',', ':'))
print('office manifest: code', out['code'], 'modules', len(out['modules']), 'assets', len(assets))
