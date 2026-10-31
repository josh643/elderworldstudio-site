# Containers, capacity and spatial magic

**Canon rule (Joshua): there is no infinite storage.** Every container has a finite capacity, and so does the player's pack.

## Capacity model

Every container has two limits, **volume** (in units: 1 unit is about one bottle or one hand-sized item) and **weight** (kg). Whichever fills first
is the limit. Each item has `volume` and `weight`. Liquids can only go in liquid containers, and dry goods only in dry containers.

| Container | Holds | Volume | Max weight | Notes |
|---|---|---|---|---|
| Pack (player) | Anything carried | 40 | 30 kg | Bigger packs come from leatherworking (60 / 80). |
| Small crate | Dry goods, materials | 40 | 60 kg | Crafted from planks and nails. Stackable on a cart. |
| Large crate | Dry goods, materials | 100 | 150 kg | |
| Chest | Gear, valuables | 60 | 80 kg | Lockable. |
| Barrel | **Liquids only** | 30 servings (bottles) | 45 kg | Has a tap. The liquid level drops as it's drawn and is visible on the model. The empty barrel is reusable and sellable. |
| Sack | Grain, flour, salt | 25 | 30 kg | Cheap, from cloth. |
| Hand cart | Crates, barrels, sacks | 6 container slots | 300 kg | |
| Wagon | Crates, barrels, sacks | 16 container slots | 1200 kg | Needs a horse or ox. |
| Warehouse (owned) | Containers | Per tier: 40 / 80 / 160 container slots | n/a | Upgrade board (see `roadmap-ownership-growth.md`). |

Carts and warehouses store **containers**, not loose items, so cargo is always crates, barrels or sacks. The container UI shows each one's fill level.

## Spatial enchantment (capacity tiers)

Crafted, **placed** storage (crates, chests, barrels, carts, warehouse racks) can be enchanted with spatial magic. The pack
can't be enchanted in EA.

| Tier | Capacity | Reagents (per container) | Who |
|---|---|---|---|
| I | x1.5 volume (weight limit unchanged) | 2 `frost_shard` (crystal slimes) + 1 `mage_ink` | Mage Guild enchanter, or the player at Spatial Magic 2 |
| II | x2 volume, x1.25 weight | 5 `frost_shard` + 2 `mage_ink` + 1 `royal_jelly` | Mage Guild, or the player at Spatial Magic 4 |
| III | x3 volume, x1.5 weight | 10 `frost_shard` + 4 `mage_ink` + 1 `spatial_focus` (rare) | Mage Guild master only (EA) |

- Tiers apply in order (I, then II, then III). The tier is stored on the container instance and shown in its UI as
  `Spatial II (x2)`.
- **mage_ink** is crafted by Mage Guild scribes (alchemy: `bone_dust + slime_gel + water`, Alchemy 3), or bought from the Mage Guild.
- Mage Guild service fee: 5s (I), 20s (II), 75s (III), plus the reagents.
- Breaking an enchanted container spills whatever is above its base capacity.
- New skill **Spatial Magic** (Mage Guild trainer): enchanting, and later a weight-lightening charm for carts.

## Container UI

- The title shows the container type and enchant tier, for example **Large crate · Spatial I (x1.5)**.
- Fill bars show **volume used / max** and **weight used / max**, coloured green below 75 %, amber up to 100 % and red when full.
- Barrels show the **liquid name, servings left / 30** and a vertical liquid gauge. *Draw* (tap) fills one empty bottle per serving.
- Carts and warehouses list their containers, each with its own fill bar.
- The gamepad and touch layouts follow the other menus: D-pad or stick to move, A to take or put, Y to take all, B to close. Touch uses large row targets.
