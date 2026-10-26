# Plan 20: Achievements

**Goal:** Add an achievement system in the spirit of Minecraft and Cookie Clicker: a very large, data-driven list (up to ~1000) of one-time achievements across every system, carried over ascensions, each granting a small **permanent global boost** — so earning achievements is a second, permanent progression track that runs alongside (and survives) the ascendancy tree.

- **Many, progressively harder.** Achievements are generated from *families* × *thresholds*, not hand-written one by one: some are trivial (dig your first metre, find your first gold vein), and they climb to the very long tail (reach 10,000 m, clear 500 maps, ascend 10 times, hold 1,000,000 Gold).
- **Permanent.** Achievements live in a `state.achievements` store that `ascend()` never clears, like `lifetime`. They are the "carry over ascensions" layer.
- **A global boost.** Each earned achievement adds a small permanent multiplier to the character's stats — the owner floated ~0.5% per achievement; this plan adopts that as `ACHIEVEMENT_BOOST = 0.005` per achievement, applied to the final derived values so it compounds with gear, the web and ascendancy but never re-enters the pool.

**Architecture:**

- **Core** (`src/core/achievements.ts`): a pure table of `AchievementDef { id, name, desc, family, value }` generated from family/threshold pairs; a cheap `checkAchievements(state)` that marks any whose condition now holds; `earnedCount(state)`; and `achievementBoost(state)` (the multiplier). No React, no DOM.
- **Triggers** are hook points in the existing event code (`dig.ts`, `combat.ts`, `loot.ts`, `ascend.ts`, `merchant.ts`, `crafting.ts`, `levels.ts`) that call `checkAchievements` with the relevant family and running totals. Conditions are monotonic counters or one-time events, so each is checked once and stays cheap.
- **Boost** is applied at the end of `deriveStats`/`deriveBattleStats` as a single `pow = 1 + ACHIEVEMENT_BOOST × earned` multiplier to the offensive/defensive/yield values, before the existing `MAX_*` clamps.
- **UI** (`src/ui/achievements/`): a new Achievements tab (or a panel reachable from the header) listing families, earned vs unearned, progress, and the total boost. It reads only; no mutation.

**Tech stack:** unchanged. No new dependencies. **One schema bump** (13 → 14) for the achievements store.

**Spec:** main design §4 (progression) and §5 (screens); this is a new system, so it also extends the design's permanent-progression story beyond ascension.

**Builds on:** Plans 15, 17 and 18 (`dev-ernest`): the level bonus and ascension carry-over (15), the schema-13 baseline (17), and the corrected stats the boost multiplies (18).

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · **20. achievements** (this plan) · 21. the wiki.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`.
- **The boost never re-enters the pool.** It multiplies the final derived values only; it is not a `StatKey`, so it cannot be rolled on gear or read back as a bonus.
- **Deterministic and cheap.** The achievement table is a pure function of its family/threshold data; checks are monotonic and evaluated only on their own events. A run with no achievements is byte-identical to today.
- **Clamps hold.** The boost feeds the existing `MAX_*` clamps; a huge achievement count is endgame and still bounded.
- **Migration is explicit and tested.** `SCHEMA_VERSION` 13 → 14; the migration adds `state.achievements = { earned: [] }` (or back-fills the easy ones already true). Old saves load unchanged.
- Phones: the achievements tab reads at 390 × 844; targets ≥ 44 px.
- No new dependencies; full suite, typecheck and build green.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **It is genuinely large.** The generated table has ~1000 entries across the families; a test asserts the count and that ids are unique.
2. **It carries over ascension.** `ascend()` keeps `state.achievements`; a test ascends and asserts the earned set survives.
3. **The boost is real and bounded.** Each achievement adds 0.5% to the derived dig power/damage/life/yield; a test checks the multiplier and that it never bypasses a clamp.
4. **Triggers fire once.** Earning is idempotent; a counter achievement marks once and never again; the table stays cheap.
5. **Old saves migrate.** A schema-13 save loads to 14 with an empty (or correctly back-filled) earned set.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Boost | `ACHIEVEMENT_BOOST = 0.005` per achievement: `pow = 1 + 0.005 × earned`, applied to the final dig power, damage, life, armor, gold/diamond/vein multipliers, and find chances. The owner floated "0.5% for every stat per achievement"; this is that, as one clean multiplier on the final values. |
| Size | ~1000 achievements, generated from families × thresholds. Hand-written text only for the family labels; individual ids are `<family>.<value>`. |
| Families | `depth` (reach N metres), `dig` (dig N metres total), `gold` (earn N Gold lifetime), `diamonds` (earn N), `ore.<material>` (find N of each ore), `gems` (find N), `maps` (clear N), `kills` (kill N), `bosses` (kill N bosses), `deaths` (die N), `levels` (reach level N), `ascensions` (ascend N), `craft` (craft N), `merchant` (buy N), `legendaries` (own N), `sockets` (socket N gems). Roughly 16 families × ~60 thresholds ≈ 960. |
| Thresholds | Logarithmic-ish per family (e.g. depth: 10, 25, 50, 100, 250, 500, 1000, …, 10000). Easy ones land in the first session; the tail is endgame. |
| Carry-over | `state.achievements = { earned: string[] }`; `ascend()` does not touch it (only `lifetime` and the run reset). |
| Schema | `SCHEMA_VERSION` 13 → 14; migration adds the store (empty; back-filling past progress is optional and skipped to keep the migration trivial). |
| UI | A new "Achievements" tab in the Nav, grouped by family, each row showing name, description, and earned/not; a header line shows the running total and the global boost. |

## File structure

```
src/core/
  achievements.ts   NEW  the generated table, checkAchievements, earnedCount, achievementBoost
  stats.ts          MOD  apply achievementBoost to the final mining values
  battle.ts         MOD  apply achievementBoost to the final battle values
  dig.ts            MOD  hook: depth/dig/ore/gem/gold/diamond counters
  combat.ts         MOD  hook: kills/bosses/deaths
  loot.ts           MOD  hook: finds (gold, gems, ores)
  ascend.ts         MOD  hook: ascensions; keep achievements across the reset
  levels.ts         MOD  hook: level reached
  merchant.ts       MOD  hook: buys
  crafting.ts       MOD  hook: crafts
  save.ts           MOD  SCHEMA_VERSION 14, migration, isAchievements
  types.ts          MOD  state.achievements
