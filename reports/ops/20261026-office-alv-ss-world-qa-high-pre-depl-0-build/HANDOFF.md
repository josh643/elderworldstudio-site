# Office playtest gate handoff

**Result: FAIL; no promotion.** The gate completed for the playtest candidate and live office URLs.

- Candidate and live each returned HTTP 200 from `/api/office/world`; both recorded zero failed HTTP responses, including zero 404s.
- Every permanent Joshua regression probe and walk passed on the candidate. The floor 3 reload check also passed.
- Candidate measured 2.0 FPS (samples 1.75, 2.0, 3.25); live measured 2.5 FPS (2.5, 2.5, 2.5). Chromium reported the SwiftShader renderer, so this run cannot verify the required pve-mini-3070 tier or its 45 FPS floor.
- Visual judging did not run. The runner lacks `~/bin/ct111-put`; the gate recorded `vision_unavailable` and failed closed. No style/prop check is claimed as passed.

Evidence: `/tmp/20261026-office-playtest-gate/out-verified/gate.json` and screenshots under `/tmp/20261026-office-playtest-gate/out-verified/`.

Next review needs a run with the approved vision transfer/judge tooling and an identified pve-mini-3070 GPU. This agent did not contact anyone under the no-contact rule.
