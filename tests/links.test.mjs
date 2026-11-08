import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { hrefLooksLikeTemplateLeftover } = require("./console_classify.js");

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(repo, "site");
const MAIL = "800 N King Street, Suite 304-3191, Wilmington, DE 19801";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "vendor" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function attrs(html) {
  return [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);
}

test("no template leftovers in href/src and internal targets exist", () => {
  const files = walk(site);
  assert.ok(files.length >= 20);
  const broken = [];
  let internal = 0;
  for (const file of files) {
    const rel = relative(site, file);
    const html = readFileSync(file, "utf8");
    for (const href of attrs(html)) {
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("data:") || href.startsWith("javascript:") || href.startsWith("#")) {
        continue;
      }
      if (hrefLooksLikeTemplateLeftover(href)) {
        broken.push(`${rel} placeholder ${href}`);
        continue;
      }
      if (/^https?:\/\//i.test(href)) continue;
      const pathOnly = href.split("#", 1)[0].split("?", 1)[0];
      if (!pathOnly) continue;
      internal += 1;
      const target = pathOnly.startsWith("/")
        ? join(site, pathOnly.replace(/^\//, ""))
        : resolve(dirname(file), pathOnly);
      const ok =
        statSync(target, { throwIfNoEntry: false })?.isFile() ||
        statSync(join(target, "index.html"), { throwIfNoEntry: false })?.isFile();
      if (!ok) broken.push(`${rel} missing ${href}`);
    }
  }
  assert.ok(internal >= 80, "internal href/src count " + internal);
  assert.equal(broken.length, 0, broken.join("\n"));
});

test("merch privacy link is a real same-origin path, not a leftover placeholder", () => {
  const html = readFileSync(join(site, "merch/index.html"), "utf8");
  assert.doesNotMatch(html, /\{(\.\.\/)?\}/);
  assert.match(html, /<a href="\.\.\/privacy-policy\/index\.html">Privacy<\/a>/);
  assert.match(html, new RegExp(MAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("negative: the previously published merch placeholder would fail the scan", () => {
  assert.equal(hrefLooksLikeTemplateLeftover("{../}privacy-policy/index.html"), true);
  const html = readFileSync(join(site, "merch/index.html"), "utf8");
  assert.equal(html.includes("{../}privacy-policy/index.html"), false);
});
