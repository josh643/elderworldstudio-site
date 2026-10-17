#!/usr/bin/env python3
"""Generates the static site in ../site. Plain HTML output, no runtime build step needed.
Run: python3 tools/build.py"""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent / "site"
DOMAIN = "https://elderworldstudio.com"
STUDIO = "Elder World Studio Inc"
EMAIL = "annaews@agentmail.to"
EFFECTIVE = "October 8, 2026"
# Attribution (see /workspace/marketing/attribution.md): outbound store links from our own site carry utm_source=website.
def utm(url, campaign, source="website", medium="site", content=None):
    q = f"utm_source={source}&utm_medium={medium}&utm_campaign={campaign}" + (f"&utm_content={content}" if content else "")
    return url + ("&" if "?" in url else "?") + q
def play_ref(url, campaign, source="website", medium="site"):
    from urllib.parse import quote
    return url + "&referrer=" + quote(f"utm_source={source}&utm_medium={medium}&utm_campaign={campaign}", safe="")
PLAY_SW = play_ref("https://play.google.com/store/apps/details?id=com.elderworlds.starwayfarer", "star-wayfarer")
PLAY_ASTRO = play_ref("https://play.google.com/store/apps/details?id=com.elderworldstudio.astrododge", "astro-dodge")
PLAY_TEST_ASTRO = "https://play.google.com/apps/testing/com.elderworldstudio.astrododge"
PLAY_TEST_STACK = "https://play.google.com/apps/testing/com.elderworldstudio.stacktower"
EWS_TESTERS_GROUP = "https://groups.google.com/g/ews_testers"
EWS_TESTERS_EMAIL = "ews_testers@googlegroups.com"
STEAM_OMNI = utm("https://store.steampowered.com/app/4121760/", "omnivael")
STEAM_COTR = utm("https://store.steampowered.com/app/2559510/", "chronicles")

