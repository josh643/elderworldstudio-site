import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
const read = (p) => readFileSync(join(root, p), "utf8");

test("homepage no longer claims live phone answering", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /answer every customer/i);
  assert.doesNotMatch(html, /answers your phone/i);
  assert.match(html, /in development/i);
  assert.match(html, /800 N King Street, Suite 304-3191/);
  assert.match(html, /legal@elderworldstudio\.com/);
});

test("receptionist page is a waitlist, not a live product", () => {
  const html = read("ai-receptionist/index.html");
  assert.doesNotMatch(html, /answers your phone/i);
  assert.match(html, /in development/i);
});

test("general ToS is not the SMS page", () => {
  const terms = read("terms/index.html");
  assert.match(terms, /Terms of Use/);
  assert.doesNotMatch(terms, /Terms and Conditions \(SMS\)/);
  assert.match(terms, /Delaware corporation/);
  const sms = read("sms-terms/index.html");
  assert.match(sms, /SMS Terms/);
});

test("DMCA, cookies, stores CCPA, merch waitlist", () => {
  assert.match(read("dmca/index.html"), /DMCA-1083295/);
  assert.match(read("cookies/index.html"), /Turnstile/);
  const stores = read("stores-privacy/index.html");
  assert.match(stores, /Do Not Sell or Share/);
  assert.match(stores, /Fourthwall/);
  const merch = read("merch/index.html");
  assert.match(merch, /not for sale yet/);
  assert.match(merch, /Privacy/);
});

test("no elderworldsstudio typo in generated pages", () => {
  const home = read("index.html");
  assert.doesNotMatch(home, /elderworldsstudio/);
});
