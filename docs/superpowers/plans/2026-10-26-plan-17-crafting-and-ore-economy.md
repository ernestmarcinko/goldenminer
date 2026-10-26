# Plan 17: Crafting overhaul and the ore economy

**Goal:** Replace the "add a random modifier" crafting with a system that lets the player craft *for specific affixes and suffixes*, make higher-level currency yield higher-level affixes, and give the eight ores a real economy — ores trade up into crafting materials, ores trade for each other, and trading into an ore makes it dearer for a while so the low ores never lose their value.

The current state: eight ores (Copper, Tin, Iron, Silver, Mithril, Starsteel, Obsidian, Void crystal) are both the currency and the craft. Copper makes a normal item magic, Tin rerolls magic, Iron *adds a random modifier*, Silver rerolls rare, and so on. The problem is exactly "Iron adds a modifier": there is no way to aim for a prefix, a suffix, or a specific affix, and the ores have no relationship to the affix *tier* they produce. This plan rebuilds crafting around three ideas:

1. **Targeted affixes.** New crafting materials let the player add or reroll a *specific* affix — by side (prefix/suffix) or by stat — instead of a random one.
2. **Tiered currency.** Crafting materials have a tier, and the tier of the material sets the band the affix rolls in. Deep ores buy higher-tier materials, so higher-level currency genuinely yields higher-level affixes.
3. **An ore economy.** The ores become the base currency: they convert up into crafting materials and into each other, with a decaying premium so bulk-buying any one ore raises its price for a while.

**Architecture:**

- **Ores stay exactly as they are** as the raw vein drops and the shared currency. `MATERIALS`, `MATERIAL_TABLE`, `MATERIAL_LABELS` and the Materials stash tab are unchanged.
- **A new stackable item, the "essence",** carries the targeted crafting. `EssenceItem { id, type:'essence', stat: StatKey, tier: number, count }`. There is one essence per stat (32 kinds), each in tiers 1–6. Applying an essence of stat S and tier T to gear adds (or rerolls) S at a tier in the band `[T, T+2]`, capped by the item's `tierCap`. The stat's side (prefix/suffix) comes from `MOD_SIDE`, so an essence of a prefix stat fills a prefix slot.
- **Two generic orbs** cover the side-targeted cases: a **Prefix orb** and a **Suffix orb** add a random prefix/suffix in the *item's* usual tier band, and a matching orb rerolls a chosen prefix/suffix. These keep the existing "add a line" feel but aimed at a side instead of anywhere.
- **The Ore Trader** (a new third merchant, or a tab of the Merchant) sells essences and orbs for ores, and exchanges ores for each other. Essence tier maps to ore depth: Iron buys tier-1 essences, Silver tier 2, Mithril tier 3, Starsteel tier 4, Obsidian tier 5, Void crystal tier 6 — so Copper and Tin stay the cheap base crafts (normal→magic, reroll magic) and the exchange floor.
- **Ore exchange and the premium.** Exchanging ore A → ore B consumes A, yields B at a base rate, and raises B's **premium**; the premium decays back toward 0 over ticks (live and offline), so repeatedly buying the same ore gets dearer, then eases. This is the stateful part of the plan and needs a schema bump.

**Tech stack:** unchanged. No new dependencies. **One schema bump** (12 → 13) for the essence tab, the essence bag stacks, and the ore premiums.

**Spec:** `2026-10-24-round-3-economy-inventory-crafting-design.md` (the crafting/economy design this replaces) and the balance design §4; `src/core/crafting.ts`, `src/core/merchant.ts`, `src/core/items.ts`, `src/core/save.ts` (the code being changed).

