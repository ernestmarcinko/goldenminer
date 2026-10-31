# Plan 36: Round 5a's gate findings — the away queue, wall balance, the tilt, the first gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four findings from round 5a's final review before round 5b changes the economy, then re-measure:
- the sim's away queue runs cleared gate tiers;
- elemental walls hit ×3 against physical's ×1.56;
- the raw-power tilt hangs on one gate;
- gate 5 is elemental on every test seed.

**Architecture:**
- `gateWall` (`src/core/gates.ts`) pins the first pair's order.
- The sim's `queueBestMaps` skips every gate tier.
- The wall modifiers in `balance.ts` and the sim's `powerScore` defence weighting are re-tuned.
- The balance suite gains a per-wall check and a leave-one-gate-out tilt check.

**Tech Stack:** TypeScript 7, Vitest 5 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-31-round-5b-crafting-economy-bases-design.md` §3. Round 5a's spec §4.6 lists the findings.

**Roadmap (round 5b):** **36. gate findings** (this plan) · 37. the Smith, currencies, four ores, achievement replacements · 38. 108 item bases · 39. gear pace, the sim's crafting, the balance restore.

## Global Constraints

- Bands are never loosened to fit. Round 5a's interim bands stay in force for this plan:
  - cap day in [12, 19];
  - first-attempt fails ≥ 40 %.
  - Plan 39 restores [12, 16] and ≥ 80 %.
  - Every other round 5a band is unchanged.
- New bands (spec §3), computed over the three seeds' defence-aware first runs:
  - **Mean holds:** physical-gate and elemental-gate mean holds are within 25 % of each other. A hold here is measured as `clearedDay − firstAttemptDay`.
  - **First-attempt fails:** the physical and elemental fail rates are within 15 points of each other.
- Tilt bands (seed 12345):
  - raw power holds ≥ 1.5× as long as defence-aware in total (unchanged);
  - and ≥ 1.2× with the single gate that contributes most to the difference left out.
- Allowed levers: `PHYSICAL_WALL`, `ELEMENTAL_WALL`, the gate step, `powerScore`'s defence weighting, `GATE_RETRY_MARGIN`. No economy, drop or crafting numbers.
- The sim stays pure and deterministic.
- No `!`; no Claude/Anthropic attribution in commits. Main suite, typecheck, build green after every task; `npm run balance` green at the end of Task 2.

## Review Focus

1. **A world seed that used to make gate 5 elemental.** In an existing save, the gate's wall changes on load. That's accepted, since nothing is saved per gate. But a run in progress at gate 5 must keep fighting the monsters it was built with: rooms are regenerated from the seed, so check `roomQueue` uses the new wall consistently and nothing crashes.
2. **An away queue with only gate-tier maps in stock.** It stays empty and auto-mapping stops. It must not spin or throw.
3. **The leave-one-out tilt with fewer than two gates in common** between the raw and defence-aware runs. The check must not divide by zero or pass vacuously. With fewer than two common gates, it fails with a clear message.
4. **Wall modifiers vs the save limits.** Raised physical speed or damage at tier 300 still stays below `MAX_DAMAGE`, and `intervalS` stays > 0.
5. **The map card copy** stays true after the rebalance: if physical ends up hitting harder than elemental, the gate lines (Plan 35) must still describe what the player meets.

---

### Task 1: The first gate is physical, and the away queue skips gate tiers

**Files:**
- Modify: `src/core/gates.ts` (`gateWall`), `src/core/sim.ts` (`queueBestMaps`, `GateRecord` users)
- Test: `tests/core/gates.test.ts`, `tests/core/sim.test.ts`

**Interfaces:**
- `gateWall(seed, tier)`: for pair 0 (gates 5 and 10), the order is fixed: 5 is `'physical'` and 10 is `'elemental'` on every seed. Later pairs keep the seeded swap unchanged.
- `queueBestMaps(state, top)` never queues a map whose `isGateTier(map.tier)` is true.

- [ ] **Step 1: Write the failing tests.**
  - `gates.test.ts`:
    - For seeds 1..200, `gateWall(seed, 5) === 'physical'` and `gateWall(seed, 10) === 'elemental'`.
    - Pairs (15, 20) and later still have one of each wall, and both orders occur.
    - Re-pin the `amber-fox-427` tier-5 value.
  - `sim.test.ts`:
    - A state with stashed maps at tiers 4, 5, 9 and 10, held at gate 15: `queueBestMaps` queues only tiers 9 and 4, in that order.
    - A stash holding only tier-5 maps leaves the queue empty and doesn't throw.
- [ ] **Step 2: Run** `npx vitest run tests/core/gates.test.ts tests/core/sim.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Re-pin any dungeon or monster test whose tier-5 or tier-10 value moves, and list each one in the commit body.
- [ ] **Step 4: Run** the full suite, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `Make the first gate physical and keep gate maps out of the away queue`.

