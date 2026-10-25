# Plan 8: Map enchanting, Soul upgrades and the merchant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 8 adds three things:
- **Map enchanting.** Maps take PoE-style modifiers from the same materials as gear, plus Souls. The modifiers make a map harder and its rewards richer, and they never change its seeded layout.
- **Soul upgrades.** Souls raise a battle item's level.
- **Gambling.** A new Merchant tab sells a random item of a chosen slot for Gold.

**Architecture:**
- **Map items.** Maps gain a rarity, modifier lines and a sealed flag (save schema 8).
- **Combat.** A pure `mapEffects(map)` turns a map's modifiers into numbers. `monsterState` and the combat loop scale by those numbers. They don't add a single random draw, so seeds and loot streams are untouched.
- **Crafting.** `crafting.ts` grows a map branch next to the gear one.
- **Souls and gambling.** Soul upgrades and gambling are small pure core functions, called through the store.

**Tech stack:** TypeScript 7, React 19, Vite 8, Vitest 5, lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-round-3-economy-inventory-crafting-design.md`:
- §6, map enchanting;
- §5.2, Soul upgrades for battle gear;
- §8, the merchant offers gambling only.

**Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Plan 8". It shows the enchanted map card, the Soul upgrade action and the Merchant tab.

## Global Constraints

- **Node:** prefix every command with `export PATH=/root/.nvm/versions/node/v24.22.1/bin:$PATH`. `npx vitest run` and `npx tsc --noEmit` must be clean at the end of every task.
- **Commits:** a plain imperative sentence, like the repo's. Never add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.
- **Fixtures:** `tests/fixtures/save-schema-1.txt` … `save-schema-7.txt` are real exports. Never regenerate or edit them.
  - `save-schema-7.txt` comes from the Plan 7 engine:
    - deepest 1,402 m, character level 4, 34 Souls;
    - 51 maps in the Maps tab and 1 in the bag;
    - a cleared last run;
    - a map run in progress in room 2;
    - 41 crafts already applied to bag gear.
- **Seeds:** `rollMetre`, `fillAhead`, `metreLayer`, `dungeonLayout`, `monsterState`'s seeded inputs and every RNG stream stay as they are. Map modifiers only scale numbers. Combat makes exactly the same draws in the same order, enchanted or not.
- **Anti-goals:**
  - Never punish absence.
  - A refused craft, upgrade or gamble spends nothing.
  - Dying in an enchanted map loses it, exactly as today, and nothing else is lost.
- **Copy:** plain words. Exact strings in this plan are copy; use them verbatim.
- **Targets:** interactive targets are at least 40 px tall.
- **Code style:** match the surrounding code: sparse comments that say why, `readonly` tables in `balance.ts`, exhaustive `switch` over unions.
- **README:** each task that changes play updates its paragraph in the README's existing voice.

## Review Focus

1. **Old saves:** every map in the bag, the Maps tab, a run in progress and the last run comes out normal, with no modifiers. A run in progress plays on with identical results. Task 1 tests this on the real fixture, and Task 2 replays a run.
2. **Seeded layout:** an enchanted map's dungeon is the same dungeon. Rooms, monster names, species, ranks and champion modifiers are unchanged. Only life, damage, speed, healing and rewards move. Task 2 tests this.
3. **Map crafts:** a refused map craft spends neither material nor Souls. Task 3 tests every refusal.
4. **Gambling:** gambling with a full bag or too little Gold spends nothing and creates nothing. Task 6 tests this.
5. **Upgraded gear:** the validator accepts what a Soul upgrade produces. The tier bound grows with item level. Worn battle gear upgraded mid-run takes effect on the next strike. Task 5 tests this.

## Decisions this plan makes (my calls, for Ernest to check)

- **Six map modifiers,** each at most once per map. Each has a tier from T1 up, rolled up to the map's tier with the same low-tier weighting as gear. The table gives each modifier's tier formula, as T1 base / step per tier:

  | Modifier | Effect | T1 base | Step |
  |---|---|---|---|
  | Monster life | +% monster life | 10 | 5 |
  | Monster damage | +% monster damage | 8 | 4 |
  | Monster speed | monsters attack % faster | 6 | 3 |
  | Boss power | champions and bosses % stronger, life and damage | 15 | 7 |
  | Weak healing | rooms heal % less, at most 90 | 10 | 5 |
  | Hardened | monsters take % less damage, at most 75 | 5 | 3 |

- **Rewards** come from the sum of all modifier values:
  - item quantity is +½ of it;
  - rarity is +3/10 of it;
  - Souls are +½ of it.

  Quantity raises the drop, gem and material chances. Rarity multiplies magic find. Souls multiply the Souls from every kill.
- **Rarity and modifier count:**
  - normal maps have 0 modifiers;
  - magic maps have 1–2;
  - rare maps have up to 6. Iron turns a magic map with 2 into a rare with 3, and Silver rerolls a rare to 4–6.
- **Materials on maps:**
  - Copper, Iron, Silver, Obsidian and Void crystal work on maps.
  - Tin, Mithril, Starsteel and Diamonds don't.
  - Obsidian taking a magic map's last modifier makes it normal, as with gear.
  - Void crystal on a map rolls the same outcome weights as on gear, but its "crafted line" is a new modifier one tier above the map's tier. The map is then sealed.
- **Costs:**
  - **Map crafts:** the material cost uses the map's tier as the level, plus `5 × tier` Souls.
  - **Soul upgrades:** `5 × ilvl²` Souls for +1 item level, so 6 → 7 costs 180. They apply to battle gear only, legendaries included, and are refused on sealed items. An upgrade changes nothing but the level (and so the tier cap).
  - **Gambling:** `300 × tier²` Gold, with `tier` the deepest tier reached, so tier 7 costs 14,700. The item rolls at that tier, with normal drop rarity weights, for the chosen slot. A legendary rolled for a slot with no legendary becomes rare. The item goes straight into the bag, never through the loot filter. With the bag full, the gamble is refused.

---

### Task 1: Map modifiers and save schema 8

**Files:**
- Modify:
  - `src/core/items.ts` (map shape)
  - `src/core/balance.ts`
  - `src/core/tiers.ts` (generic range)
  - `src/core/types.ts`
  - `src/core/save.ts`
  - `src/core/maps.ts` (`addMap` makes normal maps)
  - `src/ui/character/itemView.ts` (map card lines)
  - `README.md`
- Create: `src/core/mapMods.ts`.
- Test: `tests/core/mapMods.test.ts`, `tests/core/save.test.ts`, `tests/ui/itemView.test.ts`.

**Interfaces:**
- **`items.ts`:**
  - `MAP_MOD_KINDS = ['monsterLife', 'monsterDamage', 'monsterSpeed', 'bossPower', 'weakHealing', 'hardened'] as const`, with `type MapModKind`.
  - `interface MapMod { kind: MapModKind; tier: number; value: number }`.
  - `type MapRarity = 'normal' | 'magic' | 'rare'`.
  - `MapItem` becomes `{ id; type: 'map'; tier; metre; rarity: MapRarity; mods: MapMod[]; sealed?: true }`.
- **`balance.ts`:**
  - `MAP_MOD_TIERS: Readonly<Record<MapModKind, { base: number; step: number }>>`, with the values from "Decisions".
  - `MAP_MOD_CAPS: Readonly<Partial<Record<MapModKind, number>>> = { weakHealing: 90, hardened: 75 }`.
  - `MAP_REWARD_FACTORS = { quantity: 0.5, rarity: 0.3, souls: 0.5 }`.
  - `MAX_MAP_MODS = 6`.
- **`tiers.ts`:** `rangeOf(def: { base: number; step: number }, tier: number): { lo: number; hi: number }`, the same formula as `tierRange`. `tierRange` becomes a thin call to it.
- **`mapMods.ts`:**
  - `mapModRange(kind: MapModKind, tier: number)`.
  - `interface MapEffects { lifeMult: number; damageMult: number; speedMult: number; bossMult: number; healMult: number; takenMult: number; quantity: number; rarity: number; souls: number }`.
    - `lifeMult` is `1 + Σ monsterLife / 100`, and the damage, speed and boss multipliers work the same way.
    - `healMult` is `1 − min(90, Σ weakHealing) / 100`.
    - `takenMult` is `1 − min(75, Σ hardened) / 100`.
    - `quantity`, `rarity` and `souls` are whole percentages, `Math.round(Σ value × factor)`.
  - `mapEffects(map: MapItem): MapEffects`.
  - `MAP_MOD_TEXT: Readonly<Record<MapModKind, (v: number) => string>>`, exactly:
    - `Monsters have +N% life`
    - `Monsters deal +N% damage`
    - `Monsters attack N% faster`
    - `Champions and bosses are N% stronger`
    - `Rooms heal N% less`
    - `Monsters take N% less damage`
- **`save.ts`:** `SCHEMA_VERSION = 8`, plus `MIGRATIONS[7]`.

- [ ] **Step 1: Write the failing tests.**
  - **`mapModRange`:** `mapModRange('monsterLife', 4)` is `{ lo: 25, hi: 29 }` and `mapModRange('weakHealing', 2)` is `{ lo: 15, hi: 19 }`.
  - **`mapEffects`:**
    - A map with monster life T4 27, monster damage T3 17, monster speed T4 15 and weak healing T2 16 gives:
      - `lifeMult` 1.27, `damageMult` 1.17, `speedMult` 1.15, `healMult` 0.84;
      - `bossMult` 1, `takenMult` 1;
      - `quantity` 38, `rarity` 23, `souls` 38 (75 × 0.5 = 37.5 → 38).
    - Weak healing 120 caps `healMult` at 0.1.
    - A normal map gives all multipliers 1 and rewards 0.
  - **Migration (`save.test.ts`):** decode `save-schema-7.txt`.
    - Every map, in the bag, the Maps tab, `activity.run.map` and `lastRun.map`, has `rarity: 'normal'` and `mods: []`, and keeps every other field.
    - All older fixtures, 1–6, still load.
  - **Validator:** it rejects a repeated modifier kind, more than 6 modifiers, a magic map with 3, a normal map with any, a modifier tier of 0 or above `tier + 2`, a non-integer value and a non-boolean `sealed`.
  - **Card (`itemView.test.ts`):**
    - A magic tier-4 map's kind line is `Magic tier 4 map · 6 rooms`. A normal map's kind line is unchanged.
    - Its lines are the modifier texts, prefixed with tiers, `T4 Monsters have +27% life`.
    - Then comes `Rewards: +38% items · +23% rarity · +38% Souls`, shown only when the map has modifiers.
    - Then `Found at 327 m`.
    - A sealed map adds the muted line `Tempered: it can't be enchanted any more.`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run tests/core/mapMods.test.ts tests/core/save.test.ts tests/ui/itemView.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - `addMap` creates `rarity: 'normal', mods: []`.
  - `MIGRATIONS[7]` adds those two fields to every map. Malformed input is returned unchanged, as in the earlier migrations.
  - The card's map rarity colours reuse the gear rarity colours.
