# Xbox Device Portal installer handoff

`wdp_install.py` is a Python 3 standard-library helper for Xbox Device Portal. It defaults to `https://10.0.0.33:11443`; the first HTTPS call pins the console certificate SHA-256 fingerprint at `/var/lib/ews-agent/xbox/wdp_pin.txt`. Optional WDP Basic authentication uses `WDP_USER` and `WDP_PASS`. WDP and GitHub requests are recorded without headers or bodies in `/var/lib/ews-agent/xbox/installs.jsonl`.

Commands:

- `python3 tools/xbox/wdp_install.py status`
- `python3 tools/xbox/wdp_install.py fetch OWNER/REPO RELEASE_TAG_OR_RUN_ID`
- `python3 tools/xbox/wdp_install.py install PACKAGE_DIRECTORY`
- `python3 tools/xbox/wdp_install.py smoke PACKAGE_FAMILY_NAME` (uses `--pra-id` if package metadata does not expose the PRAID)
- `python3 tools/xbox/wdp_install.py uninstall PACKAGE_FULL_NAME`

Install is refused unless the main package SHA-256 appears in a `verdict: PASS` file at `reports/qa/runs/<run>/qa.json`. `fetch` only uses GitHub GET requests, stages downloads under `downloads/xbox/OWNER_REPO/REF`, safely extracts archives, and verifies each `SHA256SUMS`. A numeric ref is treated as a workflow run ID; other refs are treated as release tags. `--dry-run` is available for each command.

Verification used only a local fake HTTP server. No real console, live service, office deploy, or website files were touched. The task-referenced `policy/xbox/XBOX-LAUNCH-CHECKLIST.md` is absent from this checkout, so the implementation follows the explicit task requirements pending human review of that missing spec.
