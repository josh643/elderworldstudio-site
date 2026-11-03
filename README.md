# elderworldstudio.com

Static website for Elder World Studio Inc. No build step is needed to deploy: the deployable site is the `site/` folder.

- `site/` – deploy this directory as-is (Cloudflare Pages, GitHub Pages, or any static host).
  - `privacy-policy/` – the Privacy Policy (also served at `/privacy/`, `/privacy.html`, `/privacy-policy.html`, `/star-wayfarer/privacy/`).
  - `_redirects`, `_headers` – Cloudflare Pages config. `.htaccess` – Apache fallback. `404.html` – not-found page.
  - `build/` – AI web builder pricing, reservation form, and designer.
  - `account/` – customer sign-in, sites, billing, and download.
- `functions/` – Cloudflare Pages Functions (`/api/*`).
- `tools/build.py` – regenerates the HTML pages from one template (`python3 tools/build.py`). Edit the copy there, not in the generated files.
- `tools/shots.py` – Playwright screenshot/overflow/console check.
- `npm test` – Playwright e2e: phone overflow + viewport meta on every page, hamburger nav, SMS consent wording, and desktop header regression.
- `npm run test:unit` – lead form, builder, client area, and shop/billing unit tests.
- `npm run test:e2e-shop` – sellable path: sign-up, test-card pay, generate, edit, publish, download, cancel. Uses mock Stripe unless `STRIPE_SECRET_KEY` is a real `sk_test_` / `rk_test_` key (and `EWS_STRIPE_MOCK` is not `1`).
- `npm run stripe:test-catalog` – create or reuse Stripe TEST products/prices for the four plans and print the `STRIPE_PRICE_*` IDs. Refuses live keys.
- `npm run qa` (alias `ews-qa`) – unit + site Playwright + shop E2E.

## Web builder prices (current)

| Plan | Setup | Monthly |
| --- | --- | --- |
| Starter | $349 | $19/mo |
| Business | $699 | $39/mo |
| Plus | $1,299 | $69/mo |
| Take it with you | $99 one time | none (zip of the static site) |

`/build/` stays a reservation form until live payments are flipped on. The designer and `/account` are wired; they do not charge anyone while `EWS_LIVE_PAYMENTS` is unset.

## Deploy to Cloudflare Pages

```
CLOUDFLARE_API_TOKEN=... npx wrangler@3 pages project create elderworldstudio --production-branch main
CLOUDFLARE_API_TOKEN=... npx wrangler@4 pages deploy site --project-name elderworldstudio --branch main
```

Then attach `elderworldstudio.com` and `www.elderworldstudio.com` as custom domains in the Pages project. Production auto-deploys from `main` to the `elderworldstudio` Pages project.

Privacy Policy URL for app stores: `https://elderworldstudio.com/privacy-policy/`

D1 binding already used by the site: `BUILD_LEADS` (shop customers, sessions, sites, and orders use extra tables created on first request).

## Flip live payments (do this last)

Production keeps the reservation form until every item below is set. Do **not** create live Stripe products from this repo; create them in the Stripe Dashboard, then paste the IDs.

1. **Stripe test first.** In Stripe test mode (or a sandbox), create four products and seven prices — either in the Dashboard or with:

   ```
   STRIPE_SECRET_KEY=rk_test_… npm run stripe:test-catalog
   ```

   That script only talks to TEST mode and prints the IDs. It refuses `sk_live_` / `rk_live_`. Manual equivalent:
   - Starter setup `$349` one-time + Starter monthly `$19`
   - Business setup `$699` one-time + Business monthly `$39`
   - Plus setup `$1,299` one-time + Plus monthly `$69`
   - Take it with you `$99` one-time
   Use a [restricted API key](https://docs.stripe.com/keys.md#manage-your-api-keys) (`rk_test_…`) with Checkout Sessions, Customers, Subscriptions, and Customer Portal. Never commit keys.

   Optional: `STRIPE_SECRET_KEY=sk_test_… npm run test:e2e-shop` runs checkout against hosted Stripe Checkout (card `4242…`). Leave the key unset (or set `EWS_STRIPE_MOCK=1`) for the local mock.
2. **Pages preview env** (a non-`main` branch or Preview environment — not production):

   | Variable | Example / notes |
   | --- | --- |
   | `EWS_LIVE_PAYMENTS` | `1` |
   | `STRIPE_SECRET_KEY` | `rk_test_…` or `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |
   | `STRIPE_PRICE_STARTER_SETUP` | `price_…` |
   | `STRIPE_PRICE_STARTER_MONTHLY` | `price_…` |
   | `STRIPE_PRICE_BUSINESS_SETUP` | `price_…` |
   | `STRIPE_PRICE_BUSINESS_MONTHLY` | `price_…` |
   | `STRIPE_PRICE_PLUS_SETUP` | `price_…` |
   | `STRIPE_PRICE_PLUS_MONTHLY` | `price_…` |
   | `STRIPE_PRICE_TAKE_IT` | `price_…` |
   | `PUBLIC_ORIGIN` | `https://<preview>.elderworldstudio.pages.dev` |
   | `AGENTMAIL_SEND_KEY` | already used by `/api/lead` |
   | `TURNSTILE_SECRET` | already used by `/api/lead` (optional; if unset, the widget still loads and does not block) |

3. **Webhook.** Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://<preview-or-prod>/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Customer portal.** Stripe Dashboard → Settings → Customer portal: allow cancellation and payment-method updates. Without this, `/api/portal` cannot open.
5. **Receipts.** Stripe Dashboard → Settings → Emails: turn on successful payments. The site also sends a welcome + receipt via AgentMail when `AGENTMAIL_SEND_KEY` is set.
6. **Walk the preview** with card `4242 4242 4242 4242`: `/account` sign-in → `/build/` Start Business → pay → generate / edit → publish → Download my site → Billing → cancel.
7. **Go live.** In the Stripe **live** Dashboard, create the same four products and seven prices (do not reuse test IDs). Put `rk_live_…` / live price IDs / live webhook secret on the **production** Pages environment only. Then set `EWS_LIVE_PAYMENTS=1` and `PUBLIC_ORIGIN=https://elderworldstudio.com`. Redeploy. Until that flag is `1` on production, `/build/` CTAs stay “Reserve your spot” and `/api/checkout` returns `403 payments-off`.

Live secret keys are ignored unless `EWS_LIVE_PAYMENTS` is on.

## Turnstile

The `/build/` reservation form still posts to `/api/lead` with the existing Turnstile widget (`data-sitekey` on the page, `TURNSTILE_SECRET` on Pages). If the secret is unset, the server skips verification so real browsers are not blocked. If the secret is set, a missing or failed token returns “Spam check failed. Please try again.” Ops tests may send `x-ews-e2e: $E2E_TOKEN`.

## Customer tax

If you charge US or EU customers, enable [Stripe Tax](https://docs.stripe.com/billing/taxes/collect-taxes.md) and add a registration before turning `automatic_tax` on. This integration does not enable automatic tax by default.
