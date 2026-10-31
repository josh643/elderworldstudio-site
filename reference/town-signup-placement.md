# Campus Placement Spec: Town Signup ("Build Your Shop")

**Priority: QUEUED, low.** Start only after all current campus work in flight (bug fixes, wall-panel cleanup, kiosk popups, merch holograms, lobby redo, glass assets, logo switch queue item). Do not interrupt anything in progress.

**Public content rules apply** (reference/sanitized/PUBLIC-CONTENT-RULES.md): no client names (use sample businesses like "Fresh Fades"), no Cap Bar or Marlon, no telemetry/rack readouts, no internal tool names, prices only as published, checkout TEST MODE until Joshua approves live payments.

Web flow it mirrors: `/town/` (draft on staging branch `town-signup`). Checkout endpoint: `POST /api/town/checkout` with `tier` = small|medium|large|flagship.

## 1. Ground floor: "Build Your Shop" kiosk
- **Where:** On the red carpet with the other lobby kiosks, last kiosk in the row on the right side nearest Freyja's desk (so it's the final stop before reception). Same kiosk model and trim as the others.
- **Sign:** "Build Your Shop" (no other text on the kiosk header).
- **Interaction:** Opens an **in-place overlay** exactly like the fixed kiosks: no camera move, no wall redirect, close button returns the player to the same spot.
- **Overlay content (tabs):** How it works (8 steps) · Lot sizes and prices · FAQ · "Reserve a lot" buttons (one per tier). Reserve opens Stripe Checkout (test mode) in a new tab / mobile sheet; on return show "Lot reserved" confirmation in the overlay.
- Content pulled from the same source as the web page (tools/town_page.py data) so prices never drift.

## 2. Freyja routing
- Add an intent to Freyja: questions about "get my business in here", "build a shop", "lease/rent a lot", "3D website for my business", pricing for lots.
- Response: one short line ("You can build your own shop in our town. The Build Your Shop kiosk is right there on the red carpet.") plus a pointer highlight / waypoint arrow on the kiosk. She also mentions the Leasing Office on Floor 4 for a look at the town map.
- She never quotes custom deals, legal terms or discounts; anything legal or a first sales contact goes to Joshua (lead form).

## 3. Floor 4 (Client Sites): Town Leasing Office
- **Room:** New room on Floor 4 labeled "Town Leasing Office", glass front (use the queued sliding-glass door asset).
- **Centerpiece:** Live 3D town-map table. Campus model in the center, lots around it, lake/grounds as town square.
  - Lot states: open (green glow), prime (gold), taken (dim, shows sample building or "Taken"), and not-yet-available (outline only).
  - Lot availability comes from datacenter capacity: number of open lots = free hosting slots by size (read from a sanitized capacity feed that outputs only counts per lot size, never hardware/IP/node data). Launch cap: 10 to 15 lots total.
  - Click a lot: popup with size, price, prime premium, and "Reserve this lot" (same checkout, lot number passed along).
- **Preview rooms:** 2 small rooms off the leasing office ("Preview Room 1/2") where a client's in-progress building loads from a private preview link for review/approval. Locked to invite links; public visitors see a sample mock shop ("Fresh Fades").
- No financial figures, revenue or occupancy stats on any screen beyond published prices and open/taken lot states.

## 4. Campus grounds: town exits (later phase)
- Mark exit points on the campus grounds (main front path, lakeside path, side plaza) as future gates to the town.
- For now: decorative archways with "Town: Coming Soon" and a link to the Leasing Office/kiosk. No working transitions yet.
- Later: walking through an exit hands off to the client's domain (seamless door-walk transition) and back to elderworldstudio.com on return.

## Acceptance
- Kiosk overlay opens in place on desktop and mobile, closes back to same position.
- Freyja routes the intent to the kiosk with a waypoint.
- Leasing Office map shows correct open/taken counts from the capacity feed; test-mode checkout works from both kiosk and map.
- Floor screenshot review gate passed against PUBLIC-CONTENT-RULES before any deploy.
