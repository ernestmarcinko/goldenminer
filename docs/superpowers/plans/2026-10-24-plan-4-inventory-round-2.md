# Golden Miner — Plan 4: Inventory, Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the inventory handle like an ARPG:
- items keep the positions players give them;
- everything can be dragged and dropped, or tapped and placed on a phone;
- the stash has General, Gems and Maps tabs;
- gems become five size grades that stack;
- hovering gear shows the worn item's full card beside it;
- equipping into an empty slot is confirmed with a toast and a green slot.

Dialogs also start keeping keyboard focus inside them.

**Architecture:**
- Bags and the General stash tab become fixed grids of cells (`Item | null`). The Gems tab is a table of counts per gem type and grade.
- Gems become `{ gem, grade }`. In bags they are stacks with a `count`. In sockets they are plain `{ gem, grade }`.
- The save moves to schema 4, and old saves migrate.
- Every move is a pure core function addressed by an `ItemLoc`, which names a bag cell, a General cell, a Gems-tab stack or a worn slot. One dispatcher, `dropItem`, decides what a drop means.
- The UI layers mouse dragging and tap-to-place on the same dispatcher. The action card still covers every move for keyboard users.

**Tech Stack:** unchanged: Node 24, TypeScript 7, Vite 8, React 19, Vitest 5 (node environment, no DOM), lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-round-2-seeds-procedural-inventory-design.md` §7 (Inventory, round 2), and §8 for the plan order. It amends `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md`. Mockups are at https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR:
- `.superpowers/mockups/project/Settings.dc.html`: the Equipped card and the equip toast;
- `Inventory.dc.html`: stash tabs, gem stacks, dragging, and tap-to-move.

**Builds on:** `dev-ernest` at `4e60c62` (Plan 3, PR #3). The save schema is currently 3.

**Roadmap:**
1. Foundation
2. Items
3. Seeds and the mine
4. **Inventory, round 2** (this plan)
5. Maps, combat and levels
6. Passive web
7. Merchant and crafting
8. Auto-mapping and ascension
9. Balance and launch

## Global Constraints

- Static site: TypeScript + Vite + React, with no backend and no new npm dependencies. Node 24.
- `tsconfig` is unchanged. Tests run in Vitest's node environment and read fixtures only through `?raw` imports.
- Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call `Date.now()` / `Math.random()`.
- World generation stays a pure function of `(seed, position)` (round-2 spec §3.3). Nothing in this plan touches it.
- **Readable numbers:** every number shown goes through `formatNumber`, `formatRate` or the new `formatCompact` (used for counts in item cells only).
- **No login pressure:** nothing new expires or punishes absence.
- **Saves:**
  - `SCHEMA_VERSION = 4`. Schema 1, 2 and 3 saves migrate.
  - `tests/fixtures/save-schema-3.txt` is a real Plan 3 export, made from the schema-2 fixture after an offline catch-up and one socketed gem. It is committed with this plan. Never regenerate it, or the other fixtures.
- **Phones:** the layout works at 390 px, and every button and click target is ≥ 44 px. Bag and stash cells may stay 52 px.
- **Fonts** as Plan 3. Item names in cards use `Metamorphous`.
- **Motion:**
  - Every animation honours `settings.motion`, and reduced motion turns them all off.
  - The drag ghost follows the pointer, which is direct manipulation and not an animation.
  - The equip toast and the slot highlight appear and disappear without animating.
- Tunable numbers live in `src/core/balance.ts`.
- No `!` non-null assertions in `src/`.
- **Git:** work on `dev-ernest` and stage explicit file paths. Commit messages are short imperative sentences with no Claude/Anthropic attribution of any kind. Never push.

## Review Focus

1. **Old saves full of single gems.** Migrating must never lose or duplicate an item. Every gear id survives. The total number of gems (bag stacks, Gems tab and sockets) equals the old count. Gems held in `overflow` reach the Gems tab. Tests: Task 1, with the real schema-3 fixture and a synthetic save.
2. **Drops that could lose or duplicate items.** The risky ones:
   - swaps across containers;
   - partial stack merges;
   - taking from a 1,000,000 stack into a nearly full bag;
   - dropping on the same cell;
   - socketing the last gem of a stack;
   - unequipping onto a taken cell.

   After any sequence of drops, the set of gear ids and the gem total are unchanged and the save still validates. Test: Task 2, a 2,000-step random-drop property test.
3. **A full bag while digging.** Gem stacks are never chosen by sell-the-worst. New gems never wait in `overflow` and never stop digging. When their Gems-tab slot is at 1,000,000, they are sold. Tests: Task 1.
4. **Touch.** One tap must never equip, sell or move anything. A tap lifts the item and opens its card, a second tap on a target places it, and tapping the item again puts it back. Test: Task 4 (`tapAction`).
5. **Keyboard.** Every move is reachable from the action card:
   - equip and unequip;
   - to stash or bag;
   - to the Gems tab and back;
   - socketing into worn or carried gear.

   Dialogs keep focus inside them and return it on close. Tests: Task 2 (the action lists) and Task 6 (the focus helpers), plus the Task 7 check.

## Decisions this plan makes (my calls; overrule them in review)

- **Data shape:**
  - `bags[set]` is exactly 24 cells.
  - `stash.general` is exactly 60 cells and holds gear only.
  - `stash.gems[type][grade]` is a count of 0–1,000,000.
  - The Maps tab has no data yet; Plan 5 adds it.
- **Gem grades:** Tiny, Small, Big, Giant and Perfect.
  - The grade found depends on the tier: Tiny from tier 1, Small from 4, Big from 7, Giant from 10, Perfect from 15.
  - Each grade's value equals the Plan 2 formula at item levels 2, 5, 8, 12 and 18 (spec §7.4).
  - Sell and salvage values use the same levels, per gem, so a stack is worth count × value.
- **Where a found gem goes:**
  1. topping up an identical stack in the bag (25 per cell);
  2. else the first empty bag cell;
  3. else its Gems-tab slot.

  If that slot holds 1,000,000, the gem is sold. A gem is never held and never stops digging.
- **Sell-the-worst** only considers gear. Gem stacks are never sold to make room.
- **Old saves:**
  - Identical gems in a bag merge into stacks of up to 25. Bag order is kept and the gaps close.
  - Stash gems and held gems go to the Gems tab.
  - A gem's old item level becomes the grade with the same thresholds. A gem at item level 4 becomes Small and gets the level-5 value, so a few socket values shift slightly.
  - Socketed gems keep only their type and grade.
- **Drops:**
  - **Onto an empty cell:** the item moves there.
  - **Onto a taken cell:** the two swap, if each may live in the other's container. Otherwise the drop is refused with a message.
  - **Gem onto an identical stack:** they merge.
  - **Gem onto gear:** it sockets one gem. If the gear has no open socket, the drop is refused.
  - **Onto a tab:** the item goes to that tab's first free place.
  - **Onto the panel's Stash button:** gear goes to General and a gem to Gems.
  - **Onto itself:** nothing happens.
- **Gems tab:**
  - A click takes up to 25 into the shown bag.
  - Alt+click opens the card instead of selling a huge stack at once. The card offers "Sell all" and "Salvage all".
- **Touch:** a tap lifts the item and opens its card, which gains a "Put back" button. Tapping a cell, slot or tab places the item there, and tapping it again puts it back. This replaces Plan 2's "a tap only opens the card": a single tap still never equips, sells or moves anything.
- **Mouse:** a drag starts after 5 px of movement. A click without movement keeps today's shortcuts.
- **The stash dialog** shows the open tab and, beside it, a bag with its own Mining/Battle toggle, so items can be dragged between them. On narrow screens the bag sits below the tab.
- **The compare pair:**
  - On screens at least 900 px wide, the Equipped card sits beside the hovered card, on its left. It may extend left beyond the character panel but stays on screen.
  - On narrower screens, and in the tap card, the Equipped card is stacked below the item's lines.
- **Equip feedback:** equipping into an empty slot, by any route, shows "Equipped <name>" for 2 s and gives the slot a green glow for 2 s. Neither animates.
- **Dialogs (Plan 3 ruling R9):**
  - Tab and Shift+Tab cycle inside the topmost dialog.
  - Escape closes only the topmost dialog.
  - When focus would be lost on close, it returns to whatever had focus when the dialog opened.
- **Plan 2 carry-overs folded into Task 1:**
  - the validator's string lists come from the type unions;
  - `isItem` becomes a type guard;
  - the validator gets limit tests.

---

## File structure

```
src/core/
  cells.ts        NEW  emptyInventory, firstEmpty, filledCount, itemAt, setAt, gemTabItem (cell/loc helpers)
  items.ts, itemData.ts, balance.ts, types.ts, stats.ts, itemGen.ts, loot.ts, dig.ts, newGame.ts   MOD
  inventory.ts    MOD  (Task 1 adapts; Task 2 rewrites to ItemLoc + dropItem)
  save.ts         MOD  schema 4, MIGRATIONS[3], validator
