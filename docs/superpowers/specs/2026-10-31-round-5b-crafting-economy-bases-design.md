# Golden Miner, round 5b: one-action crafting, four ores, 108 item bases

- **Date:** 2026-10-31
- **Status:** the decisions are Ernest's (2026-10-31). Defaults marked **(my call)** are the designer's and can be overruled.
- **Amends:** every earlier spec. Where they disagree, this one wins.
- **Builds on:** round 5a: `docs/superpowers/specs/2026-10-30-round-5-achievements-difficulty-design.md`. Its §4.6 holds the interim bands and the findings this round must act on. Round 5a is PR #11.
- **Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 5b". It shows the Smith, the base cards and the base catalogue, and Ernest approved it as shown.

## 1. Why

Ernest's complaints after a day of play (2026-10-30):
- there are too few item bases, one per slot;
- the economy is unbalanced, and some resources have no use;
- crafting needs rethinking and simplifying;
- gear comes too easily.

Round 5a fixed the pace (achievements and gates). It shipped interim gate bands because the game gave no deliberate way past a wall.

What exists today:
- **Bases:**
  - `BASE_NAMES` has four names per slot, picked by item-level band.
  - The starting stat is fixed per slot (`SLOT_IMPLICIT`).
  - So there is no choice of base.
- **Currencies:** Gold, Diamonds, Souls, 8 ores, 15 orb kinds, 25 gem kinds and 10 runes, plus an ore exchange whose premiums rise as you buy.
- **Crafting** is spread over four systems:
  - ore crafts: Tin, Silver, Mithril, and Void crystal tempering;
  - orbs bought with ore;
  - Diamond crafts: exalt, make magic, make rare;
  - Soul upgrades.
- **Dead ores:** Copper, Starsteel and Obsidian are useful only through the exchange.
- **Gold and Diamonds pile up.** The sim holds about 4.6 M Gold and thousands of Diamonds at the first level 100.

## 2. Goals, non-goals, anti-goals

**Goals**
1. **Simple crafting.** About nine currencies, each doing one thing. They are smelted from ores at a Smith (decided).
2. **Every resource has a job.** Four ores and no exchange. Gold is spent on every craft. Diamonds are the premium currency (decided).
3. **108 item bases.** Each slot has 3 roles and each role has a base in each of 4 depth tiers. A base's starting stat is chosen by its role (decided).
4. **Upgrades come from crafting.** Drops supply bases, and crafting turns a base into an upgrade (decided).
5. **The gate walls are fixed.** Round 5a's findings get fixed, and the original bands come back: at least 80 % of first gate attempts fail, and the first level 100 lands on days 12–16 (decided 2026-10-31).

**Non-goals:** Souls, gems and runes stay as they are. So do legendaries' effects, maps' Soul upgrades, the passive web and the ascendancy tree. This round only reads their numbers. Two exceptions:
- the legendary drop weight halves (§8);
- the achievement list changes where §6a says.

**Anti-goals**
- Re-tangling crafting: no second layer that buys the currencies, and no exchange.
- A wall you can only pass by luck. A deliberate path must exist: swap to the right base, then craft on it.
- Loosening any balance band to fit. This rule carries over from round 5a.
- Huge numbers. Gold fees stay readable through compact formatting.

## 3. First task: round 5a's findings (decided: do these first)

From spec 5a §4.6:
1. **Sim away queue.** `queueBestMaps` (`src/core/sim.ts`) must never queue gate-tier maps. That includes cleared gates, which stay walls. While held at a gate, the queue skips every gate tier. (my call: the fallback "unless nothing else is stocked" is not needed. If the stock runs dry, the queue runs empty.)
2. **The two walls are unbalanced.**
   - Today `PHYSICAL_WALL` is ×1.25 damage and ×1.25 speed (about 1.56× damage per second), while `ELEMENTAL_WALL` is ×3.
   - Rebalance them so physical and elemental gates hold about equally long: mean holds within 25 % of each other, and first-attempt fail rates within 15 points.
   - Add a per-wall check to the balance suite.
   - (my call) For this comparison only, a hold is measured from the **first attempt** (`clearedDay − firstAttemptDay`), so time spent waiting for a gate map doesn't skew it. The overall median-hold band keeps round 5a's `reachedDay` measure.
