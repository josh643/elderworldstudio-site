#!/bin/bash
# Export opt-in builder sessions as JSONL (prompt / spec / feedback triples) for fine-tuning or few-shot examples.
# Usage: tools/export-training.sh [out.jsonl] [--local]. Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail; cd "$(dirname "$0")/.."; OUT="${1:-training-$(date +%F).jsonl}"; WHERE="--remote"; [ "${2:-}" = --local ] && WHERE="--local"
npx -y wrangler@3 d1 execute ews-web-builder-leads $WHERE --json --command "SELECT session,event,input,request,spec,diff,outcome,created FROM train_events ORDER BY session,id" > /tmp/ews-train.json
node tools/training-jsonl.mjs /tmp/ews-train.json > "$OUT"; echo "wrote $(wc -l < "$OUT") examples to $OUT"
