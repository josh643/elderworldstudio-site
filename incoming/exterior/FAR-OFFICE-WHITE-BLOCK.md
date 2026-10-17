# Far view of the office reads as a plain white block (Joshua 2026-10-17 00:29) — for the exterior owner (006fcbbb)

Joshua was dropped on the far grass (x ~ +170, ground floor) by the soft-reload restore bug (fixed in core/floors.js +
core/engine.js restore v2). From there the office showed as "a distant plain white block": the far LOD / impostor of the
building is an untextured light slab at distance. At night in headless (2026-10-17 00:40) the building is simply not drawn past
~110 m (shots: /workspace/shots/arch/far60.jpg, far120.jpg, far170.jpg on the shared box), so the white slab is most likely the
daytime far shell / facade LOD with its map dropped (lowMats / collectFar swap?).
Please give the far building a textured or at least facade-coloured LOD (glass bands, walnut, the crest) instead of a blank white box.
Not touched by me (your module).
