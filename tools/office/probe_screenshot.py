"""Capture office audit screenshots without waiting indefinitely for web fonts."""
import asyncio
import base64
import time
from pathlib import Path


async def capture_screenshot(page, path, *, image_type=None, quality=None):
    """Wait briefly for fonts, then capture without Playwright's unbounded font wait."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fmt = image_type or ("jpeg" if target.suffix.lower() in (".jpg", ".jpeg") else "png")
    started = time.monotonic()
    font_state = await page.evaluate("""() => {
      const started = performance.now();
      return Promise.race([
      document.fonts.ready.then(() => 'ready'),
      new Promise(resolve => setTimeout(() => resolve('deadline'), 2000))
    ]).then(result => ({
      result,
      wait_ms: Math.round(performance.now() - started),
      fonts: [...document.fonts].map(font => ({family: font.family, status: font.status})),
      resources: performance.getEntriesByType('resource')
        .filter(entry => /\\.woff2?(?:[?#]|$)/i.test(entry.name))
        .map(entry => ({name: new URL(entry.name).pathname, ms: Math.round(entry.duration), bytes: entry.transferSize || null}))
      }));
    }""")

    session = await page.context.new_cdp_session(page)
    cdp_options = {"format": fmt}
    if fmt == "jpeg" and quality is not None:
        cdp_options["quality"] = quality
    try:
        result = await asyncio.wait_for(session.send("Page.captureScreenshot", cdp_options), timeout=15)
        target.write_bytes(base64.b64decode(result["data"]))
    finally:
        await session.detach()

    elapsed_ms = round((time.monotonic() - started) * 1000)
    return {
        "path": str(target),
        "method": "cdp",
        "font_wait_ms": font_state["wait_ms"],
        "font_state": font_state["result"],
        "fonts": font_state["fonts"],
        "font_resources": font_state["resources"],
        "capture_ms": elapsed_ms,
        "bytes": target.stat().st_size,
    }
