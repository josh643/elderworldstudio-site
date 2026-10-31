# Omnivael: Chronicles of the Realm — Playable Slice 0.1

Unity **6000.3.25f1 (Unity 6.3 LTS)**, **Universal Render Pipeline 17.3** (`Assets/Omnivael/Settings`: `URP_PC` for High/Very High/Ultra, `URP_Mobile` for Very Low/Low/Medium = Android default; set up by `RenderSetup.SetupURP`), Active Input Handling = **Both** (legacy Input Manager for keyboard/mouse/touch,
`com.unity.inputsystem` 1.20.0 for gamepads), no third-party packages or assets.
Year 1500, Fourth Age. Duskfall Hollow, on Valtoria's frontier. Bloodmoon goblins have camped on the Silver Glen Path.

## What's in the slice
- **Duskfall Hollow** (town): palisade, tavern, herbalist hut, cottages, Korrin's whispering well, Elements shrine.
  - **Warden Sylas** (quest giver, `!` / `?` marker) at the west gate
  - **Elmin** at the tavern (the hearth is the respawn point)
  - **Mirella the Herbalist** (talk to her for a full heal)
- **Silver Glen Path** (wilderness): pine forest, two Bloodmoon camps, 4 goblins.
- **The Well-Warrens** (dungeon room): torch-lit room with **Grukk Bloodtusk**, the goblin boss. He has a telegraphed ground slam every third attack.
- Quest **"Bloodmoon at the Hollow"**: talk to Sylas, kill 4 path goblins and Grukk, then return for 2 Silver 50 Copper (canon 100:1 cents economy).
- Combat: melee with auto-aim, cooldowns, knockback, hit flash, damage numbers, enemy health bars. Goblins leash back home and heal.
- Health, out-of-combat regen, death screen, respawn at the tavern (surviving enemies reset).

## Controls
| PC (keyboard / mouse) | Gamepad (Xbox; PC + Android over Bluetooth) | Touch (Android) |
|---|---|---|
| Left-click ground = move (hold to steer) | Left stick = move (radial dead zone 0.2), D-pad also walks | Tap/hold ground = move, virtual joystick bottom-left |
| WASD / arrows = move | | |
| Space / J = attack, click goblin = walk up and attack | **A** = attack | ATTACK button, tap goblin |
| Tab = cycle target | **RB** or right-stick click = cycle target | Tap a goblin to target it |
| E / Enter = talk, click NPC = walk up and talk | **X** = talk | TALK button, tap NPC |
| Space / E / click = continue dialogue | **A** (or X) = continue, **B** = close dialogue | Tap = continue |
| Esc = pause | **Start (Menu)** = pause; Start / A / B resume | |
| Hold Space / J = Heavy Strike* | Hold **A** = Heavy Strike* | Hold ATTACK = Heavy Strike* |
| Shift = dodge roll* | **B** (outside dialogue/menus) = dodge roll* | DODGE button or quick swipe* |
| K = skills / perk menu | **View (Back)** = skills / perk menu; D-pad select, A unlock, B close | SKILLS button (under the status panel) |
| F3 = FPS counter | | |

\* Needs the matching Swordsmanship perk. Space stays as attack on PC, so the dodge uses Shift.

The device used last decides the HUD: with a gamepad the on-screen joystick and buttons are hidden and button prompts show
(`A Attack`, `X Talk`, `A: Continue  B: Close`, a 12 s controls hint). Touching the screen or using the mouse/keyboard brings them back.
There is no camera control, so the right stick is free (only its click is used). There are no dialogue choices yet,
so B skips the remaining lines and the conversation's outcome (quest accepted, heal, reward) still applies.

**Soft lock-on.** Every attack (A, Space/J, ATTACK, click) targets the nearest living enemy within 6 m in a 120-degree cone in front
of the hero. If none is in the cone, it takes the nearest enemy within 6 m in any direction. The hero turns to face the target. If the target is slightly out of reach,
the hero lunges up to 1.6 m; if it is further away, the hero walks up and swings once. A red ring marks the target, and its health bar stays visible.
RB / R3 / Tab cycle through enemies within 10 m (nearest first). The target clears when it dies or is more than 10 m away. This works for goblins and Grukk.
Tunables live on `PlayerController` (`targetAcquireRange`, `targetConeAngle`, `targetDropRange`, `lungeMax`).

**Input architecture.** `GameInput` (runs first, `DefaultExecutionOrder(-100)`) merges everything into Move/Attack/Interact/Advance/Cancel/Pause/Cycle.
Keyboard, mouse and touch use the legacy `UnityEngine.Input`. Gamepads use `Gamepad.current` from the Input System, which maps Xbox pads the same way
on Windows, Linux and Android. Legacy joystick axes do not. Gamepad code is behind `#if ENABLE_INPUT_SYSTEM`.
`SliceBuilder.ConfigureProject` forces `activeInputHandler = 2` (Both) before every build.

