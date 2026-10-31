# Bestiary (Early Access roster)

Design document. The **loot item ids** are shared with `docs/crafting-recipes.md` and `docs/economy-prices.md`.
Levels follow the hero curve: Duskfall content is levels 1-6 and the Old Quarry and crypt are levels 4-8.
Enemy models: goblins exist already, and slimes come from the **wt-slimes** branch (NiteRose designs). Wolves, skeletons,
spiders and boars use pack models when they're picked. No custom models are made for this roster.

Loot notation: `item x min-max (chance)`. Chance is per kill. An entry without a chance always drops.

## Goblins (Bloodmoon Horde), existing

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Goblin scout | Silver Glen path camps, forest edges near Duskfall | 1-3 | Packs of 2-4 that circle and flank. They flee at low HP and call nearby camps. |
| Goblin raider | Bloodmoon Camp, night raids on Duskfall during Bloodmoon | 3-5 | They charge the nearest target and throw torches at buildings during raids. |
| Lieutenant (Grukk Bloodtusk) | Well-Warrens boss chamber | 6 | Boss. He uses cleaver combos and a ground slam, and at half HP he summons 2 scouts. |

Loot: `goblin_ear x1` (bounty item, Garrick pays), `copper_coin x2-9`, `bloodmoon_bandana (15%)`, `goblin_knife (6%)`,
`rusted_iron x1 (20%)`. Grukk: `grukk_tusk`, `grukk_cleaver`, `copper_coin x60-90`.

## Slimes (models from wt-slimes)

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Fire slime | Old Quarry floor, near the charcoal kilns, warm caves | 3-5 | Slow hopper that leaves a burning trail and splits into 2 small slimes on death once. Water flasks deal double damage. |
| Crystal slime | Well-Warrens deep pockets, quarry seams with exposed crystal | 4-6 | Armoured (blunt weapons do +50 %) and shoots frost shards at range. It freezes the floor briefly. |
| Royal slime | Rare, 1 per area, at night after rain | 7 | Mini-boss. It absorbs small slimes to heal and grows, and drops a crown-like gel core. |

Loot:
- every slime: `slime_gel x1-3`
- fire: `ember_core (35%)`
- crystal: `frost_shard x1-2 (50%)`
- royal: `slime_gel x6-10`, `royal_jelly x1`, `ember_core (50%)`, `frost_shard x2 (50%)`

Uses: **slime_gel** goes into hide glue (woodworking: crates and barrels without nails, cheaper bindings) and is a potion
base (alchemy: thickens health potions so they keep longer). **ember_core** makes fire flasks and is a smelter fuel booster (one core
replaces 2 coal). **frost_shard** makes frost flasks and cooling for the still (liquor yield +10 %). **royal_jelly** makes greater health potions.

## Wolves

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Grey wolf | Forests around Duskfall, Mill Road, Ashford woods | 2-4 | Packs of 3-5 that surround the target. One wolf feints while the others bite from behind, and the pack retreats when its leader dies. |
| Dire wolf (pack leader) | Deep forest, winter | 5-6 | Has a howl buff (+20 % pack speed) and a knock-down lunge. |

Loot: `wolf_pelt x1`, `wolf_meat x1-2`, `wolf_tooth x1-2 (60%)`. Dire wolf: `wolf_pelt x2`, `dire_wolf_fang x1`.
Uses: pelts are tanned into leather or a fur cloak, meat goes to cooking (stew, smoked meat), and teeth and fangs make trinkets and arrowheads.

## Skeletons (Old Quarry depths, the crypt under the chapel)

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Skeleton labourer | Old Quarry lower galleries | 4-5 | Slow, with pick swings. They reassemble after 10 s unless the bones are crushed (blunt finisher) or blessed. |
| Skeleton guard | Crypt | 5-7 | Shield block (frontal) with spear thrusts. They patrol fixed routes. |
| Bone warden | Crypt inner vault | 8 | Mini-boss. It raises 2 labourers and swings a slow sweeping halberd. |

Loot: `bone x1-3`, `bone_dust (50%)`, `rusted_iron x1-2 (40%)`, `copper_coin x0-5`. Warden: `bone x6`, `bone_dust x3`, `old_crypt_key`.
Uses: **bone_dust** is a fertilizer for farms (+crop yield) and an alchemy reagent. **bone** is ground into bone dust at a mill, or
carved into trinkets. **rusted_iron** is smelting scrap (3 rusted iron + 1 coal make 1 iron ingot).

## Stretch: giant spiders

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Wood spider | Dense pine forest, abandoned mine shafts | 3-5 | Ambushes from webs on ceilings and trees and shoots a web that slows the target. Fire burns the webs. |

Loot: `spider_silk x1-3`, `venom_sac (30%)`. Uses: silk can be spun into rope (stronger rope) or woven into silk cloth, and venom makes poison flasks and antidote.

## Stretch: boars

| Variant | Biome / spawn | Lvl | Behaviour |
|---|---|---|---|
| Wild boar | Oak woods, farm edges (they raid fields at dusk) | 2-4 | Neutral until the player gets close, then charges in a straight line. Side-stepping makes it crash and stagger. |

Loot: `boar_hide x1`, `boar_meat x2-3`, `boar_tusk (50%)`. Uses: the hide is tanned into thick leather (armour), the meat goes to cooking, and tusks make trinkets and tool handles.

## Spawn rules
- Each area has a level band and a spawn table. Night, weather and season tilt the tables (wolves in winter, slimes after rain).
- Raids: the Bloodmoon goblin raids scale with the town's prosperity and the player's owned sites (see `roadmap-ownership-growth.md`).
- Bounties: the Duskfall notice board posts bounties for goblin ears, wolf pelts during livestock attacks, and skeleton clearing in the quarry.