def page(path, title, desc, body, canonical, current="", noindex=False):
    depth = path.count("/")  # e.g. "privacy-policy/index.html" -> 1
    P = "../" * depth
    nav = [("index.html", "Home", "home"), ("games/index.html", "Games", "games"),
           ("index.html#tools", "Assets", "tools"), ("testers/index.html", "Testers", "testers"), ("merch/index.html", "Merch", "merch"), ("services/index.html", "Services", "services"), ("contact/index.html", "Contact", "contact"),
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
<link rel="icon" type="image/svg+xml" href="{P}assets/img/brand/ews-mark.svg?v=4">
<link rel="icon" type="image/png" sizes="32x32" href="{P}favicon.png?v=4">
<link rel="apple-touch-icon" href="{P}apple-touch-icon.png?v=4">
<meta name="theme-color" content="#0A0614">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{STUDIO}">
<meta property="og:url" content="{DOMAIN}{canonical}">
<meta property="og:image" content="{DOMAIN}/assets/img/brand/ews-og.png?v=4">
<link rel="preload" href="{P}assets/fonts/michroma.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="{P}assets/css/site.css?v=5">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
 <div class="wrap">
  <a class="brand" href="{P}index.html"><img src="{P}assets/img/brand/ews-mark.svg?v=4" width="36" height="36" alt=""><span>{STUDIO}</span></a>
  <nav class="nav" aria-label="Main">{navhtml}</nav>
 </div>
</header>
<main id="main">
{body.replace("{P}", P)}
</main>
<footer class="site-footer">
 <div class="wrap">
  <div>&copy; 2026 {STUDIO}. All rights reserved.</div>
  <nav aria-label="Footer"><a href="{P}games/index.html">Games</a><a href="{P}testers/index.html">Testers</a><a href="{P}services/index.html">Services</a><a href="{P}merch/index.html">Merch</a><a href="{P}contact/index.html">Contact</a><a href="{P}privacy-policy/index.html">Privacy Policy</a><a href="mailto:{EMAIL}">{EMAIL}</a></nav>
 </div>
</footer>
{'<script src="/office/boot.js?v=30" defer></script>' if path == "index.html" else ""}
</body>
</html>
"""
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

HOME = f"""
<section class="hero">
 <div class="wrap">
  <img class="logo" src="{{P}}assets/img/brand/ews-mark.svg?v=4" width="256" height="256" alt="Elder World Studio logo">
  <h1>Forging Digital Realms</h1>
  <p>{STUDIO} is a game development studio that blends the enchanting aesthetics of medieval worlds with the power of modern technology. We make PC and mobile games, and assets for other developers.</p>
  <div class="btns"><a class="btn btn-primary" href="#games">View Our Games</a><a class="btn btn-ghost" href="{{P}}contact/index.html">Get in Touch</a></div>
 </div>
</section>

<section class="block" id="games">
 <div class="wrap">
  <div class="center"><h2>Our Games</h2><p class="lead">Immersive worlds for PC and mobile. <a class="link" href="{{P}}games/index.html">See all our games</a></p></div>
  <div class="grid cards">
   <article class="card">
    <img class="thumb" src="{{P}}assets/img/star-wayfarer.jpg" width="1024" height="576" alt="Star Wayfarer title screen with a starship in space" loading="lazy">
    <div class="body">
     <span class="tag live">Out now on Google Play</span>
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
  <div class="panel center">
   <h3>Need a Website or AI Tool?</h3>
   <p>We also build websites, AI chat assistants, automations and custom software for small businesses. We start with a demo.</p>
   <a class="btn btn-primary" href="{{P}}services/index.html">See Services</a>
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
   <h3>Websites, AI tools &amp; software</h3>
   <p>Want us to build something for your business? Tell us about it on our <a class="link" href="{{P}}services/index.html#request">Services page</a> and we&rsquo;ll start with a demo.</p>
  </div>
  <div class="panel">
   <h3>Privacy &amp; data requests</h3>
   <p>To ask what data we hold about you or to have it deleted, email us with the subject &ldquo;Privacy request&rdquo;. Details are in our <a href="{{P}}privacy-policy/index.html">Privacy Policy</a>.</p>
  </div>
  <div class="panel">
   <h3>Find our games</h3>
   <p><a class="link" href="{PLAY_SW}" rel="noopener">Star Wayfarer: out now on Google Play</a><br>
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
  <p class="meta">{STUDIO} &middot; Effective date: {EFFECTIVE} &middot; Last updated: October 9, 2026</p>
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
  <p>This website is a static site. It uses no cookies, no analytics and no advertising, and its fonts and images are served from this site itself. Like any website, our hosting provider automatically processes basic technical request data (such as IP address, browser type and the page requested) in order to deliver pages and protect the site from abuse. We do not use this data to identify or track you. If you use the request form on our Services page, the details you enter (name, email, optional phone, business, and your message) are emailed to us and used only to reply to your request; the form uses Cloudflare Turnstile to block spam. Ask us any time and we&rsquo;ll delete it.</p>

  <h2 id="use">5. How we use information</h2>
  <ul>
   <li>Data stored on your device is used only by the game on that device, to save your progress and settings.</li>
   <li>Emails you send us are used only to respond to you, fix problems you report and improve our games.</li>
  </ul>
  <p>We do not use any information for advertising, profiling or automated decision-making.</p>

  <h2 id="sharing">6. Sharing and selling</h2>
  <p>We do <strong>not</strong> sell, rent or trade personal information, and we do not share it with third parties. No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties. The only exception is if we are required to disclose information by law, such as in response to a valid legal request.</p>

  <h2 id="third-parties">7. Third-party platforms and services</h2>
  <p>Our games are distributed through, and built with, the third-party services below. These companies act independently and handle data under their own privacy policies. We do not receive your personal data from them.</p>
  <ul>
   <li><strong>Google Play</strong> (Google LLC) distributes Star Wayfarer and handles your Google account, downloads and updates. See the <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a>. Star Wayfarer does not use Google Play Games services, Google sign-in, AdMob or Firebase.</li>
   <li><strong>Steam</strong> (Valve Corporation) distributes our PC games and handles your Steam account, purchases and downloads. See the <a href="https://store.steampowered.com/privacy_agreement/" rel="noopener">Valve Privacy Policy</a>. Our games do not currently integrate the Steamworks SDK (no achievements, cloud saves or Steam account data inside the game).</li>
   <li><strong>Unity</strong> (Unity Technologies) is the game engine our games are built with. Unity&rsquo;s optional online services (Unity Analytics, Unity Ads, In-App Purchasing and Cloud Diagnostics/crash reporting) are <strong>turned off</strong> in all of our games. On PC, the Unity engine itself may send limited, non-identifying technical information about your hardware and software (such as operating system, graphics card and engine version) to Unity. Star Wayfarer for Android has no Internet permission, so the engine cannot send anything from it. See the <a href="https://unity.com/legal/privacy-policy" rel="noopener">Unity Privacy Policy</a>.</li>
   <li><strong>Unity Asset Store</strong>: purchases of our asset packages are processed by Unity. We do not receive your payment details. See the <a href="https://unity.com/legal/privacy-policy" rel="noopener">Unity Privacy Policy</a>.</li>
  </ul>

  <h3 id="sms">Text messages (SMS)</h3>
  <p>If you tick the optional SMS consent checkbox on our Services form, we may text the phone number you gave us about that request only (for example to confirm we received it or to schedule your demo). Message frequency varies (up to 4 messages per request). Message and data rates may apply. Reply STOP to opt out at any time and HELP for help. Texts are sent through our SMS provider (Twilio Inc.), which processes your number only to deliver messages. <strong>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</strong> See our <a href="{{P}}sms-terms/index.html">SMS Terms</a>.</p>

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

SERVICES = f"""
<div class="page"><div class="wrap">
 <div class="page-head"><h1>Services</h1><p class="meta">Websites, AI tools and custom software for small businesses &middot; based in Memphis, TN</p></div>
 <div class="panel" style="margin-bottom:24px"><h3 style="color:var(--accent)">Demo first</h3>
  <p>Tell us what you need. We build a quick demo of it for your business and share it by link. You only decide on anything after you&rsquo;ve seen it working. No pressure and no obligation.</p></div>
 <div class="grid contact-grid">
  <div class="panel"><h3>Websites</h3><p>New sites, refreshes and fixes: mobile-friendly pages, online booking, menus, quote forms and simple online stores.</p></div>
  <div class="panel"><h3>AI tools &amp; chat assistants</h3><p>A chat assistant on your site that answers questions from your hours, menu and prices 24/7, takes requests and emails real leads to you.</p><p><a class="link" href="https://ews-ai-assistant.pages.dev/" target="_blank" rel="noopener">Try a live demo &rarr;</a> <small>(sample businesses)</small></p></div>
  <div class="panel"><h3>Automation</h3><p>Stop retyping things. We connect forms, email, spreadsheets and the tools you already use so routine work happens on its own.</p></div>
  <div class="panel"><h3>Custom software &amp; dashboards</h3><p>Internal tools, client portals and dashboards that replace paper forms and messy spreadsheets.</p></div>
 </div>
 <h2 id="request" style="margin-top:40px">Request a demo</h2>
 <div id="form-status" class="panel" hidden style="margin-bottom:16px"></div>
 <form class="panel lead-form" method="post" action="/api/lead">
  <label>Your name *<input name="name" required maxlength="100" autocomplete="name"></label>
  <label>Email *<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
  <label>Phone (optional)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>
  <label>Business name *<input name="business" required maxlength="150" autocomplete="organization"></label>
  <label>What do you need? *<select name="type" required><option>Website</option><option>AI tool</option><option>Custom software</option><option selected>Not sure</option></select></label>
  <label>Tell us about it *<textarea name="description" required maxlength="4000" rows="6" placeholder="What does your business do, and what would you like to fix or build?"></textarea></label>
  <label>Budget (optional)<input name="budget" maxlength="60" placeholder="e.g. under $500, not sure yet"></label>
  <label class="sms-opt"><input type="checkbox" name="sms_optin" value="yes"> <span>By checking this box, I agree to receive text messages from Elder World Studio about my service request (confirmations, project questions, and demo scheduling). Up to 4 msgs per request. Message and data rates may apply. Reply STOP to opt out and HELP for help. Optional &mdash; not required to get a demo. <a class="link" href="{{P}}sms-terms/index.html">SMS Terms</a> &middot; <a class="link" href="{{P}}privacy-policy/index.html#sms">Privacy Policy</a></span></label>
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website_url" tabindex="-1" autocomplete="off"></label></div>
  <input type="hidden" name="t" id="lead-t" value="">
  <div class="cf-turnstile" data-sitekey="0x4AAAAAAFS0QVr90yy4iuW9" data-theme="dark"></div>
  <button class="btn btn-primary" type="submit">Request my demo</button>
  <p class="meta">We reply by email, usually within one business day. We only use your details to answer your request (see our <a href="{{P}}privacy-policy/index.html">Privacy Policy</a>).</p>
 </form>
</div></div>
<style>.lead-form{{display:grid;gap:14px;max-width:640px}}.lead-form label{{display:grid;gap:6px;font-weight:600}}.lead-form input,.lead-form select,.lead-form textarea{{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:#130B22;color:inherit}}.lead-form .sms-opt{{display:flex;gap:10px;align-items:flex-start;font-weight:400}}.lead-form .sms-opt input{{width:auto;margin-top:4px}}.lead-form .hp{{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>document.getElementById('lead-t').value=Date.now();(function(){{var q=new URLSearchParams(location.search),s=document.getElementById('form-status');if(!q.has('sent'))return;s.hidden=false;s.textContent=q.get('sent')==='1'?'Thanks! Your request was sent. We will reply by email soon.':('Sorry, that did not go through: '+(q.get('e')||'please try again')+' You can also email annaews@agentmail.to.');}})();</script>
"""
SMSTERMS = f"""
<div class="section"><div class="wrap">
 <article class="policy">
  <h1>SMS Terms and Conditions</h1>
  <p class="meta">Last updated: October 11, 2026</p>
  <p><strong>Program:</strong> Elder World Studio project updates. {STUDIO} sends text messages only to people who request a website, AI tool or software demo on our <a href="{{P}}services/index.html">Services page</a> and tick the optional SMS consent checkbox (messages about your service request; up to 4 msgs per request; Message and data rates may apply; Reply STOP to opt out and HELP for help).</p>
  <ul>
   <li><strong>Program description:</strong> one-to-one, non-marketing texts about a service request you submitted to Elder World Studio.</li>
   <li><strong>What you get:</strong> messages about your request, such as confirming we received it, questions about your project, and scheduling your demo. No marketing blasts.</li>
   <li><strong>Frequency:</strong> varies, up to 4 messages per request.</li>
   <li><strong>Cost:</strong> Msg &amp; data rates may apply.</li>
   <li><strong>Opt out:</strong> reply <strong>STOP</strong> at any time. You will get one confirmation and no further texts.</li>
   <li><strong>Help:</strong> reply <strong>HELP</strong>, or email <a href="mailto:{EMAIL}">{EMAIL}</a>.</li>
   <li><strong>Consent is optional</strong> and is not a condition of any purchase or of getting a demo.</li>
   <li>Carriers are not liable for delayed or undelivered messages.</li>
   <li><strong>Privacy:</strong> No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties. See our <a href="{{P}}privacy-policy/index.html#sms">Privacy Policy</a>.</li>
  </ul>
  <p><strong>{STUDIO}</strong><br>Email: <a href="mailto:{EMAIL}">{EMAIL}</a><br>Website: <a href="{DOMAIN}/">elderworldstudio.com</a></p>
 </article>
</div></div>
"""
page("sms-terms/index.html", f"SMS Terms | {STUDIO}", f"SMS terms for {STUDIO} project-update texts: opt-in, frequency, STOP and HELP, privacy.", SMSTERMS, "/sms-terms/", "sms")
page("terms/index.html", f"Terms and Conditions (SMS) | {STUDIO}", f"SMS terms and conditions for {STUDIO} project-update texts.", SMSTERMS, "/sms-terms/", "sms")
page("services/index.html", f"Services: Websites, AI Tools and Custom Software | {STUDIO}", f"{STUDIO} builds websites, AI chat assistants, automation and custom software for small businesses in Memphis and beyond. Start with a demo.", SERVICES, "/services/", "services")


# ---- Public Android testers (Google Play closed/open testing) ----
TESTERS = f"""
<section class="hero">
 <div class="wrap">
  <img class="logo" src="{{P}}assets/img/brand/ews-mark.svg?v=4" width="256" height="256" alt="Elder World Studio logo">
  <h1>Become a Public Tester</h1>
  <p>Help Elder World Studio shape our Android games before launch. Join the free tester group, opt in on Google Play, and tell us what breaks, what feels great, and what you want next.</p>
  <div class="btns">
   <a class="btn btn-primary" href="{EWS_TESTERS_GROUP}" rel="noopener">Join ews_testers</a>
   <a class="btn btn-ghost" href="#games">See the games</a>
  </div>
 </div>
</section>

<section class="block" id="how">
 <div class="wrap">
  <div class="center"><h2>How it works</h2><p class="lead">Three free steps. Android + a Google account only. No paid ads, no payment required.</p></div>
  <div class="grid cards">
   <article class="card"><div class="body">
    <span class="tag soon">Step 1</span>
    <h3>Join the Google Group</h3>
    <p>Join <strong>{EWS_TESTERS_EMAIL}</strong>. Play uses this public group to decide who can install our closed tests.</p>
    <div class="actions"><a class="btn btn-primary" href="{EWS_TESTERS_GROUP}" rel="noopener">Join the group</a></div>
   </div></article>
   <article class="card"><div class="body">
    <span class="tag soon">Step 2</span>
    <h3>Opt in on Google Play</h3>
    <p>Open each game&rsquo;s Play testing link below, accept the tester invitation, then install from the Play Store.</p>
    <div class="actions"><a class="btn btn-ghost" href="#games">Jump to games</a></div>
   </div></article>
   <article class="card"><div class="body">
    <span class="tag soon">Step 3</span>
    <h3>Play and send feedback</h3>
    <p>Crash? Confusing UI? A feature you love? Email <a href="mailto:{EMAIL}">{EMAIL}</a> with the game name and your device. We read every note.</p>
   </div></article>
  </div>
 </div>
</section>

<section class="block alt" id="games">
 <div class="wrap">
  <div class="center"><h2>Games open for testers</h2><p class="lead">Tap Join test, then install. Links need the Google account that joined the group.</p></div>
  <div class="grid cards">
   <article class="card"><div class="body">
    <span class="tag live">Open for testers</span>
    <h3>Astro Dodge</h3>
    <p>Neon arcade dodger. Steer through asteroids, chase high scores, play offline. Shows ads in the test build.</p>
    <div class="actions"><a class="btn btn-primary" href="{PLAY_TEST_ASTRO}" rel="noopener">Join Astro Dodge test</a></div>
   </div></article>
   <article class="card"><div class="body">
    <span class="tag live">Open for testers</span>
    <h3>Stack Tower</h3>
    <p>Timing and precision. Drop moving blocks, keep the tower climbing, beat your best score. Shows ads in the test build.</p>
    <div class="actions"><a class="btn btn-primary" href="{PLAY_TEST_STACK}" rel="noopener">Join Stack Tower test</a></div>
   </div></article>
   <article class="card"><div class="body">
    <span class="tag soon">Coming soon</span>
    <h3>More EWS Android games</h3>
    <p>Color Gate, Neon Snake, Brick Blitz, Crystal Merge, Gem Hopper, Void Flip and Omnivael Wayfarer&rsquo;s Life will land here as their Play apps open for testing.</p>
   </div></article>
  </div>
 </div>
</section>

<section class="block" id="honest">
 <div class="wrap grid two">
  <div>
   <h2>What testers actually do</h2>
   <p class="lead">This is unpaid, optional, and honest about what we need.</p>
   <ul class="prose" style="color:var(--soft);padding-left:1.2em">
    <li>Install early Android builds from Google Play closed testing.</li>
    <li>Play for a few minutes (or longer if you enjoy it).</li>
    <li>Tell us about crashes, confusing screens, balance issues, or anything that feels off.</li>
    <li>You can leave the group or opt out of a test any time in Play Console / Play Store.</li>
   </ul>
  </div>
  <div class="panel">
   <h3>What we will not do</h3>
   <ul style="color:var(--soft);padding-left:1.2em;margin:0">
    <li>We will not charge you to test.</li>
    <li>We will not require a review or rating.</li>
    <li>We will not run paid ads to recruit testers.</li>
    <li>Test builds may show ads (Unity Ads test mode or live ads later). Say so if that is a problem for you.</li>
    <li>Builds can be rough, incomplete, or wipe progress between versions.</li>
   </ul>
   <p class="meta" style="margin-top:16px">Questions? <a href="mailto:{EMAIL}">{EMAIL}</a> &middot; <a href="{{P}}privacy-policy/index.html">Privacy Policy</a></p>
  </div>
 </div>
</section>
"""
page("testers/index.html", f"Public Testers | {STUDIO}", f"Join Elder World Studio's free public Android testers. Opt in on Google Play for Astro Dodge, Stack Tower, and more EWS games.", TESTERS, "/testers/", "testers")

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
        url = utm(url, "merch", content=it["id"]) if url else url
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
        top = f'<div class="btns"><a class="btn btn-primary" href="{_h.escape(utm(MC.STORE_URL, "merch", content="store-home"))}" rel="noopener">Visit the store</a></div>'
        note = f'Orders are printed on demand and shipped by {_h.escape(MC.STORE_NAME)}, which also handles checkout, sales tax and order support.'
    else:
        from urllib.parse import quote
        top = f'<div class="btns"><a class="btn btn-primary" href="mailto:{MC.NOTIFY_EMAIL}?subject={quote("Notify me when the merch store opens")}">Email me when it opens</a><a class="btn btn-ghost" href="#lineup">See the lineup</a></div>'
        note = 'The store is opening soon. Tap &ldquo;Notify me&rdquo; to send us a quick email and we&rsquo;ll write back once it&rsquo;s live. Prices are planned launch prices in USD and may change slightly.'
    return f"""
<section class="hero merch-hero">
 <div class="wrap">
  <img class="logo" src="{{P}}assets/img/brand/ews-mark.svg?v=4" width="256" height="256" alt="Elder World Studio logo">
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

def _gcard(name, tag, desc, img=None, kind="shot", actions="", alt=""):
    import html as _h
    media = (f'<div class="gmedia {kind}"><img src="{{P}}assets/img/games/{img}" alt="{_h.escape(alt)}" loading="lazy"></div>' if img
             else f'<div class="gmedia text"><span>{_h.escape(name)}</span></div>')
    return f"""   <article class="card game">
    {media}
    <div class="body">
     {tag}
     <h3>{_h.escape(name)}</h3>
     <p>{desc}</p>
     {f'<div class="actions">{actions}</div>' if actions else ''}
    </div>
   </article>"""
SOON = '<span class="tag soon">Coming soon to Google Play</span>'
CASUAL = [
 ("Tile 2048", None, None, "Slide and merge numbered tiles to reach 2048."),
 ("Brick Blitz", "brick-blitz.jpg", "shot", "Bounce the ball, break neon bricks, and clear arcade levels."),
 ("Color Gate", None, None, "Match your color to pass through the right gates."),
 ("Crystal Merge", "crystal-merge.jpg", "shot", "Merge glowing crystals, make combos, and grow your score in a neon puzzle."),
 ("Gem Hopper", "gem-hopper-icon.png", "icon", "Tap to hop between floating gems and build your best score."),
 ("Neon Snake", None, None, "The classic snake game, in neon."),
 ("Spiral Drop", None, None, "Drop down the spiral tower without hitting the hazards."),
 ("Stack Tower", None, None, "Time your taps to stack blocks as high as you can."),
 ("Void Flip", None, None, "Tap to reverse gravity and guide a neon probe through energy gates."),
]
GAMES = f"""
<section class="hero games-hero">
 <div class="wrap">
  <h1>Our Games</h1>
  <p>PC and mobile games made by {STUDIO}.</p>
  <div class="btns"><a class="btn btn-ghost" href="#live">Out now</a><a class="btn btn-ghost" href="#bigger">Bigger games</a><a class="btn btn-ghost" href="#casual">Casual games</a></div>
 </div>
</section>
<section class="block" id="live">
 <div class="wrap">
  <div class="center"><h2>Out Now</h2></div>
  <div class="grid cards">
{_gcard("Astro Dodge", '<span class="tag live">On Google Play</span>', "Steer your ship through an endless field of asteroids, grab power-ups and chase your best score.", "astro-dodge-icon.png", "icon", f'<a class="btn btn-primary" href="{PLAY_ASTRO}" rel="noopener">Get it on Google Play</a>', "Astro Dodge app icon")}
{_gcard("Star Wayfarer", '<span class="tag live">On Google Play</span>', "An open space adventure built for mobile. Fly, trade, mine and fight across the stars, land on planets, and build your crew, fleet and empire.", "../star-wayfarer.jpg", "wide", f'<a class="btn btn-primary" href="{PLAY_SW}" rel="noopener">Get it on Google Play</a><a class="link" href="{{P}}star-wayfarer/privacy/index.html">Privacy</a>', "Star Wayfarer title screen")}
  </div>
 </div>
</section>
<section class="block alt" id="bigger">
 <div class="wrap">
  <div class="center"><h2>Bigger Games</h2></div>
  <div class="grid cards">
{_gcard("Omnivael: Wayfarer's Life", '<span class="tag soon">Early Access &middot; Coming to Steam</span>', "A living sandbox RPG where your legacy unfolds through trade, exploration, relationships and time itself, in a medieval frontier whose economy runs on its people.", "../omnivael.jpg", "wide", f'<a class="btn btn-primary" href="{STEAM_OMNI}" rel="noopener">View on Steam</a>', "Omnivael key art")}
{_gcard("Chronicles of the Realm", '<span class="tag soon">Free &middot; Coming to Steam</span>', "A free first-person dungeon game set in the world of Omnivael. Take up sword and shield, survive wave after wave of slimes and goblins in a torch-lit cave, and pick a boon between waves.", "../chronicles-of-the-realm.jpg", "wide", f'<a class="btn btn-primary" href="{STEAM_COTR}" rel="noopener">View on Steam</a>', "Chronicles of the Realm: fighting slimes in a torch-lit cave arena")}
  </div>
 </div>
</section>
<section class="block" id="casual">
 <div class="wrap">
  <div class="center"><h2>Casual Games</h2><p class="lead">Quick, free arcade and puzzle games for Android. Coming soon to Google Play.</p></div>
  <div class="grid cards casual">
{chr(10).join(_gcard(n, SOON, d, i, k, alt=f"{n} screenshot" if k=="shot" else f"{n} app icon") for n,i,k,d in CASUAL)}
  </div>
 </div>
</section>
"""
page("games/index.html", f"Games | {STUDIO}", f"Games by {STUDIO}: Astro Dodge and Star Wayfarer on Google Play, Omnivael and Chronicles of the Realm on Steam, and casual mobile games coming soon.", GAMES, "/games/", "games")
# 404 uses root-absolute links (served for any missing path)
page("404.html", f"Page not found | {STUDIO}", "Page not found.", NOTFOUND, "/404.html", noindex=True)
p404 = ROOT / "404.html"
t = p404.read_text().replace('href="favicon.png', 'href="/favicon.png').replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/').replace('href="index.html', 'href="/index.html').replace('href="contact/', 'href="/contact/').replace('href="merch/', 'href="/merch/').replace('href="privacy-policy/index.html"', 'href="/privacy-policy/"').replace('href="mailto', 'href="mailto')
p404.write_text(t)
print("built", sum(1 for _ in ROOT.rglob("*.html")), "html files")
import subprocess, sys; subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("office_data.py"))], check=True)
