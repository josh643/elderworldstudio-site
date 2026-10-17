# Construction sign state handoff

Construction signs now read the sanitized `/api/office/state` feed and display a live crew only for a matched, fresh active stage. Blocked, waiting, cancelled, skipped, stale, and unmatched state displays a paused reason. Signs show elapsed time from the latest world progress event; layout revocation no longer refreshes that progress time.

Lot 11 visual evidence: [before](lot-11-before.jpg) and [after](lot-11-after.jpg). The fixture showed a pipeline waiting on the daily budget with an old framing event; the after image shows the paused reason and the 10-hour progress age.

Verification: the construction status tests pass (8/8); JavaScript module syntax checks and `git diff --check` pass. The full `tools/office/playtest_gate.py` was not run: it writes ledgers to `/workspace/shots/gate` and compares a deployed candidate against live, outside this checkout-only task. No deployment was performed. Lot 11 shots use local fixture data; no leased-lot records were changed.