3. **The raw-power tilt** must not hinge on one gate. Revisit `powerScore`'s defence weighting so the defence-aware player's advantage comes from many gates.
   - (my call) The band stays ≥ 1.5× overall and adds a second check: ≥ 1.2× with the single biggest gate's contribution left out.
4. **The first gate.** Gate 5 is elemental on all three test seeds. (my call: a seed may not make gate 5 elemental. The first gate is always physical, so a fresh player meets an armour wall first, the simpler lesson.)
   - Because walls come in pairs, gate 10 is then always elemental. This is accepted. The seed still swaps the later pairs.

Re-measure after these fixes, before the economy and crafting work below. The result goes in the plan's first commit body.

## 4. Ores (decided: 8 → 4)

- The ores are **Copper, Iron, Mithril and Void crystal**, in depth order.
- (my call) They start appearing at 0, 50, 300 and 1,000 m, the depths these ores already use today.
- **Removed:** Tin, Silver, Starsteel, Obsidian and the ore exchange (`oreMarket.ts`, its premiums and its UI).
- **Old saves** (my call): each removed ore converts 1:1 into its nearest kept ore. Tin goes to Copper, Silver to Iron, Starsteel and Obsidian to Mithril.
  - Old orbs are refunded as the ore they cost: their `ORB_COSTS` amount of Iron, Mithril or Void crystal.
  - Essences were already migrated in round 4.
- **Salvage** pays these four ores. (my call) Normal items give Copper; magic give Copper and Iron; rare give Iron and Mithril; legendary give Mithril and Void crystal. Amounts scale with item level.
- Ores stack in the Materials tab as today.

## 5. The Smith and the nine currencies (decided)

**The Smith** is a third character in the Merchant view, next to Brannoc the Trader and the gambler. The mockup shows it, and Ernest approved it.

It has two actions:
- **Smelt:** ore → a currency.
- **Craft:** a currency → the item in the craft slot.

Currencies stack in a new **Currency tab**, which replaces the Orbs tab.

| Currency (placeholder name) | Does exactly one thing | Smelted from |
|---|---|---|
| Change | normal → magic, with random lines | Copper |
| Shift | reroll every line of a magic item | Copper |
| Growth | add a random line to a magic item that has room | Iron |
| Severance | remove a random line from a magic or rare item | Iron |
| Socket | add a socket, up to the slot's limit | Iron |
| Ascent | magic → rare, keeping its lines and adding random ones | Mithril |
| Chaos | reroll every line of a rare item | Mithril |
| Polish | reroll the numbers of every line, keeping the stats | Void crystal |
| Exalt | add a random line to a rare item that has room | **Diamonds** |

Rules:
- **Mapping:** deeper ore makes the stronger currencies (decided).
- **Smelt costs** (my call): a fixed ore count per currency, about 10 ore per currency (the builder tunes this), plus a **Gold fee** (decided). Exalt costs Diamonds plus a Gold fee.
- **Use costs:** every use costs a **Gold fee** scaled by the item's level (decided). (my call) The fee is `base × ilvl^1.5`, with the base set per currency. The UI shows the fee before you confirm.
- **Line rolls:** currencies that add or reroll lines (Change, Shift, Growth, Ascent, Chaos, Exalt) roll exactly as drops do, with the same `rollLines`, tiers and weights by item level. Legendaries cannot be crafted on.
- **Polish** (my call) rerolls only the numbers inside each line's current tier. It keeps both the stat and the tier, like the retired Tempest Orb.
- **The base's starting stats** are never touched by any currency.
- **Gems and runes:** taking them out of sockets stays at the Smith as a Gold fee (my call). Each comes back to its stash tab, as the Mithril unsocket does today.
- **Retired:**
  - every orb (`ORB_COSTS`, `buyOrb`);
  - the ore crafts (`CRAFT_COST` for tin, silver, mithril and voidCrystal);
  - the Diamond crafts (`diamond`, `makeMagic` and `makeRare` on gear);
  - the scattering and clearing orbs;
  - the item and map `sealed` temper.
  - Old saves keep the `sealed` flag readable but ignore it. (my call: sealed items become craftable again.)
