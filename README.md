# Golden Miner

An idle mining game: dig deeper, collect gold and diamonds, and find chests, maps, gems and veins on the way down. Built with TypeScript, Vite and React; it is a static site with no backend, and progress is saved in your browser.

## Run it

Node 22.12 or newer is required (`nvm install` reads `.nvmrc` and installs Node 24).

```
npm install
npm run dev      # development server
npm test         # unit tests
npm run balance  # the headless pacing report
npm run build    # production build in dist/
```

A generated reference wiki ships with the game at `/wiki/` (`wiki.html`, built from the same `src/core/` data the game runs on).


## Controls

Click the rock in the Mine view to dig. Each click adds a tick, and digging also ticks along by itself; the Pause digging button stops it, and Continue digging starts it again.

- Click an item to pick it up, then click where it should go; click it again to put it back, or press Escape. Hover for its card.
- Right-click an item for its action card, which lists every action it offers.
- Ctrl+click (⌘+click on a Mac) sells it, and Alt+click salvages it.
- Shift+click moves it between the bag and the stash.

A map runs from the Run action on its card. Once the Surveyor notable is taken, the card's Auto-map action queues the map, and the miner runs the queue while you are away.

## Digging

Digging earns only from what you dig into: Gold from gold veins, Diamonds from diamond veins and crafting materials from material veins. A material vein lies only in a metre the seed left otherwise empty, and deeper metres hold rarer materials. Selling items and map kills pay Gold too, and maps also drop materials, rarer ones in deeper maps.

From Granite Veins down, some metres hold gas pockets or unstable rock that make digging slower. A new mining stat, hazard ward, cuts the slowdown. The mine shows your digging speed and the time to the next metre.

The miner only digs down. The minimap is a record of everything found, by depth. Scroll it to look back, and use "Jump to the dig face" to return.

The Mine view has a Pause digging button; press Continue digging to dig on. Your Pause is saved, so a paused game stays paused after a reload. Digging also pauses while another view is open, and going back to Mine resumes it unless you pressed Pause. Paused time is skipped, never caught up later. A hidden tab or a closed game still digs, up to the offline limit, unless you pressed Pause; the view you left it on doesn't matter. A gap of more than 5 minutes between two ticks (the computer slept) is dug as time away too, whatever view was showing, unless you pressed Pause. A map run never pauses: it keeps fighting in any view and while you are away, and if you pressed Pause, the time after it ends isn't dug.

Every find lands in your bag, unless a loot rule sells, salvages or stashes it: gear, gems, maps and ore alike, and nothing goes to the stash on its own. When the bag is full, finds are held, up to 60 of any kind, and digging stops until you make room, even while you are away. Held finds move into the bag as soon as a cell frees, the loot filter first. Past 60 held, which only a long map run reaches, gear, gems and maps are sold and ore goes to the Materials tab.

## Gear

