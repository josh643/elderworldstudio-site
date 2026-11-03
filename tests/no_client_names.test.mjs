import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CLIENT = /marlon|cap\s*bar/i;
const DIRS = ['site', 'functions', 'supabase', 'tools'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|md|sql|py|css|json)$/.test(name)) out.push(p);
  }
  return out;
}

test('no client names in code, fixtures, or copy', () => {
  const hits = [];
  for (const dir of DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, 'utf8');
      if (CLIENT.test(text)) hits.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(hits, []);
});