### Task 2: Balance the walls and the tilt, with checks

**Files:**
- Modify: `src/core/balance.ts` (`PHYSICAL_WALL`, `ELEMENTAL_WALL`, gate step if needed), `src/core/sim.ts` (`powerScore`, `GATE_RETRY_MARGIN`), `tests/balance/referenceRun.test.ts`, `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md` §4.6 (append the re-measured table)
- Test: `tests/balance/referenceRun.test.ts`, `tests/core/battle.test.ts` (wall modifier unit tests)

**Interfaces:**
- `export function wallStats(reports: SimReport[]): Record<Wall, { meanHold: number; firstFail: number; gates: number }>` in `src/core/sim.ts`.
  - `meanHold` uses `clearedDay − firstAttemptDay` over cleared gates.
  - `firstFail` is the share of gates whose `attempts > 1`.
- `export function tiltWithoutBiggest(raw: SimReport, aware: SimReport): number` in `src/core/sim.ts`.
  - It works over gates both runs cleared: Σ raw holds ÷ Σ aware holds, after removing the one gate with the largest (raw − aware) hold.
  - It throws if fewer than two gates are in common.

- [ ] **Step 1: Write the failing tests:**
  - `battle.test.ts`: a tier-300 gate monster under each wall stays below `MAX_DAMAGE` with `intervalS > 0`. Re-use the existing exhaustive save-limit test, extended to the new values.
  - Unit tests for `wallStats` and `tiltWithoutBiggest` on hand-built `SimReport`s, including the fewer-than-two-gates throw.
  - In `referenceRun.test.ts`, add:
    - `|meanHold.physical − meanHold.elemental| / max(...) ≤ 0.25`;
    - `|firstFail.physical − firstFail.elemental| ≤ 0.15`;
    - `tiltWithoutBiggest(raw12345, aware12345) ≥ 1.2`.
    - Keep every existing band exactly.
- [ ] **Step 2: Run** the unit tests (expected FAIL), then `npm run balance` once to record the baseline numbers.
- [ ] **Step 3: Implement** the helpers. Then tune the allowed levers only, until `npm run balance` passes.
  - Keep a tuning log (tried values → per-wall holds and fails, tilt, cap days, frontier).
  - If the new bands can't be met together with round 5a's, stop and report DONE_WITH_CONCERNS with the best round. Don't loosen any band.
- [ ] **Step 4: Append** the re-measured per-wall table and the tilt numbers to 5a spec §4.6 under "Re-measured after Plan 36". If the physical/elemental balance flips, check the gate card copy (`itemView.ts` `GATE_LINES`, the wiki, the README) still describes what the player meets.
- [ ] **Step 5: Run** the full suite, typecheck, build and `npm run balance`. Expected: all green.
- [ ] **Step 6: Commit** `Balance the two walls and spread the defence tilt across gates`, with the tuning log condensed in the body.
