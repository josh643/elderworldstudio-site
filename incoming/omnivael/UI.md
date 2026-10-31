# Gameplay UI (branch `ui`, off `systems`)

All code is in `Assets/Omnivael/Scripts/UI/` (inside the `Omnivael` asmdef; the project keeps scripts under
`Assets/Omnivael/Scripts`, not `Assets/Scripts`). `UiBootstrap` hooks `WorldBootstrap.Installed` and adds everything at runtime;
no scene edits are needed.

| Feature | Files | Data |
|---|---|---|
| Inventory + equipment (I / pad Y / PACK) | `Inventory.cs`, `InventoryScreen.cs`, `ItemData.cs`, `ItemIcons.cs` | `Resources/Items/items.json` |
| Shop / trade (T near a merchant, pad Y in their dialogue, TRADE button) | `Economy.cs`, `ShopScreen.cs` | `Resources/Economy/prices.json` |
| Map (M / pad LB / MAP) + HUD compass | `MapData.cs`, `MapCapture.cs`, `MapScreen.cs`, `HudExtras.cs` | `Resources/UI/Maps/DuskfallHollow_Slice.json` |
| First-time tips | `TutorialHints.cs` | `Resources/UI/Hints/hints.json` |
| Theme / fonts (Cinzel, Alegreya Sans, OFL) | `UiTheme.cs` | `Resources/UI/Fonts` |
| Root, input capture, time freeze | `UiRoot.cs`, `UiBootstrap.cs` | |
| Optional audio hooks | `UiSfx.cs` | |
| Screenshot tour (player arg `-uishots DIR`) | `UiShots.cs`, `tools/ui-shots.sh` | |

## Save data
`save.inventory.items` (stacks), extensions `equipment`, `merchants` (stock, purse, restock day), `map` (discovered places).
Copper stays in `QuestManager.CopperCents`. Older saves without `equipment` get the starting kit.

## Prices / future economy
Price = item value × region category multiplier × merchant markup (buy) or sell rate (sell) × merchant per-category/per-item
modifier × scarcity (buy) × relationship (affinity). To drive it from an economy system either set
`Economy.Provider = new MyProvider()` (implements `IPriceProvider.Quote(PriceQuery)`), or push live factors with
`Economy.SetDynamicMultiplier(region, category, mult)`.

## Audio
`UiSfx` looks up `Omnivael.AudioSystem.OmniAudio` (audio branch) by reflection and calls `UiClick` (every themed button),
`UiOpen` / `UiClose` (screens), `Coin` (buy/sell) and `ItemPickup(pos)` (loot). With no audio API it does nothing. After merging
with `audio`, those can become direct calls.

## Shared files touched (minimal hooks)
- `Scripts/GameInput.cs`: `UiCaptured` / `PointerCaptured` delegates so open screens and HUD buttons eat gameplay input.
- `Scripts/Health.cs`: `damageTakenMultiplier` (armour).
- `Scripts/HUD.cs`: `TopCentreReserve` (zone banner sits under the compass) and `LastDialogueRect` (Trade button placement).

## Tests
`Tests/PlayMode/UiPlayTests.cs` (UiPlayTests + UiGamepadTests), `Tests/EditMode/UiDataTests.cs`. Run `tools/run-tests.sh`.
