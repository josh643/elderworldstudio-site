# Magic

Approved design (docs only for now). Magic works like the schools in Oblivion, with one difference: **magic is also a trade**. Every school has
combat or adventuring uses **and** economic uses that pay, can be hired out, and feed the economy (`economy-prices.md`).

## Core rules
- **Mana and reagents.** Small spells cost only mana. Big or lasting effects (wards, enchantments, field blessings, binding) also use
  **reagents**: frost shards, ember cores, slime gel, royal jelly, mage ink, bone dust, herbs (see `bestiary.md` and `crafting-recipes.md`).
- **Skills level by use.** Each school is a skill (0-10) that rises as it's used, like the life skills. Higher levels unlock stronger spells and
  lower costs.
- **Mage Guild ranks** (Initiate, Apprentice, Journeyman, Adept, Magister) unlock spell purchases, **enchanting**
  (from Apprentice) and **spellmaking** (from Adept, combining known effects into custom spells).
- **Paid magic jobs.** Guild job boards and NPC requests: ward a farmstead, enchant the warehouse crates, cool the inn's
  ice cellar, bless the spring sowing, light the smithy forge. These are an income line like hauling or crafting.

## Schools

| School | Combat / adventure | Trade / economic uses | EA? |
|---|---|---|---|
| **Spatial** | Later: blink, recall marks | **Container capacity tiers** x1.5 / x2 / x3 (`containers-and-magic.md`), carry-weight charm, cart lightening | **Yes** |
| **Elemental** (fire, frost, storm) | Firebolt, frost lance, chain lightning | **Forge lighting** (no coal for the first heat, so smithing fuel cost drops), **ice cellars** (keep food and ale fresh: no spoilage), **mining** (crack rock: quarry output +), storm-powered mill on calm days | **Yes** |
| **Restoration** | Heal, cure poison and disease, turn undead | **Bless fields and livestock** (crop and wool yield +), healer services in town, cleanse wells | **Yes** |
| **Warding** | Shields, magic resist | **Fort and estate wards** (raid damage −, fewer raids), **ward locks** on chests and warehouses (anti-theft), protective wards on carts | **Yes** |
| Illusion | Calm, fear, invisibility | **Disguise**, **haggling** (better prices), entertainers' lights | Later |
| Conjuration | Summon spirit helpers | **Bind spirits into tools** (self-sharpening axes, tireless saws) with reagents like slime and ember cores; spirit labourers on worksites | Later |
| Alteration | Stoneskin, water-breathing | **Strengthen walls and tools** (durability), **featherweight** (haul more), waterproof cargo | Later |
| Necromancy | Raise dead, drain | **Forbidden and illegal**: guards hunt users, bounties are posted. It's the source of the crypt skeletons (the Bone warden's urn, see `respawn.md`) | Antagonists only |

## EA spell list (first pass)

| Spell | School | Lvl | Mana | Reagent | Effect |
|---|---|---|---|---|---|
| Spatial Fold I | Spatial | 2 | 40 | 2 frost_shard + 1 mage_ink | Container tier I (x1.5) |
| Spatial Fold II | Spatial | 4 | 80 | 5 frost_shard + 2 mage_ink + 1 royal_jelly | Container tier II (x2) |
| Featherpack | Spatial | 1 | 20 | none | +15 kg carry weight for 10 min |
| Firebolt | Elemental | 1 | 15 | none | 18 fire damage, ignites |
| Forgeflame | Elemental | 2 | 25 | 1 ember_core | Lights a forge or smelter for 1 day (no coal for heating) |
| Frost Lance | Elemental | 2 | 20 | none | 16 frost damage, slows |
| Ice Cellar Rune | Elemental | 3 | 60 | 3 frost_shard | A cellar or storehouse keeps food from spoiling for 7 days |
| Rock Splitter | Elemental | 3 | 35 | none | Quarry or mine node yields +50 % once |
| Heal | Restoration | 1 | 20 | none | Restores 40 HP |
| Cure | Restoration | 2 | 25 | 1 silverleaf | Removes poison and disease |
| Bless the Field | Restoration | 3 | 70 | 2 bone_dust + 1 water | Crop yield +20 % for a season on one plot |
| Ward Shield | Warding | 1 | 25 | none | Absorbs 40 damage |
| Ward Lock | Warding | 2 | 30 | 1 mage_ink | Magic lock on a chest or door (lockpicking −3 levels) |
| Estate Ward | Warding | 4 | 120 | 4 frost_shard + 2 mage_ink | Owned site: raid chance −30 % and building damage −50 % for 14 days |

## Data hooks (when built)
- `Resources/Magic/spells.json`: id, school, level, mana, reagents[], effect, duration and target (self, enemy, container, site, plot).
- New skills: `spatial`, `elemental`, `restoration`, `warding` (EA), sitting next to the life skills.
- The Mage Guild is both a merchant and a trainer: it sells mage_ink, spell tomes (the `Book` category, see `books.md`) and enchant services.