src/store/gameStore.ts   MOD  item methods by ItemLoc, drop, equipNotice
src/ui/
  format.ts                          MOD  formatCompact
  useDialog.ts, dialogStack.ts NEW   focus trap, restore, topmost Escape
  Toast.tsx NEW, App.tsx, app.css    equip toast
  character/
    itemActions.ts, itemView.ts, ItemCard.tsx, ItemGrid.tsx, PaperDoll.tsx, CharacterPanel.tsx,
    StashDialog.tsx, useItemInteractions.tsx, useItemPopover.ts, character.css            MOD
    stashView.ts NEW (pure), GemTab.tsx NEW, dragDrop.ts NEW (pure), useItemDrag.ts NEW
tests/fixtures/save-schema-3.txt   NEW (committed with this plan)
```

---

### Task 1: Gem grades, fixed slots and save schema 4

**Files:**
- Create: `src/core/cells.ts`, `tests/core/cells.test.ts`
- Modify: `src/core/items.ts`, `src/core/itemData.ts`, `src/core/balance.ts`, `src/core/types.ts`, `src/core/stats.ts`, `src/core/itemGen.ts`, `src/core/loot.ts`, `src/core/dig.ts`, `src/core/newGame.ts`, `src/core/inventory.ts`, `src/core/save.ts`, `src/store/gameStore.ts`
- Modify (compile only, same behaviour): `src/ui/character/itemActions.ts`, `itemView.ts`, `ItemGrid.tsx`, `CharacterPanel.tsx`, `StashDialog.tsx`
- Tests: `tests/helpers/items.ts`, `tests/core/loot.test.ts`, `tests/core/inventory.test.ts`, `tests/core/itemGen.test.ts`, `tests/core/save.test.ts`, `tests/core/gearStats.test.ts`, `tests/ui/itemActions.test.ts`, `tests/ui/itemView.test.ts`, `tests/store/gameStore.test.ts`

**Interfaces:**
- **`items.ts`:**
  - `GEM_GRADES = ['tiny', 'small', 'big', 'giant', 'perfect'] as const`, with `GemGrade` derived from it.
  - `interface Gem { gem: GemType; grade: GemGrade }`.
  - `interface GemItem extends Gem { id: number; type: 'gem'; count: number }`. It has no `ilvl`.
  - `GearItem.gems: Gem[]`.
  - `Cell = Item | null`.
- **`balance.ts`:**
  - `GEM_GRADE_LEVEL: Record<GemGrade, number> = { tiny: 2, small: 5, big: 8, giant: 12, perfect: 18 }`.
  - `GEM_GRADE_FROM_TIER: Record<GemGrade, number> = { tiny: 1, small: 4, big: 7, giant: 10, perfect: 15 }`.
  - `GEM_BAG_STACK = 25` and `GEM_STASH_STACK = 1_000_000`.
- **`itemData.ts`:**
  - `GEM_GRADE_LABELS: Record<GemGrade, string>` = Tiny, Small, Big, Giant, Perfect.
  - `gemGradeFor(level: number): GemGrade`: the highest grade whose `GEM_GRADE_FROM_TIER` is ≤ level, and `'tiny'` below 1.
  - `gemName(g: Gem)` returns `` `${GEM_GRADE_LABELS[g.grade]} ${GEM_LABELS[g.gem]}` ``.
  - Remove `GEM_SIZES` and `gemSizeName`.
- **`stats.ts`:** `gemEffect(g: Gem, set)` returns `statRange(stat, GEM_GRADE_LEVEL[g.grade]).max`.
- **`loot.ts`:**
  - `gemSellValue(g: Gem) = GEM_SELL_GOLD × GEM_GRADE_LEVEL[grade]`.
  - `gemSalvageValue(g: Gem) = GEM_SALVAGE_DIAMONDS × (1 + ⌊level / 5⌋)`.
  - `sellValue(item)` and `salvageValue(item)`: a `GemItem` is worth per-gem × `count`. Gear is worth what it is today, plus one per-gem value for each socketed gem.
  - `itemsIn` is removed.
- **`types.ts`:**
  - `GameState.bags: Record<GearSet, Cell[]>`.
  - `GameState.stash: { general: (GearItem | null)[]; gems: Record<GemType, Record<GemGrade, number>> }`.
  - `overflow: { bag: GearSet; item: GearItem }[]`.
  - String unions become arrays plus derived types, so `save.ts` validates against the same lists:
    - `FEATURE_KINDS`, with `FeatureKind`;
    - `LOOT_OUTCOMES`, with `LootOutcome`;
    - `LOOT_ACTIONS`, with `LootAction`;
    - `BAG_FULL_MODES`, with `BagFullMode`.
- **`cells.ts`:**
  - `emptyInventory(): Pick<GameState, 'equipped' | 'bags' | 'stash' | 'overflow'>`, all empty, with grids of `null` and a Gems tab of zeros.
  - `firstEmpty(cells: readonly Cell[]): number`, which returns −1 when there is none.
  - `filledCount(cells)`.
- **`itemGen.rollGem(state, tier)`** returns `{ id: state.nextId++, type: 'gem', gem: <uniform>, grade: gemGradeFor(tier), count: 1 }`. It makes the same `rng` draws as today.
- **`loot.receiveItem`** follows the rules in Decisions. A gem goes:
  1. into an identical stack in `gemBag` with room;
  2. else into the first empty cell of `gemBag`;
  3. else into the Gems tab, with outcome `'stash'`;
  4. else it is sold.

  Gear goes into the first empty cell of its own bag, else the first empty General cell, else it is held (`'stop'`, up to `MAX_OVERFLOW`), else sell-the-worst runs. Sell-the-worst picks among gear only, in the bag and General, and the new item takes the sold item's cell. `drainOverflow` uses the same stowing.
- **`inventory.ts` (temporary, replaced in Task 2):** keep today's signatures, working on cells.
  - `equip` leaves the worn item in the source cell, or `null`.
  - `unequip` puts the item in the first empty cell.
  - `moveItem(from, index, 'stash')` sends gear to the first empty General cell and a gem stack to the Gems tab.
  - `socketGem` takes one gem from a stack.
- **`save.ts`:**
  - `SCHEMA_VERSION = 4`.
  - `MIGRATIONS[3]` follows the old-save rules in Decisions, merging stacks in bag order. It returns its input unchanged unless `bags.mining`, `bags.battle`, `stash` and `overflow` are arrays and `equipped` is an object.
  - The validator checks:
    - bags of exactly 24 cells, where gear belongs to that set and gem stacks have a count of 1–25;
    - a General tab of exactly 60 cells, holding gear only;
    - a Gems tab with exactly the 5 × 5 keys and integer counts of 0–1,000,000;
    - socketed gems of `{ gem, grade }`;
    - overflow of gear only.

    `isItem` becomes `x is Item`.
- **UI (compile only):**
  - `ItemGrid` takes `readonly Cell[]`.
  - Bag and stash counts use `filledCount`.
  - `StashDialog` shows `stash.general`. The Gems tab is not visible until Task 3.

- [ ] **Step 1: Add the fixture.** `tests/fixtures/save-schema-3.txt` is committed with this plan; check it exists. Update `tests/helpers/items.ts`: `gem(s, type = 'ruby', p = {})` returns `{ id: s.nextId++, type: 'gem', gem: type, grade: 'tiny', count: 1, ...p }`.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/core/cells.test.ts
import { expect, it } from 'vitest';
import { emptyInventory, filledCount, firstEmpty } from '../../src/core/cells';
import { gemGradeFor, gemName } from '../../src/core/itemData';
import { gemEffect } from '../../src/core/stats';
import { salvageValue, sellValue } from '../../src/core/loot';

it('gems come in five grades by tier', () => {
  expect([0, 1, 3, 4, 6, 7, 9, 10, 14, 15, 40].map(gemGradeFor)).toEqual(
    ['tiny', 'tiny', 'tiny', 'small', 'small', 'big', 'big', 'giant', 'giant', 'perfect', 'perfect']);
  expect(gemName({ gem: 'starstone', grade: 'giant' })).toBe('Giant Starstone');
  expect((['tiny', 'small', 'big', 'giant', 'perfect'] as const).map((grade) => gemEffect({ gem: 'starstone', grade }, 'mining').value))
    .toEqual([6, 12, 18, 26, 38]);
  expect(sellValue({ id: 1, type: 'gem', gem: 'ruby', grade: 'big', count: 3 })).toBe(480);
  expect(salvageValue({ id: 1, type: 'gem', gem: 'ruby', grade: 'perfect', count: 2 })).toBe(16);
});

it('an empty inventory is fixed grids', () => {
  const inv = emptyInventory();
  expect([inv.bags.mining.length, inv.bags.battle.length, inv.stash.general.length]).toEqual([24, 24, 60]);
  expect(inv.stash.gems.ruby).toEqual({ tiny: 0, small: 0, big: 0, giant: 0, perfect: 0 });
  expect([firstEmpty(inv.bags.mining), filledCount(inv.bags.mining), firstEmpty([{ id: 1, type: 'gem', gem: 'ruby', grade: 'tiny', count: 1 }])])
    .toEqual([0, 0, -1]);
});
```

