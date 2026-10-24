# Golden Miner — Plan 2: Items + Character Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chests and gem finds drop real loot: mining and battle gear with rarities, affixes, sockets
and gems. Worn mining gear changes how the miner digs. The character screen is always open beside the
mine and shows both sets, the bags and the stash. It has hover compare, click to equip, Alt+click to
sell and a loot filter. The plan opens with the shell fixes carried over from Plan 1.

**Architecture:** Items are plain serialisable objects in `GameState`: two worn sets, two bags, a
stash, loot held while there's no room, and settings. So the save moves to schema 2, with a migration
tested against a real schema-1 save. Rolling items, routing loot and inventory actions are pure core
functions that draw from `state.rng`. `deriveStats` folds the worn mining set into the existing
`Stats`, so the clock and digging code keep their shape. The store exposes each inventory action as an
intent. The panel renders from pure view-model functions (`itemView.ts`, `itemActions.ts`) that the
tests cover without a DOM.

**Tech Stack:** unchanged. Node 24, TypeScript 7, Vite 8, React 19, Vitest 5, lz-string, with no new
dependencies.

**Spec:** `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md`:
- §4.6 (gear and items);
- §4.7, for selling and salvaging only;
- §5 (the character screen, plus the loot-filter part of Settings);
- §3.

The look and layout come from `.superpowers/mockups/project/Character.dc.html` and `Main.dc.html`
(git-excluded; published at https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR).

**Builds on:** Plan 1, merged as `da7293f`. Its SDD ledger
(`.superpowers/sdd/2026-10-23-plan-1-foundation-digging/progress.md`) lists the carry-overs that Task 1
fixes.

**Roadmap:** this is plan 2 of 7.
1. Foundation + digging (done)
2. **Items + character screen** (this plan)
3. Maps, combat, levels
4. Passive web
5. Merchant + crafting
6. Auto-mapping + ascension
7. Balance + launch

## Global Constraints

- Static site: TypeScript + Vite + React, no backend, no new dependencies.
- Node 24 (`node -v` prints `v24.`). `engines.node` stays `>=22.12.0`.
- `tsconfig` is unchanged. Tests read fixture files only through Vite `?raw` imports, because there is
  no `@types/node`.
- Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call
  `Date.now()` / `Math.random()`. Time and randomness come in as arguments or from `state.rng`.
- **Readable numbers:**
  - Every number shown goes through `formatNumber` (whole numbers) or the new `formatRate` (rates and
    chances, at most one decimal).
  - Every item stat value is an integer.
  - All growth is linear in item level.
- **No login pressure:** a full bag must not punish being away. `settings.bagFull` defaults to
  `'sellWorst'`.
- Saves:
  - `SCHEMA_VERSION = 2`, and schema-1 saves migrate.
  - A save with an impossible inventory decodes as `invalid` (backed up by the store, never crashing
    the UI).
  - The fixture `tests/fixtures/save-schema-1.txt` is a real export from the schema-1 game (`da7293f`).
    Never regenerate it.
- Phones: the layout works at 390 px width, every button and click target is ≥ 44 px, and the bag grid
  fits without horizontal scrolling.
- Pixel art: integer scaling, `image-rendering: pixelated`, sprites from the atlas. The new item icons
  are copied verbatim from `Character.dc.html`.
- Look: the dark lamp-lit tokens. Rarity colours are normal `#cfc6b8`, magic `#8fb0ff`, rare `#f0d455`,
  legendary `#ff9b45` and gem `#7fd3e8`. Compare colours are better `#6fcf97` and worse `#ff8a7a`.
- `prefers-reduced-motion: reduce` still turns off the floating and popping animations.
- **Where things live:**
  - Tunable numbers go in `src/core/balance.ts`.
  - Item content (names, legendary definitions, gem effects) goes in `src/core/itemData.ts`.
  - A legendary's numbers are either multipliers of the `balance.ts` ranges or fixed rule-changers.
- No `!` non-null assertions in `src/` (tests may use them). Handle `undefined` from index access
  explicitly.
- Git: work on `dev-ernest`. Stage explicit paths only. Commit messages are short imperative sentences
  with **no Claude/Anthropic attribution of any kind**. Never push.

## Review Focus

1. **Bags fill up while the player is away.** Eight offline hours, with the bag and the stash full.
   - By default, digging carries on and only the cheapest items are sold, never worn gear.
   - With "stop digging", digging pauses, nothing is lost, and the offline summary says why.
   - Tests: Task 5, plus the summary line in Task 8.
2. **Old or hand-edited saves.**
   - A schema-1 save loads with nothing worn and keeps playing.
   - A save with impossible items (wrong bag, a shared id, more gems than sockets, a battle stat on a
     pickaxe…) is rejected as `invalid` instead of crashing the panel.
   - Tests: Task 2.
3. **Swapping gear that changes lamp sight or find chances.**
   - A stronger lamp reveals the new metres at once.
   - Taking it off keeps every roll already made, so swapping lamps never re-rolls a metre.
   - The minimap shows only what the current lamp lights.
   - Tests: Tasks 4 and 6.
4. **Extreme gear totals**: dig power far above the rock's hardness, find bonuses past +1000%,
   negative legendary lines. Expected:
   - leftover progress is rescaled per metre;
   - feature chances are capped together and keep their proportions;
   - multipliers never go below zero.
   - Tests: Task 4.
5. **Touch and keyboard players.**
   - A tap only inspects, so it never equips or sells by accident.
   - Every action can be reached by tap and by keyboard.
   - The bag fits at 390 px.
   - Tests: Task 7 (`clickIntent`, `itemActions`), plus the manual 390 px check in Task 8.

## Decisions this plan makes (my calls; overrule them in review)

- **Where loot goes:**
  - Gear goes to the bag of its own set, whatever found it.
  - Gems found while digging go to the mining bag. Gems come from gem finds, and chests hold gear only.
  - When the bag is full, loot overflows into the shared stash.
- **Stash size** starts at 60. The mockup's 120 becomes a merchant upgrade in Plan 5.
- **When the bag and the stash are both full:**
  - "Sell the worst" (the default) sells the cheapest of the new item, its bag and the stash. On a tie
    the new item goes.
  - "Stop digging" holds the item and spends ticks idle until there is room.
- **Gems:**
  - A gem's effect depends on the set it sits in. Ruby gives Gold yield in mining gear and +% damage in
    battle gear.
  - Socketed gems are permanent; taking them out is a Plan 5 crafting option.
- **New games and base stats:** a new game wears nothing. Gear adds to the Plan 1 base stats, so the
  ungeared game and its tests behave as before.
- **Sell and salvage values** are paid directly, with no merchant spread until Plan 5.
- **Battle gear** rolls and shows its stats now, but has no effect until Plan 3.
- **Settings** live in `state.settings`, which Plan 6's ascension keeps. This replaces a full run/meta
  split of `GameState`.
- **Mouse controls:** click equips, Alt+click sells, Shift+click moves to or from the stash, and
  right-click opens an action card with every action. A touch tap and keyboard Enter open the same card.
- **Gold yield** pays fractions through a carry, so Gold stays a whole number.

**Out of scope:**
- **Plan 5:** merchant spread, buying bag or stash space, gambling, crafting, taking gems out.
- **Plan 3:** battle stats in combat, magic find, map and battle-gem drops.
- **Plan 7:** Plan 1's deferred minors #5 and #11–#14.

---

## File structure

```
src/core/
  items.ts         NEW  slots, stats, rarities, gem types, item interfaces, SLOT_IMPLICIT, helpers
  itemData.ts      NEW  base names, affix words, rare name parts, legendaries, gem effects and sizes, item names
  itemGen.ts       NEW  rollRarity, rollGear, rollGem, rollChest
  loot.ts          NEW  sellValue, salvageValue, itemsIn, lootAction, receiveItem, drainOverflow
  inventory.ts     NEW  equip, unequip, sell, salvage, moveItem, socketGem
  types.ts         MOD  GameState v2, FindRecord id + loot, settings, loot types, Stats multipliers
  balance.ts       MOD  bag and stash sizes, stat ranges, odds, values, caps
  rng.ts           MOD  nextRandom, pickWeighted
  stats.ts         MOD  worn gear in deriveStats; itemTotals, gemEffect, gearTotals
  dig.ts           MOD  yields, gold carry, leftover rescale, loot on collect, idle while loot is held
  newGame.ts, save.ts, summary.ts   MOD
src/store/gameStore.ts              MOD  inventory and settings intents
src/sprites/grids.ts                MOD  item icons, gem colours
src/ui/
  format.ts, saveText.ts (NEW), App.tsx, app.css, theme.css, gameLoop.ts, Notices.tsx, SaveMenu.tsx,
  OfflineSummary.tsx, mine/MineView.tsx, mine/FindsFeed.tsx, mine/minimap.ts, mine/Minimap.tsx
  character/itemView.ts, itemActions.ts, lootFilterView.ts   NEW pure view models
  character/useItemPopover.ts, ItemCard.tsx, ItemGrid.tsx, PaperDoll.tsx, CharacterPanel.tsx,
  character/StashDialog.tsx, LootFilterDialog.tsx, character.css                NEW
tests/fixtures/save-schema-1.txt    exported from the schema-1 game when this plan was written
tests/helpers/items.ts              NEW  gear() and gem() factories
```

---

### Task 1: Shell fixes carried over from Plan 1

**Files:**
- Create: `src/ui/saveText.ts`, `tests/ui/saveText.test.ts`
- Modify: `src/ui/format.ts`, `src/ui/Notices.tsx`, `src/ui/SaveMenu.tsx`, `src/ui/OfflineSummary.tsx`,
  `src/ui/App.tsx`, `src/ui/gameLoop.ts`, `src/ui/mine/minimap.ts`, `src/ui/mine/Minimap.tsx`,
  `src/ui/mine/MineView.tsx`, `src/core/types.ts`, `src/core/summary.ts`, `src/store/gameStore.ts`
- Test: `tests/ui/format.test.ts`, `tests/ui/minimap.test.ts`, `tests/ui/gameLoop.test.ts`,
  `tests/core/clock.test.ts`

**Interfaces:**
- Produces:
  - `formatRate(n: number): string`: `Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })`.
  - `plural(n: number, one: string, many: string): string`: `` `${formatNumber(n)} ${n === 1 ? one : many}` ``.
  - `saveProblem(reason: 'corrupt' | 'future' | 'invalid'): string` in `src/ui/saveText.ts`.
  - `depthForKey(key: string, depth: number, deepest: number): number | null` in `minimap.ts`. The keys
    move the miner as follows, always clamped to `0..deepest`:
    - `ArrowUp`: −1
    - `ArrowDown`: +1
    - `PageUp`: −10
    - `PageDown`: +10
    - `Home`: 0
    - `End`: `deepest`
    - any other key: `null`
  - `OfflineSummary` gains `capMs: number`. The signature becomes
    `summarize(before, after, elapsedMs, ticks, capMs)`, and `GameStore` passes `stats.offlineCapMs`.
  - `startGame` no longer calls `store.load()`. The app loads before it starts the loop. The bfcache
    `pageshow` path still reloads.

Behaviour:
- **R20, Notices:** no Dismiss button while `store.unreadableSave !== null`, so a session whose saving
  is blocked can't hide that.
- **R19, first-paint flash:** `App` loads inside its `useState` initializer, right after a successful
  `tryAcquire()`:

  ```ts
  useState(() => {
    if (!lock.tryAcquire()) return true;
    store.load();
    return false;
  })
  ```

  "Play here" calls `lock.takeOver()`, then `store.load()`, then `setBlocked(false)`.
- **R17, minimap keys:** the strip's `onKeyDown` uses `depthForKey`. When it returns a depth, it calls
  `preventDefault()` and `store.moveTo(depth)`. The strip's `aria-label` becomes "Minimap: choose a
  depth to dig at. Arrow keys move one metre, Page Up and Page Down ten, Home and End jump to the
  surface and the dig face."
- **Save problems in plain words:**
  - SaveMenu shows "That save couldn't be read (<saveProblem(reason)>)."
  - Notices builds its loadFailed text from `saveProblem`, keeping its current sentences.
- **OfflineSummary:**
  - Find counts use `plural` ("1 chest", "2 chests").
  - When `elapsedMs > capMs` it adds the line "You were away longer than <formatDuration(capMs)>, so
    only that much counted."
