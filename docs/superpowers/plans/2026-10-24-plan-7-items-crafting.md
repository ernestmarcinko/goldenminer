# Plan 7: Items and crafting, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gear follows the ARPG modifier model: 3 prefixes and 3 suffixes, every line tiered from T1 up without end, and a pool of 16 modifiers per gear set. Every mined material, plus Diamonds, crafts gear PoE-style: drag it onto an item, or pick it in the item's card.

**Architecture:**
- **Data tables.** `balance.ts` gets one tier table per stat (`STAT_TIERS`), replacing `STAT_RANGES`. `items.ts` gets a side table (`MOD_SIDE`) and the line type (`ModLine`).
- **Rolling.** Generation and tier rolls live in `itemGen.ts`.
- **Save.** Schema 7 adds tiers and crafted flags to every existing line. Old values are kept and labelled with the tier they fall in.
- **Crafting.** A new pure module, `src/core/crafting.ts`, holds every craft. The store and the item card call it, and drag-and-drop reaches it the way socketing a gem does.

**Tech stack:** TypeScript 7, React 19, Vite 8, Vitest 5, lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-round-3-economy-inventory-crafting-design.md`. This plan covers:
- §5.1 (modifiers);
- §5.2 (crafting), except the Souls upgrade;
- the §7 rules for modifiers.

Plan 8 covers the rest: map enchanting (§6), Soul upgrades and the merchant (§8: gambling only).

## Global Constraints

- **Node:** prefix every command with `export PATH=/root/.nvm/versions/node/v24.22.1/bin:$PATH`. Run tests with `npx vitest run` and types with `npx tsc --noEmit`. Both must be clean at the end of every task.
- **Commits:** a plain imperative sentence, like the repo's. Never add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.
- **Fixtures:** `tests/fixtures/save-schema-1.txt` … `save-schema-6.txt` are real exports. Never regenerate or edit them.
  - `save-schema-6.txt` comes from the Plan 6 engine. Deepest is 1,151 m. It holds 236 gear items: 130 normal, 84 magic (most with two lines), 20 rare (most with four lines) and 2 legendaries.
  - Two worn items carry socketed gems. There is a map in the bag, materials in the Materials tab, one bought General page and one held item.
- **Seeds:** `rollMetre`, `fillAhead`, `metreLayer`, the dungeon and monster code and the RNG streams they use stay byte-for-byte the same. Crafting and item rolls draw from `state.rng` only.
- **Anti-goals:**
  - never punish absence;
  - a refused craft never spends anything;
  - no line, value or gem is ever silently destroyed. The one exception is Void crystal's "ruin" outcome, which the player chose to risk.
- **Copy:** plain words, no jargon. Exact strings in this plan are copy; use them verbatim.
- **Targets:** interactive targets are at least 40 px tall.
- **Code style:** match the surrounding code: sparse comments that say why, `readonly` tables in `balance.ts`, exhaustive `switch` over unions.
- **README:** each task that changes play updates its README paragraph in the README's existing voice.

## Review Focus

1. **Old items keep every line.** Every migrated item keeps every line and value, in order. A line beyond 3 on its side becomes a crafted line rather than being dropped. Task 2 tests this on the real fixture.
2. **A refused craft spends nothing.** This covers a sealed item, a legendary, the wrong rarity, a full item and too little material. Task 4 tests every refusal.
3. **Crafting worn gear updates its stats at once.** Crafting a worn mining item refreshes lamp sight and dig power, including the lamp hints ahead. Crafting worn battle gear mid-run takes effect on the next strike. Task 4 tests the mining side.
4. **Dragging a stack pays from that stack.** A craft started by dragging a material stack pays from that stack first, then from other bag stacks, then from the tab. A card craft pays from bag stacks, then the tab. Neither ever takes more than the cost. Task 4 tests both.
5. **Rerolling sockets never loses a gem.** Mithril on socketed gear returns each gem to the Gems tab. If any gem's tab slot is at its cap, the craft is refused. Task 4 tests both.

## Decisions this plan makes (my calls, for Ernest to check)

- **Tiers:**
  - an item's level is its tier cap, and items drop at the tier of their depth, so a T7 cap means 1,000 m and below;
  - tiers are weighted toward the low end (weight `cap − t + 1`);
  - each tier is a contiguous value range growing linearly.
- **Lines by rarity:**
  - magic rolls 1 line (50 %) or 2 (50 %), and 2 lines are always one prefix plus one suffix;
  - rare rolls 4 (50 %), 5 (35 %) or 6 (15 %).
- **Crafted lines** come only from Void crystal's best outcome, at most 2 per item, counted outside the 3 + 3. No separate lock material.
- **Void crystal (temper)** applies to magic and rare items. It rolls one outcome:

  | Outcome | Chance | What happens |
  |---|---|---|
  | Crafted line | 30 % | a crafted line one tier above the cap |
  | Raise tiers | 25 % | every line +1 tier, rerolled in its new tier |
  | Nothing | 25 % | no change |
  | Ruin | 20 % | every line drops to T1 |

  Either way, the item is then sealed.
- **Craft costs grow with item level:**

  | Material | Cost |
  |---|---|
  | Copper, Tin, Iron | `1 + floor(ilvl / 2)` |
  | Silver, Mithril, Starsteel | `1 + floor(ilvl / 4)` |
  | Diamonds (exalt) | `1 + floor(ilvl / 3)` |
  | Obsidian, Void crystal | 1 |

- **Other craft rules:**
  - Obsidian keeps an item's rarity.
  - Mithril works on legendaries too, as it touches only sockets.
  - Legendaries refuse every other craft.
  - Sealed items refuse every craft.
- **The 32 modifiers and their sides** are listed in Task 1. The new stats work like this:
  - **Vein yield** adds to every vein's amount.
  - **Ore find** adds a chance of a bonus material vein on metres the seed left empty of everything.
  - **Salvage yield** and **sell bonus** raise those payouts.
  - **Elemental damage** adds to every hit, and Armored doesn't soften it.
  - **Critical damage** raises the 1.5× multiplier.
  - **Life regeneration** heals per second in maps.
  - **Life per kill** heals on each kill.
  - **XP** raises XP from kills.

---

### Task 1: Modifier tables, sides and tier rolls

**Files:**
- Modify:
  - `src/core/items.ts` (new stat keys, `MOD_SIDE`, `ModLine`);
  - `src/core/balance.ts` (`STAT_TIERS` replaces `STAT_RANGES`);
  - `src/core/itemData.ts` (`MOD_WORDS` replaces `STAT_WORDS`);
  - `src/ui/character/itemView.ts` (`STAT_LABELS`);
  - every compile site of `STAT_RANGES`, `statRange`, `rollStat` and `STAT_WORDS`.
- Create: `src/core/tiers.ts`.
- Test: `tests/core/tiers.test.ts`.

**Interfaces:**
- **`MINING_STATS`:**
  - existing: `digPower, goldYield, diamondYield, chestFind, gemFind, mapFind, lampSight, ticksPerClick, autoTickRate, offlineCap, hazardWard`;
  - new, appended: `digPowerPct, veinYield, oreFind, salvageYield, sellBonus`.
- **`BATTLE_STATS`:**
  - existing: `damage, damagePct, attackSpeed, life, armor, critChance, resistAll, soulFind, magicFind`;
  - new, appended: `elementalDamage, critMultiplier, lifePct, armorPct, lifeRegen, lifeOnKill, xpFind`.
- **`MOD_SIDE: Readonly<Record<StatKey, 'prefix' | 'suffix'>>`:**
  - mining prefixes: `digPower, digPowerPct, goldYield, diamondYield, veinYield, autoTickRate, ticksPerClick, sellBonus`;
  - mining suffixes: `chestFind, gemFind, mapFind, oreFind, lampSight, offlineCap, hazardWard, salvageYield`;
  - battle prefixes: `damage, damagePct, elementalDamage, attackSpeed, critChance, critMultiplier, life, lifePct`;
  - battle suffixes: `armor, armorPct, resistAll, lifeRegen, lifeOnKill, soulFind, magicFind, xpFind`.
- **`interface ModLine { stat: StatKey; value: number; tier: number; crafted?: true }`.** `tier` is 0 only for a legendary's hand-written line. `StatLine` stays for implicits and gem effects.
- **`STAT_TIERS: Readonly<Record<StatKey, { base: number; step: number }>>`**, exactly:

  | Stat | base | step | Stat | base | step |
  |---|---|---|---|---|---|
  | digPower | 2 | 2 | damage | 2 | 3 |
  | digPowerPct | 4 | 2 | damagePct | 4 | 2 |
  | goldYield | 4 | 2 | elementalDamage | 2 | 3 |
  | diamondYield | 4 | 2 | attackSpeed | 3 | 2 |
  | veinYield | 3 | 1.5 | critChance | 1 | 0.5 |
  | autoTickRate | 3 | 2 | critMultiplier | 5 | 3 |
  | ticksPerClick | 1 | 0.2 | life | 8 | 6 |
  | sellBonus | 5 | 2 | lifePct | 3 | 2 |
  | chestFind | 5 | 2 | armor | 6 | 5 |
  | gemFind | 5 | 2 | armorPct | 4 | 2 |
  | mapFind | 5 | 2 | resistAll | 3 | 2 |
  | oreFind | 5 | 2 | lifeRegen | 1 | 0.5 |
  | lampSight | 1 | 0.25 | lifeOnKill | 2 | 2 |
  | offlineCap | 15 | 5 | soulFind | 4 | 2 |
  | hazardWard | 5 | 2 | magicFind | 4 | 2 |
  | salvageYield | 5 | 2 | xpFind | 3 | 2 |

- **In `src/core/tiers.ts`:**
  - `tierRange(stat: StatKey, tier: number): { lo: number; hi: number }`, where `lo = max(1, round(base + step × (tier − 1)))` and `hi = max(lo, round(base + step × tier) − 1)`;
  - `tierFor(stat: StatKey, value: number): number`, the smallest tier `≥ 1` whose `hi ≥ value`;
  - `tierCap(ilvl: number): number` = `Math.max(1, ilvl)`;
  - `tierWeights(cap: number): [number, number][]` = `[t, cap − t + 1]` for `t = 1..cap`.
- **`MOD_WORDS: Readonly<Record<StatKey, string>>`.** It holds the prefix word for prefix stats and the suffix word for suffix stats.
  - Existing stats keep their word from today's `STAT_WORDS` on their side.
  - Mining additions: `digPowerPct: 'Honed', veinYield: 'Bountiful', sellBonus: 'Shrewd', oreFind: 'Ore', salvageYield: 'Salvage'`.
  - Battle additions: `elementalDamage: 'Searing', critMultiplier: 'Deadly', lifePct: 'Robust', armorPct: 'the Bulwark', lifeRegen: 'Mending', lifeOnKill: 'the Leech', xpFind: 'Learning'`.
- **`STAT_LABELS` additions:**

  | Stat | Label | Unit |
  |---|---|---|
  | digPowerPct | dig power | `%` |
  | veinYield | vein yield | `%` |
  | oreFind | ore find | `%` |
  | salvageYield | salvage yield | `%` |
  | sellBonus | Gold from selling | `%` |
  | elementalDamage | elemental damage | (none) |
  | critMultiplier | critical damage | `%` |
  | lifePct | life | `%` |
  | armorPct | armor | `%` |
  | lifeRegen | life per second | (none) |
  | lifeOnKill | life per kill | (none) |
  | xpFind | XP | `%` |

- [ ] **Step 1: Write the failing tests** in `tests/core/tiers.test.ts`:

```ts
it('tier ranges are contiguous and grow', () => {
  expect(tierRange('digPower', 1)).toEqual({ lo: 2, hi: 3 });
  expect(tierRange('digPower', 2)).toEqual({ lo: 4, hi: 5 });
  expect(tierRange('digPower', 5)).toEqual({ lo: 10, hi: 11 });
  expect(tierRange('lampSight', 1)).toEqual({ lo: 1, hi: 1 });
  expect(tierRange('lampSight', 5)).toEqual({ lo: 2, hi: 2 });
  expect(tierRange('critChance', 4)).toEqual({ lo: 3, hi: 3 });
  for (const stat of [...MINING_STATS, ...BATTLE_STATS]) for (let t = 1; t < 40; t++) {
    const a = tierRange(stat, t); const b = tierRange(stat, t + 1);
    expect(a.lo).toBeLessThanOrEqual(a.hi);
    expect(b.lo).toBeGreaterThanOrEqual(a.lo);
    expect(b.hi).toBeGreaterThanOrEqual(a.hi);
  }
});
it('tierFor finds the tier a value falls in', () => {
  expect([tierFor('digPower', 3), tierFor('digPower', 4), tierFor('digPower', 11), tierFor('digPower', 1)]).toEqual([1, 2, 5, 1]);
});
it('every set has 8 prefixes and 8 suffixes', () => {
  for (const stats of [MINING_STATS, BATTLE_STATS]) {
    expect(stats.filter((s) => MOD_SIDE[s] === 'prefix')).toHaveLength(8);
    expect(stats.filter((s) => MOD_SIDE[s] === 'suffix')).toHaveLength(8);
  }
});
it('tier weights favour low tiers', () => {
  expect(tierWeights(3)).toEqual([[1, 3], [2, 2], [3, 1]]);
  expect(tierCap(0)).toBe(1);
  expect(tierCap(9)).toBe(9);
});
```

- [ ] **Step 2: Run the tests and check they fail.**
  - Run `npx vitest run tests/core/tiers.test.ts`.
  - Expected: FAIL, because `../../src/core/tiers` cannot be resolved.
- [ ] **Step 3: Implement the tables and helpers.**
  - Point today's users of `statRange` and `rollStat` at the new tables:
    - implicits roll uniformly in `tierRange(stat, tierCap(ilvl))`;
    - a gem effect's value is `tierRange(stat, GEM_GRADE_LEVEL[grade]).hi`;
    - today's affix roll uses `tierRange(stat, tierCap(ilvl))` until Task 2 replaces it.
  - Delete `STAT_RANGES`, `statRange` and `rollStat`.
  - `STAT_WEIGHTS` keeps `ticksPerClick: 2, lampSight: 4`, and every new stat uses `DEFAULT_STAT_WEIGHT`.
  - Expected-value updates in existing gem and implicit tests are allowed when the new tables are the cause. List each one in the report.
- [ ] **Step 4: Run all tests and check they pass.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -am "Add tiered modifier tables with 8 prefixes and 8 suffixes per gear set"`, after `git add`ing the new files.

