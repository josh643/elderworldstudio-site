const PAGES = [
  { name: "home", path: "/" },
  { name: "services", path: "/services/" },
  { name: "build", path: "/build/" },
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

const PHONE_VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
];

const SMS_CONSENT =
  "By checking this box, I agree to receive text messages from Elder World Studio about my service request (confirmations, project questions, and demo scheduling). Up to 4 msgs per request. Message and data rates may apply. Reply STOP to opt out and HELP for help. Optional — not required to get a demo.";

async function blockAds(page) {
  await page.route("**/*googlesyndication.com/**", (r) => r.abort());
  await page.route("**/*doubleclick.net/**", (r) => r.abort());
  await page.route("**/*pagead*/**", (r) => r.abort());
  await page.route("**/*adsbygoogle.js*", (r) => r.abort());
}

async function layoutAudit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const vp = document.querySelector('meta[name="viewport"]');
    const vpContent = vp ? vp.getAttribute("content") || "" : "";
    const overflowing = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(".hp") || el.getAttribute("aria-hidden") === "true") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.right > vw + 2 && r.left < vw) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 60),
          right: Math.round(r.right),
        });
      }
    }
    return {
      vw,
      docW,
      vpContent,
      overflowing: overflowing.slice(0, 8),
    };
  });
}

module.exports = { PAGES, PHONE_VIEWPORTS, SMS_CONSENT, blockAds, layoutAudit };
