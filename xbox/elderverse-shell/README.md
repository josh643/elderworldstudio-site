# Elderverse Xbox shell (UWP + WebView2)
Minimal game shell for the Xbox dev kit: full-screen WebView2 that loads only the staging office client with `?platform=xbox` (see `ElderverseShell/shell.config.json`). Top-level navigation is allowlisted to that origin; new windows are blocked; no address bar. Not a browser.

Build: `.github/workflows/xbox-elderverse.yml` (windows-2022, Release x64, test-signed with a throwaway `CN=Elder World Studio Inc` cert made in the job; no PFX is ever committed). Artifact `elderverse-xbox-<version>-<sha7>`: `.msixbundle` + `Dependencies/x64/*.appx` + `.cer` + `SHA256SUMS` + `build.json`.

Install: Device Portal https://10.0.0.33:11443 → Add → bundle + every dependency `.appx` (or `tools/xbox/wdp_install.py`). Then set the app type to Game in Dev Home if needed.
