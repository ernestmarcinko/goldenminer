# Plan 9: Pausing, one Inventory view, every find to the bag, the Map stash by tier, cards and logs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 9 is round 4's play feedback, part I:
- **Pausing.** A Pause button and the views gate digging. Paused time is dropped, never banked. Map runs never pause.
- **Every find to the bag.** Gear, gems, maps and materials all land in the bag; a full bag holds up to 60 finds of any kind, and nothing is lost silently.
- **One Inventory view.** The side panel, the Maps view and the stash pop-up go. The stash's Maps tab is per tier, 200 maps each, with no pages.
- **Cards and shortcuts.** Cards sit on the page and never clip; click opens the card, right-click the actions, Ctrl/Cmd sells, Alt salvages, Shift moves; tiers sit on the right in grey.
- **Logs.** A drop log and a death log, saved, in a Log view with the Last-run card.

**Architecture:**
- **Save schema 9.** `paused`, `drops`, `deaths` join the state; `overflow` holds any item; `stash.maps` becomes a record keyed by tier; `settings.bagFull` goes. `MIGRATIONS[8]` refunds Maps pages and regroups maps.
- **The clock keeps one tick stream.** `applyTicks` takes a `digPaused` gate that skips dig ticks only; map ticks always run. The store derives the gate from the saved Pause flag, the current view and the tab's visibility.
- **Loot.** `receiveItem` and `receiveMaterial` stow into the bag only, hold what doesn't fit, and sell or stash what the held list can't take. A new `dropLog.ts` records each find and the trail of what became of it, by item id.
- **UI.** `InventoryView` (doll · bag · stash) replaces `CharacterPanel`, `StashDialog` and `MapsView`. Cards render through a portal with `position: fixed`. Plan 7's pointer-safe anchoring stays.

