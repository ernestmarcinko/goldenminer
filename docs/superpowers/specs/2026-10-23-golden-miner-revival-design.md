# Golden Miner revival: design

- **Date:** 2026-10-23
- **Status:** draft, awaiting Ernest's approval
- **Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR (boards 1, 2, the character
  screen and 3A are the chosen direction; 3B and 3C are rejected skill-tree alternatives)

Marking used below: **(decided)** = Ernest chose it. **(my call)** = settled by the designer; Ernest
can overrule it while reviewing. Anything not marked is a direct consequence of decided items.

## 1. Intent

Golden Miner was Ernest's 2013 browser idle game (goldenminer.org, v0.29, jQuery 1.10, the code in
`src/`). It is being revived as a **public web game** (decided).

The old game's loop was passive gold/diamonds per second, nine minions with prices growing 1.3–1.5×
per purchase, buildings, gambling, and four flat skills. The numbers exploded into trillions. The part
worth keeping was the Diablo-flavoured loot: magic/rare/legendary items, prefix/suffix tables by
"treasure class", gems and sockets.

The revival keeps that idle-ARPG core and replaces the exponential economy with:

- **depth** as the measure of progress: a miner digs down from the surface, forever;
- **three resources** that each have a job and are traded at a merchant;
- **ARPG combat in maps**, which is the only source of XP;
- **one capped player level** feeding a **passive skill web**;
- **ascension**: at the level cap, sacrifice everything for permanent ascendancy points.

**Success looks like:** real players come back to it; an active player checks in a few times a day; a
fresh run to the level cap takes that player about **one week** (decided); the numbers on screen stay
readable the whole way.

## 2. Goals, non-goals, anti-goals

**Goals**

- The loop in §4.1, playable on desktop and phone.
- Idle-friendly: the game moves on its own and progresses offline; clicking speeds it up.
- Fighting is required to grow: XP comes only from maps.
- Meaningful trade-offs: mining vs. battle passives, which maps to run and when, what to trade.

**Non-goals (not at launch)**

- Player-to-player trading or a market (decided: NPC merchant only).
- Accounts, cloud saves, leaderboards, any backend (decided).
- Ads, purchases, premium currency. A donate link is the only money feature (decided).
- Importing 2013 saves; refactoring the 2013 code (my call: it is reference material only).

**Anti-goals: failures even if everything works (decided)**

- **Huge numbers.** No 1.2e15 gold, no exponential creep. Every value a player sees stays readable,
  shown as a plain number, deep into the game (my call for a concrete line: under ~1,000,000 at any
  depth a realistic player reaches). Growth is linear or polynomial in depth, never compounding.
- **Login pressure.** No daily streaks, login rewards, expiring timers or limited-time events, and
  nothing that punishes a player for not checking in beyond the offline cap.

Explicitly fine (Ernest did not flag them): active play (clicking, running maps) and handling
inventory are part of the game. The loot filter is a convenience, not a way to remove the item game.

## 3. Constraints

- **Stack (decided):** TypeScript + Vite + React, shipped as a static site.
- **Saves (decided):** browser localStorage plus an export/import string. One versioned JSON blob
  (schema version + `savedAt`), with migrations, designed so cloud sync could be bolted on later.
- **Phones:** responsive layout, touch targets ≥ 44 px, works at 390 px width.
- **Art (decided):** pixel-art sprites. Build with code-drawn placeholders, then swap in a bought or
  free pixel pack (e.g. from itch.io) before launch. So sprites must load from a sprite sheet + atlas
  that can be replaced without code changes (my call: integer scaling, `image-rendering: pixelated`,
  and an atlas format that accepts any frame size; placeholders are 32×32, and the real base size is
  set when the pack is picked). UI chrome follows the mockups: a dark, lamp-lit look.
- **Art licensing:** the repo is public on GitHub under MIT. Pack files whose licence forbids
  redistribution stay out of git (my call: a gitignored art folder supplied at build and deploy
  time). CC0 or MIT-compatible art can be committed.
- **Release (decided): everything in §4 ships in the first public release.** There is no public
  build before it, so playtesting before launch is private. Save migrations matter from launch day,
  when real player saves begin.

## 4. The game

### 4.1 Core loop

Dig → find Gold, Diamonds, chests, gems and **maps** → run maps → gain **XP** → level up → spend
passive points → dig deeper and run harder maps → … → reach the level cap → keep pushing depth →
**ascend** → spend ascendancy points → start over, stronger.

Mining provides materials and maps; fighting provides power. Neither works alone.

### 4.2 Ticks and clicks (decided)