src/ui/
  achievements/     NEW  AchievementsView, achievements.css
  Nav.tsx / navView.ts MOD the Achievements tab
tests/
  core/achievements.test.ts  NEW  table size/uniqueness, earn-once, boost, carry-over
  core/save.test.ts          MOD  schema-13 → 14 migration
  ui/achievements.test.ts    NEW  the tab renders families and progress
```

---

### Task 1: The achievement table and the boost

**Files:** `src/core/achievements.ts`, `src/core/stats.ts`, `src/core/battle.ts`; test `tests/core/achievements.test.ts`.

**Interfaces:** `AchievementDef`; `ACHIEVEMENTS: readonly AchievementDef[]` (~1000, generated); `earnedCount(state)`; `achievementBoost(state) = 1 + ACHIEVEMENT_BOOST × earned`; `checkAchievements(state)` marks any whose monotonic condition holds. `deriveStats`/`deriveBattleStats` multiply their final offensive/defensive/yield values by `achievementBoost`.

**Tests:** the table has ~1000 unique ids across the families; each achievement adds 0.5% to a seeded state's damage/dig power/life; the boost never exceeds a clamp; a no-achievement run is byte-identical.

**Step order:** write the size/boost tests → the table generator + boost → apply in stats/battle → commit `Add the achievement table and global boost`.

---

### Task 2: Triggers and carry-over

**Files:** `src/core/dig.ts`, `combat.ts`, `loot.ts`, `ascend.ts`, `levels.ts`, `merchant.ts`, `crafting.ts`, `types.ts`; test `tests/core/achievements.test.ts`.

**Interfaces:** `GameState` gains `achievements: { earned: string[] }`. Each hook calls `checkAchievements(state)` after the relevant event; `ascend()` leaves `state.achievements` untouched while resetting the run.

**Tests:** digging marks the first depth achievement once and not again; ascension keeps the earned set; a counter (kills) marks at its threshold and stays marked.

**Step order:** the state field → the hooks → the ascension keep → commit `Trigger achievements and carry them over ascension`.

---

### Task 3: The Achievements tab

**Files:** `src/ui/achievements/*` (new), `src/ui/Nav.tsx`, `navView.ts`; test `tests/ui/achievements.test.ts`.

**Work:** add an Achievements tab to the Nav; the view lists families, each achievement with name/description/earned state, and a header showing `earned / total` and the current `+X%` global boost. Reuse `formatNumber`. 390 × 844 re-checked.

**Tests:** the view renders every family and the earned count/boost line.

**Step order:** the view → the tab → CSS → commit `Show the achievements`.

---

### Task 4: Migration and final QA

**Files:** `src/core/save.ts` (schema 14 + migration + `isAchievements`); tests `tests/core/save.test.ts`.

**Work:** bump `SCHEMA_VERSION` to 14; add the migration (empty earned set) and the validator. Full QA: `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; a schema-13 save loads to 14; the boost shows in the character sheet and the achievements tab.

**Commit:** `Finish the achievement system`.

---

## Definition of done

- ~1000 data-driven achievements across the families, easy to endgame, each granting +0.5% permanent global boost.
- Achievements carry over ascension and are checked once, cheaply, at their own events.
- The Achievements tab shows families, progress and the running boost; the boost is reflected in the character sheet.
- `SCHEMA_VERSION` is 14 with a tested migration; old saves load unchanged.
- Full suite, typecheck and build are green; nothing pushed.
