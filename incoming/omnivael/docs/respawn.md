# Respawn and persistence rules

| What | Rule |
|---|---|
| **Wildlife** (wolves, boars, spiders) | Each animal belongs to a **home area** with a target population. Missing animals come back at about **1 per home area per in-game day**, up to the target. **Overhunting** (killing more than half the target within 2 days) marks the area *thinned*: its target drops by 50 % for 3 days, then recovers. Hunters' quests and pelt prices react (see the bounties in `bestiary.md`). |
| **Slimes** | Like wildlife, but they respawn only after rain or at night. Royal slimes return at most once per 7 days per area. |
| **Goblin camps** | A cleared camp **stays cleared** (saved). Later (5-10 in-game days), a **new band** may set up at another camp site in the region that is not owned or guarded. The cleared camp becomes a salvage and ruin spot. Bloodmoon raids still come during Bloodmoon nights. |
| **Crypt skeletons** | They **rise again** each in-game night while their **source** (the Bone warden's phylactery urn in the inner vault) is intact. Once the source is destroyed, the crypt stays clear and only remains (bone and loot) are left. |
| **Bosses** (Grukk, the Bone warden) | Unique: they never respawn. |
| **Player death** | The player wakes at the **last bed slept in**: an inn room paid for, or an owned home (Duskfall inn by default). They **lose 10 % of the coin carried** (minimum 0, at most 5 silver; coin banked with the Merchants' Guild is safe) and **keep all gear and items**. Quest state is unchanged, enemies that were fighting reset to full HP, and 6 in-game hours pass. |

## Implementation notes
- Respawn timers run on the in-game day clock (`LightingRig` hours and day count), are kept in the save file, and are evaluated
  when an area loads, not per frame.
- Each enemy spawner carries `homeArea`, `kind`, `targetCount`, `respawnPerDay` and `conditions` (night, rain).
- Camps: `WorldState` flag `camp.<id>.cleared` plus `nextBandDay`. Crypt: flag `crypt.source_destroyed`.
- Death: `GameManager` death screen, then *Wake* teleports to `SaveData.lastBed`, takes the coin penalty, sets health to full and advances time.
