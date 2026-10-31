# Plan 11: The passive web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the points the miner earns on every level into a passive skill web.

- One passive web, drawn from mockup board 3A: a start node in the middle, mining nodes on one side, battle nodes on the other, hybrid nodes along the bottom.
- A node costs one point, and can only be allocated next to an already-allocated node (the start node is always allocated and costs nothing).
- Node kinds: **small** (+stat), **notable** (a named bonus), **keystone** (changes a rule, with a downside).
- The miner has `level − 1` points to spend (59 at the cap), and the web holds about 140 nodes, so 60 points cover well under half of it.
- Respec: refunding a single node costs Gold (scaling with level); a full reset costs Diamonds. Ascension (Plan 12) clears the web.

**Architecture:**

- **Data-driven web.** `passives.ts` holds the whole web as one table of nodes (`id`, `name`, `kind`, `side`, `x`/`y`, `links`, `effects`, `desc`). Nothing else knows the layout.
- **Effects.** A node's effects are small pieces of a discriminated union. `stat` effects add to the same `StatKey` vocabulary gear uses, so `deriveStats` and `deriveBattleStats` fold them in exactly as gear does. `keystone` effects are rule changes read by name where they act. `gemStack`, `materialStack` and `stashPages` are structural and read by the inventory and the stash.
- **State.** `state.passives = { allocated: string[] }` — the allocated node ids, in allocation order. Nothing else is stored: points, adjacency and the free-stash-page count are all derived, so a save can never disagree with its own web.
- **Save schema 11.** `MIGRATIONS[10]` adds an empty `passives`. Old saves keep their level and start with no nodes allocated and every point unspent.
- **Store.** `allocate`, `refund`, `resetWeb` intents; they spend nothing but a point, or Gold/Diamonds for the respecs, and re-derive stats through the existing `changed()`.

**Tech stack:** unchanged: Node 24, TypeScript 7, Vite 8, React 19, Vitest 5, lz-string. No new dependencies.

**Spec:**
- `2026-10-23-golden-miner-revival-design.md` §4.5 (the passive web) and §5 (the Skills screen, tab bar).
- `2026-10-24-round-2-seeds-procedural-inventory-design.md` §7.4 (a node raises the gem bag stack).
- `2026-10-24-round-3-economy-inventory-crafting-design.md` §3.3 (a node raises the material bag stack), §3.5 (hazard ward appears on passive nodes), §4.2 (nodes add stash pages), §8 (this is Plan 9 → now Plan 11).
- Layout and look from `.superpowers/mockups/project/SkillsWeb.dc.html` (board 3A; `SkillsTiers` and `SkillsRanks` are the rejected 3B/3C and are reference only).

**Mockups:** https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR, board "Skills" (3A). The rejected boards give names worth reusing but not the structure.

