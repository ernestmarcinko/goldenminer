# Plan 35: The difficulty curve, a smarter reference player, and honest balance tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first run to level 100 take ~14 days, with gate tiers that act as brutal walls for about half a day each. Pin it with balance tests whose bands come from the spec and are never loosened to fit.

**Architecture:**
- The reference sim (`src/core/sim.ts`) gets a policy object: defence-aware gear choice with a spare per slot, simple merchant buys, and farming below a gate until a power-score margin is met.
- `MAP_MONSTER_SCALE` is replaced by a tier curve in `balance.ts`: a base curve, a gate step and per-wall modifiers. It is tuned against an expected-achievement table, since the achievement boost is part of the power curve.
- The balance suite (`npm run balance`) pins the spec's bands on three seeds.

**Tech Stack:** TypeScript 7, Vitest 5 (`vitest.balance.config.ts`, 600 s timeout).

**Spec:** `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md` (§3.4, §4, §6).

**Builds on:** Plan 33 (`gates.ts`, map drops from clears, uncapped auto-map) and Plan 34 (the ~800 list; `SimOptions.minutes` and `playReference(options): GameState` in `sim.ts`).

## Global Constraints

- **The bands are the design.** If the sim misses a band, change the tuning (curve, XP, map-drop rate), never the band. A task that edits a band fails review.
- Early tiers keep Ernest's 2026-10-26 rule: tiers 1–2 are gentle (about 70%) and winnable without clicking. A naked level-1 miner clears the guaranteed first map (tier 1) 55–75% of the time, and an early miner (level 3, five normal ilvl-2 items) clears tier 2 60–80%.
- Clicking stays disabled in maps (unchanged).
- Gear drop rates, merchant prices, crafting and the economy are round 5b's: don't tune them here. Allowed levers: the monster curve, gate step, wall modifiers, `monsterXp`, the XP-to-next formula, and `MAP_CLEAR_DROP_CHANCE`.
- Numbers in the UI always go through `formatNumber` (compact k / M / B).
- `MAX_LIFE` / `MAX_DAMAGE` (1e12 since Plan 33) are never reached by tiers ≤ 300 for any species/rank/mod combination.
- The sim stays pure and deterministic for a given seed and options.
- No `!`; no Claude/Anthropic attribution; the main suite, typecheck and build green after every task; `npm run balance` green at the end of Task 3.

## Review Focus

1. **A player who never builds defence.** The raw-power-only policy must still clear every gate up to its frontier eventually (no hard lock), just more slowly.
2. **Elemental gates late in the run.** `baseResist` reaches −99 at level 100, so an elemental gate at tier 45–50 must still be clearable by the defence-aware player within the half-day target, and not be twice as hard as the physical one next to it.
3. **Auto-mapping into a wall while away.** The defence-aware sim queues only maps below the gate while farming. A player who queues everything loses gate maps; that's intended, but the sim must not count those losses as "stuck".
4. **Tiers past 100.** The curve and gates continue. Tier 150 and tier 300 monsters are finite, below the clamps, and their life formats compactly.
5. **Later runs aren't slower.** After the first ascension, the second run reaches level 100 no later than the first.

---

### Task 1: The reference player's new policy

