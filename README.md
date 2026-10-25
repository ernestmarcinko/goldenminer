# Golden Miner

An idle mining game: dig deeper, collect gold and diamonds, and find chests, maps, gems and veins on the way down. Built with TypeScript, Vite and React; it is a static site with no backend, and progress is saved in your browser.

## Run it

Node 22.12 or newer is required (`nvm install` reads `.nvmrc` and installs Node 24).

```
npm install
npm run dev      # development server
npm test         # unit tests
npm run build    # production build in dist/
```

## Digging

Digging earns only from what you dig into: Gold from gold veins, Diamonds from diamond veins and crafting materials from material veins. A material vein lies only in a metre the seed left otherwise empty, and deeper metres hold rarer materials. Selling items and map kills pay Gold too, and maps also drop materials, rarer ones in deeper maps.

From Granite Veins down, some metres hold gas pockets or unstable rock that make digging slower. A new mining stat, hazard ward, cuts the slowdown. The mine shows your digging speed and the time to the next metre.

The miner only digs down. The minimap is a record of everything found, by depth. Scroll it to look back, and use "Jump to the dig face" to return.

The Mine view has a Pause digging button; press Continue digging to dig on. Your Pause is saved, so a paused game stays paused after a reload. Digging also pauses while another view is open, and going back to Mine resumes it unless you pressed Pause. Paused time is skipped, never caught up later. A hidden tab or a closed game still digs, up to the offline limit, unless you pressed Pause; the view you left it on doesn't matter. A map run never pauses: it keeps fighting in any view and while you are away, and if you pressed Pause, the time after it ends isn't dug.

Every find lands in your bag: gear, gems, maps and ore alike, and nothing goes to the stash on its own. When the bag is full, finds are held, up to 60 of any kind, and digging stops until you make room, even while you are away. Held finds move into the bag as soon as a cell frees, the loot filter first. Past 60 held, which only a long map run reaches, gear, gems and maps are sold and ore goes to the Materials tab.

## Gear

Chests and gems drop mining and battle gear. One bag of 60 cells holds every item you carry, gear of both sets and gem stacks alike. The Inventory tab shows your paper doll, your bag and your stash side by side, stacked in one column on a phone; the stash pop-up is gone. The paper doll switches between your mining and battle gear, and the stash keeps more in its tabs. The General tab of the stash has pages of 60 cells: it starts with 2, and more are bought with Gold from the page row above the grid, each page costing more than the last. The Maps tab holds up to 200 maps of each tier and costs nothing. It shows one tier at a time: pick a tier from the row of tier buttons, each with its count, and its maps show rare first, then newest. A map moved there joins its own tier, and a full tier refuses it. Hover an item to compare it with what you wear, click to equip it, Alt+click to sell it, Shift+click to stash it, and right-click to see every action. Drag an item onto a cell to move it (a taken cell swaps; an identical gem stack merges), onto a paper-doll slot to equip it, onto a stash tab to stash it, drag a gem onto gear to socket it, or drag a material onto gear or a map to craft with it; a refused drop snaps back with a short message. On a touch screen, tap an item to pick it up and see every action, then tap a cell, a slot or a tab to put it there, or tap it again to put it back. The loot filter sells or salvages new items by rule, before they reach the bag; it never touches maps. A full bag holds new finds instead, as Digging says.

Gear now has up to 3 prefixes and 3 suffixes. A magic item has one or two lines, at most one of each, and a rare item four to six. Every line has a tier, shown on the item's card as T1, T2 and so on, and deeper finds can roll higher tiers without limit, though the low tiers stay the likeliest.

The newer modifiers work like this. On mining gear, percent dig power multiplies all your dig power. Vein yield adds to every vein: Gold, Diamonds and ore. Ore find gives a chance of a bonus ore vein on metres that hold nothing else, a 30 % chance at +100 % and at most 60 %. Sell bonus and salvage yield raise what selling and salvaging pay. On battle gear, elemental damage adds to every hit, and Armored monsters don't soften it. Critical damage raises the 1.5× critical multiplier. Percent life and percent armor multiply your life and armor. Life per second heals you in maps, life per kill heals you on each kill, and XP raises the XP that kills give.

Salvage gives crafting materials (Copper and Tin ore, and more for better items) instead of Diamonds. Materials stack 50 to a bag cell and up to a million in the Materials tab of the stash. A material you find tops up its stacks in your bag, then opens as many new ones as it needs, so move ore to the Materials tab to keep room for finds. Materials can't be sold or salvaged: they are crafting currency.