```ts
// tests/core/loot.test.ts: add (adapt the file's existing tests to cells; keep their intent)
it('found gems stack in the bag, then go to the Gems tab, and never wait', () => {
  const s = newGame(1, 0);
  s.bags.mining[3] = gem(s, 'ruby', { count: 24 });
  receiveItem(s, gem(s, 'ruby'), 'mining');
  expect(s.bags.mining[3]).toMatchObject({ count: 25 });
  receiveItem(s, gem(s, 'ruby'), 'mining');
  expect(s.bags.mining[0]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 1 });
  s.bags.mining = s.bags.mining.map((c, i) => c ?? gear(s, i % 2 ? 'pickaxe' : 'boots'));
  s.settings.bagFull = 'stop';
  expect(receiveItem(s, gem(s, 'emerald'), 'mining')).toEqual([expect.objectContaining({ outcome: 'stash' })]);
  expect(s.stash.gems.emerald.tiny).toBe(1);
  s.stash.gems.emerald.tiny = 1_000_000;
  const gold = s.gold;
  expect(receiveItem(s, gem(s, 'emerald'), 'mining')).toEqual([expect.objectContaining({ outcome: 'sold', value: 40 })]);
  expect(s.gold).toBe(gold + 40);
  expect(s.overflow).toEqual([]);
});

it('sell-the-worst never sells a gem stack', () => {
  const s = newGame(1, 0);
  s.bags.mining = s.bags.mining.map(() => gem(s, 'ruby', { count: 25 }));
  s.stash.general = s.stash.general.map(() => gear(s, 'pickaxe', { rarity: 'legendary' }));
  const notes = receiveItem(s, gear(s, 'boots', { rarity: 'normal' }), 'mining');
  expect(notes).toEqual([expect.objectContaining({ outcome: 'sold' })]);
  expect(s.bags.mining.every((c) => c?.type === 'gem' && c.count === 25)).toBe(true);
  const n = gear(s, 'boots', { rarity: 'normal' });
  s.bags.mining[7] = n;
  receiveItem(s, gear(s, 'gloves', { rarity: 'magic' }), 'mining');
  expect(s.bags.mining[7]).toMatchObject({ slot: 'gloves' });
});
```

