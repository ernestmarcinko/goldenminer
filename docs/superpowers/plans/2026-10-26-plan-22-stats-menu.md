# Plan 22: The stats menu

**Goal:** Track every cumulative number the game already produces and show it on a lifetime Statistics screen. This is the owner's "every single thing should be tracked, since this is an incremental game" ask: total metres dug, time played / mining / in combat, ores found and traded (total and per ore), Gold found and spent, Diamonds and Souls found and spent, gems per type and grade, maps, kills, deaths, crafts, chests, levels, ascensions and achievements — the whole lifetime ledger.

- **Lifetime, across ascensions.** These counters describe the whole save, not one run. They live in a new `state.stats` object that `ascend()` never clears, exactly like `lifetime`. The per-run tallies (`lootTally`, `mapTally`) stay as they are; the lifetime view is a new layer that only accumulates.
- **Counters only.** The feature never changes the game: every hook is a side-effect increment placed *after* the draw or payment it counts, and it never reads or advances `state.rng`, so a save's loot and RNG stream are byte-identical with or without the stats.
- **Read-only UI.** A new Stats tab renders the counters with `formatNumber`/`formatDuration`; it never mutates state.

**Architecture:**

- **One store, one module.** The counter shape is `LifetimeStats`, declared in `src/core/types.ts` and added to `GameState` as `stats`. A pure `src/core/telemetry.ts` owns `emptyLifetimeStats()` and the small count helpers (`countOre`, `countGem`, `addTime`). No React, no DOM, no `Date.now()`, no `Math.random()`.
- **Time is split by its nature.** "Time played/away" is wall-clock and can only come from the store's clock, so it is accumulated in `advance` from the `nowMs` it already receives. "Time mining / in combat / idle" is simulated activity and is derived from the tick model in `applyTicks`, so it is deterministic and testable. Offline catch-up counts as *away*, never as *played*, so leaving a tab open can't inflate "time played".
- **Hooks are one-liners.** The increments ride on the existing event functions (`finishMetre`, `collect`, `receiveItem`, `receiveMaterial`, `sellFind`, `onKill`, `endRun`, `craft`, `gamble`, `buyStock`, `buyStashPage`, `refund`/`resetWeb`, `soulUpgrade`, `tradeOres`), each in the exact place the number is already produced. Nothing is recomputed or re-simulated.
- **Schema 15.** This is the last plan; achievements (Plan 20) already moved the schema to 14, so this plan is the single 14 → 15 bump, with a migration that adds an empty stats object and a validator `isLifetimeStats`.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. One schema bump (14 → 15).

**Spec:** main design §4 (progression) and §5 (screens); the owner's "track everything" intent; `2026-10-26-plan-20-achievements.md` (the `lifetime`-style carry-over pattern this mirrors) and `2026-10-26-plan-17-crafting-and-ore-economy.md` (the ore market, whose trades this counts).

**Builds on:** Plans 15–21 (`dev-ernest`), because it counts everything those systems produce — the level-100 XP/levels (15), the ore market's trades (17), the character stats (18), the ascendancy tree (19), the achievements' earned count (20), and the wiki's final system list (21).

