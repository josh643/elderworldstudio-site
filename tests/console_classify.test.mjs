import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { classifyBrowserMessage, isJsException, hrefLooksLikeTemplateLeftover } = require("./console_classify.js");

test("pageerror is a JS exception; report-only CSP is not", () => {
  const thrown = classifyBrowserMessage({
    source: "pageerror",
    text: "ReferenceError: missing is not defined",
  });
  assert.equal(thrown, "pageerror");
  assert.equal(isJsException(thrown), true);

  const smokePos = classifyBrowserMessage({
    source: "console",
    type: "error",
    text: "Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: frame-ancestors 'self'",
  });
  assert.equal(smokePos, "report-only-warning");
  assert.equal(isJsException(smokePos), false);

  const livePos = classifyBrowserMessage({
    source: "console",
    type: "error",
    text: 'Framing \'https://googleads.g.doubleclick.net/\' violates the following report-only Content Security Policy directive: "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com". The violation has been logged, but no further action has been taken.',
  });
  assert.equal(livePos, "report-only-warning");
  assert.equal(isJsException(livePos), false);
});

test("plain console error and web-share warning stay distinct from pageerror", () => {
  const net = classifyBrowserMessage({
    source: "console",
    type: "error",
    text: "Failed to load resource: net::ERR_FAILED",
  });
  assert.equal(net, "console-error");
  assert.equal(isJsException(net), false);

  const share = classifyBrowserMessage({
    source: "console",
    type: "warning",
    text: "Unrecognized feature: 'web-share'.",
  });
  assert.equal(share, "console-warning");
  assert.equal(isJsException(share), false);
});

test("negative: merch leftover href is a template placeholder", () => {
  assert.equal(hrefLooksLikeTemplateLeftover("{../}privacy-policy/index.html"), true);
  assert.equal(hrefLooksLikeTemplateLeftover("../privacy-policy/index.html"), false);
});
