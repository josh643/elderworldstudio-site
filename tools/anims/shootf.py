import json,sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/home/box/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]); pg=b.new_page(viewport={'width':1280,'height':800})
    pg.on("pageerror",lambda e: print("PERR",e)); pg.on("requestfailed",lambda r: print("RF",r.url))
    pg.on("console",lambda m: print("CON",m.text) if m.type in("error","warning") else None)
    pg.goto("http://localhost:8793/office/assets/anims/test.html?packs=desk_f,move_f,social2_f,locomotion_f,social_f,store_f,exterior_f&all=1&body=human_Female_v2.glb"); pg.wait_for_function("window.ready",timeout=20000)
    print("GATE",json.dumps(pg.evaluate("gate()")))
    for clip in sys.argv[1:]:
        for v in (["34","close"] if clip.startswith("Sit") else ["34","side"]):
            pg.goto(f"http://localhost:8793/office/assets/anims/test.html?packs=desk,move,social2,locomotion,social,store,exterior&clip={clip}&view={v}&t=0.3&body=human_Male_v2.glb"); pg.wait_for_function("window.ready",timeout=20000); pg.wait_for_timeout(400)
            pg.screenshot(path=f"/workspace/shots/anims/{clip}_{v}.png")
    b.close()
