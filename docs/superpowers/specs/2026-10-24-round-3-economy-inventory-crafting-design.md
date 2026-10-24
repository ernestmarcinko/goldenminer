# Golden Miner, round 3: veins-only economy, one bag, maps as items, crafting

- **Date:** 2026-10-24
- **Status:** approved by Ernest (2026-10-24)
- **Amends:** the main spec, `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md`, and round 2, `docs/superpowers/specs/2026-10-24-round-2-seeds-procedural-inventory-design.md`. Where they disagree, this document wins.
- **Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 3":
  - one bag;
  - stash pages;
  - the Materials tab;
  - the minimap as a history;
  - the speed counter;
  - both crafting styles (orb-style chosen);
  - map enchanting.
- **Built so far:** Plans 1–5. Plan 5 (maps, combat and levels) is PR #5.

Marking follows the earlier specs. **(decided)** is Ernest's choice. **(my call)** is the designer's default and can be overruled.

## 1. Why

Ernest played Plans 1–5 and found several problems:
- The economy is too passive: Gold and Diamonds trickle in from every tick, so nothing is worth chasing.
- The two small bags, the fixed stash and the map list feel cramped and unlike an ARPG.
- Climbing back up through the minimap leaves the miner apparently stuck, and the minimap can't be scrolled.
- There is no crafting yet.

He wants a PoE-like loop: every resource is useful and spendable, so there is no point hoarding, and going deeper brings more risk and more reward. In his words, "all resources should be useful and spendable, so the player wants to gain more to get stronger."

## 2. Goals, non-goals, anti-goals

**Goals**
- Resources come only from veins; ticks only dig (decided).
- Mined materials feed an orb-style crafting system, with no dead resources (decided).
- Items follow the ARPG modifier model (3 prefixes, 3 suffixes), with tiers that grow without end (decided).
- Maps are real items that can be enchanted (decided).
- The inventory is one large bag, plus a stash that grows by pages (decided).
- Risk grows with depth in crafting, maps and the mine, without punishing absence (decided).

**Non-goals**
- Trading between players, or any backend.
- Durability or item loss from digging.

**Anti-goals** (failures even if everything works)
- A resource with no sink, or one that only accumulates.
- Risk that punishes being away. This would break the main spec's "no login pressure" rule. Hazards may slow digging but never destroy or take anything.
- A seed that silently stops reproducing its world (round 2 §2). New world content must be added without changing what existing seeds already generate (§3.4).

## 3. The economy

### 3.1 Veins only (decided)
- **No per-tick income.** A tick advances the dig face only. Today's per-tick Gold and the per-tick Diamond chance are removed.
- **While digging, veins are the only source of Gold, Diamonds and materials:**
  - gold veins give Gold;
  - diamond veins give Diamonds;
  - material veins give materials (§3.3).
- **Other sources (decided: "veins only" is about digging):**
  - Selling items still pays Gold.
  - Map kills still pay a little Gold.
  - Salvage turns items into low-tier materials instead of Diamonds.
  - Maps drop materials (§3.3).
  - The merchant (Plan 7) sells consumables and stash pages for Gold, and never sells Diamonds, so the exalt material can't be bought.
- **Unchanged:** chests (loot), gems and map entrances are found as today.
- **Gold balance (my call):** gold vein amounts rise so the hourly Gold income at parity roughly matches today's. The exact numbers are left to the builder, with the balance plan to settle them.

### 3.2 Gold, Diamonds and Souls keep roles (decided)

| Resource | Source | Spent on |
|---|---|---|
| Gold | gold veins | the merchant; stash pages; respecs |
| Diamonds | diamond veins only | crafting: a material in its own right, for the "exalt" effect (§5.2) |
| Souls | maps only | upgrading battle gear; the Soul cost of every craft on a map (§6) |

### 3.3 Mined materials (decided: a fixed set, rarer deeper)
- **The set.** About 8 crafting materials, each with one effect (§5.2). Common materials appear from the top. Rarer ones start at a set depth and become more common deeper, so going deeper means better crafting stock.
- **Storage.** Materials are stackable items:
  - In the bag they stack up to 50 per cell (my call). The passive web can raise it, as it does for gems.
  - In the Materials stash tab, one slot per material holds up to 1,000,000, like the Gems tab.
- **Where the veins come from (my call).** Material veins come from a separate seeded roll per metre, keyed by `(seed, metre)`.
  - The roll only fills metres whose existing seeded roll holds no feature.
  - So every seed's existing chests, veins, gems and map entrances stay exactly where they are, and the new layer only adds.
  - It applies to every world generation (1 and 2), so old worlds get materials too, without a version bump.
  - Find-gear bonus finds (round 2 §3.3) still roll on metres with no seeded feature. A material vein does not count as a feature, so one metre can give both a material vein and a bonus find. Existing worlds keep their bonus finds (my call).
