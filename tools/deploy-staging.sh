#!/bin/bash
# Deploy site/ to Cloudflare Pages (project elderworldstudio). Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env.
# Apache/GitHub-only files (.htaccess, .nojekyll) are left out of the Cloudflare upload.
set -euo pipefail
# Falls back to the box env names (CF_API_TOKEN / CF_ACCOUNT_ID) if the wrangler names are unset
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}" CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
cd "$(dirname "$0")/.."
python3 tools/office/removed_guard.py   # removed items (arcade in campus, fake stairs, ...) must not come back via a stale tree
python3 tools/build.py
python3 tools/office/manifest.py   # live-update manifest: asset hashes swap in place, code hash -> deferred idle reload
rm -rf /tmp/ews-cf-deploy && mkdir -p /tmp/ews-cf-deploy
tar -C site --exclude=.htaccess --exclude=.nojekyll -cf - . | tar -C /tmp/ews-cf-deploy -xf -
# wrangler caches under the nearest node_modules; a root-owned /node_modules on the box breaks that, so keep a local one
mkdir -p node_modules
# PRE-DEPLOY PLAYTEST GATE (Joshua HARD RULE 2026-10-17 00:33): upload to the preview alias first, playtest it headless, promote only on PASS.
# Any FAIL refuses the deploy and files fix tasks (tools/office/playtest_gate.py). No bypass flag.
npx -y wrangler@3 pages deploy /tmp/ews-cf-deploy --project-name elderworldstudio --branch playtest --commit-dirty=true
PY=/workspace/.venv-gate/bin/python; [ -x "$PY" ] || PY=/workspace/avatar-office/.venv/bin/python   # needs playwright (python3 -m venv /workspace/.venv-gate && /workspace/.venv-gate/bin/pip install playwright)
sleep 6
if ! timeout 240 "$PY" tools/office/playtest_gate.py https://playtest.elderworldstudio.pages.dev; then
  echo 'playtest gate: FAIL -> staging deploy REFUSED (fix tasks filed; see /workspace/shots/gate/<run>/gate.json)'; exit 1
fi
echo 'playtest gate: PASS -> promoting to office-3d'
npx -y wrangler@3 pages deploy /tmp/ews-cf-deploy --project-name elderworldstudio --branch office-3d --commit-dirty=true
# hot updates: tell every connected visitor that modules/assets changed (world DO 'release' broadcast). The office key stays on CT111.
REL=$(python3 -c "import json;m=json.load(open('site/office/manifest.json'));print(json.dumps({'code':m['code'],'modules':m.get('modules',{}),'assets':len(m['assets'])}))")
sleep 8   # let the new deployment propagate before clients refetch the manifest
~/bin/ct111 "set -a; . /etc/ews-agent/office.env; curl -s -m 15 -XPOST https://office-3d.elderworldstudio.pages.dev/api/office/world-release -H \"authorization: Bearer \$OFFICE_INGEST_KEY\" -H 'content-type: application/json' -d '$REL'" || echo 'release broadcast failed (clients still pick it up on the 5-min poll)'
