# Plan 12: Auto-mapping and ascension

**Goal:** Close the run. Once the miner hits the level cap, auto-mapping turns away-time into XP, and ascension turns a finished run into permanent progress.

- **Auto-mapping:** a passive-web notable unlocks it. The player queues maps; while away (offline catch-up), the miner runs them back-to-back up to a tier limit instead of digging, converting part of the offline cap into XP. The ascendancy tree extends the tier limit.
- **Ascension:** at level 60 the miner sacrifices everything (level, web, gear, bags, stash, resources, maps, depth) for **ascendancy points**, which scale with the deepest depth of the run. Points go into a small, permanent ascendancy tree that is never reset and makes later runs faster.

**Architecture:**

- **Ascendancy tree** is a second, smaller data-driven web in `ascendancy.ts`, mirroring `passives.ts`: one table of nodes, an effect union, and a `totals` fold. It is *not* cleared on ascension.
- **Auto-mapping** is a rule change read by name (like a keystone) on a new passive-web notable, plus a small `state.autoMap` queue. The run loop already handles maps, so auto-mapping is just a hook that starts the next queued map on an away tick.
- **Ascension** is one `ascend(state)` mutation plus a validator-safe migration. It rebuilds the run in place, keeping only `ascendancy`, `autoMap`, `lifetime`, `settings`, the world identity, and the RNG streams.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies.

**Spec:**
- `2026-10-23-golden-miner-revival-design.md` §4.4 (auto-mapping), §4.8 (ascension), §4.9 (pacing: auto-mapping ~level 30; cap ~day 5–6; a day of pushing depth past the cap).
- `2026-10-24-round-2-seeds-procedural-inventory-design.md` §3.4 (settings live in `state.settings`, kept across ascension).
- `2026-10-25-round-4-play-feedback-design.md` §8 (Plan 12 = auto-mapping and ascension).

**Builds on:** Plan 11 (`dev-ernest`). The level/XP machinery (`levels.ts`, `LEVEL_CAP = 60`), the map run loop (`combat.ts` `mapTick`/`endRun`, `dig.ts` `applyTicks`), the passive web (`passives.ts`, `respec.ts`, `SkillsView`/`Web.tsx`), the store (`gameStore.ts`) and the save validator are all in place.

**Roadmap:** this is plan 12 of 13. 11. the passive web · **12. auto-mapping and ascension** (this plan) · 13. balance and launch.

## Global Constraints

Same as Plan 11, plus:

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. Randomness comes from `state.rng` via `nextRandom`/`pickWeighted`. Ascension and auto-mapping change nothing about the loot stream except by *starting* maps (which draw the same stream a manual run would).
- **Ascension and auto-mapping never touch `state.rng` or `state.uniqueRng` directly.** Ascension keeps both streams; auto-mapping calls the existing `startMap`/`mapTick`. Allocating an ascendancy node or queueing a map leaves `state.rng` byte-identical.
- **Readable numbers:** every ascendancy bonus is an integer or a whole percent; the ascendancy-point formula is polynomial in depth.
- **No login pressure.** Ascendancy nodes are permanent and never refunded; auto-map queues never expire.
- **Saves:** `SCHEMA_VERSION = 12`; schemas 1–11 migrate. The fixtures `save-schema-1.txt` … `save-schema-10.txt` are never regenerated or edited; Task 1 adds `save-schema-11.txt`, generated from the Plan 11 engine before any Plan 12 change.
- Phones: the Ascension tree reuses `Web.tsx` (pan/zoom/search), and every control is ≥ 44 px.
- **Where things live:** tunable numbers in `src/core/balance.ts`; the ascendancy tree and its copy in `src/core/ascendancy.ts`; the auto-map logic in `src/core/autoMap.ts`; the ascend mutation in `src/core/ascend.ts`.
- No `!` non-null assertions in `src/`.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages with no attribution; never push (the owner pushes).

## Review Focus