- The game advances in ticks. Baseline: **1 automatic tick per second** (skills and gear can raise it).
- **Each click is one extra tick** of whatever the miner is doing right now. In the mine a tick is a
  dig; in a map it is one extra hit. Clicking speeds things up but is never required.
- My call: count at most ~10 clicks per second so autoclickers don't rewrite the balance.
- Gear and skills may change click rules too (e.g. "+1 tick per click").

### 4.3 Digging and depth

- The miner starts at the surface and digs down. Depth is measured in metres and has **no bottom**
  (decided).
- Each metre has a **rock hardness** that grows with depth. Per tick, the miner's **dig power** against
  that hardness decides progress toward the next metre.
- **The miner can climb back freely** (decided): it can return instantly to any depth already
  reached and dig there. So the state holds two numbers: **current depth** (where the miner digs now,
  which sets the tier of finds and maps) and **deepest depth** this run (which only grows when the
  miner digs below it, and feeds ascension). Digging above the deepest depth means working side
  galleries in that band (my call): the same finds at that band's tier, without adding depth. This
  is the escape when maps get too hard. A mining-heavy build that dug too deep goes back up and
  farms maps it can win.
- Depth is split into named **bands**, each one a **tier** (my call for the names: Topsoil, Clay Beds,
  Limestone, Granite Veins, Basalt Deep, Obsidian Reach, …; past the named bands, procedurally named
  bands continue forever). The tier sets resource yields, the item level of finds, and the tier of
  maps found there. This replaces the old "treasure class by level".
- Every digging tick yields a little **Gold**, and now and then a **Diamond** (more often deeper).
  This steady trickle is what floats up from each click.
- Bigger finds belong to specific **metres**: Gold and Diamond **veins**, **chests** (items, mostly
  mining gear, sometimes battle gear), **gems** (socketables) and **maps**. Digging through a metre
  collects what it holds.
- **Lamp sight** (decided): lamp helms and passives carry a *lamp sight* stat, the number of metres
  past the dig face the minimap reveals. Within sight, the minimap shows what those metres hold
  (veins, chests, gems, map entrances, harder rock). Beyond it is fog. So a metre's contents must
  be **rolled before it is dug**. My call: each new metre is rolled with the seeded RNG when it first
  comes into sight (or when reached, if sight is 0), and the result is stored. Side galleries above
  the deepest depth roll their finds as they're dug, since nothing there is shown in advance.
- The **minimap** also records the past: every find, marked at the depth where it was made, which
  helps when choosing where to climb back to.
- **Digging pauses whenever the miner is in a map** (decided), so every map costs mining time.
- **Digging continues offline** (decided) up to an **offline cap** (my call: 8 h base, raised by gear,
  passives and ascendancy). Returning shows an offline summary.
- My call: a new run guarantees a map within its first minute of digging, so new players reach XP
  quickly.

### 4.4 Maps and combat

- Every dungeon entrance found while digging becomes a **map item** (decided). Its tier is the tier of
  the band it was found in. Maps sit in a map stash until the player runs them.
- **XP comes only from maps** (decided; Ernest's own correction so players can't just idle-dig).
- A run is a sequence of rooms of monsters ending in a boss (my call: 5 rooms + boss, tunable).
- **Fighting is automatic; each click is an extra hit** (decided). The miner auto-attacks at its
  attack speed (1 hit/s baseline); monsters attack on their own timers.
- **Death: the map is lost, but XP and drops gained so far are kept** (decided). Leaving a run early
  works the same way.
- Rewards: XP, **Souls** (their only source), mostly battle gear, some Gold.
- **Map infusion** (my call, PoE-style; proposed and not objected to): spend Souls to raise a map's
  tier or add modifiers that trade harder monsters for more loot or Souls.
- **Auto-mapping** (decided as a concept: a later-game skill or unlock): runs queued maps up to a tier
  limit, offline included. My calls: unlocked by a passive-web notable and extended by the ascendancy
  tree; the player chooses which maps it may use; digging pauses while it runs, same as manual maps.
- My calls: life partly regenerates between rooms; healing potions are bought from the merchant.

### 4.5 Level and passive web

- **One player level**, fed only by map XP, with **points going into a mining or a battle side**
  (decided). My calls: the level cap is **60** (a tuning number to hit the one-week run) and each
  level gives **1 passive point**.