- **MineView:** the rate line reads `Auto <formatRate(autoTicksPerSecond)> tick/s · each click
  +<plural(ticksPerClick, 'tick', 'ticks')>`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/format.test.ts: add formatRate and plural to the import, then append
describe('formatRate', () => {
  it('keeps at most one decimal', () => {
    expect(formatRate(1.1)).toBe('1.1');
    expect(formatRate(1)).toBe('1');
    expect(formatRate(2.369)).toBe('2.4');
    expect(formatRate(1234.56)).toBe('1,234.6');
  });
});

describe('plural', () => {
  it('picks the word for the count', () => {
    expect(plural(1, 'chest', 'chests')).toBe('1 chest');
    expect(plural(0, 'chest', 'chests')).toBe('0 chests');
    expect(plural(1500, 'tick', 'ticks')).toBe('1,500 ticks');
  });
});
```

```ts
// tests/ui/saveText.test.ts
import { expect, it } from 'vitest';
import { saveProblem } from '../../src/ui/saveText';

it('explains each save problem in plain words', () => {
  expect(saveProblem('corrupt')).toBe('it is damaged');
  expect(saveProblem('invalid')).toBe('it is not a valid Golden Miner save');
  expect(saveProblem('future')).toBe('it was made by a newer version of the game');
});
```

```ts
// tests/ui/minimap.test.ts: add depthForKey to the import, then append
it('arrow, page, Home and End keys climb within the explored depths', () => {
  expect(depthForKey('ArrowUp', 10, 40)).toBe(9);
  expect(depthForKey('ArrowDown', 40, 40)).toBe(40);
  expect(depthForKey('PageUp', 5, 40)).toBe(0);
  expect(depthForKey('PageDown', 10, 40)).toBe(20);
  expect(depthForKey('Home', 10, 40)).toBe(0);
  expect(depthForKey('End', 10, 40)).toBe(40);
  expect(depthForKey('a', 10, 40)).toBeNull();
});
```

```ts
// tests/ui/gameLoop.test.ts: append
it('starting the loop does not load: the app loads before it starts', () => {
  const { store, loop } = setup();
  expect(store.load).not.toHaveBeenCalled();
  loop.stop();
});
```

```ts
// tests/core/clock.test.ts: in 'summarize reports what changed', pass the cap and expect it back
const sum = summarize(before, after, 600_000, 600, 28_800_000);
expect(sum).toMatchObject({ elapsedMs: 600_000, ticks: 600, gold: after.gold, metres: after.deepest, capMs: 28_800_000 });
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/ui tests/core/clock.test.ts`. They
  FAIL on missing exports, on `load` having been called, and on the missing `capMs`.
- [ ] **Step 3: Implement** the behaviour above. Update `startGame`'s comment so it no longer says it
  loads.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run typecheck`. Everything passes.
- [ ] **Step 5: Commit**: `git add src tests && git commit -m "Fix Plan 1 carry-overs: blocked-save notice, load flash, minimap keys, plain save errors"`

---

### Task 2: Item model and save schema 2

**Files:**
- Create: `src/core/items.ts`, `tests/helpers/items.ts`
- Modify: `src/core/types.ts`, `src/core/balance.ts`, `src/core/newGame.ts`, `src/core/save.ts`,
  `src/core/dig.ts` (find ids), `src/ui/mine/FindsFeed.tsx` (key on `f.id`)
- Modify the tests whose `FindRecord` literals now need an `id`: `tests/core/dig.test.ts`,
  `tests/ui/minimap.test.ts`, `tests/ui/particles.test.ts`
- Test: `tests/core/save.test.ts`. The fixture `tests/fixtures/save-schema-1.txt` already exists.

**Interfaces:**
- Produces, in `items.ts` (types derived from the arrays):

```ts
export const RARITIES = ['normal', 'magic', 'rare', 'legendary'] as const;
export const GEAR_SETS = ['mining', 'battle'] as const;
export const MINING_SLOTS = ['pickaxe', 'lamp', 'gloves', 'boots'] as const;
export const BATTLE_SLOTS = ['weapon', 'armor', 'helm', 'ring', 'amulet'] as const;
export const MINING_STATS = ['digPower', 'goldYield', 'diamondYield', 'chestFind', 'gemFind', 'mapFind',
  'lampSight', 'ticksPerClick', 'autoTickRate', 'offlineCap'] as const;
export const BATTLE_STATS = ['damage', 'damagePct', 'attackSpeed', 'life', 'armor', 'critChance',
  'resistAll', 'soulFind', 'magicFind'] as const;
export const GEM_TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'starstone'] as const;
// Rarity, GearSet, MiningSlot, BattleSlot, Slot (= MiningSlot | BattleSlot), MiningStat, BattleStat,
// StatKey (= MiningStat | BattleStat), GemType: each is (typeof X)[number]
export interface StatLine { stat: StatKey; value: number }          // an integer; may be negative
export interface GemItem { id: number; type: 'gem'; gem: GemType; ilvl: number }
export interface GearItem {
  id: number; type: 'gear'; slot: Slot; name: string; rarity: Rarity; ilvl: number;
  implicit: StatLine; affixes: StatLine[]; sockets: number; gems: GemItem[]; uniqueId?: string;
}
export type Item = GearItem | GemItem;
export const SLOT_IMPLICIT: Readonly<Record<Slot, StatKey>> = {
  pickaxe: 'digPower', lamp: 'lampSight', gloves: 'goldYield', boots: 'offlineCap',
  weapon: 'damage', armor: 'armor', helm: 'life', ring: 'critChance', amulet: 'damagePct',
};
export function setOfSlot(slot: Slot): GearSet;
export function slotsOf(set: GearSet): readonly Slot[];
export function statsOf(set: GearSet): readonly StatKey[];
export function isGear(item: Item): item is GearItem;
```

- Produces, in `types.ts`:

```ts
export type Container = GearSet | 'stash';
export type LootAction = 'keep' | 'sell' | 'salvage';
export type LootTarget = GearSet | Slot | 'gem' | 'any';
export interface LootRule { rarity: Rarity | 'any'; target: LootTarget; action: LootAction }
export type BagFullMode = 'sellWorst' | 'stop';
export interface Settings { lootFilter: LootRule[]; bagFull: BagFullMode }
export type LootOutcome = 'bag' | 'stash' | 'sold' | 'salvaged' | 'held';
export interface LootNote { name: string; rarity: Rarity | 'gem'; base: Slot | GemType; outcome: LootOutcome; value: number }
export interface FindRecord { id: number; depth: number; kind: FeatureKind; amount: number; tick: number; loot?: LootNote[] }
export type InvResult = 'ok' | 'bagFull' | 'stashFull' | 'noSocket' | 'invalid';
// GameState gains:
//   nextId: number;                                    // next id for an item or a find; starts at 1
//   goldCarry: number;                                 // 0..1: Gold earned but not yet whole
//   equipped: Record<GearSet, Partial<Record<Slot, GearItem>>>;
//   bags: Record<GearSet, Item[]>;                     // at most BAG_SIZE each; gear only in its own set's bag
//   stash: Item[];                                     // at most STASH_SIZE
//   overflow: { bag: GearSet; item: Item }[];          // loot waiting for room (bagFull 'stop')
//   lootTally: { kept: number; sold: number; salvaged: number };
//   settings: Settings;                                // kept across ascension (Plan 6)
```

- `balance.ts`: `BAG_SIZE = 24`, `STASH_SIZE = 60`, `MAX_LOOT_RULES = 20`, `MAX_OVERFLOW = 10`,
  `MAX_SOCKETS = 3`, `MAX_AFFIXES = 4`.
- `newGame` sets `nextId: 1`, `goldCarry: 0`, empty `equipped` / `bags` / `stash` / `overflow`, a zero
  `lootTally`, and `settings: { lootFilter: [], bagFull: 'sellWorst' }`.
- `dig.ts` `collect` gives every find `id: state.nextId++`.
- `save.ts`:
  - `SCHEMA_VERSION = 2`.
  - `MIGRATIONS[1]` adds the defaults above, gives the existing finds ids `1..n` in order, and sets
    `nextId = n + 1`. It returns its input unchanged unless that input is an object with a `finds`
    array, so validation rejects it.
  - `validateState` adds these checks:
    - `nextId` is an integer ≥ 1, and `goldCarry` is in `[0, 1)`.
    - **Every item:** `id` is an integer with `1 ≤ id < nextId`, and `ilvl` is an integer in
      `1..100_000`. Ids are unique across worn items, socketed gems, both bags, the stash and the
      overflow.
    - **A gem:** `type: 'gem'`, with `gem` in `GEM_TYPES`.
    - **A gear item:**
      - `type: 'gear'`;
      - `slot` is a known slot;
      - `name` is 1–80 characters;
      - `rarity` is in `RARITIES`;
      - the implicit and every affix are StatLines whose `stat` is in `statsOf(setOfSlot(slot))` and
        whose `value` is an integer with `|value| ≤ 1_000_000`;
      - there are at most `MAX_AFFIXES` affixes;
      - `sockets` is an integer in `0..MAX_SOCKETS`;
      - `gems` holds valid gems, no more of them than `sockets`;
      - `uniqueId` is absent or a string of at most 40 characters.
    - **`equipped`:** has `mining` and `battle` objects. Each key is a slot of that set, and its item's
      `slot` equals the key.
    - **`bags`:** `mining` and `battle` are arrays of at most `BAG_SIZE` items. Gear sits only in its
      own set's bag.
    - **`stash`:** an array of at most `STASH_SIZE` items.
    - **`overflow`:** at most `MAX_OVERFLOW` entries of `{ bag, item }`. Gear's set equals `bag`.
    - **`lootTally`:** three non-negative integers.
    - **`settings`:**
      - `lootFilter` holds at most `MAX_LOOT_RULES` rules.
      - Each rule's `rarity` is in `RARITIES` or `'any'`; its `target` is a set, a slot, `'gem'` or
        `'any'`; its `action` is `keep`, `sell` or `salvage`.
      - `bagFull` is `sellWorst` or `stop`.
    - **Every find:**
      - has an `id` (an integer with `1 ≤ id < nextId`);
      - `loot`, when present, is an array of at most 4 notes;
      - each note has a 1–80 character name, a rarity from `RARITIES` or `'gem'`, a slot or gem type as
        `base`, a known outcome, and a non-negative finite value.
- Test helpers, `tests/helpers/items.ts`:

```ts
export function gear(s: GameState, slot: Slot, p: Partial<GearItem> = {}): GearItem {
  return { id: s.nextId++, type: 'gear', slot, name: `Test ${slot}`, rarity: 'magic', ilvl: 4,
    implicit: { stat: SLOT_IMPLICIT[slot], value: 5 }, affixes: [], sockets: 0, gems: [], ...p };
}
export function gem(s: GameState, type: GemType = 'ruby', p: Partial<GemItem> = {}): GemItem {
  return { id: s.nextId++, type: 'gem', gem: type, ilvl: 4, ...p };
}
```

- [ ] **Step 1: Give the existing `FindRecord` literals an id.** Use `id: i + 1` in the
  `dig.test.ts` and `particles.test.ts` generators. Use ids 1–4 for the four finds in `minimap.test.ts`.
- [ ] **Step 2: Write the failing tests** in `tests/core/save.test.ts`. Keep the existing tests.

