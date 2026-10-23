# Golden Miner — Plan 1: Foundation + Digging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable idle digger. The miner digs down on its own, and every click is an extra tick.
It collects Gold, Diamonds and per-metre finds that the lamp reveals ahead on a minimap. It can climb
back up to earlier depths. Progress saves, exports and continues offline.

**Architecture:** The game core is pure TypeScript with no React and no DOM. It works on one
serialisable `GameState`, has a seeded RNG, and core functions take `nowMs` instead of reading the
clock. A `GameStore` (also DOM-free, with injected storage and clock) owns the state: it loads, saves,
catches up offline, rate-limits clicks and aggregates feedback. React reads the store through
`useSyncExternalStore`, and the UI's logic lives in pure view-model functions so it can be tested
without a DOM.

**Tech Stack:** Node 24 LTS, TypeScript 7, Vite 8, React 19, Vitest 5, lz-string.

**Spec:** `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md` (§3, §4.2, §4.3, §5 Mine,
§6). Mockup source for look and layout: `.superpowers/mockups/project/Main.dc.html` and
`Character.dc.html` (local and git-excluded; published at
https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR).

**Roadmap:** this is plan 1 of 7.
1. **Foundation + digging** (this plan)
2. Items + character screen
3. Maps, combat, levels
4. Passive web
5. Merchant + crafting
6. Auto-mapping + ascension
7. Balance + launch

Each later plan is written when its turn comes, against the code that exists by then.

## Global Constraints

- Static site: TypeScript + Vite + React, no backend (spec §3).
- `package.json` `engines.node` is `>=22.12.0`, and the machine runs Node 24 LTS.
- Dependency majors (current as of 2026-10-23): `react` / `react-dom` ^19.3.1, `lz-string` ^1.5.0,
  `typescript` ^7.0.2, `vite` ^8.3.5, `@vitejs/plugin-react` ^6.1.2, `vitest` ^5.0.5, `@types/react`
  ^19.3.0, `@types/react-dom` ^19.3.0. No ESLint (it would pull in the TS 5 JS API).
- `tsconfig`: `moduleResolution: "bundler"`, no `baseUrl`, `strict: true`,
  `noUncheckedIndexedAccess: true`, `types: ["vite/client"]`.
- Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call
  `Date.now()` / `Math.random()`. Time and randomness come in as arguments or from `state.rng`.
- **Readable numbers:** every number shown is a plain integer with `en-US` thousands separators
  (`2,480`), never scientific notation. All growth is linear or polynomial (spec §2 anti-goal).
- **No login pressure:** no streaks, timers that expire, or daily rewards (spec §2).
- Saves: one versioned blob `{ schema, savedAt, state }`, lz-string Base64, localStorage key
  `goldenminer.save`. Autosave every 30 s and on `visibilitychange` → hidden and `pagehide`.
- Phones: layout works at 390 px width, and every button and click target is ≥ 44 px.
- Pixel art: integer scaling only, `image-rendering: pixelated`, and sprites come from an atlas
  (spec §3).
- Look: dark lamp-lit theme from the mockups. Cinzel for display, IBM Plex Sans for UI, IBM Plex Mono
  for numbers. Rarity colours magic `#8fb0ff`, rare `#f0d455`, legendary `#ff9b45`.
- `prefers-reduced-motion: reduce` turns off the floating and popping animations.
- Git: work on `dev-ernest`. Commit messages are short imperative sentences, with **no
  Claude/Anthropic attribution of any kind** (owner's rule). Never push unless asked.
- All tunable numbers live in `src/core/balance.ts`. Plan 7 retunes them.

## Review Focus

1. **Two tabs open at once.** Both would tick and overwrite each other's save. Expected: the second
   tab neither runs nor saves, and offers "Play here", which hands the game over to it (Task 7
   `TabLock` tests, wired in Task 11).
2. **A save that can't be read** (corrupt, hand-edited, or from a newer version). Expected: it is
   never silently lost. It's kept under a backup key, a fresh game starts, and a notice says so. A bad
   import leaves the current game untouched (Task 6 and Task 7 tests).
3. **Clock weirdness.** The system clock is set backward, or a laptop sleeps for days with the tab
   open. Expected: no negative or runaway tick counts, and any single gap is capped at 8 h (Task 5
   tests).
4. **A huge catch-up** after background throttling or sleep. Expected: the page doesn't freeze and
   doesn't spawn thousands of floating numbers; a summary appears instead (Task 5 performance test,
   Task 7 summary threshold, Task 9 aggregation tests).
5. **Storage blocked or full** (private mode, quota). Expected: the game still plays and shows a
   visible "progress isn't being saved" notice instead of crashing (Task 7 tests).

---

## File structure

```
legacy/                      ← the 2013 game, moved from src/ (git mv), untouched
index.html                   ← Vite entry, Google Fonts links
package.json, package-lock.json, tsconfig.json, vite.config.ts, .gitignore
src/main.tsx                 ← mounts <App/>
src/core/                    ← pure game core (no DOM, no React)
  balance.ts                 ← every tunable constant and formula
  rng.ts                     ← mulberry32 + hash2
  bands.ts                   ← depth bands, tiers, roman numerals
  types.ts                   ← GameState, MetreRoll, FindRecord, Stats, TickEvent, OfflineSummary
  stats.ts                   ← deriveStats(state)
  metres.ts                  ← rollMetre, fillAhead
  newGame.ts                 ← newGame(seed, nowMs)
  dig.ts                     ← applyTicks, moveTo
  clock.ts                   ← advance, clickTicks, ClickLimiter
  summary.ts                 ← summarize
  save.ts                    ← encodeSave, decodeSave, migrate, validateState
src/store/                   ← DOM-free app layer (testable in node)
  storage.ts                 ← StorageLike, MemoryStorage, safeStorage
  tabLock.ts                 ← TabLock
  gameStore.ts               ← GameStore
src/sprites/
  grids.ts                   ← pixel grids + palette (copied from the mockups)
  atlas.ts                   ← SpriteName, layoutAtlas, spriteStyle
  placeholderAtlas.ts        ← canvas painter (DOM, untested)
  Sprite.tsx, AtlasContext.tsx
src/ui/
  format.ts                  ← formatNumber, formatDuration
  theme.css                  ← colour/font tokens, keyframes, reduced-motion rules
  useGame.ts                 ← useSyncExternalStore hook
  App.tsx, Header.tsx, OfflineSummary.tsx, SaveMenu.tsx, Notices.tsx, TabBlocked.tsx
  mine/MineView.tsx, mine/MineScene.tsx, mine/FindsFeed.tsx, mine/Minimap.tsx
  mine/sceneTiles.ts, mine/particles.ts, mine/minimap.ts   ← pure view models
tests/core/*.test.ts, tests/store/*.test.ts, tests/sprites/*.test.ts, tests/ui/*.test.ts
```

---

### Task 1: Toolchain, repo move, app shell