## Leveling, skills and perks
Data-driven from `Assets/Omnivael/Resources/Progression/progression.json` (JsonUtility, see `ProgressionData.cs`). `Progression.cs` holds the runtime state.
- **XP:** goblin 25, Grukk 150, quest "Bloodmoon at the Hollow" 200, each newly discovered zone 20 (the starting town gives none).
  A full slice run gives 490 XP, which reaches **level 3**.
- **Levels:** cap 30. XP to the next level is `round(100 * level^1.5)` (100, 283, 520, 800, ...). Each level gives +10 max HP (and heals that amount) and 1 skill point.
- **Use-based skills:** Swordsmanship rises with landed melee hits (a heavy hit counts as 2). Each hit shows a floating `+Swordsmanship`, and skill level-ups show a toast.
  Uses needed for the next level = `usesBase + usesPerLevel * level` (4 + 1.5L).
- **Perks** (menu: K / View / SKILLS; freezes time):
  Keen Edge (+10% melee damage, 1 pt), Heavy Strike (hold attack 0.5 s and release for 1.8x damage, 1 pt, needs Swordsmanship 2),
  Quick Dodge (4.5 m roll with invulnerability frames and a 0.9 s cooldown, 1 pt).
- **Adding skills** (blade, bow, shield, alchemy, smithing, cooking...): add an entry to `skills` in the JSON with its perks
  (`damageMultiplier` for passives, `ability` for unlocks). Call `Progression.I.RegisterSkillUse("<id>")` wherever the skill is used,
  and check `HasAbility("<ability>")` for active perks.
- HUD: level, unspent points, and an XP bar in the status panel (scaled by `UiLayout`).
- **Save: TODO.** The slice has no save system yet. `Progression.Snapshot()` / `Restore()` are the hooks for when one exists.

## Build
```
./build-linux.sh      # -> Builds/Linux/OmnivaelChronicles.x86_64 and Builds/OmnivaelChronicles-linux-x86_64.zip
./build-android.sh    # -> Builds/Android/OmnivaelChronicles.apk (needs the Android Build Support module)
./build-windows.sh    # -> Builds/Windows/OmnivaelChronicles.exe and Builds/OmnivaelChronicles-windows-x86_64.zip (needs windows-mono; untested on Windows)
```
The scene `Assets/Omnivael/Scenes/DuskfallHollow_Slice.unity` is **generated** by `Assets/Omnivael/Editor/SliceBuilder.cs`
(menu **Omnivael > Rebuild Slice Scene**). Edit the builder, not the scene, until real art replaces the greybox.

## Automated test and screenshots
```
xvfb-run -a -s "-screen 0 1280x720x24 +extension GLX" ./Builds/Linux/OmnivaelChronicles.x86_64 \
  -force-glcore -screen-fullscreen 0 -screen-width 1280 -screen-height 720 -omnishots ../../shots
```
This plays the whole quest (accept, fight, clear the path, enter the Warrens, die and respawn, kill the boss, turn in), checks XP/level
(490 XP, level 3, 2 points), unlocks Keen Edge in the skills menu, saves PNGs, and logs `SMOKE PASS`.
Optional flags: `-omniprefix v2_phone_` (prefix for the PNG names) and `-omnitouch` (force the phone touch layout on desktop,
e.g. with `-screen-width 2340 -screen-height 1080` to preview the Android HUD).
Add `-omnipad` to also play the opening with a virtual Input System gamepad. It walks with the left stick, checks the dead zone,
uses X to talk, A to advance and B to close, Start to pause and resume, and A to attack in combat. It also saves `*_02p/02q/02r` prompt screenshots.
(The headless player has no window focus, so the virtual pad sets `backgroundBehavior = IgnoreFocus`. A real game ignores pads while unfocused.)

PlayMode tests (Input System `InputTestFixture`, simulated gamepad) are in `Assets/Omnivael/Tests/PlayMode`.
They need the Editor closed, or a copy of the project:
```
Unity -batchmode -nographics -projectPath . -runTests -testPlatform PlayMode -testResults Logs/playmode-results.xml
```

## UI scaling and safe area
The HUD (`HUD.cs`, IMGUI) is laid out in 1280x720 reference units and scaled by `UiLayout.Scale`, which works like a uGUI
CanvasScaler set to Scale With Screen Size (1280x720 reference, match 0.5): 1.0 at 1280x720, 1.5 at 1920x1080, about 1.66 at 2340x1080.
Fonts are rasterized at the final pixel size, so text stays sharp. Reference sizes: dialogue 30 px, HUD/quest/toasts 24-28 px,
name labels 26 px bold, damage numbers 34 px. Panels, the dialogue box, the joystick, ATTACK and TALK are anchored to `Screen.safeArea`.
Touch controls sit 64 reference px in from the safe-area edges.

