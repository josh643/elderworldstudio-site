import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";
const OUT = process.env.SHOT_DIR || "/tmp/ews-before";
const REPORT = process.env.REPORT_PATH || "/tmp/ews-before/audit.json";

const PAGES = [
  { name: "home", path: "/" },
  { name: "services", path: "/services/" },
  { name: "pos", path: "/pos/" },
  { name: "kiosk", path: "/kiosk/" },
  { name: "websites", path: "/websites/" },
  { name: "build", path: "/build/" },
  { name: "ai-receptionist", path: "/ai-receptionist/" },
  { name: "agent-os", path: "/agent-os/" },
  { name: "custom-software", path: "/custom-software/" },
  { name: "demo", path: "/demo/" },
  { name: "contact", path: "/contact/" },
  { name: "merch", path: "/merch/" },
  { name: "games", path: "/games/" },
  { name: "testers", path: "/testers/" },
  { name: "privacy", path: "/privacy-policy/" },
  { name: "sms-terms", path: "/sms-terms/" },
  { name: "terms", path: "/terms/" },
  { name: "sw-privacy", path: "/star-wayfarer/privacy/" },
  { name: "notfound", path: "/404.html" },
];

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--disable-dev-shm-usage"],
});

const results = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.width < 768,
    hasTouch: true,
  });
  await context.route("**/*googlesyndication.com/**", (r) => r.abort());
  await context.route("**/*doubleclick.net/**", (r) => r.abort());
  await context.route("**/*adsbygoogle.js*", (r) => r.abort());
  await context.route("**/*pagead2.googlesyndication.com/**", (r) => r.abort());

  for (const pageInfo of PAGES) {
    const page = await context.newPage();
    const url = BASE + pageInfo.path;
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForTimeout(250);

    const audit = await page.evaluate(() => {
      const problems = [];
      const vw = window.innerWidth;
      const docW = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0
      );
      const vp = document.querySelector('meta[name="viewport"]');
      const vpContent = vp ? vp.getAttribute("content") || "" : "";
      if (!vp) problems.push({ type: "missing-viewport", detail: "No viewport meta tag" });
      else if (!/width\s*=\s*device-width/i.test(vpContent) || /user-scalable\s*=\s*no/i.test(vpContent)) {
        problems.push({ type: "bad-viewport", detail: vpContent });
      }
      if (docW > vw + 1) {
        problems.push({ type: "horizontal-overflow", detail: `scrollWidth ${docW} > innerWidth ${vw}` });
      }

      const overflowEls = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > vw + 2 && r.left < vw && r.right > vw + 2) {
          overflowEls.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 80),
            width: Math.round(r.width),
            right: Math.round(r.right),
          });
        }
      }
      if (overflowEls.length) {
        problems.push({
          type: "element-overflow",
          detail: overflowEls.slice(0, 8),
        });
      }

      const fixed = [];
      for (const el of document.querySelectorAll("[style]")) {
        const s = el.getAttribute("style") || "";
        if (/width\s*:\s*\d{3,}px/i.test(s)) {
          fixed.push({ tag: el.tagName.toLowerCase(), style: s.slice(0, 120) });
        }
      }
      if (fixed.length) problems.push({ type: "inline-fixed-width", detail: fixed });

      const taps = [];
      const tapSel = "a, button, input, select, textarea, label, [role=button]";
      for (const el of document.querySelectorAll(tapSel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) {
          taps.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 60),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      if (taps.length) problems.push({ type: "tiny-tap-targets", count: taps.length, sample: taps.slice(0, 10) });

      const tinyText = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!el.childNodes.length) continue;
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasText) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size && size < 12) {
          tinyText.push({ tag: el.tagName.toLowerCase(), size, text: el.textContent.trim().slice(0, 40) });
        }
      }
      if (tinyText.length) problems.push({ type: "unreadable-text", detail: tinyText.slice(0, 8) });

      const nav = document.querySelector("header nav, nav[aria-label='Main']");
      const toggle = document.querySelector(".nav-toggle, [aria-controls='site-nav'], button.hamburger, .menu-toggle");
      const navLinks = nav ? [...nav.querySelectorAll("a")] : [];
      const navWraps = nav && navLinks.length
        ? nav.getBoundingClientRect().height > 72
        : false;
      const navHidden = nav ? getComputedStyle(nav).display === "none" : true;
      if (!toggle && navLinks.length > 4 && vw < 900) {
        problems.push({
          type: "no-mobile-menu",
          detail: `header nav has ${navLinks.length} links, wraps=${navWraps}, height=${nav ? Math.round(nav.getBoundingClientRect().height) : 0}`,
        });
      }

      const forms = [...document.querySelectorAll("form")].map((f) => {
        const inputs = [...f.querySelectorAll("input, select, textarea, button")].map((i) => {
          const r = i.getBoundingClientRect();
          const cs = getComputedStyle(i);
          return {
            name: i.name || i.type,
            type: i.type,
            w: Math.round(r.width),
            h: Math.round(r.height),
            font: cs.fontSize,
            overflow: r.right > vw + 2,
          };
        });
        const sms = f.querySelector(".sms-opt, input[name=sms_optin]");
        return {
          action: f.getAttribute("action"),
          inputs,
          hasSms: !!sms,
          smsText: sms ? (sms.innerText || "").replace(/\s+/g, " ").trim() : null,
        };
      });
      if (forms.length) {
        const broken = forms.flatMap((f) => f.inputs.filter((i) => i.overflow || i.w > vw));
        if (broken.length) problems.push({ type: "form-overflow", detail: broken });
      }

      const tables = [...document.querySelectorAll("table")].map((t) => {
        const r = t.getBoundingClientRect();
        const wrap = t.closest(".table-wrap");
        return {
          w: Math.round(r.width),
          overflow: r.width > vw + 2,
          wrapped: !!(wrap && getComputedStyle(wrap).overflowX !== "visible"),
        };
      });
      if (tables.some((t) => t.overflow && !t.wrapped)) {
        problems.push({ type: "table-overflow", detail: tables });
      }

      const images = [...document.images].map((img) => ({
        src: (img.currentSrc || img.src || "").split("/").pop(),
        displayW: Math.round(img.getBoundingClientRect().width),
        naturalW: img.naturalWidth,
        overflow: img.getBoundingClientRect().right > vw + 2,
      }));
      const oversized = images.filter((i) => i.overflow || i.displayW > vw + 2);
      if (oversized.length) problems.push({ type: "oversized-images", detail: oversized });

      return {
        title: document.title,
        viewport: vpContent,
        innerWidth: vw,
        scrollWidth: docW,
        navLinks: navLinks.map((a) => a.textContent.trim()),
        hasToggle: !!toggle,
        navHidden,
        forms,
        tables,
        images: images.slice(0, 12),
        problems,
      };
    });

    const shotTop = path.join(OUT, `${pageInfo.name}-${vp.name}-top.png`);
    await page.screenshot({ path: shotTop, fullPage: false });
    let shotFull = null;
    if (vp.name === "390x844") {
      shotFull = path.join(OUT, `${pageInfo.name}-${vp.name}-full.png`);
      await page.screenshot({ path: shotFull, fullPage: true });
    }

    results.push({
      page: pageInfo.name,
      path: pageInfo.path,
      viewport: vp.name,
      status: resp ? resp.status() : null,
      shotTop,
      shotFull,
      ...audit,
    });
    console.log(
      vp.name,
      pageInfo.name,
      audit.problems.length ? `PROBLEMS:${audit.problems.map((p) => p.type).join(",")}` : "ok",
      `sw=${audit.scrollWidth}/${audit.innerWidth}`
    );
    await page.close();
  }
  await context.close();
}

