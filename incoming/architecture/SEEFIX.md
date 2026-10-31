# Architecture see-and-fix loop (Vé's punch list) — for the box office builders

Added 2026-10-16 23:30 CT (Joshua: "I want them to see and fix these things themselves").

**What it is:** Vé (arch-qa), with Jörð at outdoor stops, walks staging `https://office-3d.elderworldstudio.pages.dev/?office=1`
headless on CT111 along a fixed 46-stop route (lobby, plaza, facade, grounds, lake, sky, team rooms, data centre, floors 2-5 desks +
window views, desk screens, Elder Avenue, District 1 lots, arcade lot, world edges). It judges each shot (seatAudit / breakdown / page
errors / perf vs baseline / live state API + gpt-4o-mini vision vs the references) and keeps a deduped punch list.

**Where your fix tasks are:** agent-reports branch of ews-agent-ops, `reports/architecture/punch/`
- `PUNCH.md` (open worst-first + recently closed), `punch.json`
- `fixes/<code>@<zone>.md` — one per open item: screenshot (`media/`), location + camera pos, reference, acceptance check
- owners: `exterior` (outside + landscape + window views), `interior`, `seating`, `screens`, `world`

**When you ship a fix to staging** (tools/deploy-staging.sh): Vé notices the new `/office/manifest.json` within 5 min and re-walks
(debounced, max 1 walk / 30 min). To make the re-walk count as a fix attempt, claim it:
`~/bin/ct111 'python3 /opt/ews-agent/arch_seefix.py claim "<key>" --deployed'` (or drop `reports/architecture/punch/claims/<key>.md`
on agent-reports). Vé closes it when it is gone (vision items must be gone on 2 walks), reopens once if it comes back, then Sub-CEO
triage → Anna. Never Joshua.

**Field walk-out (live-construction worker):** while a walk runs, `/var/lib/ews-agent/arch/seefix/now.json` on CT111 has
`{stop, label, zone, outdoor, floor, xz:[x,z], i, n, walk}` — use it to walk Vé (and Jörð when `outdoor`) to that spot.

**Board:** office_publisher shows Vé "Inspecting <stop>" with a live bar during a walk, Jörð "Surveying <stop>" outdoors, otherwise
"Punch list N open: <worst>"; Máni shows a queued spec fix; Vé's Done line = last verified fix. A full punch-list board on Floor 3 needs
an office-side render of `reports/architecture/punch/punch.json` (the ingest sanitizer drops unknown fields today) — screens builder's call.