**Tech stack:** TypeScript 7, React 19, Vite 8, Vitest 5, lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-round-4-play-feedback-design.md`, §3–§7. Earlier context: `2026-10-24-round-3-economy-inventory-crafting-design.md`.

**Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 4" (`.superpowers/mockups/project/Round4.dc.html`): its first three sections, Mine, Inventory and Log, are Plan 9. The fourth is Plan 10.

## Global Constraints

- **Node:** prefix every command with `export PATH=/root/.nvm/versions/node/v24.22.1/bin:$PATH`. `npx vitest run` and `npx tsc --noEmit` must be clean at the end of every task.
- **Commits:** a plain imperative sentence, like the repo's. Never add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.
- **Fixtures:** `tests/fixtures/save-schema-1.txt` … `save-schema-8.txt` are never regenerated or edited. 1–7 are real exports. **`save-schema-8.txt` already exists**: it was generated from the Plan 8 engine, before any Plan 9 change, by a vitest script outside the repo that built the state through the game's own functions (`applyTicks`, `craft`, `buyStashPage`, `sendItem`, `equip`, `startMap`, `receiveItem`). It holds:
  - world seed `plan-nine-fixture`, deepest 422 m, 78,311 Gold, 1,963 Souls, level 3, `nextId` 406, `tickCount` 42,052, 196 finds;
  - a full bag of 60: 48 gear, 7 gem stacks, 4 material stacks and one magic tier-1 map (id 26, 2 modifiers);
  - a Maps tab of 2 pages, 1 of them bought (`bought.maps` 1), holding 10 maps: tier 1 × 2 (both rare, 4 modifiers), tier 2 × 1, tier 3 × 4, tier 4 × 3, the rest normal;
  - a full General tab (120 rare items), 4 held rare items (ring, gloves, helm, gloves, all item level 7) and `bagFull: 'sellWorst'`, a pairing the Plan 8 store would have drained but the core allows, so the migration's two held-list rules are both exercised;
  - every slot worn, a loot filter of 3 rules (`normal/any/sell`, `magic/mining/salvage`, `any/gem/keep`);
  - a run in progress on a magic tier-1 map (1 modifier) in room 3 of 7 at 102 life, and a cleared last run on a normal tier-2 map (+581 XP, 2 levels);
  - 201 Copper ore and at least 60 of every other material in the Materials tab.
- **Seeds:** `rollMetre`, `fillAhead`, `metreLayer`, `dungeonLayout`, `monsterState` and every RNG stream stay as they are. Logging, holding and pausing make no draws.
- **Anti-goals:**
  - Never lose a find silently: what doesn't fit is held, and what can't be held is sold or stashed with a log entry that says so.
  - Never punish absence: a hidden or closed game digs unless the player pressed Pause; a full bag stops digging, and that is the one exception.
  - Paused time is never caught up.
- **Copy:** plain words. Exact strings in this plan are copy; use them verbatim. Strings the spec fixes are quoted from it; the rest are marked *(copy)*.
- **Targets:** interactive targets are at least 40 px tall.
- **Code style:** match the surrounding code: sparse comments that say why, `readonly` tables in `balance.ts`, exhaustive `switch` over unions. UI logic goes in `.ts` view helpers next to the component, where the tests reach it.
- **README:** each task that changes play updates its paragraph in the README's existing voice.
- **Dev server:** it runs on port 5180 and is never stopped. Browser checks use puppeteer-core at `/root/.nvm/versions/node/v24.22.1/lib/node_modules/lighthouse/node_modules/puppeteer-core` with `/usr/bin/google-chrome --no-sandbox`; saves are imported through Settings → "Export / import save…". Scripts and generated saves live under `/root/.claude/jobs/08d9b178/tmp/p9t<N>/`, never in the repo.

## Review Focus

1. **Old saves:** the schema-8 fixture loads with its held gear still held, its `sellWorst` gone, its maps regrouped by tier, 5,000 Gold refunded, empty logs, not paused, and its run in progress playing on to its end without error. Task 1 tests this on the real fixture.
2. **Paused time is dropped:** an hour paused then Continue digs nothing of that hour; a map run keeps fighting while paused and the ticks left after it ends are not dug; a hidden tab digs; a Pause survives a reload. Task 2 tests each.
3. **A full bag during a long map run:** 60 finds of any kind are held, the 61st gear, gem or map is sold and the 61st material goes to the Materials tab, every one with a log entry; a material find split across the bag and the held list is one entry. Task 3 tests the holding and selling, Task 6 the entries.
4. **A full map tier:** a 201st map moved into its tier is refused with `The tier N maps are full.` and nothing moves; a found map never goes to the stash; a migrated tier past 200 spills into the bag, then the held list, then is sold. Tasks 1 and 3 test this.
5. **Cards at the screen's edges:** a card for the bottom-right bag cell on a 390 × 844 screen opens upward and stays inside the viewport; after each craft the clicked button stays under a fixed pointer. Task 5's placement tests and click sweeps cover this.

## Decisions this plan makes (the rulings, plus my calls for Ernest to check)

| Topic | Decision |
|---|---|
| Schema | `SCHEMA_VERSION = 9`, `MIGRATIONS[8]` per spec §7. The schema-8 fixture is generated (see Global Constraints), never regenerated. |
| Clock | One tick stream. `applyTicks(…, digPaused)` skips dig ticks while `digPaused` or the held list is non-empty; map ticks always run, offline included. `tickCount` still counts every tick. `lastTickAt` always advances, so paused time is dropped. |
| Pause flags | `state.paused` is the player's Pause, saved. The view pause is store UI state (`setViewPaused`, set by the App), not saved. `setHidden` (from the game loop) lifts the view pause while the tab is hidden. Offline catch-up (`load`) gates on `state.paused` alone; the live pump gates on `paused || (viewPaused && !hidden)`. |
| Status line | Precedence: the run banner while a map runs, else `Paused. Press Continue digging to dig on.`, else `Your bag is full. Make room to dig on.`, else the speed text. |
| Held list | `overflow: Item[]` keeps its name; `MAX_HELD = 60` replaces `MAX_OVERFLOW`. Past the cap: gear, gems and maps sell at their sell value; materials go to the Materials tab; every case is logged. `settings.bagFull` goes; `sellWorst` is deleted; old saves hold. |
| Map value | `sellValue(map) = round(25 × tier² × f)`, `f` = 1 normal, 1.5 magic, 2.5 rare. Salvage: Copper ore `2 × g`, plus Tin ore `1 × g` from tier 3, `g = 1 + floor(tier / 5)` (the gear `tierFactor`). So tier 1 → 2 Copper; tier 3 → 2 Copper, 1 Tin; tier 5 → 4 Copper, 2 Tin; tier 10 → 6 Copper, 3 Tin. Materials can't be sold or salvaged. |
| Loot filter | A map never matches a Plan 9 rule, so it always reaches the bag. Plan 10 extends the filter to maps. |
| Material finds | Fill existing bag stacks first, then open as many new cells as needed (spec §4.2); with no room the rest is held as one stack. |
| Map stash shape | `stash.maps: Record<number, MapItem[]>` keyed by tier, `MAP_TIER_CAP = 200` per list, no pages. The validator checks each list's length and each map's tier against its key directly, the per-tier count is a length, and the view groups nothing. An emptied tier's key is deleted. `ItemLoc` for a map in the stash is `{ where: 'maps'; tier; index }`. The view sorts rare first, then newest (higher id first); the lists keep insertion order. |
| Maps refund | `gold += Σ_{n=1}^{bought.maps} 5000 n²`. A tier past 200 at migration spills into the bag's empty cells, then the held list up to 60, then sells at `sellValue` (Gold added), so nothing is lost silently. `stash.bought` becomes `{ general }`. |
| Logs | `drops` keeps the newest `DROP_LOG_LIMIT = 300`, `deaths` the newest `DEATH_LOG_LIMIT = 50`, both oldest first in state, newest first in the view. A drop entry's id is the item's id; a material find's entry takes a fresh `nextId`. Trail events find their entry by item id and append only to gear and map entries (stacks merge, so gems and materials keep their single step). A trail keeps its first step and the newest 23 (`MAX_TRAIL_STEPS = 24`). |
| Death time | `endRun` stamps a death with `state.lastTickAt` and `state.tickCount`; `advance` then sets `at` for every death of its batch to that tick's wall time, `from + (tick − tick0 + 1) × interval`, so offline deaths carry the time they happened. |
| Lost | `lost` is logged when a run ends by death or by leaving; a cleared map's trail ends at `run`. |
| Views | `View = 'mine' | 'inventory' | 'merchant' | 'log' | 'run'`. `Run` is the first tab while a map runs. Removed: `MapsView`, `MapList`, `mapsView.ts`, `maps.css`, `StashDialog`, `CharacterPanel`, `mapRows`, `mapCount`, Maps pages and their buy button. Still-needed helpers (`xpBar`, `runTitle`, `gainsLine`, `mapDungeon`, `mapModLines`, `mapRewardsText`) move into `src/ui/run/runView.ts`. The Last-run card moves to the top of the Log view. Closing the run result dialog goes to Mine (to the Log's Deaths tab when its link was pressed). |
| Shortcuts | Click opens the item's card, pinned until a click elsewhere or Escape. Right-click opens the action card. Shift+click moves. Alt+click salvages. Ctrl+click sells, Cmd+click (`metaKey`) on a Mac, where Ctrl+click is the context menu. `IS_MAC` is read once from `navigator.platform`. A Gems-tab stack's sell and salvage shortcuts open the card instead, as today's sell does. |
| Hover card | Two muted lines close the hover card: `Sells for N Gold · Salvages into …` and `Ctrl+click sell · Alt+click salvage · Shift+click move` (`⌘+click` on a Mac). The spec's `72 Gold` example is illustrative; the engine's values are pinned in Task 5. |
| Gem card | The gem's action card lists no sockets; it shows `Drag it onto an item with a free socket to socket it.` and keeps its other actions. The `socket` action goes. |
| Tiers | `ViewLine` gains `tier?: number`, rendered right-aligned in grey as `T3`; crafted lines keep `(crafted)` in the text; legendary lines have no tier; map modifier lines carry their tier the same way. |
| Cards | Hover and action cards render through `createPortal` into `document.body` with `position: fixed` and viewport coordinates. On opening: below the item when it fits, else above when it fits, else the side with more room, clamped inside the viewport. After a craft, Plan 7's rules hold: anchor the clicked control by identity, else by its slot; allow off-screen; never shrink; leave empty slots; `overflow-anchor: none`. The touch tap card stays inline. |
| Sweeps | `/root/.claude/jobs/08d9b178/tmp/p9t5/sweep-bag.mjs` and `sweep-maps.mjs`, modelled on `…/p8t4/sweep-maps.mjs` and `…/p8t5/sweep-maps.mjs`, must report `BAD 0` at 1280 × 900 and 390 × 844. |

---

### Task 1: Save schema 9, the migration, and the Map stash by tier in the core

**Files:**
- Modify:
  - `src/core/types.ts`, `src/core/balance.ts`, `src/core/cells.ts`, `src/core/save.ts`, `src/core/newGame.ts`
  - `src/core/inventory.ts`, `src/core/maps.ts`, `src/core/loot.ts`, `src/core/stashPages.ts`, `src/core/summary.ts`
  - `src/store/gameStore.ts`
  - `src/ui/character/{dragDrop,itemActions,stashView,useItemInteractions}.ts(x)`, `src/ui/character/{StashDialog,LootFilterDialog}.tsx`, `src/ui/maps/mapsView.ts`, `src/ui/maps/MapList.tsx`, `src/ui/OfflineSummary.tsx`
  - `README.md`
- Test: `tests/core/save.test.ts`, `tests/core/maps.test.ts`, `tests/core/inventory.test.ts`, `tests/core/loot.test.ts`, `tests/core/stashPages.test.ts`, `tests/ui/dragDrop.test.ts`, `tests/ui/stashView.test.ts`, `tests/store/gameStore.test.ts`.

**Interfaces:**
- **`types.ts`:**
  - `BAG_FULL_MODES` and `BagFullMode` go; `Settings = { lootFilter: LootRule[]; motion: MotionSettings }`.
  - `ItemLoc`'s map case becomes `{ where: 'maps'; tier: number; index: number }`.
  - `InvResult` gains `'mapTierFull'`.
  - `LootNote.base: Slot | GemType | Material | 'map'`; a map note's `rarity` is its `MapRarity`.
  - `GameState` gains `paused: boolean`, `drops: DropEntry[]`, `deaths: DeathEntry[]`; `stash.maps: Record<number, MapItem[]>`; `stash.bought: { general: number }`; `overflow: Item[]`.
  - `type DropOrigin = { kind: 'metre'; metre: number } | { kind: 'map'; tier: number; room: number } | { kind: 'merchant' }`.
  - `TRAIL_EVENTS = ['bag', 'held', 'filterSold', 'filterSalvaged', 'stashed', 'toBag', 'equipped', 'sold', 'salvaged', 'crafted', 'run', 'lost'] as const`, `type TrailEvent`.
  - `interface TrailStep { event: TrailEvent; gold?: number; materials?: Partial<Record<Material, number>> }`.
  - `interface DropEntry { id: number; kind: Item['type']; name: string; rarity: Rarity | 'gem' | 'material'; base: Slot | GemType | Material | 'map'; count: number; origin: DropOrigin; trail: TrailStep[] }`.
  - `interface DeathEntry { id: number; tick: number; at: number; map: MapItem; room: number; bossRoom: number; killer: string }`.
  - `OfflineSummary` gains `paused: boolean`.
- **`balance.ts`:** `MAX_HELD = 60` (renamed from `MAX_OVERFLOW`), `MAP_TIER_CAP = 200`, `DROP_LOG_LIMIT = 300`, `DEATH_LOG_LIMIT = 50`, `MAX_TRAIL_STEPS = 24`, `MAP_SELL_GOLD = 25`, `MAP_RARITY_SELL: Readonly<Record<MapRarity, number>> = { normal: 1, magic: 1.5, rare: 2.5 }`. `START_MAP_PAGES` goes; `stashPagePrice` stays for the General tab.
- **`cells.ts`:** `emptyInventory()` gives `maps: {}` and `bought: { general: 0 }`; `itemAt` and `sameLoc` read the new map location; `mapTierCount(state, tier): number`.
- **`maps.ts`:**
  - `putMap(state, map: MapItem): 'ok' | 'mapTierFull'` appends to `stash.maps[map.tier]`, creating the list.
  - `takeMapAt(state, loc: { tier; index }): MapItem | undefined` splices it out and deletes an emptied key.
  - `takeMap(state, mapId)` searches the bag and every tier list.
  - `addMap(state, tier, metre)`: `putMap`; when the tier is full, the bag's first empty cell; with none, the map is not kept (Task 3 replaces this with the bag-first rule).
- **`loot.ts`:** `sellValue` accepts a map (the Decisions formula); `Loot = GearItem | GemItem | MapItem`. `receiveItem` always holds (the `'stop'` branch; `sellWorst` and `isWorse` are deleted), and past `MAX_HELD` the item is sold at `sellPay` with a `sold` note; the General fallback of `stowGear` stays until Task 3. `drainOverflow` stops at the first held item that has no room.
- **`stashPages.ts`:** `buyStashPage(state): 'ok' | 'noGold' | 'full'` for the General tab only.
- **`save.ts`:** `SCHEMA_VERSION = 9`; `MIGRATIONS[8]` as in Decisions (paused false, logs empty, `bagFull` dropped, maps regrouped and spilled, pages refunded; malformed input returned unchanged for the validator). The validator checks every new shape: `paused` boolean; `stash.maps` keys are decimal strings of integers 1..`MAX_ITEM_LEVEL` (`String(Number(k)) === k`), each list at most `MAP_TIER_CAP` maps, each map valid with `tier === Number(k)`; `bought` is exactly `{ general }`; `overflow` at most `MAX_HELD` items, each `isBagItem`; `drops` at most `DROP_LOG_LIMIT` entries with unique ids below `nextId`, `kind` an item type, `name` 1–80 chars, a `rarity`/`base` pair as `isLootNote` allows, `count` ≥ 1, a valid origin, and a trail of 1..`MAX_TRAIL_STEPS` steps whose events are in `TRAIL_EVENTS`, `gold` non-negative finite, `materials` keyed by `MATERIALS`; `deaths` at most `DEATH_LOG_LIMIT` entries, each with `id` below `nextId`, `tick` and `at` non-negative, a valid map (checked with its own `seen` set, as the snapshot may share an id with `lastRun.map`), `bossRoom` from the seed, `room` in range, `killer` 1–80 chars.
- **`inventory.ts`:** `writeCell` no longer takes `'maps'`; a move whose target is `{ where: 'maps' }` or `{ where: 'stashTab', tab: 'maps' | 'auto' }` with a map calls `putMap` (the index is ignored); a move from `'maps'` to an empty bag cell takes the map out; to a bag cell holding a map, the two swap (`putMap` first, refused `'mapTierFull'` when the tier is full); to any other taken bag cell, `'invalid'`. `sendItem(from, 'stash')` on a map is `putMap`. `unequip` never targets `'maps'`. `discard` still refuses maps (Task 3 allows them).
- **`gameStore.ts`:** `setBagFull` goes; `buyStashPage()` takes no tab.
- **UI ripple (behaviour unchanged):** `parseDrop` reads `{ where: 'maps', tier, index }`; `targetKey` → `maps-${tier}-${index}`; `mapActions` disables `To Maps tab` when `mapTierCount(state, item.tier) >= MAP_TIER_CAP`; `resultText(r, item?)` gives `'mapTierFull'` → `The tier ${tier} maps are full.`; `StashDialog`'s Maps tab shows every map in one grid, lowest tier first, with no page row (Task 4 replaces it); `stashView.tabLabel` for maps reads `Maps ${total}`; `buyLabel(state)` is General-only; `mapRows` walks the tiers and `MapList.whereText` says `Maps tab`; `LootFilterDialog` loses the bag-full radio; `OfflineSummary` says `Digging stopped because your bag was full.` *(copy)*.

- [ ] **Step 1: Write the failing tests.**
  - **Fixture (`save.test.ts`, Review Focus 1), `it('the schema-8 fixture migrates to hold mode, keeps its held gear, groups its maps by tier and refunds its Maps page')`:** decode `save-schema-8.txt`; `paused` is `false`; `drops` and `deaths` are `[]`; `settings` deep-equals the old one without `bagFull`; `overflow` deep-equals the old 4 items; `gold` is `old.gold + 5000` (83,311); `stash.bought` is `{ general: 0 }`; `Object.keys(stash.maps)` is `['1', '2', '3', '4']` with lengths `[2, 1, 4, 3]`, each map's `tier` equal to its key, and the maps of each tier in the old tab's order; `bag`, `equipped`, `stash.general`, `activity`, `lastRun` and `finds` deep-equal the old ones. Then `applyTicks` in steps of 50 until `activity.kind === 'dig'` (at most 20,000 ticks): no throw, `lastRun.map.id` is the old run's map id, and `validateState` holds.
  - **Older fixtures:** 1–7 still load; the schema-7 fixture's 51 Maps-tab maps come out grouped by tier with every map kept and `gold` unchanged (`bought.maps` was 0).
  - **Spill (Review Focus 4), `it('a migrated tier past 200 spills into the bag, then the held list, then is sold')`:** a schema-8 envelope built from the schema-8 fixture's JSON whose Maps tab holds 261 normal tier-3 maps (5 pages, `bought.maps` 4): with fresh ids and `nextId` raised: after decoding, tier 3 has 200, the bag is unchanged (it was full), `overflow` has 60 (the old 4 first, then 56 maps), and `gold` rose by the refund `5000 × (1 + 4 + 9 + 16)` plus `5 × 225` for the 5 maps sold at `sellValue` (25 × 9).
  - **Validator, `it('the validator holds the schema-9 shapes')`:** each of these makes a valid state invalid: `paused: 'yes'`; a maps key `'3.5'`, `'x'` or `'0'`; a tier list of 201; a map under the wrong tier key; a `null` in a tier list; `bought.maps` present; an `overflow` of 61 items; a drop log of 301; a drop entry with event `'eaten'`, with an id ≥ `nextId`, with a duplicate id, with an empty trail, or with 25 steps; a death log of 51; a death whose map has `metre: 0`; a death with `killer: ''`. A valid state with a held map, a held material stack of 50 and a held gem stack stays valid.
  - **Maps (`maps.test.ts`):** `putMap` appends under the map's tier and returns `'mapTierFull'` at 200 without changing anything; `takeMapAt` deletes an emptied key; `takeMap` finds a map in the bag and in any tier; `startMap` runs a map from a tier list.
  - **Inventory (`inventory.test.ts`):** moving a bag map onto the Maps tab (`stashTab`, `auto`, or any `maps` cell) appends it to its tier; moving a Maps-tab map to an empty bag cell works and to a cell with gear is `'invalid'`; swapping with a bag map; a full tier refuses with `'mapTierFull'` and both maps stay; `sendItem(mapsLoc, 'bag')` takes the first empty bag cell; the fuzz test's location generator produces the new map locations and `validateState` holds after every step.
  - **Loot (`loot.test.ts`):** the `bagFull` tests become: a find with the bag and the General tab full is held, up to 60; the 61st is sold at `sellPay` and `overflow` stays 60; `sellWorst` is gone, so no carried item is ever sold. `sellValue` of maps: tier 4 normal 400, magic 600, rare 1,000; tier 3 magic 338.
  - **Store (`gameStore.test.ts`):** `setBagFull` tests go; `buyStashPage()` buys a General page.
  - **UI:** `parseDrop('{"where":"maps","tier":4,"index":2}')` round-trips; `tabLabel` for maps reads `Maps 12`; `resultText('mapTierFull', map)` reads `The tier 4 maps are full.`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run tests/core/save.test.ts tests/core/maps.test.ts tests/core/inventory.test.ts tests/core/loot.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it.** Types and balance first, then `cells`, `maps`, `inventory`, `loot`, `save` (migration, then validator), `newGame`, the store, and the UI ripple until `npx tsc --noEmit` is clean.
- [ ] **Step 4: Update the README.** In Gear: the stash's General tab keeps its pages; the Maps tab holds up to 200 maps of each tier and costs nothing. In Maps: the "stop digging" / "worst item is sold" sentences go; a full bag holds finds, up to 60.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add tests/fixtures/save-schema-8.txt` and the rest, then `git commit -m "Move saves to schema 9: a Map stash by tier, a held list for any item, and empty logs"`.