```ts
import fixture from '../fixtures/save-schema-1.txt?raw';
import { applyTicks } from '../../src/core/dig';
import { deriveStats } from '../../src/core/stats';
import type { GemType } from '../../src/core/items';
import type { BagFullMode, FindRecord, GameState, LootAction } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

it('migrates a real schema-1 save', () => {
  const r = decodeSave(fixture.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(r.savedAt).toBe(1_761_206_300_000);
  expect(s).toMatchObject({ gold: 10_972, diamonds: 119, depth: 123, deepest: 125, tickCount: 6300, goldCarry: 0, nextId: 31 });
  expect([s.equipped, s.bags, s.stash, s.overflow, s.lootTally, s.settings]).toEqual([
    { mining: {}, battle: {} }, { mining: [], battle: [] }, [], [],
    { kept: 0, sold: 0, salvaged: 0 }, { lootFilter: [], bagFull: 'sellWorst' },
  ]);
  expect(s.finds.map((f) => f.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect(s.finds[0]).toEqual({ id: 1, depth: 2, kind: 'map', amount: 0, tick: 50 });
  applyTicks(s, 100, deriveStats(s));
  expect(s.tickCount).toBe(6400);
});

function stocked(): GameState {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { sockets: 1, gems: [gem(s, 'ruby')] });
  s.bags.mining.push(gem(s, 'emerald'));
  s.bags.battle.push(gear(s, 'weapon', { rarity: 'rare', affixes: [{ stat: 'critChance', value: 3 }, { stat: 'life', value: 20 }, { stat: 'armor', value: 12 }] }));
  s.stash.push(gear(s, 'boots', { rarity: 'legendary', name: 'Long Voyage', uniqueId: 'longVoyage' }));
  s.settings.lootFilter.push({ rarity: 'normal', target: 'any', action: 'sell' });
  s.settings.bagFull = 'stop';
  return s;
}

it('round-trips gear, gems, the stash and settings', () => {
  const s = stocked();
  expect(decodeSave(encodeSave(s, 9))).toEqual({ ok: true, state: s, savedAt: 9 });
});

it('rejects impossible inventories', () => {
  const cases: [string, (s: GameState) => void][] = [
    ['battle gear in the mining bag', (s) => { s.bags.mining.push(gear(s, 'weapon')); }],
    ['an overfull bag', (s) => { for (let i = 0; i < 25; i++) s.bags.mining.push(gem(s)); }],
    ['an overfull stash', (s) => { for (let i = 0; i < 60; i++) s.stash.push(gem(s)); }],
    ['worn under the wrong slot', (s) => { s.equipped.mining.lamp = gear(s, 'pickaxe'); }],
    ['worn in the wrong set', (s) => { s.equipped.battle.pickaxe = gear(s, 'pickaxe'); }],
    ['a shared id', (s) => { const g = gem(s); g.id = s.bags.mining[0]!.id; s.stash.push(g); }],
    ['an id from the future', (s) => { s.stash.push(gem(s, 'ruby', { id: 999 })); }],
    ['more gems than sockets', (s) => { s.equipped.mining.pickaxe!.gems.push(gem(s)); }],
    ['a battle stat on mining gear', (s) => { s.equipped.mining.pickaxe!.affixes.push({ stat: 'damage', value: 3 }); }],
    ['a fractional stat', (s) => { s.equipped.mining.pickaxe!.implicit.value = 2.5; }],
    ['an unknown gem', (s) => { s.bags.mining.push({ ...gem(s), gem: 'opal' as GemType }); }],
    ['an unknown loot action', (s) => { s.settings.lootFilter.push({ rarity: 'any', target: 'any', action: 'burn' as LootAction }); }],
    ['too many loot rules', (s) => { for (let i = 0; i < 20; i++) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' }); }],
    ['an unknown bag-full mode', (s) => { s.settings.bagFull = 'maybe' as BagFullMode; }],
    ['a find without an id', (s) => { s.finds.push({ depth: 0, kind: 'chest', amount: 0, tick: 0 } as FindRecord); }],
    ['a whole Gold left in the carry', (s) => { s.goldCarry = 1; }],
    ['held loot for the wrong bag', (s) => { s.overflow.push({ bag: 'mining', item: gear(s, 'ring') }); }],
  ];
  for (const [name, mutate] of cases) {
    const s = stocked();
    mutate(s);
    expect(decodeSave(raw({ schema: 2, savedAt: 0, state: s })), name).toEqual({ ok: false, reason: 'invalid' });
  }
});
```

- [ ] **Step 3: Run them and see them fail**: `npx vitest run tests/core/save.test.ts`. It FAILS on the
  missing modules, fields and migration.
- [ ] **Step 4: Implement** `items.ts`, then the types, the balance constants, the `newGame` defaults,
  the find ids, the migration and the validation, per the Interfaces block.
- [ ] **Step 5: Run everything and see it pass**: `npm test && npm run typecheck`. Every suite passes.
  The old schema-1 envelopes in the existing save tests still decode, because the migration rebuilds
  the new fields.
- [ ] **Step 6: Commit**: `git add src/core src/ui/mine/FindsFeed.tsx tests && git commit -m "Add the item model and save schema 2"`

---

### Task 3: Item generation

**Files:**
- Create: `src/core/itemData.ts`, `src/core/itemGen.ts`, `tests/core/itemGen.test.ts`
- Modify: `src/core/balance.ts`, `src/core/rng.ts`

**Interfaces:**
- Consumes: Task 2's `items.ts`.
- Produces:
  - `rng.ts`:
    - `nextRandom(s: { rng: number }): number` advances `s.rng` with `mulberry32` and returns the value.
    - `pickWeighted<T>(s: { rng: number }, entries: readonly (readonly [T, number])[]): T` uses one draw
      over the cumulative weights.
  - `balance.ts`:
    - `STAT_RANGES: Record<StatKey, { base: number; perLevel: number; cap?: number }>` with these
      values:

      | stat | base | perLevel | cap |
      |---|---|---|---|
      | digPower | 2 | 2 | |
      | goldYield, diamondYield | 4 | 2 | |
      | chestFind, gemFind, mapFind | 5 | 2 | |
      | lampSight | 1 | 0.25 | 6 |
      | ticksPerClick | 1 | 0 | 1 |
      | autoTickRate | 3 | 1 | 50 |
      | offlineCap (minutes) | 15 | 5 | 240 |
      | damage | 2 | 3 | |
      | damagePct | 4 | 1 | |
      | attackSpeed | 3 | 1 | 40 |
      | life | 8 | 6 | |
      | armor | 6 | 5 | |
      | critChance | 1 | 0.5 | 15 |
      | resistAll | 3 | 1 | 30 |
      | soulFind, magicFind | 4 | 2 | |

    - `statRange(stat, ilvl): { min: number; max: number }`:
      - `max = min(cap ?? Infinity, max(1, round(base + perLevel × ilvl)))`
      - `min = max(1, round(max / 2))`
    - `rollStat(stat, ilvl, u): number` is `min + floor(u × (max − min + 1))`.
    - Weights and odds:
      - `STAT_WEIGHTS = { ticksPerClick: 2, lampSight: 4 }`, and every other stat has
        `DEFAULT_STAT_WEIGHT = 10`.
      - `RARITY_WEIGHTS = { normal: 60, magic: 30, rare: 9, legendary: 1 }`.
      - `RARE_FOURTH_AFFIX_CHANCE = 0.5`.
      - `SOCKET_WEIGHTS = [40, 35, 18, 7]`, where the index is the socket count.
      - `CHEST_SECOND_ITEM_CHANCE = 0.2` and `CHEST_BATTLE_CHANCE = 0.2`.
  - `itemData.ts` (content):
    - `BASE_NAMES: Record<Slot, [string, string, string, string]>`. `baseName(slot, ilvl)` returns
      `BASE_NAMES[slot][min(3, floor((ilvl − 1) / 3))]`. The names:
      - pickaxe: Copper Pick, Iron Pick, Steel Pick, Mithril Pick
      - lamp: Candle Cap, Oil Lamp Helm, Carbide Helm, Glowstone Helm
      - gloves: Cloth Gloves, Leather Gloves, Studded Gloves, Iron Gauntlets
      - boots: Worn Boots, Leather Boots, Hobnail Boots, Iron Boots
      - weapon: Rusty Cleaver, Quarry Maul, Iron Mace, War Pick
      - armor: Leather Apron, Hide Vest, Chain Mail, Plate Coat
      - helm: Leather Cap, Iron Visor, Steel Helm, Great Helm
      - ring: Copper Ring, Brass Loop, Silver Band, Gold Band
      - amulet: Coal Charm, Bone Amulet, Silver Pendant, Gold Amulet
    - `STAT_WORDS: Record<StatKey, { prefix: string; suffix: string }>`:

      | stat | prefix | suffix |
      |---|---|---|
      | digPower | Sharp | the Mole |
      | goldYield | Golden | Greed |
      | diamondYield | Glittering | the Jeweler |
      | chestFind | Lucky | Treasure |
      | gemFind | Prismatic | Gems |
      | mapFind | Wandering | the Explorer |
      | lampSight | Bright | Vision |
      | ticksPerClick | Eager | Haste |
      | autoTickRate | Tireless | Toil |
      | offlineCap | Patient | Dreams |
      | damage | Heavy | Wounds |
      | damagePct | Cruel | Ruin |
      | attackSpeed | Swift | Speed |
      | life | Hale | Vigor |
      | armor | Sturdy | the Wall |
      | critChance | Keen | Precision |
      | resistAll | Warded | Warding |
      | soulFind | Grim | Souls |
      | magicFind | Gleaming | Plunder |

    - `RARE_FIRST` = Gloom, Stone, Grim, Deep, Ash, Iron, Ember, Dusk, Hollow, Rune, Storm, Bone.
    - `RARE_SECOND: Record<Slot, string[]>`:
      - pickaxe: Biter, Breaker, Delver
      - lamp: Glow, Beacon, Eye
      - gloves: Grasp, Fist, Touch
      - boots: Stride, Tread, March
      - weapon: Cleaver, Maul, Smasher
      - armor: Mail, Coat, Shell
      - helm: Visor, Hood, Crown
      - ring: Loop, Coil, Band
      - amulet: Charm, Token, Heart
    - `interface LegendaryDef { id: string; name: string; slot: Slot; lines: ({ stat: StatKey; scale: number } | { stat: StatKey; fixed: number })[] }`
    - `LEGENDARIES`, in this order:
      - `deepdelver` "Deepdelver", pickaxe: digPower ×1.5, ticksPerClick fixed 1, chestFind fixed −10
      - `golddigger` "The Golddigger", gloves: goldYield ×2, diamondYield ×1
      - `blackLantern` "Black Lantern", lamp: lampSight fixed 3, mapFind ×1.5, gemFind ×1
      - `longVoyage` "Long Voyage", boots: offlineCap fixed 120, autoTickRate ×1
      - `bandOfTheDeep` "Band of the Deep", ring: critChance ×1.5, life ×1
      - `wolfEye` "Wolf Eye", amulet: magicFind ×2, soulFind ×1.5
      - `krakenLeather` "Kraken Leather", armor: armor ×1.5, resistAll ×1.5
      - `peacemaker` "The Peacemaker", weapon: damage ×1.5, attackSpeed ×1.5
    - `GEM_EFFECTS: Record<GemType, Record<GearSet, StatKey>>`:
      - ruby: goldYield / damagePct
      - sapphire: diamondYield / resistAll
      - emerald: mapFind / attackSpeed
      - amethyst: chestFind / life
      - starstone: digPower / critChance
    - `GEM_LABELS`: Ruby, Sapphire, Emerald, Amethyst, Starstone.
    - `GEM_SIZES`: from item level 1 Tiny, 4 Small, 7 Big, 10 Giant, 15 Perfect.
    - `gemSizeName(ilvl)`.
    - `gemName(gem)` is `` `${gemSizeName(ilvl)} ${GEM_LABELS[gem]}` ``.
    - `itemName(item)` is the gear's `name` or `gemName`.
  - `itemGen.ts`. Every draw comes from `nextRandom(state)`, and every new item takes
    `id: state.nextId++`.
    - `rollRarity(state): Rarity` uses `RARITY_WEIGHTS`.
    - `rollGear(state, ilvl, set, rarity?): GearItem`:
      - **Legendary:** pick uniformly among the `LEGENDARIES` of that set, and take its slot. Roll the
        implicit normally. Each line becomes an affix: `scale` gives `round(rollStat(...) × scale)`,
        and a scaled value may pass the cap. `fixed` gives the fixed value. Set `name = def.name` and
        `uniqueId = def.id`.
      - **Otherwise:** pick a slot uniformly from the set. The implicit is
        `{ stat: SLOT_IMPLICIT[slot], value: rollStat(...) }`.
        - Affix count: normal 0, magic 2, rare 3, plus 1 with `RARE_FOURTH_AFFIX_CHANCE`.
        - Affix stats are drawn weighted and without replacement from `statsOf(set)`, minus the
          implicit stat. Values come from `rollStat`.
        - Names: normal is `baseName`. Magic is
          `` `${STAT_WORDS[a0].prefix} ${baseName} of ${STAT_WORDS[a1].suffix}` ``. Rare is
          `` `${RARE_FIRST[i]} ${RARE_SECOND[slot][j]}` ``.
      - **Every item:** `sockets` comes from `SOCKET_WEIGHTS`, and `gems: []`.
    - `rollGem(state, ilvl): GemItem` picks the type uniformly.
    - `rollChest(state, ilvl): GearItem[]` holds 1 item, or 2 with `CHEST_SECOND_ITEM_CHANCE`. Each item
      is `'battle'` with `CHEST_BATTLE_CHANCE`, else `'mining'`.

