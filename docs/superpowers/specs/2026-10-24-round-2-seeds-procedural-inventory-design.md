# Golden Miner, round 2: world seeds, procedural generation, mine shaft, inventory

- **Date:** 2026-10-24
- **Status:** draft, builder-checked; awaiting Ernest's approval
- **Amends:** `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md` (the "main spec"). Where this
  document and the main spec disagree, this document wins.
- **Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, row "Round 2" (Fonts, Shaft, Settings) and
  the earlier Items board.

Marking follows the main spec: **(decided)** is Ernest's choice, **(my call)** is the designer's default and can be overruled.

## 1. Why

Ernest played Plans 1–2 and asked for a second round before maps are built. His reasons, in his words where possible:

- **He has no time to draw monsters, dungeons or mine art.** So looks and names must be generated, and stay
  pleasant and readable without an artist.
- **Worlds should be shareable**, "sort of like a Minecraft world": the same seed gives the same world, so players
  can trade seeds. Loot stays luck: it is decided during play, never by the seed.
- **Digging should feel like digging.** That means a single shaft that visibly moves down, with walls sliding up
  and the next few metres glowing ahead.
- **It should look and handle like Diablo / Path of Exile.** That covers the fonts, the comparison against the worn
  item, drag and drop, stash tabs and stackable gems.
- **Players should be able to turn animations off.**

## 2. Goals, non-goals, anti-goals

**Goals**
- A shareable text seed fixes the whole world:
  - the mine: which metre holds what, plus wall looks and deep band names;
  - every dungeon: its type, name, rooms, monsters, champions and boss;
  - monster looks and names.
- Monster, dungeon and mine visuals are generated from parts and palettes. They need no hand-drawn art beyond a
  small kit of part templates.
- An inventory that handles like an ARPG: drag and drop, stash tabs, stacks.
- The settings players expect from a game in 2026, motion above all.

**Non-goals**
- Branching dungeon maps with forks, side rooms or path choice (decided: rooms stay a straight line).
- Online seed sharing, leaderboards or any backend. Seeds are shared as text by the players themselves.
- Seeding loot (decided).

**Anti-goals** (failures even if everything works)
- Generated monsters that look like noise. Every generated creature must read as a creature: eyes, a body,
  limbs. This is why monsters are built from parts and not from random pixels (decided).
- Names that are unpronounceable or offensive. Generated names come from curated syllable and word lists.
- A seed that silently stops reproducing its world after an update. World generation is versioned: a save keeps
  the generator version it was made with (§3.4).

## 3. The world seed

### 3.1 What it looks like (decided)
- Any text is a valid seed: `golden mole`, `1234`, `amber-fox-427`.
- A new world gets a readable random seed of the form `<adjective>-<animal>-<number>` (my call: curated lists of
  about 100 adjectives and 100 animals, and a number from 1 to 999).
- Text maps to the 32-bit `seed` like this (my call):
  - A plain decimal integer from 0 to 4294967295 is used as is, so old saves keep their worlds (§3.4).
  - Any other text is trimmed and lowercased, then hashed with a fixed 32-bit string hash.

### 3.2 Where players see it (decided)
- **Settings** shows the seed with a **Copy seed** button.
- **"Start a new world…"** in Settings replaces "Start over". It asks for **Random world** or **Use this seed**,
  with a text field. It keeps the two-step "Really erase this game?" confirmation.

### 3.3 What the seed decides, and what it doesn't
- **Seeded,** so the same in every copy of the world:
  - the metre rolls (decided: the seed alone decides them; see "Find gear" below);
  - wall textures and details;
  - the names, colours and textures of deep bands;
  - the dungeon type behind each map entrance, and that dungeon's whole layout: room count, monsters,
    champions and boss;
  - monster species looks, and generated names.
- **Not seeded:**
  - loot of every kind: chests, map drops, gems;
  - combat rolls (damage, crits, hits);
  - side-gallery finds (they are rolled as dug and are a form of loot);
  - the per-tick Diamond chance.

  All of these come from a separate random stream, `state.rng`. A new world seeds it independently of the world seed.
- **Rule for builders:** world generation is a pure function of `(seed, position)` (a metre, a map entrance,
  a band index), built on `hash2` / `mulberry32`. It never reads or advances `state.rng`, and never reads the
  player's gear or stats.
