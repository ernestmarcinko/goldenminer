# Plan 30: Damage types and resistances

**Goal:** Replace the flat armor/resistance model with a proper physical-vs-elemental damage model. Armor becomes a real ARPG armor curve — uncapped, asymptotic toward a 95 % hard cap, but where the incoming-hit divisor scales with character level so a higher level needs more armor to reach the cap. Elemental resistance becomes a level-taxed stat: base elemental resist starts at 0 and goes *negative* with level, the effective resist caps at 75 % by default, and a new affix/skill raises that cap to at most 95 %. Both the armor-reduction percentage and the base elemental resist are shown on the character sheet.

- **Two damage types.** Physical and elemental already exist (`Element = 'physical' | 'elemental'`, `ELEMENTS` in `types.ts`); monsters already carry one or the other (a species' `element`, or `fireTouched` on a champion). This plan does not add a third type; it makes the two types *mitigate differently*.
- **Armor → physical.** Armor softens only physical hits, as today, but the flat `armor / (armor + ARMOR_FACTOR × raw)` becomes `armor / (armor + armorFactor(level) × raw)`, uncapped until `MAX_ARMOR_REDUCTION = 0.95`. `armorFactor(level)` rises with level, so a level-100 miner needs more armor than a level-1 miner to hit the same reduction against the same hit.
- **Resist → elemental.** `resistAll` stops being clamped at 0: a new level penalty `baseResist(level) = -(level - 1)` is added, so at level 1 elemental resist is 0 and every level pushes the *base* further negative, making it harder to reach the cap with gear. The effective resist is clamped to `[MIN_RESIST, maxResist]`, where `maxResist = 75 + maxResistAll` and `maxResistAll` is a new stat (items + skills) capped so the effective cap can rise from 75 % to at most 95 %.
- **Display.** The character sheet keeps the "Armor reduction" row (now level-scaled) and gains "Base elemental resist" and "Max resistances" rows; "Resistances" now shows the effective, possibly negative, number.

**Architecture:**

- The change is concentrated in `src/core/battle.ts` (the formulas and `BattleStats`), `src/core/balance.ts` (the constants and `baseResist`/`armorFactor`), and `src/core/stats.ts` (the sheet rows). `mitigate` gains a `level` argument, so `combat.ts` passes `state.level`; `armorReduction` gains a `level` argument, so `stats.ts` and `battle.ts` pass it.
- A new battle stat `maxResist` joins the exhaustive stat catalogue — `items.ts` (`BATTLE_STATS`), `balance.ts` (`STAT_TIERS`), `itemData.ts` (`STAT_NAMES`/the essence adjective/`MOD_SIDE` lives in `items.ts`), `passives.ts` (a node that grants it), `skillIcons.ts` (an icon), and `itemView.ts` (`STAT_LABELS`). Because the stat set drives essences, loot-filter fields, gem/passive pools and the save validator, adding one stat touches each of those lists once.
- **No schema change.** The base-resist penalty and the max-resist cap are derived from `state.level` and gear totals; nothing new is persisted. `SCHEMA_VERSION` is unchanged. Old saves load and simply play with the new numbers.
- The balance simulator (`src/core/sim.ts`) and the clear-rate test (`tests/core/mapClear.test.ts`) are the measurement tools. Both are re-pinned because the rebalance changes how much damage the reference miner survives.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. No schema change.

**Spec:** main design §4.9 (pacing/reference player) and §4.8 (ascension) for the reference run; the combat/damage numbers this plan re-pins were last set by Plan 5 (maps/combat/levels), Plan 10 (monster scaling), Plan 18 (the character sheet's armor-reduction row) and Plan 20 (the achievement boost).

**Builds on:** Plans 15–29 (`dev-ernest`); the character-sheet plumbing from Plan 18, the stats menu from Plan 22, and the exhaustive stat catalogue from Plans 7/17/23.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24–29. (planned, not yet written) · **30. damage types and resistances** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`.
- **No schema change.** `SCHEMA_VERSION` is unchanged; the base-resist penalty and the max-resist cap are derived, never stored. Old saves load and play unchanged (with the new numbers).
- **Physical and elemental stay the only two types.** `ELEMENTS` is untouched; a monster's `element` keeps flowing through `mitigate`.
- **Tests stay green after re-pinning.** Every Plan 1–29 test passes; the armor/resist expectations in `battle.test.ts`, the pinned replay in `combat.test.ts`, and the clear-rate bands in `mapClear.test.ts` are re-pinned *deliberately*, with the before/after recorded in the measured table.
- Phones: the character sheet's new rows re-checked at 390 × 844; no layout change beyond two extra rows.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **Armor is uncapped but capped.** `armorReduction` returns `armor / (armor + armorFactor(level) × raw)` clamped to `MAX_ARMOR_REDUCTION = 0.95`; a `grep` shows `MAX_ARMOR_REDUCTION` only there. `armorFactor(level)` is monotone in `level`, so a higher level needs more armor for the same reduction.
2. **Resist goes negative with level.** `baseResist(level) = -(level - 1)`; `deriveBattleStats` computes `resistAll = clamp(g.resistAll + baseResist(level), MIN_RESIST, maxResist)`, and `MIN_RESIST` is negative. A level-1 miner has 0 base resist; a level-50 miner has −49.
3. **The cap is raisable, 75 → 95.** `maxResist = clamp(75 + g.maxResist, 0, 95)`, so `maxResistAll` from items/skills can lift the effective cap to at most 95 %, never beyond.
4. **The sheet shows all three.** `deriveCharacterSheet` exposes "Armor reduction" (level-scaled), "Resistances" (effective, possibly negative), "Base elemental resist" (the penalty) and "Max resistances" (the cap); a test pins each against `deriveBattleStats`.
5. **The rebalance is measured.** The sim and the clear-rate test report the new bands; the measured table records before/after so the change in difficulty is visible, not assumed.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Armor formula | `armorReduction(armor, level, raw) = armor > 0 ? min(MAX_ARMOR_REDUCTION, armor / (armor + armorFactor(level) × raw)) : 0`, with `MAX_ARMOR_REDUCTION = 0.95` (was 0.9) and `armorFactor(level) = ARMOR_FACTOR + ARMOR_FACTOR_LEVEL × (level - 1)`. `ARMOR_FACTOR = 10` (unchanged, so level 1 behaves exactly as today) and `ARMOR_FACTOR_LEVEL = 0.25` (tuned: a level-100 miner needs ~3.5× the armor of a level-1 miner to reach the same reduction). |
| Base elemental resist | `baseResist(level) = -(level - 1)` via `RESIST_PENALTY_PER_LEVEL = 1`: 0 at level 1, −49 at level 50, −99 at level 100. A single tuning knob. |
| Resist floor | `MIN_RESIST = -200`. Negative resist is allowed (and *amplifies* elemental damage — the "harder to compensate" effect), but the floor keeps degenerate gear from producing absurd values. |
| Resist cap | `MAX_RESIST = 75` stays the base cap; new `MAX_RESIST_HARD_CAP = 95`. `maxResist = clamp(MAX_RESIST + clamp(g.maxResist, 0, MAX_RESIST_HARD_CAP - MAX_RESIST), 0, MAX_RESIST_HARD_CAP)`, so +0..+20 `maxResist` raises the cap 75..95. |
| The new stat | `maxResist` (a `BattleStat`, suffix side, `STAT_TIERS { base: 1, step: 1 }`, label "Max resistances", essence adjective "the Aegis"). Small tiers because the whole useful range is +20. |
| Effective resist | `resistAll = clamp(g.resistAll + baseResist(level), MIN_RESIST, maxResist)`. Gear/passive `resistAll` is unchanged; only the clamp and the level penalty are new. |
| `mitigate` signature | `mitigate(raw, element, b, level)` — `armorReduction` now needs `level`; `combat.ts` already holds `state.level` at the call site. Elemental stays `raw × (1 - resistAll / 100)` (which, with a negative `resistAll`, is more than the raw hit). |
| `BattleStats` | Adds `maxResist: number` and `baseResist: number` beside the existing `resistAll`; `resistAll` is now the effective, possibly negative, value. |
| Character sheet | "Armor reduction" reads `armorReduction(battle.armor, state.level, monsterDamageBase(metreTier(state.deepest + 1)))`; "Resistances" reads `battle.resistAll`; two new rows "Base elemental resist" (`battle.baseResist`) and "Max resistances" (`battle.maxResist`), both `percent`. |
| Passive/skill source | A new passive notable grants flat `maxResist` (e.g. +5 %), satisfying "through items and skills"; the exact node and its position are a Plan-16-web addition, listed in the passive catalogue the way `resistAll` already is. |
| Rebalance | This is a deliberate re-pin, not a hidden nerf. The sim and clear-rate test are re-measured; if the naked-first-map or tier-1/2 bands drift out of range, tuning moves `ARMOR_FACTOR_LEVEL`, `RESIST_PENALTY_PER_LEVEL`, and (last resort) `MAP_MONSTER_SCALE` — never the drop rates. |

## File structure

```
src/core/
  balance.ts       MOD  MAX_ARMOR_REDUCTION 0.9 -> 0.95; ARMOR_FACTOR_LEVEL; MAX_RESIST_HARD_CAP = 95;
                        MIN_RESIST = -200; RESIST_PENALTY_PER_LEVEL = 1; armorFactor(level), baseResist(level);
                        STAT_TIERS.maxResist
  battle.ts        MOD  BattleStats.maxResist/baseResist; armorReduction(armor, level, raw);
                        deriveBattleStats computes maxResist + baseResist + effective resistAll;
                        mitigate(raw, element, b, level)
  items.ts         MOD  BATTLE_STATS + 'maxResist'; MOD_SIDE.maxResist = 'suffix'
  itemData.ts      MOD  STAT_NAMES.maxResist; the essence adjective for maxResist; GEM_EFFECTS untouched
  passives.ts      MOD  a notable granting flat maxResist; the label
  skillIcons.ts    MOD  a maxResist icon (or reuse RESIST_ALL)
  stats.ts         MOD  sheet: level-scaled Armor reduction; Resistances + Base elemental resist + Max resistances rows
  combat.ts        MOD  pass state.level into mitigate
src/ui/character/
  itemView.ts      MOD  STAT_LABELS.maxResist { label: 'maximum resistances', unit: '%' }
tests/
  core/battle.test.ts        MOD  re-pin the naked-miner shape, the 1e6-armor mitigate numbers, the level-scaled formulas
  core/gearStats.test.ts     MOD  armorReduction(armor, level, raw); the new sheet rows
  core/combat.test.ts        MOD  re-pin fixture7 replay (negative base resist changes the saved run)
  core/mapClear.test.ts      MOD  re-measure the clear-rate bands
  core/save.test.ts          MOD  (guard only) a maxResist affix round-trips; schema is unchanged
  balance/referenceRun.test.ts MOD  re-measure the reference-run targets
```

---

### Task 1: The armor curve and the level-scaled divisor

**Files:** `src/core/balance.ts`, `src/core/battle.ts`, `src/core/combat.ts`, `src/core/stats.ts`; tests `tests/core/battle.test.ts`, `tests/core/gearStats.test.ts`.

**Interfaces:**
- `balance.ts`: `MAX_ARMOR_REDUCTION = 0.95`; `ARMOR_FACTOR = 10` (kept) plus `ARMOR_FACTOR_LEVEL = 0.25`; `export function armorFactor(level: number): number { return ARMOR_FACTOR + ARMOR_FACTOR_LEVEL * (level - 1); }`.
- `battle.ts`: `armorReduction(armor: number, level: number, raw: number): number` returns `armor > 0 ? Math.min(MAX_ARMOR_REDUCTION, armor / (armor + armorFactor(level) * raw)) : 0`. `mitigate(raw: number, element: Element, b: BattleStats, level: number): number` passes `level` through to `armorReduction` on the physical branch; the elemental branch is unchanged.
- `combat.ts`: the `bloodMoney`/`mitigate` call becomes `mitigate(m.damage, m.element, b, state.level)`.
- `stats.ts`: the sheet's `armorReduction(battle.armor, monsterDamageBase(...))` becomes `armorReduction(battle.armor, state.level, monsterDamageBase(metreTier(state.deepest + 1)))`.

**Tests:**
- `armorReduction` is 0 at 0 armor, monotone, and equals `min(0.95, armor/(armor + armorFactor(level)·raw))`; at level 1 it is byte-identical to the old `armor/(armor + 10·raw)`; at level 100 the same armor yields a smaller reduction.
- `mitigate` physical with 1e6 armor now floors at `max(1, round(raw × 0.05))` (the 0.95 cap), re-pinning the old `10` → `5` for `raw = 100`.
- The sheet "Armor reduction" row equals `armorReduction(battle.armor, state.level, ...) × 100`.

**Step order:** change the constants/`armorFactor` → `armorReduction`/`mitigate` signatures → the two call sites → re-pin `battle.test.ts`/`gearStats.test.ts` → `npx vitest run tests/core/battle.test.ts tests/core/gearStats.test.ts` → commit `Make armor a level-scaled curve capped at 95 %`.

---

### Task 2: The elemental-resist model and the `maxResist` stat

**Files:** `src/core/balance.ts`, `src/core/battle.ts`, `src/core/items.ts`, `src/core/itemData.ts`, `src/core/passives.ts`, `src/core/skillIcons.ts`; tests `tests/core/battle.test.ts`, `tests/core/save.test.ts`.

**Interfaces:**
- `balance.ts`: `MAX_RESIST = 75` (kept), `MAX_RESIST_HARD_CAP = 95`, `MIN_RESIST = -200`, `RESIST_PENALTY_PER_LEVEL = 1`; `export function baseResist(level: number): number { return -(level - 1) * RESIST_PENALTY_PER_LEVEL; }`; `STAT_TIERS.maxResist = { base: 1, step: 1 }`.
- `items.ts`: `BATTLE_STATS` gains `'maxResist'`; `MOD_SIDE.maxResist = 'suffix'`.
- `itemData.ts`: `STAT_NAMES.maxResist = 'Max resistances'`; the essence adjective table gains `maxResist: 'the Aegis'`.
- `passives.ts`: a notable grants flat `maxResist` (e.g. `['maxResist', 5, 1]`), labelled "Maximum Resistances".
- `skillIcons.ts`: a `maxResist` icon (reuse `RESIST_ALL` is acceptable; a distinct glyph is nicer).
- `battle.ts`: `BattleStats` gains `maxResist: number` and `baseResist: number`; `deriveBattleStats` computes `const base = baseResist(state.level)`, `const maxResist = clamp(MAX_RESIST + clamp(g.maxResist, 0, MAX_RESIST_HARD_CAP - MAX_RESIST), 0, MAX_RESIST_HARD_CAP)`, and `resistAll: clamp(g.resistAll + base, MIN_RESIST, maxResist)`.

**Tests:**
- `baseResist(1) === 0`, `baseResist(50) === -49`, `baseResist(100) === -99`.
- `deriveBattleStats` on a level-50 naked miner has `baseResist: -49` and `resistAll: -49`; with 130 `resistAll` of gear it has `resistAll: 75` (clamped to the base cap); with 130 `resistAll` plus 20 `maxResist` it has `resistAll: 81` and `maxResist: 95`.
- `maxResist` never exceeds 95 however large the affix; `resistAll` never drops below `MIN_RESIST`.
- A gear item carrying a `maxResist` affix validates and round-trips at the current schema (no migration).

**Step order:** constants + `baseResist` → the new stat through the catalogue lists → `deriveBattleStats` → re-pin `battle.test.ts` (naked-miner shape now has `maxResist`/`baseResist`) → `npx vitest run tests/core/battle.test.ts tests/core/save.test.ts` → commit `Add elemental resist with a level penalty and a raisable 75–95 % cap`.

---

### Task 3: The character sheet rows

**Files:** `src/core/stats.ts`; tests `tests/core/gearStats.test.ts`.

**Interfaces:** in `deriveCharacterSheet`, the battle half becomes:
- "Armor reduction" — `armorReduction(battle.armor, state.level, monsterDamageBase(metreTier(state.deepest + 1))) * 100` (already level-scaled from Task 1).
- "Resistances" — `battle.resistAll` (the effective, possibly negative, value), `percent`.
- "Base elemental resist" — `battle.baseResist`, `percent`.
- "Max resistances" — `battle.maxResist`, `percent`.

**Tests:** the four rows equal the corresponding `deriveBattleStats` values for a seeded state, including a level where `baseResist` is negative.

**Step order:** add the two rows and read the others from `battle` → `npx vitest run tests/core/gearStats.test.ts` → commit `Show armor reduction, base elemental resist and the resist cap on the sheet`.

---

### Task 4: Re-pin the combat, map-clear and reference-run tests

**Files:** `tests/core/combat.test.ts`, `tests/core/mapClear.test.ts`, `tests/balance/referenceRun.test.ts`, `src/core/sim.ts`.

**Work:** the rebalance changes how much the reference miner survives, so the pinned numbers move. `combat.test.ts`'s fixture7 replay (`rng: 4198657840`, `gained: { xp: 1040, … }`) is re-run and re-pinned (a negative base resist makes elemental hits land harder, changing the saved run's outcome and RNG stream). `mapClear.test.ts`'s bands (tier 1/2 ≥ 60 %, tiers 3–10 40–60 %, naked first map 60–80 %, early tier-2 miner 70–90 %) are re-measured. The sim is run to confirm the reference run still reaches its targets; if a band drifts out, tune `ARMOR_FACTOR_LEVEL` then `RESIST_PENALTY_PER_LEVEL`, and only as a last resort `MAP_MONSTER_SCALE`. Record the before/after in the measured table below.

**Key tests:** the three clear-rate bands and the reference run's `clears`/`losses`/`capDay`; the fixture7 replay re-pin.

**Step order:** run the current suite to snapshot "before" → re-pin `combat.test.ts`/`mapClear.test.ts`/`referenceRun.test.ts` → `npm run balance` → tune until the bands hold → record the table → commit `Re-pin combat, map-clear and reference-run numbers for the resist rebalance`.

---

### Task 5: Final QA

**Checks:** `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; confirm the measured table is filled in; confirm a migrated (old) save loads and plays with the new formulas; confirm the character sheet shows the two new rows at 1280 × 900 and 390 × 844. A `grep` for `MAX_ARMOR_REDUCTION`, `baseResist`, `maxResist` shows them only where this plan says; a `grep` for `Date.now`/`Math.random`/`!` under `src/core` returns nothing new.

**Commit:** `Finish the damage types and resistances rework`.

---

## Measured table

| Run | armor cap / factor | base resist | clear rate: naked tier-1 | clear rate: 3N miner tiers 3–10 | reference cap day |
|---|---|---|---|---|---|
| before (flat 90 % / 75 %) | 0.9, `ARMOR_FACTOR=10` | 0 (clamped ≥ 0) | 67 % (60–80 %) | 45/46/50/51/48/44/55/45 % (40–60 %) | 11.55 (see Plan 15) |
| final (95 % level-scaled / 75→95 %) | 0.95, `armorFactor(level)` | `-(level-1)` | 67 % (60–80 %) | 44/52/52/58/50/54/53/46 % (40–60 %) | 13.96 (10–18) |

> The 3N-miner numbers are the win rates for tiers 3–10 in order, over 100 seeded maps each. The final numbers are
> measured with `MAP_MONSTER_SCALE` tiers 3–10 re-tuned to `[2.00, 1.70, 1.58, 1.44, 1.29, 1.27, 1.18, 1.14]`
> (a few percent lower than the old `[2.05, 1.8, 1.7, 1.55, 1.4, 1.35, 1.3, 1.25]`): level-scaled armor and the
> negative base resist weaken the 3N miner, so the monster scale eases off by a factor that grows with tier. The naked
> tier-1 and early tier-2 miners are unchanged (67 % and 76 %).

---

## Definition of done

- Armor reduces only physical damage via `armor / (armor + armorFactor(level) × raw)`, clamped to 95 %; `armorFactor(level)` rises with level.
- Elemental resist reduces only elemental damage; base resist is `-(level - 1)`, the effective resist can go negative down to `MIN_RESIST`, and the cap is 75 % by default and raisable to at most 95 % via the new `maxResist` stat (items + skills).
- The character sheet shows armor reduction %, the effective resist, the base elemental resist, and the max-resist cap.
- No schema change; `SCHEMA_VERSION` is unchanged and old saves load.
- The combat, map-clear and reference-run tests are re-pinned with the measured table filled in; the full suite, typecheck and build are green; no push.
