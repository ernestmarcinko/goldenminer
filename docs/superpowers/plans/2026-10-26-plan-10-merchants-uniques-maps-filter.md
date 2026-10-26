# Plan 10: Two merchants, legendary uniques, harder maps with specials, and the extended loot filter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 10 is round 4's play feedback, part II:
- **Two merchants.** The Merchant view shows Brannoc the Trader, who sells 12 items rolled from the world seed and refreshed every 10 m dug, and Old Mirela, who runs Plan 8's gambling. Their names and portraits are the same in every world.
- **Legendary uniques.** Each of the eight legendaries gains one line that changes how the game plays, which no other item can roll.
- **Harder maps.** From tier 3 a fresh tier-N map is cleared by item-level-N gear about 40 % of the time; tiers 1–2 stay gentle (about 70 %). Clicking in maps is gone: combat is automatic (a combat system comes later). Map modifiers roll stronger, and an enchant can add one of six special modifiers.
- **The loot filter.** Rules match on kind, slot, rarity, level or tier, modifier tiers and counts, map modifiers, gem type and grade and material kind; they keep, sell, salvage or stash; maps can match; a redesigned dialog edits them.
- **§12a.** A gap of more than 5 minutes between live ticks is dug as time away, and a cell that fills under a still pointer shows its hover card.

**Architecture:**
- **Save schema 10.** `MIGRATIONS[9]` turns the old three-field rules into the new rule shape (behaviour identical), adds the Trader's bought record, a separate seeded stream for the uniques' draws, and a strike counter on a run in progress. The validator checks every new shape.
- **Uniques.** `uniques.ts` says which uniques are worn and gives them their own RNG (`state.uniqueRng`), so `state.rng` makes exactly the draws it makes today for a player without the legendary. Effects live where they act: digging, stats, the minimap, combat and the clock.
- **Maps.** `monsterState` scales life and damage by a per-tier table pinned by a seeded clear-rate simulation. A special is one optional field on the map, rolled from `state.rng` by enchants, read by the layout, the combat loop and the rewards.
- **The Trader.** `traderStock(seed, band)` is a pure, memoised function; the stock never touches `state.rng`. A `'stock'` item location lets the stock reuse the item grid, the hover cards and the pointer-safe action card.
- **The loot filter.** `lootFilter.ts` holds the rule shape, the matcher, the validity rules and the migration; `loot.ts` applies the actions, now including stash and maps; the dialog keeps every control under the pointer.