**Roadmap:** this is the last plan, executed **after the wiki (Plan 21)**. 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · **22. the stats menu** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. Wall-clock time arrives as a parameter (`nowMs`), exactly as it already does in `advance`.
- **Counters never perturb the streams.** Every increment is a plain addition to `state.stats` placed after the event; none draws from `state.rng`/`uniqueRng`, so loot, drops, maps, veins and rolls are byte-identical with the stats stripped out. A test pins this.
- **No schema earlier than 15.** `SCHEMA_VERSION` is exactly 15, and the migration (14 → 15) adds `stats: emptyLifetimeStats()`; old saves load unchanged with every counter at zero.
- **Survives ascension.** `ascend()` leaves `state.stats` untouched, exactly as it leaves `lifetime`, `settings`, `ascendancy` and `autoMap`.
- **No `!` non-null assertions in `src/`.** Use the repo's existing `??`/narrowing style.
- **Unbounded but finite.** Counters are non-negative finite numbers (milliseconds for time, whole/`formatNumber` units for everything else); no cap, no overflow risk in practice, validated with `isNonNegFinite`.
- **No duplicated state.** Ascensions and achievements are *shown* from `lifetime.ascensions` and `achievements.earned.length` (Plan 20), not stored again.
- Phones: the Stats tab is re-checked at 390 × 844; rows stack, targets ≥ 44 px, and the Nav still fits with the extra tab.
- No new dependencies; full suite, typecheck and build stay green.
- Git: work on `dev-ernest`; explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **Coverage.** Every counter in the catalogue below exists, is hooked, and appears in the Stats tab; a test walks `MATERIALS`, `GEM_TYPES` and `GEM_GRADES` and asserts every per-ore and per-gem key is present.
2. **Purity.** A seeded dig/run produces byte-identical `state.rng` and `uniqueRng` with the stats hooks present vs absent; no `Date.now`/`Math.random`/`!` under `src/core`.
3. **Honest time.** Offline catch-up advances `timeAwayMs` but not `timePlayedMs`; `timeDiggingMs + timeCombatMs + timeIdleMs` equals the tick count × `1000 / autoTicksPerSecond` across a test run.
4. **Ascension & migration.** `ascend()` keeps `state.stats`; a schema-14 save loads to 15 with a zeroed stats object and plays; the validator rejects a malformed counter (missing key, negative, non-finite).
5. **Readable.** The Stats tab groups the counters into the catalogue's categories, numbers go through `formatNumber`, times through `formatDuration`, and the screen reads at 1280 × 900 and 390 × 844.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Where the counters live | A new top-level `state.stats: LifetimeStats`, **not** an extension of `lifetime`. `lifetime` is a two-field ascension record that `ascend()` touches every run; the counters are a large, append-only blob touched by a dozen systems. Keeping them apart means `ascend()` is untouched, the big validator (`isLifetimeStats`) is self-contained, and future counters are added to one object. |
| Naming | The runtime field is `state.stats`; its interface is `LifetimeStats`, distinct from the existing derived `Stats` (the per-frame dig/battle numbers in `GameStore._stats`). No name clash in code. |
| Time played / away | Wall-clock, accumulated in `src/core/clock.ts` `advance` from the `nowMs` parameter (never `Date.now()`): live elapsed adds to `timePlayedMs`, `away` elapsed to `timeAwayMs`. The store's existing `away = !live || elapsed > LONG_GAP_MS` already separates the two. |
| Time mining / combat / idle | Deterministic, tick-derived in `applyTicks`: each applied tick adds `1000 / autoTicksPerSecond` ms to the bucket for what that tick did (map → combat, dig → mining, paused/held → idle). No wall clock, reproducible from the seed. |
| "Metres dug" | Cumulative metres *finished*, not best depth: `finishMetre` adds 1 to `metresDug` per metre completed (instant metres included, since each is still one metre). `lifetime.deepest` stays the best-depth record. |
| Ores found vs traded | `oresFound[m]` counts material units dug up (the single choke point `receiveMaterial`, which covers veins, ore find, Golddigger and map material drops). `oresTraded[m]` counts units *received* through the ore market (`tradeOres`, Plan 17). The ore *spent* in a trade is not separately stored unless the owner asks. |
| Gold / Diamonds / Souls | Three lines each: found/earned, from-sales (Gold only), and spent. `goldFound` = veins + kills; `goldFromSales` = `sellFind`; `goldSpent` = gamble + stock + stash pages + refunds. `diamondsFound` = veins; `diamondsSpent` = reset web + diamond craft. `soulsEarned` = kills; `soulsSpent` = map craft + soul upgrade (the soul-debt death tax is "lost", not "spent", and is not counted). |
| Gems | `gemsFound: Record<GemType, Record<GemGrade, number>>`, incremented by units in `receiveItem` for `type === 'gem'`. Found gems only; socketed gems already counted at find time. |
| Duplicated values | `ascensions` and `achievementsEarned` are displayed from `lifetime.ascensions` and `achievements.earned.length` (Plan 20), never stored in `stats`. |
| Counter type | Finite non-negative numbers, milliseconds for the five time fields, whole numbers elsewhere; all required (default 0), so the validator is a flat `isNonNegFinite` walk — no optional fields. |
| UI | A dedicated **Stats** tab in the Nav (after Log and the Plan-20 Achievements tab), a read-only `StatsView` grouped by the catalogue's categories. Reuse `formatNumber` and `formatDuration`. No Settings section: the screen is too large to bury in Settings. |

