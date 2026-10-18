"""Capture office probe screenshots without hanging on a stalled web font."""
import base64
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError


async def capture_screenshot(page, path, *, image_type=None, quality=None):
    """Use Playwright when fonts settle quickly; otherwise capture the current frame via CDP."""
    target = Path(path)
    fmt = image_type or ("jpeg" if target.suffix.lower() in (".jpg", ".jpeg") else "png")
    ready = await page.evaluate("""() => Promise.race([
      document.fonts.ready.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 2000))
    ])""")
    if ready:
        try:
            options = {"path": str(target), "type": fmt, "timeout": 5000}
            if quality is not None:
                options["quality"] = quality
            await page.screenshot(**options)
            return "playwright"
        except PlaywrightTimeoutError as error:
            if "waiting for fonts to load" not in str(error):
                raise

    session = await page.context.new_cdp_session(page)
    options = {"format": fmt}
    if fmt == "jpeg" and quality is not None:
        options["quality"] = quality
    result = await session.send("Page.captureScreenshot", options)
    target.write_bytes(base64.b64decode(result["data"]))
    await session.detach()
    print(f"warn screenshot_font_wait {target}: captured current frame while fonts were pending", flush=True)
    return "cdp"
