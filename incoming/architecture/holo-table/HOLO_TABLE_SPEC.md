# Floor 3 Holographic Plan Table: Anna design spec (2026-10-16)

Style: stylized-realistic, matching the lobby (walnut, brass, dark stone). Not sci-fi chrome.

## Physical table
- Footprint 3.2 m x 2.0 m, top at 0.95 m (standing height, so agents and visitors lean over it).
- Base: two solid walnut pedestals with a recessed brass kick plate (no concrete block, no bare legs).
- Top: 60 mm thick walnut frame with a 40 mm brass edge band. Inset is a dark smoked-glass surface (the projection bed) with a fine gold grid (10 m scale squares).
- Brass plaque on the long front edge: "ELDER WORLD STUDIO · CAMPUS TOWN" plus the EWS crest.
- Under-edge warm LED strip (emissive only, no realtime light).
- Four corner "projector" posts: 150 mm tall brushed brass cylinders with a glowing cyan lens. They justify the hologram visually.
- Docked tablet on a brass arm at the front right corner = the controls.
- Two stools and a rolled-plans rack at one end (dressing).

## Layers (on the glass bed, 1:500)
1. CURRENT (solid physical model): white and light-wood massing of the campus buildings at true footprint and height, the dark-gray street ribbons, green lawn, lake with a water material, tiny 3D tree clusters, and lots as flat tier-colored tiles.
2. PROPOSED (hologram, floats 30 mm above the bed): translucent cyan wireframe and fill with gold edges for lots, streets and new buildings; a soft scanline shader; a slight flicker only within 6 m of the camera; labels for the square, Arcade, hub and arch office; tier color tints S blue, M green, L amber, X red at 35% opacity.
3. Banner hologram above the table: "PROPOSED · awaiting Joshua approval" with the spec id and its Vé PASS/FAIL.

## Tablet controls
Current | Proposed | Overlay toggle, a Phase 1/2/3 slider (growth rings), a "Lot info" tap on a lot (tier, size, use, size_source citation), and a revision history (v1, v2…).

## Behavior
- Reads world state for CURRENT and CT111 LATEST-REDESIGN for PROPOSED. A new spec triggers a hot-update swap with a 0.6 s "rebuild sweep" scan line across the table.
- Architects (Máni, Vili, Jörð, Vé) gather around it during review jobs, pointing or using their tablets (life anims only up close).
- When Joshua approves: the hologram "solidifies" into the physical layer and the banner reads APPROVED.

## Performance (cheap devices)
- Physical model: 1 merged mesh plus 1 instanced tree mesh. Hologram: 1 merged mesh with an additive unlit material. Table: ≤ 3 materials. Total ≤ 6 draw calls.
- Labels: one canvas texture atlas, high resolution only within 8 m.
- No realtime lights or shadows from the table; baked contact shadow decal under the pedestals.