```ts
// tests/core/save.test.ts: add (import fixture3 from '../fixtures/save-schema-3.txt?raw', and decompressFromBase64 from 'lz-string')
it('migrates a real schema-3 save: gems become graded stacks in fixed slots', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s).toMatchObject({ worldSeed: '9090', worldGen: 1, gold: 81_754, diamonds: 1_170, nextId: 248 });
  const label = (c: Cell) => (c === null ? null : c.type === 'gem' ? `${c.gem}×${c.count}` : c.slot);
  expect(s.bags.mining.map(label)).toEqual([
    'boots', 'starstone×7', 'amethyst×4', 'lamp', 'sapphire×3', 'boots', 'boots', 'emerald×1', 'pickaxe', 'pickaxe',
    'lamp', 'gloves', ...Array(12).fill(null)]);
  expect(s.bags.battle.filter((c) => c !== null).map((c) => c.id)).toEqual([15, 43, 82]);
  expect(s.stash.general).toHaveLength(60);
  expect(s.stash.general.filter((c) => c !== null).map((c) => c.id)).toEqual([168, 172, 215, 218, 236]);
  expect(s.stash.gems).toMatchObject({
    ruby: { tiny: 3 }, emerald: { tiny: 3 }, amethyst: { tiny: 1 }, starstone: { tiny: 1 }, sapphire: { tiny: 1 } });
  expect(s.equipped.mining.pickaxe?.gems).toEqual([{ gem: 'starstone', grade: 'tiny' }]);
});

it('migration keeps every gem and every gear id', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(r.reason);
  const total = (st: GameState) =>
    [...st.bags.mining, ...st.bags.battle].reduce((n, c) => n + (c?.type === 'gem' ? c.count : 0), 0)
    + Object.values(st.stash.gems).reduce((n, g) => n + Object.values(g).reduce((a, b) => a + b, 0), 0)
    + Object.values(st.equipped.mining).reduce((n, it) => n + (it?.gems.length ?? 0), 0);
  expect(total(r.state)).toBe(25);   // the old save holds 15 bag gems, 9 stash gems and 1 socketed gem
});

it('old held gems reach the Gems tab, and 24 identical gems become one stack', () => {
  const env = JSON.parse(decompressFromBase64(fixture3.trim()));   // the real schema-3 envelope, before migration
  const old = env.state;
  old.bags.battle = Array.from({ length: 24 }, (_, i) => ({ id: 249 + i, type: 'gem', gem: 'ruby', ilvl: 1 }));
  old.overflow = [{ bag: 'mining', item: { id: 248, type: 'gem', gem: 'emerald', ilvl: 5 } }];
  old.nextId = 273;
  const r = decodeSave(raw(env));
  if (!r.ok) throw new Error(r.reason);
  expect(r.state.bags.battle[0]).toEqual({ id: 249, type: 'gem', gem: 'ruby', grade: 'tiny', count: 24 });
  expect(r.state.bags.battle.slice(1).every((c) => c === null)).toBe(true);
  expect(r.state.stash.gems.emerald.small).toBe(1);
  expect(r.state.overflow).toEqual([]);
});
```

Also in `tests/core/save.test.ts`:
- Update the schema-1 fixture test's empty-inventory expectation to `emptyInventory()`'s shape. This is a value change, not a plan-authored value of this plan.
- Add validator limit tests. These must be valid:
  - full bags and a full General tab;
  - 10 held items;
  - 20 loot rules;
  - gear with 3 sockets and 3 gems;
  - a Gems-tab count of 1,000,000.

  These must be invalid:
  - 25 cells;
  - a stack of 26;
  - a gem in General;
  - battle gear in the mining bag;
  - a Gems-tab count of 1,000,001;
  - a socketed gem with an unknown grade;
  - a held gem.

- [ ] **Step 3: Run them and check they fail** (`npx vitest run tests/core`). They should fail on the missing `cells` module and the schema version.
- [ ] **Step 4: Implement** the interfaces above. Then update the existing tests in the listed files to the cell model, keeping each test's intent; where a test counted `bags[set].length`, count with `filledCount`.
- [ ] **Step 5: Run `npm test`, `npm run typecheck` and `npm run build`.** All must be green. Run the dev app once and check that the bag shows items and gaps, and that the panel's counts are right.
- [ ] **Step 6: Commit** with the message "Grade and stack gems, keep item positions, and move saves to schema 4".

---

### Task 2: Moving items by location

**Files:**
- Modify: `src/core/types.ts`, `src/core/cells.ts`, `src/core/inventory.ts`, `src/store/gameStore.ts`, `src/ui/character/itemActions.ts`, `src/ui/character/useItemInteractions.tsx`, `src/ui/character/ItemCard.tsx`
- Tests: `tests/core/inventory.test.ts` (rewritten), `tests/ui/itemActions.test.ts`, `tests/store/gameStore.test.ts`

**Interfaces:**
- **`types.ts`:**
  - ```ts
    export type ItemLoc =
      | { where: 'bag'; set: GearSet; index: number }
      | { where: 'stash'; index: number }                   // a General-tab cell
      | { where: 'gems'; gem: GemType; grade: GemGrade }    // a Gems-tab stack
      | { where: 'worn'; slot: Slot };
    export type DropTarget = ItemLoc | { where: 'stashTab'; tab: 'general' | 'gems' | 'auto' };
    ```
  - `InvResult` adds `'wrongSet' | 'wrongSlot' | 'gemsOnly' | 'gearOnly' | 'stackFull'`.