1. **Old saves.** A schema-11 save loads with `ascendancy: { points: 0, allocated: [] }`, `autoMap: { queue: [] }`, `lifetime: { ascensions: 0, deepest: 0 }`, and everything else untouched. Task 1 tests this on the real fixture.
2. **Ascension keeps exactly what it should.** After `ascend`, `ascendancy`, `autoMap`, `lifetime`, `settings`, `seed`/`worldSeed`, and the RNG streams are unchanged; everything else is the fresh-run default (with the starting-depth and guaranteed-map rules applied). Task 4 tests field-by-field.
3. **Points and the tree are permanent.** Ascendancy points come only from ascending; nodes cost a point and can never be refunded. The passive web gains the ascendancy "extra points", so a save with more nodes than `level − 1` but within `level − 1 + extraPoints` stays valid. Task 2 and Task 5 test this.
4. **Auto-mapping runs only while away, only eligible tiers.** A queued map at or under the tier limit runs while `away` and the miner would otherwise dig; one over the limit is skipped, a stale id is dropped, and a manual run is never pre-empted. Task 3 tests each.
5. **The loot stream is untouched.** Queueing, allocating ascendancy nodes, and ascending all leave `state.rng`/`state.uniqueRng` unchanged. Task 3 and Task 5 pin this.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Schema | `SCHEMA_VERSION = 12`. `MIGRATIONS[11]` adds `ascendancy: { points: 0, allocated: [] }`, `autoMap: { queue: [] }`, `lifetime: { ascensions: 0, deepest: 0 }`. `newGame` sets the same. |
| Ascendancy state | `state.ascendancy = { points: number; allocated: string[] }` — unspent points and allocated node ids, permanent, never reset. |
| Lifetime | `state.lifetime = { ascensions: number; deepest: number }` — the count and the best depth across all runs, kept across ascension (the "lifetime statistics" of the spec; richer stats are Plan 13 polish). |
| Ascendancy effect | `AscendancyEffect = { kind: 'stat'; stat: StatKey; value: number } \| { kind: 'startingDepth'; value: number } \| { kind: 'passivePoints'; value: number } \| { kind: 'autoMapTier'; value: number }`. `ascendancyTotals(state)` → `{ stats: Record<StatKey, number>; startingDepth: number; passivePoints: number; autoMapTier: number }`. |
| Ascendancy fold | `deriveStats` adds `ascendancyTotals(state).stats` into the mining totals (all ascendancy stats are mining/meta — yield, find, offline cap). `pointsToSpend` adds `passivePoints`; `autoMapMaxTier` adds `autoMapTier`. |
| Ascendancy tree | A small web of **30 nodes** (1 start + 6 notables + 23 smalls) in six clusters radiating from the start: Wealth (gold/diamond yield), Depth (starting depth), Insight (passive points), Cartography (auto-map tier), Endurance (offline cap), Fortuna (find). Allocation follows the same adjacency rule as the passive web; there is no refund and no keystone. |
| Ascendancy points | `ascendancyPoints(deepest) = floor(sqrt(deepest / ASCEND_DEPTH_PER_POINT))`, `ASCEND_DEPTH_PER_POINT = 250` (≈ 3 points at 2500 m; Plan 13 tunes the constant). |
| Ascension trigger | Available only at `level >= LEVEL_CAP`. `ascend(state)` grants `ascendancyPoints(deepest)` and resets the run. |
| What ascension keeps | `ascendancy`, `autoMap`, `lifetime`, `settings`, `seed`, `worldSeed`, `worldGen`, `rng`, `uniqueRng`, `tickCount`, `lastTickAt`. |
| What ascension resets | `level` → 1, `xp` → 0, `passives.allocated` → `[]`, `equipped` → empty, `bag` → empty, `stash` → 2 empty general pages + empty gems/maps/materials, `gold`/`diamonds`/`souls` → 0, `deepest` → `startingDepth`, `progress` → 0, `ahead` → rerolled (with the guaranteed first map at `startingDepth + GUARANTEED_FIRST_MAP_METRE`), `finds` → `[]`, `nextId` → 1, `activity` → dig, `lastRun` → null, `mapTally`/`lootTally` → 0, `overflow` → `[]`, `drops`/`deaths` → `[]`, `merchant` → fresh, `paused` → false. |
| Auto-map unlock | A new passive-web notable **Surveyor** (hybrid side) with effect `{ kind: 'autoMap' }`. `autoMapping(state)` reads it. The web becomes 141 nodes (17 notables). |
| Auto-map state | `state.autoMap = { queue: number[] }` — queued map ids, oldest first. Queueing a map is the player's choice of which maps it may use. |
| Auto-map tier limit | `autoMapMaxTier(state) = AUTO_MAP_BASE_TIER + ascendancyTotals(state).autoMapTier`, `AUTO_MAP_BASE_TIER = 3`. |
| Auto-map run | In `applyTicks`, on an `away` tick where the miner would otherwise dig (not in a map, not paused, not held-up), `tryAutoMap(state)` takes the first queued id whose map exists and has `tier <= autoMapMaxTier`, starts it via `startMap`, removes the id from the queue, and the tick then runs `mapTick`. Stale ids (map gone) are dropped and the search continues; ineligible tiers are left queued. Runs only while `away`, so active play is never interrupted. |
| Auto-map store | `queueForAutoMap(id)`, `unqueueForAutoMap(id)` intents; both `changed()` only on a real change. |
| UI | An **Ascend** tab (after Skills). Before level 60 it shows the ascendancy tree read-only with "Reach level 60 to ascend."; at 60 it shows the ascend button with a point preview ("Deepest X m → N points") and the tree stays allocatable from points the player already holds. Ascendancy allocation reuses `Web.tsx`. A map's action card gains **Auto-map / Unqueue** actions. |

