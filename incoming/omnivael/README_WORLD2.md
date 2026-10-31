# Branch `wt-world2`: more townsfolk, Ashford Crossing and the Old Quarry

This branch was made as a file-level change (C#, DNA JSON, data). Unity was **not** opened, because main's player builds
were running at the time. Every assembly type-checks against the Unity 6000.3.25f1 reference DLLs (`tools/world2/typecheck.sh`
uses Unity's bundled Roslyn and does not launch the editor), but the scene has **not** been rebuilt and the tests have **not** run yet.

## What was added

### 1. NPCs (DNA, `Assets/Scripts/DNA/Resources/DNA/`)
Every file follows the v1 DNA schema (key order matches `garrick_the_smith.json`). Each one was generated and checked with
`node tools/world2/make_world2_dna.js`, which uses dna-creator's `web/dna.js` for mesh derivation and validation. There is one
additive field, `hire`: `{ hireable, wage (copper/day), loyalty 0-100, jobs:[{id,value}] }`. Older DNA without it is still
hireable at the default wage, and its two best skills become its jobs.

**Duskfall Hollow (13 new):** Aldric and Wyn (woodcutters), Hob (sawyer), Dunstan (carter), Rowan (hunter),
Berta (innkeeper) and her son Pip, Colm (smith's apprentice), Osric (land-office clerk), Brannoc (gate guard),
Maud (night watch), Nell (woodcutter's daughter) and Edda (elder). **Ashford Crossing (5):** Hodge the miller, Alys his wife,
Garron the fordwarden, Tamsin the fisher and Wat the millhand. **Old Quarry (3 workers):** Bors the foreman, Ysolde the
stonecutter and Kett the miner. **Bandits (3, hostile, `occupation: "bandit"`):** Vask (chief), Corwen and Hesk, who hold
the mine mouth.

They spawn the same way the existing townsfolk do: `DnaSpawner` runs on `WorldBootstrap.Installed` and spawns all
DNA for the scene. Townsfolk get `NPC` + `ScheduleComponent` + the new **`Hireable`**. Hostile DNA gets `EnemyAI`
with `questTag = "bandit"`, so the 4 "path" goblins stay unchanged. Authored NPCs (Sylas, Elmin, Mirella) and the
schedule villagers also get a `Hireable` with defaults based on their role, so **every NPC is hireable**.
`Hireable` (in `Systems/World`) stores hired and loyalty state in `NpcRelations`, which means it is saved. It provides
`Hire(wage)`, `Dismiss()`, `PayDay(paid)`, `JobSkill(job)` and `BestJob`. **There is no hire UI or work loop yet.**

### 2. Areas (`Systems/World/WorldAreas.cs` = shared layout; `Editor/EnvironmentBuilder.Areas.cs` = art)
Both areas are built into the existing slice scene and its 512 m terrain. There are no new scenes and no primitives:
only Hivemind Village / Bandit Village props, the Laterns pack, the assembled `Building_xx` prefabs, Game Buffs
terrain layers and the Hivemind `M_Water_01`.

* **Hollow Crossroads** is on the Silver Glen Path, 13 m outside the west gate at x=-51. `SliceBuilder.BuildPath` leaves a gap
  in the path's invisible edges at world x -48..-56, but only in art mode.
* **Mill Road → Ashford Crossing** runs about 170 m south (rect x -72..-12, z -170..-118). A river flows west→east at z≈-150
  with a shallow **ford** where the road crosses (x=-38). The **mill** (`Building_01`) has a turning water wheel
  (`SM_wheelA_a1` scaled to 3.6 m, using `Spinner`). The other buildings are the miller's cottage (`Building_09`), the
  fordwarden's lodge (`Building_03`) and the fisher's cottage (`Building_08`). There is a green with a campfire, a fishing
  rack on the south bank, fenced fields with hay, and the washed-out Oakrest road (barricades). Every building has a
  `DoorPoint` (`interiorScene = Interior_<id>`).
* **Quarry Track → Old Quarry** runs about 140 m north (floor x -86..-30, z 128..176). Terrain cliffs surround it on the N, E and W.
  It has a stone yard, a bunkhouse (`Building_09`, with a DoorPoint), the foreman's shelter, a campfire, the worked
  west face, and a mine mouth in the north face (DoorPoint `door_old_quarry_mine` → `Interior_old_quarry_mine`). The mine
  is the claimable site; Osric's land office is the hook. A bandit camp with barricades, braziers and shelters sits in front of it.
* Both roads have invisible walls, and so do the area perimeters and the riverbanks (open at the ford). New zones are
  `mill_road`, `ashford`, `quarry_road` and `quarry`, with titles, audio (Ashford → "town", the rest → "path") and save titles.
  The crossroads and the Silver Glen corridor stay `path`.
* Trees, grass, stumps and forest dressing are cleared from the new roads and areas *after* the existing code runs, and the
  areas use their own rng. Town, forest and Warrens layouts are therefore identical to main.
* Schedules (`Resources/Schedules/DuskfallHollow_Slice.json`) get 15 new town places and 20 Ashford/quarry places,
  plus `navAreas`: separate NavMesh regions for Ashford and the quarry. The town box grows to x -60..40 so it covers
  the gate post and the glen edge.
* Map (`Resources/UI/Maps/DuskfallHollow_Slice.json`) gets 2 new maps (`ashford`, `quarry`), 4 fog areas and 8 discovery
  places: crossroads, Ashford Mill, Ashford Ford, Fordwarden's Lodge, Old Quarry Stone Yard, Bandit Camp, Old Quarry Mine and Land Office.
* The cottage north of the square is now shown as **Land Office** (its id stays `cottage_north`, so saves are unaffected).

## How to build (after main's Windows/Linux builds finish)
Do **not** open the worktree folder in Unity. It has no `Library`, so a full reimport would cost several GB.
Merge into main and build there:

```bash
cd /workspace/omnivael-game/unity/OmnivaelChronicles
git status                      # main had uncommitted Data/prices.json + MapCapture.cs edits: commit/stash them first
git merge wt-world2
U=~/Unity/Hub/Editor/6000.3.25f1/Editor/Unity
# 1) bake the new DNA models (player builds need Resources/DNA/Models/<id>.prefab, else they fall back to elmin/mirella)
"$U" -batchmode -nographics -quit -projectPath . -executeMethod Omnivael.DNA.EditorTools.DnaBaker.BakeAll -logFile Logs/bake.log
# 2) rebuild the slice scene (this runs EnvironmentBuilder.Build -> BuildTravelAreas) and the players
"$U" -batchmode -nographics -quit -projectPath . -executeMethod Omnivael.EditorTools.SliceBuilder.BuildAllLinux   -logFile Logs/build-linux.log
"$U" -batchmode -nographics -quit -projectPath . -executeMethod Omnivael.EditorTools.SliceBuilder.BuildAllWindows -logFile Logs/build-win.log
# scene only: -executeMethod Omnivael.EditorTools.SliceBuilder.BuildScene   (menu: Omnivael/Rebuild Slice Scene)
tools/run-tests.sh
```
Look for `[Env] travel areas`, `[Env] Mill_Ashford ...` and `[Env] missing ...` lines in the log. If a prefab is missing,
that piece is skipped and a warning is logged.

## Tests
* **Added (EditMode):** `Omnivael/Tests/EditMode/WorldAreasTests.cs` checks that zones leave town and path unchanged
  (including the AudioTests probe at (-50,0,0)) and that roads connect and the ford lies on the Mill Road.
  `Scripts/DNA/Tests/EditMode/DnaWorld2Tests.cs` checks that all 24 DNA validate, that townsfolk are hireable with schedules on
  known places covering 24 h, that area NPCs stay in their area, and that bandits are hostile, tagged `bandit`, uniquely named and spawn in the quarry.
* **Updated:** `UiDataTests.MapAndHints_Load` now expects 4 maps.
* **To add (PlayMode, after the scene rebuild):**
  * Ashford/quarry NPCs spawn on their own NavMesh region and reach their 09:00 places.
  * `GameManager.ZoneTitle` is "Ashford Crossing" after a teleport to (-40,0,-140), and the map's `MapForZone("quarry")` returns `quarry`.
  * Discovery toasts fire for `crossroads`, `ashford_mill` and `bandit_camp`.
  * The 3 bandits exist and the path-goblin count is still 4.
  * Every `DoorPoint` id is unique.
  * `Hireable` exists on every `NPC`, and Hire/PayDay/Dismiss round-trip through a save.
  * The mill wheel rotates.
  * The player can walk from the gate down the Mill Road, through the ford and up the Quarry Track, but not off-road.

## Known gaps / to check in the editor
* Nothing has been seen yet. Building sizes and door sides of `Building_01`/`03` (unused until now) are found at build time
  (DoorOf + bank fit), so check that lots don't overlap, the wheel sits against the mill wall, and the stepping stones read well.
* There is no wolf or animal pack in the project, so the quarry threat is 3 human bandits on DNA human rigs. They have no
  weapon props yet (EnemyAI attacks unarmed).
* Interiors for the new DoorPoints (`Interior_*`) are reserved names only, like the town's.
* There is no hire UI, wage payment hook or "hired workers do the job" behaviour yet; this branch only adds the data and API.
* The greybox (no packs) mode does not build the areas (art only), and its path walls stay closed.
* There are about 24 more animated NPCs. Profile on low-end hardware; the travel-area NPCs are 140+ m from town.
* Schema doc: add the `hire` block to `dna-creator/DNA_SCHEMA.md` (outside this repo, not edited here).