---

### Task 2: Schema 7, with prefix and suffix lines, tiers, generation and the migration

**Files:**
- Modify: `src/core/items.ts`, `src/core/itemGen.ts`, `src/core/save.ts`, `src/core/balance.ts`, `src/core/stats.ts` (line totals), `src/ui/character/itemView.ts` (card lines), `README.md`.
- Test: `tests/core/itemGen.test.ts`, `tests/core/save.test.ts`, `tests/ui/itemView.test.ts`.

**Interfaces:**
- **`GearItem`:**
  - `affixes: ModLine[]`;
  - `sealed?: true`;
  - `implicit: StatLine` stays.
- **`balance.ts`:**
  - `MAGIC_LINE_WEIGHTS: readonly [number, number][] = [[1, 50], [2, 50]]`;
  - `RARE_LINE_WEIGHTS = [[4, 50], [5, 35], [6, 15]]`;
  - `MAX_SIDE_LINES = 3`;
  - `MAX_CRAFTED_LINES = 2`;
  - `MAX_TIER_OVER_CAP = 2`;
  - remove `MAX_AFFIXES` and `RARE_FOURTH_AFFIX_CHANCE`.
- **`itemGen.ts`:**
  - `rollModLine(state: Gen, stat: StatKey, cap: number): ModLine` rolls a tier from `tierWeights(cap)`, then a value uniform in its range;
  - `rollLines(state: Gen, slot: Slot, ilvl: number, count: number, existing?: readonly ModLine[]): ModLine[]` adds `count` lines:
    - never repeats a stat;
    - never uses the slot's implicit stat;
    - never exceeds `MAX_SIDE_LINES` on a side;
    - for magic, at most 1 per side;
    - draws by `STAT_WEIGHTS`;
  - `magicName(slot: Slot, ilvl: number, lines: readonly ModLine[]): string` gives `${prefixWord} ${base} of ${suffixWord}`, dropping the missing half;
  - `rareName(state: Gen, slot: Slot): string`;
  - `sideCount(lines: readonly ModLine[], side: 'prefix' | 'suffix'): number`, which counts non-crafted lines.
