# Golden Miner, round 5a: harder achievements, a two-week first run, gate tiers

- **Date:** 2026-10-30
- **Status:** the decisions are Ernest's (2026-10-30); the defaults marked **(my call)** are the designer's and can be
  overruled.
- **Amends:** every earlier spec. Where they disagree, this document wins.
- **Baseline:** `41aad5a` on dev-ernest (the DeepSeek pass, committed as-is at Ernest's request).
- **Next:** round 5b (a separate design) covers item bases, the economy and dead resources, crafting simplification,
  gear drop pace and resources piling up. This design must not touch those systems beyond what §5 needs.

## 1. Why

Ernest played the current build for a day and found it "way too easy and unbalanced". He earned over 300 of the ~500
achievements in that day. Maps never threatened him, levels came too fast, gear came too easily, and resources piled up.

A headless probe (the game's own reference sim from `src/core/sim.ts`, four 15-minute check-ins a day, best drop worn,
no Gold spent, seed 12345) measured why:

| | current build | achievement boost forced to 1 |
|---|---|---|
| achievements after day 1 | 177 of 529 (33%) | 135 (25%) |
| level after day 1 | 32 | 10 |
| level 100 reached | day 3.0 | never: stuck at level 10, dying in tier 3–5 maps for a week |
| held at the level-100 cap | 4.6 M Gold, 7,012 Diamonds, 121 k Souls | n/a |

So the game's balance is the achievement boost. Each achievement adds +1% to every final offensive, defensive and
yield value (`achievementBoost` in `src/core/achievements.ts`). The ladders start at 1‑2‑5‑10, so ~75 come in the first
six hours (+75%). That boost compounds into faster kills, deeper maps and more achievements. Monster strength grows
polynomially (`monsterLifeBase = 15·tier^1.3`), which the multiplicative player boost outruns.

The DeepSeek pass also loosened `tests/balance/referenceRun.test.ts` to accept a cap between day 2.5 and 19. That test
no longer guards pacing; §6 replaces it.

## 2. Goals, non-goals, anti-goals

**Goals**
1. An active player's first run to level 100 takes about **two weeks** (decided).
2. A new map tier's progress comes in clear steps: **gate tiers** are brutal walls, and the tiers between them are a
   gentle climb (decided).
3. About **800** achievements (decided), much harder to earn: ~10% on day 1, ~40% at the first level-100 cap, the
   rest across ascensions and hard feats (decided).
4. Auto-mapping has **no tier cap** (decided).

**Non-goals** (round 5b): new item bases, resource sinks, dead ores, crafting, drop rates of gear, the merchant's
prices.

**Anti-goals**
- Swapping "too easy" for "impossible": a reference player who plays sensibly must get through every gate.
- Huge numbers (an anti-goal since the first spec). Monster numbers may grow, but formatted values stay readable.
- A balance test that is loosened to fit the numbers. If the sim misses its band, the tuning changes, not the band.

## 3. Achievements

### 3.1 The reward (decided)

Keep **+1% per earned achievement**, applied as today (final derived values only, never re-entering the stat pool), with
**no cap**. The boost is now a planned part of the power curve: §4 tunes monsters against the boost a player *should*
have at each stage (§3.4), so earning it on schedule is what keeps pace with the walls.

### 3.2 Count and pacing (decided)

- About **800** achievements in total (±50 is fine).
- Day 1 of an active first run: ~**10%** (~80).
- At the first level-100 cap (~day 14): ~**40%** (~320).
- The remaining ~60%: later ascensions, deep counters, collections and hard feats. A few should take months.

### 3.3 The four kinds (decided: all four)

1. **Counter ladders** (the existing 33 families, plus new ones where a counter already exists in `LifetimeStats`).
   - Drop the near-free first steps: a ladder starts where real play begins. **(my call)** The first step of a family
     should take at least ~30 minutes of normal play, not one action (no more "1 chest", "1 gem", "10 clicks").
   - Stretch the top ends so the last steps sit beyond a first run (multi-ascension totals).
   - Keep the exotic salted values (42, 666, 1337, …) but count them in the budget.
   - **(my call)** Fewer steps per family than today (today's 1‑2‑5 series gives ~13–19 steps; aim for ~8–12, with the
     space they free going to the other three kinds).
2. **Feats / challenges**: one-off tests of skill or build. They are checked from run events, not from counters. The
   builder writes the list; the shape to aim for (examples, not a fixed list):
   - clear a gate tier (§4) on the first attempt;
   - clear a map of your frontier tier without dropping below 50% life, or finish one under 10% life;
   - kill a boss in under N seconds (scaled by tier band);
   - clear a tier-N map with no gear in a slot / with only normal-rarity gear;
   - reach depth N with a pickaxe below some item level;
   - kill N champions in one map; clear a map with every champion modifier present;
   - clear a gate tier of each wall type (§4.3).
   Feats should be tiered by tier band where it makes sense (e.g. "first-try gate clear" at gates 5, 10, … 50), which is
   how most of the count is reached without padding.
3. **Collections**: earned by having found every member of a set at least once in the lifetime ledger.
   - every legendary of a tier (1–5), and every legendary overall;
   - every gem type at each grade; every rune;
   - every champion modifier (`CHAMPION_MODS`) killed;
   - every map special (`MAP_SPECIALS`) cleared;
   - **(my call)** dungeon types count per seed world, since they are generated: "clear N different dungeon types".
   The ledger must record "found/killed at least once" sets for these (new `LifetimeStats` fields, carried across
   ascension like the rest of the ledger).
4. **Hidden / secret**: Cookie Clicker–style jokes and surprises. They appear in the list as "???" until earned (name and
   description hidden; they still count toward the total shown). The builder writes them; aim for ~20–40, keep them
   harmless (no achievement may require deleting a save, spending real time AFK beyond the offline cap, or anything the
   player would regret). Examples of the flavour: click the miner 1,000 times while paused; sell a legendary; die in a
   tier-1 map after level 50; name the character "Golden Miner".

Every achievement keeps the generated-id scheme (`<family>.<value>` for ladders) or gets a stable hand-written id for
feats, collections and hidden ones. Ids are part of the save contract once shipped.

### 3.4 The expected-boost curve

The builder derives, from the new list and the reference sim (§6), the number of achievements a reference player holds
at each level of the first run, and publishes it as a table in `balance.ts` (e.g. `EXPECTED_ACHIEVEMENTS_AT_LEVEL`).
§4's monster curve is tuned against `1 + 0.01 × expected(level)`. A test pins that the sim's real count stays within
±25% of the table at levels 10, 30, 60 and 100.

### 3.5 Existing saves (my call)

On load, re-check every achievement against the new list from the lifetime ledger. Earned ids that no longer exist are
dropped; ladders the ledger already satisfies are granted. Feats and collections that need new ledger fields start
unearned (their fields start empty). No migration flag or prompt. The save schema bumps as usual and gets a real fixture.

## 4. Difficulty: two weeks and gate tiers

### 4.1 Pacing target (decided)

The first run reaches level 100 in about **14 days** of the reference schedule. **(my call)** The test band is days
12–16. Later runs are faster through ascendancy and achievements (no target; a later run must not be slower).

Levers, in the builder's order of preference: the XP curve and per-kill XP (`monsterXp`, the XP-to-next formula), monster
strength by tier (§4.2), and map drop rates of maps. Gear drop rates and the economy are round 5b's.

### 4.2 The monster curve

Replace `MAP_MONSTER_SCALE` (a 10-entry table whose last entry repeats for every deeper tier) with a curve that covers
every tier to 100:

- a **base curve** that grows at least as fast as the expected player power (gear by item level × levels × passives ×
  the expected achievement boost of §3.4). Between gates, a map of tier T is cleared ~70–85% of the time by the
  reference player who has just cleared tier T−1 **(my call)**;
- a **gate step** at tiers 5, 10, 15, … (decided: every ~5). A gate tier is cleared **≤ 20%** of the time by the
  reference player who has just cleared the tier before it **(my call)**, and ≥ 70% once that player has farmed the
  tiers below until the next real upgrade (more levels, a better item, passives); §6 defines "farmed".
- The tier after a gate eases back onto the base curve, so a cleared gate opens a gentle stretch.
- **How long a gate holds (decided):** about **half a day** of an active player's check-ins (~2 check-ins of farming).
  The first run reaches a frontier of about **tier 50** at the level-100 cap, so ~10 gates take ~5 of the 14 days. This
  is the anchor for "farmed" in §6: the sim's power-score margin is tuned so the reference player spends about half a
  day at a typical gate. It is not a free parameter.
- Today's frontier at cap is set mostly by dig depth. If digging outruns the map frontier, gate-blocked maps simply
  pile up in the stash; dig speed itself is not changed here.
- **Past tier 100 (my call):** the base curve and the gate step every 5 tiers continue forever. `MAX_LIFE` /
  `MAX_DAMAGE` (1,000,000) are raised (with their save checks) far enough that the curve never hits them in any
  realistic play (the builder picks the value, e.g. 1e12). Readable numbers means they are always shown through the
  existing compact formatting (k / M / B…), never as raw digit strings.

### 4.3 What a gate tests (decided: power and the right defences)

A gate jumps in raw strength **and** leans on one damage type, so the right defences matter, not only bigger numbers.
The game has two damage types today (`ELEMENTS = ['physical', 'elemental']`; armor against physical, resistances
against elemental, Plan 30).

- **(my call)** Each gate tier is either a **physical wall** (armor check: monsters hit harder and more often) or an
  **elemental wall** (resist check: most of the damage is elemental). They alternate by default (5 physical, 10
  elemental, …), with the world seed allowed to swap pairs so worlds differ.
- **How much the right defence matters (decided: a strong tilt).** Raw power alone gets a player through a gate
  eventually, after much more farming. Building the right defence (armor for a physical wall, resistances for an
  elemental one) gets them through much sooner. No hard lock: no defence threshold below which a gate cannot be
  cleared. **(my call)** As a tuning target, a player with the right defence clears a gate about **twice as soon** (in
  farming time) as one who only gains raw power.
- Mind `baseResist` (−1 per level, −99 at level 100): elemental gates get harsher late in the run by design, and the
  tuning must account for it.
- A gate map's dungeon is biased to its wall type (overriding the seeded `bias` in `dungeons.ts`).
- The map card shows "Gate tier — physical" / "Gate tier — elemental" before the player runs it. The map tooltip and
  the wiki explain what the wall checks.
- Champion modifiers and map mods still apply on top.

### 4.4 Death (decided: unchanged)

Dying loses the map and keeps the drops.

### 4.5 Map supply at walls (decided: map clears drop maps)

Today maps come only from digging (`addMap` in `dig.ts`, tier = `tierAt(depth)`), and a cleared map drops gear, gems and
materials but never maps. A player stuck at a gate keeps digging deeper, so new maps arrive *above* the gate.

- **New:** clearing a map of tier T can drop maps of tier **T−1 to T+1** (decided), so farming below a wall sustains
  itself. Digging keeps dropping maps by depth as today.
- **(my call)** Roughly one map per clear on average, weighted toward T (e.g. 25% T−1, 50% T, 25% T+1), never below
  tier 1. The boss rolls it; `mapFind` raises the chance. A map's rarity follows the existing map-rarity rolls. Map
  specials and the existing map-find nodes (Cartographer, Prospector's Eye) apply as they do to dug maps. The builder
  tunes the rate so a farming player's stock of maps one tier below the gate never runs dry in the sim, and so a player
  who clears well doesn't drown in maps (the Map stash cap of 200 per tier still applies; overflow follows today's
  rules).
- Death keeps the drops (§4.4), so a map dropped earlier in a failed run is kept.

### 4.6 Interim tuning (owner decision 2026-10-31)

Amends §4.2 and §6. Plan 35's tuning found a trade-off the current game cannot get out of. Gates hard enough that
≥ 80 % of first attempts fail also stall one or two mid gates per seed (tiers 15–30) for 2–13 days, because the miner's
power barely grows while it farms under a wall: its gear stays at the tier below, and late levels and achievements add
little. Those stalls push the cap past day 16 and the frontier below 45. Softer gates keep the pacing but let the late
gates fall at the first try.

**Decision (Ernest, 2026-10-31): ship the tuning Plan 35 calls f3, under interim bands**: the first cap on days 12–19,
and first attempts failing at ≥ 40 % of gates. Every other §6 band is unchanged.

f3 on the reference sim (24-day runs, defence-aware):

| seed | cap day | frontier at cap | achievements day 1 / cap | first-attempt fails | second cap day |
|---|---|---|---|---|---|
| 12345 | 15.35 | 50 | 7.0 % / 38.4 % | 5/9 | 10.46 |
| 777 | 17.77 | 52 | 7.5 % / 39.1 % | 4/10 | 12.88 |
| 31337 | 18.11 | 52 | 7.2 % / 39.4 % | 4/10 | 12.84 |

Across the three seeds, 13 of 29 first attempts failed (45 %). The median gate hold is about 0.6 days. On seed 12345 the
raw-power policy holds 1.53× as long at the gates both runs cleared.

**Round 5b must restore the original bands** (cap on days 12–16, ≥ 80 % first-attempt fails) through crafting and the
upgrade levers, giving a player a deliberate way past a wall instead of waiting on drops.

**Findings for round 5b (final review, 2026-10-31)**

- The away auto-map queue farms tiers of already-cleared gates (they stay walls), causing dozens of deaths during the
  long holds (e.g. 31337: 40 deaths on tier 15 while held at gate 20). Skip gate tiers in `queueBestMaps` and re-measure
  before treating the trade-off above as structural.
- The walls are unbalanced: physical is about 1.56× DPS (×1.25 damage, ×1.25 speed) against elemental ×3. Mean hold is
  0.53 d for physical vs 1.04 d for elemental; first attempts failed 4/15 vs 9/15; every stall of 1.8 d or more is
  elemental. Rebalance the wall modifiers and add a per-wall check to the balance suite.
- The raw-power tilt passes at 1.53× mostly because of one elemental gate (gate 30); without it the ratio is about
  1.1. Revisit `powerScore`'s defence weighting.
- The first gate (5) is elemental on all three seeds and holds a fresh player for about 0.5–1 d.
- Holds are measured from `reachedDay`, so they include waiting for a gate map or the next check-in (first-try gates
  still show 0.2–0.6 d).
- `EXPECTED_ACHIEVEMENTS_AT_LEVEL` was fitted before f3 (the level-10 margin is thin on 31337).

## 5. Auto-mapping (decided: no cap, runs whatever you queue)

- Remove the tier limit: `autoMapMaxTier` and `AUTO_MAP_BASE_TIER` go. `nextEligibleAutoMap` returns the oldest queued
  map. The queue's over-tier handling and the "Up to tier N" label in `BattleView` go too.
- Unlocking auto-mapping is unchanged (the Surveyor passive).
- The queue size (100 plus ascendancy) is unchanged.
- **(my call)** The eight small "Auto-map Tier" ascendancy nodes in the Cartography branch (`ascendancy.ts`,
  `autoMapTier` effect) become **+10 auto-map queue size** each, reusing the existing `autoMapQueue` effect. Master
  Surveyor and World Atlas lose only their `autoMapTier` part and keep the rest. The `autoMapTier` effect kind is
  removed. Players who spent points there keep the nodes with the new effect (no refund needed).
- The reference sim queues every stashed map, so it can now run into walls while away; that is the intended risk.

## 6. The reference sim and the balance tests

The current reference player never spends Gold, never crafts and pushes the frontier as soon as it can. Against brutal
walls, that player would stall, so the sim gets a slightly smarter policy **(my call)**:

- It buys merchant items when they beat what it wears (round 5b may extend this to crafting).
- Gear choice becomes defence-aware: it keeps the best piece per slot by a score that reads the next gate's wall type
  (armor before a physical gate, resistances before an elemental one), and holds one spare piece per slot for the
  other wall type. A second, "raw power only" variant of the policy ignores wall types, and is used to check §4.3's
  strong tilt.
- Facing a gate, it farms tiers below the frontier until its "power score" rises by a set margin, then retries the gate
  once per check-in. Auto-mapping queues only maps below the gate while it is farming.
- It still plays the same schedule: four 15-minute check-ins a day, ~65% active, offline digging and auto-mapping
  between.

`tests/balance/referenceRun.test.ts` is rewritten to pin, for seeds 12345 plus two more:
- level 100 on days **12–16**;
- achievements: ~10% (±4 points) at day 1 and ~40% (±8 points) at the first cap;
- every gate from 5 to the frontier at cap is eventually cleared (no permanent stall);
- the first attempt at a gate fails at least ~80% of the time across seeds and gates;
- §3.4's expected-achievement table holds within ±25%;
- frontier at the first cap around tier 50 (45–55), with a typical gate held for about half a day (2–4 check-ins);
- the raw-power-only policy takes at least ~1.5× as long at gates as the defence-aware one.

The bands are the design; if the sim misses them, change the tuning, never the bands.

**Interim (§4.6):** until round 5b, the balance suite pins the cap on days 12–19 and first-attempt fails at ≥ 40 %.

**(my call)** These bands are pinned against today's economy. Round 5b (bases, economy, crafting) must keep them, and
re-tunes its own numbers if it moves them. So round 5a's sim buys from the merchant only in the simplest way and does
not craft; 5b extends the policy.

## 7. What is left to the builder

- The exact achievement list (names, thresholds, feat and hidden content) within §3's shape and counts.
- The exact base curve, gate step size and the XP formula, tuned against §6.
- The sim's power score and farming margin.
- UI details: how "???" hidden achievements and the gate badge look, following the existing achievements view and map
  card styling.
- Splitting the work into plans.
