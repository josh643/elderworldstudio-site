import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/home/box/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]); pg=b.new_page(viewport={'width':1024,'height':640})
    for c in sys.argv[2:]:
        for t in ("0.3","0.6"):
            pg.goto(f"http://localhost:8793/office/assets/anims/test.html?packs=desk,move,social2&clip={c}&view={sys.argv[1]}&t={t}&props=0&body=human_Male_v2.glb"); pg.wait_for_function("window.ready",timeout=30000); pg.wait_for_timeout(300)
            pg.screenshot(path=f"/workspace/shots/anims/{c}_{sys.argv[1]}_{t}.png")
    b.close()
