# Exterior build blocker — 2026-10-17

The requested pass names an approved 64-lot town plan (`20261017-000123-campus-town`), with Main Street, an arcade lot, and a town square at the end of the lobby walkway. That plan and its QA result are not present in this checkout.

The available architecture source is `spec.json`, id `20261016-224015-campus-exterior-district-1`, with 12 lots. `TOWN_MASTER_PLAN.md` also describes 12 lots; the scale-model's built-in fallback has 10. These layouts do not identify the 64 lot boundaries, square footprint, arcade assignment, or current lease status needed for this pass.

No exterior geometry was changed. Building from an inferred grid could modify leased lots. To continue safely, provide the approved 64-lot spec and its QA result in the checkout, including the arcade and square locations and leased-lot mapping. The requested lobby walkway before/after shots and build re-validation remain outstanding.

The previous stage reported that the public plan endpoint returned HTTP 404; it was not retried.