- [ ] **Step 1: Write the failing tests** in `tests/core/itemGen.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { statRange } from '../../src/core/balance';
import { LEGENDARIES, STAT_WORDS, baseName, gemName, gemSizeName } from '../../src/core/itemData';
import { rollChest, rollGear, rollGem } from '../../src/core/itemGen';
import { SLOT_IMPLICIT, setOfSlot, statsOf, type GearItem, type GearSet, type Rarity } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';

describe('stat ranges', () => {
  it('grow with item level and respect caps', () => {
    expect(statRange('digPower', 1)).toEqual({ min: 2, max: 4 });
    expect(statRange('digPower', 10)).toEqual({ min: 11, max: 22 });
    expect(statRange('lampSight', 1)).toEqual({ min: 1, max: 1 });
    expect(statRange('lampSight', 40)).toEqual({ min: 3, max: 6 });
    expect(statRange('ticksPerClick', 50)).toEqual({ min: 1, max: 1 });
    expect(statRange('offlineCap', 1)).toEqual({ min: 10, max: 20 });
    expect(statRange('offlineCap', 100)).toEqual({ min: 120, max: 240 });
    expect(statRange('critChance', 1)).toEqual({ min: 1, max: 2 });
  });
});

it('gem sizes grow with depth', () => {
  expect([1, 3, 4, 7, 10, 15, 99].map(gemSizeName)).toEqual(['Tiny', 'Tiny', 'Small', 'Big', 'Giant', 'Perfect', 'Perfect']);
  expect(gemName(rollGem(newGame(1, 0), 5))).toMatch(/^Small (Ruby|Sapphire|Emerald|Amethyst|Starstone)$/);
});

it('rolls are deterministic and take fresh ids', () => {
  const a = newGame(3, 0);
  const b = newGame(3, 0);
  expect(rollGear(a, 6, 'mining')).toEqual(rollGear(b, 6, 'mining'));
  expect(a.rng).toBe(b.rng);
  const first = rollGem(a, 6).id;
  expect(rollGem(a, 6).id).toBe(first + 1);
  expect(a.nextId).toBe(first + 2);
});

const many = (set: GearSet, n: number, ilvl: number) => {
  const s = newGame(11, 0);
  return Array.from({ length: n }, () => rollGear(s, ilvl, set));
};

it('every item fits its set, rarity and item level', () => {
  for (const set of ['mining', 'battle'] as const) {
    for (const item of many(set, 2000, 7)) {
      expect(setOfSlot(item.slot)).toBe(set);
      expect(item.ilvl).toBe(7);
      expect(item.gems).toEqual([]);
      expect([0, 1, 2, 3]).toContain(item.sockets);
      expect(item.implicit.stat).toBe(SLOT_IMPLICIT[item.slot]);
      const imp = statRange(item.implicit.stat, 7);
      expect(item.implicit.value).toBeGreaterThanOrEqual(imp.min);
      expect(item.implicit.value).toBeLessThanOrEqual(imp.max);
      if (item.rarity === 'legendary') continue;
      const stats = item.affixes.map((a) => a.stat);
      expect(new Set(stats).size).toBe(stats.length);
      expect(stats).not.toContain(item.implicit.stat);
      for (const a of item.affixes) {
        expect(statsOf(set)).toContain(a.stat);
        const r = statRange(a.stat, 7);
        expect(a.value).toBeGreaterThanOrEqual(r.min);
        expect(a.value).toBeLessThanOrEqual(r.max);
      }
      const base = baseName(item.slot, 7);
      if (item.rarity === 'normal') expect([item.affixes, item.name]).toEqual([[], base]);
      if (item.rarity === 'magic') {
        expect(item.affixes).toHaveLength(2);
        expect(item.name).toBe(`${STAT_WORDS[item.affixes[0]!.stat].prefix} ${base} of ${STAT_WORDS[item.affixes[1]!.stat].suffix}`);
      }
      if (item.rarity === 'rare') expect([3, 4]).toContain(item.affixes.length);
    }
  }
});

it('rarity, socket and affix-count odds follow the weights', () => {
  const items = many('mining', 20_000, 3);
  const share = (f: (i: GearItem) => boolean) => items.filter(f).length / items.length;
  const r = (x: Rarity) => share((i) => i.rarity === x);
  expect(r('normal')).toBeGreaterThan(0.58); expect(r('normal')).toBeLessThan(0.62);
  expect(r('magic')).toBeGreaterThan(0.28); expect(r('magic')).toBeLessThan(0.32);
  expect(r('rare')).toBeGreaterThan(0.08); expect(r('rare')).toBeLessThan(0.10);
  expect(r('legendary')).toBeGreaterThan(0.006); expect(r('legendary')).toBeLessThan(0.014);
  expect(share((i) => i.sockets === 0)).toBeGreaterThan(0.38); expect(share((i) => i.sockets === 0)).toBeLessThan(0.42);
  expect(share((i) => i.sockets === 3)).toBeGreaterThan(0.06); expect(share((i) => i.sockets === 3)).toBeLessThan(0.08);
  const rares = items.filter((i) => i.rarity === 'rare');
  const four = rares.filter((i) => i.affixes.length === 4).length / rares.length;
  expect(four).toBeGreaterThan(0.44); expect(four).toBeLessThan(0.56);
});

it('legendaries come from the hand-written list', () => {
  const s = newGame(5, 0);
  const seen = new Map<string, GearItem>();
  for (let i = 0; i < 300; i++) {
    const item = rollGear(s, 10, 'mining', 'legendary');
    seen.set(item.name, item);
  }
  const mining = LEGENDARIES.filter((d) => setOfSlot(d.slot) === 'mining').map((d) => d.name);
  expect([...seen.keys()].sort()).toEqual(mining.sort());
  const dd = seen.get('Deepdelver');
  expect(dd).toMatchObject({ slot: 'pickaxe', rarity: 'legendary', uniqueId: 'deepdelver' });
  expect(dd?.affixes.map((a) => a.stat)).toEqual(['digPower', 'ticksPerClick', 'chestFind']);
  expect(dd?.affixes.slice(1).map((a) => a.value)).toEqual([1, -10]);
  expect(dd?.affixes[0]?.value).toBeGreaterThanOrEqual(17);
  expect(dd?.affixes[0]?.value).toBeLessThanOrEqual(33);
});

it('chests hold one or two items, mostly mining gear', () => {
  const s = newGame(8, 0);
  let doubles = 0;
  let items = 0;
  let battle = 0;
  for (let i = 0; i < 5000; i++) {
    const loot = rollChest(s, 4);
    expect([1, 2]).toContain(loot.length);
    if (loot.length === 2) doubles++;
    for (const item of loot) {
      items++;
      if (setOfSlot(item.slot) === 'battle') battle++;
      expect(item.ilvl).toBe(4);
    }
  }
  expect(doubles / 5000).toBeGreaterThan(0.17); expect(doubles / 5000).toBeLessThan(0.23);
  expect(battle / items).toBeGreaterThan(0.17); expect(battle / items).toBeLessThan(0.23);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/itemGen.test.ts`. It FAILS on
  the missing modules.
- [ ] **Step 3: Implement** `rng.ts` additions, `balance.ts` tables, `itemData.ts`, `itemGen.ts`.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run typecheck`.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Roll gear, gems and chest loot"`

---

### Task 4: Worn gear changes digging

**Files:**
- Modify: `src/core/types.ts` (`Stats`), `src/core/balance.ts`, `src/core/stats.ts`,
  `src/core/dig.ts`, `src/ui/mine/minimap.ts`
- Create: `tests/core/gearStats.test.ts`
- Test: `tests/core/dig.test.ts`, `tests/ui/minimap.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3 (`statRange`, `GEM_EFFECTS`).
- Produces:
  - `Stats` gains `goldMultiplier: number` and `diamondMultiplier: number`.
  - `balance.ts`: `MAX_LAMP_SIGHT = 20`, `FEATURE_CHANCE_TOTAL_CAP = 0.9`, `DIAMOND_CHANCE_CAP = 0.5`.
  - `stats.ts`:
    - `itemTotals(item: GearItem): Partial<Record<StatKey, number>>` sums the implicit, then the
      affixes, then the socketed gems' effects, in that insertion order.
    - `gemEffect(gem: GemItem, set: GearSet): StatLine` is
      `{ stat: GEM_EFFECTS[gem.gem][set], value: statRange(that stat, gem.ilvl).max }`.
    - `gearTotals(state, set): Record<StatKey, number>` returns every key, 0 by default, summed over
      the worn items of that set.
    - `deriveStats` uses `g = gearTotals(state, 'mining')` and `pct(n) = max(0, 1 + n / 100)`:
      - `digPower = max(1, BASE_DIG_POWER + g.digPower)`
      - `autoTicksPerSecond = BASE_AUTO_TICKS_PER_SECOND × pct(g.autoTickRate)`
      - `ticksPerClick = BASE_TICKS_PER_CLICK + g.ticksPerClick`
      - `lampSight = min(MAX_LAMP_SIGHT, BASE_LAMP_SIGHT + g.lampSight)`
      - `offlineCapMs = BASE_OFFLINE_CAP_MS + g.offlineCap × 60_000`
      - `goldMultiplier = pct(g.goldYield)` and `diamondMultiplier = pct(g.diamondYield)`
      - `featureChances`: chest, gem and map are multiplied by `pct` of chestFind, gemFind and mapFind.
        Veins are unchanged. If the total exceeds `FEATURE_CHANCE_TOTAL_CAP`, every chance is scaled
        by `cap / total`.
  - `dig.ts`:
    - **Per-tick Gold:** `pay = goldPerTick(tier) × goldMultiplier + goldCarry`,
      `whole = floor(pay)`, `goldCarry = pay − whole`, `gold += whole`. The `gold` event is pushed only
      when `whole > 0`.
    - **Diamond chance per tick:** `min(DIAMOND_CHANCE_CAP, diamondChancePerTick(tier) × diamondMultiplier)`.
    - **Veins:** `collect` takes `stats` and becomes
      `collect(state, roll, depth, stats, events?)`. A vein pays `round(amount × multiplier)`, and the
      find logs the amount paid.
    - **Leftover rescale** (Plan 1 carry-over): when the face finishes metre `m`, the leftover progress
      becomes `leftover × effective(m) / effective(m + 1)`, where `effective` is hardness times the
      hard-rock multiplier.
  - `minimapModel` shows only `ahead` metres `≤ deepest + lampSight`. Rolls beyond that stay stored.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/gearStats.test.ts
import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals, itemTotals } from '../../src/core/stats';
import { gear, gem } from '../helpers/items';

it('no gear means the Plan 1 base stats', () => {
  expect(deriveStats(newGame(1, 0))).toMatchObject({
    digPower: 10, autoTicksPerSecond: 1, ticksPerClick: 1, lampSight: 2, offlineCapMs: 28_800_000,
    goldMultiplier: 1, diamondMultiplier: 1,
  });
});

it('the worn mining set adds to the base', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'goldYield', value: 50 }] });
  s.equipped.mining.lamp = gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 30 } });
  s.equipped.mining.gloves = gear(s, 'gloves', { implicit: { stat: 'goldYield', value: 10 }, affixes: [{ stat: 'autoTickRate', value: 10 }, { stat: 'ticksPerClick', value: 1 }] });
  s.equipped.mining.boots = gear(s, 'boots', { implicit: { stat: 'offlineCap', value: 60 }, affixes: [{ stat: 'chestFind', value: 100 }, { stat: 'diamondYield', value: 25 }] });
  const st = deriveStats(s);
  expect(st.digPower).toBe(18);
  expect(st.goldMultiplier).toBeCloseTo(1.6);
  expect(st.diamondMultiplier).toBeCloseTo(1.25);
  expect(st.lampSight).toBe(20);
  expect(st.autoTicksPerSecond).toBeCloseTo(1.1);
  expect(st.ticksPerClick).toBe(2);
  expect(st.offlineCapMs).toBe(9 * 3_600_000);
  expect(st.featureChances.chest).toBeCloseTo(0.12);
  expect(st.featureChances.goldVein).toBe(0.12);
});

it('battle gear leaves digging alone', () => {
  const s = newGame(1, 0);
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 } });
  expect(deriveStats(s)).toEqual(deriveStats(newGame(1, 0)));
  expect(gearTotals(s, 'battle').damage).toBe(14);
  expect(gearTotals(s, 'mining').digPower).toBe(0);
});

it('a gem counts with the stat of the set it sits in', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 4 }, sockets: 1, gems: [gem(s, 'ruby', { ilvl: 4 })] });
  s.equipped.mining.pickaxe = pick;
  s.equipped.battle.helm = gear(s, 'helm', { implicit: { stat: 'life', value: 20 }, sockets: 1, gems: [gem(s, 'ruby', { ilvl: 4 })] });
  expect(itemTotals(pick)).toEqual({ digPower: 4, goldYield: 12 });
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.12);
  expect(gearTotals(s, 'battle').damagePct).toBe(8);
});

it('find chances are capped together and never go below zero', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 2000 }] });
  const capped = deriveStats(s).featureChances;
  expect(Object.values(capped).reduce((a, b) => a + b, 0)).toBeCloseTo(0.9);
  expect(capped.chest / capped.goldVein).toBeCloseTo(10.5);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: -200 }] });
  expect(deriveStats(s).featureChances.chest).toBe(0);
});
```