## Ascendancy tree (30 nodes)

The start ("Miner Reborn") is free and always allocated. Each cluster is a short radial chain; a cluster's notable sits at its far end. Small-node values are whole numbers or whole percents. (Coordinates are data, as in Plan 11; only the multiset below is pinned by a test.)

| Cluster | Notable | Small nodes (effect × count) |
|---|---|---|
| Wealth | Midas Touch (+25 % gold) | +10 % gold × 2, +10 % diamonds × 2 |
| Depth | Deep Roots (+50 m start) | +25 m start × 3 |
| Insight | Second Sight (+1 passive point) | +1 passive point × 2 |
| Cartography | Master Surveyor (+2 auto-map tier) | +1 auto-map tier × 2 |
| Endurance | Tireless (+2 h offline cap) | +30 min offline cap × 3 |
| Fortuna | Lucky Break (+10 % find) | +5 % find × 3 |

A "find" node grants `chestFind` + `gemFind` + `mapFind` together (three stat effects on one node). Totals: 1 start + 6 notables + 23 smalls = 30 nodes. Node ids are camelCase slugs (`minerReborn`, `midasTouch`, `wealthSmall1`, …); the start id is `ASCENDANCY_START_ID = 'minerReborn'`.

## File structure

```
src/core/
  ascendancy.ts    NEW  AscendancyNode, AscendancyEffect, ASCENDANCY_NODES, ASCENDANCY_NODE_BY_ID,
                         ascendancyPoints, ascendancyTotals, allocateAscendancy, canAllocateAscendancy
  autoMap.ts       NEW  autoMapping, autoMapMaxTier, tryAutoMap, queueForAutoMap, unqueueForAutoMap
  ascend.ts        NEW  ascend
  passives.ts      MOD  Surveyor notable + the autoMap effect variant + passiveTotals.autoMap
  respec.ts        MOD  (none — ascendancy allocation lives in ascendancy.ts)
  stats.ts         MOD  fold ascendancyTotals into mining stats
  types.ts         MOD  GameState.ascendancy, .autoMap, .lifetime
  newGame.ts       MOD  ascendancy/autoMap/lifetime defaults
  save.ts          MOD  SCHEMA_VERSION 12, MIGRATIONS[11], validators
  balance.ts       MOD  ASCEND_DEPTH_PER_POINT, AUTO_MAP_BASE_TIER
  dig.ts           MOD  the away auto-map hook in applyTicks
src/store/gameStore.ts   MOD  queueForAutoMap/unqueueForAutoMap/ascend/allocateAscendancy intents
src/ui/
  navView.ts       MOD  Ascend tab
  App.tsx          MOD  Ascension routing
  ascend/ascensionView.ts, AscensionView.tsx, ascend.css   NEW
  character/itemView.ts or run/runView.ts   MOD  map card auto-map actions
tests/
  core/ascendancy.test.ts, core/autoMap.test.ts, core/ascend.test.ts, core/save.test.ts (schema 12),
  core/passives.test.ts (web count), core/dig.test.ts (auto-map), store/gameStore.test.ts,
  ui/ascensionView.test.ts   NEW/MOD
  fixtures/save-schema-11.txt   NEW  exported from the Plan 11 game when this plan was written
```