- [ ] **Step 4: Update the README.** Add one sentence: maps now come in normal, magic and rare, and the card shows their modifiers and rewards.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** Run `git commit -am "Give maps a rarity and tiered modifiers, and migrate old maps"`, after `git add` for the new files.

---

### Task 2: Map modifiers in combat

**Files:**
- Modify: `src/core/monsters.ts`, `src/core/combat.ts`, `src/core/maps.ts`, `README.md`.
- Test: `tests/core/combat.test.ts`, `tests/core/rewards.test.ts`, `tests/core/mapMods.test.ts`.

**Interfaces:**
- `monsterState(tier: number, lm: LayoutMonster, fx?: MapEffects): MonsterState`, where `fx` defaults to no effects:
  - life is × `lifeMult`;
  - damage is × `damageMult`;
  - `intervalS` is ÷ `speedMult`;
  - champions and bosses also get × `bossMult` on life and damage.

  Rounding and clamping stay as today.
- In combat, every place that builds monsters passes `mapEffects(run.map)`: `startMap`, `roomQueue` and the boss.
- **`strike`:** the damage dealt is `Math.max(1, Math.round(dealt × takenMult))`. It applies after crit, Armored and elemental damage, and makes no extra draw.
- **Room healing** is × `healMult`.
- **`onKill`:**
  - The Souls multiplier is × `(1 + souls / 100)`.
  - Magic find is × `(1 + rarity / 100)`.
  - `DROP_CHANCE`, `MAP_GEM_CHANCE` and `MAP_MATERIAL_CHANCE` are each × `(1 + quantity / 100)`, capped at 1.
  - It keeps the same draws in the same order.

