#!/usr/bin/env python3
"""Generates site/office/data/{site,roster}.json for the 3D office.
site.json is PARSED FROM THE BUILT HTML PAGES (home, games, services, merch), so editing the site
(tools/build.py) and rebuilding updates the office displays automatically. roster.json comes from
tools/office/{teams,agent-names}.json (copies of the CT111 policy files; public-safe fields only).
Called at the end of tools/build.py. No network, no secrets."""
import json, re, pathlib, html
from html.parser import HTMLParser
ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"; OUT = SITE / "office" / "data"; OUT.mkdir(parents=True, exist_ok=True)

class Cards(HTMLParser):
    """Collects <article class="card ..."> blocks: title, tag, text, img, buttons; plus section ids/h2."""
    def __init__(s):
        super().__init__(); s.cards = []; s.cur = None; s.cap = None; s.depth = 0; s.section = ""; s.sec_title = {}; s.h1 = ""; s.hero_p = ""; s._in = None; s.panels = []; s.panel = None; s.pdepth = 0
    def handle_starttag(s, t, a):
        a = dict(a); cls = a.get("class", "") or ""
        if t == "section" and a.get("id"): s.section = a["id"]
        if t == "article" and "card" in cls.split():
            s.cur = {"section": s.section, "title": "", "tag": "", "text": [], "img": "", "buttons": []}; s.depth = 1; return
        if t == "div" and "panel" in cls.split() and s.cur is None:
            s.panel = {"title": "", "text": [], "links": []}; s.pdepth = 1; return
        if s.panel is not None:
            if t == "div": s.pdepth += 1
            if t == "h3": s.cap = ("ptitle",)
            elif t == "p": s.cap = ("ptext",); s.panel["text"].append("")
            elif t == "a" and a.get("href"): s.panel["links"].append({"href": a["href"], "label": ""}); s.cap = ("plink",)
            return
        if s.cur is not None:
            if t in ("article", "div"): s.depth += 1 if t == "article" else 0
            if t == "img" and not s.cur["img"]: s.cur["img"] = a.get("src", ""); s.cur["alt"] = a.get("alt", "")
            elif t == "h3": s.cap = ("title",)
            elif t == "span" and "tag" in cls: s.cap = ("tag",)
            elif t == "span" and "price" in cls: s.cap = ("price",)
            elif t == "p": s.cap = ("text",); s.cur["text"].append("")
            elif t == "a" and a.get("href"): s.cur["buttons"].append({"href": a["href"], "label": "", "primary": "btn-primary" in cls}); s.cap = ("btn",)
            return
        if t == "h1": s._in = "h1"
        elif t == "h2": s._in = "h2"
        elif t == "p" and s.h1 and not s.hero_p: s._in = "hp"
    def handle_endtag(s, t):
        if s.panel is not None:
            if t == "div":
                s.pdepth -= 1
                if s.pdepth == 0: s.panels.append(s.panel); s.panel = None
            if t in ("h3", "p", "a"): s.cap = None
            return
        if s.cur is not None:
            if t == "article":
                c = s.cur; c["text"] = " ".join(x.strip() for x in c["text"] if x.strip()); s.cards.append(c); s.cur = None
            if t in ("h3", "span", "p", "a"): s.cap = None
            return
        if t in ("h1", "h2", "p"): s._in = None
    def handle_data(s, d):
        if s.panel is not None and s.cap:
            k = s.cap[0]
            if k == "ptitle": s.panel["title"] += d
            elif k == "ptext": s.panel["text"][-1] += d
            elif k == "plink": s.panel["links"][-1]["label"] += d
            return
        if s.cur is not None and s.cap:
            k = s.cap[0]
            if k == "btn": s.cur["buttons"][-1]["label"] += d
            elif k == "text": s.cur["text"][-1] += d
            else: s.cur[k] = s.cur.get(k, "") + d
            return
        if s._in == "h1": s.h1 += d
        elif s._in == "h2": s.sec_title.setdefault(s.section, ""); s.sec_title[s.section] += d
        elif s._in == "hp": s.hero_p += d

def parse(rel):
    p = Cards(); p.feed((SITE / rel).read_text()); return p
def norm_img(src, base):
    if not src: return ""
    src = src.replace("index.html", "")
    if src.startswith("http") or src.startswith("/"): return src
    return "/" + str((pathlib.PurePosixPath("/" + base).parent / src)).lstrip("/").replace("/./", "/")
def clean_path(u):
    import posixpath
    return posixpath.normpath(u) if u.startswith("/") else u
def store_of(href):
    return "steam" if "steampowered" in href else "play" if "play.google" in href else "shop" if "fourthwall" in href else "link"