---

### Task 1: Ascendancy, auto-map and lifetime state + save schema 12

**Files:** `src/core/types.ts`, `src/core/balance.ts`, `src/core/newGame.ts`, `src/core/save.ts`; add `tests/fixtures/save-schema-11.txt`; test `tests/core/save.test.ts`.

**Interfaces:**
- `types.ts`: `GameState` gains `ascendancy: { points: number; allocated: string[] }`, `autoMap: { queue: number[] }`, `lifetime: { ascensions: number; deepest: number }`.
- `balance.ts`: `ASCEND_DEPTH_PER_POINT = 250`, `AUTO_MAP_BASE_TIER = 3`.
- `newGame.ts`: the three defaults.
- `save.ts`: `SCHEMA_VERSION = 12`; `MIGRATIONS[11]` adds the three fields; `isAscendancy` (points is a non-negative int; `allocated` is unique known ids, not the start, connected — reusing the `isConnectedWeb` idea generalized over a node table), `isAutoMap` (queue is unique non-negative ints — map ids), `isLifetime` (two non-negative ints). `validateState` adds all three, and relaxes the passive-web ceiling to `level − 1 + ascendancyPassivePoints`.

**Key tests:** a schema-11 fixture loads with the three defaults and everything else untouched; a broken `ascendancy`/`autoMap`/`lifetime` decodes `invalid`.

**Step order:** write the failing tests → generate `save-schema-11.txt` from the Plan 11 engine first → implement → run `npx vitest run && npx tsc --noEmit` → commit `Add ascendancy, auto-map and lifetime state (schema 12)`.

---

### Task 2: The ascendancy tree and its fold into stats

**Files:** `src/core/ascendancy.ts`; `src/core/stats.ts`, `src/core/passives.ts` (`pointsToSpend`), `src/core/save.ts` (the relaxed ceiling). Test `tests/core/ascendancy.test.ts`, `tests/core/gearStats.test.ts`, `tests/core/passives.test.ts`.

**Interfaces:**
- `ascendancy.ts`: the node table and effect union per Decisions; `ascendancyPoints(deepest)`; `ascendancyTotals(state)`; `canAllocateAscendancy(state, id)`; `allocateAscendancy(state, id): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid'` (permanent, no refund).
- `stats.ts`: `deriveStats` folds `ascendancyTotals(state).stats` into the mining totals.
- `passives.ts`: `pointsToSpend(state)` = `max(0, level − 1 − allocated.length + ascendancyTotals(state).passivePoints)`.
- `save.ts`: the passive-web ceiling becomes `level − 1 + passivePoints` and the absolute cap `LEVEL_CAP − 1 + maxPassivePoints`.

**Key tests:** 30 nodes / 1 start / 6 notables / 23 smalls; an allocated gold-yield node raises `deriveStats().goldMultiplier`; a passive-points node raises `pointsToSpend` and makes a save with more nodes than `level − 1` valid; allocating costs a point and is permanent (a second allocate is `'allocated'`, there is no refund).

---

### Task 3: Auto-mapping

**Files:** `src/core/autoMap.ts`; `src/core/passives.ts` (Surveyor notable + `autoMap` effect + `passiveTotals.autoMap`), `src/core/dig.ts` (the away hook). Test `tests/core/autoMap.test.ts`, `tests/core/passives.test.ts`, `tests/core/dig.test.ts`.

