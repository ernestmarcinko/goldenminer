# Plan 18: Character stats — fix the damage model and add the stats panel

**Goal:** Fix the local-vs-global damage bug (a weapon's enhanced damage must apply to the weapon's own damage, with non-weapon enhanced damage layered on top), audit the other stats with the same flaw, and give the character a proper ARPG-style stats sheet on the Mine and Inventory screens — DPS, damage range, resistances, life, armor, dig speed, find, and the rest.

- **The bug.** Today `deriveBattleStats` sums *every* source of `damage` and `damagePct` into one global pool: `(baseDamage(level) + g.damage) * pct(g.damagePct)`. A weapon's `damage`/`damagePct` is folded in with the amulet, ring, helm, passives and gems, so "enhanced damage on the weapon" is not applied to the weapon — it is applied to everything. The weapon card also never shows the weapon's *overall* damage.
- **The fix.** Split the relevant stats into **local** (the item's own contribution to its base) and **global** (everything else). Local applies to the item's base first; global applies on top. The weapon, armor and pickaxe are the three local slots.
- **The panel.** A shared character sheet, shown on Mine (mining stats) and Inventory (both sets), computed from the same derived values the game actually uses, so it can never disagree with what happens on screen.

**Architecture:**

- **Core** (`src/core/stats.ts`, `src/core/battle.ts`): a `localTotals(slot, item)` helper separates a slot's local flat/percent contributions; `deriveBattleStats`/`deriveStats` apply local first, then global. A new `deriveCharacterSheet(state)` (pure, no DOM) returns the display rows (DPS, ranges, resistances, dig speed, etc.).
- **UI** (`src/ui/character/CharacterSheet.tsx`, reused by Mine and Inventory): renders the sheet from `deriveCharacterSheet`, reusing the existing `statText` and `formatNumber`. It is read-only and needs no store mutation.

**Tech stack:** unchanged. No new dependencies. **No schema change** (the math is derived, not stored).

**Spec:** main design §3 (gear and stats) and §5 (the character screen); `src/core/stats.ts`, `src/core/battle.ts`, `src/core/items.ts` (the code being corrected); the README's "Gear" section (the newer modifiers, which change meaning for the three local slots).

**Builds on:** Plan 17 (`dev-ernest`).

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · **18. character stats — fix and display** (this plan) · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. start screen · 25. skill-tree layout · 26. ascendancy-tree rebalance · 27. crafting rebalance · 28. mining animation · 29. ascendancy icons · 30. damage types and resistances · 31. unified equipment · 32. achievement notifications.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM. The sheet is computed in core, drawn in UI.
- **The panel shows the real numbers.** Every row comes from the same functions the game runs (`deriveStats`/`deriveBattleStats`), never a parallel re-implementation.
- **Clamps hold.** The local/global split still feeds the same `MAX_DAMAGE`/`MAX_ARMOR`/`MAX_DIG_POWER` clamps; no value escapes a bound.
- **The early game balance is preserved.** The fix changes *where* a multiplier applies, not the totals a fresh miner has (level 1, no gear: unchanged). The clear-rate test stays green; where a clear-rate test pinned an old total, it is re-measured and the plan's measured table records the delta.
- Phones: the sheet reads at 390 × 844; on Mine it collapses behind a toggle, on Inventory it sits in the character column.
- No new dependencies; full suite, typecheck and build green.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **The weapon's damage is local.** A weapon with +damage and +damagePct shows its own overall damage (min–max) on its card, and that number is what feeds the global `(base + weapon + other) × global%` sum. A test builds two weapons and asserts the local/global split.
2. **The audit is complete.** The plan's local-stat table is confirmed for armor and pickaxe, and a `grep` shows no other `*Pct` stat is being applied globally when it should be local.
3. **The panel matches the game.** DPS, damage range, life, armor, resistances, dig power and dig speed all equal what a tick actually uses; a test compares the sheet to `deriveStats`/`deriveBattleStats`.
4. **Nothing regressed.** The balance sim's clear rates hold after the fix (re-measured, recorded).

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Local vs global | A **local** stat on a slot multiplies that slot's own base/affix values before the global sum. **Global** is everything else, applied on top. |
| Local slots | **Weapon** — `damage` (flat) and `damagePct` (%) are local; **Armor** — `armor` and `armorPct` are local; **Pickaxe** — `digPower` and `digPowerPct` are local. `elementalDamage` stays global (added to every hit after the roll); it is reviewed but not moved in this plan. |
| Weapon formula | `weaponDamage = (weaponFlat) × pct(weaponDamagePct)`, where `weaponFlat` is the weapon's implicit `damage` + its `damage` affixes. Total: `(baseDamage(level) + weaponDamage + otherFlat) × pct(globalDamagePct)`, then elemental and keystones as today. |
| Armor formula | `armor = (armorLocal) × pct(armorLocalPct) + otherFlatArmor`, then `× pct(globalArmorPct)`. |
| Pickaxe formula | `digPower = (BASE_DIG_POWER + pickaxeLocal) × pct(pickaxeLocalPct)`, then the rest of `deriveStats` as today. |
| DPS | `dps = (min + max) / 2 × attacksPerSecond × (1 + critChance × (critMultiplier − 1))`, shown to one decimal. |
| The sheet | A `CharacterSheet` with two halves: **Mining** (dig power, dig speed m/min, ticks/click, auto ticks/s, offline cap, hazard ward, gold/diamond/vein multipliers, find chances, ore bonus, sell/salvage) and **Battle** (damage min–max, DPS, attacks/s, crit chance, crit multiplier, elemental damage, life, armor + reduction %, resistances, life regen, life on kill, XP/magic/soul find). |
| Placement | Mine: a collapsible "Character" panel. Inventory: the sheet sits with the paper doll (both sets, or a mining/battle toggle). |

## File structure

```
src/core/
  stats.ts          MOD  localTotals, the local/global split, deriveCharacterSheet
  battle.ts         MOD  weapon-local damage and armor-local application
  items.ts          MOD  export a LOCAL_STATS table (which stats are local per slot)
tests/
  core/stats.test.ts      MOD  the local/global split; the sheet matches the derived values
  core/battle.test.ts     MOD  weapon/armor local damage; DPS
  core/mapClear.test.ts   MOD  re-measured clear rates (unchanged band)
src/ui/
  character/CharacterSheet.tsx  NEW  the shared sheet component
  character/character.css       MOD  sheet styles
  mine/MineView.tsx             MOD  the collapsible sheet
  inventory/InventoryView.tsx   MOD  the sheet beside the paper doll
```

---

### Task 1: The local/global split

**Files:** `src/core/items.ts`, `src/core/stats.ts`, `src/core/battle.ts`; tests `tests/core/stats.test.ts`, `tests/core/battle.test.ts`.

**Interfaces:**
- `LOCAL_STATS: Readonly<Partial<Record<Slot, readonly StatKey[]>>>` — `weapon: ['damage', 'damagePct']`, `armor: ['armor', 'armorPct']`, `pickaxe: ['digPower', 'digPowerPct']`.
- `localTotals(item)` returns the item's local flat and percent contributions; `gearTotals` keeps the global sum but excludes the local stats from the global pool.
- `deriveBattleStats` applies weapon-local damage, then the global sum; `deriveStats` applies pickaxe-local dig power.

**Tests:** a weapon with +`damage`/`damagePct` changes only the weapon's share, not the amulet's; armor/armorPct are local; a level-1 naked miner is byte-identical to before. The clear-rate test is re-run and recorded.

**Step order:** write the failing split tests → `LOCAL_STATS`/`localTotals` → apply in `battle.ts`/`stats.ts` → re-run `npm run balance` and record the clear-rate delta → commit `Apply weapon and armor damage locally`.

---

### Task 2: The derived character sheet

**Files:** `src/core/stats.ts` (add `deriveCharacterSheet`); test `tests/core/stats.test.ts`.

**Interfaces:** `deriveCharacterSheet(state): CharacterSheet` — a pure structure of display rows (mining and battle), including `dps`, `damageMin`/`damageMax`, `armorReductionPct`, `digSpeedMetresPerMinute`, `findChances`, and the yield multipliers. Every row reads from `deriveStats`/`deriveBattleStats`, never recomputes independently.

**Tests:** the sheet's rows equal the derived values for a seeded state; `dps` matches the formula; `armorReductionPct` matches the armor reduction the combat code uses.

**Step order:** write tests → implement → commit `Derive the character sheet`.

---

### Task 3: The panel on Mine and Inventory

**Files:** `src/ui/character/CharacterSheet.tsx` (new), `character.css`, `mine/MineView.tsx`, `inventory/InventoryView.tsx`.

**Work:** render `CharacterSheet` from `deriveCharacterSheet`; on Mine as a collapsible "Character" panel (mining stats first), on Inventory beside the paper doll (mining/battle toggle). Reuse `statText`/`formatNumber`. Keep 44 px targets and the 390 px layout.

**Tests:** `npm run build`; a browser check at 1280×900 and 390×844 on both screens.

**Step order:** the component → Mine → Inventory → CSS → commit `Show the character sheet`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; a map run confirms the new damage reads correctly in combat; the measured table below is filled in.

**Commit:** `Finish the character stats`.

---

## Measured table

| Run | tier-1 clear % | tier-2 clear % | naked damage (lvl 1) |
|---|---|---|---|
| before | ~66% | ~70% | 2–4 |
| after | ? (same band) | ? | 2–4 |

---

## Definition of done

- Weapon/armor/pickaxe enhanced damage is applied locally, then global mods on top; the weapon card shows its overall damage.
- No other stat has the same local/global flaw (the audit is recorded).
- The Mine and Inventory screens show a correct, complete character sheet (DPS, damage, life, armor, resistances, dig speed, find, yields).
- The clear-rate band holds after the fix; the full suite, typecheck and build are green; no schema change; no push.