**Tech stack:** TypeScript 7, React 19, Vite 8, Vitest 5, lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-round-4-play-feedback-design.md`, §9–§12 and §12a (all approved as written; "proposed" counts as decided). Earlier context: `2026-10-24-round-3-economy-inventory-crafting-design.md` (§6 map enchanting, §8 the merchant) and Plan 8 (`2026-10-25-plan-8-maps-souls-merchant.md`), which built the gambling and the map modifiers.

**Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 4" (`.superpowers/mockups/project/Round4.dc.html`), section 4 (Merchants), and the new board `.superpowers/mockups/project/Plan10.dc.html`: the Merchant view with both characters and the Trader's stock, the loot filter dialog with its rule editor, and the legendary and special-map cards. `canvas.json` is not touched; the controller publishes.

## Global Constraints

- **Node:** prefix every command with `export PATH=/root/.nvm/versions/node/v24.22.1/bin:$PATH`. `npx vitest run` and `npx tsc --noEmit` must be clean at the end of every task.
- **Commits:** a plain imperative sentence, like the repo's. Never add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.
- **Fixtures:** `tests/fixtures/save-schema-1.txt` … `save-schema-8.txt` are never regenerated or edited. **`save-schema-9.txt` already exists** (Task 1 adds it): it was generated from the Plan 9 engine, before any Plan 10 change, by a vitest script outside the repo (`/root/.claude/jobs/08d9b178/tmp/p10fixture/mksave.test.ts`) that built the state through the game's own functions (`applyTicks`, `craft`, `sendItem`, `sell`, `equip`, `startMap`, `receiveItem`, `drainOverflow`). It holds:
  - world seed `plan-ten-fixture`, deepest 430 m, 74,317 Gold, 28 Diamonds, 1,795 Souls, level 4, `nextId` 441, `tickCount` 43,229, `rng` 250,920,479, 206 finds, not paused;
  - a full bag of 60: 45 rare gear, 2 legendaries (`Black Lantern` id 377, `Kraken Leather` id 378, both item level 7), 3 gem stacks, 8 material stacks, and 2 tier-4 maps (a rare with 4 modifiers, id 287, and a normal one, id 341);
  - worn: `Deepdelver` (id 375, `uniqueId: 'deepdelver'`) and rare boots in the mining set; `The Peacemaker` (id 376, `uniqueId: 'peacemaker'`), a magic ring, a rare amulet and magic armor in the battle set (no helm, no lamp, no gloves);
  - a General tab of 2 pages holding 3 items, one of them the legendary `The Golddigger` (id 188);
  - a Map stash of 19 maps: tier 1 × 3, tier 2 × 3, tier 3 × 10, tier 4 × 3, one of the tier-4 maps a **sealed** rare with 5 modifiers; a Gems tab of 6 gems; 174 Copper ore and at least 58 of every other material;
  - 5 held rare items (boots, helm, gloves, weapon, gloves, all item level 7, ids 436–440);
  - a loot filter of 6 old-style rules: `normal/any/sell`, `magic/mining/salvage`, `any/gem/keep`, `rare/gem/salvage` (matches nothing), `legendary/boots/keep`, `any/any/keep`;
  - a drop log of 217 entries (208 from metres, 9 from maps) whose trails use `bag`, `held`, `filterSold`, `filterSalvaged`, `stashed`, `equipped`, `crafted`, `run` and `lost`; a death log of 1 (id 387, room 4, killer `Velulvash the Unyielding`, on the sealed magic tier-4 map id 281);
  - a run in progress on a magic tier-4 map (id 285, 2 modifiers) in room 2 of 8 at 106 life, one monster left in the room; the last run is that death, unseen.
- **Seeds:** `rollMetre`, `fillAhead`, `metreLayer`, `dungeonLayout` (for a map with no special), `monsterState`'s seeded inputs and every existing RNG stream stay as they are. The Trader's stock has its own stream. The uniques draw from `state.uniqueRng` or use deterministic counters, so `state.rng` is byte-identical for a player without the legendary, and Plan 8's replay tests in `tests/core/combat.test.ts` stay green. Special-modifier rolls draw from `state.rng`, so craft outcomes change only on map enchants.
- **Anti-goals:** never lose a find silently; never punish absence; a refused buy, craft or gamble spends nothing; the merchants' names and looks never depend on the seed.
- **Copy:** plain words. Exact strings in this plan are copy; use them verbatim. Strings the spec fixes are quoted from it; the rest are marked *(copy)*.
- **Targets:** interactive targets are at least 40 px tall.
- **Pointer safety:** any card or view that stays open and changes under the pointer (Buy in the Trader's stock, the loot filter's rule editing, the action card) keeps the clicked control under the pointer, as `/root/.claude/memory/pointer-safety-click-sweep.md` says. Acceptance is a fixed-pointer repeated-click sweep reporting `BAD 0` at 1280 × 900 and 390 × 844, modelled on `/root/.claude/jobs/08d9b178/tmp/p9t5/lib.mjs`, `sweep-bag.mjs` and `/root/.claude/jobs/08d9b178/tmp/p9fix/sweep-held.mjs`.
- **Code style:** match the surrounding code: sparse comments that say why, `readonly` tables in `balance.ts`, exhaustive `switch` over unions. UI logic goes in `.ts` view helpers next to the component, where the tests reach it.
- **README:** each task that changes play updates its paragraph in the README's existing voice.
- **Dev server:** it runs on port 5180 and is never stopped. Browser checks use puppeteer-core at `/root/.nvm/versions/node/v24.22.1/lib/node_modules/lighthouse/node_modules/puppeteer-core` with `/usr/bin/google-chrome --no-sandbox`; saves are imported through Settings → "Export / import save…" → Load. Scripts and generated saves live under `/root/.claude/jobs/08d9b178/tmp/p10t<N>/`, never in the repo.

## Review Focus

1. **Old saves:** the schema-9 fixture loads with its six old rules turned into exactly the six new ones listed in Task 1 (the dead rule dropped, the catch-all split), its worn Deepdelver and Peacemaker acting from the first tick with no migration of their lines, an empty bought record, and its run in progress playing on to its end without error. Task 1 and Task 3 test this on the real fixture.
2. **The Trader at a band edge:** stock bought at 419 m is gone until 420 m, where a new stock has every slot again; viewing the stock or buying never changes `state.rng`; a buy with no room or Gold changes nothing. Task 6 tests each.
3. **Specials survive enchanting:** Silver's reroll, Obsidian and a Void temper's ruin keep a map's special; a second-boss run stays a valid save at every tick; a save decoded mid-run on a special map plays on identically. Task 5 tests each.
4. **Uniques and the loot stream:** every unique's own draw leaves `state.rng` as it was, so a player without the legendary gets today's drops; Kraken Leather saves once per map and no more; Peacemaker's counter survives a save and a load. Task 3 tests each.
5. **Stash rules with no room:** a stash rule for gear with the General tab full, for a map with its tier full, or for a gem at the Gems cap, lets the find go on to the bag with a `bag` step, never dropping it; a migrated catch-all never touches a map. Task 8 tests each; Task 9's sweep covers the dialog.

## Decisions this plan makes (the rulings, plus my calls for Ernest to check)

| Topic | Decision |
|---|---|
| Schema | `SCHEMA_VERSION = 10`, `MIGRATIONS[9]`. The schema-9 fixture is generated (see Global Constraints), never regenerated. |
| New state | `merchant: { band: number; bought: number[] }` (the stock band the slots were bought in, and their indexes); `uniqueRng: number` (uint32; a new game seeds it `hash2(lootSeed ?? seed, 0xa11e)`, the migration `hash2(state.rng, 0xa11e)`); `MapRun.strikes: number` (every strike of the run, for Peacemaker); `MapRun.saved?: true` (Kraken Leather has fired); `MapItem.special?: MapSpecial`. |
| Loot rule shape | `LootRule = { kind: LootKind \| 'any'; action: LootAction; set?; slot?; rarity?; level?: LootRange; modTier?; mods?: LootRange; mapMod?; gem?; grade?; material? }` with `LootRange = { min?: number; max?: number }` (inclusive). `rarity` applies to gear and maps (`'legendary'` never matches a map); `level` is gear's item level or a map's tier; `modTier` holds when some modifier (crafted ones included) has a tier at or above it; `mods` counts modifiers; `mapMod` is a map modifier kind; `gem`/`grade` a gem's; `material` a material's. Every set field must hold for the item; a field that does not apply to the item's type fails the match. |
| Loot actions | `LOOT_ACTIONS = ['keep', 'sell', 'salvage', 'stash']`. `stash` sends gear to the General tab, a gem to the Gems tab, a map to its tier, a material to the Materials tab; with no room there the find goes on to the bag as `keep` would (Review Focus 5). Materials never sell or salvage: a rule with `kind: 'material'` or `material` set must be `keep` or `stash` (`ruleValid`), and a `kind: 'any'` sell or salvage rule skips materials. |
| Rule migration | `migrateRule(old)` gives 0, 1 or 2 rules that act exactly as the old one did (old `any` never matched a map): `{ rarity: R, target: 'any' }` → `{ kind: 'gear', rarity: R }`; `{ rarity: 'any', target: 'any' }` → `{ kind: 'gear' }` then `{ kind: 'gem' }`; a set or slot target → `{ kind: 'gear', set }` or `{ kind: 'gear', slot }` with `rarity` when not `'any'`; `{ rarity: 'any', target: 'gem' }` → `{ kind: 'gem' }`; `{ rarity: R ≠ 'any', target: 'gem' }` matched nothing and is dropped. `MAX_LOOT_RULES` becomes 40 (a split never overflows). `DEFAULT_LOOT_FILTER = []`: today's default keeps everything. |
| Filter and materials | A found material now goes through the filter: a matching `keep` or `stash` rule applies (`stash` → the whole find to the Materials tab, one `stash` note and a `filterStashed` step); `drainOverflow` does the same for a held stack. |
| Long gaps | `LONG_GAP_MS = 5 × 60_000`. In `catchUp`, `away = !live \|\| now − lastTickAt > LONG_GAP_MS`; the dig gate is `state.paused` when away, else `digPaused`; the summary rules are unchanged (≥ 300 ticks). |
| Hover on fill | `ItemButton` checks `:hover` on mount and inspects when the last pointer was not a touch (`lastPointerType()` in `platform.ts`, from a document-level `pointerdown` listener); drags, pinned cards and open menus already stop `inspect`. |
| Unique lines | The eight sentences of spec §10, verbatim, as `UNIQUE_LINES`. A legendary's card shows its line after its affixes in a new line tone `special` (the legendary colour), with no tier. A unique acts only while its legendary is worn (`hasUnique(state, id)`); an unknown `uniqueId` has no line and no effect. |
| Unique draws | `uniqueGen(state)` is a `Gen` whose `rng` reads and writes `state.uniqueRng` and whose `nextId` reads and writes `state.nextId`. Deepdelver's second find, Golddigger's material, Wolf Eye's extra item and Peacemaker's second strike draw from it; Deepdelver's instant metre is `metre % 25 === 0`, Peacemaker's is `run.strikes % 5 === 0`, Kraken Leather is `run.saved`. |
| Unique effects | **Deepdelver:** a metre whose depth is a multiple of 25 is finished at once, before any tick is spent on it; its vein pays double, and a chest, gem or map on it is found a second time (a `bonus` find) from the unique stream. **The Golddigger:** every gold vein also gives one material of its metre (`pickMaterial`, `materialAmount` with unique draws), as a loot note on the find. **Black Lantern:** `Stats.hazardSight = 30` (hazards within 30 m past the face show on the minimap, even past the lamp and beside a feature) and `Stats.hazardSlow = 0.5` (half the slowdown). **Long Voyage:** `offlineCapMs` doubles after its clamp, and while `away` every find is doubled as Deepdelver doubles a 25th metre's (they stack). **Band of the Deep:** a critical hit heals `round(0.02 × maxLife)`, capped at max life. **Wolf Eye:** a champion or boss drops one more item, rolled from the unique stream with the same magic find as the others. **Kraken Leather:** the first killing blow of a run leaves 1 life, logs `{ kind: 'saved', monster }`, and sets `run.saved`. **The Peacemaker:** every 5th strike strikes a second time, its damage and crit from the unique stream. |
| No clicks in maps (Ernest, 2026-10-26) | Clicking in a map no longer strikes: `clickHit` and the click path of `strike` go, the Run view's fight scene is not a button, its hint and the README's "click to hit" go, and click-only stats stay for digging only. Every strike is the automatic one. A real combat system is a later plan. |
| Harder maps | Ernest (2026-10-26): tiers 1–2 stay gentle and clearable without clicking; tiers 3 and up aim at about 40 %. `MAP_MONSTER_SCALE: readonly number[]` by tier (tier 1 first; deeper tiers use the last entry) multiplies `monsterLifeBase` and `monsterDamageBase` in `monsterState`. The pinned reference miner: character level `min(60, 3 × N)`, five magic battle items of item level N rolled by `rollGear(s, N, 'battle', 'magic', slot)` on a fresh `newGame(hashN(0xc1ea7, N, i), 0, { lootSeed: hashN(0xc1ea7, 99, N, i) })`, no gems, no clicks, a normal map at a metre of tier N. Today that miner clears 98–100 % at every tier; with every monster × K it clears tier 1 at 40 % near K 3.0, tier 2 near 2.25, tier 3 near 2.05, tier 4 near 1.8, tier 5 near 1.7, tier 6 near 1.5, tier 7 near 1.4, tier 8 near 1.3, tier 9 near 1.3 and tier 10 near 1.2, so the table starts there and is tuned until the simulation holds **60–80 % at tiers 1–2 and 30–50 % at tiers 3–10**. The first map of a new world must be winnable without clicks: a level-2 miner with five normal item-level-1 battle items clears a tier-1 map at least 50 % of the time (a second pinned test). |
| Stronger modifiers | `MAP_MOD_TIERS` rises by about half: monsterLife `{ 15, 8 }`, monsterDamage `{ 12, 6 }`, monsterSpeed `{ 8, 4 }`, bossPower `{ 20, 10 }`, weakHealing `{ 15, 7 }`, hardened `{ 8, 4 }`; the caps stay. Stored values keep their meaning; only new rolls are stronger. |
| Specials | `MAP_SPECIALS = ['bossLegendary', 'treasureRoom', 'championPacks', 'doubleMaterials', 'tripleSouls', 'secondBoss']`, texts from spec §11 verbatim. At most one, stored as `map.special`, outside `mods`, never counted toward the 6, never a reward input, never removed by Obsidian, Silver or a temper. **Rolls:** after Copper, Iron, Silver and a Void temper on a map with none, one `nextRandom(state) < MAP_SPECIAL_CHANCE (0.1)` draw and, on success, one `pickUniform(state, MAP_SPECIALS)` draw, both from `state.rng`. **Effects:** `bossLegendary`: a boss kill drops one legendary from `rollLegendary(state, tier)` (any of the 8, drawn from `state.rng`), on top of its drops. `treasureRoom`: when the last regular room is cleared, `TREASURE_CHESTS = 3` chests (`rollChest(state, tier)`) drop before the boss room begins. `championPacks`: the layout gives every room a champion on top of the budget's. `doubleMaterials`: every material drop's amount × 2. `tripleSouls`: Souls per kill × 3 and room clears heal nothing (`healMult` 0). `secondBoss`: the boss room holds two bosses, the second `extra` from `hashN(seed, SALT_BOSS, tier, index, 2)` and named `${bossName}'s Twin` *(copy)*; `bossRoom` is unchanged. In-run special draws use `state.rng`: a map with a special is a different map, as an enchanted one is. |
| Trader stock | `STOCK_SIZE = 12`, `TRADER_PRICE_MULT = 4`, `TRADER_MAP_SHARE = 0.25`, `SALT_TRADER = 0x7ade`. `stockBand(state) = floor(deepest / 10)`; the stock's tier is `metreTier(max(1, band × 10))`. `traderStock(seed, band)` rolls 12 items from `{ rng: hashN(seed, SALT_TRADER, band), nextId: 1 }`: each is a map with chance `TRADER_MAP_SHARE` (metre `max(1, band × 10)`, rarity from `rollRarity` with legendary → rare, modifiers from `rollMapMods` as Copper or Silver would give, no special), else gear of a set drawn 50/50 at `rollRarity` with legendary → rare (Ernest, 2026-10-26: legendaries never appear in the Trader's stock; they come from drops, gambling and the `bossLegendary` special). Prices are `TRADER_PRICE_MULT × sellValue(item)` (sell bonus never changes a price). A bought slot is empty until the band changes; `merchant.bought` is reset when `merchant.band !== stockBand(state)`. A bought item is copied with a fresh id, skips the loot filter, and is logged from `{ kind: 'merchant' }` with a `bag` step. |
| Stock location | `ItemLoc` gains `{ where: 'stock'; index: number }`; `itemAt` reads it from the stock (undefined when sold). Every inventory change refuses it (`'invalid'`), `canCraft` gives `'notGear'`, `socketGem` `'invalid'`; drags from or onto it are `'invalid'`. Its action card has one action, `buy`. |
| Merchants | `MERCHANTS = { trader: { name: 'Brannoc the Trader', sprite: 'brannoc' }, gambler: { name: 'Old Mirela', sprite: 'mirela' } }`. Portraits are 16 × 24 grids in `grids.ts`, drawn by the atlas like items: Brannoc broad, brown beard, green coat, a pack; Mirela grey hair, purple shawl, a cane. |
| Merchant view | Two cards side by side (one column under 900 px): the Trader's with the stock tiles (6 a row, 3 on a phone), the gambler's with Plan 8's slot grids, "You got" panel and status. A tile is a cell (hover, pinned and action cards through `useItemInteractions`), the name in its rarity colour, the price and a `Buy · N Gold` button; a sold tile keeps its size, reads `Sold` and disables its button, so nothing moves under the pointer. |
| Dialog | The loot filter dialog lists rules as sentences (`describeRule`) with `Edit` and `✕`, and edits one rule at a time in an editor under the list whose head row (Kind, Action, Move up, Move down, Save, Cancel) never moves; the fields under it follow the kind. A removed rule leaves an empty `Removed` row until the dialog closes; moving is done from the editor; `Add rule` sits in the dialog's head. |
| Sweeps | `/root/.claude/jobs/08d9b178/tmp/p10t7/sweep-stock.mjs` and `/root/.claude/jobs/08d9b178/tmp/p10t9/sweep-filter.mjs`, modelled on `…/p9t5/lib.mjs` and `…/p9fix/sweep-held.mjs`, must report `BAD 0` at 1280 × 900 and 390 × 844. |