// desktop baseline
const desk = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
await desk.route("**/*googlesyndication.com/**", (r) => r.abort());
await desk.route("**/*doubleclick.net/**", (r) => r.abort());
await desk.route("**/*adsbygoogle.js*", (r) => r.abort());
for (const pageInfo of PAGES) {
  const page = await desk.newPage();
  await page.goto(BASE + pageInfo.path, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => {
    const header = document.querySelector(".site-header");
    const nav = document.querySelector("header nav");
    const brand = document.querySelector(".brand");
    const main = document.querySelector("main");
    return {
      headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      navDisplay: nav ? getComputedStyle(nav).display : null,
      brandW: brand ? Math.round(brand.getBoundingClientRect().width) : null,
      mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
      bodyFont: getComputedStyle(document.body).fontSize,
    };
  });
  const shot = path.join(OUT, `desktop-${pageInfo.name}-top.png`);
  await page.screenshot({ path: shot, fullPage: false });
  results.push({ page: pageInfo.name, path: pageInfo.path, viewport: "1366x900", desktop: true, metrics, shot });
  console.log("desktop", pageInfo.name, metrics);
  await page.close();
}
await desk.close();
await browser.close();

fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));
const problemRows = results.filter((r) => r.problems && r.problems.length);
console.log("\n=== SUMMARY ===");
console.log("pages audited", results.filter((r) => !r.desktop).length);
console.log("with problems", problemRows.length);
for (const r of problemRows) {
  console.log(`- ${r.page} @ ${r.viewport}: ${r.problems.map((p) => p.type).join(", ")}`);
}
console.log("wrote", REPORT);