- [ ] **Step 1: Write the failing tests.**
  - **Same dungeon:** for a fixed seed and map, `dungeonLayout` and the monster names, species, ranks and mods are deep-equal with and without modifiers. Life, damage and interval scale by exactly the multipliers.
  - **Run replay (Review Focus 1):** decode `save-schema-7.txt`, pump the run in progress to its end and record `state.rng`, the log and gains. Doing the same on a copy whose map gets `mods: []` set again gives identical results.
  - **`hardened` 50:** a strike of 10 deals 5, and a strike of 1 deals 1.
  - **`weakHealing` 50:** a room clear heals half the plain amount.
  - **Rewards:**
    - With `quantity` 100, 4,000 normal kills drop items at a rate within 0.02 of `min(1, 2 × DROP_CHANCE)`.
    - With `souls` 100, Souls per kill average twice the plain rate, within 5 %.
    - The rng after N kills equals the plain map's rng after N kills.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Say what enchanted maps do: harder monsters and richer rewards, with the same dungeon.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** Run `git commit -am "Make map modifiers scale monsters, healing and rewards"`.

---

### Task 3: Enchanting maps

**Files:**
- Modify: `src/core/crafting.ts`, `src/core/types.ts`, `src/core/balance.ts`, `src/core/inventory.ts` (drag a material onto a map), `src/store/gameStore.ts`.
- Test: `tests/core/mapCrafting.test.ts`.

