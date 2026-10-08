#!/bin/bash
# Deploy site/ to Cloudflare Pages (project elderworldstudio). Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env.
# Apache/GitHub-only files (.htaccess, .nojekyll) are left out of the Cloudflare upload.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build.py
rm -rf /tmp/ews-cf-deploy && mkdir -p /tmp/ews-cf-deploy
tar -C site --exclude=.htaccess --exclude=.nojekyll -cf - . | tar -C /tmp/ews-cf-deploy -xf -
npx -y wrangler@3 pages deploy /tmp/ews-cf-deploy --project-name elderworldstudio --branch main --commit-dirty=true
