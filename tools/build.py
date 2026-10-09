#!/usr/bin/env python3
"""Generates the static site in ../site. Plain HTML output, no runtime build step needed.
Run: python3 tools/build.py"""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent / "site"
DOMAIN = "https://elderworldstudio.com"
STUDIO = "Elder World Studio Inc"
EMAIL = "unity@elderworldsstudio.com"
EFFECTIVE = "October 8, 2026"
PLAY_SW = "https://play.google.com/store/apps/details?id=com.elderworlds.starwayfarer"
STEAM_OMNI = "https://store.steampowered.com/app/4121760"
STEAM_COTR = "https://store.steampowered.com/app/2559510"

def page(path, title, desc, body, canonical, current="", noindex=False):
    depth = path.count("/")  # e.g. "privacy-policy/index.html" -> 1
    P = "../" * depth
    nav = [("index.html", "Home", "home"), ("index.html#games", "Games", "games"),
           ("index.html#tools", "Assets", "tools"), ("merch/index.html", "Merch", "merch"), ("contact/index.html", "Contact", "contact"),
           ("privacy-policy/index.html", "Privacy Policy", "privacy")]
    navhtml = "".join(f'<a href="{P}{h}"{" aria-current=\"page\"" if k == current else ""}>{t}</a>' for h, t, k in nav)
    robots = '<meta name="robots" content="noindex">' if noindex else '<meta name="robots" content="index,follow">'
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}
<link rel="canonical" href="{DOMAIN}{canonical}">
<link rel="icon" type="image/png" href="{P}favicon.png?v=3">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{STUDIO}">
<meta property="og:url" content="{DOMAIN}{canonical}">
<meta property="og:image" content="{DOMAIN}/assets/img/hero-bg.jpg">
<meta name="theme-color" content="#1a1a1a">
<link rel="preload" href="{P}assets/fonts/cinzel.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{P}assets/css/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
 <div class="wrap">
  <a class="brand" href="{P}index.html"><img src="{P}assets/img/logo-gold-64.png?v=3" width="36" height="36" alt=""><span>{STUDIO}</span></a>
  <nav class="nav" aria-label="Main">{navhtml}</nav>
 </div>
</header>
<main id="main">
{body.replace("{P}", P)}
</main>
<footer class="site-footer">
 <div class="wrap">
  <div>&copy; 2026 {STUDIO}. All rights reserved.</div>
  <nav aria-label="Footer"><a href="{P}index.html#games">Games</a><a href="{P}merch/index.html">Merch</a><a href="{P}contact/index.html">Contact</a><a href="{P}privacy-policy/index.html">Privacy Policy</a><a href="mailto:{EMAIL}">{EMAIL}</a></nav>
 </div>
</footer>
</body>
</html>
"""
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

HOME = f"""
<section class="hero">
 <div class="wrap">
  <img class="logo" src="{{P}}assets/img/logo-gold.png?v=3" width="256" height="256" alt="Elder World Studio crest: crossed swords over a shield">
  <h1>Forging Digital Realms</h1>
  <p>{STUDIO} is a game development studio that blends the enchanting aesthetics of medieval worlds with the power of modern technology. We make PC and mobile games, and assets for other developers.</p>
  <div class="btns"><a class="btn btn-primary" href="#games">View Our Games</a><a class="btn btn-ghost" href="{{P}}contact/index.html">Get in Touch</a></div>
 </div>
</section>

