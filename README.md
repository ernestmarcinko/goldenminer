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

## Gear

Chests and gems drop mining and battle gear. One bag of 60 cells holds every item you carry, gear of both sets and gem stacks alike. The character panel's paper doll switches between your mining and battle gear, and the stash keeps more in its tabs. The stash has pages of 60 cells: the General tab starts with 2 pages and the Maps tab with 1, and more are bought with Gold from the page row above the grid, each page costing more than the last. Hover an item to compare it with what you wear, click to equip it, Alt+click to sell it, Shift+click to stash it, and right-click to see every action. Drag an item onto a cell to move it (a taken cell swaps; an identical gem stack merges), onto a paper-doll slot to equip it, onto a stash tab or the Stash button to stash it, or drag a gem onto gear to socket it; a refused drop snaps back with a short message. On a touch screen, tap an item to pick it up and see every action, then tap a cell, a slot or a tab to put it there, or tap it again to put it back. The loot filter sells or salvages new items by rule.

Salvage gives crafting materials (Copper and Tin ore, and more for better items) instead of Diamonds. Materials stack 50 to a bag cell and without limit in the Materials tab of the stash. A material you find tops up its stack in your bag, and opens a new one only when you carry none, so the rest goes straight to the Materials tab and idle digging never fills the bag with ore.

## Worlds

Every world has a seed, a short phrase such as `amber-fox-427`, shown in Settings with a Copy seed button. The seed decides the mine: its bands, the shape of the shaft and where chests, maps, veins and hard rock lie. Two players with the same seed dig through the same mine. Chest contents, bonus finds and combat are still your own luck. Start a new world from Settings with a random seed or one you type; a number or any text up to 64 characters works.

## Maps

A dungeon entrance you dig past becomes a map. Maps are items: a found map goes to the Maps tab of the stash, and you can keep it there or in your bag. Click a map for its card, which names the dungeon it opens into and its rooms, and run it from there. Each world generates its own dungeons, monsters and bosses from its seed, so the same seed gives the same dungeons; the fights themselves are your own luck. Running a map pauses digging and switches the character panel to your battle gear. Your hero hits on its own, and every click is an extra hit. Maps are the only source of XP and Souls. Dying or leaving a map early loses that map but keeps what you earned. A run left going continues while you are away and ends on its own. With "stop digging" on and your bag and the stash full, drops wait for room, up to 10. A further drop is handled the same way as one found while digging: the worst item is sold to make room.

## Saves

The game autosaves every 30 seconds and when the tab is hidden or closed. The Settings button in the header opens the motion switches, the world seed, the loot filter and the save tools: export the save as text, import one, or start a new world. Only one tab can play at a time.

## The original

The 2013 original lives in `legacy/` (open `legacy/index-dev.html`).