**Interfaces:**
- `autoMap.ts`: `autoMapping(state)`, `autoMapMaxTier(state)`, `queueForAutoMap(state, id): 'ok' | 'alreadyQueued' | 'noSuchMap'`, `unqueueForAutoMap(state, id): 'ok' | 'notQueued'`, `tryAutoMap(state): boolean` (starts and dequeues the next eligible map; drops stale ids; skips over-tier maps; returns whether a map started).
- `passives.ts`: add `PassiveEffect` `{ kind: 'autoMap' }`; `passiveTotals` collects `autoMap: boolean`; the Surveyor notable. Web becomes 141 nodes.
- `dig.ts`: in `applyTicks`, in the dig branch, `if (away && tryAutoMap(state)) { mapTick(state, stats, events); state.tickCount += 1; continue; }` before `digFace`.

**Key tests:** queued eligible maps run back-to-back while away and digging stops; an over-tier map is skipped; a stale id is dropped; a manual run is not pre-empted; queueing/allocating leaves `state.rng` unchanged; the passive web counts update to 141/17/115.

---

### Task 4: The ascend action

**Files:** `src/core/ascend.ts`; `src/store/gameStore.ts`. Test `tests/core/ascend.test.ts`, `tests/store/gameStore.test.ts`.

**Interfaces:**
- `ascend.ts`: `ascend(state): 'ok' | 'notReady'`. On `'ok'`: `lifetime.ascensions += 1`, `lifetime.deepest = max(...)`, `ascendancy.points += ascendancyPoints(deepest)`, then reset per Decisions (starting depth and guaranteed first map included). Returns `'notReady'` unless `level >= LEVEL_CAP`.
- `gameStore.ts`: `ascend()` calls the core and `changed()` on success.

**Key tests:** a level-60 save ascends and the kept fields (ascendancy/autoMap/lifetime/settings/seed/worldSeed/rng/uniqueRng) are unchanged while the reset fields are fresh; a level-59 save is `'notReady'`; points granted match `ascendancyPoints(deepest)`; a second ascension keeps the first tree and accumulates points.

---

### Task 5: Ascendancy allocation intents and the store

**Files:** `src/store/gameStore.ts`, `src/core/ascendancy.ts`. Test `tests/store/gameStore.test.ts`, `tests/core/ascendancy.test.ts`.

**Interfaces:** `gameStore.allocateAscendancy(id)` and `gameStore.queueForAutoMap(id)` / `unqueueForAutoMap(id)` call the core and `changed()` on a real change.

**Key tests:** allocating persists across save/load; queueing a map persists and survives a reload; allocation leaves the RNG stream untouched.

---

### Task 6: The Ascend tab, the ascendancy tree view, and auto-map UI

**Files:** `src/ui/navView.ts`, `src/ui/App.tsx`, `src/ui/ascend/ascensionView.ts` (pure), `AscensionView.tsx`, `ascend.css`; `src/ui/character/itemView.ts` or `run/runView.ts` (map card actions); `README.md`. Test `tests/ui/ascensionView.test.ts`.

**Interfaces:**
- `navView.ts`: `View` gains `'ascend'`; a tab `Ascend` after Skills, `aria-disabled` (locked) before level 60.
- `ascensionView.ts` (pure): `ascendancyVMs(state)` (the tree as `Web`-shaped VMs), `ascendLine(state)` (`Ascend for N points` / `Reach level 60 to ascend`), `pointsPreview(state)` (`Deepest X m → N points`).
- `AscensionView.tsx`: reuses `Web.tsx` for the tree; the ascend button at the cap with a confirm; the points line.
- Map card: an **Auto-map** / **Unqueue** action when the Surveyor notable is allocated.
- README: a new paragraph for auto-mapping and ascension.

**Step order:** build the view against the pure VMs → `npx vitest run && npx tsc --noEmit && npx vite build` → browser check at 1280×900 and 390×844 → README → commit.

---

## Balance notes for Plan 13

Ascendancy node values and `ASCEND_DEPTH_PER_POINT` are my calls to make each ascension feel worth it without breaking the one-week first run. Plan 13 re-tunes them against a headless sim of a reference run, and must not break these invariants: an empty ascendancy tree changes nothing (all Plan 1–11 tests stay green); a fresh (never-ascended) save behaves exactly as Plan 11 left it; and each ascendancy point buys a noticeable but not compounding edge. `AUTO_MAP_BASE_TIER = 3` keeps auto-mapping gentle (tiers 1–2 are winnable without clicking; tier 3 is the first "hard" tier).