---

### Task 1: Save schema 10, the loot rule shape and its migration, and the schema-9 fixture

**Files:**
- Create: `src/core/lootFilter.ts`, `tests/core/lootFilter.test.ts`.
- Add: `tests/fixtures/save-schema-9.txt` (already generated; see Global Constraints).
- Modify: `src/core/types.ts`, `src/core/items.ts`, `src/core/itemData.ts`, `src/core/balance.ts`, `src/core/save.ts`, `src/core/newGame.ts`, `src/core/maps.ts` (`startMap` sets `strikes: 0`), `src/core/loot.ts` (`lootAction` reads the new shape), `src/store/gameStore.ts`, `src/ui/log/logView.ts`, `src/ui/run/runView.ts`, `src/ui/character/lootFilterView.ts`, `src/ui/character/LootFilterDialog.tsx`, `README.md`.
- Test: `tests/core/save.test.ts`, `tests/core/lootFilter.test.ts`, `tests/core/loot.test.ts`, `tests/ui/lootFilterView.test.ts`, `tests/ui/logView.test.ts`, `tests/ui/runView.test.ts`.

**Interfaces:**
- **`items.ts`:** `MAP_SPECIALS` and `type MapSpecial` (Decisions); `MapItem` gains `special?: MapSpecial`.
- **`itemData.ts`:** `LEGENDARY_IDS = ['deepdelver', 'golddigger', 'blackLantern', 'longVoyage', 'bandOfTheDeep', 'wolfEye', 'krakenLeather', 'peacemaker'] as const`, `type LegendaryId`; `LegendaryDef.id: LegendaryId`.
- **`types.ts`:**
  - `LOOT_ACTIONS = ['keep', 'sell', 'salvage', 'stash'] as const`; `LOOT_KINDS = ['gear', 'gem', 'map', 'material'] as const`, `type LootKind`; `interface LootRange { min?: number; max?: number }`; `interface LootRule` as in Decisions. `LootTarget` goes.
  - `TRAIL_EVENTS` gains `'filterStashed'`.
  - `CombatLine` gains `{ kind: 'saved'; monster: string }`.
  - `MapRun` gains `strikes: number` and `saved?: true`.
  - `GameState` gains `merchant: { band: number; bought: number[] }` and `uniqueRng: number`.
- **`balance.ts`:** `MAX_LOOT_RULES = 40`; `STOCK_SIZE = 12`.
- **`logView.ts`:** `stepText` for `filterStashed` → `loot filter stashed`, or `loot filter → Materials tab` *(copy)* for a material entry (Task 8 makes the step).
- **`runView.ts`:** `combatLineText({ kind: 'saved', monster })` → `{ text: `Kraken Leather holds: ${monster}'s blow leaves you at 1 life`, tone: 'level' }` *(copy)* (Task 3 logs the line).
- **`lootFilter.ts`:**
  - `ruleMatches(rule: LootRule, item: Item): boolean` per the Decisions' field rules.
  - `ruleValid(rule: LootRule): boolean`: gear fields (`set`, `slot`) only with kind `gear`; `rarity`, `level`, `modTier`, `mods` only with `gear`, `map` or `any` (`rarity: 'legendary'` not with `map`); `mapMod` only with `map` or `any`; `gem`/`grade` only with `gem` or `any`; `material` only with `material` or `any`; a `material` kind or a `material` field only with `keep` or `stash`; every range has `min <= max` when both are set.
  - `migrateRule(old: unknown): LootRule[]` and `migrateLootFilter(old: unknown): LootRule[]` (an array that is not a list of old rules gives `[]`; the result is cut at `MAX_LOOT_RULES`).
  - `DEFAULT_LOOT_FILTER: readonly LootRule[] = []`.
- **`loot.ts`:** `lootAction(rules, item: Loot): LootAction` returns the first matching rule's action through `ruleMatches`; a map still gives `'keep'` and a `'stash'` action is treated as `'keep'` until Task 8 (one comment says so).
- **`save.ts`:** `SCHEMA_VERSION = 10`; `MIGRATIONS[9]` (malformed input returned unchanged for the validator): `settings.lootFilter = migrateLootFilter(old)`, `merchant: { band: 0, bought: [] }`, `uniqueRng: hash2(state.rng, 0xa11e)`, a run in progress gains `strikes: 0`. The validator: `isLootRule` (only its own keys; `kind`, `action` in their lists; optional fields of the right type, ranges of non-negative integers, `level`/`modTier` within `MAX_ITEM_LEVEL + MAX_TIER_OVER_CAP`, `mods` at most 20) and `ruleValid`; `merchant.band` a non-negative integer and `merchant.bought` at most `STOCK_SIZE` distinct integers in `0..STOCK_SIZE − 1`; `uniqueRng` uint32; `strikes` a non-negative integer and `saved` undefined or `true`; `special` undefined or in `MAP_SPECIALS`; the `saved` combat line named like `hurt`.
- **`newGame.ts`:** `merchant: { band: 0, bought: [] }`, `uniqueRng: hash2(options.lootSeed ?? seed, 0xa11e)`, `lootFilter: [...DEFAULT_LOOT_FILTER]`.
- **`gameStore.ts`:** `setLootFilter(rules)` keeps only rules `ruleValid` accepts.
- **`lootFilterView.ts` (interim, replaced in Task 9):** `LootTarget = GearSet | Slot | 'gem' | 'any'`; `targetOf(rule): LootTarget`; `withTarget(rule, target): LootRule` (sets `kind`, `set`, `slot`, dropping `rarity` for `gem`); `RARITY_OPTIONS` and `ACTION_OPTIONS` unchanged (no `stash` yet); `NEW_RULE = { kind: 'gear', rarity: 'normal', action: 'sell' }`. The dialog's three selects read and write through these.

