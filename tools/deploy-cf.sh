#!/bin/bash
# Deploy site/ to Cloudflare Pages (project elderworldstudio). Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env.
# Apache/GitHub-only files (.htaccess, .nojekyll) are left out of the Cloudflare upload.
set -euo pipefail
# Falls back to the box env names (CF_API_TOKEN / CF_ACCOUNT_ID) if the wrangler names are unset
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}" CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
cd "$(dirname "$0")/.."
python3 tools/build.py
rm -rf /tmp/ews-cf-deploy && mkdir -p /tmp/ews-cf-deploy
tar -C site --exclude=.htaccess --exclude=.nojekyll -cf - . | tar -C /tmp/ews-cf-deploy -xf -
# wrangler caches under the nearest node_modules; a root-owned /node_modules on the box breaks that, so keep a local one
mkdir -p node_modules
npx -y wrangler@3 pages deploy /tmp/ews-cf-deploy --project-name elderworldstudio --branch main --commit-dirty=true