- **Map drops (decided).**
  - Map kills can drop materials, by the map's tier, with the same depth rules as veins: a tier-7 map can drop Void crystals.
  - Enchanted maps drop more.
  - Digging stays the main source. Maps are the risky shortcut to deep materials.

### 3.4 Mining speed counter (decided)
The mine view shows the current digging speed next to the progress bar, as metres per minute and the time to the next metre, for example "1.3 m/min · next metre in 42 s" (my call for the format).

### 3.5 Risk deeper (decided: all four)
1. **Crafting gambles.** Crafts roll; some materials can roll badly or ruin an item (§5).
2. **Deeper and enchanted maps.** Higher tiers and enchanted maps are much harder and can kill you, which loses the map. They drop the rare materials and better gear (§6).
3. **Mining hazards.**
   - From Granite Veins down, some seeded metres hold a hazard, more often the deeper you go (my call).
   - Gas pockets and unstable rock multiply the ticks a metre needs.
   - A new mining stat, hazard ward, reduces that slowdown. It rolls on mining gear and appears on passive nodes later.
   - Hazards never destroy, take or block anything permanently (anti-goal).
4. **Pushing the dig face.** The rarest materials appear only deep, where rock hardness keeps rising, so the reward costs ever more time. The hardness curve itself is left to the balance plan.

## 4. Inventory

### 4.1 One bag (decided)
- **The bag.** One bag of 60 cells (10 × 6) replaces the separate mining and battle bags. It holds everything:
  - mining and battle gear;
  - gem stacks;
  - map items;
  - material stacks.
- **The Mining / Battle toggle** now switches only the paper doll and its stats.
- **Plan 4 rules stay:** fixed slots, drag and drop, tap-to-move and the action card, now in the one bag.

### 4.2 Stash pages (decided)
- **Tabs:**
  - General: gear, in pages of 60;
  - Gems: as today;
  - Maps: map items, in pages of 60;
  - Materials: one slot per material.
- **Starting pages:** 2 General pages and 1 Maps page.
- **More pages:**
  - Buy them with Gold, at a rising cost (my call: 5,000 × n² Gold for the nth extra page; the balance plan retunes it).
  - Or unlock them from passive-web nodes (Plan 8 adds those).
  - Page counts have no upper limit (my call).
- **A full Maps tab:** when every Maps page is full, a newly found map is handled as today's "lowest-tier, oldest map is dropped" rule (round 2 §7.3), applied across all Maps pages.

### 4.3 Maps are items (decided: one map, one item)
- **What a map is.** A map is its own item (one cell). Maps never stack, because enchanting makes each one different.
- **Where maps live.** Maps sit in the bag and the Maps tab, and move like any other item.
- **The Maps screen** becomes a picker over your maps, in the bag and the Maps tab, sorted by tier and dungeon. The grouping and the ×N rows of Plan 5 give way to the stash grid.
- **Unchanged from Plan 5:** a map's dungeon still comes from `(seed, metre)`, and running it still consumes it.

### 4.4 Minimap as history; no climbing (decided)
- **Digging down only.** The miner only digs down. Climbing back up, side galleries and gallery finds are removed.
- **The minimap** becomes a scrollable record of finds by depth. It keeps the lamp hints below the face, and has an always-visible "Jump to the dig face".

## 5. Items and crafting

### 5.1 Modifiers (decided)
- **Prefixes and suffixes.** Every modifier is a prefix or a suffix. An item holds at most 3 prefixes and 3 suffixes.
  - The split of the stats into prefixes and suffixes is left to the builder, roughly even per gear set.
- **A bigger modifier pool (decided).** 6-line rares must not all look alike, so the pool grows:
  - flat and percent versions of the main stats (e.g. `+dig power` and `+% dig power`);
  - new stats: vein yield, ore find, hazard ward, life regeneration, elemental damage, and others at the builder's choice.

  Target (my call): at least 8 prefixes and 8 suffixes per gear set. Capped stats (crit chance, lamp sight, ticks per click, attack speed) become tiered like the rest, and their caps apply only to the total from all sources.
- **Lines by rarity:**
  - normal items have none;
  - magic items have 1–2, at most 1 prefix and 1 suffix;
  - rare items have 4–6, up to 3 + 3;
  - legendaries keep their hand-written lines and can't be rerolled.
- **Exceptions come only from crafting.** For example, a deep material adds a 7th crafted line, or locks a line before a reroll.
- **Tiers.** Every modifier has a tier from T1 upward, without end.
  - An item's level, from where it dropped, sets its highest tier: T1 in Topsoil, +1 tier per band, and +1 every 300 m in the deep.
  - Each modifier rolls a tier up to that cap, with lower tiers more likely.
  - Each tier is a value range that grows steadily, never exponentially.
  - The item card shows each line's tier.