- **Maps:** the Soul rarity upgrades stay as they are. Map mods are not touched by the currencies.
- **No more item-level upgrades by currency.** The Soul upgrade of battle gear stays.

## 6. Gold and Diamonds (decided)

- **Gold** is spent mainly on crafting fees: on every smelt and every use. Gambling, the Trader, node refunds and stash pages keep their prices.
  - Target (my call): the sim's held Gold at the first level 100 stays under 10 % of lifetime Gold earned. Today it is the bulk of it.
- **Diamonds** are the premium currency. They pay for Exalt and the passive-web reset (`RESET_WEB_DIAMONDS`, unchanged).
  - If Void crystal turns out too rare to carry Polish, Diamonds may also pay for Polish. The builder decides, with sim evidence.
  - Diamond veins keep their rates.

## 6a. Achievements (decided 2026-10-31: replace and retune)

- **Ladders for removed things go:**
  - the four removed ores' ladders (Tin, Silver, Starsteel, Obsidian);
  - "Ores Traded".
- **New ladders replace them**, keeping the total in 750–850. (my call) They are:
  - currencies smelted;
  - one ladder per currency used (e.g. "Use 100 Chaos");
  - Gold spent on Smith fees;
  - item bases found (out of 108; a collection).
- **Retuning:** ladder and collection thresholds may be retuned this round to keep round 5a's pace bands (day 1 at ~10 % ±4, the first cap at ~40 % ±8, the expected-achievement table at ±25 %).
  - Heavy crafting fills the "Crafting", "Gold Spent" and "Diamonds Spent" ladders much faster than before, so retuning them is expected.