- [ ] **Step 1: Write the failing tests.**
  - **`lootFilter.test.ts`:**
    - `it('migrates every old rule shape to rules that act the same')`: a table of old rules × items (normal/magic/rare/legendary gear of several slots, a gem stack, a map): for each old rule the action the Plan 9 `lootAction` gave (restated in the test as the oracle: `rarityOk && targetOk`, maps keep) equals `lootAction(migrateRule(old), item)`. Pins: `{ normal, any, sell }` → `[{ kind: 'gear', rarity: 'normal', action: 'sell' }]`; `{ any, any, keep }` → `[{ kind: 'gear', action: 'keep' }, { kind: 'gem', action: 'keep' }]`; `{ magic, mining, salvage }` → `[{ kind: 'gear', set: 'mining', rarity: 'magic', action: 'salvage' }]`; `{ legendary, boots, keep }` → `[{ kind: 'gear', slot: 'boots', rarity: 'legendary', action: 'keep' }]`; `{ any, gem, keep }` → `[{ kind: 'gem', action: 'keep' }]`; `{ rare, gem, salvage }` → `[]`; `migrateLootFilter('x')` → `[]`.
    - `it('matches on every field, and a field that does not apply fails the match')`: `{ kind: 'any', slot: 'boots' }` fails for a gem and a map and holds for boots; `{ kind: 'any', rarity: 'rare' }` holds for rare gear and a rare map; `{ kind: 'any', rarity: 'legendary' }` fails for every map; `{ kind: 'gear', level: { min: 4, max: 6 } }` holds at 4, 5, 6 and fails at 3 and 7; `{ kind: 'map', level: { min: 5 } }` holds for a tier-5 map; `{ kind: 'gear', modTier: 3 }` holds for an item with a T3 crafted line and fails for one whose lines are T1 and T2; `{ kind: 'map', mods: { max: 2 } }` holds for 2 modifiers and fails for 3; `{ kind: 'map', mapMod: 'hardened' }`; `{ kind: 'gem', gem: 'ruby', grade: 'small' }`; `{ kind: 'material', material: 'tin' }`.
    - `it('refuses rules that cannot hold')`: each of these is invalid: `{ kind: 'gem', slot: 'boots' }`, `{ kind: 'map', set: 'mining' }`, `{ kind: 'map', rarity: 'legendary' }`, `{ kind: 'gear', gem: 'ruby' }`, `{ kind: 'material', action: 'sell' }`, `{ kind: 'material', action: 'salvage' }`, `{ kind: 'any', material: 'tin', action: 'sell' }`, `{ kind: 'gear', level: { min: 6, max: 4 } }`; `{ kind: 'material', action: 'stash' }` and `{ kind: 'any', action: 'sell' }` are valid.
  - **`save.test.ts`:**
    - `it('the schema-9 fixture migrates its rules, gains an empty bought record and a unique stream, and plays on')` (Review Focus 1): decode `save-schema-9.txt`; `settings.lootFilter` deep-equals the six rules above, in order (`normal gear sell`, `magic mining gear salvage`, `gem keep`, `legendary boots keep`, `gear keep`, `gem keep`); `merchant` is `{ band: 0, bought: [] }`; `uniqueRng` is `hash2(old.rng, 0xa11e)`; the run's `strikes` is 0 and `saved` is undefined; `bag`, `equipped`, `stash`, `overflow`, `drops`, `deaths`, `lastRun`, `gold`, `deepest` deep-equal the old ones; then `applyTicks` in steps of 50 until `activity.kind === 'dig'` (at most 20,000 ticks): no throw, `validateState` holds.
    - `it('every older fixture still loads')` adds `fixture9`.
    - `it('the validator holds the schema-10 shapes')`: each of these makes a valid state invalid: a rule with `kind: 'boots'`, with `action: 'stash'` and an unknown key, with `{ kind: 'material', action: 'sell' }`, with `level: { min: -1 }`, 41 rules; `merchant.bought` of `[0, 0]`, of `[12]`, of 13 entries, `merchant.band` −1; `uniqueRng` 2^32; a run with `strikes: -1` or `saved: false`; a map with `special: 'x'`. A rule using every field validly, a map with `special: 'secondBoss'` in the bag, in a tier list, in a run and in a death, a run with `saved: true` and a `saved` combat line stay valid.
  - **`loot.test.ts`:** the existing filter tests use the new shape; `it('a stash rule is kept until Task 8')` asserts `lootAction([{ kind: 'gear', action: 'stash' }], gear)` is `'keep'` (Task 8 replaces it). Every other test that builds an old-shape rule (`grep -rl "target: '" tests`) moves to the new shape, and the `20 rules` limit test becomes 40.
  - **`lootFilterView.test.ts`:** `targetOf({ kind: 'gear', set: 'mining', ... })` is `'mining'`, of `{ kind: 'gem' }` is `'gem'`; `withTarget(rule, 'boots')` gives `{ kind: 'gear', slot: 'boots' }` with no `set`; `withTarget(rule, 'gem')` drops `rarity`.
  - **`logView.test.ts`:** `trailText` for `loot filter stashed` and `+3 Iron ore → loot filter → Materials tab`. **`runView.test.ts`:** `combatLineText` for `saved`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run tests/core/lootFilter.test.ts tests/core/save.test.ts tests/core/loot.test.ts tests/ui/lootFilterView.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it.** Types and balance first, then `lootFilter.ts`, `loot.ts`, `save.ts` (migration, then validator), `newGame`, `maps.ts`, the store, then the interim view helpers and dialog until `npx tsc --noEmit` is clean.
- [ ] **Step 4: Update the README.** Nothing the player sees changes yet (the interim dialog offers the same choices); the Gear paragraph's loot filter sentence stays until Task 8 rewrites it.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add tests/fixtures/save-schema-9.txt src/core/lootFilter.ts tests/core/lootFilter.test.ts` and the rest, then `git commit -m "Move saves to schema 10: the new loot rule shape, a bought record for the Trader and a stream for the uniques"`.

---

### Task 2: §12a: long gaps count as being away, and a cell that fills under the pointer shows its card

**Files:**
- Modify: `src/core/balance.ts`, `src/store/gameStore.ts`, `src/ui/platform.ts`, `src/ui/character/ItemGrid.tsx`, `README.md`.
- Test: `tests/store/gameStore.test.ts`.

**Interfaces:**
- **`balance.ts`:** `LONG_GAP_MS = 5 * 60_000`.
- **`gameStore.ts`:** `catchUp(events?, live = false)`: `const away = !live || now - state.lastTickAt > LONG_GAP_MS;` the gate passed to `advance` is `away ? state.paused : this.digPaused`; the summary is made as today.
- **`platform.ts`:** `lastPointerType(): string` ('mouse' until any `pointerdown`), kept by one document-level capture listener installed on first use (`typeof document !== 'undefined'`).
- **`ItemGrid.tsx`:** `ItemButton` runs a mount effect: `if (lastPointerType() !== 'touch' && el.matches(':hover')) handlers.onInspect(target, el)`; `inspect` already does nothing while a card is pinned or a menu is open, and `onInspect` nothing while dragging.

- [ ] **Step 1: Write the failing tests.**
  - **`gameStore.test.ts`, `it('a gap of more than 5 minutes between live ticks is dug as time away, unless the player pressed Pause')`:** a store on the Inventory view (`setViewPaused(true)`): `pump()` 6 minutes later has dug (`deepest` > 0), `offlineSummary` is not null and its `paused` is false; `setPaused(true)` and `pump()` 6 minutes later dug nothing and the summary's `paused` is true; `setPaused(false)` and `pump()` 4 minutes later (view still paused) dug nothing.
