# Plan 13: Balance and launch

**Goal:** The last plan. Prove the run hits its pacing targets with a headless reference-run simulator, tune the constants to hit them, and finish the launch surface (metadata, docs, final QA).

- **Balance.** The design's pacing targets (§4.9) were never measured end to end: first map within a minute, level cap in about a week for the reference player, auto-mapping around level 30 / day 3–4, and the depth wall after the cap. The existing `mapClear` test pins *map* clear rates only. This plan adds a **reference-run simulator** that plays a whole week through the real tick functions, and tunes the economy against it.
- **Launch.** The game is already a static site with saves, export/import, settings, a new-world flow and a donate link slot. What is left is launch metadata (description, theme colour, favicon), a complete README (controls, credits, the balance command) and a final full-suite/build pass.

**Architecture:**

- **The simulator is pure core** (`src/core/sim.ts`), importing the same `newGame`, `applyTicks`, `startMap`, `deriveStats`/`deriveBattleStats`, `gainXp`, `allocate`, `queueForAutoMap`, `ascend` the game uses. No React, no DOM, no `Date.now()`/`Math.random()` — time is an integer minute counter and the seed is passed in.
- **The simulator models a reference player**, not a perfect one: the reference player from §4.9 (4 check-ins a day of about 15 minutes, offline digging between, overnight), a simple gear policy (wear the best drop per slot), a simple passive policy (alternate battle/mining, path to Surveyor by level 30), and map choice one tier above the highest cleared.
- **Tuning changes as few constants as possible**, in this order of preference: the XP curve (`xpToNext`), map and monster XP, then drop/gear rates. The clear-rate test stays green throughout.
- **Launch work is file-disjoint** from the simulator, so the two can be built in parallel worktrees and merged.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest, lz-string. No new dependencies.

**Spec:**
- `2026-10-23-golden-miner-revival-design.md` §1 (success: one-week run), §4.4 (auto-mapping), §4.8 (ascension), §4.9 (pacing targets and the reference player), §5 (screens, settings/donate), §6 (headless balance script).
- `2026-10-24-round-4-play-feedback-design.md` §8 (Plan 13 = balance and launch).
- `2026-10-26-plan-11-passive-web.md` and `2026-10-26-plan-12-auto-mapping-ascension.md` (the two systems being paced).

**Builds on:** Plan 12 (`dev-ernest` at `b9f9c40`). All 13 systems are in place; this plan measures and finishes them.

**Roadmap:** this is plan 13 of 13. 11. the passive web · 12. auto-mapping and ascension · **13. balance and launch** (this plan).

## Global Constraints

Same as Plans 11–12, plus:

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. The simulator draws from `state.rng` only through the game's own functions.
- **The full suite stays green.** Balance constants may move, but no test may be deleted to make the numbers fit; a test that encodes a target is updated only when the *design* target changes, and the reason is recorded in the plan's measured table.
- **The clear-rate test is a guardrail:** `tests/core/mapClear.test.ts` (60–80 % for tiers 1–2 and 30–50 % for tiers 3–10) must stay green. The simulator must not be "fixed" by loosening it.
- **Readable numbers:** the tuning keeps every visible number under the anti-goal line. The simulator reports raw numbers; `plan`/README show them via `formatNumber`.
- **No login pressure:** the simulator's schedule is a model of play, not a requirement on the player.
- **Saves:** `SCHEMA_VERSION` stays 12 (no new fields). The balance tuning changes numbers only; old saves keep working.
- Phones: the launch check re-verifies 390 px layout and 44 px targets; no new controls.
- **Where things live:** balance constants in `src/core/balance.ts`; the simulator in `src/core/sim.ts`; its runner config in `vitest.balance.config.ts`; the launch metadata in `index.html`/`public/`; player-facing copy in `README.md`.
- No `!` non-null assertions in `src/`.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages with no attribution; never push (the owner pushes).

## Review Focus