**Files:**
- Modify: `src/core/sim.ts`
- Test: `tests/core/sim.test.ts` (new; fast, short runs), `tests/balance/referenceRun.test.ts` (only to keep it compiling; it's rewritten in Task 3)

**Interfaces:**
- Produces:
  ```ts
  export type GearPolicy = 'defenceAware' | 'rawPower';
  export interface SimOptions { seed?: number; days?: number; clickRate?: number; activeEfficiency?: number;
    minutes?: number /* from Plan 34 */; policy?: GearPolicy }
  export interface GateRecord { tier: number; firstAttemptDay: number; clearedDay: number; attempts: number }
  // SimReport gains:
  gates: GateRecord[];                 // every gate reached in the first run, in tier order
  achievementsAtDay1: number;          // earnedCount at minute 1440
  achievementsAtCap: number;           // earnedCount when level 100 is first reached
  achievementsAtLevel: Record<number, number>;   // earnedCount when each level is first reached
  secondCapDay: number;                // days into the second run to reach level 100 (-1 if not reached)
  ```
- Policy rules (pin these):
  - **Power score**: `damage per second × effective life` against the *next gate's* wall. Effective life is life after armour mitigation of a reference physical hit, or after resist mitigation of a reference elemental hit, at that gate tier's monster damage. `rawPower` scores only DPS × raw life.
  - **Gear**:
    - Keep the best item per slot by score, worn.
    - Keep one spare per slot that scores best for the *other* wall type (`defenceAware` only). Swap to it before running a gate of that type.
    - Everything else is dropped, as today.
  - **Merchant**: at each check-in, buy any Trader item that raises the score, if affordable. Gold otherwise accumulates as today.
  - **Gates**:
    - Attempt a gate when first reached, then farm `frontier − 1` and `frontier − 2` maps.
    - Retry once per check-in, but only after the score has risen by `GATE_RETRY_MARGIN` over the last failed attempt's (a sim constant; Task 2 tunes it so a typical gate holds ~half a day).
    - While farming, auto-mapping queues only maps below the gate.
  - The check-in schedule is unchanged: 08:00, 13:00, 19:00, 23:00, 15 minutes each, 65% active.

- [ ] **Step 1: Write the failing tests** (`tests/core/sim.test.ts`, each under ~10 s; use `minutes`):
  - `runReference({ seed: 1, minutes: 600 })` is deterministic (two runs are `toEqual`).
  - With a hand-built state holding a high-armour and a high-resist chest piece, the policy wears the resist one before an elemental gate and the armour one before a physical gate (unit-test the exported `chooseGear(state, wall)` helper).
  - `rawPower` never keeps a spare.
  - `gates` records `attempts ≥ 1` and `clearedDay ≥ firstAttemptDay` for every cleared gate.
- [ ] **Step 2: Run** `npx vitest run tests/core/sim.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the policy, `chooseGear(state: GameState, wall: Wall): void`, and the report fields.
- [ ] **Step 4: Run** the test, then `npm run balance` once, and **record** the numbers in the commit body: cap day, gates and their hold times, and the achievements at day 1 and at the cap. The old balance test may fail now; Task 3 replaces it, and its failure is expected and noted.
- [ ] **Step 5: Commit** `Teach the reference player gates, spares and the merchant`.

### Task 2: The tier curve and the expected-achievement table

**Files:**
- Modify: `src/core/balance.ts` (remove `MAP_MONSTER_SCALE` / `mapMonsterScale`; add the curve), `src/core/monsters.ts`, `src/core/combat.ts` (only if a wall modifier touches attack timing), `src/wiki/` (the gates paragraph from Plan 33 gains the numbers' wording, not figures)
- Test: `tests/core/battle.test.ts` (its `MAP_MONSTER_SCALE` cases move to the new curve), `tests/core/combat.test.ts` (re-pins)

**Interfaces:**
- Produces in `balance.ts`:
  ```ts
  export function tierLifeMult(tier: number): number;     // base curve × gate step, replaces mapMonsterScale for life
  export function tierDamageMult(tier: number): number;   // the same for damage
  export const GATE_LIFE_STEP: number;  export const GATE_DAMAGE_STEP: number;
  export const PHYSICAL_WALL: { damageMult: number; speedMult: number };   // hits harder and more often
  export const ELEMENTAL_WALL: { damageMult: number };                     // most damage elemental (forced in Plan 33)
  export const EXPECTED_ACHIEVEMENTS_AT_LEVEL: Readonly<Record<10 | 30 | 60 | 100, number>>;
  ```
- `monsterState` uses `tierLifeMult` / `tierDamageMult`, and the wall modifier when `wall` is set.
- The shape (the numbers are tuned):
  - The base curve's growth per tier must keep pace with the expected player power at that tier's typical level. That power is gear by ilvl × level × passives × `1 + 0.01 × EXPECTED_ACHIEVEMENTS_AT_LEVEL`, interpolated.
  - A gate multiplies by its step.
  - The tier after a gate returns to the base curve.
- The XP side: tune `monsterXp` and the XP-to-next formula so level 100 lands on days 12–16 with ~10 gates on the way.

- [ ] **Step 1: Write the failing unit tests:**
  - `tierLifeMult(10) / tierLifeMult(9) > tierLifeMult(9) / tierLifeMult(8) * 1.5` (a gate is a step, not a slope).
  - `tierLifeMult(11) < tierLifeMult(10)` is allowed but not required. `tierLifeMult(11) ≥ tierLifeMult(9)` is required (never easier than the tier before the gate).
  - `monsterState` at tiers 150 and 300, for every rank and mod combination over a few species, gives finite life and damage below `MAX_LIFE` / `MAX_DAMAGE`.
  - The early-tier rule from Global Constraints, as seeded win-rate tests over 500 seeds. Reuse the Plan 10 fight harness in `combat.test.ts` (grep `naked` / `66`).
- [ ] **Step 2: Run** them. Expected: FAIL (`tierLifeMult` missing).
- [ ] **Step 3: Implement** the curve with first-guess numbers. Then loop: run `npm run balance` against Task 3's band test (write Task 3 Step 1 first if you prefer to tune against it), adjust the allowed levers only, and repeat. Keep a short tuning log (a table of tried values and results) in the commit body.
- [ ] **Step 4: Run** the full suite. Re-pin rng- or number-dependent combat tests, and list them in the commit body.
- [ ] **Step 5: Commit** `Replace the tier scale table with a gated difficulty curve`.

### Task 3: Honest balance tests

**Files:**
- Modify: `tests/balance/referenceRun.test.ts` (rewrite), `README.md` (the balance section: what the bands are and that they are never loosened)
- Test: the same file

- [ ] **Step 1: Write the test.** For seeds `12345`, `777`, `31337`, policy `defenceAware`, 24 days:
  - `capDay` in **[12, 16]**;
  - `achievementsAtDay1 / ACHIEVEMENTS.length` in **[0.06, 0.14]**;
  - `achievementsAtCap / ACHIEVEMENTS.length` in **[0.32, 0.48]**;
  - for each of levels 10, 30, 60, 100: `achievementsAtLevel[L]` within ±25% of `EXPECTED_ACHIEVEMENTS_AT_LEVEL[L]`;
  - the frontier at cap in **[45, 55]**;
  - every gate in `gates` below the frontier is cleared;
  - first attempts fail on ≥ 80% of all gates across the three seeds;
  - the median gate hold (`clearedDay − firstAttemptDay`) in **[0.3, 0.8]** days;
  - `secondCapDay ≤ capDay`;
  - determinism: seed 12345 run twice is `toEqual`.

  For seed `12345` with policy `rawPower`: every gate is still cleared (no hard lock), and its total gate-hold time is **≥ 1.5×** the `defenceAware` run's.
- [ ] **Step 2: Run** `npm run balance`. Expected: PASS once Task 2's tuning is done. If any band fails, go back to Task 2's levers; don't edit the bands.
- [ ] **Step 3: Commit** `Pin the two-week pacing and gate walls in the balance suite`.