<section class="block" id="games">
 <div class="wrap">
  <div class="center"><h2>Our Games</h2><p class="lead">Immersive worlds for PC and mobile.</p></div>
  <div class="grid cards">
   <article class="card">
    <img class="thumb" src="{{P}}assets/img/star-wayfarer.jpg" width="1024" height="576" alt="Star Wayfarer title screen with a starship in space" loading="lazy">
    <div class="body">
     <span class="tag live">On Google Play</span>
     <h3>Star Wayfarer</h3>
     <p>An open space adventure built for mobile. Fly, trade, mine and fight across the stars, walk your own ship, land on planets, and build your crew, fleet and empire. Free to play, with no pay-to-win.</p>
     <div class="actions"><a class="btn btn-primary" href="{PLAY_SW}" rel="noopener">Get it on Google Play</a><a class="link" href="{{P}}star-wayfarer/privacy/index.html">Privacy</a></div>
    </div>
   </article>
   <article class="card">
    <img class="thumb" src="{{P}}assets/img/omnivael.jpg" width="920" height="430" alt="Omnivael: Wayfarers Life key art over a medieval village" loading="lazy">
    <div class="body">
     <span class="tag soon">Early Access &middot; Nov 2026</span>
     <h3>Omnivael: Wayfarers Life</h3>
     <p>&ldquo;No Chosen One. No war to win. Just a world to live in.&rdquo; A living sandbox RPG where your legacy unfolds through trade, exploration, relationships and time itself, in a medieval frontier whose economy runs on its people. Coming to Steam Early Access.</p>
     <div class="actions"><a class="btn btn-primary" href="{STEAM_OMNI}" rel="noopener">View on Steam</a></div>
    </div>
   </article>
   <article class="card">
    <img class="thumb" src="{{P}}assets/img/chronicles-of-the-realm.jpg" width="1024" height="576" alt="Chronicles of the Realm: fighting slimes in a torch-lit cave arena" loading="lazy">
    <div class="body">
     <span class="tag soon">Free &middot; Coming to Steam</span>
     <h3>Chronicles of the Realm</h3>
     <p>A free first-person dungeon game set in the world of Omnivael, coming to Steam. Take up sword and shield, survive wave after wave of slimes and goblins in a torch-lit cave, and pick a boon between waves.</p>
     <div class="actions"><a class="btn btn-primary" href="{STEAM_COTR}" rel="noopener">View on Steam</a></div>
    </div>
   </article>
  </div>
 </div>
</section>

<section class="block alt" id="tools">
 <div class="wrap grid two">
  <div>
   <h2>Developer Assets</h2>
   <p class="lead">We publish game-ready assets on the Unity Asset Store as <strong>Elder Worlds Publishing</strong>, built from the same pipeline we use for our own games.</p>
   <div class="panel">
    <span class="tag review">In review</span>
    <h3>Medieval Village Props</h3>
    <p>A pack of medieval village and market props: barrels, baskets, bread, bottles, crates, tools and more, with modular crate and liquid fills. Submitted to the Unity Asset Store and currently in review.</p>
   </div>
  </div>
  <img src="{{P}}assets/img/medieval-village-props.jpg" width="1200" height="800" alt="Renders of props from the Medieval Village Props pack: a barrel, basket, bread, bottle, barrel tap and axe" loading="lazy" style="border-radius:16px;border:1px solid var(--line)">
 </div>
</section>

<section class="block" id="about">
 <div class="wrap grid two">
  <div>
   <h2>About Elder World Studio</h2>
   <p class="lead">Founded with a passion for immersive storytelling and robust engineering, Elder World Studio began by creating medieval-style RPGs.</p>
   <p class="lead">As we built our own tools to solve hard development problems, we realized we could help other creators too. Today we make games for PC and mobile, and assets for the developers who make theirs.</p>
  </div>
  <div class="panel center">
   <h3>Join Our Journey</h3>
   <p>Questions, feedback, bug reports or business enquiries? We read every message.</p>
   <a class="btn btn-primary" href="{{P}}contact/index.html">Contact Us</a>
  </div>
 </div>
