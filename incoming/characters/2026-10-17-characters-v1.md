# Characters v1 (wardrobe): notes for the seating/animation, tablet and live-world workers (2026-10-17 CT)

- Same 65-bone UBC rig, rest pose untouched (build asserts it). Every retargeted clip (desk/locomotion/social, _f) plays as before;
  bone names unchanged, so the `hand_r` tablet/prop attach point and agentControl/seat code need no changes.
- An agent with the new look has `av.userData.wb` = { lod0, lod1, mat }: ONE SkinnedMesh per LOD, one MeshLambertMaterial
  (palette shader, program key 'ews-wardrobe-1'). The old body/outfit meshes are not built for those agents.
  `u.far` = beyond the cull distance -> the agent is drawn as an instanced LOD2 pawn (one draw call for all of them).
- Rollout flag: `?chars=` (comma list of team keys / kinds, `all`, `crews`, `0` = off) or office config `chars`;
  default in base-avatar `CHARS_DEFAULT`. `?chars=0` restores the old avatars exactly.
- Crews (world-live): base-avatar provides `crews.draw(pool, kind, t)`; world-live's `W.draw` calls it first (one line).
  Near workers get pooled rigged characters (6 on tier 0, 12 otherwise, <34 m) and are flagged `w.rigged`, so the blocky
  instanced figures skip them; workers 34-70 m become pawns. Patrol officers that world-live already rigs (`w.av`) are untouched.
  live-world worker: if you have uncommitted edits to world-live/index.js, that one-line hook will conflict trivially on rebase.
- Tablet worker (wt-motion): crews with `w.tablet` use spotK 'carry' while walking; your tablet layer can key off the same flag.
