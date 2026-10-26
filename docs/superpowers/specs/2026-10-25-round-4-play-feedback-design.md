# Golden Miner, round 4: pausing, one Inventory view, logs, merchants, harder maps

- **Date:** 2026-10-25
- **Status:** the decisions are Ernest's (2026-10-25). Plan 10's content proposals (§9–§12) get confirmed before Plan 10 is built.
- **Amends:** the main spec, round 2 and round 3 (`2026-10-24-round-3-economy-inventory-crafting-design.md`). Where they disagree, this document wins.
- **Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Round 4".
- **Built so far:** Plans 1–8 (Plan 8 merged as PR #8).

Marking follows the earlier specs:
- **(decided)** is Ernest's choice.
- **(my call)** is the designer's default and can be overruled.
- **(proposed)** is a Plan 10 proposal to confirm first.

## 1. Why

Ernest played Plans 6–8 and listed twelve problems:
1. Mining can't be paused.
2. Right-clicking a gem lists every socket.
3. Alt+click sells, but salvage is the more common action.
4. Hover cards near the bottom of the bag are cut off.
5. The stash pop-up clips hover cards and is cramped.
6. Maps vanish into the stash, and the Maps tab is not split by tier.
7. There is no record of drops or deaths.
8. Modifier tiers sit in front of the text instead of on the right, in grey, as in PoE2.
9. The merchant is a menu, not a character, and sells nothing.
10. Legendaries only have bigger numbers.
11. Maps are too easy.
12. The loot filter is too basic.

He wants the player kept engaged: finds land in the bag, and the player decides what happens to them.

## 2. Goals, non-goals, anti-goals

**Goals**
- The player controls when digging runs (decided).
- Every find is visible: it lands in the bag, and the drop log says what became of it (decided).
- One roomy Inventory view replaces the side panel and the stash pop-up (decided).
- Maps are a real challenge, and enchanting them is a gamble on difficulty for reward (decided).

**Non-goals**
- A backend, trading, or player shops.

**Anti-goals**
- **Losing a find silently.** Anything that doesn't fit is held, and if it can't be held, the log says exactly what happened to it.
- **Punishing absence.** A closed or hidden game still digs, unless the player pressed Pause. The one exception is a full bag: it stops digging, even offline. That is Ernest's choice, so that the player comes back to sort the bag (decided 2026-10-25).
- **Changing what a seed generates.** The merchants' names and looks are fixed, the same in every world.

## 3. Pausing (decided)

- **The Pause button.** The Mine view gets a **Pause digging / Continue digging** button. The player's choice is saved, and a paused game stays paused after a reload.
- **Views pause digging.** Digging runs only while the Mine view is on screen. Opening Inventory, Merchant or Log, or running a map, pauses it. Going back to Mine resumes it, unless the player had pressed Pause.
- **Paused time is lost, not banked.** Time spent paused, whether by the button or by another view, is skipped. It is never caught up later.
- **Hidden or closed counts as idle (decided).** When the browser tab is hidden or the game is closed, offline catch-up digs as today, up to the offline cap, unless the player pressed Pause. The view the player left the game on doesn't matter.
- **Pause only stops digging (my call).** A map run never pauses. It keeps fighting while the player is in another view or away, and offline catch-up plays it to the end, as today. If the player pressed Pause, the time left after the run ends is not dug.
- **When a run ends,** the result dialog shows. Closing it returns to the Mine view, which resumes digging unless the player pressed Pause (my call).
- **Status line.** The Mine view shows one status line:
  - while digging: `1.3 m/min · next metre in 42 s`;
  - while paused by the button: `Paused. Press Continue digging to dig on.`;
  - while the bag is full: `Your bag is full. Make room to dig on.`

## 4. Inventory (decided)

### 4.1 One Inventory view
- **Nav:** **Mine | Inventory | Merchant | Log**. While a map runs, a **Run** tab comes first and opens the fight.
- **The Maps tab and its list are gone.** Maps run from their card, wherever they are.
- **The Mine view** shows the shaft, the minimap, the finds feed and the status line. The side panel is gone.
- **The Inventory view** has three columns: the paper doll with its stats, the bag, and the stash with its tabs. On a phone they stack in one column.
- **During a run** the Inventory can be used, and the run keeps going.
- **The stash pop-up is removed.**
- **The Last-run card** leaves the removed Maps view and moves to the top of the Log view (my call).

### 4.2 Every find goes to the bag (decided)
- **What lands in the bag.** Gear, gems, maps and materials found by digging or in maps all go to the bag:
  - materials stack 50 to a cell, filling existing stacks first;
  - gems stack as today;
  - nothing goes to the stash on its own.
- **The loot filter still acts first.** A find it sells or salvages never reaches the bag, and the drop log records it.
- **When the bag is full:**
  - The find is held, as gear is held today, and digging stops until there is room. Held finds move into the bag as soon as space frees.
  - Any kind of item can be held, up to **60 held finds** (my call).
  - Beyond that, which can only happen during a long map run, gear, gems and maps are sold and materials go to the Materials tab. The drop log says so for each.
- **Maps can be sold and salvaged (my call).**
  - A map sells for `25 × tier²` Gold, × 1.5 if magic and × 2.5 if rare.
  - It salvages into Copper ore, plus Tin ore from tier 3. The amounts grow with the tier, as gear's do.
  - Materials can't be sold. They are crafting currency.
- **The "sell the worst item" mode is removed (my call).** A full bag always holds. Saves set to it switch to holding.
- **Already-stashed items stay where they are.**

### 4.3 The Map stash by tier (decided)
- **Layout.** The Maps tab has a row of tier buttons, each with its count (`T4 · 12`). The selected tier's maps show in a grid.
  - Maps sort by rarity (rare first), then newest first (my call).
- **Room.** The Map stash holds **up to 200 maps per tier** (my call). It has no pages and no price.
  - Gold already spent on Maps pages is refunded when the save upgrades (my call).
- **Moving maps in.** A map moved to the stash goes to its tier. Shift+click, drag, and the card's move action all work. When a tier is full, the move is refused with `The tier N maps are full.`.
- **Running.** A map runs from its card, from the bag or from the Map stash.

### 4.4 Hover cards are never cut off (decided)
- **Placement.** Hover and action cards are placed on the page itself, not inside the scrolling panel that holds the grid, so no container clips them.
- **Room.** A card opens upward when there is more room above, and it always stays inside the screen.
- **Pointer safety.** Plans 7 and 8 keep the clicked craft under the pointer. That still holds, and the click sweeps repeat in the new layout.

## 5. Shortcuts and item cards (decided)

- **Click shortcuts:**
  - click: the item's card;
  - right-click: the action card;
  - Shift+click: move between bag and stash;
  - **Alt+click: salvage**;
  - **Ctrl+click: sell (Cmd+click on a Mac)**, because Ctrl+click opens the context menu there.
- **Hover card values.** The hover card shows both values and the shortcut line:
  - `Sells for 72 Gold · Salvages into 2 Copper ore, 1 Tin ore`;
  - `Ctrl+click sell · Alt+click salvage · Shift+click move` (with ⌘ on a Mac).
- **Gems.** A gem's action card no longer lists sockets. It says `Drag it onto an item with a free socket to socket it.` and keeps its other actions.
- **Tiers on the right.** Every modifier line shows its tier at the right edge in grey, as in PoE2:
  - `+12 dig power` on the left, `T3` on the right;
  - crafted lines keep their `(crafted)` mark;
  - map modifiers do the same.

## 6. Logs (decided)

The Log view has two tabs, **Drops** and **Deaths**. Both are saved.

- **Drops:**
  - **One entry per find,** newest first. It shows:
    - the item, in its rarity colour;
    - where it came from (`312 m`, or `Tier 4 map, room 3`);
    - the trail of what happened to it.
  - **Example trail:** `to bag → stashed → sold (+72 Gold)`.
  - **Trail events:**
    - to bag;
    - held;
    - loot filter sold or salvaged;
    - stashed;
    - moved to bag;
    - equipped;
    - sold;
    - salvaged;
    - crafted;
    - run (for maps);
    - lost (a map lost on death).
  - **Material and gem finds** are one entry each (`+3 Iron ore → bag`), with no trail, because they merge into stacks (my call).
  - **Bought and gambled items** get their own entry, with the merchant as where they came from (`Merchant`), and a trail from there on (my call).
  - **The 300 newest entries are kept** (my call).
- **Deaths:**
  - **One entry per death.** It records:
    - when it happened;
    - the map (name, tier, rarity and modifiers);
    - the room;
    - the monster that dealt the killing blow;
    - what was lost (the map).
  - **The 50 newest are kept** (my call).
  - **The run result dialog** links to the entry.

## 7. Old saves (my call)

Schema 8 → 9:
- The game is not paused, and both logs start empty.
- The held list accepts any item, and old held gear stays held.
- Maps-tab pages become the tier-based Map stash. Every map is kept, and the Gold spent on Maps pages is refunded.
  - If a tier would go over 200, the extra maps move to the bag, or are held.
- A `sellWorst` bag setting becomes `stop`.

## 8. The plan sequence (decided)

- **Plan 9, play feedback I:**
  - pausing (§3);
  - the Inventory view, every find to the bag, the Map stash by tier, and unclipped cards (§4);
  - shortcuts and cards (§5);
  - logs (§6);
  - migration (§7).
- **Plan 10, play feedback II:**
  - the two merchants (§9);
  - legendary uniques (§10);
  - harder maps with special modifiers (§11);
  - the extended loot filter (§12).
- **Later plans:**
  - Plan 11: the passive web (it was Plan 9);
  - Plan 12: auto-mapping and ascension;
  - Plan 13: balance and launch.

## 9. Two merchants (decided; details proposed)

- **Two characters.** The Merchant view shows two characters, each with a pixel-art portrait and a name. The names and portraits are the same in every world.
  - **Brannoc the Trader** sells items.
  - **Old Mirela** runs the gambling from Plan 8.
- **The Trader's stock** is 12 items, shown in a grid with hover cards and a buy button each (proposed).
  - The stock is rolled from the world seed and the 10 m band of the deepest depth, so it **refreshes every 10 metres dug**.
  - A bought item leaves the stock until the next refresh.
  - Prices are 4× the item's sell value (proposed).
  - The Trader sells gear and maps, never Diamonds or Souls.

## 10. Legendary uniques (decided; list proposed)

Each legendary gains one unique line that no other item can roll, a line that changes how the game plays. The list below is a proposal to confirm:

| Legendary | Unique line |
|---|---|
| Deepdelver (pickaxe) | Every 25th metre is dug at once, and its find is doubled. |
| The Golddigger (gloves) | Gold veins also give a material of the band. |
| Black Lantern (lamp) | Hazards ahead show on the minimap, and hazards slow you by half as much. |
| Long Voyage (boots) | The offline cap is doubled, and catch-up finds are doubled. |
| Band of the Deep (ring) | Critical hits heal 2 % of your life. |
| Wolf Eye (amulet) | Champions and bosses drop one more item. |
| Kraken Leather (armor) | Once per map, a killing blow leaves you at 1 life instead. |
| The Peacemaker (weapon) | Every 5th hit strikes twice. |

## 11. Harder maps (decided; numbers proposed)

- **Tougher monsters.** Monster life and damage in maps rise steeply, aiming at about 40 % of fresh tier-N maps cleared by gear at item level N (proposed). Map modifiers are stronger as well.
- **Special modifiers.** Every Copper, Iron or Silver enchant has a 10 % chance (proposed) to add a special modifier. A map holds at most one, and it doesn't count toward the 6. Proposed specials:
  - `The boss drops a legendary`;
  - `A treasure room before the boss`;
  - `Every pack has a champion`;
  - `Materials drop twice`;
  - `Souls ×3, but rooms don't heal`;
  - `A second boss`.
- **A Void crystal temper** can also add a special (proposed).

## 12. The loot filter (decided; shape proposed)

- **Rules.** A rule matches on any mix of:
  - item kind (gear, gem, map, material);
  - slot;
  - rarity;
  - item level or tier range;
  - having a modifier at or above a tier;
  - number of modifiers;
  - a map's tier, rarity and modifiers;
  - a gem's type and grade;
  - a material's kind.
- **Actions:** keep, sell, salvage, or stash to the matching tab.
- **Order:** rules run top to bottom, and the first match wins.
- **The default filter** matches what today's game does.

## 13. Left to the builder
- Exact layouts, following the Round 4 board.
- The paused-time bookkeeping in the clock, as long as paused time is never caught up.
- How a trail event finds its log entry (by item id).