```ts
// tests/core/dig.test.ts: append
it('Gold yield pays fractions through a carry', () => {
  const s = fresh();
  const events: TickEvent[] = [];
  applyTicks(s, 2, { ...stats, goldMultiplier: 1.5 }, events);
  expect([s.gold, s.goldCarry]).toEqual([3, 0]);
  expect(events.flatMap((e) => (e.kind === 'gold' ? [e.amount] : []))).toEqual([1, 2]);
});

it('veins pay their yield and log what was paid', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const rich = { ...stats, goldMultiplier: 1.5 };
  while (s.deepest < 1) applyTicks(s, 1, rich);
  expect(s.finds[0]).toMatchObject({ kind: 'goldVein', amount: 29 });
  expect(s.gold).toBe(Math.floor(s.tickCount * 1.5) + 29);
});

it('Diamond yield raises the chance per tick, up to the cap', () => {
  const s = fresh();
  const events: TickEvent[] = [];
  applyTicks(s, 2000, { ...stats, diamondMultiplier: 100 }, events);
  const share = events.filter((e) => e.kind === 'diamond').length / 2000;
  expect(share).toBeGreaterThan(0.45);
  expect(share).toBeLessThan(0.55);
});

it('leftover progress carries over at the next metre’s hardness', () => {
  const s = fresh();
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  s.ahead[2] = { feature: null, amount: 0, hardRock: true };
  applyTicks(s, 1, { ...stats, digPower: 1.5 * 10.13 * 25 }); // 1.5 metres of metre 1's work
  expect(s.deepest).toBe(1);
  expect(s.progress).toBeCloseTo((0.5 * 10.13) / (10.26 * 1.5), 6);
});
```

```ts
// tests/ui/minimap.test.ts: append
it('only metres within the current lamp sight are shown ahead', () => {
  expect(minimapModel(at(340), 1).ahead).toEqual([{ y: (340.5 - 290) * 6, kind: 'chest' }]);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core tests/ui/minimap.test.ts`.