- **`save.ts`:** `SCHEMA_VERSION = 7` and `MIGRATIONS[6]`.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/core/itemGen.test.ts`, over 2,000 `rollGear` calls at ilvl 8 for each set:
    - normal items have 0 lines;
    - magic items have 1–2 lines, at most 1 prefix and 1 suffix;
    - rare items have 4–6 lines, at most 3 per side;
    - no stat repeats, and no line uses the implicit stat;
    - every non-legendary line has `1 ≤ tier ≤ 8`, with the value inside `tierRange(stat, tier)`;
    - legendary lines have tier 0;
    - the share of T1 lines exceeds the share of T8 lines.
  - Also in `itemGen.test.ts`, the magic names: with a `digPower` T1 line and a `chestFind` T1 line, a pickaxe of ilvl 4 is `Sharp Iron Pick of Treasure`. A suffix-only pickaxe is `Iron Pick of Treasure`.
  - In `tests/core/save.test.ts`, import `fixture6` (`../fixtures/save-schema-6.txt?raw`):

```ts
it('the schema-6 fixture migrates every line to a tiered prefix or suffix', () => {
  const raw = JSON.parse(decompressFromBase64(fixture6.trim())).state;
  const r = decodeSave(fixture6.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const gearOf = (s: any): any[] => [...s.bag, ...s.stash.general, ...Object.values(s.equipped.mining), ...Object.values(s.equipped.battle), ...s.overflow]
    .filter((c: any) => c?.type === 'gear');
  const before = gearOf(raw); const after = gearOf(r.state);
  expect(after.map((g) => g.id)).toEqual(before.map((g) => g.id));
  for (const [i, g] of after.entries()) {
    const old = before[i];
    expect({ ...g, affixes: undefined }).toEqual({ ...old, affixes: undefined });          // nothing else changes
    expect(g.affixes.map((a: ModLine) => [a.stat, a.value])).toEqual(old.affixes.map((a: any) => [a.stat, a.value]));
    for (const a of g.affixes) expect(a.tier).toBe(g.rarity === 'legendary' ? 0 : Math.min(tierFor(a.stat, a.value), g.ilvl + MAX_TIER_OVER_CAP));
    for (const side of ['prefix', 'suffix'] as const) expect(sideCount(g.affixes, side)).toBeLessThanOrEqual(3);
    const sides = g.affixes.map((a: ModLine) => MOD_SIDE[a.stat]);
    // a line is crafted exactly when it is the 4th or later on its side, or the 2nd on a magic item's side
    g.affixes.forEach((a: ModLine, j: number) => {
      const before = sides.slice(0, j).filter((x: string) => x === sides[j]).length;
      expect(a.crafted === true).toBe(before >= (g.rarity === 'magic' ? 1 : 3));
    });
  }
  expect(after.some((g) => g.affixes.some((a: ModLine) => a.crafted))).toBe(true);    // the fixture has such items
});
```

  - Also in `save.test.ts`, the validator:
    - rejects a 4th non-crafted prefix, a 3rd crafted line, a tier above `ilvl + 2`, a tier-0 line on a non-legendary and a non-boolean `sealed`;
    - accepts `sealed: true`;
    - every older fixture (1–5) still loads.
  - In `tests/ui/itemView.test.ts`:
    - card lines show the tier, as `T3 +12 dig power`;
    - a crafted line ends with ` (crafted)`;
    - a legendary line has no tier;
    - a sealed item adds the muted line `Tempered: it can't be crafted any more.`.
- [ ] **Step 2: Run the tests and check they fail.**
  - Run `npx vitest run tests/core/itemGen.test.ts tests/core/save.test.ts tests/ui/itemView.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement generation.**
  - `rollGear` keeps its draw order for rarity, slot, implicit, name and sockets.
  - Legendary lines get tier 0, with values from `tierRange(stat, tierCap(ilvl))` × scale, or fixed.
- [ ] **Step 4: Implement `MIGRATIONS[6]`.**
  - It walks every gear item in the bag, General, worn gear and overflow.
  - It turns each affix into a `ModLine`:
    - `tier` = 0 for legendaries, otherwise `min(tierFor(stat, value), ilvl + MAX_TIER_OVER_CAP)`;
    - `crafted: true` on the 2nd line of a side for magic items and the 4th line of a side for others, in line order.
  - Values, order and every other field stay as they are.
  - Malformed input returns the state unchanged, so the validator rejects it, as in the earlier migrations.
- [ ] **Step 5: Implement the validator rules** from Step 1:
  - non-crafted lines: at most 3 per side, and at most 1 per side on magic items;
  - crafted lines: at most `MAX_CRAFTED_LINES`;
  - tier: an integer, `0` exactly on legendaries, otherwise `1..ilvl + MAX_TIER_OVER_CAP`;
  - `sealed`: absent or `true`.
- [ ] **Step 6: Card lines.**
  - Prefix lines come first, then suffix lines, then crafted lines, each `T${tier} ${statText}`. A legendary line has no tier prefix.
  - `itemKindLine` is unchanged.
- [ ] **Step 7: README.** Gear now has up to 3 prefixes and 3 suffixes. Every line has a tier, and deeper finds can roll higher tiers without limit.
- [ ] **Step 8: Run all tests and check they pass.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 9: Commit** with `git commit -am "Give every gear line a tier and a prefix or suffix side, and migrate old items"`.

---

### Task 3: What the new modifiers do

**Files:**
- Modify: `src/core/stats.ts`, `src/core/battle.ts`, `src/core/types.ts`, `src/core/dig.ts`, `src/core/loot.ts`, `src/core/inventory.ts`, `src/core/combat.ts`, `src/core/balance.ts`, `README.md`.
- Test: `tests/core/gearStats.test.ts`, `tests/core/battle.test.ts`, `tests/core/dig.test.ts`, `tests/core/loot.test.ts`, `tests/core/combat.test.ts`.

**Interfaces:**
- **`Stats`** gains `veinMultiplier`, `oreBonusChance`, `sellMultiplier` and `salvageMultiplier`. `digPower` becomes `clamp((BASE_DIG_POWER + g.digPower) × pct(g.digPowerPct), 1, MAX_DIG_POWER)`.
- **`balance.ts`:** `ORE_BONUS_BASE = 0.3`, `MAX_ORE_BONUS_CHANCE = 0.6`. `oreBonusChance` = `min(MAX_ORE_BONUS_CHANCE, ORE_BONUS_BASE × g.oreFind / 100)`.
- **`BattleStats`** gains `elementalDamage`, `lifeRegen` (life per second), `lifeOnKill` and `xpMultiplier`. It also changes:
  - `maxLife` = `(base + g.life) × pct(g.lifePct)`;
  - `armor` = `g.armor × pct(g.armorPct)`;
  - `critMultiplier` = `CRIT_MULTIPLIER + g.critMultiplier / 100`.
- **`loot.ts`:** `sellPay(item: Loot, stats: Stats): number` and `salvagePay(item: Item, stats: Stats): Partial<Record<Material, number>>`. Every payout site uses them:
  - `inventory.sell` and `inventory.salvage`;
  - the loot filter, `sellWorst` and `drainOverflow`;
  - the sold remainder of a found gem stack.

- [ ] **Step 1: Write the failing tests.** Values are exact, from fresh states with forced gear.
  - **Dig power:** `digPower` 10 base, with `+4` flat and `+50 %`, gives `21`.
  - **Vein yield:** `+20 %` makes a forced 640-Gold vein pay `768`, and a 4-copper material vein pay `5`.
  - **Ore find:**
    - with `oreFind: 100`, so `oreBonusChance` is 0.3, digging 2,000 metres that hold neither a feature nor a layer vein (use a stats override with a very high `digPower` so the test stays fast) logs bonus material finds (`bonus: true`) on a share within 0.03 of 0.3;
    - metres with a feature or a layer vein never get one.
  - **Sell bonus:** `+50 %` makes `sell` of a 150-Gold item pay `225`, and the loot filter's sell agrees.
  - **Salvage yield:** `+100 %` doubles `salvageYield`'s output, rounding each material.
  - **Battle:**
    - `+50 %` life on 100 base life gives `150`;
    - `+20 %` armor on 30 gives `36`;
    - `+30 %` critical damage gives `critMultiplier` 1.8.
  - **Strikes:**
    - a hit with 5 elemental damage on an Armored monster deals `max(1, round(physical × 0.6)) + 5`;
    - a crit multiplies both parts.
  - **Life regeneration and life per kill:**
    - with 2 life per second, a 1-second combat step with no monster hit heals 2, capped at max life;
    - life per kill 5 heals 5 on a kill, also capped.
  - **XP:** `+50 %` XP turns a 40-XP kill into 60 XP, and the kill's log line shows 60.
- [ ] **Step 2: Run the tests and check they fail.** Run the files listed. Expected: FAIL.
- [ ] **Step 3: Implement the effects** as the interfaces say.
  - **Ore bonus:** in `digFace`, after the layer vein, on a metre whose roll has no feature and whose layer has no vein, draw `nextRandom(state) < stats.oreBonusChance`. On success, draw `pickMaterial(metre, nextRandom(state))` and then `materialAmount(…, nextRandom(state))` × `veinMultiplier`. Then log a bonus material-vein find. The bonus finds of find gear still follow.
  - **Life regeneration** heals inside `combatStep` before the monster attacks.
  - **XP** is rounded.
  - **Existing tests:** update pinned values only where these new draws or formulas are the cause, and list each one in the report.
- [ ] **Step 4: README.** Describe the new modifiers in one short paragraph.
- [ ] **Step 5: Run all tests and check they pass.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** with `git commit -am "Make the new modifiers work in digging, selling and maps"`.

---

### Task 4: Crafting

**Files:**
- Create: `src/core/crafting.ts`.
- Modify: `src/core/balance.ts`, `src/core/inventory.ts` (the drag route), `src/store/gameStore.ts`.
- Test: `tests/core/crafting.test.ts`, `tests/store/gameStore.test.ts`.

**Interfaces:**
- **`type CraftKind = Material | 'diamond'`.**
- **`type CraftCheck`** = `'ok' | 'notGear' | 'legendary' | 'sealed' | 'wrongRarity' | 'noRoom' | 'nothingToChange' | 'short' | 'gemsFull'`.
- **`type TemperOutcome = 'craftedLine' | 'raiseTiers' | 'nothing' | 'ruin'`.**
- **`craftCost(kind: CraftKind, item: GearItem): number`**, as in "Decisions". In `balance.ts` it is `CRAFT_COST: Readonly<Record<CraftKind, { base: number; per: number }>>`, giving `base + floor(ilvl / per)`. `per: 0` means a flat cost.
- **`TEMPER_WEIGHTS: readonly [TemperOutcome, number][]`** = `[['craftedLine', 30], ['raiseTiers', 25], ['nothing', 25], ['ruin', 20]]`.
- **`canCraft(state: GameState, target: ItemLoc, kind: CraftKind): CraftCheck`** is pure. It checks both the rules and what the player holds.
- **`craft(state: GameState, target: ItemLoc, kind: CraftKind, from?: ItemLoc): { check: CraftCheck; temper?: TemperOutcome }`.**
  - It pays only on `'ok'`: from `from` first when given (a bag stack or the tab slot of that material), then from other bag stacks of that material, then from the Materials tab. Diamonds come from `state.diamonds`.
  - When the target is worn mining gear, it refreshes `fillAhead`, as `equip` does.
- **The rules, in this order:**
  - not gear → `notGear`;
  - `sealed` → `sealed`;
  - a legendary with anything but Mithril → `legendary`.
- **Each material, with its refusal:**
  - **Copper:** normal → magic, rolling 1–2 lines and a magic name. A non-normal item is `wrongRarity`.
  - **Tin:** a magic item's lines are rerolled (1–2), and it is renamed. A non-magic item is `wrongRarity`.
  - **Iron:** adds one line.
    - A magic item with 1 line gets a second line on the free side.
    - A magic item with 2 lines becomes rare with a 3rd line and a rare name.
    - A rare item adds a line on a side with room. With both sides full it is `noRoom`.
    - A normal item is `wrongRarity`.
  - **Silver:** a rare item's lines are rerolled (4–6). A non-rare item is `wrongRarity`.
  - **Mithril:** rerolls the socket count from `SOCKET_WEIGHTS`. Each socketed gem goes to its Gems-tab count. If any count would pass `GEM_STASH_STACK`, it is `gemsFull`.
  - **Starsteel:** rerolls every non-crafted line's value within its own tier. An item with no lines is `nothingToChange`.
  - **Obsidian:** removes one random line, crafted lines included, and keeps the rarity. An item with no lines is `nothingToChange`.
  - **Void crystal:** magic or rare, otherwise `wrongRarity`. It rolls a `TemperOutcome`:
    - `craftedLine` adds a crafted line of a stat the item doesn't have, tier `tierCap(ilvl) + 1`. At `MAX_CRAFTED_LINES` the outcome becomes `nothing`.
    - `raiseTiers` raises every non-crafted line by 1 tier, up to `ilvl + MAX_TIER_OVER_CAP`, rerolled in the new tier.
    - `ruin` sets every line to tier 1, rerolled in T1.
    - In every case it then sets `sealed: true`.
  - **Diamond (exalt):** a rare item with room on a side adds a line. A non-rare item is `wrongRarity`, and a full one is `noRoom`.
  - **Not enough material:** `short`.
- **`dropItem`:** a material stack dropped on gear (bag, General or worn) calls `craft(state, gearLoc, material, from)`. It returns `'ok'`, or `'craftRefused'` on any refusal. Add `'craftRefused'` to `InvResult`, with the fallback `resultText` "That craft didn't work.". The store keeps the `CraftCheck` for the message (Task 5).
- **Store:** `craft(target: ItemLoc, kind: CraftKind, from?: ItemLoc): { check: CraftCheck; temper?: TemperOutcome }`. It bumps the version on `'ok'` and keeps `lastCraft` for the UI.

- [ ] **Step 1: Write the failing tests** in `tests/core/crafting.test.ts`. Set `s.rng` to a fixed value per test, so outcomes are deterministic, then assert:
  - **Every effect:**
    - Copper on a normal ilvl-4 pickaxe gives magic with 1–2 lines and a matching `magicName`, and spends `1 + 2 = 3` copper.
    - Tin keeps magic, rerolls the lines and renames.
    - Iron takes a 1-line magic item to 2 lines on opposite sides, and a 2-line magic item to rare with 3 lines.
    - Silver rerolls 4–6 lines.
    - Starsteel keeps every stat and tier, with values inside their tiers.
    - Obsidian removes exactly one line.
    - Diamond adds one line to a rare and spends `1 + floor(ilvl / 3)` Diamonds.
  - **Temper:** for each of the four outcomes, find an `rng` that yields it by trying seeds in the test. Assert its effect and `sealed: true`. A second craft on the sealed item returns `sealed` and spends nothing.
  - **Refusals spend nothing (Review Focus 2):** `legendary`, `wrongRarity` for each material, `noRoom` (rare 3 + 3 for Iron and Diamond), `nothingToChange` and `short` (copper 2, cost 3). Each leaves the item, the bag, the tab and `diamonds` deep-equal to before.
  - **Paying (Review Focus 4):**
    - With copper stacks of 2 (`bag[5]`) and 10 (`bag[9]`) and 50 in the tab, a cost-3 craft with `from: bag[9]` takes 3 from `bag[9]`.
    - Without `from`, it takes 2 from `bag[5]` (emptying it) and 1 from `bag[9]`.
    - With only 1 in the bag, it takes 1 from the bag and 2 from the tab.
  - **Mithril (Review Focus 5):** on gear with 2 socketed tiny rubies, the gems join the Gems tab. With the tiny-ruby count at `GEM_STASH_STACK`, it returns `gemsFull` and nothing changes.
  - **Worn mining gear (Review Focus 3):** Copper on a worn lamp makes it magic. When a new line is `lampSight`, `deriveStats(s).lampSight` grows and `s.ahead` holds that many metres. Pick an `rng` that rolls `lampSight` by scanning.
  - **Dragging:** `dropItem(s, bagLoc(9), bagLoc(0))`, with copper at `bag[9]` and normal gear at `bag[0]`, crafts and returns `'ok'`. On rare gear it returns `'craftRefused'` and the stack and gear stay in place, with no swap.
- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run tests/core/crafting.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `crafting.ts`, the drag route and the store method.**
  - Reuse `rollLines`, `rollModLine`, `magicName` and `rareName` from Task 2.
  - The Task 3 test in `tests/core/materials.test.ts` that has a material swapping with gear changes to this behaviour. Rewrite it and say so.
- [ ] **Step 4: Run all tests and check they pass.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -am "Add crafting with every material and Diamonds"`, after `git add`ing the new files.

---

### Task 5: Crafting in the item card

**Files:**
- Modify:
  - `src/ui/character/{itemActions,itemView,ItemCard,useItemInteractions}.ts(x)`;
  - `src/ui/character/character.css`;
  - `README.md`.
- Test: `tests/ui/itemActions.test.ts`, `tests/ui/craftView.test.ts` (new, for the pure helpers).
- Create: `src/ui/character/craftView.ts`.

**Interfaces:**
- **`craftOptions(state: GameState, target: ItemLoc): CraftOption[]`**, where `interface CraftOption { kind: CraftKind; label: string; cost: number; have: number; enabled: boolean }`.
  - It lists the crafts whose rule check passes for this item: everything except `notGear`, `legendary`, `sealed`, `wrongRarity`, `noRoom` and `nothingToChange`.
  - The order is `MATERIALS` order, then Diamonds.
  - `enabled` is false when `have < cost`, or for Mithril when the result would be `gemsFull`.
- **`craftLabel(kind, cost)`**, exactly:
  - `Copper ore ×N: make it magic`
  - `Tin ore ×N: reroll its modifiers`
  - `Iron ore ×N: add a modifier`
  - `Silver ore ×N: reroll its modifiers`
  - `Mithril ×N: reroll its sockets`
  - `Starsteel ×N: reroll its values`
  - `Obsidian shard ×N: remove a modifier`
  - `Void crystal ×N: temper it (risky)`
  - `Diamonds ×N: add a modifier`
- **`craftResultText(result): string | null`**, exactly:

  | Result | Text |
  |---|---|
  | `ok` (not a temper) | null |
  | temper `craftedLine` | "Tempered: it gained a crafted line." |
  | temper `raiseTiers` | "Tempered: every line rose a tier." |
  | temper `nothing` | "Tempered: nothing changed." |
  | temper `ruin` | "Tempered: it was ruined, every line fell to tier 1." |
  | `sealed` | "It was tempered and can't be crafted any more." |
  | `legendary` | "Legendary lines can't be changed." |
  | `wrongRarity` | "That doesn't work on this item." |
  | `noRoom` | "It has no room for another modifier." |
  | `nothingToChange` | "It has no modifiers to change." |
  | `short` | "Not enough of that material." |
  | `gemsFull` | "Make room in the Gems tab first." |
  | `notGear` | "Only gear can be crafted." |

- [ ] **Step 1: Write the failing tests** in `tests/ui/craftView.test.ts`.
  - **A normal ilvl-4 pickaxe** with 37 copper in the bag and 0 elsewhere:
    - `craftOptions` gives Copper (`cost 3, have 37, enabled`) and Mithril;
    - Mithril is `enabled: false` with `have 0`;
    - Starsteel and Obsidian are absent (no lines), as are Tin, Iron, Silver, Void and Diamonds (wrong rarity).
  - **A sealed rare** gives `[]`.
  - **A legendary** gives only Mithril.
  - **`craftLabel('copper', 3)`** is `Copper ore ×3: make it magic`.
  - **Every `craftResultText`** string, as above.

  Add to `itemActions.test.ts`: a card for gear lists one craft action per option after its other actions. Each has `id: 'craft'` and a `kind`, and is disabled when the option is.
- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run tests/ui/craftView.test.ts tests/ui/itemActions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the card.**
  - The action card shows a "Craft" label above the craft buttons (each ≥ 40 px) when there are any.
  - A press runs `store.craft(target, kind)`. The status line shows `craftResultText`, and the card stays open on the same item so crafts can chain.
  - A refused drop of a material on gear shows `craftResultText` of the stored `lastCraft`.
  - The hover card of a material adds the muted line "Drag it onto gear to craft, or pick a craft in the gear's card."
- [ ] **Step 4: README.** Explain crafting:
  - drag a material onto gear, or pick a craft in its card;
  - what each material does;
  - costs grow with the item's level;
  - Void crystal is a gamble that seals the item.
- [ ] **Step 5: Run all tests and check they pass, then check in the browser.**
  - Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Then run a browser check with puppeteer-core: Chrome at `/usr/bin/google-chrome`, `--no-sandbox`, a fresh browser context, on `http://127.0.0.1:5180/`, at 1280×900 and 390×844.
  - Import `tests/fixtures/save-schema-6.txt` through Settings → Export / import save… → Load, then check that:
    - the game loads;
    - a magic item's card shows tiered lines, with `(crafted)` on a migrated over-cap line;
    - crafting Copper on a normal item works from the card and from a drag;
    - a Void crystal temper (give materials through the console only if the fixture has none) seals the item;
    - nothing scrolls the page sideways at 390 px.
- [ ] **Step 6: Commit** with `git commit -am "Craft from the item card and by dragging a material onto gear"`.