**Files:**
- Move: `src/` → `legacy/` (`git mv src legacy`)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`,
  `src/main.tsx`, `src/ui/App.tsx`, `src/ui/format.ts`, `src/ui/theme.css`
- Test: `tests/ui/format.test.ts`

**Interfaces:**
- Produces: `formatNumber(n: number): string` and `formatDuration(ms: number): string` in
  `src/ui/format.ts`. Scripts `npm test` (vitest run), `npm run typecheck` (tsc --noEmit),
  `npm run build` (tsc --noEmit && vite build), `npm run dev`.

- [ ] **Step 1: Switch the machine to Node 24 LTS**

Run: `n 24` and then `node -v`
Expected: `v24.` followed by any minor version.

- [ ] **Step 2: Move the 2013 game**

Run: `git mv src legacy`, then `git status --short | head -3`
Expected: rename entries `R  src/... -> legacy/...`.

- [ ] **Step 3: Create the project files**

- `package.json`: `name: "golden-miner"`, `private: true`, `type: "module"`,
  `engines.node: ">=22.12.0"`, and the scripts listed above.
- Install: `npm install react@^19.3.1 react-dom@^19.3.1 lz-string@^1.5.0`, then
  `npm install -D typescript@^7.0.2 vite@^8.3.5 @vitejs/plugin-react@^6.1.2 vitest@^5.0.5 @types/react@^19.3.0 @types/react-dom@^19.3.0`.
- `tsconfig.json` per Global Constraints, plus `target`/`lib` ES2022 + DOM, `jsx: "react-jsx"`,
  `noEmit`, `skipLibCheck`, and `include: ["src", "tests", "vite.config.ts"]`.
- `vite.config.ts`: `defineConfig` from `vitest/config`, `plugins: [react()]`, `base: './'`, and
  `test: { environment: 'node', include: ['tests/**/*.test.ts'] }`.
- `.gitignore`: `node_modules/` and `dist/`.
- `index.html`: Google Fonts link for Cinzel 600/700, IBM Plex Sans 400/500/600 and IBM Plex Mono 500,
  plus `<div id="root">` and the module script `/src/main.tsx`.
- `src/ui/theme.css`: copy the colour tokens from the mockups as CSS custom properties: ground
  `#15120f`, panel `#1f1a16`, line `#3a3029`, text `#f1e9dc`, muted `#a89f94`, gold `#e8b44a`,
  diamond `#7fd3e8`, the rarity colours, and the `gmFloat`/`gmPop` keyframes from `Main.dc.html`'s
  helmet. Add a `@media (prefers-reduced-motion: reduce)` rule that sets `animation: none` on
  `.gm-particle`.
- `App.tsx` renders the page background and a "Golden Miner" wordmark (Cinzel, gold).

- [ ] **Step 4: Write the failing test** in `tests/ui/format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from '../../src/ui/format';

describe('formatNumber', () => {
  it('uses en-US separators and never exponents', () => {
    expect(formatNumber(2480)).toBe('2,480');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1e21)).toBe('1,000,000,000,000,000,000,000');
    expect(formatNumber(12.7)).toBe('13');
  });
});

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(8 * 3600_000)).toBe('8h 0m');
    expect(formatDuration(5 * 60_000 + 59_000)).toBe('5m');
    expect(formatDuration(30_000)).toBe('less than a minute');
  });
});
```

- [ ] **Step 5: Run it and see it fail**

Run: `npx vitest run tests/ui/format.test.ts`
Expected: FAIL (cannot resolve `../../src/ui/format`).

- [ ] **Step 6: Implement `format.ts`**

