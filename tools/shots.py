import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = "/workspace/ews-site/shots/"
PAGES = [("home",""),("privacy","privacy-policy/"),("contact","contact/"),("sw-privacy","star-wayfarer/privacy/"),("404","404.html")]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        for vname, vp, mobile in [("desktop",{"width":1366,"height":900},False),("phone",{"width":390,"height":844},True)]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            for name, path in PAGES:
                pg = await ctx.new_page(); errs = []
                pg.on("console", lambda m, e=errs: e.append(m.text) if m.type in ("error","warning") else None)
                pg.on("pageerror", lambda x, e=errs: e.append(str(x)))
                pg.on("requestfailed", lambda r, e=errs: e.append("FAILED " + r.url))
                resp = await pg.goto(BASE + path, wait_until="networkidle")
                await pg.evaluate("document.fonts.ready")
                await pg.evaluate("async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);}")
                await pg.wait_for_load_state("networkidle")
                broken = await pg.evaluate("[...document.images].filter(i=>!i.complete||i.naturalWidth==0).map(i=>i.src)")
                sw = await pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
                fonts = await pg.evaluate("[...document.fonts].filter(f=>f.status=='loaded').map(f=>f.family).join(',')")
                await pg.screenshot(path=f"{OUT}{vname}-{name}.png", full_page=True)
                await pg.screenshot(path=f"{OUT}{vname}-{name}-top.png")
                print(vname, name, resp.status, "scrollW/innerW", sw, "overflow" if sw[0] > sw[1] else "ok", "fonts:", fonts, "errs:", errs, "broken imgs:", broken)
                await pg.close()
            await ctx.close()
        await b.close()
asyncio.run(main())