- **One passive web** (decided; mockup board 3A): a start node in the middle, mining nodes on one
  side, battle nodes on the other, hybrid nodes between them that help both.
  - Node kinds: **small** (+stat), **notable** (a named bonus), **keystone** (changes a rule, with a
    downside, e.g. "clicks dig ×3, auto ticks −30%").
  - A node can only be allocated next to an allocated node.
  - Size (my call): about 150 nodes and 8–10 keystones, so 60 points cover well under half of it.
- **Respec** (my call): refunding a single node costs Gold (scaling with level); a full reset costs
  Diamonds (the old Amnesia scroll).
- On phones the web needs pan, pinch-zoom and a node search box.
- Ascension clears the web.

### 4.6 Gear and items

- **Two separate gear sets, both always worn** (decided):
  - **Mining:** pickaxe, lamp helm, gloves, boots. Stats: dig power, Gold/Diamond yield, chest, gem
    and map find, lamp sight (mostly on lamp helms), ticks per click, auto tick rate, offline cap.
  - **Battle:** weapon, armor, helm, ring, amulet. Stats: damage, attack speed, life, armor, crit,
    resistances, Soul find, magic find.
  - Chests drop mostly mining gear; maps drop mostly battle gear.
- **Bags** (my interpretation of "a mining and a battle inventory"): a mining bag that fills from
  chests, a battle bag that fills from maps, and one shared stash.
- **Rarities**, carried over from 2013: normal; magic (2 affixes); rare (my call: 3–4 affixes);
  legendary (hand-written uniques with a fixed affix set and rolled ranges). Item level comes from the
  tier where the item was found.
- **Sockets** 0–3. **Gems** drop from mine chests (my call), in 5 types whose sizes grow with depth,
  and fit into either gear set. Diamonds stay a currency, not a gem.
