# Plan 33: Gate tiers, map drops from clears, uncapped auto-mapping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the round 5a mechanics that don't depend on tuning: auto-mapping with no tier cap, maps dropping from map clears, and gate tiers (every 5th tier, physical or elemental wall) shown on the map card. Strength numbers stay as they are; Plan 35 tunes them.

**Architecture:** A new pure module `src/core/gates.ts` answers "is this tier a gate, and what wall does it test" from `(seed, tier)`. `dungeons.ts` and `monsters.ts` read it to bias a gate map's dungeon and force its monsters' damage type. The boss kill in `combat.ts` rolls one map drop. `autoMapRule.ts` loses its tier limit, and the Cartography ascendancy nodes swap their tier effect for queue size.

**Tech Stack:** TypeScript 7, Vite 8, React 19, Vitest 5 (unchanged, no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md` (§4.2 past-100 clamps, §4.3, §4.5, §5).

**Roadmap:** **33. gates, map drops, auto-map** (this plan) · 34. achievements overhaul · 35. difficulty curve, reference sim and balance tests.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM, `Date.now()` or `Math.random()`.
- No `!` non-null assertions in `src/`.
- World features are pure functions of `(seed, position)` with their own salt (`hashN(seed, SALT_…, …)`, as in `dungeons.ts`); they never read `state.rng`.
- `seedFromText` output is part of the save contract: never change the hash.
- Save schema: bump `SCHEMA_VERSION` 23 → 24 in Task 3 (the only task that changes saved shapes), with a migration and a `save.test.ts` round-trip.
- Changing loot draws re-pins tests that pin `state.rng` values; re-pin them in the same task and say so in the commit body.
- No Claude/Anthropic attribution in commits.
- Full suite (`npx vitest run`), `npx tsc --noEmit -p .` and `npx vite build` green at the end of every task.

## Review Focus

1. **A gate tier never moves.** The same world seed always shows the same gates and wall types, before and after a reload, in the map card, in the dungeon and in combat.
2. **Old saves with tier-capped queues.** A schema-23 save whose queue holds maps above the old cap starts them in order after loading, and the "Up to tier N" label is gone.
3. **Map drops at a full bag/stash.** A boss map drop with the bag and the tier's Map stash list full follows the normal held/sold routing (`receiveItem`); it is never lost silently and never crashes.
4. **Tier 1 map clears.** A tier-1 clear never drops a tier-0 map.
5. **The Cartography nodes.** A save with points in "Auto-map Tier" nodes keeps them allocated; the tree shows the new "+10 auto-map queue" text; `ascendancyTotals` no longer has `autoMapTier`.

---

### Task 1: Uncapped auto-mapping

**Files:**
- Modify: `src/core/autoMapRule.ts`, `src/core/autoMap.ts` (`tryAutoMap`), `src/core/balance.ts` (drop `AUTO_MAP_BASE_TIER`), `src/core/ascendancy.ts` (Cartography smalls, `masterSurveyor`, `worldAtlas`, `AscendancyEffect`, `ascendancyTotals`), `src/core/sim.ts` (`queueStashedMaps`), `src/core/skillIcons.ts` (`autoMapTier` glyph key), `src/ui/ascend/ascensionView.ts`, `src/ui/battle/BattleView.tsx`
- Test: `tests/core/autoMap.test.ts`, `tests/core/ascendancy.test.ts`

**Interfaces:**
- Removes: `autoMapMaxTier`, `AUTO_MAP_BASE_TIER`, the `autoMapTier` effect kind and the `autoMapTier` field of `ascendancyTotals`.
- Keeps: `nextEligibleAutoMap(state): MapItem | undefined` (now the queue's first map), `autoMapQueueSize`, `autoMapContinues`.

- [ ] **Step 1: Write the failing tests** in `tests/core/autoMap.test.ts`:
  - `it('auto-mapping starts a queued tier-40 map with no ascendancy points')`: a state with Surveyor allocated, `autoMap.on = true`, one tier-40 map queued → `tryAutoMap(state)` is `true` and `state.activity.kind === 'map'` with `run.map.tier === 40`.
  - `it('the queue runs oldest first whatever the tier')`: queue tiers `[30, 2, 9]` → `nextEligibleAutoMap(state)?.tier === 30`.
  - Replace the old tier-cap tests (`autoMap.test.ts:39` and the "over-tier maps stay queued" cases) with these.
  - In `tests/core/ascendancy.test.ts`, replace the `autoMapTier` assertions (lines 55–56, 215–230) with: every Cartography small has exactly `[{ kind: 'autoMapQueue', value: 10 }]` and the name `'Auto-map Queue'`; `masterSurveyor.effects` equals `[{ kind: 'autoMapQueue', value: 20 }]`; `worldAtlas.effects` equals `[{ kind: 'autoMapQueue', value: 50 }]`; `ascendancyTotals(newGame(1, 0))` equals `{ stats: {}, startingDepth: 0, passivePoints: 0, autoMapQueue: 0 }`.
- [ ] **Step 2: Run** `npx vitest run tests/core/autoMap.test.ts tests/core/ascendancy.test.ts`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.**
  - Remove the tier limit everywhere listed above.
  - Rename the eight Cartography smalls to `'Auto-map Queue'` with `autoMapQueue(10)`.
  - Set the descriptions to `'+20 auto-map queue.'` / `'+50 auto-map queue.'`.
  - `tryAutoMap` starts the queue's first map; when the queue is empty it switches the chain off as today.
  - In `BattleView`, drop the "Up to tier" span.
  - In `skillIcons.ts`, keep the glyph art but drop the `autoMapTier` effect key from its union and map if nothing else uses it.
- [ ] **Step 4: Run** the same tests, then the full suite and typecheck. Expected: PASS. Node ids don't change, so allocated saves still validate.
- [ ] **Step 5: Commit** `Remove the auto-mapping tier cap`.

### Task 2: Gate tiers in the world

**Files:**
- Create: `src/core/gates.ts`
- Modify: `src/core/dungeons.ts` (`dungeonType`), `src/core/monsters.ts` (`monsterState`), `src/core/maps.ts` (`startMap`, line 70) and `src/core/combat.ts` (the next-room builder, line 49), `src/core/balance.ts` (`GATE_EVERY = 5`, raise `MAX_LIFE` / `MAX_DAMAGE` to `1e12`), `src/ui/character/itemView.ts` (`mapLines`), `src/wiki/` (the maps page: one paragraph on gates)
- Test: `tests/core/gates.test.ts` (new), `tests/core/dungeons.test.ts`, `tests/core/combat.test.ts` (the `monsterState` cases), `tests/ui/itemView.test.ts`

**Interfaces:**
- Produces (in `src/core/gates.ts`):
  - `export type Wall = Element` (i.e. `'physical' | 'elemental'`)
  - `export function isGateTier(tier: number): boolean`: `tier >= GATE_EVERY && tier % GATE_EVERY === 0`
  - `export function gateIndex(tier: number): number`: `tier / GATE_EVERY` for a gate, else 0
  - `export function gateWall(seed: number, tier: number): Wall | undefined`: undefined off-gate
- Changes: `monsterState(tier, lm, fx = NO_MAP_EFFECTS, wall?: Wall)`. When `wall` is set, the monster's `element` is `wall`, except that a `fireTouched` champion stays `'elemental'`. Both callers pass `gateWall(state.seed, map.tier)`.
- `dungeonType(seed, tier, index).bias` equals `gateWall(seed, tier)` on a gate tier.

`gateWall` algorithm (pin it exactly):
```ts
const g = gateIndex(tier);                     // 1, 2, 3 … for tiers 5, 10, 15 …
const pair = Math.floor((g - 1) / 2);          // gates (5,10), (15,20), … form pairs
const swapped = (hashN(seed, SALT_GATE, pair) & 1) === 1;   // SALT_GATE = 0x6a7e
const first = g % 2 === 1;                      // 5, 15, 25 … are the first of their pair
return (first !== swapped) ? 'physical' : 'elemental';
```

- [ ] **Step 1: Write the failing tests** (`tests/core/gates.test.ts`):
  - `isGateTier`: true for 5, 10, 50, 100, 105; false for 0, 1, 4, 6, 99.
  - `gateWall(seed, 7)` is `undefined`.
  - Over seeds 1..200, each pair (5,10) and (15,20) always has one physical and one elemental gate. At least one seed gives 5 = physical and at least one gives 5 = elemental.
  - `gateWall(seedFromText('amber-fox-427'), 5)`: pin the value the implementation returns (determinism guard).
  - `dungeons.test.ts`: for seeds 1..50 and indices 0–2, `dungeonType(seed, 10, i).bias === gateWall(seed, 10)`. Non-gate tiers keep their old bias (pin one existing value).
  - Monster test: `monsterState(10, lm, NO_MAP_EFFECTS, 'elemental').element === 'elemental'` for a physical species; `'physical'` with `wall = 'physical'` for a non-champion of an elemental species; a `fireTouched` champion with `wall = 'physical'` stays `'elemental'`.
  - Item card: a tier-10 map's lines include `"Gate tier: physical wall. Monsters hit hard; armour matters most."` or `"Gate tier: elemental wall. Most damage is elemental; resistances matter most."` (exact copy), placed before the mod lines. A tier-9 map has neither line.
- [ ] **Step 2: Run** the new and changed test files. Expected: FAIL (`gates.ts` missing).
- [ ] **Step 3: Implement `gates.ts`** and wire it into `dungeonType`, `monsterState` and `startMap`. Add the card line in `mapLines` with tone `'plain'`, and the wiki paragraph. Raise `MAX_LIFE` / `MAX_DAMAGE` to `1e12`; the save checks import them, so they follow. Check `formatNumber` handles 1e12 compactly, and add one `format` test if it doesn't.
- [ ] **Step 4: Run** the full suite. Expected: PASS. Existing dungeon/monster tests at tiers 5/10/15… may need re-pinning; re-pin and note it in the commit body.
- [ ] **Step 5: Commit** `Add gate tiers with physical and elemental walls`.

### Task 3: Maps drop from map clears

**Files:**
- Modify: `src/core/combat.ts` (`onKill`), `src/core/maps.ts` (a `dropMap` helper beside `addMap`), `src/core/balance.ts`, `src/core/types.ts` (`LifetimeStats.mapsFromClears`), `src/core/save.ts` (schema 24 + migration + validator), `src/ui/stats/statsView.ts` (one Stats row)
- Test: `tests/core/combat.test.ts`, `tests/core/save.test.ts`

**Interfaces:**
- Produces:
  - `export function dropMap(state: GameState, tier: number, metre: number, origin: DropOrigin): LootNote[]` in `maps.ts`. It creates a normal map (as `addMap` does), counts `stats.mapsFound` **and** `stats.mapsFromClears`, and routes it through `receiveItem` with the map-run origin.
  - balance: `MAP_CLEAR_DROP_CHANCE = 0.75` and `MAP_CLEAR_TIER_WEIGHTS: readonly (readonly [number, number])[] = [[-1, 25], [0, 50], [1, 25]]` (offset, weight) for `pickWeighted`.
- Rule (spec §4.5):
  - A **boss** kill rolls one map drop, after the boss legendary (the last draw today), with chance `min(1, MAP_CLEAR_DROP_CHANCE × mapFindMultiplier)`. `mapFindMultiplier` is the same `pct(g.mapFind)` the dig uses (`stats.ts:93`); expose it from `stats.ts` if it isn't reachable.
  - The drop's tier is `max(1, map.tier + offset)`, with the offset picked by `pickWeighted` from `MAP_CLEAR_TIER_WEIGHTS`. Then apply the same Cartographer/Prospector's Eye adjustment as `dig.ts`'s `mapTier`: move that helper to `maps.ts` and export it.
  - The new map's `metre` is the run map's `metre`.

- [ ] **Step 1: Write the failing tests:**
  - With `state.rng` pinned so the drop roll passes, a boss kill in a tier-7 run adds one map of tier 6, 7 or 8 to the bag, and `stats.mapsFromClears === 1`.
  - Over 2,000 seeded boss kills at tier 7, the share of tier 6 / 7 / 8 maps is within ±3 points of 25 / 50 / 25, and the drop rate is within ±3 points of 75%.
  - A tier-1 boss never drops a tier-0 map; the offset −1 gives tier 1.
  - With the bag and the tier-7 Map stash list full, the drop is held or sold as `receiveItem` decides, and appears in the run's loot notes.
  - A normal or champion kill never drops a map.
  - `save.test.ts`: a schema-23 save migrates to 24 with `stats.mapsFromClears === 0`; a schema-24 save round-trips; `SCHEMA_VERSION === 24`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `dropMap`, the boss roll, the constants, the ledger field (migration 23: add `mapsFromClears: 0`; validator: non-negative int), and the Stats row "Maps from clears".
- [ ] **Step 4: Run** the full suite. Expected: PASS after re-pinning any test that pins the rng after a boss kill. List the re-pinned tests in the commit body.
- [ ] **Step 5: Commit** `Drop maps from map clears`.