### 5.2 Orb-style crafting (decided)
- **How to craft.** Drag a material onto an item, or pick it in the item's action card. Its effect applies at once, and the material is used up.
- **Item level.** Effects roll within the target item's level, so deeper items give stronger results.
- **The materials** (my call for names, effects and starting depths; the plan fixes them):

| Material | First found | Effect |
|---|---|---|
| Copper ore | 0 m | normal → magic |
| Tin ore | 0 m | reroll a magic item's modifiers |
| Iron ore | 50 m | add a modifier (a magic item with 2 becomes rare) |
| Silver ore | 150 m | reroll a rare item's modifiers |
| Mithril | 300 m | reroll sockets (count and empty) |
| Starsteel | 450 m | reroll modifier values within their tiers |
| Obsidian shard | 700 m | remove a random modifier |
| Void crystal | 1,000 m | temper: a large random outcome. It may add a powerful line, raise tiers, do nothing, or ruin the item (lines rerolled to low tiers). The item is then sealed against further crafting. |
| Diamonds | diamond veins | exalt: add a modifier to a rare item |

  Crafted-line effects (a 7th line, or locking a line) come from the deep materials. The builder may fold them into Void crystal, or add one more deep material.
- **Battle gear upgrades with Souls (main spec, decided).** Spend Souls to raise a battle item's level by one, which raises its tier cap. Existing lines don't change. My call: the cost grows with the item's level.

## 6. Map enchanting (decided: PoE-style map modifiers)
- **The same materials work on maps.**
  - Copper makes a map magic: 1–2 map modifiers.
  - Iron adds a modifier.
  - Silver rerolls a rare map.
  - Obsidian removes a modifier.
  - Void crystal tempers a map.
  - Every craft on a map also costs Souls (my call: scaled by map tier).
- **Modifier strength (my call)** follows the map's tier, as items follow their level. The material decides the kind of craft, not the strength.
- **What modifiers do.** A map holds up to 6 modifiers. Each makes the dungeon harder (more monster life or damage, an extra champion, weaker room healing, faster attacks, and so on) and raises item quantity, rarity and Souls from that run. Deeper materials roll stronger modifiers.
- **Seeds are unaffected.** Enchanting changes difficulty and rewards, never the seeded layout. The dungeon, rooms and monsters stay world-determined, and the modifiers scale their numbers.
- **Risk is unchanged.** Dying in an enchanted map still loses the map.

## 7. Old saves (my call)
Migrating to the new schema:
- **Bags.** The two bags merge into the one bag, in order. Any overflow beyond 60 cells goes to the first free General stash page, and new pages are added if needed. Nothing is lost.
- **Free pages.** Pages added by the migration, for gear or for maps, are free. They do not count toward the page price.
- **Page prices.** Counted per tab: the nth page you buy in a tab costs 5,000 × n² Gold.
- **Resources.** Gold, Diamonds and Souls keep their totals. Materials start at 0.
- **Maps.** Maps in the Plan 5 Maps tab become map items in the Maps tab pages. Up to 200 maps fill up to 4 pages, so none is dropped.
- **Galleries.** Side-gallery progress is dropped. A miner standing above the face moves to the face.
- **Modifiers.** Existing modifiers get prefix or suffix labels and tiers worked out from their values. Lines beyond the new caps are kept and marked as crafted lines, so no item loses a line.
- **World generation.** Unchanged: old worlds gain material veins only on empty metres (§3.3).

## 8. The plan sequence (decided)
- **Plan 6, Economy and inventory:** veins-only income, materials and material veins, the speed counter, hazards, one bag, stash pages and the Materials tab, maps as items, the minimap history, and the migration.
- **Plan 7, Crafting:** the prefix/suffix and tier rework of items, orb-style crafting, map enchanting, Soul upgrades, and the merchant (Gold sinks and stash page purchases). The prefix/suffix rework goes here because crafting depends on it (my call).
- **Plan 8:** the passive web, including nodes that add stash pages and raise bag stack sizes.
- **Plan 9:** auto-mapping and ascension.
- **Plan 10:** balance and launch.

## 9. Left to the builder
- Vein amounts and frequencies, and the material vein chances per depth.
- Hazard frequency and slowdown numbers.
- The prefix/suffix split of each stat.
- Tier value tables.
- The odds of each craft outcome, and the Void crystal outcome table.
- Map modifier list and numbers.
- Soul upgrade costs.
- Stash page prices beyond the default rule.
- The exact layout of the stash pager and the Maps picker, following the Round 3 board.