1. **The simulator is honest.** It uses the real tick/map/passive/auto-map/ascend functions, not a spreadsheet. Its only simplifications are stated in "Decisions": gear policy, passive policy, bag policy, map-choice policy, and the 1-minute step. Task 1 prints the report; Task 3 records it.
2. **The targets are measured, not guessed.** The plan's measured table has first-map seconds, auto-map unlock level/day, cap day, deepest depth at cap, frontier tier at cap and one day later, and ascendancy points at the cap. Task 3 asserts the targets in the balance test.
3. **Old tests survive.** The clear-rate test and every Plan 1–12 test stay green after tuning; only constants move, and any test that pins a moved constant is updated with its new measured value and a note.
4. **Launch is complete.** `index.html` has a description, theme colour and favicon; the README covers Run it (including `npm run balance`), Controls, Saving and Credits; a production build succeeds.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Simulator API | `runReference(options?): SimReport` in `src/core/sim.ts`. `SimReport` holds `firstMapSec`, `autoMapLevel`, `autoMapDay`, `capDay`, `deepestAtCap`, `frontierTierAtCap`, `frontierTierAfterDay`, `ascensionPointsAtCap`, and per-tier `clears`/`losses`. Deterministic for a given seed/options. |
| Time model | 1-minute steps. A simulated day is 1,440 minutes. Offline gaps are capped at the current `offlineCapMs` per gap, exactly as `advance` does. Tick counts come from the live `autoTicksPerSecond`; clicks add `ticksPerClick` ticks at a modelled click rate. |
| Reference schedule | 4 check-ins a day at 08:00, 13:00, 19:00 and 23:00, each 15 minutes of active play. Everything between is away. This matches §4.9. |
| Active play | Run the best available map; if none, dig. The modelled click rate is **2 clicks/second while digging** (not in maps, where clicking does nothing). |
| Map choice | A frontier tier starts at 1 and rises by one after a clear; the player runs the highest-tier available map at or below `frontier + 1`, else digs. This models "push one tier at a time" without perfect foresight. |
| Gear policy | After each run, wear the highest-scoring drop per slot: `score = ilvl × (normal 1, magic 1.5, rare 2, legendary 2.5)`. Everything else is sold; the bag is emptied, so the sim models no bag stalls (a stated pessimism/optimism trade-off: no stalls, but no crafting/upgrades either). Mining and battle sets are handled separately. |
| Passive policy | Spend points greedily: alternate the first allocatable battle node and the first allocatable mining node; at level 30, if Surveyor is reachable, spend the points along the shortest path to it first. Ascendancy is not spent in the first run (there is none). |
| Auto-mapping | Once Surveyor is allocated, queue every map at or under `autoMapMaxTier` and let away ticks run them; maps over the limit stay in the stash for active play. |
| Stop rule | Simulate 8 days (configurable). The first run ends at the cap; the report still records the day the cap was reached. A separate "day after the cap" pass measures frontier growth and ascendancy points. |
| Targets | First map ≤ 60 s; auto-map unlock at level 28–32 on day 3–4; cap on day **4–8** (aim 5–6); frontier tier after the cap day ≥ frontier tier at the cap (the wall has not arrived); ascendancy points at the cap ≥ 1. |
| Tuning order | `xpToNext` first, then `monsterXp` and map rewards, then drop rates. Prefer one or two constants per iteration; re-run the sim after each. |
| Balance test | `tests/balance/referenceRun.test.ts` (excluded from `npm test`) asserts the targets and prints the report. `npm run balance` runs it via `vitest.balance.config.ts`; the default `npm test` stays fast. |
| Launch metadata | `index.html` gains `<meta name="description">`, `<meta name="theme-color" content="#15120f">` and `<link rel="icon" href="./favicon.svg">`; `public/favicon.svg` is a small code-drawn golden pickaxe (MIT). |
| Launch docs | README "Run it" gains `npm run balance`; a new "Controls" section (click the mine, right-click items, the shortcuts, Pause); a new "Credits" section (Metamorphous / Alegreya Sans / IBM Plex Mono via Google Fonts, code-drawn placeholder pixels, the 2013 original, MIT). A "Pacing" paragraph records the measured run once Task 3 has numbers. |
| Final QA | Full `npm test`, `npm run typecheck`, `npm run build`; a manual 1280×900 and 390×844 smoke of the tabs; the balance report pasted into the plan's measured table and the README's Pacing paragraph. |

## File structure

```
src/core/
  sim.ts           NEW  runReference, SimReport, the reference-player policies
  balance.ts       MOD  the tuned constants (Task 3 only)
tests/
  balance/referenceRun.test.ts   NEW  the target assertions + printed report (excluded from npm test)
vitest.balance.config.ts         NEW  include tests/balance/**, long timeout
package.json                     MOD  "balance": "vitest run --config vitest.balance.config.ts"
vitest.config.ts or vite.config.ts  MOD  exclude tests/balance/** from the default run
index.html                       MOD  description, theme-color, favicon
public/favicon.svg               NEW  code-drawn golden pickaxe
README.md                        MOD  Run it, Controls, Credits, Pacing
```

---