home, games, svc, merch = parse("index.html"), parse("games/index.html"), parse("services/index.html"), parse("merch/index.html")
G = []
for c in games.cards:
    btn = [b for b in c["buttons"] if b["href"].startswith("http")]
    status = "live" if c["section"] == "live" else "soon"
    G.append({"title": c["title"].strip(), "tag": c["tag"].strip(), "text": c["text"], "status": status, "tier": c["section"],
              "img": clean_path(norm_img(c["img"], "games/index.html")), "alt": c.get("alt", ""),
              "buttons": [{"label": b["label"].strip(), "href": b["href"], "store": store_of(b["href"])} for b in btn]})
S = [{"title": p["title"].strip(), "text": " ".join(x.strip() for x in p["text"] if x.strip()),
      "links": [l for l in p["links"] if l["href"].startswith("http")]} for p in svc.panels if p["title"].strip()]
M = []
for c in merch.cards:
    b = c["buttons"][0] if c["buttons"] else {"href": "/merch/", "label": "View"}
    M.append({"title": c["title"].strip(), "price": c.get("price", "").strip(), "tag": c["tag"].strip(), "text": c["text"],
              "img": clean_path(norm_img(c["img"], "merch/index.html")).split("?")[0], "href": b["href"] if b["href"].startswith("http") else "/merch/"})
site = {"generated_from": ["index.html", "games/index.html", "services/index.html", "merch/index.html"],
        "brand": {"name": "Elder World Studio", "tagline": home.h1.strip() or "Forging Digital Realms", "about": re.sub(r"\s+", " ", home.hero_p).strip(),
                  "logo": "/assets/img/logo.png", "wallText": True},
        "games": G, "services": S, "merch": M,
        "devlog": {"title": "Devlogs on YouTube", "href": "https://www.youtube.com/@ElderWorldStudio"},
        "links": {"services": "/services/", "contact": "/contact/", "games": "/games/", "merch": "/merch/", "classic": "/?classic=1"}}
(OUT / "site.json").write_text(json.dumps(site, indent=1, ensure_ascii=False))

# ---- roster (public-safe: display name, role, team; no repos, schedules, clients, models)
names = json.load(open(ROOT / "tools/office/agent-names.json"))["agents"]
for k, v in json.load(open(ROOT / "tools/office/name-overrides.json")).items():
    if not k.startswith("_"): names[k] = {"name": v["name"], "role": v["role"]}
teams = json.load(open(ROOT / "tools/office/teams.json"))["teams"]
try: STAFF = json.load(open(ROOT / "tools/office/staffing.json"))
except Exception: STAFF = {}
seen, R = set(), []
for tk, t in teams.items():
    ids = [t.get("lead")] + list(t.get("members") or [])
    mem = []
    for i in ids:
        if not i: continue
        n = names.get(i) or {"name": i.replace("-", " ").title(), "role": i.replace("-", " ")}
        if n["name"] in seen: continue          # shared agents sit at their first team's desks
        seen.add(n["name"]); m = {"id": i, "name": n["name"], "role": n["role"], "lead": i == t.get("lead")}
        if i in STAFF.get("offDuty", []): m["offDuty"] = True; m["status"] = "off duty (paused)"
        if i in STAFF.get("unstaffed", []): m["unstaffed"] = True; m["status"] = "not staffed yet"; m["role"] = n["role"] + " (not staffed yet)"
        mem.append(m)
    row = {"key": tk, "name": t.get("name") or tk.title(), "members": mem}
    if t.get("floor"): row["floor"] = t["floor"]
    if t.get("floor") == "B1": row["restricted"] = True   # 2026-10-17 world team: renders only inside the IP-locked B1 module            # 2026-10-16: upper-floor teams (architecture = Floor 3)
    if t.get("seats"): row["seats"] = t["seats"]            # assigned chair id per agent (one chair each)
    R.append(row)
sub = names.get("subceo", {"name": "Odin", "role": "Sub-CEO"})
rec = names.get("receptionist", {"name": "Freyja", "role": "receptionist"})
roster = {"subceo": {"id": "subceo", "name": sub["name"], "role": sub["role"]},
          "receptionist": {"id": "receptionist", "name": rec["name"], "role": rec["role"], "hall": "Fólkvangr"},
          "teams": R, "nodes": json.load(open(ROOT / "tools/office/nodes.json"))}
(OUT / "names.json").write_text(json.dumps({k: {"name": v["name"], "role": v["role"]} for k, v in names.items()}, ensure_ascii=False))
(OUT / "roster.json").write_text(json.dumps(roster, indent=1, ensure_ascii=False))
print(f"office data: {len(G)} games, {len(S)} services, {len(M)} merch, {len(R)} teams, {sum(len(t['members']) for t in R)} agents")
