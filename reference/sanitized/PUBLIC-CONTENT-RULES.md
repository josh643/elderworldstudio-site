# EWS Virtual Campus: Public Content Rules

Applies to every texture, screen, sign, label, nameplate, and live feed in the in-office build, on every floor (G to 5 and future floors).

1. **Dev Logs wall shows only posts that are already public.** Feed it from published YouTube, Steam or Bluesky devlogs and elderworldstudio.com posts. Never feed it from the internal pipeline, deploy logs, error logs, commit messages or agent task text.
2. **No live system telemetry.** No CPU, temperatures, node counts, power, uptime, IPs, hostnames, CT/VM numbers, GPU or server specs. The data center wing is decoration only: racks may glow, but they show no readouts.
3. **Desk and wall screens use generic UI.** Use stylized code-like blur, art boards, or public game art. Never show real code, repos, tickets, file paths, dashboards or terminals.
4. **No internal tool names.** Command Center, ATLAS internals, Penpot, Proxmox, Piper, RunPod, Supabase, Stripe dashboards and similar names never appear.
5. **Agent identities stay private.** Nameplates and signs use roles ("Team", "Game coder", "Games lead"). Freyja (receptionist) is the only named public character. No Norse agent names on signs or shops (for example, "Merch Store", not "Hermod's Merch Store").
6. **No client names or client work.** Use sample businesses only (for example, "Fresh Fades"). Marlon, Cap Bar and any real client never appear. "Client Sites" previews use placeholder mock sites.
7. **No financial figures.** No balances, revenue, payouts, fees or unannounced pricing. Avoid "Money / CFO" room labels; use "Private Office". Shops show only published prices, in TEST MODE until Joshua approves live payments.
8. **No fake live metrics.** Call center or analytics boards must not show invented stats such as active calls or agents online. Use a welcome or CTA message instead.
9. **Games: only titles that are already public.** Star Wayfarer and Omnivael are on elderworldstudio.com and have Steam pages, so they are OK. Unannounced titles, build numbers, version strings and roadmaps are not.
10. **Contact details.** Only elderworldstudio.com addresses and links. No personal emails, other domains, phone numbers or staging URLs.
11. **Review gate.** Before a deploy, screenshot every floor and check all visible text against these rules. Unsanitized reference mock-ups (in reference/) are internal; only files in reference/sanitized/ may be used as public-facing references.