Materials craft gear. Drag a material onto an item, or open the item's card and pick a craft under Craft; the card stays open, so crafts can follow one another. Copper ore makes a normal item magic. Tin ore rerolls a magic item's modifiers and Silver ore a rare item's. Iron ore adds a modifier to a magic or rare item, and a magic item that already has two turns rare. Mithril rerolls the sockets of any item, legendaries too, and sends its gems back to the Gems tab. Starsteel rerolls the values of the modifiers within their tiers. Obsidian shards remove a random modifier. Diamonds add a modifier to a rare item. A craft costs more the higher the item's level, and the card shows each cost and greys out what you can't pay for yet. Legendary lines never change. A Void crystal tempers a magic or rare item, a gamble: it may gain a crafted line above its usual tiers, raise every line a tier, do nothing, or ruin it so every line falls to tier 1. Whatever happens, a tempered item is sealed and can't be crafted again. Souls upgrade battle gear one item level at a time, legendaries too: open its card and pick "Upgrade with Souls", and the card stays open, so upgrades can follow one another. The upgrade changes nothing else, but a higher item level raises how high later crafts can roll. Each level costs more Souls than the last, and the card shows the cost and greys it out until you can pay. Mining gear and tempered items can't be upgraded.

## Worlds

Every world has a seed, a short phrase such as `amber-fox-427`, shown in Settings with a Copy seed button. The seed decides the mine: its bands, the shape of the shaft and where chests, maps, veins and hard rock lie. Two players with the same seed dig through the same mine. Chest contents, bonus finds and combat are still your own luck. Start a new world from Settings with a random seed or one you type; a number or any text up to 64 characters works.

## Maps

A dungeon entrance you dig past becomes a map. Maps are items: a found map goes to your bag, and you can keep it there or move it to its tier in the Maps tab of the stash. A map you don't want sells for 25 Gold × its tier², half as much again if magic and two and a half times if rare, or salvages into Copper ore, plus Tin ore from tier 3. Click a map for its card, which names the dungeon it opens into and its rooms, and run it from there, whether the map is in your bag or in the Maps tab; there is no Maps tab in the menu any more. While a map runs, a Run tab comes first in the menu and opens the fight; when the run ends, its result shows, and closing it takes you back to Mine. The Log tab shows how your last run went. Maps now come in normal, magic and rare, and the card shows their modifiers and the extra rewards they pay. An enchanted map opens into the same dungeon, with the same rooms and monsters, but its modifiers make those monsters tougher: more life and damage, faster attacks, stronger champions and bosses; your hits do less to them, and rooms heal you less. In return it pays more: more item drops, gems and materials, better rarity and more Souls. You enchant a map with the same materials as gear, plus Souls: drag a material onto the map, or open its card and pick an enchant under Enchant; the card stays open, so enchants can follow one another. Copper ore makes a normal map magic. Iron ore adds a modifier to a magic or rare map, and a magic map that already has two turns rare. Silver ore rerolls a rare map's modifiers, and Obsidian shards remove a random one. A Void crystal tempers a magic or rare map, a gamble: it may gain a strong modifier, raise every modifier a tier, do nothing, or ruin it so every modifier falls to tier 1; either way the map is sealed and can't be enchanted again. Tin ore, Mithril, Starsteel and Diamonds don't work on maps. An enchant costs more the higher the map's tier, and the card shows each cost and greys out what you can't pay for yet. Each world generates its own dungeons, monsters and bosses from its seed, so the same seed gives the same dungeons; the fights themselves are your own luck. Running a map pauses digging and switches the paper doll to your battle gear. Your hero hits on its own, and every click is an extra hit. Maps are the only source of XP and Souls. Dying or leaving a map early loses that map but keeps what you earned. A run left going continues while you are away and ends on its own. When your bag is full, drops are held, up to 60, and the fight goes on; past that, gear, gems and maps are sold and ore goes to the Materials tab.

## Merchant

The Merchant tab, beside Mine, Inventory and Log, gambles: pick a slot, pay Gold, and get a random item for it in your bag, rolled at the tier of your deepest metre. Most are normal or magic; a few are rare; legendaries are very rare, and a slot with no legendary gives a rare instead. The price is 300 Gold × the tier², so it grows as you dig deeper, and the loot filter never touches what you buy. A full bag or too little Gold refuses the gamble and changes nothing. The merchant never sells Diamonds or Souls; selling items stays in their cards.

## Saves

The game autosaves every 30 seconds and when the tab is hidden or closed. The Settings button in the header opens the motion switches, the world seed, the loot filter and the save tools: export the save as text, import one, or start a new world. Only one tab can play at a time.

## The original

The 2013 original lives in `legacy/` (open `legacy/index-dev.html`).
