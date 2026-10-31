# Plan 37: The Smith — nine currencies, four ores, Gold fees, achievement replacements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's four crafting systems with one:
- Ores are smelted at the Smith into nine one-action currencies.
- Every smelt and use costs Gold.
- Diamonds pay for Exalt.
- The ores go from 8 to 4, and the ore exchange is removed.
- The achievement ladders that die with the removed ores and the exchange are replaced.

**Architecture:**
- A new pure module `src/core/smith.ts` owns the currency catalogue, smelting, using a currency, fees and the gem-removal fee.
- `crafting.ts` keeps only the map Soul upgrades and map-mod rolls.
- `oreMarket.ts` and the orbs go.
- Ferrel the Refiner, the third merchant, becomes the Smith in the Merchant view. The Orbs tab becomes the Currency tab.
- One save bump (25 → 26) covers the whole plan.

**Tech Stack:** TypeScript 7, Vite 8, React 19, Vitest 5 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-31-round-5b-crafting-economy-bases-design.md` §4, §5, §6, §6a, §10, §11.
**Mockup:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 5b" (approved as shown).
**Builds on:** Plan 36.

## Global Constraints

- **Currencies are exactly nine.** Each is smelted from one source and does one thing:

| Id | Name | Does | Smelted from |
|---|---|---|---|
| `change` | Change | normal → magic | `copper` |
| `shift` | Shift | reroll a magic item's lines | `copper` |
| `growth` | Growth | add a line to a magic item with room | `iron` |
| `severance` | Severance | remove a random line (magic or rare) | `iron` |
| `socket` | Socket | add a socket (up to `MAX_SOCKETS`) | `iron` |
| `ascent` | Ascent | magic → rare | `mithril` |
| `chaos` | Chaos | reroll a rare item's lines | `mithril` |
| `polish` | Polish | reroll each line's number within its tier | `voidCrystal` |
| `exalt` | Exalt | add a line to a rare item with room | Diamonds |

- **Which currencies roll lines:** Change, Shift, Growth, Ascent, Chaos and Exalt roll lines exactly as drops do (`rollLines`, `tierCap(ilvl)`, same weights). Polish keeps the stat and the tier.
- **What is never touched:** no currency touches the starting stat (`implicit`, and `implicit2` from Plan 38), and none works on a legendary.
- **Gold fee for using a currency:** `useFee(id, ilvl) = USE_FEE_BASE[id] × ilvl^1.5`, rounded. **Gold fee for smelting:** `smeltFee(id) = SMELT_FEE[id]`. The UI shows every fee before you confirm.
- **Smelt cost:** about 10 ore per currency (`SMELT_ORE[id]`, tunable). Exalt costs `SMELT_DIAMONDS` Diamonds instead of ore, plus its smelt fee.
- **Crafted lines:** every line a currency adds, rerolls or polishes gets `source: 'craft'`. Lines on a drop have no `source` field (meaning `'drop'`).
- **Ores** are exactly `copper`, `iron`, `mithril`, `voidCrystal`, first found at 0, 50, 300 and 1,000 m. The ore exchange is gone.
- **Migration of removed ores:** Tin → Copper, Silver → Iron, Starsteel → Mithril, Obsidian → Mithril, 1:1. This covers stash, bag and the lifetime `stats.oresFound`.
- **Migration of old orbs:** each is refunded as its `ORB_COSTS` ore × count.
- **Old crafted and sealed items:** old `crafted: true` lines become `source: 'craft'`. Old `sealed` flags are dropped, and those items become craftable.
- **Achievement totals:** 750–850 total. Hidden 20–40, feats ≥ 40, collections ≥ 40 (unchanged from Plan 34).
- **Unchanged:** Souls (map rarity upgrades, battle-gear item-level upgrades), gems, runes, the passive web reset price, and gambling, Trader and stash prices.
- Nothing under `src/core/` touches the DOM, `Date.now()` or `Math.random()`. No `!`; no Claude/Anthropic attribution.
- Main suite, typecheck and build green after every task.
- `npm run balance` may go red in this plan (the economy changes; Plan 39 retunes). Each task's commit body reports the balance numbers once.

## Review Focus

1. **A schema-25 save with orbs, eight ores, an exchange premium, sealed items and crafted lines** loads into the new model with nothing lost silently. Every unit is accounted for:
   - ores fold 1:1;
   - orbs refund as ore;
   - sealed items become craftable;
   - crafted lines keep their values.
2. **Using a currency that doesn't fit:**
   - Change on a rare, Exalt on a full rare, Growth on a magic item with no room, Socket at the limit.
   - Each is refused with its own reason. Nothing is spent: no currency, no Gold.
3. **Not enough Gold for the fee:** refused, nothing changes, and the reason names the missing Gold.
4. **The Smith at 390 px:** the three columns stack, every button stays ≥ 44 px, and there's no horizontal scroll.
5. **Removing gems at the Smith when their stash tab is at its cap:** refused, as the old Mithril unsocket was (`gemsFull`).

---

### Task 1: The currency model and the Smith's core

**Files:**
- Create: `src/core/smith.ts`, `tests/core/smith.test.ts`, `tests/fixtures/save-schema-25.txt` (generated from the engine at Plan 36's head **before** any change in this task, as earlier fixtures were; never regenerate it)
- Modify: `src/core/items.ts` (`CURRENCIES`, `CurrencyId`, `ModLine.source`), `src/core/types.ts` (`stash.currencies`, `ItemLoc` `{ where: 'currencies'; id: CurrencyId }`), `src/core/balance.ts` (`SMELT_ORE`, `SMELT_FEE`, `SMELT_DIAMONDS`, `USE_FEE_BASE`, `GEM_REMOVE_FEE`), `src/core/crafting.ts` (strip the gear crafts; keep map upgrades and map-mod rolls), `src/core/save.ts` (schema 26 migration and validators), `src/core/newGame.ts`, `src/core/types.ts` `LifetimeStats` (`smelted: number`, `currencyUsed: Record<CurrencyId, number>`, `smithFees: number`), `src/core/telemetry.ts` (`emptyLifetimeStats`)
- Test: `tests/core/smith.test.ts`, `tests/core/save.test.ts`, `tests/core/crafting.test.ts` (trim it to the map upgrades)

**Interfaces (produced):**
```ts
export const CURRENCIES = ['change','shift','growth','severance','socket','ascent','chaos','polish','exalt'] as const;
export type CurrencyId = (typeof CURRENCIES)[number];
export type SmithCheck = 'ok' | 'notGear' | 'legendary' | 'wrongRarity' | 'noRoom' | 'socketsFull' | 'noCurrency'
  | 'noOre' | 'noDiamonds' | 'noGold' | 'gemsFull' | 'noGems';