## Performance (Intel Iris Xe / mid-range phones)
URP (PC asset: soft shadows, MSAA 2x; Mobile asset: hard shadows, no MSAA), one directional light (soft shadows, 1 cascade, 38 m, medium resolution), at most 3 pixel lights, MSAA 2x on desktop (off on mobile),
no HDR, no post-processing, no realtime GI or reflection probes, vsync on desktop, 60 fps cap, GPU instancing on all materials,
and an IMGUI HUD with no canvases. Linux uses Vulkan, then OpenGL Core as fallback. On a laptop, use `-force-glcore` if Vulkan misbehaves.

## Characters (Dragonsan + humanoid animation)
The hero, NPCs, goblins and boss use Dragonsan Studios models (Humans Complete Pack; a 3-armor-set subset of Goblins Complete Pack),
animated with a shared Humanoid controller (`Assets/Omnivael/Animation/Humanoid_Combat.controller`, with Female and Goblin override
controllers) built from Explosive "RPG Character Mecanim Animation Pack FREE" and Kevin Iglesias "Human Basic Motions" clips.
`CharacterAnimDriver` feeds Speed, Attack, Heavy, Hit, Dodge, Talk and Dead from gameplay. Root motion is off. Root Y is "Based Upon Feet",
and a per-frame sole snap measures the mesh sole depth once and keeps the lowest sole on the ground under the CharacterController
(within 0-3 cm idle and walking). `SliceBuilder` swaps the models in (`SwapModel`) and falls back to primitives when the packs are missing.
Weapons are primitive placeholders parented to the RightHand bone.

**The third-party art is not in git** (`Assets/DragonsanStudios`, `Assets/ExplosiveLLC`, `Assets/Kevin Iglesias` are .gitignored, about 3.7 GB).
After a fresh clone, run `tools/import-character-packs.sh`. It pulls the packs from omnistore, repacks the Goblins subset and strips the
Explosive Editor folder, imports everything, runs `CharacterSetup.Setup` (URP material upgrade and controllers), then drops the cached packs.
Dragonsan textures are capped at 2K, and 1K ASTC on Android (`ThirdPartyImportRules.cs`).
Feet check: run the player with `-omnishots DIR -omnifeet`. It logs `FEET <name> idle/walk: SOLE=...` and saves low side-view `feet_*.png`.
Character showcase: `-omnishowcase`.

## Environment (realistic art pass)
Duskfall Hollow is a frontier **logging settlement**. `SliceBuilder.BuildScene` calls `EnvironmentBuilder.Build` (art mode) which generates:
- **Terrain** (`Generated/Env/SliceTerrain.asset`, 512 m): gentle hills, Game Buffs ground layers (Grass_1/Grass_4 meadow, Dirt_1 forest floor and
  woodchips, Mud_Wet_10 square/yards/trails, Rocky_Dirt_5 road, Rock_10 cliffs), Hivemind/Leartes grass details, Leartes pine/hornbeam groves with
  clearings and bush/shrub undergrowth. Trees are felled within ~9 m of the palisade (stumps and cut logs instead).
- **Town**: 8 Hivemind Fantasy Village buildings (auto-assembled by `HivemindBuildings.Extract`), Bandit-log palisade and west gate, Astrofish well,
  lantern posts, market stalls, smithy yard, and the logging camp: lumber yard inside the west gate, sawpit yard east of the longhouse, cutting
  ground in the south-west corner (log piles, plank stacks, timber carts, chopping blocks with axes, split-wood litter, muddy trails).
- **Silver Glen Path** (west) with two goblin camps, the Well-Warrens cliff mouth, and the **Warrens interior** (rock walls, cave floor terrain,
  braziers, junk throne). Gameplay colliders stay SliceBuilder's invisible boxes.
- **Doors**: every building has a `DoorPoint` (`Doors/Door_<buildingId>`, stable `doorId` = `door_<buildingId>`, `interiorScene` = `Interior_<buildingId>`).
  Interiors are separate scenes to be built later; there is no loader yet.
- **NPC waypoints**: `Waypoints/*` (door-side points per building, `Market`, `Well`, `Work_Sylas`, `WestGate`).
- **Lighting**: `LightingRig` owns sun/sky/ambient/fog. `LightingRig.I.SetTimeOfDay(hours)` is the hook for the day/night schedule;
  `SetIndoor(true)` is used for the Warrens. `EnvQuality` trims tree/detail distance on low quality (`-omniquality N` in the player).
- **Camera**: desktop pitch 24°, distance 7.2, fov 52; touch pitch 30°, distance 9.6.

Third-party art is .gitignored. Restore it with `tools/import-env-packs.sh` (subsets only, via `tools/packtool.py` + `tools/env-packs/*_roots.txt`),
then rebuild the scene. Editor tools: `EnvInspect.Run -primitives` (lists any visible primitive/placeholder renderers and the doors),
`ShotRenderer.RenderEnvViews [-only a,b] [-shotdir DIR]` (editor renders into `screens/env-v1/`).

## Swapping in more owned Asset Store art
Still to do: building interiors, Poneti UI (HUD), Hovl VFX (hits, slam, campfires).
