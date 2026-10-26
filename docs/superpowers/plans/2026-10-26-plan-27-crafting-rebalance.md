# Plan 27: Crafting rebalance (orbs)

**Goal:** Simplify crafting. The Plan-17 essence/orb model is overbuilt — 192 essences (32 stats × 6 tiers) plus two generic orbs, most of which the player never meaningfully chooses between. Replace it with three orb *families*, each in Minor/Normal/Greater tiers, all with a unique name and a unique graphic, sold at the Refiner: craft orbs that add or reroll a prefix or suffix, removal orbs that randomly remove a prefix or suffix, and scattering orbs that randomize the numeric values of every prefix and suffix. "Way less would be more."

The owner also wants the vendor to *feel* like a purchase happened: buying an item should play an animation that makes the transfer visible, instead of the current dull "the number ticks down".

**The catalogue** (15 orbs, three families × three tiers; names are my picks, overrule in review):

| Family | Side | Minor | Normal | Greater | Does |
|---|---|---|---|---|---|
| Craft | prefix | Minor Orb of Prefixes | Normal Orb of Prefixes | Greater Orb of Prefixes | Adds a random prefix, or rerolls a chosen prefix, in its tier band |
| Craft | suffix | Minor Orb of Suffixes | Normal Orb of Suffixes | Greater Orb of Suffixes | Adds a random suffix, or rerolls a chosen suffix, in its tier band |
| Removal | prefix | Minor Orb of Severance | Normal Orb of Severance | Greater Orb of Severance | Removes one random prefix (band-scoped by tier) |
| Removal | suffix | Minor Orb of Unmaking | Normal Orb of Unmaking | Greater Orb of Unmaking | Removes one random suffix (band-scoped by tier) |
| Scattering | — | Minor Scattering Orb | Normal Scattering Orb | Greater Scattering Orb | Randomizes the value of every prefix and suffix (best-of-N by tier) |

**Architecture:**

- **One orb item replaces the essence and the old orb.** `OrbItem { id, type:'orb', family: 'craft'|'removal'|'scattering', side?: 'prefix'|'suffix', tier: 'minor'|'normal'|'greater', count }`. `side` is set for craft and removal, absent for scattering. `EssenceItem` is retired.
- **Tiers differ meaningfully.** Craft orbs set the *tier band* the added/rerolled line rolls in; removal orbs set *which lines* they may remove; scattering orbs set the *reroll count* (keep the best). See the decisions table for exact bands.
- **The Refiner sells the catalogue**, one tile per orb (name + graphic + ore cost), in three groups; the essence shop and the old two-orb shop are removed. The ore exchange (4:1 up / 1:3 down) and the per-ore premium stay, so any ore converts into the ore an orb costs. The Essences stash tab becomes the Orbs tab.
- **Essences and old orbs refund.** A schema bump migrates held essences/orbs to their buying ore (or, for old orbs, to Minor craft orbs), so nothing is lost and the new catalogue is the only currency.
- **A buy animation.** A successful buy shows the bought item's sprite flying from the buy button into the bag and a flash on the cost, so the transfer is visible; refusals keep the plain status text.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. One schema bump (18 → 19).

**Spec:** `docs/superpowers/specs/2026-10-24-round-3-economy-inventory-crafting-design.md` §5.2 (orb-style crafting) as the base the owner is simplifying; `2026-10-26-plan-17-crafting-and-ore-economy.md` (the essence/orb model this replaces) and `2026-10-25-round-4-play-feedback-design.md` (the "dull vendor" note).

