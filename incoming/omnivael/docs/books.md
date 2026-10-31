# Books, notes and ledgers

Design document (docs only for now). Books are **items** (category `Book`). They can be read from the pack, bought and sold, and
some are rare finds. Reading opens a paged reader (gamepad: LB/RB turn pages, B closes. Touch: swipe).

## 1. Readable lore books (Early Access set, 12)

| id | Title | Where | Contents |
|---|---|---|---|
| book_founding_of_duskfall | *The Founding of Duskfall Hollow* | Duskfall chapel shelf | The woodcutters' charter, the first palisade and the Whispering Well. |
| book_bloodmoon_horde | *Of the Bloodmoon Horde* | Warden's house | Goblin clans, the red-moon raids and why Valtoria sends no soldiers. |
| book_well_warrens | *Below the Well* | Tavern (Berta sells it) | Folk tales of the tunnels under the Whispering Well. |
| book_silver_glen_mines | *Silver Glen: Veins of the Mountain* | Silver Glen counting-house | Eastmarch's ore town: its mine shafts, the guild ore tithe and the smelters. |
| book_friar_glen_mills | *Millwheels of Friar Glen* | Friar Glen, Ashford mill | Milling, grain carts and the logistics of the Mill Road. |
| book_merchants_guild | *Ledger and Seal: the Merchants' Guild* | Brightmere guild hall | Banking, letters of credit, counting-houses and guild posts. |
| book_house_stormhold | *House Stormhold* | Brightmere castle library | Duke Cedric Stormhold's line and the castle's charter. |
| book_great_war | *The Great War of Valtoria and Aldoria* | Brightmere, rare | Valtoria, Aldoria and the Eternal Ruins artifact. |
| book_elements | *The Shrine of the Elements* | Duskfall shrine | The elemental faith and the elements token. |
| book_old_quarry | *Stone and Bone: the Old Quarry* | Quarry bunkhouse | Why the lower galleries were sealed (skeletons). |
| book_herb_lore | *Mirella's Herb Lore* | Mirella's Herbalry | Silverleaf, healing herbs and where they grow (doubles as a skill book, see below). |
| book_songs_of_the_hollow | *Songs of the Hollow* | Tavern | Lyrics, including "The Hollow Axe" (the tavern band itself is on hold). |

## 2. Skill books (one-time effect on first read)

| id | Title | Effect | Price |
|---|---|---|---|
| skill_smithing_basics | *The Village Smith* | Smithing +1 level, unlocks **barrel hoops and hinges** | 2s 50c |
| skill_woodworking_basics | *Sawpit and Adze* | Woodworking +1, unlocks **crates** | 2s |
| skill_brewing_basics | *The Alewife's Book* | Brewing +1, unlocks **ale (barrel)** | 3s |
| skill_milling_basics | *Grain to Flour* | Milling +1, unlocks **brown bread** | 1s 50c |
| skill_alchemy_bulk | *Vats and Vials* | Alchemy +1, unlocks **health potion (barrel)** | 6s |
| skill_smelting_steel | *Carbon and Fire* | Smithing +1, unlocks **steel ingot** (still needs Smithing 4) | 12s |
| book_herb_lore | *Mirella's Herb Lore* | Herbs +1, reveals silverleaf spots on the map | 4s |

The effect is applied once per save (the item remembers it was read). Later copies are lore only and sell normally.

## 3. Notes and letters that start quests

Notes are found on bodies, in chests or pinned to the notice board. Reading one **starts or advances a quest** (wired through
`QuestManager` as a `read_note` objective or trigger).
- `note_goblin_orders`: on a goblin raider. It starts *Bloodmoon at the Hollow* if it hasn't begun yet, and points to the camp.
- `note_pip_drawing`: Pip's drawing of the well. It advances *Missing Pip* (Berta).
- `letter_osric_claim`: Osric's quarry claim deed copy. It starts *Osric's Quarry Claim*.
- `note_crypt_rubbing`: a rubbing from the quarry wall. It points to the crypt (Bone warden).
- `letter_guild_credit`: a letter of credit (Merchants' Guild) that can be cashed at any guild post or counting-house.

## 4. Journal and ledger

- **Journal** (always in the pack, can't be dropped): the Quest journal screen. It holds quest entries, notes read, books read and bestiary
  entries filled in as enemies are met or killed.
- **Ledger**: given when the player first owns a business or opens a guild account. It shows income and upkeep per site, bank
  balance, loans and repayments, and the trade routes run (buy price, sell price, cart cost, profit).

## 5. Books as trade goods

- Category `Book` in `economy-prices.md`: base 50c to 15s depending on rarity. Brightmere (guild hall, library) buys
  books at +25 % and Duskfall pays -15 %.
- Blank books and parchment (`blank_book`, `parchment`) are crafted from leather plus paper (paper comes from cloth rags at a mill, planned) for
  scribes. Copying a book at a scribe desk is a planned scribing skill.