- **Find gear (decided: the same world for everyone).**
  - Today `rollMetre` uses the player's chest, gem and map find stats, so gear changes which metres hold what.
    In generator version 2 the metre roll uses the base chances only, so every player on a seed meets the same
    finds at the same metres.
  - Find stats instead give **bonus finds** from the player's own luck (`state.rng`). When a metre whose seeded roll
    holds no feature is dug, roll once against the bonus chances: chest, gem or map, each at
    `base chance × find bonus`, using the same total cap as today (my call).
  - A bonus map entrance leads to a dungeon picked like a seeded one, from `(seed, metre)`, so its layout is still
    world-determined.
  - Vein and hard-rock chances are unaffected by gear, as today.

### 3.4 Old saves, generator versions and ascension
- Existing saves keep their numeric `seed`; their seed text becomes that number written out.
- **Generator versions.**
  - Existing saves are recorded as `worldGen: 1` (today's gear-dependent metre rolls, and today's look).
  - New worlds start at `worldGen: 2` (this document).
  - A save keeps generating with its version. Any future change that would alter existing worlds adds a new
    version, and older generators stay in the code until no supported save uses them.
- **Ascension (decided).** Ascension keeps the seed and rebuilds the world from it with the newest generator. At that
  moment the player may type a different seed instead. The seed text therefore sits with the state kept across
  ascension, while `worldGen` and everything generated sit with the run.
- **Loot streams.** Streams already in old saves keep going. Only new worlds (and ascensions) get the independent
  stream.

## 4. Procedural content

### 4.1 Monsters (decided: built from parts)
- **Parts.** A small hand-made kit of pixel part templates is combined into a creature:
  - bodies (blob, quadruped, biped, serpent, winged);
  - heads, eyes, mouths;
  - horns or antennae, legs, wings, tails.

  Each part has anchor points so the parts line up. My call: about 5 bodies and 3–4 variants of every other
  part, which already gives thousands of combinations.
- **Colour.** Each species gets a palette from the seed: a body hue, a highlight, an accent and eyes. Palettes
  come from curated ranges that read well on the dark dungeon floors.
- **Species.**
  - Each depth band has a fixed list of species names, hand-written and readable (decided: fixed names for normal
    monsters). Examples: Topsoil "Mole Rat, Cave Beetle, Tunnel Bat"; Clay "Clay Golem, Mud Slime, Burrow Snake".
  - The seed generates each species' look once per world.
  - Each species also carries combat traits (element, attack interval, life and damage multipliers). These come
    from the species list and stay fixed, so balance doesn't depend on the seed (my call).
  - **Deep bands** (from 1,000 m, without end): four hand-written deep species lists, cycled by deep band index.
    Each generated band still gets its own looks for them from the seed (my call: fixed names and traits stay
    fixed, and the depths still vary).
- **Tiers of monster** (decided: normal, exceptional and boss, with baselines for every map tier):
  - **Normal:** a species at the map tier's baseline.
  - **Exceptional (champion)** (decided: champion modifiers):
    - about 1 in 8 monsters (my call);
    - a generated name, such as "Gorvash the Hollow";
    - 1–2 modifiers drawn from a curated list (my call for the list): Armored (physical damage taken −40 %),
      Swift (attacks 40 % faster), Vampiric (heals 20 % of the damage it deals), Fire-touched (elemental
      hits), Brutal (+50 % damage), Thick-skinned (+80 % life);
    - more life, damage and XP, and better loot (my call: ×2.5 life, ×1.5 damage, ×3 XP, +1 guaranteed drop with
      raised rarity);
    - visually: a coloured aura outline and one extra part.
  - **Boss:**
    - a generated name with a title ("Ghorvath, Warden of the Weeping Hollows");
    - a larger body, and 2–3 extra parts;
    - its numbers as in the Plan 3 draft (×5 life, ×1.5 damage, ×5 rewards).
- **Determinism.**
  - A species' look comes from `(seed, band, species index)`.
  - A champion's or boss's name and parts come from `(seed, map entrance metre, room, slot)`.
  - Combat outcomes never depend on looks.

### 4.2 Dungeons (decided: theme, mix and length)
- **Types per band.** Each world generates 3 dungeon types per depth band (my call: 3). A type has:
  - a generated name ("The Weeping Hollows", "Gloomvein Pits"), from curated adjective, noun and place lists
    themed by band;
  - a floor palette and a floor pattern (tile layout) for the fight scene;
  - an element bias. It only steers which of the band's species are picked (species keep their own element), so
    it never overrides combat traits (my call);
  - a subset of the band's species, 2–3 of them;
  - a room count from 4 to 7 (decided);
  - a boss species and its generated name.