- Items may carry rule-changing stats, not just bigger numbers ("+1 tick per click", "+1 h offline
  cap").
- **Loot filter** (decided): rules per rarity, type and gear set, each one keep, sell (→ Gold) or
  salvage (→ Diamonds). A player setting decides what happens when a bag is full: **stop digging**, or
  **sell the worst item** from the bag or stash (decided).
- The 2013 tables in `src/js/nomin/items.js` (prefixes, suffixes, legendaries, gem tiers) are naming
  and structure reference only. Their stats belong to the old economy and must be rewritten.

### 4.7 Resources and the merchant

Three resources (decided): **Gold, Diamonds, Souls**.

| Resource | Sources | Sinks (my calls unless stated) |
|---|---|---|
| Gold | digging; selling items; a little from maps | merchant consumables (potions); gambling; bag and stash space; single-node respec |
| Diamonds | digging (rarer, more common deeper); salvaging items | crafting: reroll affixes, add sockets, upgrade rarity; full passive reset |
| Souls | **maps only** (decided) | upgrading battle gear (decided); map infusion |

- **Merchant at the surface** (decided: NPC, no player trading). My calls: reached from its own tab
  with no travel time. Gold and Diamonds trade both ways. **Souls can be sold but never bought**, so
  battle power can't be bought around the XP-from-maps rule. Every trade has a **buy/sell spread**
  (it always loses some value, on purpose), and **rates shift with the deepest tier reached** (deeper →
  Diamonds and Souls are worth more Gold). Rates use the deepest tier, not the current one, so climbing
  up and down can't be used for arbitrage. The merchant also sells consumables, buys items, and offers
  **gambling** (from 2013: pay for a random item of a chosen slot).
- Uneven supply is the point: a mining-heavy build sits on Gold and Diamonds, and a battle-heavy build
  on Souls and Gold. The merchant turns surplus into what's missing at a cost, except that Souls
  always have to be fought for.

### 4.8 Ascension

- Available at the level cap (decided). **Resets everything**: level, passive web, gear, bags, stash,
  resources, maps, depth (decided: "sacrificing everything").
- Grants **ascendancy points**, which can't be earned any other way (decided). My call: the amount is
  based on the **deepest depth reached in that run**, which makes pushing depth after the cap the
  endgame.
- Points go into a **permanent ascendancy tree** (decided) that is never reset. My call: a smaller
  web of about 40 nodes: resource yield %, starting depth, extra passive points, auto-mapping tier,
  offline cap, bag size, better early finds.
- Kept across ascensions: the ascendancy tree and points, lifetime statistics, settings (loot filter,
  options).
- Later runs are faster because of the tree; the one-week target is for the first run.

### 4.9 Difficulty and numbers

- No depth cap (decided). Rock hardness and monster strength grow with tier **faster than gear
  does**, so every run eventually hits a wall that ascension breaks.
- All growth is polynomial in tier, never exponential, to honour the huge-numbers anti-goal. The
  builder picks the formulas.
- Pacing targets to verify with a headless simulation:
  - first map within 1 minute;
  - level cap in about a week for the reference player;
  - the depth wall arrives after the level cap, not before.
- **Reference player** (my call, to make "about a week" testable): 4 check-ins a day of about
  15 minutes each, spent mostly running maps and clicking, with offline digging in between and
  overnight. A run should look like this:
  - **Auto-mapping** unlocks around the middle of the run (≈ level 30, day 3–4), at low map tiers
    only, and then turns part of offline time into XP.
  - The level cap arrives around day 5–6.
  - Pushing depth past the cap stays worthwhile for about a day before the wall makes ascending the
    better move.

## 5. Screens

Mockups: https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR

Like the 2013 game, the **character screen is always open** beside the main view (decided), so gear
is inspected and swapped without leaving the mine or the fight. There's no separate Gear tab.

- **Header** on every screen: Gold, Diamonds, Souls, level and XP bar, current and deepest depth.
  Tabs: Mine, Maps, Skills, Merchant, Ascension (locked until the cap).
- **Mine** (board 1):
  - **Shaft scene:** a pixel-art cutaway of the shaft at the current band, with the miner at the dig
    face. The whole scene is the click target (decided: you click the mine, not a button).
  - **Click feedback** (decided, cookie-clicker style, as in 2013): every tick (clicked or automatic)
    floats `+N Gold` from the click point or the dig face, Diamonds float beside it when they drop,
    and bigger finds pop out ("Chest!", a map, a gem).
  - **Minimap** beside the scene: a depth strip with past finds marked at their depths, the miner's
    position, lamp-sight hints just below the dig face, and fog beyond. Tapping an explored depth
    moves the miner there (my call).
  - A next-metre progress bar, and a **latest finds** feed with item icons.
- **Character screen** (shared board, right side of 1 and 2):
  - A paper doll with **Mining set / Battle set** tabs. The bag below shows the matching bag (24 slots)
    with pixel item icons and rarity-coloured borders, plus a button to open the stash.
  - **Hover** an item for a tooltip: name, type and item level, stats, and **"if equipped"** green and
    red changes against the worn item (the 2013 "stat changes if equipped" box). **Click** equips it,
    swapping with the worn item. My calls: Alt+click sells; on touch screens the first tap inspects
    and a button in the tooltip equips.
- **Map run** (board 2):
  - **Room track** down to the boss on the left, with Leave map.
  - **Fight scene** in the middle: a **static monster sprite** on a dungeon floor with its life bar,
    and the miner's life bar in a corner. The scene is the click target.
  - **Floating damage numbers** for clicks and auto hits, with crits bigger and orange (decided).
    There's **no character or weapon animation** (decided: Ernest scratched the swing).
  - A combat log and this run's loot underneath. The miner switches to the Battle set and bag on
    the right.
- **Skills** (board 3A): the passive web.
- Not mocked up yet, built in the same style: Maps list, Merchant, Ascension, Settings (loot filter,
  bag-full behaviour, export/import, donate link), offline summary.

The look is the mockups' dark, lamp-lit UI (Cinzel display, IBM Plex Sans/Mono text, rarity colours
blue/yellow/orange as in 2013) with pixel-art sprites. Sprites needed: the miner (paper doll and
scene), one icon per item base type, gems by type and size, chest, map, Gold and Diamond icons,
monsters and bosses, rock tiles per band, dungeon floor tiles.

## 6. How it is built (my calls)

- **Game core in pure TypeScript** with no React or DOM: one serialisable state object, tick functions
  that advance it, a seeded RNG. Offline progress runs the same tick function in fast batches up to
  the cap. React only renders state and sends intents (dig, click, equip, run map…).
- **Tests:** Vitest on the core; a headless balance script that simulates a run to check §4.9's pacing
  targets.
- **Saves:** autosave about every 30 s and when the tab is hidden; versioned schema with migrations;
  export/import as a compressed string.
- **Repo layout:** the new game lives at the repo root; the 2013 game moves to `legacy/` and stays as
  reference.
- **Sprites:** placeholder atlas generated in code at 32×32, loaded through the same atlas format a
  real pack will use.

## 7. Left to the builder

- Every formula and number: yields, hardness, find chances, monster stats, XP curve, merchant rates,
  ascendancy point formula. These are bounded by the readable-numbers rule and the pacing targets.
- Affix pools, the legendary list, the monster roster, map and band names past the first few.
- Passive web layout and node content, within the node kinds and sizes above.
- UI details beyond the mockups, animations, and placeholder sprite style.