- [ ] **Step 2: Run the test and confirm it fails.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Digging: a gap of more than 5 minutes between two ticks (the computer slept) is dug as time away, whatever view was showing, unless you pressed Pause.
- [ ] **Step 5: Run everything, then check in a browser.**
  - `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Browser (`/root/.claude/jobs/08d9b178/tmp/p10t2/fill.mjs`): import the schema-9 fixture (its run is in progress); open Inventory; sell the bag's first gear cell with Ctrl+click so a held item fills it (the id-change case), then sell the bag's first cell again and again until the held list is empty and a cell stays empty; rest the pointer on that empty cell; wait up to 60 s for a drop of the run to land there; expected: a hover card (`[data-item-card][role="tooltip"]`) names the item now in the cell. Run at 1280 × 900.
- [ ] **Step 6: Commit.** `git commit -am "Dig a gap of more than five minutes as time away, and show the card of a cell that fills under the pointer"`.

---

### Task 3: Legendary uniques

**Files:**
- Create: `src/core/uniques.ts`, `tests/core/uniques.test.ts`.
- Modify: `src/core/types.ts`, `src/core/balance.ts`, `src/core/itemGen.ts` (`export type Gen`, `rollLegendary`), `src/core/stats.ts`, `src/core/layer.ts`, `src/core/dig.ts`, `src/core/clock.ts`, `src/core/combat.ts`, `src/store/gameStore.ts`, `src/ui/mine/minimap.ts`, `src/ui/mine/Minimap.tsx`, `src/ui/character/itemView.ts`, `src/ui/character/character.css`, `README.md`.
- Test: `tests/core/uniques.test.ts`, `tests/core/dig.test.ts`, `tests/core/combat.test.ts`, `tests/core/clock.test.ts`, `tests/store/gameStore.test.ts`, `tests/ui/minimap.test.ts`, `tests/ui/itemView.test.ts`.

**Interfaces:**
- **`types.ts`:** `Stats` gains `hazardSight: number` and `hazardSlow: number`.
- **`balance.ts`:** `DEEPDELVER_EVERY = 25`, `BLACK_LANTERN_SIGHT = 30`, `BLACK_LANTERN_SLOW = 0.5`, `LONG_VOYAGE_CAP = 2`, `BAND_OF_THE_DEEP_HEAL = 0.02`, `WOLF_EYE_DROPS = 1`, `PEACEMAKER_EVERY = 5`.
- **`uniques.ts`:**
  - `UNIQUE_LINES: Readonly<Record<LegendaryId, string>>`, the spec §10 sentences verbatim (`Every 25th metre is dug at once, and its find is doubled.` … `Every 5th hit strikes twice.`).
  - `hasUnique(state: GameState, id: LegendaryId): boolean`: the legendary's slot in its set holds an item with `uniqueId === id`.
  - `uniqueGen(state: GameState): Gen` per Decisions.
- **`itemGen.ts`:** `rollLegendary(gen: Gen, ilvl: number): GearItem` picks any of the 8 (`pickUniform`) and rolls it for its slot.
- **`stats.ts`:** `hazardSight: hasUnique(…, 'blackLantern') ? BLACK_LANTERN_SIGHT : 0`; `hazardSlow: … ? BLACK_LANTERN_SLOW : 1`; `offlineCapMs: clamp(…) × (hasUnique(…, 'longVoyage') ? LONG_VOYAGE_CAP : 1)`.
- **`layer.ts`:** `hazardFactor(hazard, ward, slow = 1)`: `1 + (HAZARD_SLOW[hazard] − 1) × (1 − min(ward, MAX) / 100) × slow`.
- **`dig.ts`:**
  - `collect(state, roll, depth, tier, stats, events?, bonus = false, gen: Gen = state)`: chests and gems roll from `gen`; a gold vein with the Golddigger worn also calls `receiveMaterial` with `pickMaterial(depth, nextRandom(uniqueGen))` and `materialAmount(…, nextRandom(uniqueGen))`, its notes on the find.
  - `finishMetre(state, next, done, stats, events?, double = false)` (the loop body of today's `digFace`, without the progress scaling): with `double`, a vein's roll is collected with `amount × 2` and a chest, gem or map is collected a second time with `bonus = true` and `gen = uniqueGen(state)`.
  - `isInstant(state, metre)`: Deepdelver worn and `metre % DEEPDELVER_EVERY === 0`. `digFace` finishes instant metres at the face before spending any progress, and again after each finished metre, each with `double = true`; `away` metres (below) are doubled too.
  - `applyTicks(state, count, stats, events?, digPaused = false, away = false)`: `away` with Long Voyage worn doubles every finished metre.
- **`clock.ts`:** `advance(state, nowMs, stats, events?, digPaused = false, away = false)` passes `away` through.
- **`gameStore.ts`:** `catchUp` passes its `away` (Task 2) to `advance`.
- **`combat.ts`:**
  - `strike(state, run, b, click, events?, gen: Gen = state)`: damage and crit draw from `gen`; `run.strikes += 1` once per call from the loop (not for the second strike); a crit with the Band worn heals `round(BAND_OF_THE_DEEP_HEAL × b.maxLife)`; after a strike with the Peacemaker worn and `run.strikes % PEACEMAKER_EVERY === 0` (and the run still going) one more `strike(…, uniqueGen(state))`.
  - `onKill`: a champion or boss with Wolf Eye worn rolls `WOLF_EYE_DROPS` more items from `uniqueGen(state)` (set, rarity with the same `magicFind`, `rollGear`), received like the others.
  - `combatStep`: on `run.life <= 0`, with Kraken Leather worn and `run.saved !== true`: `run.life = 1`, `run.saved = true`, `logLine({ kind: 'saved', monster })`, and the fight goes on.
- **`minimap.ts`:** `minimapModel(state, lampSight, top, hazardSight = 0)`: hazards within `hazardSight` metres past the face are hints of their own (`kind` the hazard, `label` as today, `lantern: true`), after the lamp hints, even in a metre that shows a feature; `Minimap` passes `stats.hazardSight` and keys hints by `${y}-${kind}`.
- **`combat.ts`** logs `{ kind: 'saved', monster }` with the text Task 1 gave `combatLineText`.
- **`itemView.ts`:** `Tone` gains `'special'`; `itemLines` for a legendary with a known `uniqueId` adds `{ text: UNIQUE_LINES[id], tone: 'special' }` after its affixes. CSS: `.gm-card__line[data-tone='special'] { color: var(--gm-legendary); }`.

- [ ] **Step 1: Write the failing tests.**
  - **`uniques.test.ts`** (each with the legendary worn, and a twin state whose worn item has `uniqueId` deleted; `rng` compared between the two):
    - `it('Deepdelver finishes every 25th metre at once and doubles its find')`: `deepest` 24, `ahead[25]` a gold vein of 100: one tick leaves `deepest` ≥ 25, `gold` risen by 200 × the multipliers, `progress` what the tick dug of metre 26; `ahead[50]` a chest: after digging past 50, two chest finds at 50 m, the second `bonus: true`; the twin dug metre 25 over its ticks and found one chest; both states' `rng` are equal after the same number of chests on normal metres.
    - `it('The Golddigger gives a material with every gold vein, from its own stream')`: `collect` of a gold vein at 220 m: a material note on the find, the bag holds the material, `rng` equals the twin's, `uniqueRng` changed.
    - `it('Black Lantern halves the hazard slowdown and lights hazards ahead')`: `hazardFactor('gas', 0, 0.5)` is 1.5 and `('unstable', 50, 0.5)` is 1.15; `deriveStats` gives `hazardSight` 30 and `hazardSlow` 0.5; `minimapModel(…, 30)` lists a hazard hint at a metre 20 m past the face that holds a chest, and none past 30 m; `ticksForMetre` on a gas metre with the lantern is 1.5× the plain cost.
    - `it('Long Voyage doubles the offline cap and the finds of time away')`: `offlineCapMs` with its +120 min line is `2 × 10 h`; `advance(…, false, true)` over a gold vein pays double, `advance(…, false, false)` pays single; a `load()` in a store with the boots worn and a vein 1 m ahead pays double.
    - `it('Band of the Deep heals 2 % of max life on a crit')`: a seed found as `crafting.test.ts` finds its outcomes, where the first strike crits: `run.life` (set to 50 before) rises by `round(0.02 × maxLife)`; without the ring it does not.
    - `it('Wolf Eye adds one drop to champions and bosses, from its own stream')`: `onKill` of a champion: `run.items` one higher than the twin's, `rng` equal to the twin's, `uniqueRng` changed; a normal kill adds nothing.
    - `it('Kraken Leather leaves 1 life once per map')` (Review Focus 4): `run.life = 1`, a monster hit: `life` 1, `saved` true, the log's last line `saved`; the next hit: the run ends `died`.
    - `it('The Peacemaker strikes twice on every 5th hit, from its own stream')`: a monster of 10^6 life; five automatic strikes (`combatStep` until `run.strikes` is 5): the monster took 6 hits, `rng` equals the twin's after 5 plain strikes, `run.strikes` is 5; the counter survives `decodeSave(encodeSave(s))`.
    - `it('the fixture\'s worn legendaries act from the first tick')` (Review Focus 1): on the schema-9 fixture, `hasUnique(s, 'deepdelver')` and `hasUnique(s, 'peacemaker')` hold, `itemLines(Deepdelver)` ends with its unique line, and `hasUnique(s, 'blackLantern')` is false (it lies in the bag).
  - **`combat.test.ts`:** the two replay tests (`a saved run in progress plays out exactly as before modifiers existed`, `logging … makes no draws`) stay as they are and pass; `it('every state of a run … is a valid save')` now runs with the Peacemaker worn too.
  - **`itemView.test.ts`:** `it('a legendary line has no tier, and a sealed item says so')` gains the unique line: `gear(s, 'pickaxe', { rarity: 'legendary', uniqueId: 'deepdelver', … })` → the last line is `{ text: 'Every 25th metre is dug at once, and its find is doubled.', tone: 'special' }`; a legendary with no `uniqueId` has no such line.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.** `uniques.ts` and `balance` first, then stats and layer, dig and clock, combat, the minimap, the card.
- [ ] **Step 4: Update the README.** Gear: a new paragraph, "Legendaries": each has a unique line, listed with the eight sentences, that works only while it is worn.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add src/core/uniques.ts tests/core/uniques.test.ts && git commit -am "Give every legendary a unique line that changes how the game plays"`.

---

### Task 4: Harder maps: the per-tier monster scale and the clear-rate simulation, and stronger modifiers

**Files:**
- Create: `tests/core/mapClear.test.ts`.
- Modify: `src/core/balance.ts`, `src/core/monsters.ts`, `src/core/combat.ts` (no click strikes), `src/store/gameStore.ts` (no `clickHit`), `src/ui/run/{RunView,FightScene}.tsx`, `src/ui/run/runView.ts`, `README.md`.
- Test: `tests/core/mapClear.test.ts`, `tests/core/combat.test.ts`, `tests/core/battle.test.ts`, `tests/core/mapMods.test.ts`, `tests/core/rewards.test.ts`.

**Interfaces:**
- **`balance.ts`:** `MAP_MONSTER_SCALE: readonly number[]` (start: `[3.0, 2.25, 2.05, 1.8, 1.7, 1.5, 1.4, 1.3, 1.3, 1.2]`), `mapMonsterScale(tier: number): number` (`MAP_MONSTER_SCALE[min(tier, length) − 1]`); `MAP_MOD_TIERS` per Decisions.
- **`monsters.ts`:** `monsterState` multiplies `monsterLifeBase(tier)` and `monsterDamageBase(tier)` by `mapMonsterScale(tier)`.

