# Plan 34: Achievements overhaul (~800: ladders, feats, collections, hidden)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's 529 counter-only achievements with about 800 that are much harder to earn: reworked counter ladders with no near-free first steps, plus feats, collections and hidden achievements. Each keeps the +1% boost.

**Architecture:** `AchievementDef` gains a `kind`.
- Ladders stay generated from `FamilyDef` thresholds and are checked by `checkAchievements(state, family)` as today.
- Collections are ladders over the size of new "seen at least once" sets in the lifetime ledger.
- Feats and hidden achievements are hand-written predicates over a small `FeatEvent` union. A new `checkFeats(state, event)` evaluates them at a fixed set of hook sites.
- Map runs track the few numbers feats need (lowest life, elapsed time, the boss room's start, the gate attempt).
- Loading a save prunes earned ids the list no longer has, then re-checks every ladder and collection.

**Tech Stack:** TypeScript 7, Vite 8, React 19, Vitest 5 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md` (§3).

**Builds on:** Plan 33 (`isGateTier`, `gateWall`, `stats.mapsFromClears`, schema 24).

**Roadmap:** 33. gates, map drops, auto-map · **34. achievements overhaul** (this plan) · 35. difficulty curve, reference sim and balance tests (which pins the day-1 / first-cap pacing of this list).

## Global Constraints

- `ACHIEVEMENT_BOOST` stays `0.01` per earned achievement, with no cap, applied exactly where `achievementBoost` applies today.
- Total achievements: **750–850**. Hidden: **20–40**. Every kind has at least 40, except hidden.
- Ladder ids stay `<family>.<value>`. Feat, collection and hidden ids are stable hand-written strings: `feat.<slug>`, `collection.<slug>`, `secret.<slug>`. Ids are part of the save contract from now on.
- No achievement may need: deleting a save, real AFK time beyond the offline cap, real money, or anything the player would regret (no "sell your best legendary"; selling *a* legendary is fine).
- Nothing under `src/core/` touches the DOM, `Date.now()` or `Math.random()`. Feat timing uses simulated combat time (`COMBAT_STEP_S` steps), never wall-clock.
- Feats and the new ledger fields never read or advance `state.rng` (they observe only).
- Save schema 24 → 25 (Task 1 only), with a migration and round-trip test.
- No `!` non-null assertions; no Claude/Anthropic attribution; full suite, typecheck and build green after every task.

## Review Focus

1. **An old save with 300 earned ids.** Loading a schema-24 save that holds ids the new list dropped must load (not be rejected by `isAchievements`). It keeps every id that still exists and immediately earns the ladders its ledger already satisfies, with no toast flood: at most the toast cap (5) shows, and the rest are earned silently.
2. **Offline catch-up across many feats.** A long auto-mapping catch-up that clears dozens of maps evaluates feats per run end, not once at the end, so per-run feats (first-try gate clears, low-life clears) aren't missed.
3. **Hidden achievements stay hidden.** The Achievements tab, the toast before earning, the wiki and the Stats tab never show a hidden achievement's name or description until it's earned. The toast shows it once earned.
4. **Death mid-feat.** A run that dies earns no "clear" feat even if its last boss hit landed. A "left" run earns none either.
5. **Second-boss maps.** On a `secondBoss` map, the boss-kill-time feat measures from the boss room's start to the *last* boss's death.

---

### Task 1: The model, ledger and run tracking

**Files:**
- Modify: `src/core/achievements.ts` (types only in this task), `src/core/types.ts` (`LifetimeStats`, `MapRun`), `src/core/combat.ts` (run tracking), `src/core/maps.ts` (`startMap`: attempt count), `src/core/loot.ts` (legendary and rune hooks), `src/core/merchant.ts` (legendary hook), `src/core/save.ts` (schema 25, migration, validators, prune on load), `src/core/newGame.ts` (empty ledger fields)
- Test: `tests/core/save.test.ts`, `tests/core/achievements.test.ts`, `tests/core/combat.test.ts`

**Interfaces:**
- Produces in `achievements.ts`:
  ```ts
  export type AchievementKind = 'ladder' | 'feat' | 'collection' | 'hidden';
  export interface AchievementDef {
    id: string; family: string; kind: AchievementKind;
    value: number;            // the threshold for ladders and collections; 1 for feats and hidden
    name: string; desc: string;
  }
  ```
- New `LifetimeStats` fields. Each set is a sorted, duplicate-free array, so the save stays JSON:
  - `legendariesFound: string[]`: `uniqueId`s of legendaries received (drop or merchant);
  - `runesFound: RuneType[]`;
  - `championModsKilled: ChampionMod[]`: every mod of every champion killed;
  - `specialsCleared: MapSpecial[]`;
  - `dungeonTypesCleared: string[]`: keys `` `${tier}:${index}` `` for the world in play;
  - `gateAttempts: Record<number, number>`: runs started per gate tier;
  - `gatesFirstTry: number[]`: gate tiers cleared on attempt 1.
- New `MapRun` fields:
  - `minLife: number`: the lowest `life` seen, starting at max life;
  - `elapsedS: number`: simulated seconds fought;
  - `bossSinceS?: number`: `elapsedS` when the boss room began;
  - `attempt: number`: the gate attempt count of this run (0 off-gate).
- `export function addToSet<T extends string | number>(list: T[], value: T): boolean` in `src/core/ledger.ts` (new). It inserts in sorted order and returns `true` if the value was new.
- `export function pruneEarned(state: GameState): void` in `achievements.ts`. It drops ids missing from `ACHIEVEMENT_IDS`. `load` calls it on the migrated state **before** validation, and then calls `checkAchievements(state)` (all families).
- `dungeonTypesCleared` resets with the world when "Start a new world" makes a new game, like the rest of the run state. It is a world-scoped set kept in the ledger only for the lifetime of that world.

- [ ] **Step 1: Write the failing tests:**
  - `save.test.ts`: a schema-24 save with an earned id `'clicks.10'` that the list no longer has loads `ok`. Its `earned` lacks that id, and it holds `'depth.<first new threshold>'` when `state.deepest` already passes it. A schema-25 save round-trips the new fields. A save with a duplicate in `runesFound` or an unsorted `gatesFirstTry` is rejected.
  - `combat.test.ts`: after a fight that takes life from 100 to 37 and back to 80, `run.minLife === 37`. `run.elapsedS` grows by `COMBAT_STEP_S` per step. Entering the boss room sets `bossSinceS` to the current `elapsedS`. `startMap` on a tier-10 map with `gateAttempts[10] === 2` sets `attempt === 3` and stores 3. A tier-9 map has `attempt === 0` and doesn't touch `gateAttempts`.
  - `achievements.test.ts`: `addToSet([2, 5], 3)` → `[2, 3, 5]`, returns `true`; `addToSet([2, 3, 5], 3)` returns `false`. Receiving a legendary with `uniqueId 'molesbane'` twice leaves `legendariesFound` as `['molesbane']`. Killing a champion with `['armored', 'swift']` adds both mods. Clearing a `treasureRoom` map adds it to `specialsCleared`. Clearing a gate on attempt 1 adds its tier to `gatesFirstTry`.
- [ ] **Step 2: Run** `npx vitest run tests/core/save.test.ts tests/core/achievements.test.ts tests/core/combat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the fields, hooks, `ledger.ts`, the migration (24 → 25: empty sets, `{}` attempts, and live-run fields `minLife = life`, `elapsedS = 0`, `attempt = 0`), the validators, and `pruneEarned` + recheck in `load`. Existing ladder defs get `kind: 'ladder'`.
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `Track feats and collections in the lifetime ledger`.

### Task 2: The feat engine and collections

**Files:**
- Modify: `src/core/achievements.ts`, plus the hook sites: `src/core/combat.ts` (`endRun`, `onKill`), `src/core/clock.ts` (`clickTicks`), `src/core/dig.ts` (metre completed), `src/core/inventory.ts` and `src/core/loot.ts` (sell / salvage; grep `export function sell` / `salvage`), `src/store/gameStore.ts` (rename)
- Test: `tests/core/achievements.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FeatEvent =
    | { kind: 'runEnd'; run: MapRun; result: RunResult }
    | { kind: 'kill'; run: MapRun; monster: MonsterState }
    | { kind: 'click'; paused: boolean }
    | { kind: 'metre'; depth: number }
    | { kind: 'sell'; item: Item }
    | { kind: 'salvage'; item: Item }
    | { kind: 'rename'; name: string };
  export interface FeatDef { id: string; family: string; kind: 'feat' | 'hidden'; name: string; desc: string;
    on: FeatEvent['kind']; test: (state: GameState, event: FeatEvent) => boolean }
  export function checkFeats(state: GameState, event: FeatEvent): void;   // earns every unearned feat whose `on` matches and whose test passes
  ```
- Collections: one ladder `FamilyDef` per set. Its `familyValue` is the set's length, or for gems the number of `(type, grade)` pairs found. Thresholds end at the set's full size (e.g. legendaries: 1, 5, 10, 25, every tier-1 legendary… then all). Collections are checked by `checkAchievements(state, family)` right after the hook that grows their set.
- `endRun` calls `checkFeats(state, { kind: 'runEnd', … })` **after** updating counters, once per run. Offline catch-up therefore evaluates per run.
- Hidden counters: a hidden feat may need a counter nothing tracks yet (e.g. clicks while paused). Add it to `LifetimeStats` in this task and extend Task 1's schema-25 migration with default 0 (schema 25 is unreleased within this plan, so no second bump).

- [ ] **Step 1: Write the failing tests** with two sample feats registered in a test-only list (`FEATS_FOR_TEST`, or a setter the engine exposes for tests):
  - `on: 'runEnd'`, `test: cleared && run.minLife / maxLife < 0.1` → a cleared run at 5% earns it; a died run at 5% doesn't; a cleared run at 50% doesn't.
  - `on: 'click'`, `test: paused` → a click while paused earns it, one while unpaused doesn't.
  - `checkFeats` never earns an id twice, and leaves `state.rng` unchanged.
  - Collections: the `legendaries` collection with thresholds `[1, 5]` earns `.1` after the first distinct legendary and not after the same one again.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `checkFeats`, the hook calls and the collection families. `ACHIEVEMENTS` becomes ladders + collections + `FEATS` (the real list arrives in Task 3; start with an empty `FEATS`).
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `Add the feat engine and collection achievements`.

### Task 3: The list

**Files:**
- Modify: `src/core/achievements.ts` (`FAMILY_DEFS`, `ORE_DEFS` / `oreSeries`, collection defs, `FEATS`, `FAMILY_ICONS`), `src/core/skillIcons.ts` (only if a new family has no fitting glyph)
- Test: `tests/core/achievements.test.ts`, `tests/balance/achievementPace.test.ts` (new; runs under `npm run balance`)

Content rules (spec §3.3):
- **Ladders.** Keep the 33 families plus the ore families. Each has **8–12 steps**. The first step takes ~30 minutes of normal play (no "1 chest", "10 clicks", "1 gem"). The top ends stretch beyond a first run. Keep the salted values (42, 666, 1337, 8760, 123456) within the step budget.
- **Feats.** Mostly tiered by gate (5, 10, … 100) so one idea yields up to 20 achievements:
  - first-try gate clear (reads `gatesFirstTry`);
  - gate cleared of each wall type;
  - frontier clear above 50% life;
  - clear under 10% life;
  - boss kill under N s (N per tier band, from `bossSinceS`);
  - clears with an empty gear slot / normal-rarity gear only;
  - N champions in one run;
  - depth N with a pickaxe of item level ≤ N/50.
- **Collections:** legendaries (per legendary tier and all), gem types × grades, runes, champion mods, map specials, dungeon types (5, 10, 25, 50, 100 distinct).
- **Hidden:** 20–40 harmless jokes, e.g. click while paused ×1,000, sell a legendary, die in a tier-1 map after level 50, rename to "Golden Miner".
- Names: keep the `funkyName` pool for ladders and collections. Feats and hidden ones get hand-written names.

- [ ] **Step 1: Write the failing tests** (`achievements.test.ts`):
  - `ACHIEVEMENTS.length` is between 750 and 850.
  - Hidden count is 20–40; feats ≥ 40; collections ≥ 40.
  - Ids are unique; every ladder family has 8–12 thresholds, strictly increasing.
  - Every family has a `FAMILY_ICONS` entry.
  - No ladder's first threshold is 1, except deaths, levels, ascensions and the collections (first steps where 1 is real progress).
- [ ] **Step 2: Write the failing pace test** (`tests/balance/achievementPace.test.ts`).
  - Add `minutes?: number` to `SimOptions` (the first run stops after that many minutes).
  - Add `export function playReference(options: SimOptions): GameState` to `sim.ts`, returning the state where the first run stopped. Reuse `simulateRun`; don't copy it.
  - `playReference({ seed: 12345, minutes: 495 })` covers the night's capped offline digging plus the first 15-minute check-in. Assert `earnedCount(state) <= 12`: the first session earns a handful, not dozens.
- [ ] **Step 3: Run** both. Expected: FAIL.
- [ ] **Step 4: Write the list.**
- [ ] **Step 5: Run** both and the full suite. Expected: PASS.
- [ ] **Step 6: Commit** `Rewrite the achievement list: harder ladders, feats, collections, secrets`.

### Task 4: The tab, toasts and wiki

**Files:**
- Modify: `src/ui/achievements/achievementsView.ts`, `src/ui/achievements/AchievementsView.tsx`, `src/ui/achievements/achievements.css`, `src/ui/achievements/AchievementToast.tsx` (only if it reads fields that changed), `src/wiki/` (the achievements page)
- Test: `tests/ui/achievements.test.ts`

**Interfaces:**
- `AchievementVM` gains `kind: AchievementKind` and `hidden: boolean` (unearned hidden ones).
- `achievementVMs` groups by kind, then by family: "Milestones" (ladders), "Feats", "Collections", "Secrets".

- [ ] **Step 1: Write the failing tests:**
  - An unearned hidden VM has `name === '???'` and `desc === 'A secret. Keep playing.'`, and the real strings never appear in the VM.
  - Once earned, it shows its real name and description.
  - The "Secrets" group's count line reads `earned / total` (hidden ones still count toward the total).
  - The groups come in the order Milestones, Feats, Collections, Secrets.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Hidden badges use a "?" treatment in the existing badge style (dim, no family icon).
  - The tab gets four group headings.
  - The wiki lists ladders, feats and collections, and only the count of secrets.
- [ ] **Step 4: Run** the full suite, typecheck and build. Then smoke the tab at 1280×900 and 390×844 per `env-webcdev-browser-smoke` (dev server on port 5180): no horizontal scroll, and hidden ones show "???".
- [ ] **Step 5: Commit** `Show feats, collections and secrets in the Achievements tab`.
