# Architecture → exterior builder handoff (2026-10-16 22:30 CT)
From: Máni (Architecture Lead), Vili, Jörð, Vé (Layout QA). To: the exterior builder (site/office/core/exterior.js) and the lobby builder.
Spec: `incoming/architecture/spec.json` (schema ews-layout/1, id 20261016-224015-campus-exterior-district-1 (v2, includes tree rules)). Source of truth on CT111:
/var/lib/ews-agent/arch/specs/<id>/spec.json (LATEST file names the newest).

Frame: metres. Origin = lobby entrance centre on the front facade (exterior.js X0, Z0). +x = right when facing out, +z = away from the building, y = up.
Keeps the v31 grid exactly: avenue z=62, cross lanes x=±32.5/±97.5, Forge Street z=127, roads 10 m, sidewalks 2.5 m.

Contents:
- master.zones / streets (all owner EWS) / lots: 12 lots L01-L12 in the 3 blocks on the campus axis. Each lot has rect [x0,z0,x1,z1], frontage, setback 2 m, max_height, zone, status reserved, and tier A/B/C. build_order is included.
- buildings: main (glass curtain wall, 6 fl x 4.2 m, mullion 1.5 m), crest-tower (charcoal stone, crest + stacked name facing +z), billboard-wing (28x10 m LED billboard over glazed ground floor, roof terrace trees), pavilion, dome (r 13 m). Each has a rect footprint, height, facade and materials.
- landscape: curving lit stone paths (points), pond with boulders and reeds, planting zones by species, lamps 30 m / bollards 6 m, monument sign, and 2 billboard spots on Elder Avenue (central ad server).
- interiors: G lobby to the approved cutaway (carpet axis, Freyja desk + crest wall, collab hub left, 2x3 coder desks back-right, merch holo cases + checkout front-right, no kiosks) and Floor 3 architecture studio (4 desks + 4 assigned chairs, plan table, town model plinth).
- qa: deterministic Layout QA PASS (0 errors). vision_advisory says FAIL, but it is advisory only. gpt-4o-mini wrongly said the dome/pond were missing although both are in the spec. The blocking side-by-side check runs on real renders through `arch_agent.py survey` once this is built on staging.
Sheets: compare_campus.jpg, compare_lobby.jpg. Living town plan: TOWN_MASTER_PLAN.md.

Builder asks:
1. Rebuild the exterior massing from `buildings` instead of the current flat blocks. Keep the cheap-device rules (merged, instanced, Lambert, KTX2).
2. Place the lot pads and plates for L01-L12 from `master.lots` (status reserved). Leave the other reserve pads as they are.
3. Put the pond, paths, monument and billboards where `landscape` says.
4. Do NOT deploy. Anna ships one combined update.
5. Any coordinate you can't honour (collision with existing geometry) goes back as a note in incoming/architecture/BUILDER_NOTES.md. Vili and Máni will revise the spec.

## Trees (Joshua 2026-10-16)
- Jörð (arch-landscape) owns tree planting and removal. Specs carry `landscape.planting` zones and, from now on, `landscape.tree_changes` ([{id, action: remove|relocate, from, to, reason}]) whenever a road or lot is built.
- Live-construction system: when a road or lot is built, play tree removal as one of the stages: survey (stakes) → clear trees (fell/uproot the trees in tree_changes, haul away, stumps gone) → grade → pave/build. Relocated trees are replanted at `to` in the same stage.
- Layout QA (Vé) fails specs with trees on streets or paving, trees on lots under construction/built, or camera-facing card trees. The survey also flags these in renders.