**Builds on:** Plan 26 (`dev-ernest`).

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. start screen · 25. skill-tree layout · 26. ascendancy-tree rebalance · **27. crafting rebalance (orbs)** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. Orb rolls draw from `state.rng` exactly as crafting does today; *buying* never draws from `state.rng`.
- **Save migration is explicit and tested.** `SCHEMA_VERSION` 18 → 19; a migration refunds held essences/orbs to ore (old orbs become Minor craft orbs) and re-keys the Orbs tab. Old saves load with everything else intact.
- **Crafting refusals change nothing**, as today: every check (sealed, legendary, rarity, side room, band, cost) comes before any payment or mutation.
- **The loot stream is unchanged by buying.** Buying orbs and the ore exchange draw from their own streams (or change state directly, never `state.rng`), so looking at or buying from the Refiner never moves what the mine drops.
- **Numbers stay clamped and readable.** Orb tier bands obey `MAX_TIER_OVER_CAP`; the UI shows costs with `formatNumber`.
- Phones: the Refiner's three orb groups and the buy animation are re-checked at 390 × 844; targets ≥ 44 px.
- No new dependencies; the full suite, typecheck and build stay green.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **The catalogue is complete and uniquely named.** 15 orbs, each with a unique name and a unique sprite, none sharing the old "Prefix orb"/"Suffix orb" or the essence "T{n} {stat}" naming; a test pins the 15 names.
2. **Tiers differ meaningfully.** A Greater craft orb cannot roll a low-tier line; a Minor removal orb cannot remove a top-tier line; a Greater scattering orb keeps the best of three value rolls. Bands are asserted by tests.
3. **Removal and scattering semantics hold.** Removal removes exactly one line on its side, scoped to its band, and refuses `nothingToChange` when nothing qualifies; scattering rerolls values only (stats and tiers stay), keeping crafted lines' values.
4. **Essences are gone, nothing is lost.** `grep` for `essence` shows only the migration and removed references; a schema-18 save migrates to 19 with its essences/orbs refunded to ore.
5. **The vendor sells the catalogue and shows the transfer.** Each orb tile shows its sprite, name and cost; a successful buy plays the fly-in animation, a refusal shows the plain text.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Scope | Retire the Plan-17 essence/orb model. The 32×6 essences and the two generic prefix/suffix orbs go away, replaced by the 15-orb catalogue. The base material crafts Copper/Tin/Silver/Mithril/Diamond are untouched. |
| Base-craft overlap | Retire Obsidian's "remove a random modifier" and Starsteel's "reroll values" crafts — removal and scattering orbs now cover them, and those ores become orb currency. (Overrule if you want to keep them as cheap, side-agnostic alternatives.) |
| Names | As in the catalogue table: `Orb of Prefixes`/`Orb of Suffixes` (craft), `Orb of Severance` (prefix removal) / `Orb of Unmaking` (suffix removal), `Scattering Orb`. Each prefixed Minor/Normal/Greater. |
| Item model | `OrbItem { id, type:'orb', family, side?, tier, count }`. Scattering has no `side`. One catalogue constant `ORBS` drives names, costs and the shop; the Orbs tab keys by `orbKey(family, side, tier)`. |
| Craft orb band | Add/reroll rolls the line's tier within a band of the item's cap `C = tierCap(ilvl)`: Minor `[1, ⌊C/3⌋]`, Normal `[⌊C/3⌋+1, ⌊2C/3⌋]`, Greater `[⌊2C/3⌋+1, C + MAX_TIER_OVER_CAP]` (each clamped to ≥ 1). The value rolls in the chosen tier's range. A reroll keeps the line's stat and rerolls its tier/value; an add picks a random stat of that side the item lacks. |
| Removal orb band | Removes one random line on its side whose tier is in scope: Minor only lines with `tier ≤ ⌊C/3⌋`, Normal any line, Greater only lines with `tier ≥ ⌊2C/3⌋+1`. Refused `nothingToChange` when the side has no line in scope. |
| Scattering orb | Rerolls the value of every rolled prefix and suffix within its own tier, keeping the best of N rolls: Minor 1, Normal 2, Greater 3. Stats and tiers stay; crafted (tempered) lines keep their value, as Starsteel did. |
| Costs | Tier → ore (Minor Iron, Normal Mithril, Greater Void crystal) times a family multiplier: craft ×2/×3/×4, removal ×2/×4/×6, scattering ×3/×6/×9 (so Minor craft = 2 Iron, Greater scattering = 9 Void crystal). Flat costs as today's essences/orbs; the exchange premium still governs ore conversion. Tunable in Task 3. |
| Graphics | 15 new sprites in `grids.ts`: one 12×12 orb shape, a glyph per family (an up/down chevron for craft prefix/suffix, a slash for removal, a burst for scattering) and a tier recolour (Minor iron-grey, Normal mithril-blue, Greater void-purple) via `PALETTE_OVERRIDES`. `itemSprite` routes an orb to its own sprite instead of `'diamond'`. |
| Vendor | The Refiner shows three groups — Craft orbs, Removal orbs, Scattering orbs — each tile with its sprite, name and ore cost; the essence shop and old orb shop are removed; ore exchange stays. The Essences tab is relabelled Orbs. |
| Buy animation | A "purchase" feedback: on a successful buy, the bought item's sprite flies from the buy button into the bag and the cost flashes; a store `lastBuy` snapshot + a keyed CSS animation (~400 ms). Refusals keep the plain status text. The gambler's "You got" panel already exists and is left as is. |
| Migration | `SCHEMA_VERSION` 18 → 19. Each held `"stat:tier"` essence refunds `ESSENCE_COST[tier]` of `oreForTier(tier)` into the Materials tab; each old prefix/suffix orb becomes a Minor Orb of Prefixes/Suffixes. Bag and tab stacks alike. |

## File structure

