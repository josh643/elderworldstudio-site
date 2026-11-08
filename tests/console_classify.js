/** Classify browser messages. Report-only CSP is not a JS exception. */
function classifyBrowserMessage({ source, type, text } = {}) {
  const t = String(text || "");
  if (source === "pageerror") return "pageerror";
  if (
    /report-only content security policy/i.test(t) ||
    /content-security-policy-report-only/i.test(t)
  ) {
    return "report-only-warning";
  }
  if (type === "error") return "console-error";
  if (type === "warning") return "console-warning";
  return "other";
}

function isJsException(kind) {
  return kind === "pageerror";
}

function hrefLooksLikeTemplateLeftover(href) {
  return typeof href === "string" && (href.includes("{") || href.includes("}"));
}

module.exports = {
  classifyBrowserMessage,
  isJsException,
  hrefLooksLikeTemplateLeftover,
};
