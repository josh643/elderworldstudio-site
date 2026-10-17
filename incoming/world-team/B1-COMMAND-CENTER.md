# B1 Command Center (Joshua 2026-10-16 23:58) - restricted basement below the lobby
- core/floors.js: add level B1, elevator button 'B1 · Command (staff only)'; also a staff stair from the lobby.
- Visitors: locked door 'Restricted: World Operations' / keycard reader with a polite denial message. Agents + Joshua's owner session may enter (owner = existing office key or ?owner flag; never weaken auth; the gate is cosmetic for visitors, real data stays behind existing auth).
- Room: dark slate + walnut, low warm light (baked/emissive, NO realtime lights), curved wall of live monitors (world map, agent status board, fps per tier, deploy + hot-update feed, security patrol map, construction gate state, budget meter) as canvas textures updated <= 1/s; central round command table reusing the holo table renderer small (world map); Ægir's raised director desk; lead consoles (Bestla, Nerthus, Fjörgyn); seats for Sleipnir, Sunna, Alvíss when not on rounds; coffee bar (also the off-duty lounge spot).
- 45+ fps on pve-mini-3070. DEPLOY RULE: rebase on origin/office-3d, curl /api/office/world after deploy.
- Roster: teams world + world-eng have floor 'B1' (branch world-team-roster).
