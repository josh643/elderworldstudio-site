# elderworldstudio.com

Static website for Elder World Studio Inc. No build step is needed to deploy: the deployable site is the `site/` folder.

- `site/` – deploy this directory as-is (Cloudflare Pages, GitHub Pages, or any static host).
  - `privacy-policy/` – the Privacy Policy (also served at `/privacy/`, `/privacy.html`, `/privacy-policy.html`, `/star-wayfarer/privacy/`).
  - `_redirects`, `_headers` – Cloudflare Pages config. `.htaccess` – Apache fallback. `404.html` – not-found page.
- `tools/build.py` – regenerates the HTML pages from one template (`python3 tools/build.py`). Edit the copy there, not in the generated files.
- `tools/shots.py` – Playwright screenshot/overflow/console check.

## Deploy to Cloudflare Pages

```
CLOUDFLARE_API_TOKEN=... npx wrangler@3 pages project create elderworldstudio --production-branch main
CLOUDFLARE_API_TOKEN=... npx wrangler@3 pages deploy site --project-name elderworldstudio --branch main
```

Then attach `elderworldstudio.com` and `www.elderworldstudio.com` as custom domains in the Pages project.

Privacy Policy URL for app stores: `https://elderworldstudio.com/privacy-policy/`