export function smeltCost(id: CurrencyId): { ore?: Material; oreCount?: number; diamonds?: number; gold: number };
export function canSmelt(state: GameState, id: CurrencyId, count: number): SmithCheck;
export function smelt(state: GameState, id: CurrencyId, count: number): SmithCheck;
export function useFee(id: CurrencyId, ilvl: number): number;
export function canUseCurrency(state: GameState, target: ItemLoc, id: CurrencyId): SmithCheck;
export function useCurrency(state: GameState, target: ItemLoc, id: CurrencyId): SmithCheck;
export function gemRemoveFee(ilvl: number): number;
export function removeGems(state: GameState, target: ItemLoc): SmithCheck;
```
- Each currency's rules follow the Global Constraints table.
- `useCurrency` spends one currency and the fee only on `'ok'`, and records `stats.currencyUsed[id] += 1` and `stats.smithFees += fee`.
- Rarity changes rename the item as drops are named: magic via `magicName`, rare via `rareName`.

- [ ] **Step 1: Generate the fixture.** At the current head, before any edit, export a schema-25 save from a real played state using the sim (`playReference({ seed: 4242, minutes: 3000 })`). Then give it, by hand, at least one orb of each family, all 8 ores, a sealed item, a crafted line and a non-zero exchange premium. Save it as `tests/fixtures/save-schema-25.txt` with a short header comment in the test explaining what it holds.
- [ ] **Step 2: Write the failing tests** (`smith.test.ts`):
  - **Each currency's happy path**, on a hand-built item:
    - Change: normal → magic, with 1–2 lines.
    - Shift: rerolls every magic line.
    - Growth: adds exactly one line.
    - Severance: removes exactly one line.
    - Socket: adds one socket.
    - Ascent: keeps the magic lines and ends rare.
    - Chaos: rerolls every rare line.
    - Polish: every stat and tier is unchanged, and some value differs over seeded tries.
    - Exalt: adds one line and spends Diamonds.
  - **Each refusal** from Review Focus 2, 3 and 5. Spent currency, Gold and Diamonds are unchanged after every refusal.
  - **Crafted lines:** every line a currency touched has `source: 'craft'`, and the starting stat is never changed.
  - **Fees:** `useFee('chaos', 34)` equals `Math.round(USE_FEE_BASE.chaos * 34 ** 1.5)`. `smelt` spends `SMELT_ORE` ore plus `SMELT_FEE` Gold per currency.
  - **No randomness used outside the rolls:** `canUseCurrency` and `canSmelt` never read `state.rng`.
  - `save.test.ts`:
    - The fixture loads at schema 26 with Review Focus 1's accounting: the exact ore totals after the fold, and the orb refunds.
    - A schema-26 save round-trips.
    - `SCHEMA_VERSION === 26`.
- [ ] **Step 3: Run** them. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Remove the orb families, `ORB_COSTS`, `buyOrb`, the gear `CraftKind`s (`tin`, `silver`, `mithril`, `voidCrystal`, `diamond`, and `makeMagic`/`makeRare` on gear), tempering and `sealed`.
  - Keep `mapUpgradeSouls` and the map Soul upgrades with their current behaviour and tests.
  - The ores stay at 8 in this task. The smelt sources only use the four kept ones.
- [ ] **Step 5: Run** the full suite, typecheck and build. Fix every UI compile site that used orbs by routing it to `smith.ts`. The full UI comes in Task 3, so keep this minimal.
- [ ] **Step 6: Commit** `Replace orbs and ore crafts with nine smelted currencies`, including the balance numbers.

### Task 2: Four ores, no exchange, replaced achievements

**Files:**
- Modify: `src/core/items.ts` (`MATERIALS` → 4), `src/core/balance.ts` (`MATERIAL_TABLE`, `SALVAGE_MATERIALS`, `GEM_SALVAGE_TIN` → a Copper constant), `src/core/loot.ts`, `src/core/dig.ts` (only if it names removed ores), `src/core/save.ts` (extend the schema-26 migration: the ore fold, dropping `oreMarket` state and `stats.oresTraded`), `src/core/achievements.ts`, `src/core/itemData.ts` (`MATERIAL_LABELS`)
- Delete: `src/core/oreMarket.ts`, `tests/core/oreMarket.test.ts`
- Test: `tests/core/save.test.ts`, `tests/core/achievements.test.ts`, `tests/core/loot.test.ts` (salvage)

**Interfaces:**
- `MATERIALS = ['copper', 'iron', 'mithril', 'voidCrystal']`.
- `MATERIAL_TABLE` `from`: 0 / 50 / 300 / 1000 m. Weights and amounts are retuned so total ore per metre is within ±20 % of today's.
- **Salvage by rarity:** normal → copper; magic → copper + iron; rare → iron + mithril; legendary → mithril + voidCrystal. Amounts scale with item level as today.
- **Achievements:**
  - Remove the ore ladders for the four removed ores, and `oresTraded`.
  - Add the new ladder families: `smelted` (currencies smelted), `smithFees` (Gold spent on Smith fees), and nine `used.<currencyId>` families (each currency used), each 4–6 steps.
  - The total stays in 750–850.
  - Every new family gets a `FAMILY_ICONS` entry, reusing glyphs.

- [ ] **Step 1: Write the failing tests.**
  - **Save:** the fixture's 8-ore totals fold exactly into 4 (`stash.materials`, bag stacks and `stats.oresFound`), and no key for a removed ore survives.
  - **Salvage:** a normal, magic, rare and legendary item each salvage into exactly the ores listed above.
  - **Achievements:**
    - No family id names a removed ore or `oresTraded`.
    - The `smelted`, `smithFees` and `used.*` families exist with 4–6 strictly increasing steps.
    - The count is in band.
    - A smelt raises `stats.smelted` and can earn `smelted.<first step>`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, including deleting `oreMarket.ts` and every import of it. Re-pin dig or loot tests whose ore draws change, and list them in the commit body.
- [ ] **Step 4: Run** the full suite, typecheck and build. Expected: PASS.
- [ ] **Step 5: Commit** `Cut the ores to four and replace the exchange's achievements`, including the balance numbers.

