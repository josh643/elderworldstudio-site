# Exterior build blocker — 2026-10-17

The requested pass names an approved 64-lot town plan (`20261017-000123-campus-town`), with Main Street, an arcade lot, and a town square at the end of the lobby walkway. That plan, its QA result, and a lease map are not present in this checkout.

The available architecture source is `spec.json`, id `20261016-224015-campus-exterior-district-1`, with 12 lots. `TOWN_MASTER_PLAN.md` also describes 12 lots; the scale-model's built-in fallback has 10. These layouts do not identify the 64 lot boundaries, square footprint, arcade assignment, or current lease status needed for this pass.

Performance follow-up: low-tier tree LOD now switches from medium to low detail at 6 m (was 12 m) and from low-detail models to the baked multi-angle atlas at 32 m (was 82 m). A local 1280x720 SwiftShader lobby sample after this change loaded without page errors and measured 113 draw calls / 203,206 triangles. This sample is not the staging gate run and does not establish 45+ FPS; use the supplied gate for comparable validation.

No town exterior geometry was changed. Building from an inferred grid could modify leased lots. To continue the requested town pass safely, provide the approved 64-lot spec and its QA result in the checkout, including the arcade and square locations and leased-lot mapping. The requested lobby walkway before/after shots and full scene re-validation remain outstanding.

The previous stage reported that the public plan endpoint returned HTTP 404; it was not retried.