- **Maps.** A map entrance found at metre `m` leads to the type `hash(seed, m) mod 3` of its band. The map item
  shows the dungeon name and tier. Every run of that map (one per map item) has the same rooms, monsters and
  champions. Damage rolls and loot differ.
- **Layout.**
  - Rooms stay a straight line (decided).
  - The last room is the boss.
- **Balance-neutral (decided).** The seed changes shape, names, looks and species mix, never difficulty or reward
  per tier.
  - Every map of a tier has the same **monster budget** (my call: 15 normal-monster units, as in the Plan 3 draft's
    5 rooms × 3).
  - The seed only decides how the budget is split. A 4-room dungeon packs 3–4 monsters per room; a 7-room one 2–3.
  - A champion costs 3 units, roughly its share of life × XP, so champions replace normal monsters rather than
    add to them. The champion count per map is fixed by tier (my call: 1, or 2 from tier 8).
  - XP, Souls, Gold and drops per map tier then come out the same in every world, so the Plan 3 draft's combat
    tuning still holds.

### 4.3 The mine (decided: known start, generated depths)
- **The named bands stay:** Topsoil, Clay Beds, Limestone, Granite Veins, Basalt Deep, Obsidian Reach, down to
  1,000 m.
  - Within a band, the seed varies the wall texture pattern and the rare wall details (my call for the details per
    band): roots and pebbles in Topsoil, pottery shards in Clay, chalk seams and fossils in Limestone, quartz in
    Granite, glowing cracks in Basalt, glass shards in Obsidian.
  - Details are cosmetic only.
- **Deep bands.** From 1,000 m the bands are generated, every 300 m as today (the band size stays). Each one gets:
  - a generated name ("The Weeping Deep", "Ashen Seam"), replacing "The Abyss I, II…";
  - a palette;
  - a texture and a detail set.

  Tiers continue exactly as today, so balance is unchanged.

### 4.4 Art: generated parts replace the pack there (decided)
- Monsters, mine walls and dungeon floors are always code-drawn from a part kit and palettes, at runtime. They
  don't go through the swappable atlas.
- A bought pack can still replace, through the existing atlas, the item icons, the miner, chests, coins and UI
  icons. This is the main spec §3 rule, narrowed to those sprites.

## 5. The digging shaft (decided)
- **A single shaft.** The mine scene becomes one shaft column, one metre per row, with textured wall columns on
  both sides (mockup "Shaft"). The miner stands at the dig face. The face tile shows cracks growing with the
  progress to the next metre.
- **Movement.** Each finished metre steps the whole column (walls and shaft) up one row:
  - Step (default): a quick ease, about 0.2 s.
  - Smooth: a continuous slide as progress fills.
  - Off: an instant jump.

  This is a Settings choice. Several metres in one tick, during catch-up, move once to the final position (my call).
- **Lamp.** The lamp lights the next metres below the face. Base lamp sight goes from 2 m to **3 m** (decided).
  - Each lit metre shows its find as a glowing icon in the rock, plus a side label ("+2 m: Chest").
  - Hard rock shows as darker cracked rock.
  - Beyond the lamp: darkness.
- **What stays.** The minimap stays beside the shaft (my call), with the same history and climb-back. Clicking the
  shaft digs, as now. Floating +Gold and find pop-ups stay, subject to Settings.
- **Galleries.** In a side gallery, the shaft shows the gallery depth with walls but no face progress below; side
  galleries are shown as a horizontal cut (my call: detailed in the plan).
- **Finds.** Bonus finds (§3.3) appear as they are dug, since nothing reveals them ahead.

## 6. Look and settings

### 6.1 Fonts (decided: option B)
- **Display** (titles, headings, item names in tooltips and cards): Metamorphous.
- **Text:** Alegreya Sans.
- **Numbers:** IBM Plex Mono.
- All three load from Google Fonts. The rarity colours stay.

### 6.2 Settings dialog (decided)
- **Opening it:** the header's Save button becomes **Settings** (my call).
- **Motion:**
  - switches for Floating numbers, Find pop-ups and Lamp flicker;
  - Mine shaft: Step / Smooth / Off.
