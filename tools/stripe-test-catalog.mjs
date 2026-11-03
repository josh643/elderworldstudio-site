#!/usr/bin/env node
// Create (or reuse) Stripe TEST products/prices for the four /build/ plans. Prints IDs.
// Usage: STRIPE_SECRET_KEY=sk_test_… node tools/stripe-test-catalog.mjs
// Refuses live keys. Does not create live products.
import { ensureTestCatalog, formatCatalogEnv, envFromCatalog } from '../functions/_lib/stripe-catalog.js';

const key = process.env.STRIPE_SECRET_KEY || '';
const jsonMode = process.argv.includes('--json');

try {
  const catalog = await ensureTestCatalog(key);
  if (jsonMode) {
    console.log(JSON.stringify({ ok: true, catalog, env: envFromCatalog(catalog) }, null, 2));
  } else {
    console.log('Created or reused Stripe TEST products for Starter, Business, Plus, and Take it with you.\n');
    for (const [id, row] of Object.entries(catalog)) {
      console.log(`${id}: product ${row.product}`);
      console.log(`  setup   ${row.setup}`);
      if (row.monthly) console.log(`  monthly ${row.monthly}`);
    }
    console.log('\n' + formatCatalogEnv(catalog));
  }
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