- **Old saves:** they lose the removed ids through the existing prune-on-load (round 5a §3.5), and their stats silently re-earn whatever the new ladders allow.
  - (my call) The new ledger counters start at 0, except "Gold spent on Smith fees", which also starts at 0 (fees didn't exist before).

## 7. Item bases (decided: 4 depth tiers × 3 per slot = 108)

- **Roles.** Each of the 9 slots has **3 roles**, and each role has its own starting stat. (my call: the roles below, from the mockup and the existing stat pool.)

| Slot | Role A | Role B | Role C |
|---|---|---|---|
| Pickaxe | dig power | dig speed (auto-tick rate) | ore find |
| Lamp | lamp sight | gem find | hazard ward |
| Gloves | gold yield | diamond yield | clicks per tick |
| Boots | offline cap | chest find | map find |
| Weapon | physical damage | elemental damage | attack speed |
| Body armour | armour | resistances | life |
| Helm | life | resistances | armour |
| Ring | crit chance | resistances | life on kill |
| Amulet | % damage | resistances | soul find |

- **Depth tiers** open at **0, 300, 1,000 and 5,000 m** (decided). Each tier adds one new base per role.
- **Old bases keep dropping**, with a lower ceiling (decided).
  - A base's starting stat scales with item level as today.
  - Each tier raises the ceiling by about 25 % (my call).
  - **From tier 3**, bases add a small second starting stat (my call, shown in the mockup).
- **Drops** (my call): a drop picks a slot, then a base uniformly among the bases unlocked at its depth. Gambling picks the slot and gets a random unlocked base.
- **Names** come from the mockup's catalogue where it has them. The builder writes the rest (108 in all), in the game's tone, all unique. The existing `BASE_NAMES` become the tier names of role A where they fit.
- **Old saves:** an existing item becomes the tier-1 base of its slot's role A, which is today's starting stat, keeping its lines. Legendaries keep their own fixed bases.
- **Cards** show the base name, its tier, and the starting stats marked "base", as in the mockup. The Craft slot shows open line slots.
- **The deliberate path past a wall.** A player at an elemental gate swaps to resistance-role bases (body armour, helm, ring, amulet) and crafts them. At a physical gate, armour-role bases do the same job.

## 8. Gear pace (decided: drops give bases, crafting makes them)

- **Rarity weights:** from `normal 60 / magic 30 / rare 9 / legendary 1` to about `normal 70 / magic 25 / rare 4.5 / legendary 0.5`.
  - The legendary halving is **decided** (Ernest, 2026-10-31). The legendary collection achievements slow to match (§6a may retune them).
  - The builder tunes the other three weights.
- **The sim player smelts and crafts:**
  - it smelts what it can afford;
  - it uses Change, Ascent and Chaos on its best base for the next wall, and Exalt and Polish on its best rare;
  - it stops when the score no longer rises or the money runs out.
  - It still buys from the Trader.
- **Target:** at the first level 100, about half of the reference player's power score over a naked miner comes from crafted lines, and the rest from dropped lines and bases. Allowed band: 35–65 %. A new sim metric, `craftedShare`, measures this.
- **What counts as crafted** (my call): a line is crafted if a currency added it, rerolled it or polished it. Ascent's new lines and Chaos's rerolls count; lines that came on the drop and were never touched don't.
  - Lines carry a `source: 'drop' | 'craft'` marker, which is only used for this metric. Crafted lines are ordinary affixes: they use the normal 3 prefix + 3 suffix room, and a later Chaos or Shift rerolls them like any other.
  - The old `crafted: true` temper lines become ordinary `source: 'craft'` lines on migration.
- **How the share is computed** (my call): `craftedShare = (score − score with every crafted line removed) / (score − naked score)`, using the defence-aware `powerScore` against the next gate's wall, averaged over the worn battle set at the first cap.

## 9. Balance (decided: restore the original bands)

The balance suite keeps every round 5a band. It restores:
- the first level 100 on **days 12–16**;
- **≥ 80 %** of first gate attempts failing.

It adds:
- the per-wall check from §3;
- Gold left unspent at the cap under 10 % of lifetime Gold (§6);
- `craftedShare` in 35–65 % (§8).

Allowed levers:
- everything round 5a allowed;
- the new crafting costs and fees, the smelt ratios, the rarity weights, the base tier ceilings, the salvage amounts and the wall modifiers.

Bands are never loosened to fit. If two bands cannot be met together, stop and bring the trade-off to Ernest, as in round 5a.

## 10. UI

- **Merchant view:** adds the Smith (portrait, Smelt list, Craft slot, currency list with fees), laid out as in the mockup.
  - At 390 px the three columns stack.
  - A currency that doesn't fit the item is greyed and says why ("Doesn't fit: this item is rare"). One you can't afford says what is missing.
- **Inventory:** the Orbs tab becomes the Currency tab. Right-click "Craft" on an item opens the Smith with that item in the slot.
- **Wiki:** pages for the Smith, the currencies, and the base catalogue (all 108). The ore page lists the four ores and what each one makes.
- **README:** rewritten to match.

## 11. Saves

- One schema bump, with a migration and a real fixture taken from the round 5a engine before any 5b change.
- The migration:
  - ores 8 → 4 (§4);
  - orbs → ore refunds;
  - drops the ore-exchange state;
  - item bases → the tier-1 role-A base (§7).
- Gear gains a `base` id. The validator accepts only known base ids.

## 12. Left to the builder

- Currency names (the placeholders in §5 may stay if nothing better fits), base names, and every number marked as tunable.
- How the sim player's crafting picks its targets, as long as `craftedShare` is measured honestly.
- How to split this into plans. Suggested order:
  1. round 5a findings;
  2. ores and the Smith;
  3. bases;
  4. the achievement replacements (§6a);
  5. gear pace and the sim's crafting;
  6. the balance restore, with the threshold retune.