## Tracked statistics catalogue

The complete grouped list. "Hook" names the function that increments; every increment is placed *after* the event and never draws from an RNG stream. "Shape" is the field's TypeScript type.

### Distance & time

| Counter | Shape | Hook (file · function) | Note |
|---|---|---|---|
| `metresDug` | `number` | `dig.ts · finishMetre` | +1 per metre completed, all ascensions (instant metres count as one). |
| `timePlayedMs` | `number` | `clock.ts · advance` | Wall-clock live elapsed only; offline/long-gap is *away*, not played. |
| `timeAwayMs` | `number` | `clock.ts · advance` | Wall-clock away/offline elapsed. |
| `timeDiggingMs` | `number` | `dig.ts · applyTicks` | Simulated dig time: dig ticks × `1000 / autoTicksPerSecond`. |
| `timeCombatMs` | `number` | `dig.ts · applyTicks` | Simulated combat time: map ticks (incl. auto-mapped) × dt. |
| `timeIdleMs` | `number` | `dig.ts · applyTicks` | Simulated idle: paused or held-loot ticks × dt. |

### Currency

| Counter | Shape | Hook (file · function) | Note |
|---|---|---|---|
| `goldFound` | `number` | `dig.ts · collect` (goldVein), `combat.ts · onKill` | Gold from veins and kills (the world's Gold). |
| `goldFromSales` | `number` | `loot.ts · sellFind` | Gold from every sale (filter, overflow, manual). |
| `goldSpent` | `number` | `merchant.ts · gamble`, `trader.ts · buyStock`, `stashPages.ts · buyStashPage`, `respec.ts · refund` | Every Gold payment. |
| `diamondsFound` | `number` | `dig.ts · collect` (diamondVein) | Diamonds from veins. |
| `diamondsSpent` | `number` | `respec.ts · resetWeb`, `crafting.ts · pay` (diamond) | Web reset + diamond craft. |
| `soulsEarned` | `number` | `combat.ts · onKill` | Souls from kills. |
| `soulsSpent` | `number` | `crafting.ts · craft` (map souls), `soulUpgrade.ts` | Map enchant + soul upgrade. |

### Finds

| Counter | Shape | Hook (file · function) | Note |
|---|---|---|---|
| `oresFound` | `Record<Material, number>` | `loot.ts · receiveMaterial` | Units of each ore dug/found (veins, ore find, Golddigger, map material drops). |
| `oresTraded` | `Record<Material, number>` | `oreMarket.ts · tradeOres` | Units of each ore received via the market (Plan 17). |
| `gemsFound` | `Record<GemType, Record<GemGrade, number>>` | `loot.ts · receiveItem` (gem) | Gems by type + grade, in units. |
| `chestsOpened` | `number` | `dig.ts · collect` (chest), `combat.ts · strike` (treasure room) | Each `rollChest` is one chest. |
| `mapsFound` | `number` | `maps.ts · addMap` | Maps dug up. |

### Combat & runs

| Counter | Shape | Hook (file · function) | Note |
|---|---|---|---|
| `monstersKilled` | `number` | `combat.ts · onKill` | Every kill, any rank. |
| `championKills` | `number` | `combat.ts · onKill` (rank `champion`) | Champions. |
| `bossKills` | `number` | `combat.ts · onKill` (rank `boss`) | Bosses. |
| `deaths` | `number` | `combat.ts · endRun` (`died`) | Deaths (parallels the death log's lifetime total). |
| `mapsCleared` | `number` | `combat.ts · endRun` (`cleared`) | Lifetime maps cleared. |
| `mapsLost` | `number` | `combat.ts · endRun` (`died`/`left`) | Lifetime maps lost (a `left` map is spent, so it counts lost, as `mapTally` does). |

### Progression & items

| Counter | Shape | Hook (file · function) | Note |
|---|---|---|---|
| `levelsGained` | `number` | `combat.ts · onKill` (after `gainXp`) | Total levels gained across ascensions. |
| `itemsCrafted` | `number` | `crafting.ts · craft` (`ok`) | Successful gear crafts and map enchants. |
| `itemsKept` | `number` | `loot.ts · tally` | Lifetime items kept (found path). |
| `itemsSold` | `number` | `loot.ts · tally`, `inventory.ts · sell` | Lifetime items sold (auto + manual). |
| `itemsSalvaged` | `number` | `loot.ts · tally`, `inventory.ts · salvage` | Lifetime items salvaged (auto + manual). |
| `ascensions` | *(shown)* | `lifetime.ascensions` | Displayed, not stored in `stats`. |
| `achievementsEarned` | *(shown)* | `achievements.earned.length` (Plan 20) | Displayed, not stored in `stats`. |

## File structure

```
src/core/
  types.ts        MOD  LifetimeStats interface; GameState.stats: LifetimeStats
  telemetry.ts    NEW  emptyLifetimeStats(), countOre, countGem, addTime helpers
  newGame.ts      MOD  init stats: emptyLifetimeStats()
  ascend.ts       MOD  keep stats across the reset (assert; no other change)
  clock.ts        MOD  timePlayedMs / timeAwayMs in advance (from nowMs)
  dig.ts          MOD  metresDug; timeDiggingMs/timeCombatMs/timeIdleMs; goldFound, diamondsFound, chestsOpened
  loot.ts         MOD  oresFound (receiveMaterial); gemsFound (receiveItem); goldFromSales (sellFind); itemsKept/Sold/Salvaged (tally)
  combat.ts       MOD  monstersKilled, championKills, bossKills, deaths, mapsCleared/Lost, goldFound, soulsEarned, levelsGained, chestsOpened (treasure room)
  maps.ts         MOD  mapsFound (addMap)
  merchant.ts     MOD  goldSpent (gamble)
  trader.ts       MOD  goldSpent (buyStock)
  stashPages.ts   MOD  goldSpent (buyStashPage)
  respec.ts       MOD  goldSpent (refund), diamondsSpent (resetWeb)
  crafting.ts     MOD  itemsCrafted, soulsSpent (map), diamondsSpent (diamond)
  soulUpgrade.ts  MOD  soulsSpent
  oreMarket.ts    MOD  oresTraded (tradeOres)   [Plan 17 file]
  save.ts         MOD  SCHEMA_VERSION 15; MIGRATIONS[14]; isLifetimeStats
src/ui/
  stats/
    statsView.ts  NEW  StatsVM (grouped rows from state.stats + lifetime/achievements)
    StatsView.tsx NEW  the read-only tab, formatNumber/formatDuration
    stats.css     NEW  the grouped layout
  Nav.tsx         MOD  render the Stats tab
  navView.ts      MOD  View gains 'stats'; navTabs gains the tab
tests/
  core/telemetry.test.ts  NEW  empty shape; per-material/gem key coverage; purity (rng byte-identical)
  core/save.test.ts       MOD  schema-14 → 15 migration; validator rejects malformed counters
  ui/statsView.test.ts    NEW  the VM groups every counter
```

---

### Task 1: The `LifetimeStats` shape and the empty state

**Files:** `src/core/types.ts`, `src/core/telemetry.ts`, `src/core/newGame.ts`; test `tests/core/telemetry.test.ts`.

**Interfaces:**
- `interface LifetimeStats` in `types.ts`: the catalogue fields exactly — `metresDug`, `timePlayedMs`, `timeAwayMs`, `timeDiggingMs`, `timeCombatMs`, `timeIdleMs`, `goldFound`, `goldFromSales`, `goldSpent`, `diamondsFound`, `diamondsSpent`, `soulsEarned`, `soulsSpent`, `oresFound: Record<Material, number>`, `oresTraded: Record<Material, number>`, `gemsFound: Record<GemType, Record<GemGrade, number>>`, `chestsOpened`, `mapsFound`, `monstersKilled`, `championKills`, `bossKills`, `deaths`, `mapsCleared`, `mapsLost`, `levelsGained`, `itemsCrafted`, `itemsKept`, `itemsSold`, `itemsSalvaged`.
- `GameState` gains `stats: LifetimeStats`.
- `telemetry.ts`: `emptyLifetimeStats(): LifetimeStats` — every scalar `0`, `oresFound`/`oresTraded` keyed over `MATERIALS` at `0`, `gemsFound` keyed over `GEM_TYPES` × `GEM_GRADES` at `0`. Plus the increment helpers: `countOre(stats, m, n)`, `countGem(stats, gem, grade, n)`, `addTime(stats, key, ms)` (thin, so hooks stay one-liners and the RNG stream is untouched).
- `newGame.ts` initialises `stats: emptyLifetimeStats()`.

**Tests:** `emptyLifetimeStats()` has exactly the `MATERIALS` keys in `oresFound`/`oresTraded` and the `GEM_TYPES` × `GEM_GRADES` keys in `gemsFound`; every scalar is `0`; `newGame` produces a valid stats object.

**Step order:** write the shape-coverage tests → the interface + helpers → `newGame` → commit `Add the lifetime stats shape`.

---

### Task 2: Time tracking (played/away, mining/combat/idle)

**Files:** `src/core/clock.ts`, `src/core/dig.ts`; tests `tests/core/telemetry.test.ts`.

**Interfaces:**
- `advance(state, nowMs, stats, events, digPaused, away)` gains, right after the `elapsed < 0` guard and before any early return: `state.stats.timePlayedMs += away ? 0 : elapsed` and `state.stats.timeAwayMs += away ? elapsed : 0`. `nowMs` is already a parameter, so nothing in core reads `Date.now()`.
- `applyTicks` computes `dtMs = 1000 / stats.autoTicksPerSecond` (guarding 0/non-finite) and, per applied tick, adds `dtMs` to `timeCombatMs` for a map tick (including away auto-mapping), `timeDiggingMs` for a dig tick, and `timeIdleMs` for a paused/held tick that digs nothing.

**Tests:** a seeded `advance` with `away = false` adds the elapsed to `timePlayedMs`; `away = true` adds it to `timeAwayMs` instead; a run of N ticks splits into buckets such that `timeDiggingMs + timeCombatMs + timeIdleMs === N × dtMs` (within float tolerance); a zero-`autoTicksPerSecond` state still accumulates played time.

**Step order:** the time tests → the `advance` and `applyTicks` increments → commit `Track played, away and activity time`.

---

### Task 3: The counter hooks

**Files:** `src/core/dig.ts`, `loot.ts`, `combat.ts`, `maps.ts`, `merchant.ts`, `trader.ts`, `stashPages.ts`, `respec.ts`, `crafting.ts`, `soulUpgrade.ts`, `oreMarket.ts`; tests `tests/core/telemetry.test.ts`.

**Interfaces:** the one-line increments from the catalogue, each placed after the event that produces the number:
- `dig.ts`: `metresDug += 1` in `finishMetre`; `goldFound += amount` / `diamondsFound += amount` in `collect`; `chestsOpened += 1` on the `chest` feature.
- `loot.ts`: `oresFound[m] += count` at the top of `receiveMaterial`; `gemsFound[gem][grade] += unitsOf(item)` for a gem in `receiveItem`; `goldFromSales += value` in `sellFind`; `itemsKept/Sold/Salvaged` in `tally`.
- `combat.ts`: `monstersKilled`, `championKills`, `bossKills`, `goldFound`, `soulsEarned`, `levelsGained` in `onKill`; `deaths`, `mapsCleared`, `mapsLost` in `endRun`; `chestsOpened += TREASURE_CHESTS` in the treasure-room branch.
- `maps.ts`: `mapsFound += 1` in `addMap`.
- `merchant.ts`/`trader.ts`/`stashPages.ts`/`respec.ts`: `goldSpent += price` on each Gold payment; `respec.ts` also `diamondsSpent += RESET_WEB_DIAMONDS` on reset.
- `crafting.ts`: `itemsCrafted += 1` on an `ok` craft/enchant; `soulsSpent += mapCraftSouls` for maps; `diamondsSpent += cost` when paying Diamonds.
- `soulUpgrade.ts`: `soulsSpent += cost`.
- `inventory.ts`: `itemsSold` / `itemsSalvaged` on the manual `sell`/`salvage` paths (they currently bypass `lootTally`, so they must increment the lifetime counters directly).
- `oreMarket.ts`: `oresTraded[to] += amount` on a successful `tradeOres`.

**Tests:** a seeded dig into a gold vein bumps `goldFound` and `metresDug`; a kill bumps `monstersKilled`/`bossKills`/`soulsEarned`/`goldFound`; a found material bumps the right `oresFound` key; a market trade bumps `oresTraded[to]`. **Purity:** the same seeded run with the hooks compiled out (or with `stats` stripped before compare) yields a byte-identical `state.rng`/`uniqueRng`.

**Step order:** write the counter + purity tests → add the increments file by file → commit `Count everything the game produces`.

---

### Task 4: Schema 15, migration and validator

**Files:** `src/core/save.ts`; test `tests/core/save.test.ts`.

**Interfaces:**
- `SCHEMA_VERSION = 15`.
- `MIGRATIONS[14] = (state) => isObject(state) ? { ...state, stats: emptyLifetimeStats() } : state` — a zeroed stats object; no back-filling (keep the migration trivial, as Plan 20 did).
- `isLifetimeStats(x)`: every scalar is `isNonNegFinite`; `oresFound`/`oresTraded` have exactly the `MATERIALS` keys with non-negative finite values; `gemsFound` has exactly `GEM_TYPES` each with exactly `GEM_GRADES` non-negative finite values. Wire it into `validateState`.

**Tests:** a schema-14 save loads to 15 with a zeroed `stats` and plays; a schema-15 save round-trips; a malformed `stats` (missing key, negative, non-finite, extra key) is refused.

**Step order:** write the migration/validator tests → the migration + validator → commit `Migrate saves to schema 15 with a lifetime stats object`.

---

### Task 5: The Stats tab

**Files:** `src/ui/stats/statsView.ts`, `StatsView.tsx`, `stats.css`; `src/ui/Nav.tsx`, `navView.ts`; test `tests/ui/statsView.test.ts`.

**Interfaces:**
- `navView.ts`: `View` gains `'stats'`; `navTabs` appends `{ view: 'stats', label: 'Stats' }` (after Log/Achievements).
- `statsView.ts`: a `StatsVM` with one group per catalogue category (Distance & time, Currency, Finds, Combat & runs, Progression & items), each group a list of `{ label, value }` where scalars go through `formatNumber`, the five time fields through `formatDuration`, and `ascensions`/`achievementsEarned` are pulled from `lifetime.ascensions` and `achievements.earned.length`. Per-ore and per-gem counters become one row each, labelled by `MATERIAL_LABELS` and the gem type/grade labels.
- `StatsView.tsx`: a read-only panel rendering the groups; no store mutation.
- `App.tsx`: render `<StatsView store={store} />` for `shown === 'stats'`.

**Tests:** the VM groups every catalogue counter; the per-ore/per-gem rows are present for every `MATERIALS`/`GEM_TYPES` entry; the tab is reachable via the Nav.

**Step order:** the VM + tests → the view + CSS → the Nav/App wiring → commit `Show the lifetime stats`.

---

### Task 6: Final QA

**Checks:** `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`. Confirm the purity test (byte-identical RNG), a schema-14 save migrating and playing, ascension preserving `state.stats`, and the Stats tab at 1280 × 900 and 390 × 844 (Nav still fits, rows stack, targets ≥ 44 px). A `grep` for `Date.now`/`Math.random`/`!` under `src/core` and `src/ui/stats` returns nothing new.

**Commit:** `Finish the stats menu`.

---

## Definition of done

- `state.stats: LifetimeStats` tracks every counter in the catalogue, survives ascension, and is counted by side-effect hooks that never perturb the RNG/loot stream.
- Time is honest: played/away is wall-clock from `nowMs`, mining/combat/idle is tick-derived; offline catch-up never inflates "time played".
- `SCHEMA_VERSION` is 15 with a tested `MIGRATIONS[14]` and `isLifetimeStats`; a schema-14 save loads unchanged.
- The Stats tab groups the counters into the five catalogue categories and renders them with `formatNumber`/`formatDuration`; it reads at both widths.
- Full suite, typecheck and build are green; no new dependency; no `!` assertions in `src/`; nothing pushed.
