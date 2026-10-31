# Travel roadmap

Travel is part of the economy: every way of moving has a cost and a capacity, and anything that carries goods can be raided on the road.

## Early Access
- **Paid caravan and wagon rides** between towns (Duskfall Hollow, Ashford Crossing, Friar Glen, Silver Glen, Brightmere). This is fast travel
  with a fare based on distance and road (about 10-40 copper per leg). Time passes, and there's a small ambush chance on frontier roads. The
  player rides along and carries only what fits in the pack.
- **Handcart** (bought from the carpenter or built with woodworking): holds 6 containers (crates, barrels, sacks) up to 300 kg
  (see `containers-and-magic.md`). The player walks with it at reduced speed, so it's for short hauls (quarry to town, sawpit to the smithy).
  Cart cost per leg feeds the trade-route profit calculation in `economy-prices.md`.

## Update 1
- **Horses**: bought at stables, with feed (hay, oats) and upkeep (stabling fee per day at inns). They ride faster and carry saddlebags (+20 volume).
  They can be hurt or stolen, and the stable keeps them while the player is in town.
- **Owned wagons** that carry crates and barrels **physically** along trade routes: 16 container slots and 1200 kg, pulled by a horse or ox.
  Capacity limits are enforced, cargo shows on the wagon, and wagons **can be raided** (bandits, goblins). Hired guards and Warding magic
  lower the risk. Hired drivers can run a route on their own (ties into Hiring and workers).

## Update 2
- **Boats** along the coast and rivers from **Brightmere** (port town): passenger berths plus cargo holds (barrels and crates by the dozen),
  cheaper per unit than wagons on long hauls. Weather and pirates add risk. Later, the player can own boats.

## Later
- **Airships**: very expensive. At first only guild-owned (Merchants' Guild) and noble-owned (Duke Cedric Stormhold) lines sell passage, and
  the player can own one late in the game. They tie in with **Spatial** magic (enchanted holds with more capacity) and **Alteration** (featherweight hulls
  and lift), see `magic.md`. Ultra-fast routes, high fares and prestige cargo.