```
src/core/
  items.ts          MOD  OrbItem {family, side?, tier}; OrbFamily/OrbTier; ORBS catalogue; orbKey/parseOrbKey; retire EssenceItem
  balance.ts        MOD  orbTierBand(tier, cap), ORB_COSTS; retire ESSENCE_COST/ORB_COST/essenceBand/ESSENCE_TIER_MAX
  crafting.ts       MOD  new TargetedCraft shape + apply/pay; retire essence paths; retire Obsidian-remove and Starsteel-values
  oreMarket.ts      MOD  buyOrb(kind); retire buyEssence; orb stacking
  save.ts           MOD  SCHEMA_VERSION 19 + migration (refund essences/orbs) + validators
  cells.ts          MOD  orb stacking/keying (essence helpers become orb helpers)
  loot.ts           MOD  receive/label an orb (bought, never dropped)
src/ui/
  merchant/merchantView.ts MOD  orb shop (three groups), remove essence/orb offers
  merchant/MerchantView.tsx MOD  orb groups, buy animation trigger
  character/craftView.ts    MOD  targeted orb actions (add/reroll/remove/scatter per tier)
  character/ItemCard.tsx    MOD  (via craftView) the orb action labels
  character/itemView.ts     MOD  orb sprite + kind line/help text
  sprites/grids.ts          MOD  15 orb sprites + palette overrides
  store/gameStore.ts        MOD  buyOrb(kind) + lastBuy snapshot for the animation
tests/
  core/crafting.test.ts     MOD  orb add/reroll band, removal scope, scattering best-of-N, refusals
  core/oreMarket.test.ts    MOD  buyOrb costs/ore; retire buyEssence tests
  core/save.test.ts         MOD  schema 18 → 19 migration
  ui/merchant.test.ts       MOD  orb shop render + buy flow
```

---

### Task 1: The orb model and catalogue

**Files:** `src/core/items.ts`, `src/core/balance.ts`, `src/core/cells.ts`, `src/core/loot.ts`; tests `tests/core/crafting.test.ts`.

**Interfaces:**
- `OrbFamily = 'craft' | 'removal' | 'scattering'`; `OrbTier = 'minor' | 'normal' | 'greater'`; `OrbItem { id, type:'orb', family, side?: OrbSide, tier: OrbTier, count }`. `OrbSide = 'prefix' | 'suffix'` stays. Remove `EssenceItem` and `ESSENCE_TIER_MAX`/`essenceKey`/`parseEssenceKey` (or repurpose `parseEssenceKey` for orb keys).
- A single `ORBS` catalogue constant: the 15 definitions in order, each `{ family, side?, tier, name, ore, cost }`, and helpers `orbName(item)`, `orbKey(family, side?, tier)`, `orbCost(family, tier)`.
- `orbTierBand(tier, cap)` → `[lo, hi]` per the decisions table, clamped to `[1, cap + MAX_TIER_OVER_CAP]`. Costs land in `balance.ts` (a `Record<OrbFamily, Record<OrbTier, { ore, cost }>>`), replacing `ESSENCE_COST` and `ORB_COST`.

**Tests:** the catalogue has exactly 15 entries with 15 unique names; `orbTierBand` bounds for a few caps (e.g. `cap 9`: Minor `[1,3]`, Normal `[4,6]`, Greater `[7,11]`); orb stacking and `orbKey` round-trips.

**Step order:** types → catalogue/names → bands and costs → cells/loot helpers → tests → commit `Add the orb catalogue`.

---

### Task 2: Orb crafting

**Files:** `src/core/crafting.ts`; tests `tests/core/crafting.test.ts`.

**Interfaces:**
- New `TargetedCraft`:
  `{ kind:'addPrefix'|'addSuffix'|'removePrefix'|'removeSuffix'|'scatter'; tier: OrbTier }`
  `| { kind:'rerollPrefix'|'rerollSuffix'; index: number; tier: OrbTier }`.
  The old `addStat`/`rerollAffix`/`rerollOrb`/`removeAffix` go away.
- `canTargetedCraft` mirrors the rules: sealed/legendary/normal first, then side room for adds, the chosen line's side for rerolls, the band-scoped scope for removals, and "has a rolled line" for scattering. New check text for "no line in that band" reuses `nothingToChange`.
- `applyTargeted`: add uses `rollSideLine`-style pick but rolls the tier within `orbTierBand`; reroll keeps the stat and rerolls tier (in band) + value; removal picks a random qualifying line and splices it; scattering rerolls each rolled line's value N times and keeps the best. All keep the existing magic-name fallback (a magic item left with no lines becomes normal) and the worn-mining-gear `fillAhead`.
- Retire the essence payment paths (`heldEssence`/`payEssence`) and, per the decisions table, the `obsidian`/`starsteel` `ruleCheck`/`apply` cases (their `CRAFT_COST` entries go too).

**Tests:** a Greater add on a `cap 9` item lands a tier ≥ 7 line; a Minor reroll keeps the stat and lands in `[1,3]`; a Minor removal only removes a low-band line and refuses when there is none; a Normal removal removes any line; scattering keeps stats/tiers, rerolls values, and a Greater scatter's value is ≥ a Minor's on a seeded pair; refusals change nothing.