---

### Task 2: Pause and the clock

**Files:**
- Modify: `src/core/clock.ts`, `src/core/dig.ts`, `src/core/summary.ts`, `src/store/gameStore.ts`, `src/ui/gameLoop.ts`, `src/ui/App.tsx`, `src/ui/mine/MineView.tsx`, `src/ui/mine/mineView.ts`, `src/ui/mine/mine.css`, `src/ui/OfflineSummary.tsx`, `README.md`.
- Test: `tests/core/clock.test.ts`, `tests/core/dig.test.ts`, `tests/store/gameStore.test.ts`, `tests/ui/gameLoop.test.ts`, `tests/ui/mineView.test.ts`.

**Interfaces:**
- **`dig.ts`:** `applyTicks(state, count, stats, events?, digPaused = false)`. A map tick runs as today; a dig tick is skipped while `digPaused` or `state.overflow.length > 0`; `tickCount` counts every tick.
- **`clock.ts`:** `advance(state, nowMs, stats, events?, digPaused = false)` passes the gate through. `lastTickAt` moves exactly as today, so the dropped ticks are never due again.
- **`summary.ts`:** `summarize` sets `paused: after.paused`.
- **`gameStore.ts`:** `setPaused(paused: boolean)` writes `state.paused` and notifies; `setViewPaused(paused: boolean)` and `setHidden(hidden: boolean)` keep UI state only; `get digPaused(): boolean` is `state.paused || (viewPaused && !hidden)`; `catchUp(events?, live = false)` passes `live ? this.digPaused : state.paused` to `advance`; `pump()` is live, `load()` is not.
- **`gameLoop.ts`:** on `visibilitychange` to hidden: `store.setHidden(true)` then the guarded save; to visible: `owns()`, then `store.pump()` (the hidden stretch is dug with the view pause off), then `store.setHidden(false)`.
- **`App.tsx`:** `useEffect(() => store.setViewPaused(view !== 'mine'), [view, store])`.
- **`mineView.ts`:** `digStatus(state, stats): { kind: 'run' | 'paused' | 'bagFull' | 'digging'; text: string }` with the Decisions precedence and these texts: `Paused while the map runs.` *(copy)*; `Paused. Press Continue digging to dig on.`; `Your bag is full. Make room to dig on.`; else `speedText(digSpeed(state, stats))`. `pauseLabel(paused: boolean)` is `Pause digging` / `Continue digging`.
- **`MineView`:** the status line and the Pause button sit in one row under the progress bar (the mockup's row); the button is a `gm-btn gm-btn--primary`, `aria-pressed={state.paused}`, calling `store.setPaused(!state.paused)`. The old held-loot banner goes (the status line says it); the run banner stays.
- **`OfflineSummary`:** when `summary.paused`, it adds the line `Digging was paused, so nothing was dug.` *(copy)*.

- [ ] **Step 1: Write the failing tests.**
  - **`clock.test.ts`, `it('paused dig ticks are dropped, not banked')` (Review Focus 2):** `advance(s, 60_000, stats, [], true)` on a fresh game leaves `deepest` 0 and `progress` 0, returns 60, sets `tickCount` 60 and `lastTickAt` 60,000; then `advance(s, 61_000, stats, [], false)` returns 1 and `progress` is one tick's worth.
  - **`it('a map run keeps fighting while digging is paused, and the ticks after it ends are not dug')`:** start a map, `advance` with the gate on for enough ticks that the run ends; `lastRun` is set and `deepest` is unchanged.
  - **`dig.test.ts`:** `applyTicks(s, 10, stats, [], true)` digs nothing and counts 10 ticks; with a held item and the gate off, the same.
  - **`gameStore.test.ts`:** `it('offline catch-up digs unless the player pressed Pause')`: a save with `paused: true` loaded 10 minutes later has the same `deepest` and `offlineSummary.paused === true`; with `paused: false` it dug. `it('the view pause gates live ticks only, and a hidden tab digs')`: `setViewPaused(true)`, 10 s later `pump()` digs nothing; `setHidden(true)`, 10 s later `pump()` digs; `setHidden(false)`, `setViewPaused(false)`, `pump()` digs. `it('the player\'s Pause survives a save and a load')`: `setPaused(true)`, `save()`, a new store's `load()` has `state.paused === true` and dug nothing.
  - **`gameLoop.test.ts`:** on the visible event the order of calls is `pump` then `setHidden(false)` (a store stub records them).
  - **`mineView.test.ts`:** `digStatus` for a running map, a paused game, a held item and plain digging; the paused text wins over the full bag; `pauseLabel(true)` is `Continue digging`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Digging: the Pause button; other views pause digging; paused time is skipped; a hidden or closed game digs unless paused; a map run never pauses.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -am "Pause digging by the button or by leaving the Mine view, and drop paused time"`.

---

### Task 3: Every find to the bag, a held list for any item, and map sell and salvage

**Files:**
- Modify: `src/core/loot.ts`, `src/core/maps.ts`, `src/core/dig.ts`, `src/core/combat.ts`, `src/core/inventory.ts`, `src/core/balance.ts`, `src/ui/character/itemActions.ts`, `src/ui/character/itemView.ts` (`lootNoteText`), `src/ui/run/RunView.tsx`, `README.md`.
- Test: `tests/core/loot.test.ts`, `tests/core/maps.test.ts`, `tests/core/dig.test.ts`, `tests/core/inventory.test.ts`, `tests/core/rewards.test.ts`, `tests/ui/itemActions.test.ts`.

**Interfaces:**
- **`balance.ts`:** `MAP_SALVAGE: Readonly<{ copper: number; tin: number; tinFromTier: number }> = { copper: 2, tin: 1, tinFromTier: 3 }`.
- **`loot.ts`:**
  - `receiveItem(state, item: Loot): LootNote[]`: the loot filter first (sell or salvage never reaches the bag); gear and maps take the bag's first empty cell; a gem stack tops up matching bag stacks, then one new cell, and any rest is held as one stack; with no room the item is held while `overflow.length < MAX_HELD`; past the cap it is sold at `sellPay` (note `sold` with the Gold). Nothing goes to the stash.
  - `receiveMaterial(state, material, count): LootNote[]`: top up every bag stack of the kind, then open new cells as needed; the rest is held as one stack while under the cap; past the cap it goes to the Materials tab (`stashMaterials`). One note, for where the first unit went (`bag`, `held` or `stash`).
  - `drainOverflow(state)`: each held item in order: the loot filter (sell or salvage), else into the bag by the rules above; the first held item with no room stops the drain.
  - `lootAction(rules, item)` returns `'keep'` for a map.
  - `salvageYield(map)` per Decisions; `sellValue(map)` from Task 1.
- **`maps.ts`:** `addMap(state, tier, metre): LootNote[]` creates the normal map and returns `receiveItem(state, map)`. `dig.collect` pushes those notes onto the find record, so the finds feed shows `Map: Tier 4 map (to bag)`.
- **`inventory.ts`:** `discard` takes a map from a bag cell or a tier list (`takeMapAt`); `sell` and `salvage` on a material stay `'invalid'`.
- **`itemActions.ts`:** a map's card lists `Run this map`, the move action, `Sell (+N Gold)`, `Salvage (…)`, then Enchant. `lootNoteText` for a held note stays `waiting for space`.
- **`RunView`:** the footer reads `Drops go to your bag` *(copy)*.

- [ ] **Step 1: Write the failing tests.**
  - **`loot.test.ts`:**
    - `it('a found map goes to the bag\'s first empty cell, never to the stash')`.
    - `it('a found gem tops up bag stacks, then opens one new cell, and the rest is held')`: 3 stacks of 24 Tiny Ruby in the bag, no empty cell, a find of 10 → each stack 25, and a held stack of 7.
    - `it('a found material fills existing stacks, then new cells, and the rest is held as a stack')`: a bag with one stack of 40 Copper ore and 2 empty cells, a find of 130 → stacks of 50, 50, 50 and a held stack of 20 (one note, `bag`, value 130).
    - `it('with the bag full, any find is held, up to 60')` (Review Focus 3): gear, a gem stack, a map and a material stack all land in `overflow`, in order.
    - `it('past 60 held, gear, gems and maps are sold and materials go to the Materials tab')`: a normal tier-4 map past the cap pays 400 Gold and its note is `sold` with value 400; a material past the cap raises the Materials tab and its note is `stash`.
    - `it('held finds move into the bag as room frees, in order, the loot filter first')`: free one cell, `drainOverflow` moves the first held item; a held item the filter now sells leaves the list and pays.
    - `it('nothing goes to the stash on its own')`: 500 gear and gem finds with a full bag leave `stash.general` and `stash.gems` deep-equal.
    - `it('the loot filter never matches a map')`: the rule `{ rarity: 'any', target: 'any', action: 'sell' }` sells a gem and keeps a map.
    - `it('a map salvages into Copper ore, plus Tin ore from tier 3')`: the four pinned yields from Decisions.
  - **`inventory.test.ts`:** selling a map from the bag pays its value; salvaging a rare tier-5 map from its tier list leaves the list one shorter and gives 4 Copper, 2 Tin; `sell` and `salvage` on a bag material are `'invalid'` and change nothing.
  - **`dig.test.ts`:** `it('digging stops while finds are held and resumes when the bag has room')`.
  - **`rewards.test.ts`, `it('a long map run with a full bag loses nothing silently')` (Review Focus 3):** 2,000 kills on a tier-4 map with a full bag; afterwards `overflow` has 60, every note past that is `sold` or `stash`, `gold` grew by the sum of the `sold` notes' values, and `validateState` holds.
  - **`itemActions.test.ts`:** the map card's action order and the sell and salvage labels (`Sell (+400 Gold)`, `Salvage (+2 Copper ore)` for a normal tier-4 map).
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Digging and Gear: every find lands in the bag, materials included; a full bag holds up to 60 finds of any kind and stops digging; past that gear, gems and maps are sold and materials go to the Materials tab. Maps: a map can be sold and salvaged.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -am "Send every find to the bag, hold any item when it is full, and sell or salvage maps"`.

---

### Task 4: The views: Nav, Inventory, Mine without the side panel, and the Log shell

**Files:**
- Create: `src/ui/inventory/InventoryView.tsx`, `src/ui/inventory/inventory.css`, `src/ui/log/LogView.tsx`, `src/ui/log/log.css`, `src/ui/navView.ts`.
- Delete: `src/ui/character/CharacterPanel.tsx`, `src/ui/character/StashDialog.tsx`, `src/ui/maps/MapsView.tsx`, `src/ui/maps/MapList.tsx`, `src/ui/maps/mapsView.ts`, `src/ui/maps/maps.css`, `tests/ui/mapsView.test.ts`.
- Modify: `src/ui/App.tsx`, `src/ui/Nav.tsx`, `src/ui/Header.tsx`, `src/ui/app.css`, `src/ui/mine/MineView.tsx`, `src/ui/run/runView.ts`, `src/ui/run/RunView.tsx`, `src/ui/run/RunResultDialog.tsx`, `src/ui/run/run.css`, `src/ui/character/{stashView,itemView}.ts`, `src/ui/character/ItemGrid.tsx`, `src/ui/character/character.css`, `README.md`.
- Test: `tests/ui/navView.test.ts`, `tests/ui/stashView.test.ts`, `tests/ui/runView.test.ts`, `tests/ui/itemView.test.ts`.

**Interfaces:**
- **`Nav.tsx` / `navView.ts`:** `View = 'mine' | 'inventory' | 'merchant' | 'log' | 'run'`; `navTabs(running: boolean): { view: View; label: string }[]` gives `Run` first while running, then `Mine`, `Inventory`, `Merchant`, `Log`. The Run tab keeps the soul colouring (`gm-nav__tab--run`).
- **`App.tsx`:** no `gm-app__side`; a run starting sets the view to `'run'`; a run ending while the view is `'run'` sets `'mine'`; the result dialog's close sets `'mine'`; the view pause effect from Task 2. The result dialog's fallback focus is the Nav's Mine tab (`Nav` takes a `mineRef`).
- **`runView.ts`** takes in `xpBar`, `runTitle`, `gainsLine`, `mapDungeon`, `mapModLines`, `mapRewardsText` unchanged (Task 5 restructures `mapModLines`). `Header` imports `xpBar` from it.
- **`stashView.ts`:**
  - `mapTiers(state): { tier: number; count: number; label: string }[]`, ascending, only tiers with maps, labels `T4 · 12`.
  - `mapTierCells(state, tier): { item: MapItem; loc: ItemLoc }[]`, rare first (rare, magic, normal), then newest (higher id first).
  - `mapTierCaption(tier, count)` → `Tier 4 maps · 12 / 200`.
  - `pickTier(tiers: number[], wanted: number | null): number | null` keeps `wanted` when it exists, else the highest tier, else null.
  - `gridCapacity(count)` → `max(10, ceil(count / 10) × 10)`.
- **`ItemGrid`:** gains `emptyTarget?: DropTarget`, the drop target of every empty cell (the Maps grid passes `{ where: 'stashTab', tab: 'maps' }`); `EmptyTarget.target` becomes `DropTarget`.
- **`InventoryView`:** three columns in a `gm-inv` grid (`260px 1fr 1fr`, one column under 900 px): the doll column (the set toggle, `PaperDoll`, the stat line), the bag column (`Bag N / 60`, the `Loot filter` button, the grid, the status line, the hint, the tap card below the grid), the stash column (the tab row with `data-drop` tab targets and arrow-key movement as the old dialog's, then the General page row and grid, the Gems tab, the Maps tab with its tier chips (`aria-pressed`, ≥ 40 px) and grid and caption, or the Materials tab). One `useItemDrag` and one `useItemInteractions` over the view's root. The set toggle, the run start and an equip switch the doll as `CharacterPanel` did. The Maps tab remembers its tier in view state and `pickTier` keeps it valid.
- **`MineView`:** the run banner's button is `Back to the map` and opens the `'run'` view; the layout is full width.
- **`LogView`:** for now the heading `Log` and the Last-run card (`runTitle`, the map line, `gainsLine`), its `h3` focusable as the Maps view's was. Task 6 adds the tabs.
- **CSS:** `.gm-lastrun*` and `.gm-badge` move from `maps.css` to `run.css`; `app.css` loses the side column; `character.css` keeps the doll, grid and card rules.

- [ ] **Step 1: Write the failing tests.**
  - **`navView.test.ts`:** `navTabs(true)` maps to `['Run', 'Mine', 'Inventory', 'Merchant', 'Log']` with views `['run', 'mine', 'inventory', 'merchant', 'log']`; `navTabs(false)` has four.
  - **`stashView.test.ts`:** on the schema-8 fixture, `mapTiers` is `[{1, 2, 'T1 · 2'}, {2, 1, 'T2 · 1'}, {3, 4, 'T3 · 4'}, {4, 3, 'T4 · 3'}]`; `mapTierCells(s, 1)` lists the two rare maps newest first and their `loc`s point at the right list indexes; after `putMap` of a normal tier-1 map, it sorts last; `mapTierCaption(4, 12)`; `pickTier([1, 3], 2)` is 3 and `pickTier([], 2)` is null; `gridCapacity(0)` 10, `gridCapacity(11)` 20, `gridCapacity(200)` 200; `tabLabel` for maps on the fixture reads `Maps 10`.
  - **`runView.test.ts`:** the moved `xpBar`, `runTitle`, `gainsLine` and `mapDungeon` tests from `mapsView.test.ts`; the `mapRows`/`mapCount` tests go.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it,** following the Round 4 board: the Inventory section's three cards and the Log section's head.
- [ ] **Step 4: Update the README.** Gear: the Inventory tab (doll, bag, stash side by side; one column on a phone); the stash pop-up is gone; the Maps tab by tier. Maps: a map runs from its card in the bag or the Maps tab; the Maps tab in the Nav is gone; the Run tab. Merchant: "beside Mine and Maps" → "beside Mine, Inventory and Log".
- [ ] **Step 5: Run everything, then check in a browser.**
  - `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Browser (`/root/.claude/jobs/08d9b178/tmp/p9t4/check.mjs`): import the schema-8 fixture; at 1280 × 900 the Nav shows `Run · Mine · Inventory · Merchant · Log`; Inventory shows three columns, the Maps tab shows chips `T1 · 2` … `T4 · 3`, the General tab shows its 2 pages and buy button; running a map from a Maps-tab card switches to Run; Log shows the Last run card; at 390 × 844 the columns stack and nothing scrolls sideways.
- [ ] **Step 6: Commit.** `git add -A src/ui tests/ui && git commit -m "Replace the side panel, the Maps view and the stash dialog with an Inventory view and a Log view"`.

---

### Task 5: Cards: viewport placement, the shortcuts, hover values, the gem card and tiers on the right

**Files:**
- Create: `src/ui/platform.ts`.
- Modify: `src/ui/character/{itemView,itemActions,dragDrop,useItemPopover,useItemInteractions,ItemCard,ItemGrid}.ts(x)`, `src/ui/character/character.css`, `src/ui/run/runView.ts`, `src/ui/run/RunView.tsx`, `src/ui/inventory/InventoryView.tsx` (the hint), `README.md`.
- Test: `tests/ui/itemView.test.ts`, `tests/ui/itemActions.test.ts`, `tests/ui/dragDrop.test.ts`, `tests/ui/runView.test.ts`.

**Interfaces:**
- **`platform.ts`:** `IS_MAC: boolean` = `typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)`; `SELL_KEY = IS_MAC ? '⌘' : 'Ctrl'`.
- **`itemView.ts`:**
  - `ClickIntent = 'card' | 'menu' | 'sell' | 'salvage' | 'move'`; `clickIntent(e: { altKey; shiftKey; ctrlKey; metaKey; detail; pointerType }, mac: boolean)`: touch or `detail 0` → `menu`; `mac ? metaKey : ctrlKey` → `sell`; `altKey` → `salvage`; `shiftKey` → `move`; else `card`.
  - `ViewLine { text; tone; tier?: number }`; `modText` returns the text without the `T3 ` prefix and the line carries `tier` (none on a legendary line); `(crafted)` stays in the text.
  - `placeCardTop(anchor: Span, height, view: Span)`: below when it fits, else above when it fits, else the side with more room, then clamped to `[view.top, view.bottom − height]` (a card taller than the view sits at `view.top`).
  - `placeCardLeft(anchorLeft: number, width: number, viewportWidth: number, minLeft = 8): number` = `max(minLeft, min(anchorLeft, viewportWidth − width − 8))`; `placeTooltip` goes.
- **`itemActions.ts`:**
  - `socketActions` and the `'socket'` action id go.
  - `actionForIntent(actions, target, intent)`: `'card'` → `'card'`; `'menu'` → `'menu'`; `'sell'`/`'salvage'` on a Gems-tab stack → `'menu'`, else `find('sell')` / `find('salvage')`; `'move'` → `find('toStash', 'toBag', 'take')`.
  - `materialsText(counts: Partial<Record<Material, number>>): string` → `2 Copper ore, 1 Tin ore` in material order, no plus signs (`yieldText`, with its `+`, stays for the action labels).
  - `hoverNotes(state, target, item, mac: boolean): string[]`: the values line `Sells for ${sellPay} Gold · Salvages into ${materialsText(salvagePay)}` (gear, gems, maps; a stack's whole count; omitted for materials), then the shortcut line: bag, General and Maps items `${SELL_KEY}+click sell · Alt+click salvage · Shift+click move`; a bag material `Shift+click move · right-click for actions` *(copy)*; worn gear `Shift+click stash · right-click for actions` *(copy)*; a Gems- or Materials-tab stack `Shift+click take to bag · right-click for actions` *(copy)*. `hoverNote` goes.
  - `menuNote(item): string | null` → for a gem `Drag it onto an item with a free socket to socket it.`.
- **`dragDrop.ts`:** `clickRoute(e, holding, mac)` passes the new keys through.
- **`useItemPopover.ts`:** coordinates are viewport coordinates from `getBoundingClientRect` alone; `view` is `{ top: 8, bottom: innerHeight − 8 }`; `hover`, `pinned` and `menu` are `Placed` with `fit`; `pin(target, el)` toggles a pinned card (a second click on the same item closes it); `inspect` is ignored while a card is pinned; outside clicks and Escape close the pinned card as they close the menu. `containerRef` is no longer needed for placement and goes.
- **`useItemInteractions`:** `onPick` with `'card'` pins; `cards` is `createPortal(<>…</>, document.body)`; the tap card stays inline.
- **`ItemCard`:** every placed card gets `fit` and sets its own `top` after measuring (hover, pinned and menu alike), with the Plan 7 craft anchoring untouched; `Lines` renders `<span className="gm-card__text">` and, when `tier` is set, `<span className="gm-card__tier">T{n}</span>`; a menu card shows `menuNote` under the lines; a hover or pinned card shows the two `hoverNotes` as muted lines; a pinned card has `data-pinned` and role `tooltip`.
- **`runView.ts`:** `mapModLines(map): ViewLine[]` (each `{ text: MAP_MOD_TEXT…, tone: 'plain', tier }`), `mapRewardsText(map)` stays a string; `RunView` renders the modifier list with the tier on the right and the rewards line under it; `itemView.mapLines` uses both.
- **CSS:** `.gm-card, .gm-cardpair { position: fixed; z-index: 30 }`; `.gm-card__line { display: flex; justify-content: space-between; gap: 12px }`; `.gm-card__tier { color: var(--gm-muted); font-family: var(--gm-font-mono); font-size: 12px }`; `overflow-anchor: none` stays.
- **The hint under the bag** *(copy)*: `Hover an item to inspect it, click for its card, right-click for actions. Ctrl+click sells, Alt+click salvages, Shift+click moves between bag and stash (⌘ instead of Ctrl on a Mac). Drag items to cells, slots and tabs; drag a gem onto gear to socket it, a material onto gear or a map to craft. On a touch screen, tap an item to pick it up, then tap where it goes.`

- [ ] **Step 1: Write the failing tests.**
  - **`itemView.test.ts`:**
    - `it('click intents: click card, keyboard and touch menu, Ctrl or Cmd sells, Alt salvages, Shift moves')`: with `mac: false`, `ctrlKey` → `sell` and `metaKey` → `card`; with `mac: true`, `metaKey` → `sell` and `ctrlKey` → `card`; `altKey` → `salvage`; `shiftKey` → `move`; `detail: 0` → `menu`; `pointerType: 'touch'` → `menu`; a plain click → `card`.
    - `it('tiers sit on the right')`: the rare pickaxe test becomes `[{ '+8 dig power', plain }, { '+12% Gold yield', plain, tier: 3 }, { '+9% chest find', plain, tier: 2 }, { '+20% Gold from selling (crafted)', plain, tier: 9 }]`; the legendary line has no `tier` key; the sealed item's `T1` line becomes `{ text: '+4% Gold yield', tier: 1 }`; the magic map's lines are `{ text: 'Monsters have +27% life', tone: 'plain', tier: 4 }` and so on, then the rewards line without a tier.
    - `it('a card opens below its item, above it when there is more room above, and always inside the screen')` (Review Focus 5): with `view { 8, 892 }`: anchor `{ 100, 152 }`, height 344 → 156; anchor `{ 800, 852 }`, height 344 → 452; anchor `{ 400, 452 }`, height 900 → 8 (more room below, clamped to the top); anchor `{ 860, 900 }`, height 300 → 556. `placeCardLeft(1200, 270, 1280)` → 1002; `placeCardLeft(0, 548, 390)` → 8.
  - **`itemActions.test.ts`:**
    - `it('a hover card shows what an item sells and salvages for, and the shortcuts')`: a magic item-level-4 pickaxe with no gems and no bonuses → `['Sells for 48 Gold · Salvages into 2 Copper ore, 1 Tin ore', 'Ctrl+click sell · Alt+click salvage · Shift+click move']`; with `mac: true` the second line starts `⌘+click sell`; a normal tier-4 map → `Sells for 400 Gold · Salvages into 2 Copper ore`; a bag material → one line, the material shortcut line; worn gear → the worn line.
    - `it('a gem\'s action card lists no sockets and says to drag it')`: `itemActions` for a bag gem has no `socket` ids even with worn gear that has an open socket; `menuNote(gem)` is the sentence; `menuNote(gear)` is null.
    - `it('actionForIntent routes the shortcuts')`: `'card'` → `'card'`; `'sell'` on a Gems-tab stack → `'menu'`; `'salvage'` on bag gear → the salvage action; `'move'` on worn gear → `toStash`; `'move'` on a Materials-tab stack → `take`.
  - **`dragDrop.test.ts`:** `clickRoute` passes `ctrlKey`/`metaKey` through with `mac`.
  - **`runView.test.ts`:** `mapModLines(enchanted)` deep-equals the `ViewLine` list with tiers; `mapRewardsText` unchanged.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Gear: the shortcut sentence becomes click for the card, right-click for every action, Ctrl+click (⌘ on a Mac) to sell, Alt+click to salvage, Shift+click to move; drag a gem onto gear to socket it (the card no longer lists sockets).
- [ ] **Step 5: Run everything, then the click sweeps.**
  - `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Build `/root/.claude/jobs/08d9b178/tmp/p9t5/save-maps.txt` with a vitest script like `…/p8t4/mksave.test.ts`: decode the schema-8 fixture with the new engine, set every material to 5,000, Diamonds 100,000, Souls 1,000,000, end the run (`activity = { kind: 'dig' }`), free 8 bag cells and put 5 maps there (normal, magic 1, magic 2, rare 4, rare 6), enchant the Maps-tab maps in a mix, and write it with `encodeSave`.
  - Write `sweep-bag.mjs` and `sweep-maps.mjs` from `…/p8t5/sweep-maps.mjs`: the Inventory tab is opened first; the bag scope is `.gm-inv__bag .gm-grid`; the maps scope opens the Maps tab then each tier chip in turn, scope `.gm-inv__stash .gm-grid`; the card is `[data-item-card][role="dialog"]` wherever it is. Run both at `1280x900` and `390x844` with the crafts `Copper,Iron,Silver,Obsidian,Copper>Iron,Void`. Expected: every run ends `BAD 0` and `buttons<40px 0`; keep the logs under `p9t5/logs/`.
  - Edge check (`p9t5/edges.mjs`): at 390 × 844, right-click the bag's last cell: the card's rect is inside the viewport and above the cell; at 1280 × 900, hover the bag's bottom-right cell: the hover card is inside the viewport; a plain click pins the card and a click elsewhere closes it.
- [ ] **Step 6: Commit.** `git commit -am "Place item cards on the viewport, add the sell and salvage shortcuts, and show tiers on the right"`.

---

### Task 6: Logs: the data and hooks, then the Log view with the Last-run card

**Files:**
- Create: `src/core/dropLog.ts`, `src/ui/log/logView.ts`.
- Modify: `src/core/{loot,maps,dig,combat,inventory,crafting,merchant,clock}.ts`, `src/ui/log/LogView.tsx`, `src/ui/log/log.css`, `src/ui/run/RunResultDialog.tsx`, `src/ui/App.tsx`, `README.md`.
- Test: `tests/core/dropLog.test.ts`, `tests/core/combat.test.ts`, `tests/ui/logView.test.ts`.

**Interfaces:**
- **`dropLog.ts`:**
  - `logDrop(state, item: Item, origin: DropOrigin, first: TrailStep): DropEntry` makes the snapshot (`kind: item.type`, `name: itemName(item)`, `rarity`, `base` and `count` as `LootNote` does, `'map'` as a map's base, a map's `MapRarity` as its rarity), pushes it and trims to `DROP_LOG_LIMIT`. A material find passes a stack with a fresh `id`.
  - `trail(state, itemId: number, step: TrailStep): void` finds the newest entry with that id; it appends only to `gear` and `map` entries, keeping the first step and the newest `MAX_TRAIL_STEPS − 1`.
  - `logDeath(state, run: MapRun, killer: string): DeathEntry` with `id: state.nextId++`, `tick: state.tickCount`, `at: state.lastTickAt`, a `structuredClone` of the map, `room`, `bossRoom`; trims to `DEATH_LOG_LIMIT`.
- **Origins:** `receiveItem(state, item, origin)`, `receiveMaterial(state, material, count, origin)`, `addMap(state, tier, metre)` (origin `{ kind: 'metre', metre }`), `collect`/`collectMaterialVein` pass the metre, `onKill` passes `{ kind: 'map', tier: run.map.tier, room: run.room }`, `gamble` logs `{ kind: 'merchant' }` with the first step `bag`.
- **First steps** (in `loot.ts`): `filterSold { gold }`, `filterSalvaged { materials }`, `bag`, `held`, past the cap `sold { gold }` or, for a material, `stashed`. `drainOverflow` appends `bag`, `filterSold` or `filterSalvaged`.
- **Trail hooks:** `equip` → `equipped`; `sell` → `sold { gold }`; `salvage` → `salvaged { materials }`; `moveItem`, `sendItem` and `dropItem` → `stashed` when an item leaves the bag for the General or Maps tab and `toBag` when it comes back; `unequip` → `toBag` into the bag, `stashed` into a General cell; `craft` with `check 'ok'` → `crafted`; `startMap` → `run`; `endRun` → `lost` for `died` and `left`, and `logDeath` for `died` with the attacking monster's name (`endRun(state, run, outcome, events?, killer?)`).
- **`clock.ts`:** after `applyTicks`, every death with `tick >= tick0` gets `at = from + (tick − tick0 + 1) × interval`.
- **`logView.ts`:**
  - `originText(o: DropOrigin)` → `312 m`, `Tier 4 map, room 3`, `Merchant`.
  - `stepText(e: DropEntry, s: TrailStep)`: `bag` → `to bag`; `held` → `held (bag full)`; `filterSold` → `loot filter sold (+72 Gold)`; `filterSalvaged` → `loot filter salvaged (+2 Copper ore)`; `stashed` → `stashed`, or `to Materials tab` for a material entry; `toBag` → `moved to bag`; `equipped`; `sold (+72 Gold)`; `salvaged (+2 Copper ore, +1 Tin ore)`; `crafted`, or `enchanted` for a map; `run`; `lost`.
  - `trailText(e)` joins the steps with ` → `; a stack entry (gem or material) renders as `${name} → ${step}` with `name` = `+3 Iron ore` / `+2 Small Ruby`, so `+3 Iron ore → bag`.
  - `dropRows(state): { id; origin: string; name: string; kind: string; tone: string; trail: string }[]`, newest first; `kind` is `rare gloves`, `magic weapon`, `tier 5 map` *(copy)*, `''` for a stack; `tone` is the rarity colour (`map` for a normal map).
  - `deathRows(state): { id; when: string; map: string; mods: ViewLine[]; line: string; lost: string }[]`, newest first: `when` is `new Date(at).toLocaleString()`; `map` is `runMapLine(seed, map)`; `line` is `Fell in room 3 to Bog Lurker.` (`the boss room` as `runTitle` words it) *(copy)*; `lost` is `Lost: the map.` *(copy)*.
- **`LogView`:** the Last-run card, then a `tablist` of `Drops` and `Deaths` (the stash's keyboard rules); Drops rows follow the mockup's two columns (origin, then name in its tone with the kind muted, and the trail under it); an empty tab says `Nothing logged yet.` *(copy)*; a `show?: { tab: 'deaths'; id: number }` prop opens the Deaths tab and scrolls that entry (`id="gm-death-<id>"`) into view and focuses it.
- **`RunResultDialog`:** on a death, a second button `See it in the Log` *(copy)* calls `onShowDeath(deathId)` (the newest death's id); the App then sets the view to `'log'` with `show`, instead of `'mine'`.

- [ ] **Step 1: Write the failing tests.**
  - **`dropLog.test.ts`:**
    - `it('a dug chest\'s gear gets an entry with its metre and a first step to bag')`: dig to a chest (or call `collect` with a chest roll at 312 m): the entry has `origin { metre: 312 }`, `kind 'gear'`, `trail [{ event: 'bag' }]`, and its id is the item's.
    - `it('a run\'s drop names the map tier and room')`.
    - `it('a gambled item comes from the Merchant')`.
    - `it('the loot filter\'s sale or salvage is the whole trail')`: `[{ event: 'filterSold', gold: 48 }]`; a salvage carries `materials { copper: 2, tin: 1 }`.
    - `it('gems and materials get one entry each and no trail')`: a found gem, then its bag stack sold: the entry still has one step; a material find of 130 split across the bag and the held list is one entry with `count 130` and the step `bag`.
    - `it('a trail follows the item')`: find → stash → to bag → equip → unequip → sell gives `bag, stashed, toBag, equipped, toBag, sold { gold }`.
    - `it('a map\'s trail: to bag, enchanted, run, lost; a cleared map stops at run')`.
    - `it('held and past-the-cap finds say so')`: `held` then `bag` after a drain; past the cap `sold { gold: 400 }`; a material past the cap `stashed`.
    - `it('the log keeps the 300 newest entries and a trail its first step and newest 23')`.
    - `it('a death records when, the map, the room, the killer and the tick')`: with `lastTickAt 0` and 1 tick/s, a death during the 5th tick has `at 5000` after `advance`; `map` deep-equals the lost map; `killer` is the attacking monster's name; the death log keeps 50.
    - `it('the fixture\'s run logs its end')`: decode `save-schema-8.txt`, play the run out; if it died, `deaths` has one entry for its map; `drops` has entries for its drops.
  - **`combat.test.ts`:** the replay test from Plan 8 still gives identical `rng`, log and gains (logging makes no draws).
  - **`logView.test.ts`:** `originText` for the three origins; `trailText` for `to bag → stashed → sold (+72 Gold)`, `held (bag full) → to bag → equipped`, `loot filter salvaged (+2 Copper ore)`, `to bag → enchanted → run → lost` and `+3 Iron ore → bag`; `dropRows` is newest first with `kind 'rare gloves'`; `deathRows` builds `line` and `lost`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it,** following the Round 4 board's Log section.
- [ ] **Step 4: Update the README.** A Log paragraph: the Drops tab lists every find, where it came from and what became of it; the Deaths tab lists each death with its map, room and killer; the Last run card sits above them.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add src/core/dropLog.ts src/ui/log tests && git commit -am "Log every drop's trail and every death, and show them in the Log view"`.

---

### Task 7: The final browser check and the README read-through

**Files:**
- Modify: `README.md` (only if the read-through finds a stale sentence).

- [ ] **Step 1: Run everything.** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 2: Browser check** (`/root/.claude/jobs/08d9b178/tmp/p9t7/check.mjs`, screenshots beside it), at 1280 × 900 and 390 × 844, a fresh browser context each, importing `tests/fixtures/save-schema-8.txt` through Settings → Export / import save… → Load:
  - the Nav shows the Run tab and the run in progress continues; the header shows 83,311 Gold;
  - Mine shows the status line `Your bag is full. Make room to dig on.`; `Pause digging` toggles to `Continue digging` and the status to `Paused. Press Continue digging to dig on.`; a reload keeps it paused;
  - Inventory: three columns (one at 390), the held count, the Maps tab chips `T1 · 2`, `T2 · 1`, `T3 · 4`, `T4 · 3`, selling a map from its card (Gold rises by its value), a Shift+click move into the Maps tab, a Ctrl+click sale and an Alt+click salvage from the bag;
  - a hover card on the bottom-right bag cell and an action card on the last Maps-tab cell stay inside the viewport;
  - the run ending shows the result dialog; OK goes to Mine; after a death, `See it in the Log` opens the Deaths tab on the entry; Drops shows the run's drops with their trails;
  - the Merchant's gamble lands in the bag only when it has room, and its entry says `Merchant`;
  - nothing scrolls the page sideways at 390 px.
- [ ] **Step 3: Read the README** top to bottom against the game as built, and fix any sentence Plan 9 made stale.
- [ ] **Step 4: Commit** any README change: `git commit -am "Bring the README up to date with pausing, the Inventory view and the logs"`.