Chests and gems drop mining and battle gear. One bag of 60 cells holds every item you carry, gear of both sets and gem stacks alike. The Inventory tab shows your paper doll, your bag and your stash side by side, stacked in one column on a phone; the stash pop-up is gone. The paper doll switches between your mining and battle gear, and the stash keeps more in its tabs. The General tab of the stash has pages of 60 cells: it starts with 2, and more are bought with Gold from the page row above the grid, each page costing more than the last. The Maps tab holds up to 200 maps of each tier and costs nothing. It shows one tier at a time: pick a tier from the row of tier buttons, each with its count, and its maps show rare first, then newest. A map moved there joins its own tier, and a full tier refuses it. Hover an item to compare it with what you wear and to see what it sells and salvages for. Click it for its card, which stays open until you click elsewhere or press Escape, and right-click it for every action. Ctrl+click (⌘+click on a Mac) sells it, Alt+click salvages it, and Shift+click moves it between the bag and the stash; on a stack in the Gems tab, selling and salvaging open its card instead. Cards open on the page itself, below the item when they fit there, else above it, else on the side with more room, so nothing cuts them off; a card taller than the screen scrolls inside. Drag an item onto a cell to move it (a taken cell swaps; an identical gem stack merges), onto a paper-doll slot to equip it, onto a stash tab to stash it, drag a gem onto gear to socket it (a gem's card no longer lists sockets), or drag a material onto gear or a map to craft with it; a refused drop snaps back with a short message. On a touch screen, tap an item to pick it up and see every action, then tap a cell, a slot or a tab to put it there, or tap it again to put it back. The loot filter acts on new finds by rule, before they reach the bag. A rule matches on an item's kind, slot, rarity, item level or a map's tier, its modifiers' tiers and count, a map's modifiers, a gem's type and grade, or a material's kind, and it keeps the find, sells it, salvages it, or stashes it in the matching tab: gear in the General tab, gems in the Gems tab, a map under its tier and ore in the Materials tab. Maps match too; materials are only ever kept or stashed. The first matching rule wins, and a find no rule matches goes to the bag, as does a find whose tab has no room. A full bag holds new finds instead, as Digging says. The Loot filter button above the bag, or the one in Settings, opens the rules, each read as a sentence such as `Stash rare gear, item level 4 or more`, up to 40 of them. Edit opens one rule at a time in the editor under the list: pick its kind and what to do with it, then the fields that kind has, and Save it. A rule that could never work, such as one that sells materials, says why under its fields and can't be saved. Move up and Move down in the editor change its place; ✕ removes a rule at once and leaves an empty row until you close the dialog, so nothing slides under your pointer; Add rule starts a new one that keeps gear, which changes nothing until you edit it.

Gear now has up to 3 prefixes and 3 suffixes. A magic item has one or two lines, at most one of each, and a rare item four to six. Every line has a tier, shown in grey at the right edge of the item's card as T1, T2 and so on, and deeper finds can roll higher tiers without limit, though the low tiers stay the likeliest.

The newer modifiers work like this. On mining gear, percent dig power multiplies all your dig power. Vein yield adds to every vein: Gold, Diamonds and ore. Ore find gives a chance of a bonus ore vein on metres that hold nothing else, a 30 % chance at +100 % and at most 60 %. Sell bonus and salvage yield raise what selling and salvaging pay. On battle gear, elemental damage adds to every hit, and Armored monsters don't soften it. Critical damage raises the 1.5× critical multiplier. Percent life and percent armor multiply your life and armor. Life per second heals you in maps, life per kill heals you on each kill, and XP raises the XP that kills give.

Salvage gives crafting materials (Copper and Tin ore, and more for better items) instead of Diamonds. Materials stack 50 to a bag cell and up to a million in the Materials tab of the stash. A material you find tops up its stacks in your bag, then opens as many new ones as it needs, so move ore to the Materials tab to keep room for finds. Materials can't be sold or salvaged: they are crafting currency.

Materials craft gear. Drag a material onto an item, or open the item's card and pick a craft under Craft; the card stays open, so crafts can follow one another. Copper ore makes a normal item magic. Tin ore rerolls a magic item's modifiers and Silver ore a rare item's. Iron ore adds a modifier to a magic or rare item, and a magic item that already has two turns rare. Mithril rerolls the sockets of any item, legendaries too, and sends its gems back to the Gems tab. Starsteel rerolls the values of the modifiers within their tiers. Obsidian shards remove a random modifier. Diamonds add a modifier to a rare item. A craft costs more the higher the item's level, and the card shows each cost and greys out what you can't pay for yet. Legendary lines never change. A Void crystal tempers a magic or rare item, a gamble: it may gain a crafted line above its usual tiers, raise every line a tier, do nothing, or ruin it so every line falls to tier 1. Whatever happens, a tempered item is sealed and can't be crafted again. Souls upgrade battle gear one item level at a time, legendaries too: open its card and pick "Upgrade with Souls", and the card stays open, so upgrades can follow one another. The upgrade changes nothing else, but a higher item level raises how high later crafts can roll. Each level costs more Souls than the last, and the card shows the cost and greys it out until you can pay. Mining gear and tempered items can't be upgraded.

Legendaries each have a unique line, shown in the legendary colour under their modifiers, that no other item can roll. It works only while the legendary is worn:

- Deepdelver (pickaxe): Every 25th metre is dug at once, and its find is doubled.
- The Golddigger (gloves): Gold veins also give a material of the band.
- Black Lantern (lamp): Hazards ahead show on the minimap, and hazards slow you by half as much.
- Long Voyage (boots): The offline cap is doubled, and catch-up finds are doubled.
- Band of the Deep (ring): Critical hits heal 2 % of your life.
- Wolf Eye (amulet): Champions and bosses drop one more item.
- Kraken Leather (armor): Once per map, a killing blow leaves you at 1 life instead.
- The Peacemaker (weapon): Every 5th hit strikes twice.

A unique's extra finds, drops and strikes draw from a stream of their own, so the rest of your loot is the same with the legendary or without it.

## Worlds

Every world has a seed, a short phrase such as `amber-fox-427`, shown in Settings with a Copy seed button. The seed decides the mine: its bands, the shape of the shaft and where chests, maps, veins and hard rock lie. Two players with the same seed dig through the same mine. Chest contents, bonus finds and combat are still your own luck. Start a new world from Settings with a random seed or one you type; a number or any text up to 64 characters works.

## Maps

A dungeon entrance you dig past becomes a map. Maps are items: a found map goes to your bag, unless a loot rule sells, salvages or stashes it, and you can keep it there or move it to its tier in the Maps tab of the stash. A map you don't want sells for 25 Gold × its tier², half as much again if magic and two and a half times if rare, or salvages into Copper ore, plus Tin ore from tier 3. Right-click a map for its card, which names the dungeon it opens into and its rooms, and run it from there, whether the map is in your bag or in the Maps tab of the stash; the menu has no Maps view any more. While a map runs, a Run tab comes first in the menu and opens the fight; when the run ends, its result shows, and closing it takes you back to Mine; after a death, its See it in the Log button takes you to that death in the Log instead. Maps now come in normal, magic and rare, and the card shows their modifiers, each with its tier at the right, and the extra rewards they pay. An enchanted map opens into the same dungeon, with the same rooms and monsters, but its modifiers make those monsters tougher: more life and damage, faster attacks, stronger champions and bosses; your hits do less to them, and rooms heal you less. In return it pays more: more item drops, gems and materials, better rarity and more Souls. You enchant a map with the same materials as gear, plus Souls: drag a material onto the map, or open its card and pick an enchant under Enchant; the card stays open, so enchants can follow one another. Copper ore makes a normal map magic. Iron ore adds a modifier to a magic or rare map, and a magic map that already has two turns rare. Silver ore rerolls a rare map's modifiers, and Obsidian shards remove a random one. A Void crystal tempers a magic or rare map, a gamble: it may gain a strong modifier, raise every modifier a tier, do nothing, or ruin it so every modifier falls to tier 1; either way the map is sealed and can't be enchanted again. Copper, Iron and Silver ore and a Void crystal each have a one-in-ten chance to add a special modifier to a map that has none: the boss drops a legendary; a treasure room of three chests before the boss; every pack has a champion; materials drop twice; Souls ×3, but rooms don't heal; or a second boss, the first one's twin. A map holds one special at most, apart from its modifiers: it shows last among them on the card in the legendary colour, doesn't count toward the six, doesn't raise the rewards, and stays through every later enchant. Tin ore, Mithril, Starsteel and Diamonds don't work on maps. An enchant costs more the higher the map's tier, and the card shows each cost and greys out what you can't pay for yet. Each world generates its own dungeons, monsters and bosses from its seed, so the same seed gives the same dungeons; the fights themselves are your own luck. Running a map pauses digging and switches the paper doll to your battle gear. Fights are automatic: your hero hits on its own, and clicking in a map does nothing. Monsters grow tougher with a map's tier. The first tiers stay gentle: a new miner with no gear at all wins the first map about two times in three, and a miner of level 3 in plain gear of that depth wins a tier-2 map about seven times in ten, but from tier 3 maps are much harder: a map of your tier is a real fight even in gear of its level, won about four times in ten. Modifiers rolled on a map now roll stronger than before; those already on your maps keep their values. Maps are the only source of XP and Souls. Dying or leaving a map early loses that map but keeps what you earned. A run left going continues while you are away and ends on its own. When your bag is full, drops are held, up to 60, and the fight goes on; past that, gear, gems and maps are sold and ore goes to the Materials tab.

## Skills

Every level gives one point, and the Skills tab spends them on a passive web: the miner in the middle, mining nodes to one side, battle nodes to the other, and hybrid nodes along the bottom. A node is a small stat bonus, a named notable, or a keystone that changes a rule with a downside, and one can only be taken next to a node already taken or staged, the miner counting as a start; taking any node costs one point. Clicking a node stages it, and **Confirm allocation** spends the points for the whole staged path; clicking a staged node unstages it and anything staged beyond it. Pan and zoom with the wheel or the +/− buttons, and search the web by name or effect. **Refund nodes** starts a refund: click allocated nodes to mark them (a parent only once everything that depends on it is marked too), then confirm; each costs 100 Gold × your level. A full reset costs 20 Diamonds. Some nodes do more than add numbers: Gem Pouch and Ore Cart let a bag cell hold 10 more gems and 25 more materials, Deep Pockets adds two free General stash pages, and the Cartographer keystone finds maps one tier higher.

## Ascension

The Surveyor notable in the passive web unlocks auto-mapping: queue a map from its card, and while you are away the miner runs your queued maps back to back, up to tier 3 plus the ascendancy tree's extra tiers, instead of digging. From level 60 the Ascend tab lets the miner sacrifice the whole run (level, web, gear, bags, stash, Gold, Diamonds, Souls and depth) for ascendancy points that scale with how far the run went: the square root of the depth divided by 250 m, rounded down, plus — from the second ascension on — one point for every 10 levels past 60, up to +4 at the level-100 cap. The points are permanent and go into a small tree of their own, spent on starting depth, passive points, auto-map tiers, offline cap, yield and find that make every later run faster; ascending keeps the tree, the queue, your lifetime best and your settings.

## Merchant

The Merchant tab, beside Mine, Inventory, Skills, Ascend and Log, holds two merchants, the same in every world, each with a pixel-art portrait: Brannoc the Trader and Old Mirela. They sit side by side, one above the other on a narrow screen. Brannoc sells 12 items, gear and maps, rolled from the world seed and refreshed every 10 m you dig deeper (his caption says at which depth); they are rolled at the tier of the depth you reached, and never include a legendary. Each tile shows the item, its name in its rarity's colour, its price and a Buy button. Hover a tile for the item's card, which compares it with what you wear; click for the card, or right-click for a card with Buy. Each item costs 4 times its base sell value, goes to your bag untouched by the loot filter, and leaves the stock until the next refresh, when every slot is filled again; a bought tile keeps its place and reads Sold. Too little Gold or a full bag refuses the buy, says why under the tiles and changes nothing. Looking at the stock or buying from it never changes what you find. Old Mirela gambles: pick a slot, pay Gold, and get a random item for it in your bag, rolled at the tier of your deepest metre. Most are normal or magic; a few are rare; legendaries are very rare, and a slot with no legendary gives a rare instead. The price is 300 Gold × the tier², so it grows as you dig deeper, and the loot filter never touches what you buy. A full bag or too little Gold refuses the gamble and changes nothing. The merchants never sell Diamonds or Souls; selling items stays in their cards. A click that closes an item card never goes through to a Buy or Gamble button the card covered: those wait until the pointer moves.

## Log

The Log tab keeps a record of what you found and where you fell. The Last run card at the top shows how your most recent map went. Under it, the Drops tab lists every find, newest first: where it came from (a metre, a room of a map, or the Merchant) and what became of it, such as `to bag → stashed → sold (+72 Gold)`; held, sold, salvaged or stashed by the loot filter, equipped, crafted, upgraded with Souls, run and lost all show up along the way. Gems and ore merge into stacks, so each of their finds is one line, like `+3 Iron ore → bag`. The Deaths tab lists each death with its time, the map and its modifiers, the room, the monster that struck last and the map you lost. The Log keeps the newest 300 drops and 50 deaths, and both are saved.

## Saves

The game autosaves every 30 seconds and when the tab is hidden or closed. The Settings button in the header opens the motion switches, the world seed, the loot filter and the save tools: export the save as text, import one, or start a new world. Only one tab can play at a time. A loot rule is saved as soon as you save it in the loot filter, or remove or move it. An older save's loot rules come over as sentences that act as they did: a rule that matched nothing is dropped, and one for any item of any rarity becomes a gear rule and a gem rule.

## The original

The 2013 original lives in `legacy/` (open `legacy/index-dev.html`).

## Balance

`npm run balance` plays a reference run headlessly through the real tick, map, passive, auto-map and ascension code: four fifteen-minute check-ins a day, offline digging between, the best drop worn, and points spent towards Surveyor. On the seeded reference run the first map arrives within a minute, auto-mapping unlocks at level 30, and the level-100 cap lands at about 12 simulated days (the achievements boost accelerates the idealized run; a human's first run is longer); the deepest depth is still climbing a day later (15,110 m at the cap; frontier map tier 53 → 58), the cap is worth 7 ascendancy points, and a second run's level bonus is +4. The model assumes perfect drops and no crafting, so a human's run is a little longer.

## Credits

The game is set in Metamorphous for headings, Alegreya Sans for text and IBM Plex Mono for numbers, all served from Google Fonts. The item, gem, vein, monster and merchant art is code-drawn placeholder pixel art. Golden Miner is a revival of the 2013 original by anag0, which lives in `legacy/`. The code is under the MIT licence (see [`LICENSE`](LICENSE)).