**Step order:** write failing tests → implement → run → commit `Craft with the orb catalogue`.

---

### Task 3: The Refiner's orb shop

**Files:** `src/core/oreMarket.ts`, `src/ui/merchant/merchantView.ts`, `src/ui/merchant/MerchantView.tsx`; tests `tests/core/oreMarket.test.ts`, `tests/ui/merchant.test.ts`.

**Interfaces:**
- `buyOrb(state, kind)` where `kind` is the 15-way orb identifier (family + side + tier), paying its ore; retires `buyEssence`. Buying never draws from `state.rng`.
- `orbOffers(state)` returns the three groups (`craft`, `removal`, `scattering`), each tile `{ family, side, tier, name, sprite, cost, oreLabel, affordable }`; the essence tier ladder and the old two-orb list are removed. The ore-exchange panel stays.
- The `MerchantView.tsx` Refiner section renders the three groups, each tile showing the orb's `Sprite`, its name and its ore cost; the Orbs stash tab is relabelled.

**Tests:** `buyOrb` spends the right ore for each family/tier and tops up a stack; buying refuses when short; offers render 15 tiles with the right names and costs; buying never touches `state.rng`.

**Step order:** core buy → offers → Refiner section → tests → commit `Sell the orb catalogue at the Refiner`.

---

### Task 4: The orb sprites and card text

**Files:** `src/sprites/grids.ts`, `src/ui/character/itemView.ts`; smoke tests.

**Interfaces:**
- 15 new `SpriteName` entries (e.g. `orbPrefixMinor`, `orbPrefixNormal`, … `orbScatterGreater`), each a 12×12 grid: one shared orb silhouette, a glyph per family (up chevron for craft-prefix, down chevron for craft-suffix, a slash for removal, a burst for scattering) and a tier recolour via `PALETTE_OVERRIDES` (grey/blue/purple). The atlas lays them out automatically from `GRIDS`.
- `itemSprite` routes an orb to its sprite by `(family, side, tier)`; `itemKindLine`/`itemLines` name the orb and describe what its tier does ("Adds a prefix in tiers T1–T3", "Removes a random prefix (top tiers)", "Rerolls every value, best of 3").

**Checks:** `npm run build`; the 15 sprites render in the shop and the bag; 1280×900 and 390×844 smoke.

**Step order:** sprites → item view routing → text → build/smoke → commit `Give each orb its own graphic`.

---

### Task 5: The buy animation

**Files:** `src/store/gameStore.ts`, `src/ui/merchant/MerchantView.tsx`, `src/ui/merchant/merchant.css`.

**Interfaces:**
- The store records a `lastBuy` snapshot on a successful Refiner orb buy (and, for consistency, on a Trader stock buy): `{ key, name, sprite, from: 'refiner'|'trader' }`, with a monotonically increasing id so React re-triggers the animation.
- The Merchant view renders a transient, keyed element: the bought item's `Sprite` animating from the buy button toward the bag (a ~400 ms CSS transform + fade), while the cost text flashes and the status line reads "Bought {name}". Refusals keep the plain status text; a null `lastBuy` renders nothing.

**Checks:** a buy visibly transfers the orb into the bag; a refused buy shows only the status text; no layout shift on a narrow screen.

**Step order:** store snapshot → animation element + CSS → wire both merchants → commit `Animate the vendor purchase`.

---

### Task 6: Migration and final QA

**Files:** `src/core/save.ts`; tests `tests/core/save.test.ts`.

**Work:** bump `SCHEMA_VERSION` to 19; add the migration (refund essences to their ore, convert old orbs to Minor craft orbs, re-key the Orbs tab) and validators for the new `OrbItem` shape. Run `npm run balance` and adjust the orb costs from Task 3 if digging's material income no longer covers the new crafting loop, then record the final costs. Full QA: `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; a 1280×900 and 390×844 smoke of the Refiner, an orb buy, and a full craft; confirm a schema-18 save migrates and plays.

**Commit:** `Finish the crafting rebalance`.

---

## Definition of done

- The Plan-17 essences and the two generic orbs are gone; the 15-orb catalogue (craft / removal / scattering × Minor/Normal/Greater) replaces them, each with a unique name and graphic.
- Craft orbs add/reroll a prefix or suffix in a tier band; removal orbs randomly remove a band-scoped prefix or suffix; scattering orbs randomize every value, best-of-N by tier.
- The Refiner sells the catalogue (graphics visible), and a successful buy plays the fly-in animation.
- `SCHEMA_VERSION` is 19 with a tested migration; held essences/orbs refund to ore; old saves load and play.
- The full suite, balance run, typecheck and build are green; nothing pushed.
