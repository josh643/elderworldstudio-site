# Elderverse Xbox shell

This UWP x64 test package hosts the Elderverse online world in a full-screen WinUI 2 WebView2 control. It starts at the staging URL in `ElderverseShell/shell.config.json`; navigation is restricted to the staging office page and its office API routes. New windows and external navigation are blocked. The bundled `ms-appx-web` reconnect page is shown when the world is unavailable.

The package tile and splash placeholders use Elder World Studio branding over a material texture from the office scene. They contain no Cap Bar or Marlon imagery.

## Build pipeline

- Pushes to `agent/**` that touch `xbox/elderverse-shell/**` and manual runs create a test-signed `.msixbundle` artifact.
- CI versions are `0.1.<run number>.0`. A tag such as `xbox-ev-v1.2.3` produces package version `1.2.3.0` and attaches the test package files to a GitHub prerelease.
- The install artifact is named `elderverse-xbox-<version>-<sha7>-build`. The `-build` suffix lets `tools/xbox/wdp_install.py` select it uniquely when a run also has the optional StoreUpload artifact. Its archive contains the `.msixbundle`, `Dependencies/x64/*.appx`, `.cer`, `SHA256SUMS`, and `build.json`.
- Manual runs can set `store=true` to build a second, unsigned `.msixupload` artifact. Tag builds also run this job. Nothing is submitted to Partner Center.
- CI retains plain artifacts for 30 days. Tag prereleases attach a ZIP with the same directory layout so the installer can verify `SHA256SUMS`. The ephemeral test PFX is created and used on the Windows runner only; it is not stored in the repository.

## Install with Xbox Device Portal

1. On the Xbox Dev Mode console, open Device Portal at `https://10.0.0.33:11443` on the home LAN.
2. In **Add app**, select the test `.msixbundle`, add the matching files from `Dependencies/x64`, and add the `.cer` from the same build artifact.
3. Complete the install. The `.cer` trusts only that build's throwaway test-signing certificate.
4. Open **Home → My games & apps → View details** for Elderverse and change its type to **Game** so it receives the game memory tier.

The current CI runner does not install packages on the console. The install tool must still see a QA PASS for the exact package SHA-256 before it performs an install.