- **Reduced motion:** when the system asks for reduced motion, every motion setting acts as off, and the dialog
  says so (my call).
- **World:** the seed, with Copy seed.
- **Game:** Loot filter…, Export / import save…, Start a new world…, and the donate link (main spec §5).
- **Storage:** settings live in `state.settings`, so they are kept across ascension (main spec).

## 7. Inventory, round 2

### 7.1 Equip feedback and compare (decided)
- **Compare.** Hovering or tapping an item shows its card, with the existing "If equipped" difference lines. Beside
  it is the worn item's full card, headed **Equipped**. On phones the two stack inside the tap card.
- **Equipping into an empty slot** shows a toast, "Equipped <name>", for about 2 s, and the paper-doll slot flashes
  green. Equipping is instant: there is no confirmation prompt.

### 7.2 Slots and drag and drop (decided: everywhere)
- **Fixed slots.** Bags become fixed grids of 24 slots, and items keep the positions players give them, gaps
  included. The General stash tab is a fixed grid too.
- **Drag and drop.** Mouse drags:
  - between bag cells (rearrange, or swap when the target is taken);
  - onto a paper-doll slot to equip, swapping with the worn item;
  - from a paper-doll slot to the bag to unequip;
  - onto a stash tab, or the open tab's grid;
  - a gem onto worn or carried gear with an open socket to socket it.

  Invalid drops are refused with a short message, and the item snaps back.
- **Touch:** tap an item to pick it up (it lifts and follows nothing), then tap where it should go. Tap it again to
  put it back.
- **Keyboard:** the action card covers every move.
- **Click shortcuts stay as they are:** click to equip, Alt+click to sell, Shift+click to stash, right-click for
  the card.

### 7.3 Stash tabs (decided: General, Gems, Maps)
- **General:** gear, as a fixed grid (60 slots, as now).
- **Gems:** one slot per gem type and size grade (5 × 5 = 25), each stacking to **1,000,000**.
- **Maps:** maps grouped by dungeon and tier. This replaces the 40-map list of the Plan 3 draft, and the Maps
  screen reads from it. My call: up to 200 maps; when full, the lowest-tier oldest is dropped as in the draft.
- **Later:** more General tabs can be bought from the merchant (Plan for merchant).

### 7.4 Gems become size grades and stack (decided)
- **Grades.** A gem is a type (5) and a size grade (Tiny, Small, Big, Giant, Perfect). There is no longer a
  separate item level.
  - Each grade's value is fixed (my call: the values the Plan 2 formula gives at item levels 2, 5, 8, 12 and 18).
  - The grade found depends on depth, as today: Tiny from tier 1, Small from 4, Big from 7, Giant from 10, Perfect
    from 15.
- **Stacks.** Identical gems stack: 25 per bag cell, and the passive web gets a node that raises it (the Passive
  web plan). Stacks in the Gems tab reach 1,000,000. Socketing takes one gem from a stack.
- **Old saves:** existing gems convert to the grade of their item level. The loot filter and sell / salvage
  values work per gem, and a stack sells as count × value.

## 8. Effects on the plan sequence (decided order)
1. **Plan 3 — Seeds and the mine:**
   - the world seed (text, Settings, new world);
   - the separate loot stream;
   - generator version 2: seed-only metre rolls plus find-gear bonus finds;
   - mine textures and details, and generated deep bands;
   - the stepping shaft with 3 m sight;
   - fonts;
   - the Settings dialog with the motion options.
2. **Plan 4 — Inventory, round 2:**
   - fixed slots and drag and drop;
   - stash tabs;
   - gem grades and stacks;
   - the Equipped card and equip toast.
3. **Plan 5 — Maps, combat, levels:**
   - the existing Plan 3 draft, kept for its combat model, levels, rewards, store and screens;
   - its hand-written rosters and band map names replaced by §4.1–§4.2 (part-built species looks, champions,
     generated dungeon types and bosses);
   - maps living in the Maps stash tab.
4. Then: passive web (including the bag-stack node), merchant and crafting, auto-mapping and ascension, balance and
   launch. Nine plans in all.

## 9. Left to the builder
- The part kit itself: the exact pixel templates and anchor points.
- The name word lists, the palette ranges and the hash function, all within the rules above.
- The exact easing and timing of the shaft step.
- Gem grade values beyond the default rule.
- Champion modifier numbers.
- Toast styling.
- The layout of the Settings dialog beyond the mockup.