- [ ] **Step 3: Implement** per the Interfaces block.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run typecheck`. The Plan 1 dig,
  determinism and lifecycle tests still pass unchanged, because ungeared stats give exactly the old
  numbers.
- [ ] **Step 5: Commit**: `git add src tests && git commit -m "Let worn mining gear change digging"`

---

### Task 5: Loot from chests and gems

**Files:**
- Create: `src/core/loot.ts`, `tests/core/loot.test.ts`
- Modify: `src/core/balance.ts`, `src/core/dig.ts`, `src/core/summary.ts`, `src/core/types.ts`
  (`OfflineSummary`)

**Interfaces:**
- Consumes: `rollChest`, `rollGem`, `itemName` (Task 3); `isGear`, `setOfSlot` (Task 2).
- Produces:
  - `balance.ts`:
    - `SELL_GOLD = { normal: 5, magic: 12, rare: 30, legendary: 80 }`, per item level.
    - `GEM_SELL_GOLD = 20`, per item level.
    - `SALVAGE_DIAMONDS = { normal: 1, magic: 2, rare: 4, legendary: 10 }` and
      `GEM_SALVAGE_DIAMONDS = 2`, each × `(1 + floor(ilvl / 5))`.
    - `LOOT_NOTES_KEPT = 30`.
  - `loot.ts`:
    - `sellValue(item: Item): number` is `SELL_GOLD[rarity] × ilvl` plus the sell value of each
      socketed gem. A gem alone is worth `GEM_SELL_GOLD × ilvl`.
    - `salvageValue(item: Item): number` is the same shape with the salvage tables.
    - `itemsIn(state, c: Container): Item[]` returns the live array.
    - `lootAction(rules: LootRule[], item: Item): LootAction`.
      - The first rule whose rarity and target both match decides. No match means `'keep'`.
      - **Rarity:** `'any'` matches everything. A gem has no rarity, so only `'any'` matches it.
      - **Target:** `'any'` matches everything, a set matches its gear, a slot matches that slot, and
        `'gem'` matches gems.
    - `receiveItem(state, item, gemBag: GearSet): LootNote[]`. Gear goes to the bag of its own set;
      `gemBag` applies to gems only.
      1. Apply `lootAction`. `sell` adds `sellValue` to Gold and returns `[note 'sold']`. `salvage`
         adds `salvageValue` to Diamonds and returns `[note 'salvaged']`.
      2. If the bag has room, push the item and return `[note 'bag']`.
      3. Else, if the stash has room, push it and return `[note 'stash']`.
      4. Else, if `settings.bagFull === 'stop'` and `overflow.length < MAX_OVERFLOW`, push
         `{ bag, item }` and return `[note 'held']`.
      5. Else, sell the worst. The candidates, in this order, are the new item, then the bag, then the
         stash. The first with the lowest `sellValue` goes.
         - If that is the new item, sell it and return `[note 'sold']`.
         - Otherwise, sell the worst and put the new item at its index (`splice(i, 1, item)`). Return
           `[note(worst, 'sold'), note(item, 'bag' | 'stash')]`.
      - A note is `{ name: itemName, rarity: gear's rarity or 'gem', base: slot or gem type, outcome, value }`.
        `value` is the Gold or Diamonds paid, or 0.
      - `lootTally` counts the returned notes: `bag`, `stash` and `held` count as kept; `sold` as sold;
        `salvaged` as salvaged.
    - `drainOverflow(state): void`. While `overflow` isn't empty, move its first entry into its bag,
      else into the stash. If neither has room, then under `'sellWorst'` apply step 5 to it; under
      `'stop'`, stop. It leaves `lootTally` alone, and its notes go nowhere.
  - `dig.ts`:
    - The signature becomes `collect(state, roll, depth, tier, stats, events?)`. The face passes
      `metreTier(metre)`, and galleries pass `tierAt(depth)`.
    - A find takes its id before its loot is rolled.
    - A chest sends each item of `rollChest(state, tier)` through `receiveItem(state, item, 'mining')`.
    - A gem sends `rollGem(state, tier)` through the same call.
    - Non-empty notes become `find.loot`. After the push, the find that is now `LOOT_NOTES_KEPT` from
      the end loses its `loot` (delete the property).
    - In `applyTicks`, while `state.overflow` isn't empty, a tick only adds 1 to `tickCount`: no Gold,
      no Diamond draw, no digging.
  - `OfflineSummary` gains `items: { kept: number; sold: number; salvaged: number }` (the `lootTally`
    difference) and `stoppedFull: boolean` (`after.overflow.length > 0`).

- [ ] **Step 1: Write the failing tests** in `tests/core/loot.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BAG_SIZE, LOOT_NOTES_KEPT, STASH_SIZE } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { itemName } from '../../src/core/itemData';
import { drainOverflow, lootAction, receiveItem, salvageValue, sellValue } from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import type { GameState, LootRule } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const stats = deriveStats(newGame(1, 0));

// Bag: 24 rare boots (150 Gold each). Stash: 60 rare gloves (150) except index 7, a normal pair (25).
function fill(s: GameState) {
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gear(s, 'boots', { rarity: 'rare', ilvl: 5 }));
  for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gear(s, 'gloves', { rarity: i === 7 ? 'normal' : 'rare', ilvl: 5 }));
}

it('sell and salvage values', () => {
  const s = newGame(1, 0);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 }))).toBe(48);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, sockets: 1, gems: [gem(s, 'ruby', { ilvl: 4 })] }))).toBe(200);
  expect(salvageValue(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }))).toBe(12);
  expect(salvageValue(gem(s, 'ruby', { ilvl: 4 }))).toBe(2);
});

it('the first matching rule decides, and nothing matching keeps', () => {
  const s = newGame(1, 0);
  const rules: LootRule[] = [
    { rarity: 'legendary', target: 'any', action: 'keep' },
    { rarity: 'any', target: 'battle', action: 'salvage' },
    { rarity: 'normal', target: 'any', action: 'sell' },
    { rarity: 'any', target: 'gem', action: 'sell' },
  ];
  expect(lootAction(rules, gear(s, 'ring', { rarity: 'legendary' }))).toBe('keep');
  expect(lootAction(rules, gear(s, 'ring', { rarity: 'normal' }))).toBe('salvage');
  expect(lootAction(rules, gear(s, 'pickaxe', { rarity: 'normal' }))).toBe('sell');
  expect(lootAction(rules, gear(s, 'pickaxe', { rarity: 'magic' }))).toBe('keep');
  expect(lootAction(rules, gem(s))).toBe('sell');
  expect(lootAction([{ rarity: 'normal', target: 'any', action: 'sell' }], gem(s))).toBe('keep');
  expect(lootAction([{ rarity: 'any', target: 'lamp', action: 'sell' }], gear(s, 'lamp'))).toBe('sell');
});

it('the filter sells and salvages before anything is stowed', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [
    { rarity: 'normal', target: 'any', action: 'sell' },
    { rarity: 'magic', target: 'any', action: 'salvage' },
  ];
  receiveItem(s, gear(s, 'boots', { rarity: 'normal', ilvl: 3 }), 'mining');
  receiveItem(s, gear(s, 'boots', { rarity: 'magic', ilvl: 3 }), 'mining');
  expect([s.gold, s.diamonds, s.bags.mining.length]).toEqual([15, 2, 0]);
  expect(s.lootTally).toEqual({ kept: 0, sold: 1, salvaged: 1 });
});

it('kept items go to the bag of their set, then overflow into the stash', () => {
  const s = newGame(1, 0);
  expect(receiveItem(s, gear(s, 'weapon'), 'mining').map((n) => n.outcome)).toEqual(['bag']);
  expect(s.bags.battle).toHaveLength(1);
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
  expect(receiveItem(s, gem(s, 'emerald'), 'mining').map((n) => n.outcome)).toEqual(['stash']);
  expect(s.stash).toHaveLength(1);
});

describe('when the bag and the stash are full', () => {
  it('sellWorst sells the cheapest of the new item, the bag and the stash', () => {
    const s = newGame(1, 0);
    fill(s);
    const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 });
    expect(receiveItem(s, pick, 'mining').map((n) => [n.outcome, n.value])).toEqual([['sold', 25], ['stash', 0]]);
    expect(s.gold).toBe(25);
    expect(s.stash[7]).toBe(pick);
    expect(s.stash).toHaveLength(STASH_SIZE);
    expect(s.lootTally).toEqual({ kept: 1, sold: 1, salvaged: 0 });
  });

  it('a new item that is the cheapest is sold itself', () => {
    const s = newGame(1, 0);
    fill(s);
    expect(receiveItem(s, gear(s, 'pickaxe', { rarity: 'normal', ilvl: 1 }), 'mining').map((n) => n.outcome)).toEqual(['sold']);
    expect(s.gold).toBe(5);
  });

  it('stop holds the item and idles until there is room', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    const pick = gear(s, 'pickaxe');
    expect(receiveItem(s, pick, 'mining').map((n) => n.outcome)).toEqual(['held']);
    expect(s.overflow).toEqual([{ bag: 'mining', item: pick }]);
    const before = { gold: s.gold, progress: s.progress, ticks: s.tickCount };
    applyTicks(s, 50, stats);
    expect([s.gold, s.progress, s.tickCount]).toEqual([before.gold, before.progress, before.ticks + 50]);
    s.bags.mining.pop();
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.bags.mining.at(-1)).toBe(pick);
    applyTicks(s, 1, stats);
    expect(s.gold).toBeGreaterThan(before.gold);
  });

  it('switching to sellWorst lets held loot through', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 }), 'mining');
    s.settings.bagFull = 'sellWorst';
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.gold).toBe(25);
  });
});

it('chest and gem finds carry their loot notes', () => {
  const s = newGame(1, 0);
  s.ahead[1] = { feature: 'chest', amount: 0, hardRock: false };
  s.ahead[2] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 2) applyTicks(s, 1, stats);
  const [chest, found] = s.finds;
  expect(chest).toMatchObject({ id: 1, kind: 'chest', depth: 1 });
  expect(chest?.loot?.every((n) => n.outcome === 'bag')).toBe(true);
  expect(found?.loot).toEqual([expect.objectContaining({ rarity: 'gem', outcome: 'bag' })]);
  expect(found?.id).toBeGreaterThan(chest?.id ?? Infinity);
  const kept = [...s.bags.mining, ...s.bags.battle];
  expect(kept.every((i) => i.ilvl === 1)).toBe(true);
  expect(new Set([...(chest?.loot ?? []), ...(found?.loot ?? [])].map((n) => n.name))).toEqual(new Set(kept.map(itemName)));
});

it('only the newest finds keep their loot notes', () => {
  const s = newGame(1, 0);
  const last = LOOT_NOTES_KEPT + 5;
  for (let m = 1; m <= last; m++) s.ahead[m] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < last) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(last);
  expect(s.finds.filter((f) => f.loot).length).toBe(LOOT_NOTES_KEPT);
  expect(s.finds[0]?.loot).toBeUndefined();
  expect(s.finds.at(-1)?.loot).toHaveLength(1);
});

it('the offline summary counts loot and notices a full stop', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  after.lootTally = { kept: 3, sold: 2, salvaged: 1 };
  after.overflow = [{ bag: 'mining', item: gem(after) }];
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.items).toEqual({ kept: 3, sold: 2, salvaged: 1 });
  expect(sum.stoppedFull).toBe(true);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/loot.test.ts`.
- [ ] **Step 3: Implement** `loot.ts`, then the `collect`/`applyTicks` changes and `summarize`.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run typecheck`. The determinism and
  lifecycle tests still pass, because loot is never worn automatically, so stats don't change during
  a span.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Route chest and gem loot through the loot filter into bags"`

---

### Task 6: Inventory actions and store intents

**Files:**
- Create: `src/core/inventory.ts`, `tests/core/inventory.test.ts`
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts`

**Interfaces:**
- Consumes: `sellValue`, `salvageValue`, `itemsIn`, `drainOverflow` (Task 5); `fillAhead`,
  `deriveStats`.
- Produces:
  - **Shared rules for every function in `inventory.ts`:**
    - Each returns `InvResult` and changes nothing unless it returns `'ok'`.
    - A missing index is `'invalid'`.
    - Every change to worn gear ends with `fillAhead(state, deriveStats(state))`, so a stronger lamp
      reveals at once.
  - **The functions:**
    - `equip(state, set: GearSet, index: number)`
      - The item must be gear of that set, taken from `bags[set]`.
      - It swaps with the worn item in place, or leaves the bag if the slot was empty.
    - `unequip(state, slot: Slot)`
      - Returns `'invalid'` when nothing is worn and `'bagFull'` when the bag is full.
      - Otherwise the item is pushed to the end of its set's bag.
    - `sell(state, from: Container, index)` and `salvage(state, from: Container, index)` pay out and
      remove the item.
    - `moveItem(state, from: Container, index, to: Container)`
      - `'invalid'` when `from === to`, or when gear would go into the other set's bag. Gems fit any
        bag.
      - `'bagFull'` or `'stashFull'` when the target is full. Otherwise it removes and pushes.
    - `socketGem(state, from: Container, index, slot: Slot)`
      - `'invalid'` unless the item is a gem and something is worn in `slot`.
      - `'noSocket'` when `gems.length >= sockets`.
      - Otherwise it pushes the gem into the worn item and removes it from the container.
  - **`GameStore` intents:**
    - `equip(set, index)`, `unequip(slot)`, `sell(from, index)`, `salvage(from, index)`,
      `moveItem(from, index, to)` and `socketGem(from, index, slot)` each return `InvResult`. On
      `'ok'` they call `drainOverflow(state)` and then `changed()`.
    - `setLootFilter(rules: LootRule[]): void` stores copies of the first `MAX_LOOT_RULES` rules, then
      calls `changed()`.
    - `setBagFull(mode: BagFullMode): void` sets the mode, then calls `drainOverflow` and `changed()`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/inventory.test.ts
import { expect, it } from 'vitest';
import { BAG_SIZE, STASH_SIZE } from '../../src/core/balance';
import { equip, moveItem, salvage, sell, socketGem, unequip } from '../../src/core/inventory';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { gear, gem } from '../helpers/items';

it('equipping swaps with the worn item in place', () => {
  const s = newGame(1, 0);
  const worn = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = worn;
  const [a, b, c] = [gear(s, 'boots'), gear(s, 'pickaxe'), gear(s, 'gloves')];
  s.bags.mining.push(a, b, c);
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBe(b);
  expect(s.bags.mining).toEqual([a, worn, c]);
});

it('equipping into an empty slot takes the item out of the bag', () => {
  const s = newGame(1, 0);
  const lamp = gear(s, 'lamp');
  s.bags.mining.push(gem(s), lamp);
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.lamp).toBe(lamp);
  expect(s.bags.mining).toHaveLength(1);
});

it('only gear from its own bag can be equipped', () => {
  const s = newGame(1, 0);
  s.bags.mining.push(gem(s));
  s.bags.battle.push(gear(s, 'ring'));
  expect(equip(s, 'mining', 0)).toBe('invalid');
  expect(equip(s, 'mining', 5)).toBe('invalid');
  expect(equip(s, 'battle', 0)).toBe('ok');
});

it('unequipping needs room in the bag', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = pick;
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
  expect(unequip(s, 'pickaxe')).toBe('bagFull');
  expect(s.equipped.mining.pickaxe).toBe(pick);
  s.bags.mining.pop();
  expect(unequip(s, 'pickaxe')).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBeUndefined();
  expect(s.bags.mining.at(-1)).toBe(pick);
  expect(unequip(s, 'pickaxe')).toBe('invalid');
});

it('selling and salvaging pay out and remove the item', () => {
  const s = newGame(1, 0);
  s.stash.push(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }));
  s.bags.mining.push(gear(s, 'boots', { rarity: 'rare', ilvl: 10 }));
  expect(sell(s, 'stash', 0)).toBe('ok');
  expect(salvage(s, 'mining', 0)).toBe('ok');
  expect([s.gold, s.diamonds, s.stash.length, s.bags.mining.length]).toEqual([300, 12, 0, 0]);
  expect(sell(s, 'stash', 0)).toBe('invalid');
});

it('items move between the bags and the stash within the rules', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  const ruby = gem(s);
  s.bags.mining.push(pick, ruby);
  expect(moveItem(s, 'mining', 0, 'stash')).toBe('ok');
  expect(moveItem(s, 'stash', 0, 'battle')).toBe('invalid');
  expect(moveItem(s, 'mining', 0, 'battle')).toBe('ok');
  expect(s.bags.battle).toEqual([ruby]);
  expect(moveItem(s, 'stash', 0, 'stash')).toBe('invalid');
  for (let i = 0; i < STASH_SIZE - 1; i++) s.stash.push(gem(s));
  expect(moveItem(s, 'battle', 0, 'stash')).toBe('stashFull');
});

it('a socketed gem stays in its item and counts toward stats', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { sockets: 1 });
  s.equipped.mining.pickaxe = pick;
  s.bags.mining.push(gem(s, 'ruby', { ilvl: 4 }), gem(s, 'emerald'));
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('ok');
  expect([pick.gems.length, s.bags.mining.length]).toEqual([1, 1]);
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.12);
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('noSocket');
  expect(socketGem(s, 'mining', 0, 'lamp')).toBe('invalid');
});

it('a better lamp reveals more metres at once, and taking it off keeps their rolls', () => {
  const s = newGame(1, 0);
  s.bags.mining.push(gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 3 } }));
  expect(equip(s, 'mining', 0)).toBe('ok');
  expect(Object.keys(s.ahead).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  const rolls = structuredClone(s.ahead);
  expect(unequip(s, 'lamp')).toBe('ok');
  expect(s.ahead).toEqual(rolls);
});
```

```ts
// tests/store/gameStore.test.ts: add the imports, then append
import { BAG_SIZE, MAX_LOOT_RULES, STASH_SIZE } from '../../src/core/balance';
import type { LootRule } from '../../src/core/types';
import { gem } from '../helpers/items';

describe('inventory intents', () => {
  it('an action bumps the version and lets held loot into the room it made', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.settings.bagFull = 'stop';
    for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
    for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gem(s));
    const held = gem(s, 'emerald');
    s.overflow.push({ bag: 'mining', item: held });
    const v = store.version;
    expect(store.sell('mining', 0)).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(s.overflow).toEqual([]);
    expect(s.bags.mining.at(-1)).toBe(held);
  });

  it('a refused action changes nothing', () => {
    const { store } = make();
    store.load();
    const v = store.version;
    expect(store.unequip('pickaxe')).toBe('invalid');
    expect(store.version).toBe(v);
  });

  it('settings keep at most 20 rules, and switching to sellWorst drains held loot', () => {
    const { store } = make();
    store.load();
    const rule: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
    store.setLootFilter(Array.from({ length: 25 }, () => rule));
    expect(store.state.settings.lootFilter).toHaveLength(MAX_LOOT_RULES);
    const s = store.state;
    s.settings.bagFull = 'stop';
    for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
    for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gem(s));
    s.overflow.push({ bag: 'mining', item: gem(s) });
    store.setBagFull('sellWorst');
    expect(s.overflow).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/inventory.test.ts tests/store`.
- [ ] **Step 3: Implement** `inventory.ts` and the store intents.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run typecheck`.
- [ ] **Step 5: Commit**: `git add src tests && git commit -m "Add equip, sell, salvage, stash and socket actions"`

---

### Task 7: Character panel

**Files:**
- Create in `src/ui/character/`: `itemView.ts`, `itemActions.ts`, `useItemPopover.ts`, `ItemCard.tsx`,
  `ItemGrid.tsx`, `PaperDoll.tsx`, `CharacterPanel.tsx`, `character.css`
- Create tests: `tests/ui/itemView.test.ts`, `tests/ui/itemActions.test.ts`
- Modify: `src/sprites/grids.ts`, `tests/sprites/atlas.test.ts`, `src/ui/theme.css`,
  `src/ui/App.tsx`, `src/ui/app.css`

**Interfaces:**
- Consumes: the store intents (Task 6), `itemTotals` / `gemEffect` / `gearTotals` (Task 4),
  `sellValue` / `salvageValue` (Task 5), `itemName` (Task 3).
- Produces, sprites:
  - `SpriteName` gains `pickaxe`, `lamphelm`, `gloves`, `boots`, `maul`, `armor`, `helm`, `ring` and
    `amulet`. These grids are copied verbatim from `this.spr` in `Character.dc.html`.
  - It also gains `sapphire`, `emerald`, `amethyst` and `starstone`. Each is the `gem` grid with these
    `PALETTE_OVERRIDES`:
    - sapphire `{ C: '#b9cbff', c: '#3f6fc8', b: '#24407a' }`
    - emerald `{ C: '#b8f0c8', c: '#3fae6a', b: '#1f6b3d' }`
    - amethyst `{ C: '#e0d0ff', c: '#8a6fe0', b: '#4b3a8a' }`
    - starstone `{ C: '#fff6d0', c: '#e8d27a', b: '#9a7a2a' }`
  - `ruby` already exists.
- Produces, `itemView.ts` (pure):
  - `SLOT_LABELS`: Pickaxe, Lamp helm, Gloves, Boots, Weapon, Armor, Helm, Ring, Amulet.
  - `STAT_LABELS: Record<StatKey, { label: string; unit: '' | '%' | ' m' | ' min' }>`:
    - digPower `dig power` (no unit)
    - goldYield `Gold yield` %
    - diamondYield `Diamond yield` %
    - chestFind `chest find` %
    - gemFind `gem find` %
    - mapFind `map find` %
    - lampSight `lamp sight` (unit ` m`)
    - ticksPerClick `tick per click` (no unit)
    - autoTickRate `auto tick rate` %
    - offlineCap `offline cap` (unit ` min`)
    - damage `damage` (no unit)
    - damagePct `damage` %
    - attackSpeed `attack speed` %
    - life `life` (no unit)
    - armor `armor` (no unit)
    - critChance `crit chance` %
    - resistAll `all resistances` %
    - soulFind `Soul find` %
    - magicFind `magic find` %
  - `statText(stat, value)`. The sign is `+`, or `−` (U+2212) for a negative value. The number is
    `formatNumber(|value|)`. The text is `<sign><n>% <label>`, `<sign><n><unit> <label>`, or
    `<sign><n> <label>` when there is no unit.
  - `type Tone = 'plain' | 'up' | 'down' | 'gem' | 'muted'` and
    `interface ViewLine { text: string; tone: Tone }`.
  - `itemKindLine(item)`:
    - Gear: `<Rarity> <slot label, lower case> · item level <n>`, plus ` · <gems>/<sockets> sockets`
      when it has sockets.
    - A gem: `Gem · item level <n> · socket into any gear`.
  - `itemLines(item): ViewLine[]`.
    - **Gear**, in this order:
      - the implicit;
      - each affix, `down` when negative;
      - each socketed gem as `<gemName>: <statText(gemEffect)>`, tone `gem`;
      - `plural(empty, 'empty socket', 'empty sockets')` in `muted`, when any socket is empty.
    - **A gem:** `In mining gear: …` and `In battle gear: …`.
  - `compareLines(item: GearItem, worn: GearItem | undefined): { title: string; lines: ViewLine[] }`.
    - It compares `itemTotals` of both: the item's keys first, then the keys only the worn item has.
    - Zero differences are skipped. Each difference shows as `statText(stat, delta)`, `up` or `down`.
    - The title is `If equipped, instead of <worn.name>:`, or `If equipped (the slot is empty):`.
  - `miningStatLine(stats, deepest)`:
    `Dig <formatRate(m/min)> m/min · chest find <formatRate(%)>% · gem find …% · map find …% · lamp sight <n> m · offline cap <formatDuration>`.
    Here `m/min = autoTicksPerSecond × 60 × digPower / (hardness(deepest + 1) × TICKS_PER_METRE_AT_PARITY)`.
  - `battleStatLine(totals)` is `Battle gear: ` followed by the non-zero totals in `BATTLE_STATS` order,
    joined with ` · `. With none it reads `Battle gear: nothing equipped yet`.
  - `placeTooltip(anchor: { left; top; width; height }, containerWidth): { left; top }` is
    `left = max(0, min(anchor.left, containerWidth − 270))` and `top = anchor.top + anchor.height + 4`.
  - `clickIntent({ altKey, shiftKey, detail, pointerType }): 'primary' | 'sell' | 'move' | 'menu'`.
    - A touch (`pointerType === 'touch'`) or a keyboard click (`detail === 0`) gives `menu`.
    - Otherwise Alt gives `sell`, Shift gives `move`, and anything else gives `primary`.
  - `itemSprite(item)` and `baseSprite(base: Slot | GemType)` map slots to the icons above. The weapon
    uses `maul` and the lamp uses `lamphelm`.
  - `lootNoteText(note)`:
    - bag → `to bag`
    - stash → `to stash`
    - sold → `sold +<n> Gold`
    - salvaged → `salvaged +<plural(n, 'Diamond', 'Diamonds')>`
    - held → `waiting for space`
- Produces, `itemActions.ts` (pure, except `runAction`):
  - `type ItemTarget = { where: 'bag'; set: GearSet; index: number } | { where: 'stash'; index: number } | { where: 'worn'; slot: Slot }`
  - `interface ActionSpec { id: 'equip' | 'unequip' | 'sell' | 'salvage' | 'toStash' | 'toBag' | 'socket'; label: string; disabled: boolean; slot?: Slot }`.
    The `slot` key is present only on `socket`.
  - `itemActions(state, target, shownSet): ActionSpec[]`, in this order:
    - **bag gear:** Equip, Sell, Salvage, To stash
    - **bag gem:** Socket into… (one per worn item with an open socket, `MINING_SLOTS` then
      `BATTLE_SLOTS`), Sell, Salvage, To stash
    - **stash item:** To bag, then the sockets (gems only), Sell, Salvage
    - **worn item:** Unequip
  - `itemActions` labels and states:
    - `Sell (+<n> Gold)`
    - `Salvage (+<plural(n, 'Diamond', 'Diamonds')>)`
    - `Socket into <name> (<statText(gemEffect(gem, set))>)`
    - "To stash" is disabled when the stash is full. "To bag" and "Unequip" are disabled when the
      target bag is full.
    - From the stash, a gem goes to `shownSet`'s bag and gear goes to its own set's bag.
  - `actionForIntent(actions, target, intent): ActionSpec | 'menu' | undefined`:
    - `menu` gives `'menu'`.
    - `sell` gives the `sell` spec.
    - `move` gives the `toStash` or `toBag` spec.
    - `primary` gives `equip` for bag gear, `'menu'` for a bag gem, `unequip` for worn items, and
      `toBag` for the stash.
    - It returns disabled specs too, so the store's refusal produces the message.
  - `hoverNote(target, item): string`:
    - bag gear: `Click to equip · Alt+click to sell · Shift+click to stash`
    - bag gem: `Click to socket · Alt+click to sell · Shift+click to stash`
    - worn: `Click to unequip`
    - stash: `Click to move to your bag · Alt+click to sell`
  - `runAction(store, target, action, shownSet): InvResult` calls the matching store intent.
  - `resultText(r)`:
    - bagFull → `That bag is full.`
    - stashFull → `The stash is full.`
    - noSocket → `That item has no open socket.`
    - `ok` / `invalid` → `null`
- Produces, `useItemPopover(containerRef)`. It holds the hovered target and the open menu target, each
  with an anchor from `placeTooltip` measured against the container's bounding box.
  - `inspect(target, el)` and `clear()` handle mouse enter, mouse leave, focus and blur.
  - `openMenu(target, el)` and `closeMenu()` handle the action card.
  - Hover is ignored while a menu is open.
  - The menu closes on Escape (handled on the card, which stops propagation so an enclosing dialog
    stays open), on a pointerdown outside the card, and after an action.
- Behaviour (match the Character board):
  - `App` lays out `main` as a wrapping flex row with a 20 px gap and `max-width: 1440px`.
    - `.gm-app__play` (`flex: 999 1 640px`) holds `MineView`.
    - `.gm-app__side` (`flex: 1 1 420px; max-width: 480px`) holds `CharacterPanel`.
  - **CharacterPanel:**
    - The heading is "Character", with a set toggle (`role="group"`, `aria-label="Gear set"`, buttons
      with `aria-pressed`, each ≥ 44 px): "Mining set" / "Battle set".
    - **PaperDoll:**
      - Mining puts pickaxe and gloves on the left, lamp and boots on the right. Battle puts weapon and
        armor on the left, helm, ring and amulet on the right.
      - A filled slot is a 60 px button with a 2 px rarity border and the icon at scale 4. Its
        `aria-label` is `<Slot>: <name>`. Hover shows the tooltip with the `Click to unequip` note, and
        a primary click unequips.
      - An empty slot is a dashed box.
      - Each slot has a label underneath.
      - The miner sits in the middle at scale 6, in a 132×168 rounded box.
      - Socket dots: up to 3 small dots on each filled slot and bag cell. A dot is filled in its gem's
        colour, or hollow when empty.
    - **Stat line:** `miningStatLine` or `battleStatLine`.
    - **Bag:** the heading is "Mining bag <n> / 24" or "Battle bag <n> / 24". `ItemGrid` shows 24
      cells with `grid-template-columns: repeat(6, minmax(44px, 52px))` and a 6 px gap.
      - A filled cell is a button with its rarity border and the icon at scale 3. Its `aria-label` is
        the item's name.
      - An empty cell is a dim box.
    - **Tooltips** (`ItemCard`, 270 px, colours from the board):
      - name in the rarity colour, the kind line, then the lines;
      - for gear in the bag or stash, the compare block;
      - the hover note.
    - **Clicks** follow `clickIntent` → `actionForIntent`. `onPointerDown` records the pointer type for
      the following click. Right-click (`onContextMenu`, with `preventDefault`) opens the menu.
    - **The menu** is the same `ItemCard` with `role="dialog"` and one ≥ 44 px button per action, plus
      Close. Its first button takes focus when it opens.
    - A refused action shows `resultText` in a `role="status"` line.
    - The hint under the bag: "Hover an item to inspect it, click to equip. Alt+click sells,
      Shift+click stashes, right-click shows everything. On a touch screen, tap an item."
  - **CSS:**
    - The panel padding is 16 px, or 12 px at ≤ 600 px, so the 6-column grid fits at 390 px.
    - Rarity colours use `data-rarity` attributes and the new tokens `--gm-normal`, `--gm-gem`,
      `--gm-up` and `--gm-down` in `theme.css`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/sprites/atlas.test.ts: in 'every grid is rectangular…', add
for (const g of ['sapphire', 'emerald', 'amethyst', 'starstone'] as const) expect(GRIDS[g]).toEqual(GRIDS.gem);
```

```ts
// tests/ui/itemView.test.ts
import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals } from '../../src/core/stats';
import { battleStatLine, clickIntent, compareLines, itemKindLine, itemLines, lootNoteText, miningStatLine, placeTooltip, statText } from '../../src/ui/character/itemView';
import { gear, gem } from '../helpers/items';

it('stat text', () => {
  expect(statText('chestFind', 12)).toBe('+12% chest find');
  expect(statText('chestFind', -10)).toBe('−10% chest find');
  expect(statText('lampSight', 4)).toBe('+4 m lamp sight');
  expect(statText('offlineCap', 60)).toBe('+60 min offline cap');
  expect(statText('ticksPerClick', 1)).toBe('+1 tick per click');
  expect(statText('damage', 1234)).toBe('+1,234 damage');
});

it('kind lines', () => {
  const s = newGame(1, 0);
  expect(itemKindLine(gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, sockets: 2, gems: [gem(s)] }))).toBe('Rare pickaxe · item level 4 · 1/2 sockets');
  expect(itemKindLine(gear(s, 'lamp', { rarity: 'normal', ilvl: 1 }))).toBe('Normal lamp helm · item level 1');
  expect(itemKindLine(gem(s, 'ruby', { ilvl: 5 }))).toBe('Gem · item level 5 · socket into any gear');
});

it('item lines list the implicit, affixes, gems and empty sockets', () => {
  const s = newGame(1, 0);
  const item = gear(s, 'pickaxe', {
    implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'chestFind', value: -10 }],
    sockets: 2, gems: [gem(s, 'ruby', { ilvl: 4 })],
  });
  expect(itemLines(item)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: '−10% chest find', tone: 'down' },
    { text: 'Small Ruby: +12% Gold yield', tone: 'gem' },
    { text: '1 empty socket', tone: 'muted' },
  ]);
  expect(itemLines(gem(s, 'ruby', { ilvl: 4 }))).toEqual([
    { text: 'In mining gear: +12% Gold yield', tone: 'plain' },
    { text: 'In battle gear: +8% damage', tone: 'plain' },
  ]);
});

it('compares against the worn item', () => {
  const s = newGame(1, 0);
  const worn = gear(s, 'pickaxe', { name: 'Stonebiter', implicit: { stat: 'digPower', value: 18 }, affixes: [{ stat: 'diamondYield', value: 6 }] });
  const next = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 26 }, affixes: [{ stat: 'ticksPerClick', value: 1 }, { stat: 'chestFind', value: -10 }] });
  expect(compareLines(next, worn)).toEqual({
    title: 'If equipped, instead of Stonebiter:',
    lines: [
      { text: '+8 dig power', tone: 'up' },
      { text: '+1 tick per click', tone: 'up' },
      { text: '−10% chest find', tone: 'down' },
      { text: '−6% Diamond yield', tone: 'down' },
    ],
  });
  expect(compareLines(next, undefined).title).toBe('If equipped (the slot is empty):');
});

it('summarises each set', () => {
  const s = newGame(1, 0);
  expect(miningStatLine(deriveStats(s), s.deepest)).toBe('Dig 2.4 m/min · chest find 6% · gem find 3% · map find 4% · lamp sight 2 m · offline cap 8h 0m');
  expect(battleStatLine(gearTotals(s, 'battle'))).toBe('Battle gear: nothing equipped yet');
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 }, affixes: [{ stat: 'critChance', value: 5 }] });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 } });
  expect(battleStatLine(gearTotals(s, 'battle'))).toBe('Battle gear: +14 damage · +30 armor · +5% crit chance');
});

it('keeps the tooltip inside the panel', () => {
  expect(placeTooltip({ left: 0, top: 0, width: 52, height: 52 }, 342)).toEqual({ left: 0, top: 56 });
  expect(placeTooltip({ left: 290, top: 116, width: 52, height: 52 }, 342)).toEqual({ left: 72, top: 172 });
});

it('reads what a click means', () => {
  const base = { altKey: false, shiftKey: false, detail: 1, pointerType: 'mouse' };
  expect(clickIntent(base)).toBe('primary');
  expect(clickIntent({ ...base, altKey: true })).toBe('sell');
  expect(clickIntent({ ...base, shiftKey: true })).toBe('move');
  expect(clickIntent({ ...base, detail: 0 })).toBe('menu');
  expect(clickIntent({ ...base, pointerType: 'touch', altKey: true })).toBe('menu');
});

it('loot notes in words', () => {
  const n = { name: 'X', rarity: 'magic', base: 'pickaxe' } as const;
  expect(lootNoteText({ ...n, outcome: 'sold', value: 48 })).toBe('sold +48 Gold');
  expect(lootNoteText({ ...n, outcome: 'salvaged', value: 1 })).toBe('salvaged +1 Diamond');
  expect(lootNoteText({ ...n, outcome: 'stash', value: 0 })).toBe('to stash');
  expect(lootNoteText({ ...n, outcome: 'held', value: 0 })).toBe('waiting for space');
});
```

```ts
// tests/ui/itemActions.test.ts
import { expect, it } from 'vitest';
import { STASH_SIZE } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import { actionForIntent, hoverNote, itemActions, resultText } from '../../src/ui/character/itemActions';
import { gear, gem } from '../helpers/items';

it('a bag item offers equip, sell, salvage and stash', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bags.mining.push(pick);
  const t = { where: 'bag', set: 'mining', index: 0 } as const;
  expect(itemActions(s, t, 'mining')).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'sell', label: 'Sell (+48 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Diamonds)', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  expect(hoverNote(t, pick)).toBe('Click to equip · Alt+click to sell · Shift+click to stash');
});

it('a gem offers a socket in each worn item with room', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { name: 'Stonebiter', sockets: 1 });
  s.equipped.battle.helm = gear(s, 'helm', { name: 'Grim Visor', sockets: 2, gems: [gem(s), gem(s)] });
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  s.bags.mining.push(gem(s, 'ruby', { ilvl: 4 }));
  expect(itemActions(s, { where: 'bag', set: 'mining', index: 0 }, 'mining').map((a) => a.label)).toEqual([
    'Socket into Stonebiter (+12% Gold yield)',
    'Socket into Brass Loop (+8% damage)',
    'Sell (+80 Gold)',
    'Salvage (+2 Diamonds)',
    'To stash',
  ]);
});

it('worn and stashed items, a full stash, and what clicks do', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.stash.push(gear(s, 'boots', { rarity: 'normal', ilvl: 2 }));
  expect(itemActions(s, { where: 'worn', slot: 'pickaxe' }, 'mining')).toEqual([{ id: 'unequip', label: 'Unequip', disabled: false }]);
  expect(itemActions(s, { where: 'stash', index: 0 }, 'battle').map((a) => [a.id, a.label])).toEqual([
    ['toBag', 'To bag'], ['sell', 'Sell (+10 Gold)'], ['salvage', 'Salvage (+1 Diamond)'],
  ]);
  for (let i = 0; i < STASH_SIZE - 1; i++) s.stash.push(gem(s));
  s.bags.mining.push(gear(s, 'gloves'), gem(s));
  const t0 = { where: 'bag', set: 'mining', index: 0 } as const;
  const t1 = { where: 'bag', set: 'mining', index: 1 } as const;
  const a0 = itemActions(s, t0, 'mining');
  const a1 = itemActions(s, t1, 'mining');
  expect(a0.find((a) => a.id === 'toStash')?.disabled).toBe(true);
  expect(actionForIntent(a0, t0, 'primary')).toMatchObject({ id: 'equip' });
  expect(actionForIntent(a1, t1, 'primary')).toBe('menu');
  expect(actionForIntent(a1, t1, 'sell')).toMatchObject({ id: 'sell' });
  expect(actionForIntent(a0, t0, 'move')).toMatchObject({ id: 'toStash', disabled: true });
  expect(resultText('stashFull')).toBe('The stash is full.');
  expect(resultText('ok')).toBeNull();
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/ui tests/sprites`.
- [ ] **Step 3: Implement** the sprites, `itemView.ts`, `itemActions.ts`, `useItemPopover.ts`, the
  components, the CSS and the `App` layout.
- [ ] **Step 4: Run them and see them pass**: `npm test && npm run build`.
- [ ] **Step 5: Look at it.** Run `npm run dev`. Check desktop and 390 px; a headless Chrome screenshot
  of each is enough when no browser is at hand.
  - The panel sits beside the mine on desktop and below it at 390 px.
  - The bag shows six columns without horizontal scrolling.
  - Hovering a bag item shows the tooltip with "If equipped".
- [ ] **Step 6: Commit**: `git add src tests && git commit -m "Add the character panel: paper doll, bag, tooltips and item actions"`

---

### Task 8: Stash, loot filter, and loot in the feed and summary

**Files:**
- Create: `src/ui/character/lootFilterView.ts`, `src/ui/character/StashDialog.tsx`,
  `src/ui/character/LootFilterDialog.tsx`, `tests/ui/lootFilterView.test.ts`
- Modify: `src/ui/character/CharacterPanel.tsx`, `src/ui/character/character.css`,
  `src/ui/mine/FindsFeed.tsx`, `src/ui/mine/MineView.tsx`, `src/ui/mine/mine.css`,
  `src/ui/OfflineSummary.tsx`, `README.md`

**Interfaces:**
- Consumes: `ItemGrid`, `ItemCard`, `useItemPopover`, `itemActions` and `lootNoteText` (Task 7);
  `store.setLootFilter`, `store.setBagFull` and the inventory intents (Task 6).
- Produces, `lootFilterView.ts` (pure; never mutates its input):
  - `NEW_RULE: LootRule = { rarity: 'normal', target: 'any', action: 'sell' }`.
  - `addRule(rules)` appends `NEW_RULE` unless there are already `MAX_LOOT_RULES` rules.
  - `removeRule(rules, i)`.
  - `moveRule(rules, i, delta)` returns the same array when the move would leave the list.
  - `updateRule(rules, i, patch: Partial<LootRule>)`.
  - Option labels:
    - `RARITY_OPTIONS`: Any rarity, Normal, Magic, Rare, Legendary.
    - `TARGET_OPTIONS`: Any item, Mining gear, Battle gear, Gems, then the nine slot labels.
    - `ACTION_OPTIONS`: Keep, Sell for Gold, Salvage for Diamonds.
- Behaviour:
  - **CharacterPanel:** the bag heading gains two buttons, "Loot filter" and
    "Stash <n> / <STASH_SIZE>".
  - **StashDialog:**
    - It uses the `gm-overlay` / `gm-dialog` pattern and `useDialog`. The title is
      "Stash <n> / 60", with a Close button.
    - An `ItemGrid` shows every `STASH_SIZE` cell, using
      `repeat(auto-fill, minmax(44px, 52px))` columns.
    - Tooltips, clicks, right-click and the menu work as in the panel, with targets
      `{ where: 'stash', index }` and the panel's current set as `shownSet`.
    - Refusals show `resultText` in a status line.
  - **LootFilterDialog:**
    - The title is "Loot filter". The intro reads: "Rules run from the top for every item you find.
      The first rule that matches decides what happens to it. Items no rule matches are kept. Worn
      gear is never touched."
    - **Rule rows:**
      - each row has three `<select>`s, labelled "Rarity", "Item" and "Action";
      - ↑, ↓ and ✕ buttons, labelled "Move rule up", "Move rule down" and "Remove rule";
      - every control is ≥ 44 px, and the row wraps on phones.
    - **Add rule** adds a rule. When the list is full, the button is disabled and the dialog shows
      "20 rules is the most."
    - A fieldset, "When the bag and the stash are both full", holds two radios:
      - "Sell the cheapest item and keep digging" (`sellWorst`);
      - "Stop digging until there is room" (`stop`).
    - Every change calls `store.setLootFilter` or `store.setBagFull` at once.
  - **FindsFeed:**
    - Key each entry on `f.id`.
    - A find with `loot` reads `Chest:` or `Gem:`, followed by each note as the item name in its rarity
      colour, then `(<lootNoteText>)` in muted text.
  - **MineView:** while `state.overflow.length > 0`, a `role="status"` banner above the scene reads:
    "Your bags and the stash are full, so digging has stopped. Sell, salvage or stash something to
    carry on."
  - **OfflineSummary:**
    - When any items arrived: "Items: <kept> kept · <sold> sold · <salvaged> salvaged".
    - When `stoppedFull`: "Digging stopped because your bags and the stash were full."
  - **README:** a short "Gear" section.
    - Chests and gems drop mining and battle gear, which the character panel shows.
    - Hover compares, click equips, Alt+click sells, Shift+click stashes, and right-click or a tap shows
      every action.
    - The loot filter sells or salvages new items by rule.

- [ ] **Step 1: Write the failing test** in `tests/ui/lootFilterView.test.ts`

```ts
import { expect, it } from 'vitest';
import type { LootRule } from '../../src/core/types';
import { NEW_RULE, addRule, moveRule, removeRule, updateRule } from '../../src/ui/character/lootFilterView';

it('edits the rule list without mutating it', () => {
  const a: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
  const b: LootRule = { rarity: 'any', target: 'gem', action: 'salvage' };
  const rules = [a, b];
  expect(moveRule(rules, 1, -1)).toEqual([b, a]);
  expect(moveRule(rules, 0, -1)).toBe(rules);
  expect(removeRule(rules, 0)).toEqual([b]);
  expect(updateRule(rules, 1, { action: 'keep' })).toEqual([a, { ...b, action: 'keep' }]);
  expect(addRule(rules)).toEqual([a, b, NEW_RULE]);
  expect(rules).toEqual([a, b]);
  expect(addRule(Array.from({ length: 20 }, () => a))).toHaveLength(20);
});
```

- [ ] **Step 2: Run it and see it fail**: `npx vitest run tests/ui/lootFilterView.test.ts`.
- [ ] **Step 3: Implement** `lootFilterView.ts`, the two dialogs, and the panel, feed, banner, summary
  and README changes.
- [ ] **Step 4: Verify**: `npm test && npm run typecheck && npm run build`. Everything passes and
  `dist/` builds.
- [ ] **Step 5: Smoke check** with `npm run dev`, on desktop and at 390 px:
  - After some digging a chest drops. The feed shows "Chest:" with item names in rarity colours, and
    the bag fills.
  - **The mouse in the bag:**
    - Hovering a bag item shows its stats and the "If equipped" changes.
    - Click equips. The doll and the stat line change; a pickaxe changes "Dig … m/min".
    - Alt+click sells and the header Gold rises.
    - Shift+click moves the item to the stash.
    - Right-click shows every action, and Salvage adds Diamonds.
  - **Gems:** clicking a gem lists the worn items with open sockets. Socketing fills a socket dot.
  - **Stash:** it opens with the stashed items, and a click sends one back to the bag.
  - **Loot filter:** add "Normal · Any item · Sell for Gold". The next normal item shows
    "sold +N Gold" in the feed.
  - **Phone, 390 px:** no horizontal scrolling. A tap opens the action card and never equips.
  - **Keyboard:** Tab to a bag item and its tooltip shows. Enter opens the card, and Escape closes it
    without closing the stash dialog.
  - **Plan 1's checks:** climbing back with the minimap (now also with the arrow keys), and
    export → Start over → import.
- [ ] **Step 6: Commit**: `git add src tests README.md && git commit -m "Add the stash, the loot filter and loot reports"`