### Task 1: The reference-run simulator

**Files:** create `src/core/sim.ts`, `tests/balance/referenceRun.test.ts`, `vitest.balance.config.ts`; modify `vite.config.ts` (exclude `tests/balance/**`) and `package.json` (the `balance` script). Test: the new balance test.

**Interfaces:**
- `src/core/sim.ts`:
  - `export interface SimOptions { seed?: number; days?: number; clickRate?: number }`
  - `export interface SimReport { firstMapSec: number; autoMapLevel: number; autoMapDay: number; capDay: number; deepestAtCap: number; frontierTierAtCap: number; frontierTierAfterDay: number; ascensionPointsAtCap: number; clears: Record<number, number>; losses: Record<number, number> }`
  - `export function runReference(options?: SimOptions): SimReport`
  - Internals: `newGame(seed, 0)`, a minute clock, `applyTicks(state, ticks, deriveStats(state), undefined, paused, away)`, `startMap`, `deriveBattleStats`, `gainXp` (via the engine), `allocate`/`canAllocate` from passives, `queueForAutoMap`/`autoMapMaxTier` from autoMap, `ascendancyPoints` from ascendancy. A tiny `equipBest(state)` helper and a `clearBag(state)` helper. `firstMapSec` is the first minute a `map` find appears in `state.finds` (or the first `map` in the bag) × 60.
- The simulator must **not** import from `src/ui/**` or `src/store/**`.

**Key tests:** the balance test runs `/referenceRun({ seed: 12345, days: 8 })`, prints the report with `console.log`, and asserts the Targets above (the exact bands are the plan's Decisions). It may take minutes; the config gives it a 10-minute timeout.

**Step order:** write the failing balance test → implement `sim.ts` → run `npm run balance` and record the first report → full `npm test`/`npm run typecheck` (the default run must still be fast) → commit `Add the reference-run balance simulator`.

---

### Task 2 (parallel): Launch metadata and docs

**Files:** modify `index.html`, `README.md`; create `public/favicon.svg`. (No `package.json` change — Task 1 owns the script; the README may reference it.)

**Interfaces:**
- `public/favicon.svg`: a 32×32 or 64×64 viewBox, dark background, a simple golden pickaxe or a miner's lamp in the game's gold `#e8b44a`. Hand-written SVG, no external assets.
- `index.html`: description (`An idle mining game: dig deeper, find gold, gems and maps, and run dungeons.`), `theme-color`, the icon link.
- `README.md`: add `npm run balance` to Run it; add a **Controls** section (click the mine to dig; right-click an item for actions; Ctrl/Cmd+click sell; Alt+click salvage; Shift+click move; Pause; the map card's Run/Auto-map); add a **Credits** section (fonts, placeholder pixels, the 2013 original, MIT — link `LICENSE`).

**Key checks:** `npm run build` stays green; the README renders; no source-code change.

---

### Task 3: Tune to the targets

**Files:** `src/core/balance.ts` (and only it, unless a target constant lives elsewhere). Test: `tests/balance/referenceRun.test.ts`, `tests/core/mapClear.test.ts`, the full suite.

**Interfaces:** move the constants in the recorded order. After each change, run `npm run balance`, record the report in this plan's measured table, and stop when every target holds. Then run the full suite; update only tests that pin a moved constant, with a note.

**Measured table (fill in):**

| Run | xpToNext | monsterXp | cap day | auto-map day | first map s | deepest at cap | frontier at cap → +1 day | asc points |
|---|---|---|---|---|---|---|---|---|
| initial | 100 × L^1.5 | 10 × tier^1.5 | | | | | | |
| final | | | | | | | | |

**Step order:** run the sim → tune → re-run → full suite → commit `Tune the run to the pacing targets`.

---

### Task 4: Final QA and the measured README

**Files:** `README.md` (the Pacing paragraph), `docs/superpowers/plans/2026-10-26-plan-13-balance-and-launch.md` (the measured table).

**Checks:** `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; a 1280×900 and 390×844 smoke of Mine / Inventory / Skills / Ascend / Merchant / Log and a map run; confirm the favicon and metadata in `dist/index.html`. Commit `Finish the launch surface`.

---

## Definition of done

- `npm run balance` prints a report inside every target band.
- `npm test`, `npm run typecheck` and `npm run build` are green.
- `index.html` and `public/favicon.svg` are launch-ready.
- The README covers Run it (including the balance command), Controls, Credits and the measured pacing.
- The plan's measured table records the initial and final runs.
- No schema change; no new dependency; no push.