### Task 3: The Smith and the Currency tab

**Files:**
- Modify: `src/ui/merchant/MerchantView.tsx`, `src/ui/merchant/merchantView.ts`, `src/ui/merchant/merchant.css` (Ferrel's card becomes the Smith; `MERCHANTS.refiner` → `MERCHANTS.smith`, keeping Ferrel's sprite and name, with the title "the Smith"), `src/ui/character/OrbTab.tsx` → `src/ui/character/CurrencyTab.tsx`, `src/ui/inventory/InventoryView.tsx`, `src/ui/character/itemActions.ts` (right-click "Craft" opens the Merchant view with the item in the Smith's slot), `src/ui/character/dragDrop.ts`, `src/store/gameStore.ts` (`smelt`, `useCurrency`, `removeGems` intents and the craft-slot selection), `src/wiki/WikiApp.tsx` (Smith, currencies, ores pages), `README.md`
- Test: `tests/ui/merchantView.test.ts` (or the existing merchant view-model test; grep `refinerResultText`), `tests/store/gameStore.test.ts`, `tests/ui/itemActions.test.ts`

**Interfaces:**
- `smithVM(state, slotTarget?: ItemLoc)` in `merchantView.ts` returns:
  - `ores: { material, held, makes: string }[]`;
  - `slot: ItemCardVM | null`;
  - `uses: { id, name, held, does, fee: string, state: 'ok' | SmithCheck, reason?: string }[]`.
- Reason copy: `'wrongRarity'` → "Doesn't fit: this item is {rarity}." · `'noRoom'` → "No room for another line." · `'noGold'` → "Needs {fee} Gold." · `'noDiamonds'` → "Needs {n} Diamonds." · `'socketsFull'` → "No room for another socket."
- Layout follows the mockup: Smelt | Craft | Currencies. At ≤ 700 px the columns stack.

- [ ] **Step 1: Write the failing tests:**
  - `smithVM` lights only the currencies that fit a rare item, with the exact reason copy for the others.
  - Fees are formatted with `formatNumber`.
  - The store's `useCurrency` intent spends and toasts any achievement through the normal diff.
  - Right-click Craft on a bag item sets the Smith slot to it.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite, typecheck and build. Then smoke at 1280×900 and 390×844 with puppeteer-core from the global lighthouse install (scripts in the job tmp dir, never the repo):
  - the Smith renders;
  - Smelt works;
  - a currency is used on a bag item;
  - no horizontal scroll at 390 px;
  - buttons are ≥ 44 px.
- [ ] **Step 5: Commit** `Turn the Refiner into the Smith and the Orbs tab into Currencies`.