**Interfaces:**
- **`CraftCheck`** gains `'notForMaps' | 'noSouls'`. `TemperOutcome` is reused.
- **`balance.ts`:** `MAP_CRAFT_SOULS_PER_TIER = 5`.
- **`craftCost(kind, level: number)`** now takes a level. Gear passes `ilvl`, and maps pass `tier`. Update every caller.
- **`mapCraftSouls(map: MapItem): number`** is `MAP_CRAFT_SOULS_PER_TIER × tier`.
- **`canCraft(state, target, kind)` and `craft(state, target, kind, from?)`** accept a map target: a map in the bag, or `{ where: 'maps', index }`. The order of checks:
  1. `sealed`;
  2. a material that doesn't work on maps → `notForMaps`;
  3. the material's own rule;
  4. `short` (too little material);
  5. `noSouls` (too few Souls).

  Payment takes the material and the Souls together, only after the map's change has applied.
- **Map rules:**
  - **Copper:** a normal map becomes magic, with 1–2 modifiers.
  - **Iron:** adds a modifier. A magic map with 2 becomes rare with 3. A rare map with 6 → `noRoom`.
  - **Silver:** a rare map gets 4–6 new modifiers.
  - **Obsidian:** removes one random modifier. A magic map's last modifier makes it normal. A map with no modifiers → `nothingToChange`.
  - **Void crystal:** magic or rare only.
    - It uses `TEMPER_WEIGHTS`:
      - `craftedLine` adds a modifier of a missing kind at tier `tier + 1`, or becomes `nothing` when all 6 are present;
      - `raiseTiers` raises every modifier by 1, up to `tier + 2`, and rerolls it in its new tier;
      - `ruin` drops every modifier to T1 and rerolls it.
    - In every case the map is then sealed.
  - **Wrong rarity** → `wrongRarity`, as with gear.