</section>
"""

CONTACT = f"""
<div class="page"><div class="wrap">
 <div class="page-head"><h1>Contact</h1><p class="meta">{STUDIO}</p></div>
 <div class="grid contact-grid">
  <div class="panel">
   <h3>Email</h3>
   <p>For player support, bug reports, privacy requests and business enquiries, email us:</p>
   <p class="email"><a href="mailto:{EMAIL}">{EMAIL}</a></p>
   <p class="meta">Please include the game name and your device or platform for support requests.</p>
  </div>
  <div class="panel">
   <h3>Privacy &amp; data requests</h3>
   <p>To ask what data we hold about you or to have it deleted, email us with the subject &ldquo;Privacy request&rdquo;. Details are in our <a href="{{P}}privacy-policy/index.html">Privacy Policy</a>.</p>
  </div>
  <div class="panel">
   <h3>Find our games</h3>
   <p><a class="link" href="{PLAY_SW}" rel="noopener">Star Wayfarer on Google Play</a><br>
   <a class="link" href="{STEAM_OMNI}" rel="noopener">Omnivael: Wayfarers Life on Steam</a><br>
   <a class="link" href="{STEAM_COTR}" rel="noopener">Chronicles of the Realm on Steam</a></p>
  </div>
 </div>
</div></div>
"""

POLICY = f"""
<div class="page"><div class="wrap">
 <div class="page-head">
  <h1>Privacy Policy</h1>
  <p class="meta">{STUDIO} &middot; Effective date: {EFFECTIVE} &middot; Last updated: {EFFECTIVE}</p>
 </div>
 <article class="prose">
  <div class="summary">
   <strong>The short version</strong>
   <ul>
    <li>Our games do <strong>not</strong> collect, share or sell any personal data, and we receive no data from them.</li>
    <li>There are no accounts, no ads and no in-app purchases in our games, and no tracking or analytics SDKs of our own (see <a href="#third-parties">section 7</a> for the limited technical data the Unity engine itself may send on PC).</li>
    <li>Your save games and settings are stored only on your own device. We can&rsquo;t see them.</li>
    <li>Star Wayfarer for Android does not even request the Internet permission, so it cannot send data anywhere.</li>
    <li>If you email us, we use your email address only to reply. Ask us any time and we&rsquo;ll delete it.</li>
   </ul>
  </div>

  <nav class="toc" aria-label="Contents"><strong>Contents</strong>
   <ol>
    <li><a href="#who-we-are">Who we are</a></li>
    <li><a href="#scope">What this policy covers</a></li>
    <li><a href="#data-on-device">Data stored on your device</a></li>
    <li><a href="#data-we-collect">Data we collect</a></li>
    <li><a href="#use">How we use information</a></li>
    <li><a href="#sharing">Sharing and selling</a></li>
    <li><a href="#third-parties">Third-party platforms and services</a></li>
    <li><a href="#retention">Retention and deletion</a></li>
    <li><a href="#security">Security</a></li>
    <li><a href="#children">Children</a></li>
    <li><a href="#rights">Your rights</a></li>
    <li><a href="#star-wayfarer">Star Wayfarer (Android)</a></li>
    <li><a href="#omnivael">Omnivael: Wayfarers Life (PC)</a></li>
    <li><a href="#chronicles">Chronicles of the Realm (PC)</a></li>
    <li><a href="#changes">Changes to this policy</a></li>
    <li><a href="#contact">Contact us</a></li>
   </ol>
  </nav>

  <h2 id="who-we-are">1. Who we are</h2>
  <p>This Privacy Policy is published by <strong>{STUDIO}</strong> (&ldquo;Elder World Studio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), the developer of the games listed below. On Google Play and Steam our developer name may appear as &ldquo;Elder World Studio&rdquo; or &ldquo;Elder World Studio Inc&rdquo;; these all refer to us. Our Unity Asset Store publisher name is &ldquo;Elder Worlds Publishing&rdquo;.</p>
  <p>You can contact us about privacy at any time at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>

  <h2 id="scope">2. What this policy covers</h2>
  <p>This policy applies to:</p>
  <ul>
   <li><strong>Star Wayfarer</strong> for Android, distributed on Google Play (package name <code>com.elderworlds.starwayfarer</code>);</li>
   <li><strong>Omnivael: Wayfarers Life</strong> for PC, distributed on Steam;</li>
   <li><strong>Chronicles of the Realm</strong> for PC, distributed on Steam;</li>
   <li>our Unity Asset Store packages published as Elder Worlds Publishing; and</li>
   <li>this website, elderworldstudio.com.</li>
  </ul>
  <p>Together these are our &ldquo;Services&rdquo;. Game-specific details are in sections 12 to 14.</p>

  <h2 id="data-on-device">3. Data stored on your device</h2>
  <p>To work, our games save some information <strong>locally on your device</strong>, in the game&rsquo;s own private storage:</p>
  <ul>
   <li><strong>Save games</strong> (for example autosave and save slots), which contain your game progress and the in-game choices you make;</li>
   <li><strong>Your character&rsquo;s name</strong>, if you type one during character creation (it is only used inside the game);</li>
   <li><strong>Settings</strong> such as volume, graphics quality, control preferences and whether tutorials are shown; and</li>
   <li><strong>Local scores</strong>, such as a best score.</li>
  </ul>
  <p>This information never leaves your device through our games. It is not sent to us or to anyone else, and we have no access to it.</p>

  <h2 id="data-we-collect">4. Data we collect</h2>
  <h3>From our games</h3>
  <p><strong>None.</strong> Our games do not collect or transmit personal or sensitive information. They do not access your contacts, location, photos, files, camera, microphone, phone number, accounts, advertising ID or other device identifiers, and they do not ask for permissions to do so. They contain no advertising, analytics, crash-reporting or tracking SDKs of our own, no in-app purchases and no user accounts. Unity&rsquo;s own analytics services are turned off; the only exception is the engine-level hardware statistics described in <a href="#third-parties">section 7</a>, which can apply to our PC games and which we never receive.</p>
  <h3>When you contact us</h3>
  <p>If you email us, we receive your email address, your name if you include it, and whatever you choose to write (for example a bug report). We use this only to reply and help you.</p>
  <h3>This website</h3>
  <p>This website is a static site. It uses no cookies, no analytics, no advertising and no contact forms, and its fonts and images are served from this site itself. Like any website, our hosting provider automatically processes basic technical request data (such as IP address, browser type and the page requested) in order to deliver pages and protect the site from abuse. We do not use this data to identify or track you.</p>

  <h2 id="use">5. How we use information</h2>
  <ul>
   <li>Data stored on your device is used only by the game on that device, to save your progress and settings.</li>
   <li>Emails you send us are used only to respond to you, fix problems you report and improve our games.</li>
  </ul>
  <p>We do not use any information for advertising, profiling or automated decision-making.</p>

  <h2 id="sharing">6. Sharing and selling</h2>
  <p>We do <strong>not</strong> sell, rent or trade personal information, and we do not share it with third parties. The only exception is if we are required to disclose information by law, such as in response to a valid legal request.</p>

  <h2 id="third-parties">7. Third-party platforms and services</h2>
  <p>Our games are distributed through, and built with, the third-party services below. These companies act independently and handle data under their own privacy policies. We do not receive your personal data from them.</p>
  <ul>
   <li><strong>Google Play</strong> (Google LLC) distributes Star Wayfarer and handles your Google account, downloads and updates. See the <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a>. Star Wayfarer does not use Google Play Games services, Google sign-in, AdMob or Firebase.</li>
   <li><strong>Steam</strong> (Valve Corporation) distributes our PC games and handles your Steam account, purchases and downloads. See the <a href="https://store.steampowered.com/privacy_agreement/" rel="noopener">Valve Privacy Policy</a>. Our games do not currently integrate the Steamworks SDK (no achievements, cloud saves or Steam account data inside the game).</li>
   <li><strong>Unity</strong> (Unity Technologies) is the game engine our games are built with. Unity&rsquo;s optional online services (Unity Analytics, Unity Ads, In-App Purchasing and Cloud Diagnostics/crash reporting) are <strong>turned off</strong> in all of our games. On PC, the Unity engine itself may send limited, non-identifying technical information about your hardware and software (such as operating system, graphics card and engine version) to Unity. Star Wayfarer for Android has no Internet permission, so the engine cannot send anything from it. See the <a href="https://unity.com/legal/privacy-policy" rel="noopener">Unity Privacy Policy</a>.</li>
   <li><strong>Unity Asset Store</strong>: purchases of our asset packages are processed by Unity. We do not receive your payment details. See the <a href="https://unity.com/legal/privacy-policy" rel="noopener">Unity Privacy Policy</a>.</li>
  </ul>

  <h2 id="retention">8. Retention and deletion</h2>
  <ul>
   <li><strong>On-device game data</strong> stays on your device until you delete it. You can delete it at any time by uninstalling the game. On Android you can also go to <em>Settings &rarr; Apps &rarr; Star Wayfarer &rarr; Storage &rarr; Clear storage</em>. On Windows, uninstall the game in Steam and delete its folder under <code>%USERPROFILE%\\AppData\\LocalLow\\Elder Worlds Studio\\</code> (settings are kept under <code>HKEY_CURRENT_USER\\Software\\Elder Worlds Studio\\</code>).</li>
   <li><strong>Emails</strong> are kept only as long as needed to handle your request, and no longer than 24 months after our last exchange, unless the law requires otherwise.</li>
   <li><strong>To request deletion</strong> of any information we hold about you, email <a href="mailto:{EMAIL}?subject=Privacy%20request">{EMAIL}</a> with the subject &ldquo;Privacy request&rdquo;. We will confirm and delete it within 30 days. Because our games have no accounts and collect no data, there is no game account or server data to delete.</li>
  </ul>

  <h2 id="security">9. Security</h2>
  <p>Our games keep your data on your device, in storage that is private to the game, and do not send it over the network. Emails are kept in a password-protected business email account that only authorized studio staff can access. No method of storage or transmission is completely secure, but we take reasonable measures to protect the information we hold.</p>

  <h2 id="children">10. Children</h2>
  <p>Our Services are not directed at children under 13, and we do not knowingly collect personal information from anyone, including children. Our games collect no personal information from any player. If you believe a child has sent us personal information by email, contact us and we will delete it promptly.</p>

  <h2 id="rights">11. Your rights</h2>
  <p>Depending on where you live (for example in the European Economic Area, the United Kingdom or California), you may have the right to access, correct, delete or obtain a copy of your personal information, to object to or restrict its processing, and to complain to a data protection authority. Since our games collect no personal data, these rights mainly apply to emails you send us. To exercise any of them, email <a href="mailto:{EMAIL}">{EMAIL}</a>. We will not discriminate against you for exercising your rights. We do not sell or share personal information as defined by California law.</p>

  <h2 id="star-wayfarer">12. Star Wayfarer (Android)</h2>
  <div class="table-wrap"><table>
   <tr><th>App</th><td>Star Wayfarer, package <code>com.elderworlds.starwayfarer</code>, on Google Play</td></tr>
   <tr><th>Developer</th><td>{STUDIO} (shown as &ldquo;Elder World Studio&rdquo;)</td></tr>
   <tr><th>Personal or sensitive data collected</th><td>None</td></tr>
   <tr><th>Data shared with third parties</th><td>None</td></tr>
   <tr><th>Android permissions</th><td>No dangerous or network permissions. The app does <strong>not</strong> request Internet, location, camera, microphone, contacts, storage, phone or notification permissions.</td></tr>
   <tr><th>Stored on your device only</th><td>Save games (autosave and save slots), your character&rsquo;s name, game settings and control preferences</td></tr>
   <tr><th>Ads, analytics, crash reporting</th><td>None</td></tr>
   <tr><th>In-app purchases and accounts</th><td>None</td></tr>
   <tr><th>How to delete your data</th><td>Uninstall the app, or use Settings &rarr; Apps &rarr; Star Wayfarer &rarr; Storage &rarr; Clear storage</td></tr>
  </table></div>
  <p>If a future version of Star Wayfarer adds online features, purchases, ads or analytics, we will update this policy and the app&rsquo;s Google Play Data safety section before that version is released.</p>

  <h2 id="omnivael">13. Omnivael: Wayfarers Life (PC)</h2>
  <p>Omnivael: Wayfarers Life collects no personal data and contains no ads, accounts, online features or analytics SDKs of our own (see section 7 for the Unity engine&rsquo;s hardware statistics on PC). Save games (three manual slots and an autosave) and settings are stored locally on your computer. Steam handles distribution as described in section 7.</p>

  <h2 id="chronicles">14. Chronicles of the Realm (PC)</h2>
  <p>Chronicles of the Realm collects no personal data and contains no ads, accounts, online features or analytics SDKs of our own (see section 7 for the Unity engine&rsquo;s hardware statistics on PC). Your settings and best score are stored locally on your computer. Steam handles distribution as described in section 7.</p>

  <h2 id="changes">15. Changes to this policy</h2>
  <p>We may update this policy from time to time, for example when we release a new game or add a feature. We will post the updated policy on this page and change the &ldquo;Last updated&rdquo; date at the top. If a change affects how any of our games handle your data, we will update this policy before that change is released.</p>

  <h2 id="contact">16. Contact us</h2>
  <p>If you have any questions about this Privacy Policy or want to make a privacy request, contact:</p>
  <p><strong>{STUDIO}</strong><br>Email: <a href="mailto:{EMAIL}">{EMAIL}</a><br>Website: <a href="{DOMAIN}/">elderworldstudio.com</a></p>
 </article>
