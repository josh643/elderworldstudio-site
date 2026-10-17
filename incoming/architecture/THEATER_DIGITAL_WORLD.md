# Theater digital-world layout and integration addendum

Requested by Joshua, 2026-10-17. This extends the existing Elder Theater interior and streaming pipeline work; it is not a greenfield streamer. This checkout is the `office-3d` world repo. It contains no Elder Theater interior implementation, `sites/watch` pipeline, or `policy/streaming/PLAN.md`, so this file is a handoff contract and does not claim those pieces are implemented or QA-passed.

## Layout and audience flow (lead-arch / Máni)

- Continue the existing Elder Theater interior plan. Keep all theater and watch-party rooms on EWS-owned property. Do not move, resize, restyle, or reassign client-leased lots.
- Give every screening screen a stable `screenId`. Show its current and next scheduled showtime on a lobby-facing marquee; the web showtime and ticket pages must read the same per-screen schedule source.
- Leave the screen in a visible **Coming soon** state until Joshua finalizes the streaming plan and the licensed catalog is ready to stage. Posters and marquees may play first-party Coming soon loops. Do not put feature video in world meshes or textures.
- Provide walk-in seats with interact-to-sit and stand-to-leave actions. Keep aisles and exits clear, with a standing viewing area.
- Add audience chat and emoji reactions scoped to the screening room. Make them optional and compact; send events on interaction and avoid per-frame updates or polling on idle clients.
- Provide private watch-party rooms with invite/code entry and clear room boundaries. They follow the same server-owned playback model as public screenings, scoped to their room.
- Keep the scene stylized-realistic and within the cheap-phone budget. Use the existing low-cost world rendering approach; do not add costly per-frame network work for social features.

## World-server / stream contract (ops + world server)

- A schedule is keyed by `screenId`; each scheduled item has a `showId`, start time, title metadata, and status. Expose a read-only scheduled-showtimes API/stub for lobby, marquee, and web showtime/ticket surfaces. All surfaces must derive from the same schedule data.
- The world server is authoritative for each room's `showId`, playback `status`, and `playhead` (with a server timestamp for the playhead sample). Clients subscribe to room state, render that shared timestamp, and reconcile their stream position to server updates. Clients must not start independent free-running clocks. Private rooms use the same state and sync rules with a separate room scope.
- Do not start playback while the screen is **Coming soon** or before the server reports an eligible scheduled showing. Keep the interim Bestla acceptance unchanged.
- Deliver video as a stream (for example HLS via R2); the world provides a screen surface and stream player integration only. Never bake video into world geometry, meshes, or textures.
- Keep chat and reaction messages room-scoped, bounded, and event-driven. The server validates room membership and rate-limits updates so social activity does not become continuous device or network work.

Suggested minimum read shape for the schedule stub:

```ts
interface ScreenSchedule {
  screenId: string;
  status: 'coming_soon' | 'scheduled' | 'showing' | 'ended';
  showtimes: Array<{
    showId: string;
    startsAt: string; // ISO-8601 timestamp
    title: string | null;
  }>;
}
```

These are interface fields, not a real schedule or content commitment. Do not add invented titles, dates, stream URLs, or catalog records. Playback state should at minimum carry `{ roomId, screenId, showId, status, playheadSeconds, sampledAt }`; only the world server may advance or change that state.

## Content and approvals (ops / catalog)

- Stage licensed titles only, with release year >= 2000. Keep pre-2000 public-domain titles hidden and unpublished.
- Follow `policy/streaming/PLAN.md` for genre sequencing: fantasy first, then other genres. That plan is absent from this checkout and must be checked by the streaming-pipeline owner before catalog work.
- Filmhub items remain drafts for Anna. Do not submit or spend without Joshua/Anna approval.
- Streaming-plan and licensed-catalog readiness are prerequisites to replacing Coming soon; they are not prerequisites to completing the interim theater layout.

## Phase 1 ads (web showtime / ticket pages only)

- Wire an AdSense banner on the web showtime/ticket pages, outside the in-world screen and player. Use publisher `ca-pub-9120677014955697`, slot `5205150595`, `data-ad-format="auto"`, `data-full-width-responsive="true"`, and `data-adtest="on"` on staging/preview.
- Keep ads before a showing only. Never overlay or interrupt the feature. Posters and the in-world marquee use first-party Coming soon loops, not third-party video ads.
- Optional rewarded ads may be opt-in perks only (for example a premium seat, popcorn emote, or hosting a private party); never force an ad during a feature. A paid ad-free pass is future work; agents do not set or charge a price.
- Example staging markup for the pipeline implementation:

```html
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-9120677014955697"
     data-ad-slot="5205150595"
     data-ad-format="auto"
     data-full-width-responsive="true"
     data-adtest="on"></ins>
```

The pipeline owner must wire the required AdSense loader and page-level initialization. Keep the `data-adtest` attribute on every staging/preview ad unit.

## Phase 2 follow-up (after launch audience)

- Add Google Ad Manager / IMA preshow video ads only when traffic supports it. Show one or two skippable ads before a feature, with skip after five seconds. Never interrupt the feature.
- Phase 2 approval must not block Phase 1.

## Performance and QA evidence

- Measure the finished world walkthrough on a documented cheap phone: enter lobby, read a marquee, walk in, sit, stand, and exercise chat/reactions. Record device/browser, world build, duration, measured frame rate, and evidence. Acceptance is at least 45 fps; do not claim it passed without measurements.
- Capture lobby and screening-room views with showtime hooks, Coming soon state, seating/aisles, chat/reaction entry, and private-room invite/code flow.
- Confirm in review that no client-leased lot changed. Do not deploy production; remain on the agent/staging branch until QA and Anna's promotion process.
- Streaming-pipeline acceptance: schedule stub is shared by marquee and web pages; playback state is server-owned; video is streamed; Phase 1 ads appear only on showtime/ticket pages and staging carries `data-adtest="on"`; Phase 2 IMA remains a follow-up; catalog policy remains fantasy-first and year >= 2000.