- **Modifier rolls:** `rollMapMods(state, map, count)` picks kinds the map lacks uniformly from `state.rng`. It rolls each tier with `tierWeights(map.tier)` and each value uniformly in `mapModRange`.
- **Store:** `craft` already covers map targets through the same method.

- [ ] **Step 1: Write the failing tests** in `tests/core/mapCrafting.test.ts`. Each test uses a fixed `s.rng`.
  - **Each rule:** test each rule above, including the rarity changes and that the map's `tier`, `metre` and `id` never change.
  - **Cost:** Copper on a normal tier-4 map spends `1 + 2 = 3` copper and 20 Souls.
  - **Refusals (Review Focus 3):** `notForMaps` (Tin, Mithril, Starsteel, Diamonds), `wrongRarity`, `noRoom`, `nothingToChange`, `short`, `noSouls` and `sealed` each leave the map, the materials, the Souls and the rng deep-equal.
  - **Temper:** each of the four outcomes, found by scanning rng seeds, seals the map.
  - **Drag:** a material dropped on a map in the bag or the Maps tab crafts it. A refusal leaves both where they were.
  - **Fuzz:** 300 random craft chains on maps of tier 1–20 with unlimited materials and Souls. `validateState` holds after every step, and a refusal leaves the state deep-equal.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run tests/core/mapCrafting.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -am "Enchant maps with materials and Souls"`, after `git add` for the new files.

---

### Task 4: Enchanting in the map card

**Files:**
- Modify: `src/ui/character/{craftView,itemActions,ItemCard}.ts(x)`, `src/ui/character/character.css`, `README.md`.
- Test: `tests/ui/craftView.test.ts`, `tests/ui/itemActions.test.ts`.

**Interfaces:**
- **`craftOptions(state, target)`** also covers maps. Each `CraftOption` gains `souls: number`, which is 0 for gear.
- **`craftLabel(kind, cost, souls, target: 'gear' | 'map')`.** For a map it reads `${label} ×${cost} + ${souls} Souls: ${verb}`. The verbs are:

  | Material | Verb |
  |---|---|
  | Copper | `enchant it` |
  | Iron | `add a modifier` |
  | Silver | `reroll its modifiers` |
  | Obsidian | `remove a modifier` |
  | Void crystal | `temper it (risky)` |

- **`craftResultText(result, target: 'gear' | 'map')`.** Copy stays the same, with these changes and additions:
  - `notForMaps`: "That material doesn't work on maps."
  - `noSouls`: "Not enough Souls."
  - On a map, temper `craftedLine` reads "Tempered: it gained a strong modifier.".
  - On a map, `raiseTiers` reads "Tempered: every modifier rose a tier.".
  - On a map, `ruin` reads "Tempered: it was ruined, every modifier fell to tier 1.".
  - On a map, `sealed` reads "It was tempered and can't be enchanted any more.".
- **The map action card:** after its actions it shows an "Enchant" label and the option buttons. It uses the same two-column grid and the same pointer-safe anchoring as the gear card from Plan 7.
- **An option is disabled** when the player has too little material or too few Souls.

- [ ] **Step 1: Write the failing tests.**
  - **Normal tier-4 map** with 37 copper and 50 Souls: the options are exactly one, Copper (`cost 3, souls 20`, enabled). Iron works only on magic or rare maps.
  - **Rare map:** it lists Iron (unless it has 6 modifiers), Silver, Obsidian and Void crystal.
  - **Sealed map:** it lists nothing.
  - **Labels:** `craftLabel('copper', 3, 20, 'map')` is `Copper ore ×3 + 20 Souls: enchant it`.
  - **Result texts:** every new string is pinned.
  - **Action order:** in `itemActions`, the map craft actions come after "Run this map" and the move action.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **Gear stays the same:** gear options keep their labels and keep "Craft" as the section label.
  - **Map card:**
    - The section label is "Enchant".
    - The card shows `Rewards: …` under the modifier lines (Task 1).
    - The muted line "Enchanting never changes the dungeon itself; it scales the monsters and the rewards. Dying still loses the map." appears once on the map's hover card.
- [ ] **Step 4: Update the README.** Explain how to enchant a map.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** Run `git commit -am "Enchant maps from their card and by dragging a material onto them"`.

---

### Task 5: Soul upgrades

**Files:**
- Create: `src/core/soulUpgrade.ts`.
- Modify:
  - `src/core/balance.ts`
  - `src/store/gameStore.ts`
  - `src/ui/character/{itemActions,itemView}.ts`
  - `README.md`
- Test: `tests/core/soulUpgrade.test.ts`, `tests/ui/itemActions.test.ts`.

**Interfaces:**
- **`balance.ts`:** `SOUL_UPGRADE_BASE = 5`, and `MAX_ITEM_LEVEL = 100_000`, the cap the validator's `isItemLevel` already uses as a bare literal. Use the constant in both places.
- **`soulUpgradeCost(ilvl: number): number`** = `SOUL_UPGRADE_BASE × ilvl²`.
- **`canUpgrade(state, target: ItemLoc): 'ok' | 'notBattle' | 'sealed' | 'maxLevel' | 'noSouls' | 'invalid'`.** `invalid` covers anything that isn't gear.
- **`soulUpgrade(state, target)`** has the same result type. It raises `ilvl` by 1, takes the Souls, and changes nothing else: name, lines, implicit and sockets all stay.
- **Store:** `soulUpgrade(target)`.
- **Item actions:**
  - Battle gear in the bag, the General tab or worn gets the action `Upgrade with Souls: item level 6 → 7 · 180 Souls`, with id `'soulUpgrade'`. It is disabled with too few Souls, and absent on sealed or mining gear.
  - The result texts are `noSouls` "Not enough Souls." and `maxLevel` "It can't go any higher.".
  - The action sits after the gear's other actions and before the Craft section.

- [ ] **Step 1: Write the failing tests.**
  - **Cost:** `soulUpgradeCost(6)` is 180.
  - **An upgrade:** it raises `ilvl` 6 → 7, takes 180 Souls and leaves every other field deep-equal.
  - **Tier bound (Review Focus 5):** an item with a line at tier `ilvl + 2` passes the validator, both before and after the upgrade. After the upgrade, `validateState` accepts a crafted line at the new `ilvl + 2`.
  - **Refusals:** mining gear, sealed gear, too few Souls and an item at `MAX_ITEM_LEVEL` each spend nothing.
  - **Mid-run:** upgrading the worn weapon during a run returns `ok`, and the next `mapTick` uses the stats derived after the upgrade, so nothing crashes or desyncs.
  - **Action:** the action label and its placement, as above.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Update the README.** Souls upgrade battle gear one item level at a time, which raises how high later crafts can roll.
- [ ] **Step 5: Run everything and confirm it passes.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** Run `git commit -am "Upgrade battle gear with Souls"`, after `git add` for the new files.

---

### Task 6: The merchant: gambling

**Files:**
- Create:
  - `src/core/merchant.ts`
  - `src/ui/merchant/MerchantView.tsx`
  - `src/ui/merchant/merchantView.ts`
  - `src/ui/merchant/merchant.css`
- Modify:
  - `src/core/itemGen.ts` (`rollGear` takes an optional slot)
  - `src/core/balance.ts`
  - `src/store/gameStore.ts`
  - `src/ui/Nav.tsx`
  - `src/ui/App.tsx`
  - `README.md`
- Test: `tests/core/merchant.test.ts`, `tests/ui/merchantView.test.ts`.

**Interfaces:**
- **`balance.ts`:** `GAMBLE_GOLD = 300`.
- **`gamblePrice(state: GameState): number`** = `GAMBLE_GOLD × t²`, where `t = metreTier(max(1, state.deepest))`.
- **`rollGear(state, ilvl, set, rarity?, slot?: Slot)`.**
  - With a slot given, it skips the slot draw. A legendary rolled for a slot that has no legendary becomes rare. Without a slot, its draws are exactly as before.
- **`gamble(state, slot: Slot): { result: 'ok' | 'noGold' | 'bagFull'; item?: GearItem }`.**
  - It checks the bag and the Gold before anything else.
  - It then rolls `rollGear(state, t, setOfSlot(slot), rollRarity(state), slot)` and puts the item in the first empty bag cell. The loot filter is never applied.
  - Last, it takes the Gold.
- **Store:** `gamble(slot)` returns the result and keeps `lastGamble: GearItem | null` for the view.
- **Nav:** `View` gains `'merchant'`, and the Nav gets a third tab, "Merchant". The App renders `MerchantView` for it.
- **`merchantView.ts`:**
  - `gambleSlots(state)` returns `{ set: 'mining' | 'battle'; slots: { slot; label; price; affordable }[] }[]`. It has two groups, in `MINING_SLOTS` / `BATTLE_SLOTS` order.
  - The slot labels are `Pickaxe`, `Lamp helm`, `Gloves`, `Boots`, `Weapon`, `Armor`, `Helm`, `Ring` and `Amulet`.
  - `gambleResultText(r)` gives `noGold` "Not enough Gold." and `bagFull` "Your bag is full.".

- [ ] **Step 1: Write the failing tests.**
  - **Price:** with `deepest` 1,100 (tier 7), `gamblePrice` is 14,700. With `deepest` 0, the price is that of tier 1, which is 300.
  - **A gamble:** gambling a ring with enough Gold puts a ring at ilvl `t` in the first empty bag cell and takes the price. The item is valid.
  - **No loot filter:** with a loot filter rule that would sell every ring, the ring still lands in the bag.
  - **Refusals (Review Focus 4):** with a full bag, or 1 Gold short, the gamble returns `bagFull` or `noGold`. The state is deep-equal, including the rng and `nextId`.
  - **Legendary helm:** forcing rarity `legendary` for `helm` gives a rare helm.
  - **Drops unchanged:** `rollGear` without a slot gives byte-identical results for 200 fixed seeds before and after the change. Pin a hash of the outputs from the old code.
  - **View:** `gambleSlots` has the right groups, labels, prices and `affordable` flags.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement the core, the store, the Nav tab and the view.**
  - **The view follows the "Plan 8" board:**
    - the heading "The Merchant", with the Gold total;
    - the intro line: "Gamble: pay Gold for a random item of the slot you pick, rolled at your deepest tier (N). Most are normal or magic; a few are rare; legendaries are very rare.";
    - two groups headed "Mining gear" and "Battle gear", each slot showing its sprite, its label and a `Gamble · 14,700 Gold` button (≥ 40 px, `aria-disabled` when unaffordable);
    - a "You got" panel showing the last gambled item's name in its rarity colour, then `${Rarity} ${label} · item level N · now in your bag`;
    - a status line for refusals;
    - the closing line "The merchant never sells Diamonds or Souls. Selling items stays in their cards.".
  - **Layout:** the slot grids wrap to 2 columns on narrow screens. The page never scrolls sideways.
- [ ] **Step 4: Update the README.** Add a Merchant paragraph.
- [ ] **Step 5: Run everything and confirm it passes, then check in a browser.**
  - Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Then run the browser check:
    - Tools: puppeteer-core, Chrome at `/usr/bin/google-chrome` with `--no-sandbox`, a fresh browser context, `http://127.0.0.1:5180/`.
    - Sizes: 1280×900 and 390×844.
    - Load: import `tests/fixtures/save-schema-7.txt` through Settings → Export / import save… → Load. Build a modified copy with Gold, materials and Souls in the job tmp directory; never edit the fixture.
    - Check that:
      - the run in progress continues;
      - enchanting a map from its card works and shows its modifiers and rewards;
      - running the enchanted map works;
      - a Soul upgrade on battle gear works;
      - the Merchant tab gambles a ring into the bag and refuses with "Not enough Gold.";
      - nothing scrolls the page sideways at 390 px.
- [ ] **Step 6: Commit.** Run `git commit -am "Add the merchant's gambling tab"`.