- [ ] **Step 1: Write the failing tests.**
  - **`mapClear.test.ts`, `it('a fresh tier-N map is cleared by magic item-level-N gear at level 3N: 60–80 % at tiers 1–2, 30–50 % at tiers 3–10')`:** the reference miner of the Decisions, 100 maps a tier at metres `firstMetreOfTier(N) + (i % 40)` (tiers 1–6 from `bandAt`, tier 7+ from `ABYSS_START + ABYSS_BAND_HEIGHT × (N − 7) + 1`), each run played with `applyTicks(s, 10, …)` and the bag and held list emptied between calls; `cleared / 100` within `[0.6, 0.8]` at tiers 1–2 and `[0.3, 0.5]` at tiers 3–10, printed per tier in the failure message. A second test, `it('the first map of a new world is won without clicks')`: a level-2 miner with five normal item-level-1 battle items clears a tier-1 normal map at least 50 of 100 times. A third, `it('clicking in a map does nothing')`: the store has no `clickHit`, and a run's state after N ticks is the same whatever the pointer does (the Run view's fight scene has no click handler).
  - **`mapMods.test.ts`:** `mapModRange('monsterLife', 4)` is `{ lo: 39, hi: 46 }` and `mapModRange('weakHealing', 2)` is `{ lo: 22, hi: 28 }`.
  - **`battle.test.ts`, `it('monster numbers by rank and modifier')`:** re-pin to the scaled values.
  - **`combat.test.ts`:** re-pin the four opening scenario tests to what the new scale gives (keep one scenario that clears and one that falls; the `three clicks a second` scenario goes with clicking).
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL (`mapClear` above 50 % everywhere).
- [ ] **Step 3: Implement it,** then tune `MAP_MONSTER_SCALE` entry by entry until `mapClear.test.ts` passes; the table's values are the deliverable.
- [ ] **Step 4: Update the README.** Maps: maps from tier 3 are much harder, a map of your tier is a real fight with gear of its level, the first tiers stay gentle, and new modifiers roll stronger; fights are automatic, so clicking in a map does nothing.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add tests/core/mapClear.test.ts && git commit -am "Scale map monsters by tier so a map of your gear's level is cleared about 40% of the time, and roll modifiers stronger"`.

---

### Task 5: Map special modifiers: data, rolls, effects, card text and the run head

**Files:**
- Create: `tests/core/mapSpecials.test.ts`.
- Modify: `src/core/balance.ts`, `src/core/mapMods.ts`, `src/core/dungeons.ts`, `src/core/combat.ts`, `src/core/crafting.ts`, `src/ui/run/runView.ts`, `src/ui/run/RunView.tsx`, `src/ui/character/itemView.ts`, `README.md`.
- Test: `tests/core/mapSpecials.test.ts`, `tests/core/mapCrafting.test.ts`, `tests/core/dungeons.test.ts`, `tests/ui/itemView.test.ts`, `tests/ui/runView.test.ts`.

**Interfaces:**
- **`balance.ts`:** `MAP_SPECIAL_CHANCE = 0.1`, `TREASURE_CHESTS = 3`, `TRIPLE_SOULS = 3`, `DOUBLE_MATERIALS = 2`.
- **`mapMods.ts`:** `MAP_SPECIAL_TEXT: Readonly<Record<MapSpecial, string>>` (spec §11 verbatim: `The boss drops a legendary`, `A treasure room before the boss`, `Every pack has a champion`, `Materials drop twice`, `Souls ×3, but rooms don't heal`, `A second boss`); `MapEffects` gains `soulsMult: number` (3 for `tripleSouls`, else 1) and `materialMult: number` (2 for `doubleMaterials`, else 1); `tripleSouls` sets `healMult` 0; `quantity`, `rarity`, `souls` ignore the special.
- **`dungeons.ts`:** `dungeonLayout(seed, map: { tier; metre; special? })` returns `boss2: LayoutMonster | null` (for `secondBoss`, per Decisions) and, for `championPacks`, gives every room without a champion one more at slot `n` (name, mods and extra hashed as today's champions are). A map with no special gives today's layout exactly.
- **`combat.ts`:** `roomQueue` returns `[boss, boss2]` in the boss room when `boss2` is set; `strike`, on clearing room `bossRoom − 1` of a `treasureRoom` map, receives `TREASURE_CHESTS` chests from `rollChest(state, tier)` (origin the room) before the boss room is entered; `onKill` of a boss on a `bossLegendary` map receives `rollLegendary(state, tier)` after its drops; material amounts × `materialMult`; `soulsForKill` gets `soulMultiplier × (1 + souls/100) × soulsMult`.
- **`crafting.ts`:** `rollSpecial(state, map): void` (one chance draw; on success one pick), called in `applyToMap` after `copper`, `iron`, `silver`, and in `temperMap` before sealing, only when `map.special === undefined`.
- **`runView.ts`:** `mapSpecialLine(map): ViewLine | null` → `{ text: MAP_SPECIAL_TEXT[special], tone: 'special' }`; `RunView` renders it as the last `li` of the modifier list (no tier), the list shown whenever there are modifiers or a special; `itemView.mapLines` adds it after the modifiers, before the rewards.

- [ ] **Step 1: Write the failing tests.**
  - **`mapSpecials.test.ts`:**
    - `it('a Copper, Iron, Silver or Void enchant adds a special about one time in ten, only to a map with none')`: over 2,000 seeds, Copper on a normal map gives a special between 7 % and 13 % of the time, every kind drawn; a map that has one keeps it through Copper, Iron, Silver, Obsidian and a Void temper of every outcome (Review Focus 3); Tin on a map is still refused before any draw.
    - `it('the special roll draws from state.rng')`: Copper on two identical normal maps, one given `special` beforehand: the states' `rng` differ afterwards; two with none agree.
    - `it('a treasure room drops three chests before the boss')`: on a `treasureRoom` map, when the room before the boss clears, `run.items` rises by 3–6 and the drops' origin is that room; the queue then holds the boss.
    - `it('the boss drops a legendary')`: the boss kill adds one legendary gear item (any slot) to the drops.
    - `it('every pack has a champion')`: every room of the layout holds exactly one champion, the normal counts as without the special, and the seeded names and species of the normals are unchanged.
    - `it('materials drop twice')`: a material drop's amount is double the plain map's for the same draws.
    - `it('Souls ×3 and no healing')`: a kill pays 3× the Souls of the plain map for the same draw; a room clear heals 0.
    - `it('a second boss')`: the boss room's queue has two bosses, the second named `… 's Twin`; `validateState` holds at every tick of the run, and the run ends `cleared` only after both fall.
    - `it('a run on a special map replays identically after a save')`: `decodeSave(encodeSave(s))` mid-run, both played out, equal `rng`, log and gains.
  - **`dungeons.test.ts`:** a map without a special gives the same layout as before (the existing pinned layout tests unchanged).
  - **`itemView.test.ts` / `runView.test.ts`:** `mapLines` of a rare map with `special: 'treasureRoom'` has `{ text: 'A treasure room before the boss', tone: 'special' }` after its modifier lines and before `Rewards: …`; `mapSpecialLine(normal map)` is null.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it,** following the Plan 10 board's card section.
- [ ] **Step 4: Update the README.** Maps: Copper, Iron, Silver and Void crystal each have a one-in-ten chance to add a special modifier to a map that has none, listing the six.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add tests/core/mapSpecials.test.ts && git commit -am "Let enchants add one of six special modifiers to a map"`.

---

### Task 6: Brannoc the Trader: the stock, buying, and the stock location

**Files:**
- Create: `src/core/trader.ts`, `tests/core/trader.test.ts`.
- Modify: `src/core/types.ts`, `src/core/balance.ts`, `src/core/cells.ts`, `src/core/inventory.ts`, `src/core/crafting.ts` (`canCraft` on stock; `rollMapMods` takes a `Gen`), `src/store/gameStore.ts`, `src/ui/character/dragDrop.ts`, `src/ui/character/itemActions.ts`, `src/ui/character/useItemInteractions.tsx` (its `targetKey` for `'stock'`), `README.md`.
- Test: `tests/core/trader.test.ts`, `tests/core/inventory.test.ts`, `tests/ui/dragDrop.test.ts`, `tests/ui/itemActions.test.ts`.

**Interfaces:**
- **`types.ts`:** `ItemLoc` gains `{ where: 'stock'; index: number }` (never saved; every exhaustive `switch` over `where` gets its case here).
- **`balance.ts`:** `TRADER_PRICE_MULT = 4`, `TRADER_MAP_SHARE = 0.25`, `STOCK_BAND_METRES = 10`.
- **`trader.ts`:**
  - `type StockItem = GearItem | MapItem`; `SALT_TRADER = 0x7ade`.
  - `stockBand(state: Pick<GameState, 'deepest'>): number`; `stockTier(band: number): number`.
  - `traderStock(seed: number, band: number): readonly StockItem[]` per Decisions, memoised for the last `(seed, band)`; `rollMapMods` is loosened to take a `Gen`.
  - `stockPrice(item: StockItem): number`.
  - `boughtIn(state): number[]` (`merchant.bought` when `merchant.band === stockBand(state)`, else `[]`); `stockAt(state, index): StockItem | undefined`.
  - `type BuyResult = 'ok' | 'sold' | 'noGold' | 'bagFull' | 'invalid'`; `buyStock(state, index): { result: BuyResult; item?: Item }` per Decisions; every check comes before any change.
- **`cells.ts`:** `itemAt` case `'stock'` → `stockAt`; `sameLoc` case `'stock'`.
- **`inventory.ts`:** `fits` case `'stock'` → `'invalid'`; `moveItem`, `dropItem` with a `'stock'` end → `'invalid'`; `socketGem` into `'stock'` → `'invalid'`; `discard` → undefined. **`crafting.ts`:** `canCraft` on `'stock'` → `'notGear'`. **`soulUpgrade.ts`:** already `'invalid'`.
- **`gameStore.ts`:** `buyStock(index: number): BuyResult` (changes and drains nothing on a refusal; `changed()` on `'ok'`).
- **`dragDrop.ts`:** `parseDrop` reads `{ where: 'stock', index }` with `index` in `0..STOCK_SIZE − 1`.
- **`itemActions.ts`:** `itemActions` for a `'stock'` target → `[{ id: 'buy', label: `Buy · ${price} Gold`, disabled: sold || gold < price || bag full }]`; `runAction` `'buy'` → `store.buyStock(index)` (`'ok'` → `'ok'`, else `'invalid'`); `hoverNotes` for stock → `[`Costs ${price} Gold · Sells for ${sellPay} Gold`, 'Click for its card · right-click to buy']` *(copy)*; `actionForIntent` `'sell'`/`'salvage'`/`'move'` on stock → undefined; `noShortcutText` → null; `resultText` unchanged.

- [ ] **Step 1: Write the failing tests.**
  - **`trader.test.ts`:**
    - `it('the stock is a pure function of the seed and the band')`: `traderStock(seed, 42)` twice deep-equal; bands 42 and 43 differ; another seed differs; 12 items, each gear with `ilvl === stockTier(42)` or a map with `tier === stockTier(42)` and a rarity in normal/magic/rare, modifier counts as Copper or Silver would give, no special; over bands 0..199, between 15 % and 35 % are maps and no legendary ever appears (Ernest, 2026-10-26).
    - `it('viewing the stock and buying never touch the loot stream')` (Review Focus 2): `rng` and `uniqueRng` before and after `traderStock` and a `buyStock` are equal.
    - `it('a buy takes the price, copies the item into the first empty bag cell with a fresh id, and marks the slot')`: `gold` down by `4 × sellValue`, the bag item deep-equals the stock item but for `id === old nextId`, `merchant` is `{ band, bought: [index] }`, the drop log's newest entry has origin `{ kind: 'merchant' }` and trail `[{ event: 'bag' }]`, the loot filter (a `sell` catch-all) did not run; a second buy of the same index is `'sold'`.
    - `it('a new band brings a fresh stock with every slot')` (Review Focus 2): bought at `deepest` 419, `deepest = 420`: `boughtIn` is `[]`, `stockAt(state, index)` is defined and differs from the one bought.
    - `it('a refusal changes nothing')`: `noGold` (1 Gold short), `bagFull`, `invalid` (index 12, −1, 1.5): `state` deep-equals its clone.
    - `it('the store buys and bumps the version only on ok')`.
  - **`inventory.test.ts`:** `moveItem` from and to `'stock'`, `dropItem` onto it (gear, a gem, a material), `socketGem` into it, `sell`/`salvage`/`equip` from it are all `'invalid'`, and `canCraft` on it `'notGear'`, the state unchanged.
  - **`dragDrop.test.ts`:** `parseDrop('{"where":"stock","index":3}')` round-trips; index 12 gives null.
  - **`itemActions.test.ts`:** the stock card's single `buy` action and label; disabled when sold, short of Gold, or with a full bag; the hover notes.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Merchant: Brannoc the Trader sells 12 items rolled from the world seed, refreshed every 10 m dug, at 4× their sell value; a bought item leaves the stock until the next refresh (the view itself comes in Task 7).
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add src/core/trader.ts tests/core/trader.test.ts && git commit -am "Roll the Trader's stock from the world seed and the depth band, and let it be bought"`.

---

### Task 7: The Merchant view: two characters with portraits, the stock grid, and gambling under Old Mirela

**Files:**
- Create: `tests/sprites/portraits.test.ts`.
- Modify: `src/sprites/grids.ts`, `src/ui/merchant/MerchantView.tsx`, `src/ui/merchant/merchantView.ts`, `src/ui/merchant/merchant.css`, `README.md`.
- Test: `tests/sprites/portraits.test.ts`, `tests/ui/merchantView.test.ts`.

**Interfaces:**
- **`grids.ts`:** `SpriteName` gains `'brannoc' | 'mirela'`; two 16 × 24 grids per Decisions, from `PALETTE` letters (skin `n`, Brannoc's beard `w`/`W`, coat `m`/`M`, pack `l`; Mirela's hair `s`/`S`, shawl `v`/`d`, cane `k`), with `PALETTE_OVERRIDES` where a face needs a shade the palette lacks.
- **`merchantView.ts`:**
  - `MERCHANTS` per Decisions.
  - `stockCaption(state): string` → `New stock every 10 m dug · next at ${(band + 1) × 10} m` *(copy, from the mockup)*.
  - `interface StockTile { index: number; item: StockItem | null; name: string; tone: ReturnType<typeof rarityOf> | 'sold'; price: number; affordable: boolean; room: boolean }`; `stockTiles(state): StockTile[]` (a sold slot: `item: null`, `name: 'Sold'`, `tone: 'sold'`, `price` 0).
  - `buyLabel(price: number): string` → `Buy · 1,240 Gold` *(copy)*; `buyResultText(r: BuyResult): string | null` → `'sold'` → `That one is sold.` *(copy)*, `'noGold'` → `Not enough Gold.`, `'bagFull'` → `Your bag is full.`, `'invalid'` → `That can't be bought.` *(copy)*, `'ok'` → null.
  - `gambleSlots`, `gambleResultText`, `gambledLine` unchanged.
- **`MerchantView`:** the head (title `Merchants` *(copy)*, the Gold); a `gm-merchants` grid of two `section`s (`aria-label` the names): each with a `Sprite` portrait (scale 4, `label` the name), the name as `h3`, a caption (the Trader's `stockCaption`; Mirela's `Gamble: pick a slot, pay Gold, get a random item` *(copy, from the mockup)*). The Trader's `gm-stock` tiles: an `ItemButton` with target `{ where: 'stock', index }` (handlers from one `useItemInteractions` over the view, `useItemDrag` with the view's status line as `onResult`) or an `EmptyTarget` for a sold slot; the name line; the price; the Buy button (`data-buy={index}`, `aria-disabled` when unaffordable or without room, `disabled` when sold, `onClick` → `setRefused(store.buyStock(index))`). The status line below the tiles shows `buyResultText` while it still holds (as the gamble's refusal does). The cards (`cards`) render as the Inventory's do. Mirela's section holds today's slot groups, "You got" and status. The closing note stays: `The merchants never sell Diamonds or Souls. Selling items stays in their cards.` *(copy)*.
- **CSS:** `.gm-merchants { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px }` (one column under 900 px); `.gm-stock { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px }` (3 under 600 px); `.gm-stock__tile` a fixed-layout column (cell, name, price, button) that never changes height; `.gm-stock__name[data-tone='sold'] { color: var(--gm-muted); font-style: italic }`.

- [ ] **Step 1: Write the failing tests.**
  - **`portraits.test.ts`:** both grids are 24 rows of 16; every character is `.` or in their palette; they differ in at least 40 % of their cells; each uses at least 5 colours; the atlas test's `every grid is rectangular` covers them too.
  - **`merchantView.test.ts`:** `stockCaption` at 430 m reads `New stock every 10 m dug · next at 440 m`; `stockTiles` has 12 entries, a bought index as `{ item: null, name: 'Sold', tone: 'sold' }`, `affordable` false 1 Gold short, `room` false with a full bag; `buyLabel(1240)`; `buyResultText` for each result; `MERCHANTS.trader.name` is `Brannoc the Trader` and `MERCHANTS.gambler.name` is `Old Mirela`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it,** following the Plan 10 board's Merchant section.
- [ ] **Step 4: Update the README.** Merchant: the two characters, the Trader's stock grid with hover cards and Buy, Old Mirela's gambling.
- [ ] **Step 5: Run everything, then the click sweep.**
  - `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Build `/root/.claude/jobs/08d9b178/tmp/p10t7/save-stock.txt` with a vitest script like `…/p9t5/mksave.test.ts`: decode the schema-9 fixture with the new engine, end the run (`activity = { kind: 'dig' }`), free 20 bag cells, set Gold to 10,000,000, and write it with `encodeSave`.
  - Write `sweep-stock.mjs` from `…/p9t5/lib.mjs` (open the Merchant tab instead of Inventory): for each of the 12 tiles, click its Buy button at a fixed point 3 times: after the first, `elementFromPoint` is the same tile's Buy button, now disabled, and Gold fell once; then reload the save, right-click each tile's cell, click `Buy` in the action card: the card closes, the element under the pointer belongs to no card, and a second click there changes no Gold. Run at `1280x900` and `390x844`. Expected: `BAD 0`, `buttons<40px 0`; keep the logs under `p10t7/logs/`.
  - Screenshot both sizes: both portraits visible, the two columns (one at 390), a hover card on a stock tile comparing with the worn item.
- [ ] **Step 6: Commit.** `git add tests/sprites/portraits.test.ts && git commit -am "Show Brannoc the Trader with his stock and Old Mirela with her gambling in the Merchant view"`.

---

### Task 8: The loot filter's actions: stash, maps and materials, the held list and the log

**Files:**
- Modify: `src/core/loot.ts`, `src/core/lootFilter.ts` (`describeRule`), `src/ui/character/lootFilterView.ts`, `README.md`.
- Test: `tests/core/loot.test.ts`, `tests/core/dropLog.test.ts`, `tests/core/lootFilter.test.ts`.

**Interfaces:**
- **`loot.ts`:**
  - `lootAction(rules, item: Item): LootAction`: maps match now; a material matches only `keep` and `stash` rules (sell and salvage rules are skipped for it); `receiveMaterial` asks with a stack of the find (`{ id: 0, type: 'material', material, count }`).
  - `applyFilter(state, item: Loot): Fate | null`: `stash` → `stashFind(state, item): Fate | null`: gear to the General tab's first empty cell, a gem stack to the Gems tab (as much as the cap takes; the rest goes on as kept), a map to its tier (`putMap`); with no room, null (the find goes on to the bag). A stashed fate's note is `stash` and its step `{ event: 'filterStashed' }`.
  - `receiveMaterial(state, material, count, origin)`: `lootAction` first; `stash` → `stashMaterials` for the whole find, one note `stash` with the units stored, one entry with `filterStashed`; otherwise as today.
  - `drainOverflow`: materials now go through `applyFilter` too (`keep` or `stash` only).
- **`lootFilter.ts`:** `describeRule(rule): string` → `${Action} ${subject}`: the action word (`Keep`, `Sell`, `Salvage`, `Stash`), then the kind (`gear`, `gems`, `maps`, `materials`, `items`) qualified by its fields in this order: rarity (`rare gear`), set (`mining gear`), slot (`boots`, replacing `gear`), gem type and grade (`small rubies`), material (`Tin ore`), then comma-joined clauses: `item level 4 to 6` / `item level 4 or more` / `item level up to 6` (`tier …` for maps), `with a modifier at T3 or above`, `with 2 to 4 modifiers` / `with 3 or more modifiers` / `with up to 2 modifiers`, `with Hardened` (the map modifier kind's label). Examples: `Sell normal gear`, `Salvage magic mining gear`, `Keep gems`, `Stash rare gear, item level 4 or more, with a modifier at T3 or above`, `Stash maps, tier 5 to 8`, `Keep Tin ore`, `Stash items, with 5 or more modifiers`.
- **`lootFilterView.ts`:** `ACTION_OPTIONS` gains `{ value: 'stash', label: 'Stash in its tab' }` *(copy)*; `MAP_MOD_LABELS: Record<MapModKind, string>` (`Monster life`, `Monster damage`, `Monster speed`, `Boss power`, `Weak healing`, `Hardened`) for `describeRule` and Task 9.

- [ ] **Step 1: Write the failing tests.**
  - **`loot.test.ts`:**
    - `it('the loot filter can match a map')` (replaces `never matches a map`): `{ kind: 'map', rarity: 'normal', action: 'sell' }` sells a found normal tier-4 map for 400 Gold with a `filterSold` entry, and keeps a magic one; a migrated catch-all `{ kind: 'gear', action: 'sell' }, { kind: 'gem', action: 'sell' }` keeps a map (Review Focus 5).
    - `it('a stash rule sends each kind to its tab')`: gear → General's first empty cell with a `stash` note and a `filterStashed` step; a gem stack of 3 → the Gems tab count; a map → its tier list; a material find of 130 → the Materials tab, one note `stash` of 130; the bag unchanged in each case.
    - `it('a stash rule with no room lets the find go on to the bag')` (Review Focus 5): General full → the gear's note is `bag` and its trail `[bag]`; a full tier → the map to the bag; a gem at the Gems cap → the bag.
    - `it('sell and salvage rules never touch a material, and a material rule can only keep or stash')`: `{ kind: 'any', action: 'sell' }` leaves a material find in the bag; `{ kind: 'material', material: 'copper', action: 'stash' }` stashes Copper ore and leaves Tin ore in the bag.
    - `it('held finds follow stash rules too')`: a held map with a stash rule drains into its tier with a `filterStashed` step; a held material stack drains to the Materials tab.
  - **`dropLog.test.ts`:** a stashed find's entry: `[{ event: 'filterStashed' }]`; a material find stashed by the filter: one entry with `count 130` and the step `filterStashed`.
  - **`lootFilter.test.ts`:** `describeRule` for the seven examples above.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Gear: the loot filter paragraph: rules match on kind, slot, rarity, item level or tier, modifier tiers and counts, a map's modifiers, a gem's type and grade and a material's kind; they keep, sell, salvage or stash to the matching tab; maps match too; materials are only kept or stashed; the first matching rule wins and finds no rule matches go to the bag.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -am "Let loot rules stash finds in their tabs and match maps and materials"`.

---

### Task 9: The loot filter dialog, and the final browser check

**Files:**
- Modify: `src/ui/character/LootFilterDialog.tsx`, `src/ui/character/lootFilterView.ts`, `src/ui/character/character.css` (or the dialog's own rules in `app.css`, where `.gm-rule` lives), `README.md`.
- Test: `tests/ui/lootFilterView.test.ts`.

**Interfaces:**
- **`lootFilterView.ts`:**
  - `KIND_OPTIONS: { value: LootKind | 'any'; label }[]` (`Any item`, `Gear`, `Gems`, `Maps`, `Materials` *(copy)*); `ACTION_OPTIONS` (Task 8); `actionOptionsFor(kind): ACTION_OPTIONS` (materials: keep and stash only); `SET_OPTIONS`, `SLOT_OPTIONS` (with `Any` first), `RARITY_OPTIONS` (gear: four rarities; maps: three; `Any` first), `GEM_OPTIONS`, `GRADE_OPTIONS`, `MATERIAL_OPTIONS`, `MAP_MOD_OPTIONS` (from `MAP_MOD_LABELS`).
  - `type RuleField = 'set' | 'slot' | 'rarity' | 'level' | 'modTier' | 'mods' | 'mapMod' | 'gem' | 'grade' | 'material'`; `fieldsFor(kind: LootKind | 'any'): RuleField[]`: gear `[set, slot, rarity, level, modTier, mods]`; map `[rarity, level, modTier, mods, mapMod]`; gem `[gem, grade]`; material `[material]`; any `[rarity, level, modTier, mods]`.
  - `withKind(rule, kind): LootRule` keeps only the fields `fieldsFor(kind)` allows and the action when `actionOptionsFor(kind)` allows it (else `keep`).
  - `setRange(rule, field: 'level' | 'mods', end: 'min' | 'max', text: string): LootRule` (an empty or non-numeric text clears that end; a range with no ends is deleted).
  - `ruleProblems(rule): string[]` *(copy)*: `Materials can't be sold or salvaged.`, `Legendary doesn't apply to maps.`, `The low end is above the high end.` (one line per failing check; empty for a valid rule, and `ruleValid(rule)` is true exactly when it is empty).
  - `NEW_RULE: LootRule = { kind: 'gear', action: 'keep' }`.
  - `type RuleRow = LootRule | null` (null: a removed rule's empty row); `rowsOf(rules): RuleRow[]`; `rulesOf(rows): LootRule[]`; `removeRow(rows, i)` sets null; `moveRow(rows, i, delta)` swaps with the nearest non-null row in that direction (the same array when none); `addRow(rows)` appends `NEW_RULE` when `rulesOf(rows).length < MAX_LOOT_RULES`.
- **`LootFilterDialog`:** the head row (title `Loot filter`, `Add rule`, `Close`), the intro (`Rules run from the top for every find. The first rule that matches decides what happens to it. Finds no rule matches go to your bag. Worn gear is never touched.` *(copy)*), the list of rows (`gm-rule`: number, `describeRule` text or `Removed` *(copy)* in a muted row with no buttons, `Edit` (`Editing` and pressed on the open one), `✕`), then the editor (`gm-rule-editor`) for the selected row: the head row (`Rule N`, Kind select, Action select, `Move up`, `Move down`, `Save` (disabled while `ruleProblems` is non-empty), `Cancel`), the fields row from `fieldsFor` (selects; `level` and `mods` as two number inputs labelled `from`/`to` *(copy)*; `modTier` a number input), the problems under them. `Save` writes `store.setLootFilter(rulesOf(rows with the edit))`; `Add rule` appends and opens the new row; `✕` saves at once; moves save at once. Rows keep their `null`s until the dialog closes. Every control is at least 40 px tall.

- [ ] **Step 1: Write the failing tests.**
  - **`lootFilterView.test.ts`:** `fieldsFor` for every kind; `actionOptionsFor('material')` is keep and stash; `withKind({ kind: 'gear', slot: 'boots', action: 'sell' }, 'material')` is `{ kind: 'material', action: 'keep' }`; `withKind(…, 'any')` keeps `rarity` and drops `slot`; `setRange(rule, 'level', 'min', '4')` then `('max', '')` gives `level: { min: 4 }`, and clearing both deletes `level`; `ruleProblems` for the three cases and `[]` for a valid rule; `rowsOf`/`rulesOf` round-trip; `removeRow` leaves a null and the others in place; `moveRow` over a null row swaps with the next rule; `addRow` at 40 rules is the same array.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it,** following the Plan 10 board's loot filter section.
- [ ] **Step 4: Update the README.** Gear and Saves: the loot filter dialog edits one rule at a time; rules read as sentences.
- [ ] **Step 5: Run everything, then the sweeps and the final browser check.**
  - `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - `/root/.claude/jobs/08d9b178/tmp/p10t9/sweep-filter.mjs` (from `…/p9fix/sweep-held.mjs`): import the schema-9 fixture, open Inventory → `Loot filter`; at a fixed point on `Add rule`, click 6 times: the same button stays under the pointer and 6 rows were added; on row 2's `✕`, click 3 times: after the first, the element under the pointer is row 2's `Removed` row (no button) and the rule count fell by one only; open row 4's editor, at a fixed point on `Move up` click 6 times: the same button stays and the rule reached the top; change Kind with the keyboard and check `Save`'s rect is unchanged; close and reopen: no `Removed` rows. Run at `1280x900` and `390x844`. Expected: `BAD 0`, `buttons<40px 0`.
  - Final check (`/root/.claude/jobs/08d9b178/tmp/p10t9/check.mjs`, screenshots beside it), at 1280 × 900 and 390 × 844, a fresh context each, importing `tests/fixtures/save-schema-9.txt`:
    - the Nav shows the Run tab and the run continues; the header shows 74,317 Gold;
    - Inventory: hovering the worn Deepdelver shows `Every 25th metre is dug at once, and its find is doubled.` in the legendary colour; the loot filter dialog lists `Sell normal gear`, `Salvage magic mining gear`, `Keep gems`, `Keep legendary boots`, `Keep gear`, `Keep gems`; adding `Stash maps` and closing keeps it after a reload;
    - Merchant: both portraits and names; 12 tiles with prices; buying one lowers Gold by its price, puts it in the bag, and Log → Drops shows it from `Merchant`; the tile reads `Sold`; Mirela's gamble still works;
    - a map's card after enchanting a bag map with Copper repeatedly on a save with 10,000 Copper and Souls (`p10t9/save-special.txt`, where the script also sets one bag map's `special` to `treasureRoom`) shows `A treasure room before the boss` after its modifiers, and running it shows the line in the Run head;
    - the run ending shows the result dialog; nothing scrolls the page sideways at 390 px.
- [ ] **Step 6: Read the README** top to bottom against the game as built, and fix any sentence Plan 10 made stale.
- [ ] **Step 7: Commit.** `git commit -am "Edit loot rules in a rule editor that keeps every control under the pointer"`, then any README change: `git commit -am "Bring the README up to date with the merchants, the uniques, the specials and the loot filter"`.