- **`cells.ts`:**
  - `itemAt(state, loc): Item | undefined`. A Gems-tab loc returns a virtual stack `{ id: 0, type: 'gem', gem, grade, count }` when the count is above 0.
  - `sameLoc(a, b): boolean`.
- **`inventory.ts`** (each returns `InvResult` and calls `refillAhead` whenever worn gear changes). These replace Task 1's temporary functions; the rules are those in Decisions.
  - `equip(state, from: ItemLoc)` takes gear from a bag or General cell. The worn item goes back into that cell.
  - `unequip(state, slot, to?: ItemLoc)`:
    - with no `to`, the item goes to the first empty cell of its set's bag (`'bagFull'` if there is none);
    - an empty bag or General cell takes it;
    - a cell holding gear for the same slot swaps;
    - any other gear gives `'wrongSlot'`, and a gem gives `'invalid'`;
    - the other set's bag gives `'wrongSet'`, and the Gems tab gives `'gemsOnly'`.
  - `moveItem(state, from, to)` is cell to cell. It covers move, swap and stack merge (25 cap, any leftover stays), Gems-tab put (1,000,000 cap) and Gems-tab take (up to 25). The errors are:
    - `wrongSet` (gear into the other set's bag);
    - `gearOnly` (a gem into General);
    - `gemsOnly` (gear into the Gems tab);
    - `stackFull`;
    - `invalid` (a Gems-tab take onto a cell holding something else, or any worn loc).

    `from` equal to `to` gives `'ok'` and changes nothing.
  - `sendItem(state, from, to: 'stash' | GearSet)` is the click and card shortcut:
    - with `'stash'`, gear goes to the first empty General cell, a gem stack goes to the Gems tab, and worn gear is unequipped into General;
    - with a set, General gear goes to its own set's bag, and Gems-tab gems go to that set's bag. Up to 25 move: existing stacks are topped up in cell order, then one new cell takes the rest.
  - `socketGem(state, gem: ItemLoc, into: ItemLoc)` takes one gem from a bag stack or a Gems-tab stack. It sockets it into worn gear, or gear in a bag or General cell.
  - `sell(state, from)` and `salvage(state, from)` work on bag and General cells (a whole stack) and on Gems-tab stacks (all of them).
  - `dropItem(state, from, to: DropTarget)` dispatches as Decisions says:
    - onto a worn slot it equips or sockets;
    - from worn it unequips;
    - a gem onto a gear cell sockets;
    - `stashTab` and `'auto'` work as `sendItem(…, 'stash')`, with tab checks: gear on Gems gives `gemsOnly`, and a gem on General gives `gearOnly`;
    - anything else is `moveItem`.
- **`GameStore`:**
  - Methods: `equip(from)`, `unequip(slot, to?)`, `moveItem(from, to)`, `sendItem(from, to)`, `socketGem(gem, into)`, `sell(from)`, `salvage(from)`, `drop(from, to)`, each through `settle`.
  - `get equipNotice(): EquipNotice | null`, where `EquipNotice = { id: number; slot: Slot; name: string }`. Any method that leaves a previously empty slot filled sets a new notice, with the id counting up from 1. Task 5 shows it.
- **`itemActions.ts`:**
  - `ItemTarget` becomes an alias of `ItemLoc`.
  - Actions:
    - **Bag gear:** Equip, Sell, Salvage, To stash.
    - **Bag gem stack:** Socket into … (worn first, then carried gear with an open socket, labelled `… (bag)` / `… (stash)`), Sell, Salvage, To Gems tab.
    - **General gear:** Equip, To bag, Sell, Salvage.
    - **Gems-tab stack:** Take to bag (up to 25), Socket into …, Sell all (+N Gold), Salvage all (+N Diamonds).
    - **Worn:** Unequip, To stash.
  - `actionForIntent`:
    - a primary click on bag gear equips, and on General gear moves it to the bag;
    - on a Gems-tab stack it takes;
    - on a bag gem, it opens the menu.
    - `sell` on a Gems-tab stack opens the menu.
  - `resultText` messages:

    | Result | Message |
    |---|---|
    | `wrongSet` | "That gear belongs in the other bag." |
    | `wrongSlot` | "That doesn't fit that slot." |
    | `gemsOnly` | "Only gems go in the Gems tab." |
    | `gearOnly` | "Gems go in the Gems tab." |
    | `stackFull` | "That stack is full." |
    | `invalid` | "That can't go there." |

- [ ] **Step 1: Write the failing tests** (rewrite `tests/core/inventory.test.ts`)

```ts
const bag = (set: GearSet, index: number): ItemLoc => ({ where: 'bag', set, index });
const cell = (index: number): ItemLoc => ({ where: 'stash', index });

it('equip and unequip keep positions and swap', () => {
  const s = newGame(1, 0);
  const a = gear(s, 'pickaxe'); const b = gear(s, 'pickaxe');
  s.bags.mining[5] = a;
  expect(equip(s, bag('mining', 5))).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bags.mining[5]]).toEqual([a, null]);
  s.bags.mining[9] = b;
  expect(dropItem(s, bag('mining', 9), { where: 'worn', slot: 'pickaxe' })).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bags.mining[9]]).toEqual([b, a]);
  expect(dropItem(s, { where: 'worn', slot: 'pickaxe' }, bag('mining', 9))).toBe('ok');   // swap back
  expect(s.equipped.mining.pickaxe).toEqual(a);
  s.bags.mining[2] = gear(s, 'boots');
  expect(unequip(s, 'pickaxe', bag('mining', 2))).toBe('wrongSlot');
  expect(unequip(s, 'pickaxe', bag('battle', 0))).toBe('wrongSet');
  expect(unequip(s, 'pickaxe', { where: 'gems', gem: 'ruby', grade: 'tiny' })).toBe('gemsOnly');
});

it('moves, swaps, merges and refuses', () => {
  const s = newGame(1, 0);
  const p = gear(s, 'pickaxe'); const w = gear(s, 'weapon');
  s.bags.mining[0] = p; s.stash.general[0] = w;
  expect(moveItem(s, bag('mining', 0), bag('mining', 23))).toBe('ok');
  expect(s.bags.mining[23]).toBe(p);
  expect(moveItem(s, cell(0), bag('mining', 23))).toBe('wrongSet');
  expect(moveItem(s, cell(0), bag('battle', 4))).toBe('ok');
  s.bags.mining[1] = gem(s, 'ruby', { count: 20 }); s.bags.mining[2] = gem(s, 'ruby', { count: 10 });
  expect(moveItem(s, bag('mining', 2), bag('mining', 1))).toBe('ok');
  expect([s.bags.mining[1], s.bags.mining[2]]).toEqual([expect.objectContaining({ count: 25 }), expect.objectContaining({ count: 5 })]);
  expect(moveItem(s, bag('mining', 2), bag('mining', 1))).toBe('stackFull');
  expect(moveItem(s, bag('mining', 2), cell(5))).toBe('gearOnly');
  expect(dropItem(s, bag('mining', 23), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(moveItem(s, bag('mining', 2), bag('mining', 2))).toBe('ok');
});

it('the Gems tab takes whole stacks and gives back up to 25', () => {
  const s = newGame(1, 0);
  s.stash.gems.ruby.tiny = 999_990;
  s.bags.battle[3] = gem(s, 'ruby', { count: 25 });
  expect(sendItem(s, bag('battle', 3), 'stash')).toBe('ok');
  expect([s.stash.gems.ruby.tiny, s.bags.battle[3]]).toEqual([1_000_000, expect.objectContaining({ count: 15 })]);
  expect(sendItem(s, bag('battle', 3), 'stash')).toBe('stackFull');
  s.bags.mining[0] = gem(s, 'ruby', { count: 20 });
  expect(sendItem(s, { where: 'gems', gem: 'ruby', grade: 'tiny' }, 'mining')).toBe('ok');
  expect(s.bags.mining[0]).toMatchObject({ count: 25 });
  expect(s.bags.mining[1]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 20 });
  expect(s.stash.gems.ruby.tiny).toBe(999_975);
});

it('a gem dropped on gear sockets one gem', () => {
  const s = newGame(1, 0);
  s.stash.general[4] = gear(s, 'ring', { sockets: 1 });
  s.bags.mining[0] = gem(s, 'sapphire', { grade: 'big', count: 2 });
  expect(dropItem(s, bag('mining', 0), cell(4))).toBe('ok');
  expect(s.stash.general[4]?.gems).toEqual([{ gem: 'sapphire', grade: 'big' }]);
  expect(s.bags.mining[0]).toMatchObject({ count: 1 });
  expect(dropItem(s, bag('mining', 0), cell(4))).toBe('noSocket');
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 2 });
  expect(dropItem(s, bag('mining', 0), { where: 'worn', slot: 'lamp' })).toBe('ok');
  expect(s.bags.mining[0]).toBeNull();
});

it('drops never create or lose items', () => {
  // Start from the migrated schema-3 fixture. Make 2,000 drops from random to random locations, using mulberry32(7):
  //  - from: bag cells of both sets, General cells, Gems-tab stacks, and worn slots;
  //  - to: the same, plus the three stashTab targets.
  // After every drop:
  //  - the multiset of gear ids (bags, General, worn, overflow) is unchanged;
  //  - the gem total (bag stacks, Gems tab, sockets) is unchanged;
  //  - validateState(state) is true.
});
```

```ts
// tests/store/gameStore.test.ts: add
it('equipping into an empty slot leaves a notice; a swap does not', () => {
  const { store } = make();                           // the file's existing store factory
  const s = store.state;
  s.bags.mining[0] = gear(s, 'pickaxe', { name: 'Stonebiter' });
  s.bags.mining[1] = gear(s, 'pickaxe');
  s.bags.mining[2] = gear(s, 'lamp', { name: 'Oil Lamp Helm' });
  expect(store.equipNotice).toBeNull();
  expect(store.equip({ where: 'bag', set: 'mining', index: 0 })).toBe('ok');
  expect(store.equipNotice).toEqual({ id: 1, slot: 'pickaxe', name: 'Stonebiter' });
  expect(store.drop({ where: 'bag', set: 'mining', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('ok');
  expect(store.equipNotice?.id).toBe(1);
  expect(store.drop({ where: 'bag', set: 'mining', index: 2 }, { where: 'worn', slot: 'lamp' })).toBe('ok');
  expect(store.equipNotice).toEqual({ id: 2, slot: 'lamp', name: 'Oil Lamp Helm' });
});
```

`tests/ui/itemActions.test.ts` gets one test per item kind, checking the action ids and labels listed above, plus `actionForIntent` for the Gems tab.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Replace Task 1's temporary functions. Update `runAction` and `useItemInteractions` to the new store methods. The card renders the new actions unchanged.
- [ ] **Step 4: `npm test`, `npm run typecheck` and `npm run build`** must be green.
- [ ] **Step 5: Commit** with the message "Move items by location, with swaps, stacks and sockets".

---

### Task 3: Stash tabs and gem stacks on screen

**Files:**
- Create: `src/ui/character/stashView.ts`, `src/ui/character/GemTab.tsx`, `tests/ui/stashView.test.ts`
- Modify: `src/ui/format.ts`, `src/ui/character/StashDialog.tsx`, `ItemGrid.tsx`, `CharacterPanel.tsx`, `itemView.ts`, `character.css`, `tests/ui/format.test.ts`, `tests/ui/itemView.test.ts`

**Interfaces:**
- **`format.ts`:** `formatCompact(n)` uses `Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })`.
- **`stashView.ts`:**
  - `STASH_TABS = ['general', 'gems', 'maps'] as const` and `StashTab`.
  - `tabLabel(state, tab)`: "General 31 / 60", "Gems" or "Maps".
  - `gemTabRows(state)` returns 5 rows in `GEM_TYPES` order, each `{ gem, label, cells: { grade, count, text }[] }`, where `text = count > 0 ? formatCompact(count) : ''`.
  - `GRADE_HEADERS` holds the five grade labels.
- **`StashDialog({ store, set, onClose })`:**
  - The title is "Stash".
  - A `role="tablist"` row holds the three tabs:
    - `role="tab"` with `aria-selected` and `aria-controls`;
    - ArrowLeft and ArrowRight move between tabs;
    - each tab is ≥ 44 px.
  - The open tab's panel (`role="tabpanel"`):
    - **General:** the 60-cell grid.
    - **Gems:** `GemTab`, a 5 × 5 grid with grade headers and gem labels, where a cell with a count is an `ItemButton` for `{ where: 'gems', gem, grade }`, and an empty cell is dimmed.
    - **Maps:** "No maps yet. Maps are kept here once dungeons open."
  - Beside the panel is a bag column. It has its own Mining bag / Battle bag toggle, starting at `set`, and the 24-cell grid. Both grids share one `useItemInteractions`, whose `shownSet` is the dialog's bag set.
  - At widths under 760 px, the bag column goes below the panel.
  - The status line is shown once.
- **`ItemButton`:** a gem stack with `count > 1` shows a count badge (`formatCompact`, bottom right, `aria-hidden`). The button's label becomes "Tiny Ruby, 12".
- **`itemKindLine` for a gem:** `` `Gem · ${GRADE label} · socket into any gear` ``. A stack over 1 adds `` ` · ${formatNumber(count)} in this stack` ``.
- **The panel's Stash button** reads "Stash N / 60", where N is the number of filled General cells.

- [ ] **Step 1: Failing tests.**
  - `tests/ui/format.test.ts`: `formatCompact(999)` is `'999'`, `formatCompact(1240)` is `'1.2K'`, and `formatCompact(1_000_000)` is `'1M'`.
  - `tests/ui/stashView.test.ts`: on the migrated schema-3 fixture, `gemTabRows`:
    - row 0 is `ruby`, with cells `[{ grade: 'tiny', count: 3, text: '3' }, …zeros with text '']`;
    - `tabLabel(s, 'general')` is `'General 5 / 60'`.
  - `tests/ui/itemView.test.ts`: the gem kind line for a stack of 12 Small rubies.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Follow the `Inventory.dc.html` board for layout and spacing.
- [ ] **Step 4: Check it runs.**
  - `npm test`, `npm run typecheck` and `npm run build` must be green.
  - In the dev app at 1440 px and 390 px: the tabs switch with the mouse and the arrow keys, and the Gems tab shows the imported fixture's counts. Clicking a Gems-tab stack moves up to 25 into the bag.
- [ ] **Step 5: Commit** with the message "Add stash tabs and show gem stacks".

---

### Task 4: Drag and drop, and tap to move

**Files:**
- Create: `src/ui/character/dragDrop.ts`, `src/ui/character/useItemDrag.ts`, `tests/ui/dragDrop.test.ts`
- Modify: `ItemGrid.tsx`, `PaperDoll.tsx`, `GemTab.tsx`, `StashDialog.tsx`, `CharacterPanel.tsx`, `ItemCard.tsx`, `useItemInteractions.tsx`, `character.css`, `README.md` (the Gear section mentions dragging and tapping)

**Interfaces:**
- **`dragDrop.ts` (pure):**
  - `DRAG_THRESHOLD_PX = 5`.
  - `dropAttr(t: DropTarget): string` returns JSON.
  - `parseDrop(attr: string | null): DropTarget | null`. It validates the shape, including set, slot, gem, grade, tab names and integer indexes, and returns `null` for anything else.
  - `tapAction(held: ItemLoc | null, tapped: DropTarget, tappedIsItem: boolean)` returns `{ kind: 'hold' } | { kind: 'release' } | { kind: 'drop'; to: DropTarget } | { kind: 'none' }`:

    | Held | Tapped | Result |
    |---|---|---|
    | nothing | an item | hold |
    | nothing | an empty cell, slot or tab | none |
    | X | X | release |
    | X | anything else | drop |
- **Drop targets:** these carry `data-drop={dropAttr(…)}`:
  - every bag and General cell, empty or not;
  - every paper-doll slot, empty or not;
  - every Gems-tab cell;
  - the General and Gems tab buttons (`{ where: 'stashTab', tab }`);
  - the panel's Stash button (`tab: 'auto'`).

  The Maps tab is not a drop target, so a drop there snaps back.
- **`useItemDrag({ store, onResult })`** is created once in `CharacterPanel` and passed to `StashDialog`. It returns:
  - **`onPointerDown(loc, e)`**, for a mouse or pen, button 0. Past the threshold it starts a drag: it hides the tooltip, closes any card, renders a ghost (a fixed-position sprite with `pointer-events: none`) and marks the hovered drop target with `data-drop-over`. On pointerup it runs `store.drop(from, parseDrop(target under the pointer))` and reports `onResult(resultText(r))`. Dropping on nothing snaps back silently, and so does Escape.
  - **`consumeClick(): boolean`**, which `ItemButton` checks so the click after a drag does nothing.
  - **`held: ItemLoc | null`**, `onTap(tapped: DropTarget, tappedIsItem: boolean): boolean` (true when the tap was used), and `release()`.
  - **On touch,** an item tap that `tapAction` turns into `hold` also opens the card, as today. While an item is held:
    - the held cell shows `data-held` (lifted);
    - tapping a target drops it;
    - the card gets a "Put back" button that calls `release()`;
    - the item stays held when the card closes from an outside tap.
  - **Release** also happens on Escape, on a successful drop, and when the stash tab or a bag set changes.
  - Empty cells and slots get an `onClick` that only does tap drops; they stay out of the tab order.
- **Keyboard clicks** (`detail === 0`) open the card as today and never hold.

- [ ] **Step 1: Failing tests** in `tests/ui/dragDrop.test.ts`:
  - `dropAttr`/`parseDrop` round-trip each `DropTarget` kind;
  - `parseDrop` returns `null` for `'{"where":"bag","set":"magic","index":1}'`, `'{"where":"stash","index":-1}'`, `'nope'` and `null`;
  - `tapAction` covers each row of the table above, plus held X tapping the empty slot `{ where: 'worn', slot: 'boots' }`, which gives a drop.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check it runs.** `npm test`, `npm run typecheck` and `npm run build` must be green. In the dev app (puppeteer is fine), using the mouse:
  - drag bag to bag, bag to slot, slot to bag, bag to the Gems tab button, and a gem onto gear;
  - an invalid drop shows its message and the item stays put;
  - a plain click still equips.

  At 390 px with touch emulation:
  - tap, then tap an empty cell, moves the item;
  - tapping the item again puts it back;
  - a single tap never equips.
- [ ] **Step 5: Commit** with the message "Drag and drop items, and tap to move them on touch screens".

---

### Task 5: The Equipped card, the equip toast and the slot highlight

**Files:**
- Create: `src/ui/Toast.tsx`, `tests/ui/compare.test.ts`
- Modify: `src/ui/character/ItemCard.tsx`, `itemView.ts`, `useItemPopover.ts`, `PaperDoll.tsx`, `CharacterPanel.tsx`, `character.css`, `src/ui/App.tsx`, `src/ui/app.css`

**Interfaces:**
- **`itemView.ts`:**
  - `placeTooltip(anchor, containerWidth, width = TOOLTIP_WIDTH, minLeft = 0)` returns `{ left: max(minLeft, min(anchor.left, containerWidth − width)), top: anchor.top + anchor.height + 4 }`.
  - `CARD_PAIR_GAP = 8`.
  - `cardPairLayout(viewportWidth: number, isMenu: boolean): 'row' | 'column'` returns `'row'` only when the card is not a menu and `viewportWidth >= 900`.
- **`useItemPopover`:** places a hover pair with width `2 × TOOLTIP_WIDTH + CARD_PAIR_GAP` in row layout. `minLeft = 8 − (container's left edge in the viewport)`, so the pair may reach left of the panel but stays on screen.
- **`ItemCard`:** a gear target that is not worn, with a worn item in its slot, renders the worn item's full card headed "Equipped" (name, kind line and lines). The "If equipped" difference lines stay on the hovered card.
  - **Row layout:** the Equipped card comes first, on the left.
  - **Column layout and the menu card:** the Equipped block sits after the lines and before the actions.
- **`Toast.tsx`:** `<Toast store />` is mounted once in `App`. It renders `role="status"` with "Equipped <name>", where the name is coloured by rarity. It shows each new `equipNotice.id` for `EQUIP_TOAST_MS = 2000` and has no animation.
- **`PaperDoll`:** a `flashSlot: Slot | null` prop, which `CharacterPanel` derives from `equipNotice` for 2 s, sets `data-flash` on that slot. The CSS gives it a static green glow (box-shadow), as in the Settings board.

- [ ] **Step 1: Failing tests** in `tests/ui/compare.test.ts`:
  - `placeTooltip({ left: 100, top: 0, width: 52, height: 52 }, 388, 548, -900)` is `{ left: -160, top: 56 }`;
  - with `minLeft = -50` the left is `-50`;
  - `cardPairLayout(1440, false)` is `'row'`, and `cardPairLayout(1440, true)` and `cardPairLayout(390, false)` are both `'column'`.
- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check it runs.** `npm test`, `npm run typecheck` and `npm run build` must be green. In the dev app:
  - hovering a bag pickaxe while one is worn shows both cards, the Equipped one on the left and fully on screen;
  - at 390 px the tap card stacks them;
  - equipping into an empty slot shows the toast and the green slot for about 2 s;
  - a swap shows neither.
- [ ] **Step 5: Commit** with the message "Show the equipped item beside the compared one and confirm equips".

---

### Task 6: Dialogs keep focus

**Files:**
- Create: `src/ui/dialogStack.ts`, `tests/ui/dialogStack.test.ts`
- Modify: `src/ui/useDialog.ts` and its callers: `OfflineSummary.tsx`, `character/LootFilterDialog.tsx`, `character/StashDialog.tsx`, `settings/SettingsDialog.tsx`, `settings/SaveDialog.tsx`, `settings/NewWorld.tsx`

**Interfaces:**
- **`dialogStack.ts` (pure, module state):**
  - `pushDialog(id: number)`, `popDialog(id: number)`, `isTopDialog(id: number): boolean` and `nextDialogId()`.
  - `nextFocusIndex(count: number, current: number, backwards: boolean): number` cycles: from the last element forward it returns 0, and from 0 (or −1) backwards it returns `count − 1`.
- **`useDialog<T>(onClose, dialogRef: RefObject<HTMLElement | null>)`** returns the focus ref, as today.
  - On mount it pushes onto the stack, focuses `T`, and remembers `document.activeElement`.
  - Escape closes the dialog only when it is on top.
  - Tab and Shift+Tab, when it is on top, move among the dialog's focusable descendants using `nextFocusIndex`, with `preventDefault`. "Focusable" means: enabled buttons, inputs, selects and textareas, `[href]`, and `[tabindex]` not equal to −1.
  - On unmount it pops, then, after a `setTimeout(0)`, focuses the remembered element only if `document.activeElement` is `body` or `null` and that element is still connected.
- **Every caller** passes its dialog element's ref. The Settings sub-dialogs keep their own focus handover.

- [ ] **Step 1: Failing tests** in `tests/ui/dialogStack.test.ts`:
  - push 1 and 2: `isTopDialog(2)` is true and `isTopDialog(1)` is false;
  - pop 2: `isTopDialog(1)` is true;
  - popping an id that isn't on top removes only that id;
  - `nextFocusIndex(3, 2, false)` is 0, `nextFocusIndex(3, 0, true)` is 2, `nextFocusIndex(3, -1, false)` is 0 and `nextFocusIndex(0, -1, false)` is −1.
- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check it runs.** `npm test`, `npm run typecheck` and `npm run build` must be green. In the dev app with the keyboard:
  - Tab cycles inside Settings, the stash and New world, and never reaches the page behind;
  - Escape on an open action card inside the stash closes only the card;
  - closing the stash returns focus to the Stash button;
  - closing Settings returns it to the header's Settings button.
- [ ] **Step 5: Commit** with the message "Keep keyboard focus inside dialogs and return it on close".

---

### Task 7: Final check

- [ ] **Step 1: Smoke check** on desktop and at 390 px (puppeteer with touch emulation):
  - **Old saves:** import `tests/fixtures/save-schema-3.txt` and then `save-schema-2.txt`. Both load, and the bag shows merged gem stacks with count badges. The Gems tab shows the stash gems. The socketed starstone reads "Tiny Starstone: +6 dig power".
  - **Digging into a full bag:** gems keep arriving in the Gems tab, digging never stops for a gem, and gear still follows the bag-full setting.
  - **Every drag in the spec (§7.2):**
    - bag to bag, swap and merge;
    - bag to slot, and slot to bag;
    - onto each stash tab, and onto the open tab's grid;
    - a gem onto worn and carried gear.

    Invalid drops show a message and snap back.
  - **Touch:** tap to lift, tap to place, tap again to put back, and "Put back".
  - **Compare and equip:** the compare pair, the toast and the slot highlight. Reduced motion changes nothing visible here, since none of them animate.
  - **Keyboard only:** every move through the action card, with focus kept in the dialogs.
  - **Earlier plans:** the Plans 1–3 checks still pass (digging, the shaft, Settings, export and import).
- [ ] **Step 2: Fix anything found**, then run `npm test && npm run typecheck && npm run build`.
- [ ] **Step 3: Commit**, only if changes were needed: "Fix issues found in the inventory check".
