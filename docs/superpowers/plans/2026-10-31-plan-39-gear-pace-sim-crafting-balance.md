# Plan 39: Gear pace, the sim's crafting, and the balance restore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make upgrades come from crafting rather than lucky drops, teach the reference player to smelt and craft, and restore round 5a's original bands:
- the first level 100 on **days 12–16**;
- **≥ 80 %** of first gate attempts failing.

Two new bands are added: Gold left unspent at the first cap, and the crafted share of power.

**Architecture:**
- The rarity weights move: legendary halves (decided) and rares drop.
- `src/core/sim.ts` gains a crafting policy and two metrics, `craftedShare` and `goldUnspentShare`.
- The balance suite pins the restored and new bands, and the tuning happens against it.

**Tech Stack:** TypeScript 7, Vitest 5 (`vitest.balance.config.ts`).

**Spec:** `docs/superpowers/specs/2026-10-31-round-5b-crafting-economy-bases-design.md` §6, §6a (retune), §8, §9. Round 5a spec §4.6 records the interim decision this plan closes.
**Builds on:** Plans 36–38.

## Global Constraints

- **Rarity weights** start at `normal 70 / magic 25 / rare 4.5 / legendary 0.5`.
  - **Legendary 0.5 is decided** (Ernest, 2026-10-31) and is not a lever.
  - The other three are levers.
- **Bands** (the design; never loosened to fit):
  - **Round 5a, restored:** cap day **[12, 16]** per seed; first-attempt fails **≥ 0.8** pooled.
  - **Round 5a, unchanged:**
    - frontier [45, 55];
    - day-1 achievements [0.06, 0.14];
    - first-cap achievements [0.32, 0.48];
    - expected-achievement table ±25 %;
    - every gate below the frontier cleared;
    - median hold [0.3, 0.8] d from `reachedDay`;
    - `secondCapDay ≤ capDay`;
    - determinism.
  - **Plan 36:**
    - physical and elemental mean holds (from `firstAttemptDay`) within 25 %;
    - first-attempt fails within 15 points;
    - raw-power tilt ≥ 1.5× overall and ≥ 1.2× without the biggest gate;
    - raw power never locked out.
  - **New:**
    - `goldUnspentShare` (Gold held at the first cap ÷ lifetime Gold earned, where earned = `goldFound + goldFromSales`) **< 0.10**;
    - `craftedShare` at the first cap in **[0.35, 0.65]** per seed.
- **`craftedShare`** = `(score − score with every source: 'craft' line removed) / (score − naked score)`.
  - The score is the defence-aware `powerScore` against the next gate's wall, over the worn battle set at the first cap.
  - The naked score is the same miner with nothing equipped.
