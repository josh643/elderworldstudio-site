# Roadmap: ownership, land and settlement growth

Design notes from Joshua. Nothing here is built yet. The page records the intended systems and the order they ship in.

## 1. Upgrade boards for owned mines, businesses and forts

- Every property the player owns (a mine, a shop, a mill, a fort) has an **upgrade board**: a short tree of tiers.
- Each tier costs **gold plus hauled materials** (for example planks, stone blocks, iron ingots, nails). The materials must be
  carted to the site and are not bought on the spot, so this ties into cargo, carts and trade routes.
- **Hired workers** do the building over **in-game days**. More or better workers finish sooner. Work stops if the materials run out.
- Each tier brings **more output** (ore per day, goods per day, garrison size), **more upkeep** (wages, repairs, supplies) and
  **more raid attention**: a richer site gets raided by bandits and goblins more often and in larger numbers.

## 2. Land deeds

- Land is split into **plots**. Each plot has an **owner**: the Duke (Cedric Stormhold), a noble house, the Merchants' Guild, or **nobody**
  (unclaimed frontier land that can be claimed or bought from the crown).
- A plot's **price** depends on its **soil** (farming), **water** (river, well, spring), **ore** (mineral rights), **roads** (access for carts)
  and **distance to town** (safety and markets).
- Deeds are bought or granted and can be financed with a Merchants' Guild land loan.
- Progression: **homestead**, then **estate**, then the player's **own village or town** where NPCs come to settle.

## 3. NPC homes and autonomous settlement growth

- NPCs build up their own homes over time: a hut becomes a cottage, gains a workshop, then a second storey.
- Settlements grow and improve on their own (new houses, market stalls, walls, a chapel), driven by prosperity, safety and trade.
- **Hardware growth budget.** The device tier (phone, low-end PC, high-end PC) sets per-settlement caps for:
  - the number of buildings
  - the number of active NPCs (simulated and visible)
  - the level of detail
- Once a settlement reaches its cap, further growth shows up as **upgrades to existing buildings** (better materials,
  extensions, signs, decoration) instead of new buildings, so the world keeps improving without exceeding the budget.

## 4. Construction demand feeds prices

- Any building work in a region (NPC homes, settlement growth, or the player's upgrades and estates) raises regional
  **demand for building materials**: stone blocks, logs, planks, brick, nails, rope, clay and iron.
- The rise stays inside the normal **plus or minus 25 % supply and demand band**. A big project can briefly push a temporary
  **boom cap** above that (planned at about +35 %), which decays back into the band.
- A boom creates **hauling and supply quests** ("the Old Quarry needs 40 stone blocks by the 3rd") and makes
  material trade routes into the region more profitable.
- Prices **settle back** over a few in-game days once building stops. See `docs/economy-prices.md`.

## Phases

| Phase | Scope |
|---|---|
| **Early Access** | A few hand-picked plots and a set-piece house to buy and furnish. |
| **Update 1** | Free-form modular building, plus estates. |
| **Update 2** | Player villages, and autonomous NPC and settlement growth within the hardware budget. |
