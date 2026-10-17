# Architecture team field behavior: spec for the motion + seating builder (Joshua 2026-10-16)
Agents: Máni (lead-arch), Vili (arch-building), Jörð (arch-landscape), Vé (arch-qa). Team key `architecture`, roster floor "3".
They must NOT be stuck at desks. Location follows their real task stage from the live feed (work[].stage plus arch log stages):

| Stage (feed) | Where | Props | Actions (close-range only) |
|---|---|---|---|
| survey / site-check (`plan` lead step, `survey`) | outdoors at the target lot (lot rect centre from spec master.lots) or the campus survey points | tablet or clipboard, tripod total station, measuring tape, stakes/lot markers | walk out through the lobby sliding doors; set up tripod; sight through it; walk tape between lot corners; hammer stakes at lot corners; tap tablet |
| drafting / spec (`building`, `landscape` steps, townplan) | own Floor 3 desk + assigned chair | keyboard/mouse/pen tablet | walk to own chair, chair rolls out, sit facing desk, chair tucks in; natural typing + mouse (existing desk clips) |
| review / QA (`qa`, vision compare, survey findings) | walk to the build: facades on the plaza, lobby, floors under construction (taped zones) | tablet/clipboard | stop ~3 m from facade/object, point, look up/down, note on tablet; Vé holds the "compare" pose with tablet raised |
| idle | Floor 3 studio: plan table / town model plinth | none | lean over plan table, gesture at model |

Seats (one chair per agent, chair faces desk; from spec interiors floor 3):
- lead-arch → f3-arch-lead-arch (x -6), arch-building → f3-arch-arch-building (x -3.6), arch-landscape → f3-arch-arch-landscape (x -1.2), arch-qa → f3-arch-arch-qa (x 1.2); desk z -10, chair z -9.05, rot 0 (faces -z). Local Floor 3 frame, same axes as the campus.
Rules:
- Stand-up and sit transitions use the existing chair roll-out/tuck logic. Never share chairs. Always walk, never slide (step cycle synced to speed).
- Props and field animations load and play only within close range (same LOD radius as the other "life" animations). Far away they show as plain walking avatars, and the props are hidden.
- Pathing: Floor 3 → elevator → lobby → sliding doors → plaza/avenue → lot. Return the same way. Respect colliders.
- Until Floor 3 is built: their team is filtered out of the ground team-halls (team-halls skips teams with floor != G). The Floor 3 builder seats them. Field walks can start from the elevator door.
- Do NOT deploy to staging. Anna ships one combined update.
- Tree clearing (Jörð): during a road/lot "clear trees" construction stage, Jörð walks to the lot with a tablet and marks trees (spray-dot or ribbon prop) before they are removed. Close-range only.

## REQUEST to the motion + seating builder (2026-10-16 22:50 CT, Joshua wants to see the team now)
Floor 3 has no desks yet. Please add an `arch-studio` station on Floor 3, following the pattern in modules/lobby-stations:
- 4 `ctx.kit.desk()` with `seat.owner` = lead-arch (Máni), arch-building (Vili), arch-landscape (Jörð), arch-qa (Vé); seat ids in roster `teams[architecture].seats`; layout from spec.json interiors floor "3".
- Then remove the filter in modules/team-halls/index.js (`roster.teams.filter(t => !t.floor || t.floor === 'G')`) so their avatars exist, and move them to the Floor 3 desks the way lobby-stations does.
- Survey stage → walk out to the lots (spec master.lots, L05/L06 first). See the table above.
I did not build this myself because the seat system in core/engine.js has uncommitted changes in your working tree, and I don't want to collide with them.
