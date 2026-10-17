# Maker/checker steps per agent (office feed) — request to the feed publisher (CT111 arch_world feeder / live world fb80bc3d)

Joshua 2026-10-16 11:49 PM (photo 760aa00b): Jörð and Vé showed the same job line and timer. Every agent's screen and status
must show ITS OWN step from the real job record; a maker and its checker never mirror one progress line.

## What the office does now (site/office/modules/monitors, arch-studio, base-avatar)
- Work items of one job are paired when they share `since`, or the same subject after the leading verb
  ("Surveying lawn and lamp posts" / "Inspecting lawn and lamp posts") within one team. The checker is the item whose
  agent id matches `qa|review|check|audit` or whose role says QA / review / checker / inspector.
- Checker screen: its own task line, stage, progress, timer. If the item has `check: {n, ok, issues}` it shows
  "Checking n: ok OK, issues flagged" instead of the bare percentage.
- Maker screen: `made` (what it produced) else "Submitted: <subject>", and "Waiting on <checker>'s review", or
  "Revising: <revising>" when that field is set. No copied bar or timer; the head progress bar is hidden while waiting.
- Physical-area survey/inspection jobs (lawn, lamp posts, plaza, parking, lobby / red carpet ...) in a survey, site-check,
  QA, review or inspect stage: the architect walks desk -> F3 lift -> lobby -> doors -> the spot and works there with a tablet
  (surveyor also sets a tripod + stakes + tape). Survey and staking only; town construction stays on hold.
  A waiting maker stays at its desk. A server `walk`/`meet`/`field` pose still wins; a plain `desk`/`idle` pose yields to
  the on-site job until the agent is back at its chair (userData.siteJob).

## Please emit (optional fields, per work item)
- `job`: a shared job id for the maker and checker items (better than matching `since`/task text).
- `step`: "make" | "check" | "revise" | "wait".
- maker: `made` (short line of what was produced), `revising` (what is being fixed after findings).
- checker: `check: {n, ok, issues}` (items checked so far, passed, flagged).
- on-site jobs: `site: {zone: 'lobby'|'plaza'|'lawn'|'lot', lot?: 'L05'}` so the office does not have to read the task text;
  or drive it with agent.pose `act:'field'` and the walk-out lands on world-live's field figure.
Nothing breaks if these are missing; they just make the pairing exact.