**Builds on:** Plan 16 (`dev-ernest`).

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · **17. crafting overhaul and the ore economy** (this plan) · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. start screen · 25. skill-tree layout · 26. ascendancy-tree rebalance · 27. crafting rebalance · 28. mining animation · 29. ascendancy icons · 30. damage types and resistances · 31. unified equipment.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. Ore premiums decay by the game's own ticks (`state.tickCount`), not wall time.
- **Save migration is explicit and tested.** `SCHEMA_VERSION` 12 → 13; a migration adds `oreMarket` (zeroed premiums) and an empty essence tab. Old saves load with everything else intact.
- **The loot stream is unchanged by buying.** The Trader's stock and the ore exchange draw from streams of their own (or change state directly, never `state.rng`), so looking at or buying from the trader never moves what the mine drops.
- **Crafting refusals change nothing**, as today: every check (sealed, legendary, side room, cost, tier band) comes before any payment or mutation.
- **Numbers stay clamped and readable.** Essence tier bands and premiums obey the existing `MAX_*` clamps; the UI shows costs with `formatNumber`.
- Phones: the trader and the new craft buttons are re-checked at 390 × 844; targets ≥ 44 px.
- No new dependencies; the full suite, typecheck and build stay green.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **Targeted crafting works.** A player can add a chosen prefix, add a chosen stat, reroll a chosen affix, and remove a chosen affix — each refused cleanly when it has no room or no budget.
2. **Higher-tier currency → higher-tier affixes.** A tier-4 essence of a stat cannot roll the stat's lowest tiers; the band is asserted by a test, and the item's `tierCap` still caps it.
3. **The economy is stable.** Buying a single ore repeatedly makes it dearer, and leaving it alone lets the premium decay; a test pins the raise and the decay, and a headless pass shows low ores keep flowing upward.
4. **Old saves migrate.** A schema-12 save loads to schema 13 with zeroed premiums and an empty essence tab; nothing else is disturbed.
5. **The old crafts still make sense.** Copper→magic, Tin→reroll magic, Mithril→sockets, Starsteel→values, Obsidian→remove random, Void crystal→temper, Diamond→add a rare line all remain, and the cards show the new costs where they changed.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Crafting-material model | A new stackable `essence` item: `{ id, type:'essence', stat: StatKey, tier: 1..6, count }`. One per stat, six tiers. Plus two generic orbs, `prefixOrb` and `suffixOrb`, which add/reroll a line on their side (also stackable, no tier — they use the item's own band). |
| Ore → material | The Ore Trader sells essences/orbs for ores. `oreForTier(t) = { iron, silver, mithril, starsteel, obsidian, voidCrystal }[t]` for t = 1..6. Copper and Tin are the base crafts (normal→magic, reroll magic) and the cheapest exchange currency. |
| Targeted actions | On gear: **Add prefix** (prefix orb), **Add suffix** (suffix orb), **Add {stat}** (essence of that stat), **Reroll {affix}** (a matching essence, or the side's orb), **Remove {affix}** (a removal orb — reuses Obsidian's "remove one, you choose"). The card lists them under Craft with costs and greys out what's unpayable, as today. |
| Essence tier band | An essence of tier T rolls its stat in tiers `[T, T+2]` (clamped to `tierCap(ilvl)`); the value rolls within that tier's range. A tier-6 essence therefore can't roll T1–T3 of its stat. |
| Ore exchange | Adjacent up-ladder `4 : 1` (4 Copper → 1 Tin, …, 4 Obsidian → 1 Void crystal); down-ladder `1 : 3` (1 Tin → 3 Copper, …). A `premium` per ore scales the cost to *buy* that ore: `cost = base × (1 + premium[target])`. |
| Premium decay | Buying into ore B adds `PREMIUM_STEP` (start 0.1) to `premium[B]`, capped at `PREMIUM_CAP` (start 1.0). Each applied tick multiplies every premium by a decay factor toward 0 (start: −0.1% per minute of simulated time, applied in `advance`/`applyTicks`). Exact constants are tuned in Task 4. |
| Where the state lives | `state.oreMarket: { premium: Record<Material, number> }` (decayed by tick delta) and `state.stash.essences: Record<string, number>` keyed `"stat:tier"`, plus bag stacks. |
| Trader home | The Ore Trader ("Ferrel the Refiner") joins Brannoc and Mirela in the Merchant view; a narrow screen stacks him below them. His offers are the same in every world (fixed recipes, no seed roll), and his premium is per-save state. |
| Retire Iron's generic add | Iron no longer adds a *random* modifier; it is the tier-1 essence ore and, cheaply, exchanges up. The "add a random line" action becomes the targeted orbs/essences above. A migrated save's Iron stays as currency; the old action is simply gone from the cards. |

## File structure

```
src/core/
  items.ts          MOD  EssenceItem type, ESSENCES/OreOrb helpers, MOD_SIDE reuse
  balance.ts        MOD  ESSENCE_TIER_ORB, oreForTier, exchange rates, PREMIUM_* , tier band
  crafting.ts       MOD  targeted add/reroll/remove actions + essence band; retire Iron add
  oreMarket.ts      NEW  tradeOres, buyEssence, premium raise/decay, costOf
  trader.ts         MOD  the Refiner's offers (or a new refiner.ts)
  save.ts           MOD  SCHEMA_VERSION 13, migration, isEssence, essences tab, oreMarket
  cells.ts          MOD  empty essence counts, essence stacking
  loot.ts           MOD  receive/label an essence (bought, never dropped)
src/ui/
  merchant/         MOD  the Refiner's panel (essence/orb shop + ore exchange)
  inventory/        MOD  the Essences stash tab; essence cells in the bag
  character/ItemCard.tsx  MOD  the targeted craft actions and costs
tests/
  core/crafting.test.ts   MOD  targeted add/reroll/remove; essence tier band
  core/oreMarket.test.ts  NEW  exchange rates, premium raise/decay, refuse conditions
  core/save.test.ts       MOD  schema-12 → 13 migration
  ui/merchant.test.ts     MOD  the Refiner's offers and buy flow
```

---

### Task 1: The essence and orb item model

**Files:** `src/core/items.ts`, `src/core/balance.ts`, `src/core/cells.ts`, `src/core/loot.ts`; tests in `tests/core/crafting.test.ts`.

**Interfaces:**
- `EssenceItem { id, type:'essence', stat: StatKey, tier: number, count }`; `OreOrbKind = 'prefixOrb' | 'suffixOrb'` (an `orb` stack item, or fold them into the essence type with `stat` unset — the builder picks; the plan requires both are storable and stackable).
- `ESSENCE_TIER_MAX = 6`; `oreForTier(tier)` → the ore that buys a tier-t essence; `essenceBand(tier) = [tier, tier + 2]`.
- `emptyEssenceCounts()` / stacking helpers in `cells.ts`; essences are received into the bag and the Essences tab, never dropped by digging or monsters.

**Tests:** essence stacking, tab keying, `oreForTier`/`essenceBand` bounds.

**Step order:** types → balance constants → cells/loot helpers → tests → commit `Add the essence and orb crafting materials`.

---

### Task 2: Targeted crafting

**Files:** `src/core/crafting.ts`; tests `tests/core/crafting.test.ts`.

**Interfaces:**
- `craft(state, target, kind)` grows targeted kinds: `addPrefix`, `addSuffix`, `addStat(stat, tier)`, `rerollAffix(index, tier)`, `removeAffix(index)` — or a richer `CraftKind` union; the exact shape is the builder's, but each must respect `sealed`/`legendary`/side room and roll within `essenceBand(tier)` clamped to `tierCap(ilvl)`.
- `canCraft` mirrors the new rules and returns a `CraftCheck` for the card (existing set plus any new "noRoom on that side" / "no such affix" cases).
- Iron's generic "add a modifier" is removed; Copper/Tin/Mithril/Starsteel/Obsidian/Void crystal/Diamond keep their current meanings.

**Tests:** a chosen prefix fills a prefix slot; an essence adds its exact stat at a tier within the band and never below the band floor; a side orb fills only its side; remove removes the chosen line; refusals change nothing.

**Step order:** write the failing tests → implement the actions → run → commit `Craft for specific affixes`.

---

### Task 3: The ore market

**Files:** `src/core/oreMarket.ts` (new); tests `tests/core/oreMarket.test.ts`.

**Interfaces:**
- `tradeOres(state, from, to, amount)` → adjacent `4:1` up / `1:3` down; raises `premium[to]` by `PREMIUM_STEP` (capped); refuses on short holdings.
- `buyEssence(state, stat, tier)` and `buyOrb(state, kind)` → pay the recipe ore, add the item to the bag/Essences tab.
- `costOf(state, to, baseRate)` → `base × (1 + premium[to])`; `decayPremiums(state, tickDelta)` applied by the tick loop/`advance` so it decays live and offline.
- The Refiner's offer list is deterministic (fixed recipes, no seed), so looking at it never touches `state.rng`.

**Tests:** the exchange ratios; the premium rises on each buy and decays toward 0 across ticks; buying is refused when short; buying never draws from `state.rng`.

**Step order:** write tests → implement → commit `Add the ore market`.

---

### Task 4: Tune the economy

**Files:** `src/core/balance.ts`; tests `tests/core/oreMarket.test.ts`, the balance test.

**Work:** pick `PREMIUM_STEP`, `PREMIUM_CAP` and the decay rate so that (a) a player can always convert low ores upward, (b) bulk-buying one ore is visibly dearer, and (c) the premium returns to near-baseline within a couple of hours of not buying. Run `npm run balance` to confirm digging's material income still keeps pace with the new crafting costs. Record the chosen constants.

**Step order:** set defaults → sim → adjust → record → commit `Tune the ore economy`.

---

### Task 5: The Refiner and the UI

**Files:** `src/ui/merchant/*`, `src/ui/inventory/*`, `src/ui/character/ItemCard.tsx`, `src/ui/ascend` if untouched; tests `tests/ui/merchant.test.ts`.

**Work:** add "Ferrel the Refiner" to the Merchant view (essence/orb shop with tier buttons, and an ore-exchange panel showing live costs including the premium). Add the Essences stash tab and essence bag cells. Extend the item card's Craft list with the targeted actions, each with its cost and a greyed-out state. Re-check 390 × 844.

**Tests:** the Refiner's offers render; buying an essence spends the right ore; the exchange panel shows the premium-raised cost.

**Step order:** Refiner panel → Essences tab → card actions → tests → commit `Add the Refiner and the crafting UI`.

---

### Task 6: Migration and final QA

**Files:** `src/core/save.ts` (schema 13 + migration + validators); tests `tests/core/save.test.ts`.

**Work:** bump `SCHEMA_VERSION` to 13; add the migration (zeroed `oreMarket`, empty essences tab); add `isEssence`/`isOreMarket` validators. Full QA: `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; a 1280×900 and 390×844 smoke of the Merchant, the Essences tab, and a full craft; confirm a schema-12 save loads and plays.

**Commit:** `Finish the crafting overhaul and ore economy`.

---

## Definition of done

- The player can add/reroll/remove a *specific* affix (by side or by stat), and the tier of the crafting material sets the affix's tier band.
- The Refiner sells essences/orbs for ores and exchanges ores for each other; buying into an ore raises its price, which decays over time.
- Copper/Tin stay the base crafts; the other ores buy tiered crafting materials; Iron no longer adds a random modifier.
- `SCHEMA_VERSION` is 13 with a tested migration; old saves load unchanged.
- The economy is tuned and measured; full suite, typecheck and build are green; nothing pushed.