</div></div>
"""

NOTFOUND = """
<section class="nf"><div class="wrap">
 <h1 style="color:var(--accent)">Page not found</h1>
 <p class="lead" style="margin:0 auto 24px">The page you were looking for doesn&rsquo;t exist or has moved.</p>
 <div class="btns"><a class="btn btn-primary" href="/">Go to the home page</a><a class="btn btn-ghost" href="/privacy-policy/">Privacy Policy</a></div>
</div></section>
"""

PDESC = f"Privacy Policy for {STUDIO} and its games, including Star Wayfarer on Google Play: what data our games store, collect and share (none), retention, deletion and contact."
page("index.html", f"{STUDIO} | Games and Developer Assets", f"{STUDIO} makes PC and mobile games, including Star Wayfarer on Google Play and Omnivael: Wayfarers Life on Steam, and Unity assets for developers.", HOME, "/", "home")
page("contact/index.html", f"Contact | {STUDIO}", f"Contact {STUDIO} for support, privacy requests and business enquiries.", CONTACT, "/contact/", "contact")
for p in ["privacy-policy/index.html", "privacy/index.html", "privacy-policy.html", "privacy.html", "star-wayfarer/privacy/index.html", "star-wayfarer/privacy-policy/index.html"]:
    page(p, f"Privacy Policy | {STUDIO}", PDESC, POLICY, "/privacy-policy/", "privacy")

# ---- Merch page (store links live in tools/merch_config.py) ----
import html as _h, sys as _sys
_sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import merch_config as MC
MERCH_IMG_V = "2"  # bump when the merch mockup images change (cache-bust)
def _merch_body():
    live = bool(MC.STORE_URL)
    cards = []
    for it in MC.PRODUCTS:
        url = it.get("url") or MC.STORE_URL
        if live and url:
            tag = '<span class="tag live">Available now</span>'
            btn = f'<a class="btn btn-primary" href="{_h.escape(url)}" rel="noopener">Buy &middot; {_h.escape(it["price"])}</a>'
        else:
            subj = f'Notify me: {it["name"]}'.replace('\u201c','"').replace('\u201d','"')
            from urllib.parse import quote
            mail = f'mailto:{MC.NOTIFY_EMAIL}?subject={quote(subj)}&body={quote("Please email me when this is available. Size (if apparel): ")}'
            tag = '<span class="tag soon">Coming soon</span>'
            btn = f'<a class="btn btn-ghost" href="{mail}">Notify me</a>'
        cards.append(f"""   <article class="card merch" id="{it['id']}">
    <img class="thumb sq" src="{{P}}assets/img/merch/{it['img']}?v={MERCH_IMG_V}" width="900" height="900" alt="{_h.escape(it['name'])} preview" loading="lazy">
    <div class="body">
     {tag}
     <h3>{_h.escape(it['name'])}</h3>
     <p class="meta">{_h.escape(it['game'])}</p>
     <p>{_h.escape(it['desc'])}</p>
     <div class="actions"><span class="price">{_h.escape(it['price'])}</span>{btn}</div>
    </div>
   </article>""")
    if live:
        top = f'<div class="btns"><a class="btn btn-primary" href="{_h.escape(MC.STORE_URL)}" rel="noopener">Visit the store</a></div>'
        note = f'Orders are printed on demand and shipped by {_h.escape(MC.STORE_NAME)}, which also handles checkout, sales tax and order support.'
    else:
        from urllib.parse import quote
        top = f'<div class="btns"><a class="btn btn-primary" href="mailto:{MC.NOTIFY_EMAIL}?subject={quote("Notify me when the merch store opens")}">Email me when it opens</a><a class="btn btn-ghost" href="#lineup">See the lineup</a></div>'
        note = 'The store is opening soon. Tap &ldquo;Notify me&rdquo; to send us a quick email and we&rsquo;ll write back once it&rsquo;s live. Prices are planned launch prices in USD and may change slightly.'
    return f"""