`formatNumber` uses `Intl.NumberFormat('en-US', { maximumFractionDigits: 0, notation: 'standard' })`.
`formatDuration` returns `'<h>h <m>m'` when there is at least an hour, `'<m>m'` when there is at
least a minute, and `'less than a minute'` otherwise.

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: the tests pass and `dist/index.html` is written. Then run `npm run dev` and open the
printed URL to see the wordmark on the dark background.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Move the 2013 game to legacy/ and scaffold the Vite + React app"
```

---

### Task 2: Seeded RNG and depth bands

**Files:**
- Create: `src/core/rng.ts`, `src/core/bands.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/bands.test.ts`

**Interfaces:**
- Produces:
  - `mulberry32(state: number): { value: number; state: number }`
  - `hash2(seed: number, n: number): number` (a uint32)
  - `interface Band { name: string; start: number; end: number; tier: number }`
  - `bandAt(depth: number): Band`
  - `tierAt(depth: number): number`
  - `metreTier(metre: number): number`, which is `tierAt(metre - 1)` because metre `m` spans depth
    `m-1` to `m`
  - `toRoman(n: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/rng.test.ts
import { expect, it } from 'vitest';
import { hash2, mulberry32 } from '../../src/core/rng';

it('mulberry32 matches the reference sequence', () => {
  let s = 1;
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { const r = mulberry32(s); v.push(r.value); s = r.state; }
  expect(v).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  expect(s).toBe(1199730144);
});

it('hash2 is a stable uint32 mix', () => {
  expect(hash2(1, 1)).toBe(2980047484);
  expect(hash2(1, 2)).toBe(232174035);
  expect(hash2(42, 340)).toBe(1463892797);
});
```

```ts
// tests/core/bands.test.ts
import { expect, it } from 'vitest';
import { bandAt, metreTier, tierAt, toRoman } from '../../src/core/bands';

it('named bands follow the mockup', () => {
  expect(bandAt(0)).toMatchObject({ name: 'Topsoil', tier: 1 });
  expect(bandAt(49.9).name).toBe('Topsoil');
  expect(bandAt(50)).toMatchObject({ name: 'Clay Beds', tier: 2 });
  expect(bandAt(339)).toMatchObject({ name: 'Granite Veins', start: 300, end: 450, tier: 4 });
  expect(bandAt(999).name).toBe('Obsidian Reach');
});

it('the abyss continues forever in 300 m bands', () => {
  expect(bandAt(1000)).toMatchObject({ name: 'The Abyss I', start: 1000, end: 1300, tier: 7 });
  expect(bandAt(1300)).toMatchObject({ name: 'The Abyss II', tier: 8 });
  expect(bandAt(4000)).toMatchObject({ name: 'The Abyss XI', tier: 17 });
  expect(tierAt(250_000)).toBe(6 + Math.floor((250_000 - 1000) / 300) + 1);
});

it('a metre belongs to the band at its top', () => {
  expect(metreTier(300)).toBe(3);
  expect(metreTier(301)).toBe(4);
  expect(toRoman(14)).toBe('XIV');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/core`
Expected: FAIL (the modules don't exist yet).

- [ ] **Step 3: Implement `rng.ts`** using these exact algorithms (the tests pin the values):

```ts
export function mulberry32(state: number) {
  const a = (state + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}
export function hash2(seed: number, n: number) {
  let h = (seed ^ Math.imul(n, 0x9E3779B1)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
```

- [ ] **Step 4: Implement `bands.ts`**

Named bands (`[start, end)`): Topsoil 0–50, Clay Beds 50–150, Limestone 150–300, Granite Veins
300–450, Basalt Deep 450–700, Obsidian Reach 700–1000, with tiers 1–6. From 1000 m on, band `k`
(1-based) is `The Abyss <toRoman(k)>`, spanning `1000 + 300(k-1)` to `1000 + 300k`, with tier
`6 + k`. `bandAt` is computed, not looked up in a growing table.

- [ ] **Step 5: Run the tests and see them pass**

Run: `npx vitest run tests/core`
Expected: PASS.

- [ ] **Step 6: Commit**: `git add src/core tests/core && git commit -m "Add seeded RNG and depth bands"`

---

### Task 3: Game state, stats, metre rolling, new game

**Files:**
- Create: `src/core/types.ts`, `src/core/balance.ts`, `src/core/stats.ts`, `src/core/metres.ts`,
  `src/core/newGame.ts`
- Test: `tests/core/metres.test.ts`

**Interfaces:**
- Consumes: `hash2`, `mulberry32`, `metreTier` (Task 2).
- Produces (`types.ts`):

```ts
export type FeatureKind = 'goldVein' | 'diamondVein' | 'chest' | 'gem' | 'map';
export interface MetreRoll { feature: FeatureKind | null; amount: number; hardRock: boolean }
export interface FindRecord { depth: number; kind: FeatureKind; amount: number; tick: number }
export interface GameState {
  seed: number; rng: number; tickCount: number; lastTickAt: number;
  gold: number; diamonds: number;
  depth: number; deepest: number;          // whole metres; 0 = surface; depth <= deepest
  progress: number;                        // 0..1 toward metre deepest+1 (the dig face)
  galleryProgress: number;                 // 0..1 toward the next gallery find roll (depth < deepest)
  ahead: Record<number, MetreRoll>;        // pre-rolled metres deepest+1 .. deepest+lampSight
  finds: FindRecord[];                     // notable finds, oldest first, at most FINDS_LOG_LIMIT
}
export interface Stats {
  digPower: number; autoTicksPerSecond: number; ticksPerClick: number; lampSight: number;
  offlineCapMs: number; featureChances: Record<FeatureKind, number>; hardRockChance: number;
}
export type TickEvent =
  | { kind: 'gold'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'metre'; depth: number; gallery: boolean }
  | { kind: 'find'; find: FindRecord };
export interface OfflineSummary {
  elapsedMs: number; ticks: number; gold: number; diamonds: number; metres: number;
  finds: Record<FeatureKind, number>;
}
```

- `balance.ts`: these exact values and formulas:
  - `BASE_DIG_POWER = 10`, `BASE_AUTO_TICKS_PER_SECOND = 1`, `BASE_TICKS_PER_CLICK = 1`,
    `BASE_LAMP_SIGHT = 2`, `BASE_OFFLINE_CAP_MS = 8 * 3_600_000`, `MAX_CLICKS_PER_SECOND = 10`
  - `TICKS_PER_METRE_AT_PARITY = 25`, `HARD_ROCK_MULTIPLIER = 1.5`
  - `hardness(metre) = 10 + 0.13 * metre`
  - `goldPerTick(tier) = 1 + Math.floor(tier / 2)`
  - `diamondChancePerTick(tier) = Math.min(0.2, 0.01 * tier)`
  - `goldVeinAmount(tier, u) = Math.round(6 * tier * (0.8 + 0.4 * u))`
  - `diamondVeinAmount(tier) = 1 + Math.floor(tier / 2)`
  - `BASE_FEATURE_CHANCES = { goldVein: 0.12, diamondVein: 0.03, chest: 0.06, gem: 0.03, map: 0.04 }`,
    `BASE_HARD_ROCK_CHANCE = 0.08`
  - `GUARANTEED_FIRST_MAP_METRE = 2`, `FINDS_LOG_LIMIT = 5000`
  - `AUTOSAVE_INTERVAL_MS = 30_000`, `OFFLINE_SUMMARY_MIN_TICKS = 300`
  - `TAB_LOCK_STALE_MS = 5000`, `TAB_HEARTBEAT_MS = 2000`
- `deriveStats(state: GameState): Stats` returns the base values. Plans 2 and 4 add gear and
  passives here, so take `state` even though it's unused for now.
- `rollMetre(seed: number, metre: number, stats: Stats): MetreRoll` uses an RNG seeded with
  `hash2(seed, metre)`. The first draw picks at most one feature by walking the cumulative
  `featureChances` in the order `goldVein, diamondVein, chest, gem, map`. The second draw decides
  `hardRock`. Veins draw a third value `u` for `goldVeinAmount`. The amount is 0 for non-veins.
- `rollGallery(state: GameState, depth: number, stats: Stats): MetreRoll` uses the same rules but draws
  from `state.rng` (advancing it). It is used for side galleries, which nothing reveals ahead.
- `fillAhead(state: GameState, stats: Stats): void` adds rolls for any missing metre in
  `deepest+1 .. deepest+lampSight` and never replaces an existing entry (spec: a metre is rolled once,
  when it first comes into sight).
- `newGame(seed: number, nowMs: number): GameState`: `rng = hash2(seed, 0x5eed)`, everything else zero
  or empty, `lastTickAt = nowMs`. It calls `fillAhead`, then forces metre
  `GUARANTEED_FIRST_MAP_METRE` to `{ feature: 'map', amount: 0, hardRock: false }` and sets
  `ahead[1].hardRock = false`.

- [ ] **Step 1: Write the failing tests** in `tests/core/metres.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { fillAhead, rollMetre } from '../../src/core/metres';

const stats = deriveStats(newGame(1, 0));

it('base stats', () => {
  expect(stats).toMatchObject({ digPower: 10, autoTicksPerSecond: 1, ticksPerClick: 1, lampSight: 2, offlineCapMs: 28_800_000 });
});

it('a metre roll is a pure function of seed and metre', () => {
  expect(rollMetre(42, 340, stats)).toEqual(rollMetre(42, 340, stats));
});

it('feature frequencies follow the base chances', () => {
  const n = 20_000;
  const count = { chest: 0, map: 0, none: 0, hard: 0 };
  for (let m = 1; m <= n; m++) {
    const r = rollMetre(7, m, stats);
    if (r.feature === 'chest') count.chest++;
    if (r.feature === 'map') count.map++;
    if (r.feature === null) count.none++;
    if (r.hardRock) count.hard++;
  }
  expect(count.chest / n).toBeGreaterThan(0.05); expect(count.chest / n).toBeLessThan(0.07);
  expect(count.map / n).toBeGreaterThan(0.03); expect(count.map / n).toBeLessThan(0.05);
  expect(count.none / n).toBeGreaterThan(0.70); expect(count.none / n).toBeLessThan(0.74);
  expect(count.hard / n).toBeGreaterThan(0.07); expect(count.hard / n).toBeLessThan(0.09);
});

it('vein amounts scale with tier', () => {
  for (let m = 301; m < 450; m++) {
    const r = rollMetre(3, m, stats);
    if (r.feature === 'goldVein') { expect(r.amount).toBeGreaterThanOrEqual(19); expect(r.amount).toBeLessThanOrEqual(29); }
    if (r.feature === 'diamondVein') expect(r.amount).toBe(3);
  }
});

describe('newGame', () => {
  it('starts at the surface with a guaranteed map at metre 2', () => {
    const s = newGame(1, 1000);
    expect(s).toMatchObject({ depth: 0, deepest: 0, gold: 0, diamonds: 0, lastTickAt: 1000, finds: [] });
    expect(Object.keys(s.ahead).map(Number).sort()).toEqual([1, 2]);
    expect(s.ahead[2]).toEqual({ feature: 'map', amount: 0, hardRock: false });
    expect(s.ahead[1]?.hardRock).toBe(false);
  });
});

it('fillAhead adds missing metres and never re-rolls', () => {
  const s = newGame(1, 0);
  s.deepest = 10; s.depth = 10; s.ahead = { 11: { feature: 'chest', amount: 0, hardRock: true } };
  fillAhead(s, stats);
  expect(s.ahead[11]).toEqual({ feature: 'chest', amount: 0, hardRock: true });
  expect(s.ahead[12]).toBeDefined();
  expect(s.ahead[13]).toBeUndefined();
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/metres.test.ts`, which
  should FAIL with missing modules.
- [ ] **Step 3: Implement** `types.ts`, `balance.ts`, `stats.ts`, `metres.ts` and `newGame.ts` per the
  Interfaces block.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run tests/core`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Add game state, base stats and metre rolling"`

---

### Task 4: Digging, galleries, climbing back

**Files:**
- Create: `src/core/dig.ts`
- Test: `tests/core/dig.test.ts`

**Interfaces:**
- Consumes: Task 3's types, balance, `rollMetre`, `rollGallery`, `fillAhead`, and `metreTier`.
- Produces:
  - `applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[]): void` mutates
    `state`, and pushes events only when `events` is given.
  - `moveTo(state: GameState, depth: number): boolean` returns false and changes nothing unless
    `depth` is an integer in `0..state.deepest`.

Per tick, in this order:
1. Add `goldPerTick(tierAt(depth))` Gold.
2. Draw from `state.rng`; if the draw is below `diamondChancePerTick(tierAt(depth))`, add 1 Diamond.
3. Dig:
   - **At the face** (`depth === deepest`): `progress += digPower / (hardness(m) × (hardRock ? 1.5 : 1) × 25)`,
     where `m = deepest + 1`. While `progress ≥ 1`: subtract 1, then take `ahead[m]`, or `rollMetre`
     if it's missing because sight is 0. Collect it, delete `ahead[m]`, set `deepest = depth = m`,
     call `fillAhead`, and recompute for the next metre.
   - **In a gallery**: `galleryProgress += digPower / (hardness(depth + 1) × 25)`. While it's ≥ 1:
     subtract 1, then `rollGallery(state, depth, …)` and collect it at `depth`.
4. `tickCount += 1`.

Collecting means:
- `goldVein` adds its amount to Gold, and `diamondVein` adds its amount to Diamonds.
- `chest`, `gem` and `map` have no payload yet. Plans 2 and 3 attach one in `collect`, so keep
  `collect` a separate exported function: `collect(state, roll, depth, events?)`.
- Every feature is appended to `finds` as `{ depth, kind, amount, tick: tickCount }`, and the oldest
  entry is dropped once there are more than `FINDS_LOG_LIMIT`.

`moveTo` keeps the face's `progress` and resets `galleryProgress` to 0.

- [ ] **Step 1: Write the failing tests** in `tests/core/dig.test.ts`

```ts
import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { applyTicks, moveTo } from '../../src/core/dig';
import type { TickEvent } from '../../src/core/types';
import { FINDS_LOG_LIMIT } from '../../src/core/balance';

const fresh = () => newGame(1, 0);
const stats = deriveStats(fresh());

it('one tick at the surface pays 1 Gold and digs a fraction of a metre', () => {
  const s = fresh();
  applyTicks(s, 1, stats);
  expect(s.gold).toBe(1);
  expect(s.progress).toBeCloseTo(10 / (10.13 * 25), 6);
});

it('the first map is found within 60 ticks', () => {
  const s = fresh();
  let ticks = 0;
  while (!s.finds.some((f) => f.kind === 'map') && ticks < 60) { applyTicks(s, 1, stats); ticks++; }
  expect(s.finds.find((f) => f.kind === 'map')).toMatchObject({ depth: 2 });
});

it('finishing a face metre consumes its roll and reveals the next', () => {
  const s = fresh();
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.ahead[1]).toBeUndefined();
  expect(Object.keys(s.ahead).map(Number).sort()).toEqual([2, 3]);
});

it('veins pay out and are logged', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  expect(s.finds[0]).toMatchObject({ depth: 1, kind: 'goldVein', amount: 19 });
  expect(s.gold).toBe(19 + s.tickCount * 1);
  expect(events.filter((e) => e.kind === 'gold')).toHaveLength(s.tickCount);
  expect(events.some((e) => e.kind === 'metre' && e.depth === 1 && !e.gallery)).toBe(true);
});

it('hard rock takes 1.5× as long', () => {
  const ticksFor = (hard: boolean) => {
    const s = fresh();
    s.ahead[1] = { feature: null, amount: 0, hardRock: hard };
    let t = 0; while (s.deepest < 1) { applyTicks(s, 1, stats); t++; } return t;
  };
  expect(ticksFor(true) / ticksFor(false)).toBeGreaterThan(1.4);
  expect(ticksFor(true) / ticksFor(false)).toBeLessThan(1.6);
});

it('galleries dig without going deeper, and the face keeps its progress', () => {
  const s = fresh();
  while (s.deepest < 20) applyTicks(s, 1, stats);
  applyTicks(s, 3, stats);
  const faceProgress = s.progress;
  expect(moveTo(s, 5)).toBe(true);
  const before = s.finds.length;
  const events: TickEvent[] = [];
  applyTicks(s, 400, stats, events);
  expect(s.deepest).toBe(20);
  expect(s.depth).toBe(5);
  // 400 ticks × 10 / (hardness(6) = 10.78 × 25) = 14.84 → 14 gallery metres
  expect(events.filter((e) => e.kind === 'metre' && e.gallery)).toHaveLength(14);
  expect(s.finds.slice(before).every((f) => f.depth === 5)).toBe(true);
  expect(moveTo(s, 20)).toBe(true);
  expect(s.progress).toBe(faceProgress);
});

it('moveTo rejects depths that were never reached', () => {
  const s = fresh();
  while (s.deepest < 20) applyTicks(s, 1, stats);
  for (const bad of [21, -1, 3.5, Number.NaN]) expect(moveTo(s, bad)).toBe(false);
  expect(s.depth).toBe(20);
});

it('the finds log is capped', () => {
  const s = fresh();
  s.finds = Array.from({ length: FINDS_LOG_LIMIT }, (_, i) => ({ depth: 0, kind: 'chest' as const, amount: 0, tick: i }));
  s.ahead[1] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(FINDS_LOG_LIMIT);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'gem', depth: 1 });
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/dig.test.ts`, which should
  FAIL.
- [ ] **Step 3: Implement `dig.ts`** per the Interfaces block.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run tests/core`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Add digging, side galleries and climbing back"`

---

### Task 5: Clock, clicks, offline summary

**Files:**
- Create: `src/core/clock.ts`, `src/core/summary.ts`
- Test: `tests/core/clock.test.ts`

**Interfaces:**
- Consumes: `applyTicks` (Task 4) and `deriveStats`.
- Produces:
  - `advance(state: GameState, nowMs: number, stats: Stats, events?: TickEvent[]): number` returns the
    number of ticks applied. Let `elapsed = nowMs - lastTickAt`:
    - If `elapsed < 0`, set `lastTickAt = nowMs` and return 0.
    - Otherwise compute `due = floor(min(elapsed, offlineCapMs) / (1000 / autoTicksPerSecond))`.
    - If the gap exceeded the cap, set `lastTickAt = nowMs`. Otherwise advance `lastTickAt` by
      `due × interval`, keeping the remainder.
  - `clickTicks(state: GameState, stats: Stats, events?: TickEvent[]): void` applies
    `stats.ticksPerClick` ticks.
  - `class ClickLimiter { constructor(maxPerSecond = MAX_CLICKS_PER_SECOND); tryClick(nowMs: number): boolean }`
    is a sliding window: at most `maxPerSecond` accepted clicks in any span of 1000 ms.
  - `summarize(before: GameState, after: GameState, elapsedMs: number, ticks: number): OfflineSummary`
    takes the Gold and Diamond differences, `metres = after.deepest - before.deepest`, and counts finds
    with `tick >= before.tickCount` per kind (every kind present, 0 if none).

- [ ] **Step 1: Write the failing tests** in `tests/core/clock.test.ts`

```ts
import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { advance, ClickLimiter, clickTicks } from '../../src/core/clock';
import { summarize } from '../../src/core/summary';

const stats = deriveStats(newGame(1, 0));

it('applies whole elapsed seconds and keeps the remainder', () => {
  const s = newGame(1, 0);
  expect(advance(s, 2500, stats)).toBe(2);
  expect(s.lastTickAt).toBe(2000);
});

it('a clock that went backwards applies nothing and re-anchors', () => {
  const s = newGame(1, 10_000);
  expect(advance(s, 5000, stats)).toBe(0);
  expect(s.lastTickAt).toBe(5000);
  expect(s.tickCount).toBe(0);
});

it('a three-day gap is capped at 8 hours', () => {
  const s = newGame(1, 0);
  const now = 3 * 24 * 3_600_000;
  expect(advance(s, now, stats)).toBe(28_800);
  expect(s.lastTickAt).toBe(now);
});

it('an 8 hour catch-up stays fast', () => {
  const s = newGame(1, 0);
  const t0 = performance.now();
  advance(s, 8 * 3_600_000, stats);
  expect(performance.now() - t0).toBeLessThan(2000);
});

it('clicks beyond 10 per second are ignored', () => {
  const lim = new ClickLimiter();
  const accepted = Array.from({ length: 11 }, (_, i) => lim.tryClick(i)).filter(Boolean).length;
  expect(accepted).toBe(10);
  expect(lim.tryClick(1001)).toBe(true);
});

it('a click is one extra tick', () => {
  const s = newGame(1, 0);
  clickTicks(s, stats);
  expect(s.tickCount).toBe(1);
});

it('summarize reports what changed', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  advance(after, 600_000, stats);
  const sum = summarize(before, after, 600_000, 600);
  expect(sum).toMatchObject({ elapsedMs: 600_000, ticks: 600, gold: after.gold, metres: after.deepest });
  expect(sum.finds.map).toBeGreaterThanOrEqual(1);
  expect(Object.keys(sum.finds).sort()).toEqual(['chest', 'diamondVein', 'gem', 'goldVein', 'map']);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/clock.test.ts`, which
  should FAIL.
- [ ] **Step 3: Implement** `clock.ts` and `summary.ts`.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run tests/core`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Add the tick clock, click limiter and offline summary"`

---

### Task 6: Save format

**Files:**
- Create: `src/core/save.ts`
- Test: `tests/core/save.test.ts`

**Interfaces:**
- Consumes: `GameState`, `FINDS_LOG_LIMIT`, and `lz-string` (`compressToBase64` /
  `decompressFromBase64`). lz-string is a pure library, so it's allowed in core.
- Produces:
  - `SCHEMA_VERSION = 1`
  - `encodeSave(state: GameState, nowMs: number): string`: Base64 of
    `JSON.stringify({ schema, savedAt, state })`. The same string is used for storage and for export.
  - `type DecodeResult = { ok: true; state: GameState; savedAt: number } | { ok: false; reason: 'corrupt' | 'future' | 'invalid' }`
  - `decodeSave(text: string): DecodeResult` returns:
    - `corrupt` if decompression gives null or `''`, or parsing throws;
    - `invalid` if `schema` isn't a positive integer;
    - `future` if `schema > SCHEMA_VERSION`;
    - otherwise it runs `migrate`, then returns `invalid` if `validateState` fails.
  - `type Migration = (state: unknown) => unknown`
  - `migrate(state: unknown, from: number, to: number, migrations: Record<number, Migration>): unknown`
    applies `migrations[from]`, then `migrations[from+1]`, and so on up to `to - 1`. It throws if one
    is missing.
  - `MIGRATIONS: Record<number, Migration> = {}`
  - `validateState(x: unknown): x is GameState` checks:
    - every numeric field is finite and ≥ 0;
    - `seed`, `rng`, `tickCount`, `depth` and `deepest` are integers, and `depth ≤ deepest`;
    - `progress` and `galleryProgress` are in `[0, 1)`;
    - `ahead` keys are integers > `deepest` with valid `MetreRoll` values;
    - `finds` is an array of valid `FindRecord`s with length ≤ `FINDS_LOG_LIMIT`.

- [ ] **Step 1: Write the failing tests** in `tests/core/save.test.ts`

```ts
import { expect, it } from 'vitest';
import { compressToBase64 } from 'lz-string';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, migrate } from '../../src/core/save';

const raw = (env: unknown) => compressToBase64(JSON.stringify(env));

it('round-trips a game', () => {
  const s = newGame(9, 123);
  s.gold = 2480;
  const r = decodeSave(encodeSave(s, 456));
  expect(r).toEqual({ ok: true, state: s, savedAt: 456 });
});

it('rejects garbage as corrupt', () => {
  expect(decodeSave('not a save')).toEqual({ ok: false, reason: 'corrupt' });
  expect(decodeSave('')).toEqual({ ok: false, reason: 'corrupt' });
});

it('refuses saves from a newer version', () => {
  expect(decodeSave(raw({ schema: 99, savedAt: 0, state: newGame(1, 0) }))).toEqual({ ok: false, reason: 'future' });
});

it('rejects impossible states', () => {
  const bad = [
    { ...newGame(1, 0), gold: Number.NaN },
    { ...newGame(1, 0), diamonds: -1 },
    { ...newGame(1, 0), depth: 5, deepest: 3 },
    { ...newGame(1, 0), progress: 1 },
  ];
  for (const state of bad) expect(decodeSave(raw({ schema: 1, savedAt: 0, state }))).toEqual({ ok: false, reason: 'invalid' });
});

it('migrations run in order', () => {
  const out = migrate({ v: [] }, 1, 3, {
    1: (s) => ({ v: [...(s as { v: number[] }).v, 1] }),
    2: (s) => ({ v: [...(s as { v: number[] }).v, 2] }),
  });
  expect(out).toEqual({ v: [1, 2] });
  expect(() => migrate({}, 1, 3, { 1: (s) => s })).toThrow();
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/core/save.test.ts`, which should
  FAIL.
- [ ] **Step 3: Implement `save.ts`**.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run tests/core`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/core tests/core && git commit -m "Add the versioned save format"`

---

### Task 7: Game store, storage, tab lock

**Files:**
- Create: `src/store/storage.ts`, `src/store/tabLock.ts`, `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts`, `tests/store/tabLock.test.ts`

**Interfaces:**
- Consumes: everything in `src/core`.
- Produces:
  - `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`
  - `class MemoryStorage implements StorageLike`
  - `safeStorage(getLocal: () => Storage): { storage: StorageLike; available: boolean }`: probes with a
    write and remove of `goldenminer.probe`. On any throw it returns a `MemoryStorage` and
    `available: false`.
  - `SAVE_KEY = 'goldenminer.save'`, `BACKUP_PREFIX = 'goldenminer.save.backup.'`,
    `TAB_KEY = 'goldenminer.tab'`
  - `class TabLock { constructor(storage: StorageLike, now: () => number, id: string); tryAcquire(): boolean; heartbeat(): boolean; takeOver(): void; release(): void }`.
    The record at `TAB_KEY` is `{ id, beat }`.
    - `tryAcquire` succeeds if there's no record, the record is its own, or the record is older than
      `TAB_LOCK_STALE_MS`.
    - `heartbeat` returns false once another id owns the record; otherwise it refreshes `beat`.
  - `interface Feedback { gold: number; diamonds: number; finds: FindRecord[] }`. `finds` holds at
    most the 3 newest.
  - `type Notice = { kind: 'loadFailed'; reason: 'corrupt' | 'future' | 'invalid'; backupKey: string } | { kind: 'saveFailed' } | { kind: 'storageUnavailable' } | null`
  - `class GameStore` with constructor
    `(deps: { storage: StorageLike; storageAvailable: boolean; now: () => number; newSeed: () => number })`:
    - getters `state: GameState`, `stats: Stats`, `version: number`, `offlineSummary: OfflineSummary | null`,
      and `notice: Notice`
    - `subscribe(fn: () => void): () => void`
    - `load(): void`: decodes `SAVE_KEY`.
      - On failure it copies the raw text to `BACKUP_PREFIX + now()`, starts `newGame`, and sets a
        `loadFailed` notice.
      - With no save, it starts a new game.
      - It then catches up with `advance`. If at least `OFFLINE_SUMMARY_MIN_TICKS` ticks were applied,
        it sets `offlineSummary` via `summarize`.
      - If `storageAvailable` is false, it sets a `storageUnavailable` notice.
    - `pump(): void` advances to `now()` and folds events into the pending `Feedback`. It sets
      `offlineSummary` when one pump applied ≥ `OFFLINE_SUMMARY_MIN_TICKS` ticks.
    - `click(): TickEvent[]` uses the `ClickLimiter`. When a click is refused it returns `[]` and
      changes nothing.
    - `moveTo(depth: number): boolean`
    - `drainFeedback(): Feedback` returns the pending feedback and resets it.
    - `save(): void` writes `encodeSave`. If `setItem` throws, it sets a `saveFailed` notice and does
      not rethrow.
    - `exportSave(): string`
    - `importSave(text: string): DecodeResult` replaces the state only when the result is ok.
    - `hardReset(): void` starts a new game and saves.
    - `dismissSummary(): void` and `dismissNotice(): void`
    - Every mutation bumps `version` and notifies subscribers.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/store/gameStore.test.ts
import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { encodeSave } from '../../src/core/save';
import { newGame } from '../../src/core/newGame';

function make(now = { t: 0 }, storage = new MemoryStorage(), available = true) {
  const store = new GameStore({ storage, storageAvailable: available, now: () => now.t, newSeed: () => 7 });
  return { store, storage, now };
}

describe('GameStore', () => {
  it('starts a new game when there is no save', () => {
    const { store } = make();
    store.load();
    expect(store.state.seed).toBe(7);
    expect(store.notice).toBeNull();
    expect(store.offlineSummary).toBeNull();
  });

  it('saves and restores', () => {
    const { store, storage, now } = make();
    store.load(); now.t = 5000; store.pump(); store.save();
    const again = make(now, storage).store; again.load();
    expect(again.state.gold).toBe(store.state.gold);
  });

  it('shows an offline summary only for long absences', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, encodeSave(newGame(1, 0), 0));
    const short = make({ t: 100_000 }, storage).store; short.load();
    expect(short.offlineSummary).toBeNull();
    const long = make({ t: 600_000 }, storage).store; long.load();
    expect(long.offlineSummary?.ticks).toBe(600);
  });

  it('keeps an unreadable save as a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const { store } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'corrupt', backupKey: BACKUP_PREFIX + '42' });
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
    store.save();
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
  });

  it('survives storage that refuses writes', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const { store } = make({ t: 0 }, storage); store.load();
    expect(() => store.save()).not.toThrow();
    expect(store.notice).toEqual({ kind: 'saveFailed' });
  });

  it('reports when storage is unavailable', () => {
    const { store } = make({ t: 0 }, new MemoryStorage(), false); store.load();
    expect(store.notice).toEqual({ kind: 'storageUnavailable' });
    const probe = safeStorage(() => { throw new Error('SecurityError'); });
    expect(probe.available).toBe(false);
  });

  it('a bad import leaves the game untouched', () => {
    const { store, now } = make(); store.load(); now.t = 3000; store.pump();
    const gold = store.state.gold;
    expect(store.importSave('nope')).toEqual({ ok: false, reason: 'corrupt' });
    expect(store.state.gold).toBe(gold);
    const other = newGame(2, 0); other.gold = 999;
    expect(store.importSave(encodeSave(other, 0)).ok).toBe(true);
    expect(store.state.seed).toBe(2);
  });

  it('caps clicks at 10 per second', () => {
    const { store } = make(); store.load();
    for (let i = 0; i < 11; i++) store.click();
    expect(store.state.tickCount).toBe(10);
  });

  it('aggregates feedback between drains', () => {
    const { store, now } = make(); store.load(); now.t = 5000; store.pump();
    expect(store.drainFeedback().gold).toBe(5);
    expect(store.drainFeedback()).toEqual({ gold: 0, diamonds: 0, finds: [] });
  });
});
```

```ts
// tests/store/tabLock.test.ts
import { expect, it } from 'vitest';
import { TabLock } from '../../src/store/tabLock';
import { MemoryStorage } from '../../src/store/storage';

it('only one tab plays; a stale lock can be taken; the loser finds out', () => {
  const storage = new MemoryStorage(); const clock = { t: 0 }; const now = () => clock.t;
  const a = new TabLock(storage, now, 'a'); const b = new TabLock(storage, now, 'b');
  expect(a.tryAcquire()).toBe(true);
  expect(b.tryAcquire()).toBe(false);
  clock.t = 5001;
  expect(b.tryAcquire()).toBe(true);
  expect(a.heartbeat()).toBe(false);
  a.takeOver();
  expect(b.heartbeat()).toBe(false);
  expect(a.heartbeat()).toBe(true);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/store`, which should FAIL.
- [ ] **Step 3: Implement** `storage.ts`, `tabLock.ts` and `gameStore.ts`. `GameStore` recomputes
  `stats` with `deriveStats` after every state change; it's cheap. Only take a `structuredClone`
  "before" snapshot for `summarize` when a summary is possible, i.e. when
  `now() - lastTickAt ≥ OFFLINE_SUMMARY_MIN_TICKS × 1000 / autoTicksPerSecond`. Never clone on an
  ordinary 250 ms pump.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run`, which should PASS (all suites).
- [ ] **Step 5: Commit**: `git add src/store tests/store && git commit -m "Add the game store, safe storage and single-tab lock"`

---

### Task 8: Sprite atlas and placeholder sprites

**Files:**
- Create: `src/sprites/grids.ts`, `src/sprites/atlas.ts`, `src/sprites/placeholderAtlas.ts`,
  `src/sprites/AtlasContext.tsx`, `src/sprites/Sprite.tsx`
- Test: `tests/sprites/atlas.test.ts`

**Interfaces:**
- Produces:
  - `PALETTE: Record<string, string>` copied verbatim from `this.pal` in
    `.superpowers/mockups/project/Character.dc.html`.
  - `GRIDS: Record<SpriteName, string[]>`, copied verbatim from the mockups: `miner` (Character),
    `coin`, `diamond`, `chest`, `map` and `gem` (Main).
  - `ruby`, which is `gem` with the palette overrides `{ C: '#ffb0a6', c: '#e0574a', b: '#8a2a22' }`,
    expressed as `PALETTE_OVERRIDES: Partial<Record<SpriteName, Record<string, string>>>`.
  - `type SpriteName = 'miner' | 'coin' | 'diamond' | 'chest' | 'map' | 'gem' | 'ruby'`
  - `interface AtlasFrame { x: number; y: number; w: number; h: number }`
  - `interface SpriteAtlas { imageUrl: string; width: number; height: number; frames: Record<SpriteName, AtlasFrame> }`
  - `layoutAtlas(sizes: Record<SpriteName, { w: number; h: number }>, maxWidth = 256): { width: number; height: number; frames: Record<SpriteName, AtlasFrame> }`
    does shelf packing in insertion order with 1 px of padding.
  - `spriteStyle(atlas: SpriteAtlas, name: SpriteName, scale: number): { width: string; height: string; backgroundImage: string; backgroundPosition: string; backgroundSize: string; imageRendering: 'pixelated' }`
  - `buildPlaceholderAtlas(): SpriteAtlas` paints the grids onto a canvas and returns a
    `toDataURL('image/png')`. It is DOM code and isn't unit-tested.
  - `<AtlasProvider>` builds the atlas once with `useMemo`.
  - `<Sprite name scale label? />` renders a `<span>` with `spriteStyle`, `role="img"` plus
    `aria-label` when `label` is given, and `aria-hidden` otherwise. `scale` must be a positive
    integer; throw in dev if it isn't.

The format accepts any frame size, so a real pack later only has to supply an image URL and a frames
map (Plan 7).

- [ ] **Step 1: Write the failing tests** in `tests/sprites/atlas.test.ts`

```ts
import { expect, it } from 'vitest';
import { GRIDS, PALETTE, PALETTE_OVERRIDES } from '../../src/sprites/grids';
import { layoutAtlas, spriteStyle, type SpriteName } from '../../src/sprites/atlas';

const names = Object.keys(GRIDS) as SpriteName[];

it('every grid is rectangular and uses known colours', () => {
  for (const n of names) {
    const rows = GRIDS[n];
    expect(new Set(rows.map((r) => r.length)).size, n).toBe(1);
    const pal = { ...PALETTE, ...(PALETTE_OVERRIDES[n] ?? {}) };
    for (const ch of rows.join('')) if (ch !== '.') expect(pal[ch], `${n}:${ch}`).toBeDefined();
  }
  expect(GRIDS.miner).toHaveLength(20);
  expect(GRIDS.miner[0]).toHaveLength(16);
  expect(GRIDS.ruby).toEqual(GRIDS.gem);
});

it('packs frames without overlap', () => {
  const sizes = Object.fromEntries(names.map((n) => [n, { w: GRIDS[n][0]!.length, h: GRIDS[n].length }])) as Record<SpriteName, { w: number; h: number }>;
  const { width, frames } = layoutAtlas(sizes);
  expect(width).toBeLessThanOrEqual(256);
  const list = Object.values(frames);
  for (const a of list) for (const b of list) if (a !== b) {
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    expect(apart).toBe(true);
  }
});

it('scales a frame by whole pixels', () => {
  const atlas = { imageUrl: 'x.png', width: 100, height: 50, frames: { coin: { x: 10, y: 4, w: 8, h: 8 } } } as never;
  expect(spriteStyle(atlas, 'coin', 3)).toEqual({
    width: '24px', height: '24px', backgroundImage: 'url("x.png")',
    backgroundPosition: '-30px -12px', backgroundSize: '300px 150px', imageRendering: 'pixelated',
  });
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/sprites`, which should FAIL.
- [ ] **Step 3: Implement** `grids.ts`, `atlas.ts`, `placeholderAtlas.ts`, `AtlasContext.tsx` and
  `Sprite.tsx`.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/sprites tests/sprites && git commit -m "Add the sprite atlas and placeholder sprites"`

---

### Task 9: Mine scene, floating feedback, header, finds feed

**Files:**
- Create: `src/ui/useGame.ts`, `src/ui/Header.tsx`, `src/ui/mine/sceneTiles.ts`,
  `src/ui/mine/particles.ts`, `src/ui/mine/MineScene.tsx`, `src/ui/mine/FindsFeed.tsx`,
  `src/ui/mine/MineView.tsx`
- Test: `tests/ui/sceneTiles.test.ts`, `tests/ui/particles.test.ts`

**Interfaces:**
- Consumes: `GameStore` (Task 7), `Sprite` (Task 8), `bandAt`/`tierAt` (Task 2), and `formatNumber`
  (Task 1).
- Produces:
  - `useGame(store: GameStore): GameStore` re-renders on `version` via `useSyncExternalStore`.
  - `interface SceneTile { shade: string; edge: string; fleck: 'gold' | 'diamond' | null; shaft: boolean }`
  - `bandPalette(tier: number): [string, string, string, string]` with exact shades per tier:
    - 1 Topsoil `['#5a4030','#4e3828','#614634','#553b2b']`
    - 2 Clay Beds `['#6b4a35','#5c3f2d','#734f39','#63442f']`
    - 3 Limestone `['#6a5f4f','#5e5446','#716553','#665b4a']`
    - 4 Granite Veins `['#4a4550','#524c59','#433e49','#5a5462']`
    - 5 Basalt Deep `['#2c2832','#332e3a','#28242d','#38323f']`
    - 6 Obsidian Reach `['#1f1b24','#241f2a','#1b1820','#2a2430']`
    - 7 and up, The Abyss: `['#1a1620','#201a27','#17131c','#241d2c']`
  - `sceneTiles(tier: number): SceneTile[]` returns 14 columns × 12 rows, row-major (`r` = row,
    `c` = column), using the mockup's exact pattern from `Main.dc.html` `renderVals`:
    - `shaft` is `c >= 5 && c <= 8 && r <= 8`.
    - The shade is `bandPalette(tier)[(r*7 + c*13 + ((r*c) % 5)) % 4]`.
    - A gold fleck is `!shaft && ((r*3 + c*5) % 17 === 0 || (r >= 9 && (r + c*2) % 7 === 0))`.
    - A diamond fleck is `!shaft && !gold && ((r*5 + c*3) % 23 === 0 || (r === 10 && c === 8))`.
    - Shaft tiles alternate `#1d191f` (even rows) and `#1a171c` (odd rows), with edge `#141116`.
      Rock tiles have edge `rgba(0, 0, 0, 0.25)`.
  - `type ParticleKind = 'gold' | 'diamond' | FeatureKind`
  - `interface Particle { id: number; kind: ParticleKind; text: string; x: number; y: number; bornAt: number }`
  - `particlesFromEvents(events: TickEvent[], origin: { x: number; y: number }, nowMs: number, nextId: () => number): Particle[]`
    produces:
    - one `gold` particle with the summed amount (`'+' + formatNumber(sum)`) at the origin;
    - one `diamond` particle with the summed amount at `origin + (26, 14)`;
    - at most 3 find particles at `origin + (-10, -24·i)`, labelled `Chest!`, `Map!`, `Gem!`,
      `Gold vein +N` and `Diamonds +N`.
  - `feedbackToEvents(f: Feedback): TickEvent[]` adapts the store's aggregate for automatic ticks.
  - `pruneParticles(list: Particle[], nowMs: number, lifeMs = 1300, max = 30): Particle[]` drops
    particles older than `lifeMs` and keeps the newest `max`.
- UI behaviour (match board 1 of the mockup):
  - The **Header** shows Gold and Diamonds with their sprites, and "<depth> m · deepest <deepest> m".
    It uses `formatNumber` throughout. Souls and level arrive in Plan 3.
  - **MineScene** is one `<button aria-label="Dig: click the rock">` with the tile grid, the rope, the
    lamp glow and the miner sprite (scale 4) at the shaft bottom, plus the band label
    "<band> · dig face at <deepest> m · tier <n>" (or "side gallery at <depth> m" when
    `depth < deepest`).
    - `onClick` calls `store.click()` and spawns particles at the pointer, or at the dig face when
      `clientX` and `clientY` are 0 (a keyboard click).
    - A 1 s interval drains `store.drainFeedback()` and spawns particles at the dig face.
    - Particles render as `.gm-particle` spans using `gmFloat` (or `gmPop` for finds), with
      `pointer-events: none`.
  - Below the scene: a next-metre bar (`progress`, or `galleryProgress` in a gallery) and the line
    "Auto <n> tick/s · each click +<n> tick".
  - **FindsFeed** shows the 6 newest `finds`, newest first, each with its sprite (`chest`, `map`,
    `gem`, `coin` for Gold veins, `diamond` for Diamond veins), a label, the amount for veins, and
    "at <depth> m".

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/sceneTiles.test.ts
import { expect, it } from 'vitest';
import { bandPalette, sceneTiles } from '../../src/ui/mine/sceneTiles';

it('builds the 14×12 shaft cutaway in the band colours', () => {
  const tiles = sceneTiles(4);
  expect(tiles).toHaveLength(168);
  const at = (r: number, c: number) => tiles[r * 14 + c]!;
  expect(at(0, 5).shaft).toBe(true); expect(at(8, 8).shaft).toBe(true);
  expect(at(9, 6).shaft).toBe(false); expect(at(3, 4).shaft).toBe(false);
  const granite = bandPalette(4);
  for (const t of tiles) if (!t.shaft) expect(granite).toContain(t.shade);
  expect(sceneTiles(4)).toEqual(tiles);
  expect(bandPalette(7)).toEqual(bandPalette(30));
});
```

```ts
// tests/ui/particles.test.ts
import { expect, it } from 'vitest';
import { particlesFromEvents, pruneParticles } from '../../src/ui/mine/particles';
import type { TickEvent } from '../../src/core/types';

let id = 0; const next = () => ++id;

it('a burst of ticks becomes a handful of particles', () => {
  const events: TickEvent[] = [
    ...Array.from({ length: 300 }, () => ({ kind: 'gold', amount: 3 }) as const),
    { kind: 'diamond', amount: 1 }, { kind: 'diamond', amount: 1 },
    ...Array.from({ length: 5 }, (_, i) => ({ kind: 'find', find: { depth: i, kind: 'chest', amount: 0, tick: i } }) as const),
  ];
  const ps = particlesFromEvents(events, { x: 100, y: 200 }, 0, next);
  expect(ps.find((p) => p.kind === 'gold')).toMatchObject({ text: '+900', x: 100, y: 200 });
  expect(ps.find((p) => p.kind === 'diamond')).toMatchObject({ text: '+2', x: 126, y: 214 });
  expect(ps.filter((p) => p.kind === 'chest')).toHaveLength(3);
  expect(ps).toHaveLength(5);
});

it('old particles expire and the count stays bounded', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i, kind: 'gold' as const, text: '+1', x: 0, y: 0, bornAt: i * 10 }));
  const kept = pruneParticles(many, 1500);
  expect(kept.every((p) => 1500 - p.bornAt <= 1300)).toBe(true);
  expect(pruneParticles(many, 500)).toHaveLength(30);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/ui`, which should FAIL.
- [ ] **Step 3: Implement** `sceneTiles.ts`, `particles.ts`, then `useGame.ts`, `Header.tsx`,
  `MineScene.tsx`, `FindsFeed.tsx` and `MineView.tsx`. `MineView` lays out
  `[scene + minimap slot] / [progress] / [finds]`, using flex-wrap so it stacks at 390 px.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/ui tests/ui && git commit -m "Add the clickable mine scene with floating gold and diamonds"`

---

### Task 10: Minimap

**Files:**
- Create: `src/ui/mine/minimap.ts`, `src/ui/mine/Minimap.tsx`
- Modify: `src/ui/mine/MineView.tsx` (fill the minimap slot)
- Test: `tests/ui/minimap.test.ts`

**Interfaces:**
- Consumes: `GameState`, `bandAt`/`tierAt` (Task 2), `Sprite`, and `store.moveTo`.
- Produces:
  - `MINIMAP_METRES = 88`, `MINIMAP_PX_PER_METRE = 6`
  - `interface MinimapMarker { y: number; kind: FeatureKind; count: number; label: string }`
  - `interface MinimapModel { top: number; bottom: number; bands: { name: string; y: number; height: number; color: string }[]; ticks: { depth: number; y: number }[]; markers: MinimapMarker[]; ahead: { y: number; kind: FeatureKind | 'hardRock' }[]; youY: number; fogY: number }`
  - `minimapModel(state: GameState, lampSight: number): MinimapModel`, built as follows:
    - `top = max(0, depth - 50)`, `bottom = top + 88`, and `y(d) = (d - top) × 6`.
    - `bands` covers the visible slices of each band, coloured with `bandPalette(tier)[1]`.
    - `ticks` falls every 10 m.
    - `markers` groups visible finds into 4 m buckets (`floor(depth/4)`). Each bucket shows its
      highest-priority kind (`map > chest > gem > diamondVein > goldVein`) and the bucket's total
      count, at `y(bucket·4 + 2)`. Labels are `Map T<tierAt(bucket·4 + 2)>`, `Chest`, `Gem`,
      `Diamonds` and `Gold vein`, with ` ×<count>` added when count > 1. Markers are sorted by `y`.
    - `ahead` comes from `state.ahead` entries with a feature (or `hardRock` when it has none but is
      hard), at `y(metre - 0.5)`.
    - `youY = y(depth)` and `fogY = y(deepest + lampSight)`.
  - `depthAtY(model: MinimapModel, y: number, deepest: number): number` returns
    `clamp(round(top + y/6), 0, deepest)`.
- UI: match the minimap on board 1.
  - A tick column, band slices, find markers using sprites at scale 2, ahead hints at 80% opacity
    (with "harder rock" text for hard rock), a dimmed strip from `youY` to `fogY`, a hatched fog
    below `fogY` with a "?", and a gold line plus a "You · <depth> m" tag.
  - The strip is a `<button aria-label="Minimap: choose a depth to dig at">`. Clicking calls
    `store.moveTo(depthAtY(...))`.
  - The caption reads: "Everything found so far, by depth. Tap an explored depth to climb back. Your
    lamp lights <n> m past the dig face."

- [ ] **Step 1: Write the failing tests** in `tests/ui/minimap.test.ts`

```ts
import { expect, it } from 'vitest';
import { depthAtY, minimapModel } from '../../src/ui/mine/minimap';
import { newGame } from '../../src/core/newGame';

function at(depth: number, deepest = depth) {
  const s = newGame(1, 0);
  s.depth = depth; s.deepest = deepest;
  s.ahead = { [deepest + 1]: { feature: 'chest', amount: 0, hardRock: false }, [deepest + 2]: { feature: null, amount: 0, hardRock: true } };
  return s;
}

it('the window keeps the miner about 57% down', () => {
  expect(minimapModel(at(20), 2).top).toBe(0);
  const m = minimapModel(at(340), 2);
  expect(m).toMatchObject({ top: 290, bottom: 378, youY: 300, fogY: 312 });
});

it('nearby finds share one marker, most important kind first', () => {
  const s = at(340);
  s.finds = [
    { depth: 301, kind: 'chest', amount: 0, tick: 1 },
    { depth: 302, kind: 'map', amount: 0, tick: 2 },
    { depth: 330, kind: 'goldVein', amount: 20, tick: 3 },
    { depth: 10, kind: 'map', amount: 0, tick: 4 },
  ];
  const { markers } = minimapModel(s, 2);
  expect(markers).toEqual([
    { y: (302 - 290) * 6, kind: 'map', count: 2, label: 'Map T4 ×2' },
    { y: (330 - 290) * 6, kind: 'goldVein', count: 1, label: 'Gold vein' },
  ]);
});

it('shows what the lamp reveals ahead', () => {
  const { ahead } = minimapModel(at(340), 2);
  expect(ahead).toEqual([{ y: (340.5 - 290) * 6, kind: 'chest' }, { y: (341.5 - 290) * 6, kind: 'hardRock' }]);
});

it('a tap maps to an explored depth only', () => {
  const m = minimapModel(at(300, 340), 2);
  expect(depthAtY(m, 0, 340)).toBe(250);
  expect(depthAtY(m, 527, 340)).toBe(338);
  expect(depthAtY(minimapModel(at(340), 2), 520, 340)).toBe(340);
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run tests/ui/minimap.test.ts`, which should
  FAIL.
- [ ] **Step 3: Implement** `minimap.ts`, `Minimap.tsx`, and the `MineView` slot.
- [ ] **Step 4: Run the tests and see them pass**: `npx vitest run`, which should PASS.
- [ ] **Step 5: Commit**: `git add src/ui tests/ui && git commit -m "Add the minimap with find history, lamp sight and climbing back"`

---

### Task 11: App wiring, dialogs, README, final check

**Files:**
- Create: `src/ui/OfflineSummary.tsx`, `src/ui/SaveMenu.tsx`, `src/ui/Notices.tsx`,
  `src/ui/TabBlocked.tsx`
- Modify: `src/ui/App.tsx`, `src/main.tsx`, `README.md`

**Interfaces:**
- Consumes: `GameStore`, `TabLock`, `safeStorage`, `SAVE_KEY`, `AUTOSAVE_INTERVAL_MS`,
  `TAB_HEARTBEAT_MS`, `formatNumber` and `formatDuration`.
- Behaviour (all wiring; the logic is already tested):
  - `main.tsx`:
    - creates `safeStorage(() => window.localStorage)`;
    - creates the `GameStore` with `now: Date.now` and
      `newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!`;
    - creates a `TabLock` with id `crypto.randomUUID()`.
  - **When `tryAcquire()` fails**, render `TabBlocked` ("Golden Miner is open in another tab.") with
    a "Play here" button that calls `takeOver()` and then starts the game. Nothing loads or saves
    before that.
  - **Starting the game:**
    - `store.load()`;
    - `setInterval(pump, 250)`;
    - autosave every `AUTOSAVE_INTERVAL_MS`;
    - `save()` on `visibilitychange` → hidden and on `pagehide`;
    - a heartbeat every `TAB_HEARTBEAT_MS`. If the heartbeat returns false, stop every interval
      **without saving** and render `TabBlocked`.
  - **OfflineSummary** is a `role="dialog"` with
    "While you were away (<formatDuration>): dug <metres> m, +<gold> Gold, +<diamonds> Diamonds",
    then the find counts that are > 0, and an OK button that calls `dismissSummary()`.
  - **Notices** is a dismissible banner:
    - `loadFailed`: "Your save couldn't be loaded (<reason>). It was kept as a backup, and a new game
      started."
    - `saveFailed`: "Progress couldn't be saved. Your browser storage may be full."
    - `storageUnavailable`: "This browser mode doesn't allow saving, so progress will be lost when
      you close the tab."
  - **SaveMenu** opens from a "Save" button in the header and has three parts:
    - Export: a read-only textarea filled with `exportSave()`, plus a Copy button.
    - Import: a textarea and a Load button. It shows "Loaded." or "That save couldn't be read
      (<reason>)."
    - Reset: two steps ("Start over" → "Really erase this game? Yes / No").
  - The `README.md` is rewritten to describe the new game, how to run it (`npm install`,
    `npm run dev`, `npm test`, `npm run build`), that it needs Node ≥ 22.12, and that the 2013
    original lives in `legacy/` (open `legacy/index-dev.html`).

- [ ] **Step 1: Implement** the components and the wiring in `App.tsx` and `main.tsx`.
- [ ] **Step 2: Run the whole suite and the build**

Run: `npm test && npm run build`
Expected: every suite passes, and `dist/` is built with no type errors.

- [ ] **Step 3: Manual smoke check** with `npm run dev` in a desktop browser and again at 390 px width
  in the browser's device mode:
  - Gold ticks up once per second with a floating `+1` at the dig face.
  - A click floats `+N` at the pointer, and spam-clicking caps at 10 per second.
  - Within about a minute the first **map** find appears in the feed and on the minimap.
  - The minimap shows a hint just below the "You" line and fog after it.
  - Clicking the minimap above your depth moves you into a side gallery (the label changes), and
    clicking the bottom of the explored area returns you to the face.
  - Export, then Start over, then Import the exported string restores the game.
  - Opening a second tab shows "open in another tab". "Play here" moves the game there, and the
    first tab switches to the blocked screen.
  - Under OS reduced-motion, numbers no longer float.
- [ ] **Step 4: Commit**: `git add -A && git commit -m "Wire the game shell: saves, offline summary, notices and tab lock"`