- **Allowed levers:**
  - round 5a's levers: the monster curve, the gate step, the wall modifiers, `monsterXp`, XP-to-next, `MAP_CLEAR_DROP_CHANCE`, the sim's retry margin and queue size;
  - achievement ladder and collection **thresholds** (spec §6a), but not counts, kinds or feats;
  - `SMELT_ORE`, `SMELT_FEE`, `SMELT_DIAMONDS`, `USE_FEE_BASE`, `GEM_REMOVE_FEE`;
  - the normal, magic and rare weights;
  - `BASE_TIER_MULT`, `BASE_SECOND_SHARE`;
  - salvage amounts, and ore amounts per vein (keeping the four ores' depths).
  - if Void crystal can't carry Polish (spec §6), Polish may switch to costing Diamonds plus its fee; say so in the commit body.
- **If two bands can't be met together**, stop and report the trade-off with numbers (DONE_WITH_CONCERNS). It goes to Ernest as a design decision, as in round 5a.
- The sim stays pure and deterministic. No `!`; no Claude/Anthropic attribution.
- Main suite, typecheck and build green after every task. `npm run balance` green at the end of Task 3.

## Review Focus

1. **The sim crafting on a legendary, or touching a base's starting stat.** Never: assert it across a full run.
2. **The sim spending Diamonds below what a web reset costs.** The policy keeps a `RESET_WEB_DIAMONDS` reserve for the human-style reset it never uses, so Exalt spending can't starve it.
3. **`craftedShare` when the score without crafted lines falls below the naked score**, e.g. a crafted line was the only defence against the wall. The metric clamps to [0, 1] and the test documents why.
4. **Gold fees and Gold spent:** `goldUnspentShare` uses lifetime earned, not held, so a run that sells a lot isn't flattered. Check `goldFromSales` is counted.
5. **Second runs after ascension:** crafting state (currencies held, half-crafted items) carries over exactly as items do today. `secondCapDay ≤ capDay` must still hold.

---

### Task 1: Rarity weights and the two metrics

**Files:**
- Modify: `src/core/balance.ts` (`RARITY_WEIGHTS`), `src/core/sim.ts` (`craftedShare(state, wall, tier): number`, `goldUnspentShare(state): number`; `SimReport` gains `craftedShareAtCap: number` and `goldUnspentAtCap: number`)
- Test: `tests/core/sim.test.ts`, `tests/core/itemGen.test.ts` (rarity shares)

- [ ] **Step 1: Write the failing tests:**
  - **Rarity:** over 20,000 seeded `rollRarity(state)` draws, the shares are within ±1 point of 70/25/4.5/0.5.
  - **`craftedShare`:**
    - a hand-built miner with only dropped lines gives 0;
    - a miner whose only lines are `source: 'craft'` gives 1;
    - a mixed miner gives a value in (0, 1);
    - the clamp case (Review Focus 3).
  - **`goldUnspentShare`:** a state with `gold 50`, `goldFound 400`, `goldFromSales 100` gives 0.1.
  - The report fields exist, and `runReference({ minutes })` stays deterministic.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Re-pin tests whose drop rarities move, and list them in the commit body.
- [ ] **Step 4: Run** the full suite, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `Make rares and legendaries scarcer and measure crafted power`.

### Task 2: The reference player crafts

**Files:**
- Modify: `src/core/sim.ts` (a `craftPolicy` step in each check-in, after `shopTrader`)
- Test: `tests/core/sim.test.ts`, `tests/core/simGates.test.ts`

**Interfaces:**
- `export function craftStep(state: GameState, target: PowerTarget, policy: GearPolicy): number`. It returns the number of currency uses this check-in. Rules (pin these):
  1. **Smelt** what it can afford, keeping a Gold reserve equal to the next gamble price and a Diamond reserve of `RESET_WEB_DIAMONDS` (Review Focus 2). Higher currencies first: Exalt, Polish, Chaos, Ascent, then the rest.
  2. **Pick the target:** the worn battle item whose slot gains most from crafting. `defenceAware` prefers a base whose role matches the next wall: `resistAll` roles before an elemental gate, `armor` roles before a physical one. `rawPower` ignores the wall.
  3. **Apply a currency** only if it keeps or raises `powerScore`, reverting via a clone check rather than undo. In order:
     - normal → Change, then magic → Growth;
     - magic with no room → Ascent;
     - rare with room → Exalt;
     - rare full → Chaos only if the item's crafted share is below 0.5, else Polish.
  4. **Stop** when no step raises the score or the money runs out. At most 40 uses per check-in.
  - It never targets a legendary, and never touches `implicit` or `implicit2` (Review Focus 1, which the currencies already enforce).
- Equipping a better crafted item goes through the existing `fitBattleGear`.

- [ ] **Step 1: Write the failing tests:**
  - On a hand-built state at a held elemental gate with Gold and ores, `craftStep` raises `powerScore` against the elemental target, and prefers a `resistAll`-role base for its target.
  - It never touches a legendary.
  - It respects both reserves.
  - It's capped at 40 uses.
  - A full-run assertion (`playReference({ seed: 1, minutes: 4000 })`): no worn legendary ever has a `source: 'craft'` line.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the unit tests (each under ~10 s) and the full suite. Then run `npm run balance` once and record the numbers in the commit body; it may be red.
- [ ] **Step 5: Commit** `Teach the reference player to smelt and craft`.

### Task 3: Restore the bands

**Files:**
- Modify: `tests/balance/referenceRun.test.ts` (cap band back to [12, 16]; first-fail back to ≥ 0.8; add `goldUnspentAtCap < 0.10` and `craftedShareAtCap` in [0.35, 0.65] per seed; remove the interim comments), plus the levers listed in Global Constraints, `src/core/balance.ts` (`EXPECTED_ACHIEVEMENTS_AT_LEVEL`, refit to the final tuning), `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md` §4.6 (mark the interim decision closed, with the final numbers), `README.md` (the balance section)
- Test: the balance suite

- [ ] **Step 1: Edit the bands** to exactly the values above. Run `npm run balance` and record the baseline.
- [ ] **Step 2: Tune** with the allowed levers only, against the suite.
  - Keep a tuning log: tried values → every band per seed and policy.
  - Use a probe harness outside the repo, in the job tmp dir, with vitest writing to files, and seeds in parallel.
- [ ] **Step 3: Re-fit** `EXPECTED_ACHIEVEMENTS_AT_LEVEL` to the final tuning (the round 5a review noted it predates f3), then re-run.
- [ ] **Step 4: If every band passes:**
  - Close 5a §4.6 with the final per-seed numbers.
  - Update the README balance section.
  - Run the main suite, typecheck, build and `npm run balance`, all green.
  - Commit `Restore the two-week pace and the brutal gate walls`, with the condensed tuning log.
- [ ] **Step 5: If two bands can't be met together:** commit the best round with the restored bands still red, and report DONE_WITH_CONCERNS with the trade-off and numbers. Don't loosen any band. The controller takes it to Ernest.