<section class="hero merch-hero">
 <div class="wrap">
  <img class="logo" src="{{P}}assets/img/logo-gold.png?v=3" width="256" height="297" alt="Elder World Studio crest">
  <h1>Studio Merch</h1>
  <p>Wear the worlds we build. Every order helps fund development of Omnivael, Star Wayfarer and Chronicles of the Realm.</p>
  {top}
 </div>
</section>
<section class="block" id="lineup">
 <div class="wrap">
  <div class="center"><h2>The Launch Lineup</h2><p class="lead">{note}</p></div>
  <div class="grid cards">
{chr(10).join(cards)}
  </div>
  <p class="meta center" style="margin-top:28px">Print-on-demand: each item is made when you order it, so nothing goes to waste. Questions? <a href="mailto:{MC.NOTIFY_EMAIL}">{MC.NOTIFY_EMAIL}</a></p>
 </div>
</section>
"""
page("merch/index.html", f"Merch | {STUDIO}", f"Official {STUDIO} merch: crest tees and hoodies, Omnivael, Star Wayfarer and Chronicles of the Realm designs, mugs and stickers.", _merch_body(), "/merch/", "merch")
# 404 uses root-absolute links (served for any missing path)
page("404.html", f"Page not found | {STUDIO}", "Page not found.", NOTFOUND, "/404.html", noindex=True)
p404 = ROOT / "404.html"
t = p404.read_text().replace('href="favicon.png', 'href="/favicon.png').replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/').replace('href="index.html', 'href="/index.html').replace('href="contact/', 'href="/contact/').replace('href="merch/', 'href="/merch/').replace('href="privacy-policy/index.html"', 'href="/privacy-policy/"').replace('href="mailto', 'href="mailto')
p404.write_text(t)
print("built", sum(1 for _ in ROOT.rglob("*.html")), "html files")