**Builds on:** Plan 10 (`dev-ernest` at the PR #10 merge). The level/XP machinery (`levels.ts`), the stat pipeline (`stats.ts`, `battle.ts`), the store (`gameStore.ts`) and the header/Nav are all in place.

**Roadmap:** this is plan 11 of 13.
1. Foundation + digging · 2. Items + character screen · 3. Seeds and the mine · 4. Inventory round 2 · 5. Maps, combat, levels · 6. Economy and inventory · 7. Items and crafting · 8. Maps, Souls and the merchant · 9. Play feedback I · 10. Merchants, uniques, maps and the filter · 11. **The passive web** (this plan) · 12. Auto-mapping and ascension · 13. Balance and launch.

## Global Constraints

- Static site: TypeScript + Vite + React, no backend, no new dependencies.
- Node 24. Prefix every command with `export PATH=/usr/local/bin:$PATH`; `npx vitest run` and `npx tsc --noEmit` are clean at the end of every task.
- `tsconfig` is unchanged. Tests read fixtures only through Vite `?raw` imports.
- Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call `Date.now()` / `Math.random()`. Randomness comes from `state.rng`, through `nextRandom` / `pickWeighted` in `src/core/rng.ts`. The passive web is deterministic: it draws nothing from `state.rng`, so allocating a node never changes the loot stream.
- **Readable numbers:** every number shown goes through `formatNumber` (whole numbers) or `formatRate` (rates). Every passive bonus is an integer or a whole percent; nothing compounds in a way that breaks the under-~1,000,000 line.
- **No login pressure.** A node stays allocated until the player refunds it; nothing expires.
- **Saves:** `SCHEMA_VERSION = 11`; schemas 1–10 migrate. The fixtures `tests/fixtures/save-schema-1.txt` … `save-schema-9.txt` are never regenerated or edited; Task 1 adds `save-schema-10.txt`, generated from the Plan 10 engine before any Plan 11 change. An impossible web decodes as `invalid`.
- Phones: the Skills view pans and pinch-zooms and has a node search box; every tappable node and button is ≥ 44 px.
- Pixel art: integer scaling; the web's node circles, colours and keystone squares copy board 3A verbatim.
- **Look:** the Skills board's tones — mining `#e8b44a` on `#3a2c12`, battle `#ff8a7a` on `#3a1c18`, hybrid `#7fd3e8` on `#16323a`, start `#f1e9dc` on `#29221d`, unallocated border `#4a3f36` on `#15120f`, edge line `#3a3029`.
- `prefers-reduced-motion: reduce` turns off any pan/zoom smoothing; the web itself is static.
- **Where things live:** tunable numbers in `src/core/balance.ts`; the web in `src/core/passives.ts`; the node descriptions' copy in `src/core/passives.ts` too (no copy in the UI).
- No `!` non-null assertions in `src/`.
- Git: work on `dev-ernest`. Stage explicit file paths. Commit messages are short imperative sentences with no Claude/Anthropic attribution. Never push.
- **README:** each task that changes play updates its paragraph in the README's existing voice.

## Review Focus

1. **Old saves.** A schema-10 save loads with `passives: { allocated: [] }`, its level, XP and everything else untouched, and its every point unspent. Task 1 tests this on the real fixture.
2. **Adjacency and refunds.** A node is allocatable only next to an allocated node (the start counts); a node is refundable only while its removal leaves every remaining node still connected to the start. A hand-edited save with a detached node, a duplicate id, or more nodes than `level − 1` decodes `invalid`. Task 1 and Task 5 test each.
3. **Keystones trade off.** Earthshaker digs three times as much per click but a third slower automatically; Berserker hits half again as hard but keeps no armor; Soul Reaper doubles Souls but cuts life a fifth. Every downside is real and shows in the derived stats. Task 3 tests each.
4. **Stacks and free pages.** Gem Pouch and Ore Cart raise what a bag cell holds of a gem or material, and a save with a stack over the base cap but under the new cap stays valid; Deep Pockets adds two free General pages, and a refund refuses while they hold items. Task 4 tests each.
5. **The web never touches the loot stream.** Allocating or refunding any node leaves `state.rng` (and `state.uniqueRng`) byte-identical; the Plan 8 replay tests stay green. Task 3 and Task 5 pin this.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Schema | `SCHEMA_VERSION = 11`, `MIGRATIONS[10]` adds `passives: { allocated: [] }`. `newGame` sets the same. Nothing else changes. |
| Points | `pointsToSpend(state) = max(0, level − 1 − allocated.length)`. The start node is free and always allocated; it is never in `allocated`. |
| Web shape | 140 nodes: 1 start, 8 keystones, 16 notables, 115 smalls. Mining left, battle right, hybrid along the bottom, the start in the middle, matching board 3A's geometry and colours. |
| Adjacency | A node is allocatable when it links to the start or to an allocated node. `canRefund` holds when removing the node leaves every remaining allocated node still connected to the start (a BFS from the start over the allocated subgraph). |
| Effects | `PassiveEffect = { kind: 'stat'; stat: StatKey; value: number } | { kind: 'keystone'; id: KeystoneId } | { kind: 'gemStack'; value: number } | { kind: 'materialStack'; value: number } | { kind: 'stashPages'; value: number }`. `passiveTotals(state)` returns `{ stats: Record<StatKey, number>; gemStack; materialStack; stashPages; keystones: Set<KeystoneId> }`, summed over the allocated nodes. |
| Stat fold | `deriveStats` and `deriveBattleStats` add `passiveTotals(state).stats` into the same per-set totals gear uses. A hybrid node may grant stats of either set; each side reads only its own keys, so the merge is safe. |
| Keystones (8) | **Earthshaker** (mining): clicks dig ×3, auto −30 %. **Cartographer** (mining): maps found 1 tier higher. **Prospector's Luck** (mining): +50 % Diamonds, −20 % Gold. **Berserker** (battle): +50 % damage, no armor. **Soul Reaper** (battle): double Souls, −20 % life. **Bulwark** (battle): armor ×2, −25 % damage. **Deep Pockets** (hybrid): +2 General stash pages. **Two-Way Street** (hybrid): +15 % dig power, +15 % damage, −10 % life. |
| Notables (16) | Mining: Vein Sense (+15 % chest find), Prospector (+20 % Diamonds), Deep Lungs (+2 h offline cap), Ore Sniffer (+20 % ore find), Steady Hands (+1 tick per click). Battle: Thick Skin (+15 % life), Sharpened (+15 % damage), Deadly Aim (+5 % crit chance), Soul Warden (+15 % Soul find), Treasure Hunter (+15 % magic find). Hybrid: Lamp & Blade (+1 tick per click, +0.5 auto ticks/s), Well-Rested (+1 h offline cap, +10 % life), Sure Footing (+8 % dig power, +10 armor), Careful (+15 hazard ward, +10 armor), Gem Pouch (gemStack +10), Ore Cart (materialStack +25). |
| Small nodes | +stat nodes in the values below. Percent stats use the existing `pct()` convention (the value is the percent number); flat stats add directly. A small node is one point, one fixed value, no ranks (ranks were the rejected 3C). |
| Stack caps | `stackCaps(state) = { gem: GEM_BAG_STACK + totals.gemStack, material: MATERIAL_BAG_STACK + totals.materialStack }`. `loot.ts` and `inventory.ts` merge against these; the validator checks a stack against `GEM_BAG_STACK + MAX_PASSIVE_GEM_STACK` (10) and `MATERIAL_BAG_STACK + MAX_PASSIVE_MATERIAL_STACK` (25). |
| Free pages | `freeStashPages(state) = totals.stashPages` (2). Allocating Deep Pockets appends two empty pages to `stash.general`; refunding it is refused while the trailing two pages hold an item. Buying a page appends after, so a refund of Deep Pockets may ask the player to empty the tail first — never to lose an item. |
| Respec | `refundPrice(level) = RESPEC_GOLD_BASE × level`, `RESPEC_GOLD_BASE = 100`. A full reset costs `RESET_WEB_DIAMONDS = 20`. Both spend on success only. |
| Cartographer | In `dig.ts` `collect`, a `map` find calls `addMap(state, tier + 1, depth)`. A map found at the abyss's top tier may exceed 100 000 by 1, so the map's tier is clamped to `MAX_ITEM_LEVEL`. |
| UI | A **Skills** tab (between Inventory and Merchant) and a points line in the header (`N points to spend · level L`, or `No points to spend · level L` at 0). The Skills view is an SVG web with pan, wheel-zoom, pinch, a search box, node hover cards, click-to-allocate/refund, and a **Reset web** button. The start node shows as allocated and is not clickable. |
| Search & phone | The search box filters the node list and scrolls/centres the view on a match; on a phone the web starts fitted to the screen and pans by drag and pinch. |

## Small-node values

Each row is a stat and the value one small node grants. A stat may appear on several nodes; the counts below are the web's budget and are the deliverable (the exact placement is data in `passives.ts`).

| Side | Stat | Value | Count |
|---|---|---|---|
| mining | digPower | +4 | 8 |
| mining | digPowerPct | +6 % | 4 |
| mining | goldYield | +6 % | 4 |
| mining | diamondYield | +6 % | 4 |
| mining | veinYield | +4 % | 4 |
| mining | chestFind | +5 % | 4 |
| mining | gemFind | +5 % | 3 |
| mining | mapFind | +5 % | 3 |
| mining | oreFind | +5 % | 3 |
| mining | lampSight | +1 | 2 |
| mining | autoTickRate | +4 % | 3 |
| mining | ticksPerClick | +0.5 | 2 |
| mining | offlineCap | +30 min | 2 |
| mining | hazardWard | +8 | 2 |
| battle | damage | +4 | 6 |
| battle | damagePct | +6 % | 3 |
| battle | attackSpeed | +4 % | 3 |
| battle | critChance | +2 % | 4 |
| battle | critMultiplier | +6 % | 3 |
| battle | life | +20 | 5 |
| battle | lifePct | +4 % | 3 |
| battle | armor | +20 | 4 |
| battle | armorPct | +6 % | 3 |
| battle | resistAll | +4 | 3 |
| battle | elementalDamage | +4 | 2 |
| battle | lifeRegen | +1 | 2 |
| battle | lifeOnKill | +3 | 1 |
| battle | soulFind | +5 % | 3 |
| battle | magicFind | +5 % | 2 |
| battle | xpFind | +5 % | 1 |
| hybrid | digPower | +3 | 3 |
| hybrid | damage | +3 | 3 |
| hybrid | life | +10 | 4 |
| hybrid | goldYield | +4 % | 3 |
| hybrid | soulFind | +3 % | 3 |
| hybrid | magicFind | +3 % | 3 |

The mining smalls total 48, the battle 48, the hybrid 19 — 115 in all, matching the 140-node web (1 start + 8 keystones + 16 notables + 115 smalls). The exact multiset is fixed in Task 1's data and pinned by a test that sums it.

## File structure

```
src/core/
  passives.ts      NEW  PassiveNode, PassiveEffect, KeystoneId, PASSIVE_NODES, START_NODE_ID,
                         pointsToSpend, canAllocate, canRefund, passiveTotals, hasKeystone, stackCaps, freeStashPages
  balance.ts       MOD  RESPEC_GOLD_BASE, RESET_WEB_DIAMONDS, MAX_PASSIVE_GEM_STACK, MAX_PASSIVE_MATERIAL_STACK
  types.ts         MOD  GameState.passives; (Stats unchanged — passives fold into the existing keys)
  newGame.ts       MOD  passives: { allocated: [] }
  save.ts          MOD  SCHEMA_VERSION 11, MIGRATIONS[10], isPassives + validateState
  stats.ts         MOD  fold passiveTotals into the mining totals; keystone transforms (Earthshaker, Prospector's Luck,
                         Two-Way Street's dig half)
  battle.ts        MOD  fold passiveTotals into the battle totals; keystone transforms (Berserker, Soul Reaper, Bulwark,
                         Two-Way Street's battle half)
  dig.ts           MOD  Cartographer's map tier +1
  loot.ts, inventory.ts   MOD  merge stacks against stackCaps(state)
  stashPages.ts    MOD  freeStashPages-aware refund/price (only the refund guard changes)
src/store/gameStore.ts    MOD  allocate/refund/resetWeb intents
src/ui/
  navView.ts       MOD  Skills tab
  Header.tsx       MOD  points line
  App.tsx          MOD  Skills view routing
  skills/skillsView.ts, skills/SkillsView.tsx, skills/skills.css   NEW
  skills/Web.tsx   NEW  the SVG pan/zoom web
  theme.css, app.css   MOD  Skills colours
tests/
  core/passives.test.ts, core/save.test.ts (schema 11), core/stats.test.ts, core/battle.test.ts,
  core/dig.test.ts (Cartographer), core/respec.test.ts, store/gameStore.test.ts, ui/skillsView.test.ts   NEW/MOD
  fixtures/save-schema-10.txt   NEW  exported from the Plan 10 game when this plan was written
```

---

### Task 1: The web's data, state and save schema 11

**Files:**
- Create: `src/core/passives.ts`, `tests/core/passives.test.ts`.
- Add: `tests/fixtures/save-schema-10.txt` (generated from the Plan 10 engine, before any Plan 11 change — see Global Constraints).
- Modify: `src/core/types.ts`, `src/core/balance.ts`, `src/core/newGame.ts`, `src/core/save.ts`.
- Test: `tests/core/passives.test.ts`, `tests/core/save.test.ts`.

**Interfaces:**
- **`types.ts`:** `GameState` gains `passives: { allocated: string[] }`.
- **`balance.ts`:** `RESPEC_GOLD_BASE = 100`, `RESET_WEB_DIAMONDS = 20`, `MAX_PASSIVE_GEM_STACK = 10`, `MAX_PASSIVE_MATERIAL_STACK = 25`.
- **`passives.ts`:**
  - `export type PassiveKind = 'small' | 'notable' | 'keystone'`; `export type PassiveSide = 'mining' | 'battle' | 'hybrid' | 'start'`.
  - `export type KeystoneId = 'earthshaker' | 'cartographer' | 'prospectorsLuck' | 'berserker' | 'soulReaper' | 'bulwark' | 'deepPockets' | 'twoWayStreet'`.
  - `export type PassiveEffect` per Decisions.
  - `export interface PassiveNode { id: string; name: string; kind: PassiveKind; side: PassiveSide; x: number; y: number; links: string[]; effects: PassiveEffect[]; desc: string }`.
  - `export const START_NODE_ID = 'miner'`.
  - `export const PASSIVE_NODES: readonly PassiveNode[]` — the full 140-node table from the Decisions and the small-node budget. Node ids are camelCase slugs of the node name; the keystone ids are exactly the `KeystoneId` literals, and the notable ids are the slugs the tests below use (`veinSense`, `prospector`, `deepLungs`, `gemPouch`, `oreCart`, …). The start node's `links` reach the first ring of each side; every other node's `links` are the two to four nodes it touches (the web is drawn as rings and diagonals, as in board 3A, so `links` is symmetric — if `a` links `b`, `b` links `a`).
  - `export const PASSIVE_NODE_BY_ID: ReadonlyMap<string, PassiveNode>` built from the table.
  - `export function pointsToSpend(state: Pick<GameState, 'level' | 'passives'>): number` per Decisions.
  - `export function canAllocate(state: Pick<GameState, 'passives'>, id: string): boolean` — the id exists, is not allocated, and links to the start or an allocated node.
  - `export function canRefund(state: Pick<GameState, 'passives'>, id: string): boolean` — the id is allocated, and removing it leaves every remaining allocated node connected to the start (BFS over the subgraph).
  - `export function isConnectedWeb(allocated: readonly string[]): boolean` — the helper both `canRefund` and the validator use: every allocated node is reachable from the start over links that stay inside `{ start } ∪ allocated`.
- **`newGame.ts`:** `passives: { allocated: [] }`.
- **`save.ts`:**
  - `SCHEMA_VERSION = 11`; `MIGRATIONS[10]` adds `passives: { allocated: [] }` to any object (malformed input returned unchanged).
  - `isPassives(x)`: `x.allocated` is an array of unique ids, each in `PASSIVE_NODE_BY_ID`, not the start, at most `LEVEL_CAP − 1` long, and `isConnectedWeb(x.allocated)`.
  - `validateState` adds `isPassives(x.passives)`.

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/core/passives.test.ts
import { expect, it } from 'vitest';
import {
  PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, canRefund, pointsToSpend, type KeystoneId,
} from '../../src/core/passives';
import { newGame } from '../../src/core/newGame';

it('the web is 140 nodes with one start, eight keystones and sixteen notables', () => {
  expect(PASSIVE_NODES).toHaveLength(140);
  const kinds = { start: 0, small: 0, notable: 0, keystone: 0 };
  for (const n of PASSIVE_NODES) kinds[n.kind] += 1;
  expect(kinds).toEqual({ start: 1, small: 115, notable: 16, keystone: 8 });
  expect(PASSIVE_NODES.filter((n) => n.side === 'mining').length).toBeGreaterThan(PASSIVE_NODES.filter((n) => n.side === 'hybrid').length);
});

it('links are symmetric, ids unique, and the start is never linked from itself', () => {
  const ids = new Set(PASSIVE_NODES.map((n) => n.id));
  expect(ids.size).toBe(PASSIVE_NODES.length);
  for (const n of PASSIVE_NODES) {
    for (const l of n.links) {
      expect(ids.has(l), `${n.id} -> ${l}`).toBe(true);
      expect(PASSIVE_NODE_BY_ID.get(l)?.links.includes(n.id), `${l} -> ${n.id}`).toBe(true);
    }
  }
  expect(PASSIVE_NODE_BY_ID.get(START_NODE_ID)?.links.includes(START_NODE_ID)).toBe(false);
});

it('points are level minus one, minus what is spent', () => {
  const s = newGame(1, 0);
  expect(pointsToSpend(s)).toBe(0);
  s.level = 20; s.passives.allocated = ['a', 'b'];
  expect(pointsToSpend(s)).toBe(17);
});

it('a node allocates only next to the start or an allocated node', () => {
  const s = newGame(1, 0);
  const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
  const ring = start.links[0];
  const far = PASSIVE_NODES.find((n) => n.id !== ring && !start.links.includes(n.id))!.id;
  expect(canAllocate(s, ring)).toBe(true);
  expect(canAllocate(s, far)).toBe(false);
  s.passives.allocated = [ring];
  const next = PASSIVE_NODE_BY_ID.get(ring)!.links.find((l) => l !== START_NODE_ID)!;
  expect(canAllocate(s, next)).toBe(true);
});

it('a node refunds only while every other node stays connected to the start', () => {
  const s = newGame(1, 0);
  s.passives.allocated = ['deepLungs', 'earthshaker'];
  expect(canRefund(s, 'deepLungs')).toBe(true);
  expect(canRefund(s, 'earthshaker')).toBe(true);
  expect(canRefund(s, 'nope')).toBe(false);
});
```

```ts
// tests/core/save.test.ts: add
import fixture10 from '../fixtures/save-schema-10.txt?raw';

it('a schema-10 save gains an empty passive web and keeps its level', () => {
  const r = decodeSave(fixture10.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  expect(r.savedAt).toBe(1_762_000_000_000);
  expect(r.state.passives).toEqual({ allocated: [] });
  expect(r.state.level).toBe(4);           // the fixture's level, as generated
});

it('the validator refuses a broken web', () => {
  const s = newGame(1, 0);
  expect(decodeSave(encodeSave(s, 1)).ok).toBe(true);
  const cases: [string, (s: GameState) => void][] = [
    ['a detached node', (s) => { s.passives.allocated = ['prospectorsLuck']; }],      // not next to the start or an allocated node
    ['a duplicate id', (s) => { s.passives.allocated = ['veinSense', 'veinSense']; }],
    ['an unknown id', (s) => { s.passives.allocated = ['notANode']; }],
    ['too many nodes', (s) => { s.passives.allocated = Array.from({ length: s.level }, (_, i) => `n${i}`); }],
  ];
  for (const [name, mutate] of cases) {
    const t = newGame(1, 0);
    t.level = 5;
    mutate(t);
    expect(decodeSave(encodeSave(t, 1)), name).toEqual({ ok: false, reason: 'invalid' });
  }
});
```

`GameState` comes from `src/core/types`; `newGame`, `encodeSave`, `decodeSave` from the existing helpers.

- [ ] **Step 2: Run them and see them fail.** `npx vitest run tests/core/passives.test.ts tests/core/save.test.ts`. Expected: FAIL (no `passives.ts`).
- [ ] **Step 3: Implement** `passives.ts` (author the full table per the Decisions and the small-node budget), `types.ts`, `balance.ts`, `newGame.ts`, then `save.ts` (migration, then validator).
- [ ] **Step 4: Update the README.** Nothing the player sees yet; leave the Gear/Level paragraphs alone.
- [ ] **Step 5: Run everything.** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add tests/fixtures/save-schema-10.txt src/core/passives.ts tests/core/passives.test.ts src/core/types.ts src/core/balance.ts src/core/newGame.ts src/core/save.ts tests/core/save.test.ts && git commit -m "Add the passive web and save schema 11"`.

---

### Task 2: Passive stat totals into the stat pipeline

**Files:**
- Modify: `src/core/passives.ts` (`passiveTotals`), `src/core/stats.ts`, `src/core/battle.ts`.
- Test: `tests/core/stats.test.ts`, `tests/core/battle.test.ts`, `tests/core/passives.test.ts`.

**Interfaces:**
- **`passives.ts`:** `export function passiveTotals(state: Pick<GameState, 'passives'>): { stats: Record<StatKey, number>; gemStack: number; materialStack: number; stashPages: number; keystones: Set<KeystoneId> }` — sums the allocated nodes' `stat` effects into `stats`, adds the `gemStack`/`materialStack`/`stashPages` values, and collects `keystone` ids.
- **`stats.ts`:** `deriveStats` computes `const p = passiveTotals(state)` and, after `gearTotals`, adds each `[stat, value]` of `p.stats` into the mining totals. Keystone transforms for `earthshaker` (after the base `ticksPerClick`/`autoTicksPerSecond` are clamped: `ticksPerClick = clamp(ticksPerClick * 3, 1, MAX_TICKS_PER_CLICK)`, `autoTicksPerSecond = clamp(autoTicksPerSecond * 0.7, MIN_AUTO_TICKS_PER_SECOND, MAX_AUTO_TICKS_PER_SECOND)`), `prospectorsLuck` (`goldMultiplier *= 0.8`, `diamondMultiplier *= 1.5`), and `twoWayStreet`'s dig half (`digPower = clamp(digPower * 1.15, 1, MAX_DIG_POWER)`).
- **`battle.ts`:** `deriveBattleStats` folds `p.stats` into the battle totals, then applies `berserker` (`damageMin = max(damageMin, round(damageMin * 1.5))`, `damageMax = round(damageMax * 1.5)`, `armor = 0`), `soulReaper` (`maxLife = round(maxLife * 0.8)`, `soulMultiplier *= 2`), `bulwark` (`armor = round(armor * 2)`, `damageMin = round(damageMin * 0.75)`, `damageMax = max(damageMin, round(damageMax * 0.75))`), and `twoWayStreet`'s battle half (`damageMin/Max = round(× 1.15)`, `maxLife = round(× 0.9)`).

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/core/stats.test.ts: append
it('allocated mining passives add to the derived stats', () => {
  const s = newGame(1, 0);
  const before = deriveStats(s);
  s.passives.allocated = ['veinSense', 'prospector'];
  const after = deriveStats(s);
  expect(after.featureChances.chest).toBeCloseTo(before.featureChances.chest * 1.15, 6);
  expect(after.diamondMultiplier).toBeCloseTo(before.diamondMultiplier * 1.2, 6);
});

it('Earthshaker digs three times per click but a third slower automatically', () => {
  const s = newGame(1, 0);
  const base = deriveStats(s);
  s.passives.allocated = ['earthshaker'];
  const shaker = deriveStats(s);
  expect(shaker.ticksPerClick).toBe(Math.min(10, base.ticksPerClick * 3));
  expect(shaker.autoTicksPerSecond).toBeCloseTo(base.autoTicksPerSecond * 0.7, 6);
});
```

```ts
// tests/core/battle.test.ts: append
it('allocated battle passives add to the derived battle stats', () => {
  const s = newGame(1, 0);
  const before = deriveBattleStats(s);
  s.passives.allocated = ['thickSkin', 'sharpened'];
  const after = deriveBattleStats(s);
  expect(after.maxLife).toBe(Math.round(before.maxLife * 1.15));
  expect(after.damageMin).toBe(Math.round(before.damageMin * 1.15));
});

it('Berserker, Soul Reaper and Bulwark trade off', () => {
  const s = newGame(1, 0);
  const base = deriveBattleStats(s);
  s.passives.allocated = ['berserker'];
  const berserk = deriveBattleStats(s);
  expect(berserk.armor).toBe(0);
  expect(berserk.damageMin).toBe(Math.round(base.damageMin * 1.5));
  s.passives.allocated = ['soulReaper'];
  const reaper = deriveBattleStats(s);
  expect(reaper.soulMultiplier).toBe(base.soulMultiplier * 2);
  expect(reaper.maxLife).toBe(Math.round(base.maxLife * 0.8));
});
```

- [ ] **Step 2: Run them and see them fail.** `npx vitest run tests/core/stats.test.ts tests/core/battle.test.ts`. Expected: FAIL (passives have no effect yet).
- [ ] **Step 3: Implement** `passiveTotals` and the folds and transforms.
- [ ] **Step 4: Run everything.** `npx vitest run && npx tsc --noEmit`. The existing gear/stat tests still pass, because an empty web adds nothing.
- [ ] **Step 5: Commit.** `git add src/core/passives.ts src/core/stats.ts src/core/battle.ts tests/core/stats.test.ts tests/core/battle.test.ts && git commit -m "Fold passive nodes into the derived stats"`.

---

### Task 3: Keystones that change a rule — Cartographer, and the loot stream

**Files:**
- Modify: `src/core/dig.ts`, `src/core/maps.ts` (clamp only), `tests/core/dig.test.ts`, `tests/core/passives.test.ts`.

**Interfaces:**
- **`dig.ts`:** in `collect`, a `map` find calls `addMap(state, cartographerTier(state, tier), depth)` where `cartographerTier(state, tier) = min(MAX_ITEM_LEVEL, tier + (hasKeystone(state, 'cartographer') ? 1 : 0))`. The find's `kind` and the origin are unchanged; only the map's tier moves.
- **`passives.ts`:** `export function hasKeystone(state: Pick<GameState, 'passives'>, id: KeystoneId): boolean` — `passiveTotals(state).keystones.has(id)`.

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/core/dig.test.ts: append
it('Cartographer finds maps one tier higher, from the same loot stream', () => {
  const plain = newGame(3, 0);
  plain.ahead[1] = { feature: 'map', amount: 0, hardRock: false };
  plain.passives.allocated = [];
  const carto = newGame(3, 0);
  carto.ahead[1] = { feature: 'map', amount: 0, hardRock: false };
  carto.passives.allocated = ['cartographer'];
  const stats = deriveStats(plain);
  applyTicks(plain, 1, stats);
  applyTicks(carto, 1, stats);
  const plainMap = plain.stash.maps[1]?.[0];
  const cartoMap = carto.stash.maps[2]?.[0];
  expect(plainMap?.tier).toBe(1);
  expect(cartoMap?.tier).toBe(2);
  // the find itself is logged the same, and the loot stream is untouched
  expect(plain.rng).toBe(carto.rng);
  expect(plain.finds[0]?.kind).toBe('map');
  expect(carto.finds[0]?.kind).toBe('map');
});
```

- [ ] **Step 2: Run it and see it fail.** `npx vitest run tests/core/dig.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `hasKeystone`, the `cartographerTier` clamp, and the `collect` change.
- [ ] **Step 4: Run everything.** `npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit.** `git add src/core/passives.ts src/core/dig.ts src/core/maps.ts tests/core/dig.test.ts tests/core/passives.test.ts && git commit -m "Let Cartographer find maps one tier higher"`.

---

### Task 4: Stack caps and free stash pages

**Files:**
- Modify: `src/core/passives.ts` (`stackCaps`, `freeStashPages`), `src/core/loot.ts`, `src/core/inventory.ts`, `src/core/save.ts` (validator ceilings), `src/core/stashPages.ts`, `src/store/gameStore.ts` (refund guard — or leave to Task 5).
- Test: `tests/core/loot.test.ts`, `tests/core/inventory.test.ts`, `tests/core/passives.test.ts`, `tests/core/save.test.ts`.

**Interfaces:**
- **`passives.ts`:** `export function stackCaps(state: Pick<GameState, 'passives'>): { gem: number; material: number }` and `export function freeStashPages(state: Pick<GameState, 'passives'>): number` per Decisions.
- **`loot.ts`:** `bagCap` and the merge path take the state's caps: a gem stacks to `stackCaps(state).gem`, a material to `.material`. `receiveItem` / `receiveMaterial` / `drainOverflow` already hold `state`, so the caps come from it.
- **`inventory.ts`:** `bagStackCap` becomes `stackCaps(state)`; the "Take to bag" and merge checks read it.
- **`save.ts`:** `isGemStack` checks `count <= GEM_BAG_STACK + MAX_PASSIVE_GEM_STACK`; `isMaterialStack` checks `count <= MATERIAL_BAG_STACK + MAX_PASSIVE_MATERIAL_STACK`.
- **`stashPages.ts`:** `buyStashPage`'s price is unchanged (free pages never count toward it). A new `refundFreePages(state, n)` removes `n` empty trailing pages, returning `'ok' | 'occupied'`; it is the refund step for Deep Pockets (Task 5 calls it).

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/core/passives.test.ts: append
it('Gem Pouch and Ore Cart raise the bag stack caps', () => {
  const s = newGame(1, 0);
  expect(stackCaps(s)).toEqual({ gem: 25, material: 50 });
  s.passives.allocated = ['gemPouch', 'oreCart'];
  expect(stackCaps(s)).toEqual({ gem: 35, material: 75 });
});

// tests/core/loot.test.ts: append
it('a gem stack holds up to the passive cap, and a save over the base is valid', () => {
  const s = newGame(1, 0);
  s.passives.allocated = ['gemPouch'];
  const g = gem(s);
  g.count = 30;
  s.bag[0] = g;
  expect(decodeSave(encodeSave(s, 1)).ok).toBe(true);
  // and one past the cap is refused
  g.count = 36;
  s.bag[0] = g;
  expect(decodeSave(encodeSave(s, 1)).ok).toBe(false);
});

// tests/core/stashPages.test.ts: append (or tests/core/passives.test.ts)
it('Deep Pockets adds two free pages, refunded only while empty', () => {
  const s = newGame(1, 0);
  expect(freeStashPages(s)).toBe(0);
  s.passives.allocated = ['deepPockets'];
  expect(freeStashPages(s)).toBe(2);
});
```

- [ ] **Step 2: Run them and see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement** the caps, the loot/inventory merge changes, and the validator ceilings.
- [ ] **Step 4: Run everything.** `npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit.** `git add src/core/passives.ts src/core/loot.ts src/core/inventory.ts src/core/save.ts src/core/stashPages.ts tests/core/loot.test.ts tests/core/inventory.test.ts tests/core/passives.test.ts tests/core/save.test.ts && git commit -m "Let passives raise stack sizes and grant free stash pages"`.

---

### Task 5: Allocate, refund and reset

**Files:**
- Create: `src/core/respec.ts`, `tests/core/respec.test.ts`.
- Modify: `src/core/passives.ts` (refund price), `src/store/gameStore.ts`, `tests/store/gameStore.test.ts`.

**Interfaces:**
- **`respec.ts`:**
  - `export function allocate(state: GameState, id: string): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid'`. On `'ok'` it pushes `id` onto `allocated`, and, if the node grants stash pages, appends `freeStashPages`-many empty pages to `stash.general`.
  - `export function refund(state: GameState, id: string): 'ok' | 'notAllocated' | 'notLeaf' | 'noGold' | 'occupied' | 'invalid'`. Only on `'ok'` it spends `refundPrice(level)` Gold, splices the id out of `allocated`, and, if the node granted stash pages, removes its empty trailing pages.
  - `export function resetWeb(state: GameState): 'ok' | 'noDiamonds'`. On `'ok'` it spends `RESET_WEB_DIAMONDS`, empties `allocated`, and removes the free pages (occupied free pages are moved to the bag first, then held, then sold — never lost silently, logged as today's overflow does).
  - `refundPrice(level) = RESPEC_GOLD_BASE * level`.
- **`gameStore.ts`:** `allocate(id)`, `refund(id)`, `resetWeb()` call the core and `changed()` on a change; `refund` and `resetWeb` return their result.

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/core/respec.test.ts
import { expect, it } from 'vitest';
import { allocate, refund, resetWeb } from '../../src/core/respec';
import { RESET_WEB_DIAMONDS } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';

it('allocate spends a point and only next to an allocated node', () => {
  const s = newGame(1, 0);
  s.level = 3;
  expect(allocate(s, 'veinSense')).toBe('notAdjacent');
  expect(allocate(s, 'strongSwing')).toBe('ok');          // first ring
  expect(allocate(s, 'strongSwing')).toBe('allocated');
  expect(s.passives.allocated).toEqual(['strongSwing']);
  expect(allocate(s, 'veinSense')).toBe('ok');
  s.level = 2;                                            // points are level-1
  expect(allocate(s, 'strongSwing2')).toBe('noPoints');
});

it('refund spends Gold, only on a leaf', () => {
  const s = newGame(1, 0);
  s.level = 10; s.gold = 5000;
  allocate(s, 'strongSwing');
  allocate(s, 'strongSwing2');                            // second ring, dependent on the first
  expect(refund(s, 'strongSwing')).toBe('notLeaf');
  expect(refund(s, 'strongSwing2')).toBe('ok');
  expect(s.gold).toBe(5000 - 100 * 10);
  s.gold = 0;
  expect(refund(s, 'strongSwing')).toBe('noGold');
});

it('a full reset spends Diamonds and empties the web', () => {
  const s = newGame(1, 0);
  s.level = 5; s.diamonds = 100;
  allocate(s, 'strongSwing');
  expect(resetWeb(s)).toBe('ok');
  expect(s.passives.allocated).toEqual([]);
  expect(s.diamonds).toBe(100 - RESET_WEB_DIAMONDS);
  expect(resetWeb(s)).toBe('noDiamonds');
});
```

(The ring node ids in these tests are placeholders — replace with real first-ring ids from `passives.ts`.)

- [ ] **Step 2: Run them and see them fail.** `npx vitest run tests/core/respec.test.ts tests/store/gameStore.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `respec.ts` and the store intents.
- [ ] **Step 4: Run everything.** `npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit.** `git add src/core/respec.ts tests/core/respec.test.ts src/store/gameStore.ts tests/store/gameStore.test.ts && git commit -m "Allocate, refund and reset the passive web"`.

---

### Task 6: The Skills tab, the header's points, and the view model

**Files:**
- Create: `src/ui/skills/skillsView.ts`, `tests/ui/skillsView.test.ts`.
- Modify: `src/ui/navView.ts`, `src/ui/Nav.tsx`, `src/ui/Header.tsx`, `src/ui/App.tsx`.

**Interfaces:**
- **`navView.ts`:** `View` gains `'skills'`; `navTabs` inserts `{ view: 'skills', label: 'Skills' }` between Inventory and Merchant.
- **`Header.tsx`:** in the level block, replace the muted right-hand text's idle state with the points line: `N points to spend` (or `No points to spend`) plus ` · level L` — matching the Skills board's `2 points to spend · level 18`. During a run the `+X XP this run` text still wins, as today.
- **`App.tsx`:** render `SkillsView` for the `'skills'` view.
- **`skillsView.ts` (pure):**
  - `export interface SkillNodeVM { id: string; name: string; kind: PassiveKind; side: PassiveSide; x: number; y: number; links: string[]; desc: string; line: string; allocated: boolean; allocatable: boolean; refundable: boolean }`.
  - `export function nodeVMs(state: GameState): SkillNodeVM[]` — every node, with `allocated`/`allocatable`/`refundable` from `canAllocate`/`canRefund`, and `line` the node's effect in words (e.g. `+4 dig power`, `Every 25th metre …` for none — here `+15% chest find`).
  - `export function pointsLine(state: GameState): string` — `N points to spend · level L` / `No points to spend · level L`.
  - `export function refundLine(state: GameState, id: string): string` — `Refund for N Gold` / `Can't refund yet` / `Refund (occupied)`.
  - `export function resetLine(state: GameState): string` — `Reset web for N Diamonds`.
  - `export function searchNodes(state: GameState, q: string): string[]` — node ids whose name or `line` contains the query, case-insensitive.

- [ ] **Step 1: Write the failing test.**

```ts
// tests/ui/skillsView.test.ts
import { expect, it } from 'vitest';
import { nodeVMs, pointsLine, refundLine, resetLine } from '../../src/ui/skills/skillsView';
import { newGame } from '../../src/core/newGame';

it('the view model marks the start allocated and the first ring allocatable', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const vms = nodeVMs(s);
  const start = vms.find((n) => n.id === 'miner')!;
  expect(start.allocated).toBe(true);
  expect(start.allocatable).toBe(false);
  const ring = vms.find((n) => n.allocatable)!;
  expect(ring).toBeTruthy();
});

it('the header line says how many points are left', () => {
  const s = newGame(1, 0);
  s.level = 18;
  expect(pointsLine(s)).toBe('17 points to spend · level 18');
  s.passives.allocated = ['veinSense'];
  expect(pointsLine(s)).toBe('16 points to spend · level 18');
});

it('refund and reset lines name their price', () => {
  const s = newGame(1, 0);
  s.level = 10;
  expect(refundLine(s, 'veinSense')).toBe('Refund for 1,000 Gold');
  expect(resetLine(s)).toBe('Reset web for 20 Diamonds');
});
```

- [ ] **Step 2: Run it and see it fail.** `npx vitest run tests/ui/skillsView.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the view model, nav, header and routing.
- [ ] **Step 4: Verify.** `npx vitest run && npx tsc --noEmit && npx vite build`.
- [ ] **Step 5: Commit.** `git add src/ui/skills/skillsView.ts tests/ui/skillsView.test.ts src/ui/navView.ts src/ui/Nav.tsx src/ui/Header.tsx src/ui/App.tsx && git commit -m "Add the Skills tab, the points line and the web's view model"`.

---

### Task 7: The Skills view — the SVG web, pan, zoom and search

**Files:**
- Create: `src/ui/skills/SkillsView.tsx`, `src/ui/skills/Web.tsx`, `src/ui/skills/skills.css`.
- Modify: `src/ui/theme.css`, `src/ui/app.css`.

**Interfaces:**
- **`Web.tsx`:** renders the SVG exactly as board 3A: edges as 3 px `#3a3029` paths (an allocated node's edges in its side colour), nodes as circles (small 20 px, notable 32 px, keystone 40 px rounded square, start 44 px) with the side's fill/border when allocated and the unallocated fill/border otherwise. Each node is a ≥ 44 px hit target. Wheel zooms, drag pans, pinch on touch; `prefers-reduced-motion` disables smoothing. It exposes `focusNode(id)` so search can centre a match.
- **`SkillsView.tsx`:** the heading `Skills`, the points line, the node search box, the web, and a footer legend (small/notable/keystone) as in board 3A. Clicking an allocatable node allocates it; clicking a refundable node refunds it; either shows the outcome's words under the legend. The start node is not clickable. A hover card shows the node's name, `line` and `desc`, pinned on click until the pointer moves (reusing the card-placement rules from Plan 9). The **Reset web** button confirms and calls `store.resetWeb()`.
- **`theme.css`:** the four side tones and the edge tone from board 3A.

- [ ] **Step 1:** Build the component against `nodeVMs` from Task 6. No new pure logic; the view model is already tested.
- [ ] **Step 2:** Verify `npx vitest run && npx tsc --noEmit && npx vite build`.
- [ ] **Step 3:** Check in the browser at 1280 × 900 and 390 × 844: the web is centred, the legend reads, search scrolls to a match, allocating/refunding updates the dots and the header line, and a card is never clipped. The dev server runs on port 5180 and is never stopped.
- [ ] **Step 4: Update the README.** A new "Skills" paragraph: the level gives one point each, points go into a passive web (mining left, battle right, hybrid below), a node needs an allocated neighbour, and refunds cost Gold while a full reset costs Diamonds.
- [ ] **Step 5: Commit.** `git add src/ui/skills src/ui/theme.css src/ui/app.css README.md && git commit -m "Draw the passive web with pan, zoom and search"`.

---

## Balance notes for Plan 13

The small-node values and keystone trade-offs here are my calls to make the web feel worth chasing; Plan 13 re-tunes them against a headless sim of a reference run, exactly as it re-tunes the rest. The invariants Plan 13 must not break: an empty web changes nothing (all Plan 1–10 tests stay green), a full 59-point mining build roughly doubles dig output, and a full battle build roughly doubles map clear rate at the same gear — both measured, never guessed.
