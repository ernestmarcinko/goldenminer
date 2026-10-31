# Plan 38: 108 item bases — three roles per slot, four depth tiers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-base-per-slot model with 108 bases: 9 slots × 3 roles × 4 depth tiers.
- Each role has its own starting stat.
- Deeper tiers raise the ceiling, and from tier 3 a base adds a small second starting stat.
- A drop picks a random base among those unlocked at its item level.

**Architecture:**
- A new data module `src/core/bases.ts` holds the catalogue and the unlock and pick helpers.
- `GearItem` gains `base` (id) and an optional `implicit2`. `rollGear` picks the base and rolls the starting stats from it, so every source (dig, chests, maps, gambling, the Trader) follows without call-site changes.
- Stats add `implicit2`. Cards and the wiki show bases.
- Save 26 → 27.

**Tech Stack:** TypeScript 7, React 19, Vitest 5 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-31-round-5b-crafting-economy-bases-design.md` §7, §10, §11 (and §6a for the bases-found collection).
**Mockup:** board "Round 5b" (base cards and catalogue), approved as shown.
**Builds on:** Plan 37 (currencies never touch `implicit` or `implicit2`).

## Global Constraints

- **Roles** (spec §7, verbatim):

| Slot | Role A | Role B | Role C |
|---|---|---|---|
| pickaxe | `digPower` | `autoTickRate` | `oreFind` |
| lamp | `lampSight` | `gemFind` | `hazardWard` |
| gloves | `goldYield` | `diamondYield` | `ticksPerClick` |
| boots | `offlineCap` | `chestFind` | `mapFind` |
| weapon | `damage` | `elementalDamage` | `attackSpeed` |
| armor | `armor` | `resistAll` | `life` |
| helm | `life` | `resistAll` | `armor` |
| ring | `critChance` | `resistAll` | `lifeOnKill` |
| amulet | `damagePct` | `resistAll` | `soulFind` |

- **Role A** of every slot is today's `SLOT_IMPLICIT`. That keeps old items and old numbers intact.
- **Depth tiers** open at 0, 300, 1,000 and 5,000 m. (Ruling: as item levels `BASE_TIER_MIN_ILVL = [1, tierAt(300), tierAt(1000), tierAt(5000)]`, computed from `src/core/bands.ts`, so every drop source, which only knows an item level, follows the same rule.)
- **Ceiling:** `implicit.value = rollValue(stat, tierCap(ilvl)) × BASE_TIER_MULT[tier − 1]`, where `BASE_TIER_MULT = [1, 1.25, 1.5625, 1.953125]`, rounded as `rollValue` rounds.
- **Second starting stat:** tier 3 and 4 bases have one, with value `rollValue(stat2, tierCap(ilvl)) × 0.5`, rounded and at least 1.
  - `stat2` is per base, a different stat from the same set's pool. It never repeats the primary, and it's not a stat already used as another role's primary on that slot.
- **Old bases keep dropping:** a drop at item level L picks uniformly among all bases with `minIlvl ≤ L` for the chosen slot.
- **Ids:** base ids are stable strings `<slot>.<roleKey>.<tier>` (e.g. `armor.resist.2`) and become part of the save contract.
- **Names:** all 108 unique, in the game's tone. The mockup's rows are fixed names:
  - Pickaxe: Copper/Iron/Mithril/Abyssal Pick; Hand/Quick/Whirl/Storm Pick; Prospector's/Assayer's/Seeker's/Lodestar Pick.
  - Armor: Leather Apron/Chain Mail/Plate Coat/Abyssal Plate; Padded Vest/Warded Coat/Runed Robe/Void Mantle; Hide Vest/Bear Hide/Troll Hide/Titan Hide.
  - Weapon: Rusty Cleaver/Quarry Maul/War Pick/Abyssal Maul; Ember Rod/Spark Hammer/Storm Mace/Void Scepter; Tin Dagger/Iron Sickle/Twin Picks/Wind Blades.
- **Legendaries** keep their own definitions: `base` stays unset, and their starting stat stays `SLOT_IMPLICIT`.
- No `!`; no Claude/Anthropic attribution. Main suite, typecheck, build green after every task. `npm run balance` may stay red until Plan 39; report its numbers once per task.

## Review Focus

1. **An old schema-26 item.** It gets `base = <slot>.<roleA>.1`, keeps its exact starting value, and a card shows "base tier 1". No stat changes on load: the boost from an existing build is identical before and after.
2. **A Trader stock item or gambled item at a low depth** only ever has tier-1 bases. At the deepest tier-4 depth, all four tiers can appear.
3. **The magic-name generator** (`magicName`) uses the base name, so a magic Warded Coat reads e.g. "Hale Warded Coat", not the old band name.
4. **`resistAll` as a starting stat** is capped by `MAX_RESIST` like any other source. Stacking resistance-role helm, armour, ring and amulet can't push effective resist above the cap.
5. **The base-catalogue wiki page at 390 px** (108 rows) scrolls inside its box with no page-level horizontal scroll.

---

### Task 1: The catalogue and the pick

**Files:**
- Create: `src/core/bases.ts`, `tests/core/bases.test.ts`
- Modify: `src/core/balance.ts` (`BASE_TIER_MULT`, `BASE_SECOND_SHARE = 0.5`), `src/core/itemData.ts` (drop `BASE_NAMES` / `baseName` callers onto the catalogue in Task 2; nothing in this task)

**Interfaces (produced):**
```ts
export type BaseTier = 1 | 2 | 3 | 4;
export interface BaseDef { id: string; slot: Slot; role: 0 | 1 | 2; roleKey: string; tier: BaseTier; name: string; stat: StatKey; stat2?: StatKey }
export const BASES: readonly BaseDef[];                 // 108
export const BASE_BY_ID: ReadonlyMap<string, BaseDef>;
export const BASE_TIER_MIN_ILVL: readonly [number, number, number, number];
export function basesFor(slot: Slot, ilvl: number): readonly BaseDef[];   // unlocked at ilvl, tier order
export function pickBase(gen: Gen, slot: Slot, ilvl: number): BaseDef;   // uniform over basesFor
export function roleABase(slot: Slot): BaseDef;                           // tier 1 of role 0
```

- [ ] **Step 1: Write the failing tests** (`bases.test.ts`):
  - **Catalogue shape:**
    - Exactly 108 bases.
    - 12 per slot, 3 roles × 4 tiers.
    - Unique ids and names.
    - Role stats match the Global Constraints table, and role A equals `SLOT_IMPLICIT[slot]`.
    - `stat2` is present exactly on tiers 3–4 and obeys the rules.
    - The mockup's fixed names are present.
  - **Unlock and pick:**
    - `basesFor(slot, 1)` has 3 entries and `basesFor(slot, BASE_TIER_MIN_ILVL[3])` has 12.
    - `pickBase` over 3,000 seeded draws at the top item level hits every base for a slot, and each tier's share is within ±4 points of 25 %.
    - `pickBase` is deterministic for a given rng.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the catalogue (write the remaining names) and the helpers.
- [ ] **Step 4: Run** the suite, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `Add the 108-base catalogue`.

### Task 2: Gear rolls from its base

**Files:**
- Modify: `src/core/items.ts` (`GearItem.base?: string`, `GearItem.implicit2?: StatLine`), `src/core/itemGen.ts` (`rollGear`, `magicName`), `src/core/itemData.ts` (base names), `src/core/stats.ts` and `src/core/battle.ts` (add `implicit2` wherever `implicit` is summed; grep `implicit`), `src/core/save.ts` (schema 27: migration and validator), `src/core/types.ts` (`LifetimeStats.basesFound: string[]`), `src/core/telemetry.ts`, `src/core/loot.ts` (`receiveItem` records `basesFound` via `addToSet`), `src/core/achievements.ts` (`collection.bases`: 5–7 steps ending at 108; `FAMILY_ICONS`)
- Test: `tests/core/itemGen.test.ts` (or the existing rollGear tests; grep `rollGear`), `tests/core/stats.test.ts`, `tests/core/save.test.ts`, `tests/core/achievements.test.ts`

**Interfaces:**
- `rollGear(state, ilvl, set, rarity?, forSlot?)`. Signature unchanged.
  - A non-legendary picks `pickBase(state, slot, ilvl)` right after the slot is picked, then rolls the starting stats from the base.
  - Name: normal = base name; magic = `magicName` on the base name; rare = `rareName` as today.
- **Migration:** every non-legendary gear item gets `base = roleABase(slot).id`, with no `implicit2` and its implicit unchanged. Legendaries stay without `base`.
- **Validator:** `base` must be a known id whose slot matches. `implicit2` is allowed only on tier 3–4 bases and must use that base's `stat2`.

- [ ] **Step 1: Write the failing tests:**
  - At item level 1, `rollGear` only yields tier-1 bases. At the top level, a tier-3 armour base's `implicit2` uses its `stat2`.
  - The tier-2 implicit value equals the tier-1 value × 1.25, given the same rng.
  - `deriveStats` and `deriveBattleStats` include `implicit2`.
  - Review Focus 4: four `resistAll` bases at a high level clamp at `MAX_RESIST`.
  - Review Focus 1: a schema-26 save's equipped items keep their exact `deriveStats`/`deriveBattleStats` output after migration (deep-equal before and after, using the Plan 37 fixture migrated forward).
  - `collection.bases` exists, its top step is 108, and receiving a new base grows `basesFound` once.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Re-pin tests whose rng streams move because of the extra base draw, and list them in the commit body. The achievement total must stay in 750–850.
- [ ] **Step 4: Run** the full suite, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `Roll gear from its base: role stats, deeper ceilings, second stats`.

### Task 3: Cards and the wiki catalogue

**Files:**
- Modify: `src/ui/character/itemView.ts` (kind line: `"{Rarity} {Base name} · {slot label} · item level {n} · base tier {t}"`; starting-stat lines tagged `base` on the right, as the mockup shows), `src/ui/character/ItemCard.tsx` (only if layout needs it), `src/wiki/WikiApp.tsx` plus `src/wiki/data/` (a Bases page: 9 slots × 3 roles × 4 tiers with names, stats and unlock depths, in a scrolling table), `README.md` (a short bases section)
- Test: `tests/ui/itemView.test.ts`, `tests/wiki/data.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - A rare Warded Coat card reads "Rare Warded Coat · body armour · item level 34 · base tier 2" (exact copy), with the starting line tagged `base`.
  - A tier-3 card shows both starting lines.
  - A legendary card's kind line is unchanged.
  - The wiki bases data has 108 rows grouped by slot.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite, typecheck and build. Then smoke at 1280×900 and 390×844 (puppeteer-core from the global lighthouse install, scripts in the job tmp dir): an item card with a tier-3 base, and the wiki Bases page with no page-level horizontal scroll (Review Focus 5).
- [ ] **Step 5: Commit** `Show bases on cards and catalogue them in the wiki`.
