import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAIL = "800 N King Street, Suite 304-3191, Wilmington, DE 19801";

// SHA-256 + length of previously published residential strings. Literals are not in this repo.
// Ops: printf '%s' "$line" | sha256sum  (set EWS_PRIVACY_BLOCKLIST to also scan a raw line).
const BLOCKED = [
  ["8d2044240a72efa40b53ed6e0dbbb8f1fdd24abe7652d889f75f0cde922fd7db", 27],
  ["1d517ae02781f68bbfcb9ca2b8b5d2bb3fe1ba0ee3a07dd9332def9aa9367a61", 27],
  ["80747d06a27b9354cc2e792d76b1a084e9a1e4dfb3421904c4927cb3bfcd50e9", 48],
  ["8928c45bf39dd53cbcf024f806079571faa05774e1383d9549ec062f0f672f3d", 48],
  ["2cbd82608fd168e008e7775ab66a3668030983c8c2ea6d0f3e07f2a05f41b284", 64],
  ["30af6e394ce0a0a677304281ce04c8e35a03db4a38f6421c3363464ea5556df0", 49],
  ["583c5efbf246d9461ba2042acd03130b1b60fde72169830f115e70300471e5ee", 46],
  ["e83c954a14d780c53592fc87edde77d1fc0aeffe97a0a74f6dbdb57b6073246c", 13],
  ["1ba8dd54275b24783ad8fed1b0187e3c6939dd4f80cc8c0a9fe4b1c9545cae26", 13],
];
const HASHES = new Set(BLOCKED.map(([h]) => h));
const LENGTHS = [...new Set(BLOCKED.map(([, n]) => n))];

function sha256(s) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "vendor") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|js|mjs|py|json|xml|txt|md|css)$/i.test(name)) out.push(p);
  }
  return out;
}

function hitsIn(text) {
  const extra = (process.env.EWS_PRIVACY_BLOCKLIST || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
  for (const lit of extra) {
    if (text.includes(lit)) return true;
  }
  for (const n of LENGTHS) {
    if (text.length < n) continue;
    for (let i = 0; i + n <= text.length; i++) {
      if (HASHES.has(sha256(text.slice(i, i + n)))) return true;
    }
  }
  return false;
}

test("every generated HTML page with a commercial footer uses the business mailbox", () => {
  const htmlFiles = walk(join(repo, "site")).filter((p) => p.endsWith(".html"));
  assert.ok(htmlFiles.length >= 20, "expected a full site tree");
  let commercial = 0;
  for (const file of htmlFiles) {
    const text = readFileSync(file, "utf8");
    const rel = relative(repo, file);
    if (text.includes("Commercial email") || /All rights reserved\.<br>/.test(text)) {
      commercial += 1;
      assert.ok(text.includes(MAIL), rel + " missing public mailbox");
    }
  }
  assert.ok(commercial >= 20, "commercial footers: " + commercial);
  const home = readFileSync(join(repo, "site/index.html"), "utf8");
  assert.match(home, /"streetAddress": "800 N King Street, Suite 304-3191"/);
  assert.match(home, /"addressLocality": "Wilmington"/);
  assert.match(home, /"postalCode": "19801"/);
});

test("blocked residential hashes are absent from site, tools, functions, tests, and content", () => {
  const files = walk(join(repo, "site"))
    .concat(walk(join(repo, "tools")))
    .concat(walk(join(repo, "functions")))
    .concat(walk(join(repo, "tests")))
    .concat(walk(join(repo, "content")));
  const hits = [];
  for (const file of files) {
    const rel = relative(repo, file);
    if (rel === "tests/public_mailing.test.mjs") continue;
    const text = readFileSync(file, "utf8");
    if (hitsIn(text)) hits.push(rel);
  }
  assert.equal(hits.length, 0, "blocked hash in: " + hits.join(", "));
});
