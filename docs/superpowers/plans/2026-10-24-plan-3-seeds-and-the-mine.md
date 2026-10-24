# Golden Miner — Plan 3: Seeds and the Mine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every world a shareable text seed that fixes the mine for everyone, while loot stays luck. Turn the mine scene into a single shaft that steps down as metres are dug, with seeded wall textures, generated deep bands and a 3 m lamp. Move the UI to the Diablo-style fonts, and add a Settings dialog for motion, the seed, saves and new worlds.

**Architecture:**
- A new `src/core/seed.ts` maps seed text to the 32-bit `seed` and makes readable random seeds.
- `GameState` gains `worldSeed`, `worldGen` and `settings.motion`, and the save moves to schema 3.
- In world-generation version 2 the metre rolls use base chances only, so they are a pure function of `(seed, metre)`. Find gear instead adds **bonus finds** from `state.rng`, which a new world seeds independently of the world seed.
- The mine's looks come from pure functions:
  - `src/core/mineLook.ts`: band titles, palettes and wall details;
  - `src/ui/mine/shaftModel.ts`: the rows of the shaft.

  A new `ShaftScene` renders the model and animates each finished metre.

**Tech Stack:** unchanged: Node 24, TypeScript 7, Vite 8, React 19, Vitest 5, lz-string. No new dependencies; the new fonts load from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-10-24-round-2-seeds-procedural-inventory-design.md`, sections 3, 4.3, 4.4, 5 and 6. It amends the main spec `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md`. Mockups (published at https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR):
- `.superpowers/mockups/project/Shaft.dc.html`
- `Settings.dc.html`
- `Fonts.dc.html` (option B)

**Builds on:** `dev-ernest` at `96632d0` (Plans 1–2 plus the approved round-2 design). The save schema is currently 2.

**Roadmap** (9 plans after round 2):
1. Foundation and digging
2. Items and the character screen
3. **Seeds and the mine** (this plan)
4. Inventory, round 2
5. Maps, combat, levels (procedural)
6. Passive web
7. Merchant and crafting
8. Auto-mapping and ascension
9. Balance and launch

## Global Constraints

- Static site: TypeScript + Vite + React, no backend, no new npm dependencies.
- Node 24 (`node -v` prints `v24.`).
- `tsconfig` is unchanged. Tests read fixtures only through Vite `?raw` imports.
- Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call `Date.now()` / `Math.random()`.
- **World generation is a pure function of `(seed, position)`.** It never reads or advances `state.rng`, and never reads gear or stats (round-2 spec §3.3). This covers metre rolls in version 2, band titles and looks, and wall tiles. Loot, bonus finds, gallery finds and combat use `state.rng`.
- **Readable numbers:** every number shown goes through `formatNumber` or `formatRate`.
- **No login pressure:** nothing new expires or punishes absence.
- **Saves:**
  - `SCHEMA_VERSION = 3`. Schema 1 and 2 saves migrate.
  - `tests/fixtures/save-schema-2.txt` (committed in `96632d0`) is a real Plan 2 export. Never regenerate it.
  - A save whose `worldSeed` doesn't map to its `seed` is `invalid`.
- Phones: the layout works at 390 px width, and every button and click target is ≥ 44 px.
- **Fonts (round-2 §6.1, option B):**
  - Display font `Metamorphous`, for the title, headings, dialog titles, and item names in tooltips and cards.
  - Text font `Alegreya Sans` (400, 500, 700).
  - Numbers in `IBM Plex Mono` (500).
- **Motion:**
  - Every animation honours `settings.motion`.
  - When `prefers-reduced-motion: reduce` is set, every motion setting acts as off (round-2 §6.2).
- Tunable numbers live in `src/core/balance.ts`. Word lists and band content live in `src/core/seed.ts` and `src/core/mineLook.ts`.
- No `!` non-null assertions in `src/`.
- Git: work on `dev-ernest`. Stage explicit file paths. Commit messages are short imperative sentences with no Claude/Anthropic attribution of any kind. Never push.

## Review Focus

1. **Two players typing the same seed.** They see the same finds at the same metres and the same deep band names, whatever gear they wear. Their loot (chest contents, gallery finds, bonus finds) differs. Tests: Tasks 1–2.
2. **Old saves.** A schema-2 save loads as world-generation 1. It keeps its seed (written as text) and its metre rolls, and its "The Abyss" band names stay. Test: Task 1, with the real fixture.
3. **Odd seed text.** Spaces, capital letters, an empty string, very long text, a number with leading zeros, a number above 2³²−1 and non-Latin text. Expected:
   - "Golden Mole" and "golden mole " are the same world.
   - Empty text is refused with a message.
   - Text is limited to 64 characters.
   - Nothing crashes.
   - Tests: Tasks 1 and 6.
4. **Fast digging and catch-up.** Several metres finished in one tick, or a big offline catch-up. The shaft moves once to the final position, not one animation per metre, and nothing piles up. Tests: Task 4 (model), plus Task 5's check.
5. **Motion off.** With "Mine shaft: Off" or the system's reduced motion, nothing slides, floats, pops or flickers, and the game still shows every gain (the feed and header update). Tests: Task 6, plus Task 5's check.

## Decisions this plan makes (my calls; overrule them in review)

- **New saves:** a new world's seed text is `<adjective>-<animal>-<1–999>`. The word lists hold 40 adjectives and 40 animals; the spec's "about 100" is shortened to 40 for this plan.
- **How text maps to a seed:**
  - A text of digits only, up to 10 digits and ≤ 4294967295, is used as that number.
  - Any other text is trimmed and lowercased, then hashed with FNV-1a over its UTF-8 bytes.
  - Seed text is 1–64 characters once trimmed.
- **Bonus finds:**
  - The bonus chance per kind is `base × (find multiplier − 1)`. It is rolled only on dug face metres whose seeded roll has no feature.
  - Bonus finds are marked `bonus: true` on their find record, and the feed says "bonus".
- **Lamp:** base lamp sight goes from 2 m to 3 m.
- **Looks for old saves:** old saves keep their content (version 1) but get the new seeded wall textures too, since those are cosmetic. Their deep bands keep the names "The Abyss I, II…".
- **Shaft layout:** 13 visible rows of 56 px, with the miner's row 5th from the top (`MINER_ROW = 4`), and 4 wall columns on each side. Above the surface, the rows show grass and sky.
- **Side galleries:** the miner's row shows a short tunnel cut into the right wall, the shaft below stays dug, and no lamp labels are shown.
- **Header:** the Save button becomes Settings. The Settings dialog contains:
  - motion switches;
  - the world seed with Copy;
  - Loot filter…;
  - Export / import save…;
  - Start a new world… (random or typed seed, two-step confirm);
  - a donate link, which stays hidden until `DONATE_URL` is set. **Ernest: give me the URL.**
- **Display-only:** "Lamp flicker" is a new subtle animation on the lamp glow, so the switch has something to turn off.

---

## File structure

```
src/core/
  seed.ts         NEW  seedFromText, randomSeedText, isValidSeedText, freshWorld, ADJECTIVES, ANIMALS
  mineLook.ts     NEW  WorldRef, bandTitle, bandLook, wallTile, DETAILS, NAMED_PALETTES, DEEP_* word lists
  types.ts, balance.ts, newGame.ts, metres.ts, dig.ts, stats.ts, save.ts   MOD
src/store/gameStore.ts   MOD  freshWorld on new games, newWorld(seedText), setMotion
src/ui/
  mine/shaftModel.ts NEW (pure), mine/ShaftScene.tsx NEW, mine/shaft.css NEW
  mine/MineView.tsx, mine/minimap.ts, mine/Minimap.tsx, mine/particles.ts   MOD
  mine/MineScene.tsx, mine/sceneTiles.ts   DELETE (replaced; bandPalette moves to mineLook)
  settings/motion.ts NEW (pure), settings/SettingsDialog.tsx NEW, settings/NewWorld.tsx NEW
  SaveMenu.tsx → settings/SaveDialog.tsx (export/import only), Header.tsx, App.tsx, theme.css, links.ts NEW
index.html (fonts)
```

---

### Task 1: The world seed and save schema 3

**Files:**
- Create: `src/core/seed.ts`, `tests/core/seed.test.ts`
- Modify: `src/core/types.ts`, `src/core/newGame.ts`, `src/core/save.ts`, `src/store/gameStore.ts`, `tests/store/gameStore.test.ts`, `tests/store/lifecycle.test.ts`, `tests/core/save.test.ts`

**Interfaces:**
- **`seed.ts`:**
  - `seedFromText(text: string): number`. A trimmed text of 1–10 digits whose value is ≤ 4294967295 returns that value. Any other text is trimmed and lowercased, then hashed as FNV-1a 32-bit over its UTF-8 bytes:
    - start with `h = 0x811c9dc5`;
    - for each byte, `h ^= b; h = Math.imul(h, 0x01000193) >>> 0`.
  - `isValidSeedText(text)`: the trimmed length is 1–64.
  - `ADJECTIVES` (40): amber, ashen, brave, bright, calm, copper, crimson, dusky, eager, ember, fallen, frosty, gentle, gilded, golden, hidden, hollow, iron, jolly, lucky, mellow, misty, mossy, noble, quiet, rusty, sandy, scarlet, shady, silent, silver, sleepy, smoky, stony, sunny, swift, velvet, wild, windy, young.
  - `ANIMALS` (40): badger, bat, bear, beetle, boar, crow, deer, eel, falcon, ferret, finch, fox, frog, gecko, goat, hare, hawk, heron, ibis, lark, lynx, magpie, marten, mole, moth, newt, otter, owl, pike, raven, robin, salmon, shrew, snail, stoat, swan, toad, vole, weasel, wren.
  - `randomSeedText(next: () => number): string` returns `` `${ADJECTIVES[next() % 40]}-${ANIMALS[next() % 40]}-${1 + (next() % 999)}` ``. `next` returns uint32 values and is called exactly three times, in that order.
  - `freshWorld(next: () => number, nowMs: number): GameState`:
    - the text is `randomSeedText(next)`;
    - the result is `newGame(seedFromText(text), nowMs, { seedText: text, lootSeed: next() })`, so `next` is called four times in all.
- **`newGame(seed, nowMs, options?: { seedText?: string; lootSeed?: number })`:**
  - It adds `worldSeed: options.seedText ?? String(seed)` and `worldGen: 2`.
  - `rng` becomes `hash2(options.lootSeed ?? seed, 0x5eed)`. Without options, existing tests get exactly the same `rng` as before.
- **`types.ts`:**
  - `GameState` gains `worldSeed: string` and `worldGen: 1 | 2`.
  - `Settings` gains `motion: MotionSettings`, where `MotionSettings` is `{ floats: boolean; pops: boolean; lampFlicker: boolean; shaft: ShaftMotion }`.
  - `SHAFT_MOTIONS = ['step', 'smooth', 'off'] as const`, and `ShaftMotion` is derived from it.
  - `DEFAULT_MOTION = { floats: true, pops: true, lampFlicker: true, shaft: 'step' }`.
  - `FindRecord` gains an optional `bonus?: true`, which Task 2 sets.
- **`save.ts`:**
  - `SCHEMA_VERSION = 3`.
  - `MIGRATIONS[2]` adds `worldSeed: String(seed)` and `worldGen: 1`, and adds `settings.motion = DEFAULT_MOTION` when `settings` is an object. It leaves its input unchanged unless `seed` is a number and `settings` an object.
  - `validateState` adds:
    - `worldSeed` passes `isValidSeedText`, and `seedFromText(worldSeed) === seed`;
    - `worldGen` is 1 or 2;
    - `settings.motion` has three booleans and a `shaft` in `SHAFT_MOTIONS`;
    - a find's `bonus` is absent or `true`.
- **`GameStore`:**
  - Every brand-new game (no save, or a reset) is `freshWorld(this.deps.newSeed, now())`. The constructor and `load()` with no save use it.
  - `hardReset()` becomes `newWorld(seedText: string | null): boolean`:
    - `null` makes a fresh random world;
    - valid text makes `newGame(seedFromText(text), now(), { seedText: text.trim(), lootSeed: deps.newSeed() })`;
    - invalid text returns `false` and changes nothing.
  - On success it behaves as `hardReset` did: it clears the unreadable save and the loadFailed notice, the summary and the feedback, then calls `changed()` and `save()`.
  - `setMotion(patch: Partial<MotionSettings>)` merges the patch and calls `changed()`.
  - `SaveMenu`'s Reset button calls `newWorld(null)` until Task 6 replaces that UI.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/seed.test.ts
import { expect, it } from 'vitest';
import { ANIMALS, ADJECTIVES, freshWorld, isValidSeedText, randomSeedText, seedFromText } from '../../src/core/seed';
import { newGame } from '../../src/core/newGame';

it('seed text maps to a 32-bit world seed', () => {
  expect(seedFromText('amber-fox-427')).toBe(3_552_404_222);
  expect(seedFromText('golden mole')).toBe(2_552_287_895);
  expect(seedFromText(' Golden Mole ')).toBe(2_552_287_895);
  expect(seedFromText('1234')).toBe(1234);
  expect(seedFromText('007')).toBe(7);
  expect(seedFromText('4294967295')).toBe(4_294_967_295);
  expect(seedFromText('4294967296')).toBe(2_782_066_575);
  expect(seedFromText('Grube 🪨 Stollen')).toBe(seedFromText('grube 🪨 stollen'));
  expect([isValidSeedText(''), isValidSeedText('   '), isValidSeedText('x'.repeat(64)), isValidSeedText('x'.repeat(65))]).toEqual([false, false, true, false]);
});

it('random seeds read as words', () => {
  expect([ADJECTIVES.length, ANIMALS.length]).toEqual([40, 40]);
  expect(randomSeedText(() => 7)).toBe(`${ADJECTIVES[7]}-${ANIMALS[7]}-8`);
  const calls: number[] = [];
  let n = 100;
  const w = freshWorld(() => { calls.push(n); return n++; }, 5);
  expect(calls).toHaveLength(4);
  expect(w.worldSeed).toBe(`${ADJECTIVES[100 % 40]}-${ANIMALS[101 % 40]}-${1 + (102 % 999)}`);
  expect(w.seed).toBe(seedFromText(w.worldSeed));
  expect(w.worldGen).toBe(2);
});

it('the same seed builds the same mine; the loot stream is separate', () => {
  const a = newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed: 1 });
  const b = newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed: 2 });
  expect(a.ahead).toEqual(b.ahead);
  expect(a.rng).not.toBe(b.rng);
  expect(newGame(5, 0).rng).toBe(newGame(5, 0, { lootSeed: 5 }).rng);
  expect(newGame(5, 0).worldSeed).toBe('5');
});
```

```ts
// tests/core/save.test.ts: add
it('migrates a real schema-2 save into world generation 1', () => {
  const r = decodeSave(fixture2.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  expect(r.state).toMatchObject({ seed: 9090, worldSeed: '9090', worldGen: 1, gold: 22_975, deepest: 215 });
  expect(r.state.settings.motion).toEqual({ floats: true, pops: true, lampFlicker: true, shaft: 'step' });
});

it('rejects a seed text that does not match the seed', () => {
  const s = newGame(1, 0);
  expect(decodeSave(raw({ schema: 3, savedAt: 0, state: s })).ok).toBe(true);
  for (const mutate of [
    (x: GameState) => { x.worldSeed = 'golden mole'; },
    (x: GameState) => { x.worldSeed = ''; },
    (x: GameState) => { (x as { worldGen: number }).worldGen = 3; },
    (x: GameState) => { (x.settings.motion as { shaft: string }).shaft = 'wobble'; },
  ]) {
    const bad = newGame(1, 0);
    mutate(bad);
    expect(decodeSave(raw({ schema: 3, savedAt: 0, state: bad }))).toEqual({ ok: false, reason: 'invalid' });
  }
});
```

Import `fixture2` with `import fixture2 from '../fixtures/save-schema-2.txt?raw';`. `GameState` comes from `src/core/types`.

- [ ] **Step 2: Update the store tests.**
  - In `tests/store/gameStore.test.ts`, `'starts a new game when there is no save'` now expects `store.state.worldSeed` to match `/^[a-z]+-[a-z]+-\d{1,3}$/` and `store.state.seed` to equal `seedFromText(store.state.worldSeed)`, instead of `seed === 7`.
  - In `tests/store/lifecycle.test.ts`, the reference game becomes `freshWorld(() => 7, 0)` instead of `newGame(7, 0)`.
  - Add this store test:

```ts
it('a new world from typed text, or refused when empty', () => {
  const { store } = make(); store.load();
  expect(store.newWorld('  Golden Mole ')).toBe(true);
  expect([store.state.worldSeed, store.state.seed]).toEqual(['Golden Mole', 2_552_287_895]);
  expect(store.newWorld('   ')).toBe(false);
  expect(store.state.worldSeed).toBe('Golden Mole');
  expect(store.newWorld(null)).toBe(true);
  expect(store.state.worldSeed).toMatch(/^[a-z]+-[a-z]+-\d{1,3}$/);
});
```

- [ ] **Step 3: Run them and see them fail**: `npx vitest run tests/core/seed.test.ts tests/core/save.test.ts tests/store`.
- [ ] **Step 4: Implement** per the Interfaces block. Every other existing test keeps passing unchanged, because `newGame(seed, now)` without options gives exactly the old state plus the two new fields.
- [ ] **Step 5: Run everything**: `npm test && npm run typecheck`.
- [ ] **Step 6: Commit**: `Add the world seed and save schema 3`.

---

### Task 2: Seed-only metre rolls and bonus finds

**Files:**
- Modify: `src/core/types.ts` (`Stats`), `src/core/stats.ts`, `src/core/metres.ts`, `src/core/dig.ts`, `src/core/balance.ts`
- Test: `tests/core/worldgen.test.ts`

**Interfaces:**
- **`balance.ts`:** `BASE_ROLL_CHANCES` is `{ featureChances: BASE_FEATURE_CHANCES, hardRockChance: BASE_HARD_ROCK_CHANCE }`, typed `Pick<Stats, 'featureChances' | 'hardRockChance'>`.
- **`Stats`** gains `bonusChances: { chest: number; gem: number; map: number }`. In `deriveStats`, each is `BASE_FEATURE_CHANCES[kind] × (pct(find) − 1)`, at least 0. If the base total plus the bonus total exceeds `FEATURE_CHANCE_TOTAL_CAP`, the bonuses are scaled down so the sum equals the cap.
- **`metres.ts`:**
  - `rollMetre(seed, metre, chances: Pick<Stats, 'featureChances' | 'hardRockChance'>)`. The body is unchanged. Passing a whole `Stats` still type-checks.
  - `fillAhead(state, stats)` rolls with `BASE_ROLL_CHANCES` when `state.worldGen === 2`, and with `stats` when it is 1.
- **`dig.ts`:**
  - `faceRoll` follows the same rule as `fillAhead`.
  - **Bonus finds:** after a face metre is collected, if `state.worldGen === 2`, the metre's roll had `feature === null`, and the sum of `stats.bonusChances` is above 0:
    1. Draw `u = nextRandom(state)`.
    2. Walk the cumulative `chest, gem, map` bonus chances. If one hits, `collect` a roll `{ feature: kind, amount: 0, hardRock: false }` at the same metre and tier.
    3. Mark that find `bonus: true`.
  - With no find gear, nothing is drawn, so the loot stream is unchanged.
  - Galleries are unchanged; they already roll from `state.rng` with the gear-scaled chances.

- [ ] **Step 1: Write the failing tests** in `tests/core/worldgen.test.ts`

```ts
import { expect, it } from 'vitest';
import { BASE_ROLL_CHANCES } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { fillAhead, rollMetre } from '../../src/core/metres';
import { newGame } from '../../src/core/newGame';
import { seedFromText } from '../../src/core/seed';
import { deriveStats } from '../../src/core/stats';
import { gear } from '../helpers/items';

const world = (lootSeed: number) => newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed });
const finder = (s: ReturnType<typeof world>) => {
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 900 }, { stat: 'mapFind', value: 300 }] });
};

it('find gear never changes what a metre holds in generation 2', () => {
  const plain = world(1);
  const geared = world(2);
  finder(geared);
  const sp = deriveStats(plain);
  const sg = deriveStats(geared);
  while (plain.deepest < 60) applyTicks(plain, 1, sp);
  while (geared.deepest < 60) applyTicks(geared, 1, sg);
  const seeded = (s: typeof plain) => s.finds.filter((f) => !f.bonus).map((f) => [f.depth, f.kind]);
  expect(seeded(geared)).toEqual(seeded(plain));
  expect(geared.finds.filter((f) => f.bonus).length).toBeGreaterThan(0);
  expect(plain.finds.some((f) => f.bonus)).toBe(false);
  for (const f of geared.finds.filter((x) => x.bonus)) {
    expect(rollMetre(geared.seed, f.depth, BASE_ROLL_CHANCES).feature).toBeNull();
    expect(['chest', 'gem', 'map']).toContain(f.kind);
  }
});

it('generation 1 keeps gear-dependent rolls; generation 2 ignores gear', () => {
  const chestShare = (gen: 1 | 2) => {
    const s = world(1);
    s.worldGen = gen;
    finder(s);
    const stats = deriveStats(s);
    let chests = 0;
    for (let m = 0; m < 500; m++) {
      s.deepest = m; s.depth = m; s.ahead = {};
      fillAhead(s, stats);
      if (s.ahead[m + 1]?.feature === 'chest') chests++;
    }
    return chests / 500;
  };
  expect(chestShare(1)).toBeGreaterThan(0.4);
  expect(chestShare(2)).toBeLessThan(0.1);
});

it('bonus chances come only from find gear and respect the cap', () => {
  const s = world(1);
  expect(deriveStats(s).bonusChances).toEqual({ chest: 0, gem: 0, map: 0 });
  finder(s);
  const b = deriveStats(s).bonusChances;
  expect(b.gem).toBe(0);
  expect(b.chest + b.map + 0.28).toBeCloseTo(0.9);
});
```

`0.28` is the sum of the base chances (0.12 + 0.03 + 0.06 + 0.03 + 0.04). The bonuses wanted are 0.06 × 9 + 0.04 × 3 = 0.66; with the base that is 0.94, which is over 0.9, so the bonuses are scaled down to 0.62.

- [ ] **Step 2: Run it and see it fail**: `npx vitest run tests/core/worldgen.test.ts`.
- [ ] **Step 3: Implement** per the Interfaces block.
- [ ] **Step 4: Run everything**: `npm test && npm run typecheck`. Plans 1–2 tests stay green, because ungeared rolls equal base rolls.
- [ ] **Step 5: Commit**: `Roll metres from the seed alone and add find-gear bonus finds`.

---

### Task 3: Mine looks, generated deep bands and a 3 m lamp

**Files:**
- Create: `src/core/mineLook.ts`, `tests/core/mineLook.test.ts`
- Modify: `src/core/balance.ts` (`BASE_LAMP_SIGHT = 3`)
- Modify tests for the 3 m lamp:
  - `tests/core/metres.test.ts`: base stats `lampSight: 3`; the new game's ahead keys `[1, 2, 3]`;
    in `fillAhead adds missing metres…`, metre 13 is now defined and 14 is not
  - `tests/core/dig.test.ts`: after metre 1, the ahead keys are `[2, 3, 4]`
  - `tests/core/gearStats.test.ts`: the no-gear `lampSight: 3`
  - `tests/core/inventory.test.ts`: the better-lamp keys `[1..6]`
  - `tests/ui/itemView.test.ts`: `lamp sight 3 m`

**Interfaces:**
- **`type WorldRef = { seed: number; gen: 1 | 2 }`.** `worldOf(state)` returns `{ seed: state.seed, gen: state.worldGen }`.
- **`bandTitle(world, band: Band): string`.**
  - Named bands keep their names.
  - Deep bands (`band.start ≥ 1000`) depend on the generation:
    - version 1 keeps `band.name` ("The Abyss I", …);
    - version 2 uses `` `The ${DEEP_ADJECTIVES[a]} ${DEEP_NOUNS[b]}` `` with `a = hash2(seed, 0xdee9 + k) % 16`, `b = hash2(seed, 0xdeea + k) % 16`, and `k` = the deep band index, 1 for the first.
  - `DEEP_ADJECTIVES`: Weeping, Ashen, Hollow, Silent, Gloaming, Sunless, Shattered, Drowned, Whispering, Brimstone, Pale, Starless, Ember, Frozen, Bleeding, Forgotten.
  - `DEEP_NOUNS`: Deep, Seam, Vault, Maw, Reach, Hollows, Chasm, Depths, Warren, Rift, Grotto, Abyss, Underdark, Lode, Cradle, Gulf.
- **`bandLook(world, band): { palette: [string, string, string, string]; details: DetailKind[] }`:**
  - **Named bands** use `NAMED_PALETTES`, which are exactly `bandPalette` from the deleted `sceneTiles.ts`, moved here. The tier 7+ palette is kept for version 1 deep bands. Their details:
    - Topsoil: root, pebble
    - Clay Beds: shard, pebble
    - Limestone: chalk, fossil
    - Granite Veins: quartz
    - Basalt Deep: ember
    - Obsidian Reach: glass
    - version 1 deep bands: crystal
  - **Version 2 deep bands:**
    - Pick a hue `hash2(seed, 0xc010 + k) % 360`, a saturation `14 + hash2(seed, 0xc011 + k) % 14` %, and lightness steps `[13, 11, 15, 12]` %. That gives four `hsl(...)` strings.
    - The details are 2 distinct picks from `crystal, bone, fossil, ember, quartz, glass`, by `hash2(seed, 0xc012 + k)`.
- **`DetailKind`** is one of `root`, `pebble`, `shard`, `chalk`, `fossil`, `quartz`, `ember`, `glass`, `crystal`, `bone`.
- **`wallTile(world, metre, side: 0 | 1, column: 0..3): { shade: string; detail: DetailKind | null; bits: number }`:**
  - `h = hash2(seed ^ (side ? 0x9e37 : 0x7f4a), metre * 8 + column)`.
  - `shade = palette[h % 4]`, from the band at `metre − 1`.
  - `detail` is set when `(h >>> 8) % 100 < WALL_DETAIL_PERCENT`, with `WALL_DETAIL_PERCENT = 6`. It picks `details[(h >>> 16) % details.length]`.
  - `bits = h >>> 24`, used for pixel offsets.
- **The minimap's band colours** use `bandLook(world, band).palette[1]`, and its labels use `bandTitle`. `minimapModel(state, lampSight)` reads the world from `state`.

- [ ] **Step 1: Write the failing tests** in `tests/core/mineLook.test.ts`

```ts
import { expect, it } from 'vitest';
import { bandAt } from '../../src/core/bands';
import { bandLook, bandTitle, wallTile } from '../../src/core/mineLook';

const g2 = (seed: number) => ({ seed, gen: 2 as const });

it('named bands keep their names; deep bands are generated in generation 2 only', () => {
  expect(bandTitle(g2(1), bandAt(10))).toBe('Topsoil');
  expect(bandTitle({ seed: 1, gen: 1 }, bandAt(1000))).toBe('The Abyss I');
  const deep = bandTitle(g2(1), bandAt(1000));
  expect(deep).toMatch(/^The [A-Z][a-z]+ [A-Z][a-z]+$/);
  expect(bandTitle(g2(1), bandAt(1299))).toBe(deep);
  expect(bandTitle(g2(1), bandAt(1300))).not.toBe(undefined);
  const titles = new Set(Array.from({ length: 20 }, (_, i) => bandTitle(g2(i + 1), bandAt(1000))));
  expect(titles.size).toBeGreaterThan(8);
});

it('looks are fixed by the seed', () => {
  expect(bandLook(g2(5), bandAt(10))).toEqual({ palette: ['#5a4030', '#4e3828', '#614634', '#553b2b'], details: ['root', 'pebble'] });
  const deep = bandLook(g2(5), bandAt(2000));
  expect(deep.palette.every((c) => c.startsWith('hsl('))).toBe(true);
  expect(new Set(deep.details).size).toBe(2);
  expect(bandLook(g2(5), bandAt(2000))).toEqual(deep);
  expect(wallTile(g2(5), 40, 0, 2)).toEqual(wallTile(g2(5), 40, 0, 2));
  expect(wallTile(g2(5), 40, 0, 2)).not.toEqual(wallTile(g2(6), 40, 0, 2));
});

it('wall details are rare and belong to their band', () => {
  let tiles = 0;
  let details = 0;
  for (let m = 1; m <= 1000; m++) for (const side of [0, 1] as const) for (let c = 0; c < 4; c++) {
    tiles++;
    const t = wallTile(g2(9), m, side, c);
    if (t.detail) { details++; expect(bandLook(g2(9), bandAt(m - 1)).details).toContain(t.detail); }
  }
  expect(details / tiles).toBeGreaterThan(0.045);
  expect(details / tiles).toBeLessThan(0.075);
});
```

- [ ] **Step 2: Run it and see it fail**: `npx vitest run tests/core/mineLook.test.ts`.
- [ ] **Step 3: Implement.**
  - Write `mineLook.ts` per the Interfaces block.
  - Point the minimap at it.
  - Set `BASE_LAMP_SIGHT = 3`.
  - Update the five tests listed under Files to the 3 m values.
- [ ] **Step 4: Run everything**: `npm test && npm run typecheck`.
- [ ] **Step 5: Commit**: `Generate mine looks and deep bands from the seed, and light 3 m ahead`.

---

### Task 4: The shaft model

**Files:**
- Create: `src/ui/mine/shaftModel.ts`, `tests/ui/shaftModel.test.ts`

**Interfaces:**
- **Constants:** `SHAFT_ROWS = 13`, `MINER_ROW = 4`, `SHAFT_ROW_PX = 56`.
- **`ShaftCell = 'surface' | 'dug' | 'face' | 'lit' | 'dark'`.**
- **`interface ShaftRow { metre: number; cell: ShaftCell; hard: boolean; feature: FeatureKind | null; label: string | null; left: WallTile[]; right: WallTile[]; tunnel: boolean }`.** `WallTile` is the return type of `wallTile`.
- **`shaftModel(state, lampSight): { top: number; rows: ShaftRow[]; gallery: boolean }`:**
  - `top = state.depth − MINER_ROW`. Row `i` shows metre `top + i`.
  - **Metres ≤ 0** are `surface`: no walls, `left`/`right` empty.
  - **Face mode** (`depth === deepest`):
    - `m ≤ deepest` → `dug`;
    - `m === deepest + 1` → `face`;
    - `deepest + 1 < m ≤ deepest + lampSight` → `lit`;
    - beyond that → `dark`.
    - For `face` and `lit` rows, `feature` and `hard` come from `state.ahead[m]`. A metre missing from `ahead` (sight 0) counts as no feature and not hard.
    - The label for `k = m − deepest`, with `1 ≤ k ≤ lampSight`, is `` `+${k} m: ${LABEL[feature]}` ``. `LABEL` is Gold vein, Diamonds, Chest, Gem, Map. Hard rock with no feature is labelled `` `+${k} m: harder rock` ``, and plain rock gets `null`.
  - **Gallery mode** (`depth < deepest`):
    - every metre down to `deepest` is `dug`, `deepest + 1` is `face` with no label, and beyond is `dark`;
    - the miner's row (`metre === depth`) has `tunnel: true`;
    - no labels anywhere.
  - Walls are `wallTile(worldOf(state), m, side, c)` for `c = 0..3`.
- **`shaftShift(prevTop, top, motion: ShaftMotion, progress): { fromPx: number; toPx: number; animate: boolean }`:**
  - **step:** after a change of `n = top − prevTop` metres (any n, including several at once), go from `n × 56` px to `0` with a transition; `animate` is `n !== 0`.
  - **smooth:** `toPx = −progress × 56`. A metre change resets without animation.
  - **off:** `{ fromPx: 0, toPx: 0, animate: false }`.
  - A jump of more than `SHAFT_ROWS` metres, as in a catch-up, never animates.

- [ ] **Step 1: Write the failing tests** in `tests/ui/shaftModel.test.ts`

```ts
import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { MINER_ROW, SHAFT_ROWS, shaftModel, shaftShift } from '../../src/ui/mine/shaftModel';

it('a new game: surface above, the face below the miner, 3 lit metres', () => {
  const s = newGame(1, 0);
  const { top, rows, gallery } = shaftModel(s, 3);
  expect([top, rows.length, gallery]).toEqual([-MINER_ROW, SHAFT_ROWS, false]);
  expect(rows.slice(0, MINER_ROW + 1).every((r) => r.cell === 'surface')).toBe(true);
  expect(rows[MINER_ROW + 1]).toMatchObject({ metre: 1, cell: 'face' });
  expect(rows[MINER_ROW + 2]).toMatchObject({ metre: 2, cell: 'lit', feature: 'map', label: '+2 m: Map' });
  expect(rows[MINER_ROW + 3]).toMatchObject({ metre: 3, cell: 'lit' });
  expect(rows[MINER_ROW + 4]).toMatchObject({ metre: 4, cell: 'dark', label: null });
  expect(rows[MINER_ROW + 1]?.left).toHaveLength(4);
});

it('deeper down, and in a side gallery', () => {
  const s = newGame(1, 0);
  s.depth = 40; s.deepest = 40;
  s.ahead = { 41: { feature: null, amount: 0, hardRock: true }, 42: { feature: 'chest', amount: 0, hardRock: false }, 43: { feature: null, amount: 0, hardRock: false } };
  const face = shaftModel(s, 3);
  expect(face.rows.map((r) => r.label).filter(Boolean)).toEqual(['+1 m: harder rock', '+2 m: Chest']);
  s.depth = 30;
  const g = shaftModel(s, 3);
  expect(g.gallery).toBe(true);
  expect(g.rows.find((r) => r.metre === 30)?.tunnel).toBe(true);
  expect(g.rows.every((r) => r.label === null)).toBe(true);
  expect(g.rows.find((r) => r.metre === 38)?.cell).toBe('dug');
});

it('the shaft moves once per change, however many metres', () => {
  expect(shaftShift(10, 11, 'step', 0)).toEqual({ fromPx: 56, toPx: 0, animate: true });
  expect(shaftShift(10, 13, 'step', 0)).toEqual({ fromPx: 168, toPx: 0, animate: true });
  expect(shaftShift(10, 400, 'step', 0)).toEqual({ fromPx: 0, toPx: 0, animate: false });
  expect(shaftShift(10, 10, 'smooth', 0.5)).toEqual({ fromPx: -28, toPx: -28, animate: false });
  expect(shaftShift(10, 11, 'off', 0.5)).toEqual({ fromPx: 0, toPx: 0, animate: false });
});
```

- [ ] **Step 2: Run it and see it fail**: `npx vitest run tests/ui/shaftModel.test.ts`.
- [ ] **Step 3: Implement** `shaftModel.ts`.
- [ ] **Step 4: Run everything**: `npm test && npm run typecheck`.
- [ ] **Step 5: Commit**: `Model the digging shaft`.

---

### Task 5: The shaft scene

**Files:**
- Create: `src/ui/mine/ShaftScene.tsx`, `src/ui/mine/shaft.css`
- Modify: `src/ui/mine/MineView.tsx`, `src/ui/mine/particles.ts` (origin helper), `src/ui/theme.css` (`gmFlicker` keyframes)
- Delete: `src/ui/mine/MineScene.tsx`, `src/ui/mine/sceneTiles.ts`, `tests/ui/sceneTiles.test.ts`

**Interfaces:**
- **`ShaftScene({ store })` replaces `MineScene` in `MineView`.** It is one `<button aria-label="Dig: click the rock">`, 728 px tall (13 × 56), with:
  - **the strip:** each row from `shaftModel` is 4 wall tiles, then the 88 px shaft cell, then 4 wall tiles. The strip is 536 px wide and centred; on narrow screens the outer wall columns are clipped.
  - **wall tiles:** 56 px, background `shade`, an inset bottom-right shadow. A tile with a `detail` draws a small pixel motif in CSS, offset by `bits`. My call for the motifs:
    - root and bone: dark lines;
    - pebble: two grey dots;
    - shard, chalk and quartz: light flecks;
    - ember: an orange glow dot;
    - glass and crystal: cyan flecks;
    - fossil: a pale spiral.
  - **shaft cells:**
    - `dug`: dark, with a rope above the miner;
    - `face`: rock in the band shade, with diagonal crack stripes growing with `state.progress`;
    - `lit`: rock with a glowing feature icon (the find's sprite at scale 2, 55 % opacity), or darker cracks for `hard`;
    - `dark`: near-black;
    - `surface`: sky `#1b2430` over a grass line `#3f5a2c` on the metre-0 row;
    - the `tunnel` row: the first 3 right-wall tiles render as dug.
  - **the miner sprite** (scale 3) stands in the shaft cell on `MINER_ROW` (or in the tunnel), with the lamp glow around it. `lampFlicker` animates the glow opacity with `gmFlicker` (0.9 → 1 → 0.85, 2.4 s).
  - **lamp labels** sit to the right of the shaft, beside their rows.
  - **fog:** a vertical gradient darkens below the lit rows.
  - **the hint** "Click the rock to dig" stays bottom-right.
- **Movement:**
  - Keep the previous `top` in a ref. On each render, apply `shaftShift(prevTop, top, motion.shaft, progress)` to the strip: set `transform: translateY(fromPx)` without a transition, then on the next frame `translateY(toPx)` with `transition: transform 0.2s ease-out` (step) or `0.25s linear` (smooth).
  - `motion` is the effective motion from Task 6's `effectiveMotion`. Until Task 6 lands, use `state.settings.motion` directly.
- **Particles** work as now:
  - clicks float at the pointer, or at the face for a keyboard click;
  - drained auto feedback floats at the face, which is the shaft cell's centre on row `MINER_ROW + 1`.
  - `floats: false` suppresses Gold and Diamond particles, and `pops: false` suppresses find pop-ups.
- **MineView:** the progress bar and rate line stay under the scene, and the minimap stays beside it.

- [ ] **Step 1: Implement** `ShaftScene.tsx` and `shaft.css`. Wire it into `MineView` and delete the old scene files.
- [ ] **Step 2: Verify**: `npm test && npm run typecheck && npm run build`. Then run the app (the dev server on :5180 is already running from this repo) and check, on desktop and at 390 px:
  - the shaft steps up one row per metre;
  - finds glow 1–3 m below with labels;
  - side galleries show the tunnel;
  - several metres in one tick, after a long background tab, move once;
  - there is no horizontal scroll at 390 px.

  A headless Chrome screenshot is enough if no browser is at hand.
- [ ] **Step 3: Commit**: `Replace the mine scene with a stepping shaft`.

---

### Task 6: Fonts and the Settings dialog

**Files:**
- Create in `src/ui/settings/`: `motion.ts`, `SettingsDialog.tsx`, `NewWorld.tsx`, `settings.css`
- Create: `src/ui/links.ts`, `tests/ui/motion.test.ts`
- Move: `src/ui/SaveMenu.tsx` → `src/ui/settings/SaveDialog.tsx` (Export and Import only; Reset moves to New world)
- Modify: `index.html`, `src/ui/theme.css`, `src/ui/Header.tsx`, `src/ui/App.tsx`, `src/ui/character/CharacterPanel.tsx` (the Loot filter button also opens from Settings), `src/ui/character/ItemCard.tsx` (display font for item names), `README.md`

**Interfaces:**
- **`motion.ts` (pure):**
  - `effectiveMotion(m: MotionSettings, reduced: boolean): MotionSettings` returns `{ floats: false, pops: false, lampFlicker: false, shaft: 'off' }` when `reduced` is true, else `m`.
  - `usePrefersReducedMotion()` is a small hook over `matchMedia('(prefers-reduced-motion: reduce)')` that listens for changes.
  - The mine scene, the particles and the lamp all read `effectiveMotion(state.settings.motion, reduced)`.
- **Fonts:**
  - `index.html` loads `Metamorphous`, `Alegreya Sans:wght@400;500;700` and `IBM Plex Mono:wght@500`, and drops Cinzel and IBM Plex Sans.
  - In `theme.css`: `--gm-font-display: 'Metamorphous', serif` and `--gm-font-ui: 'Alegreya Sans', system-ui, sans-serif`.
  - The display font is used for the title, headings, dialog titles, and the item name in `ItemCard`.
- **Header:** the `Save` button becomes `Settings` and opens `SettingsDialog`.
- **SettingsDialog** (`gm-overlay` / `gm-dialog`, title "Settings", following the Settings board):
  - **Motion:** three `role="switch"` buttons (`aria-checked`), each ≥ 44 px, that call `store.setMotion`.
    - "Floating numbers": "+Gold, +Diamonds and damage numbers rise and fade"
    - "Find pop-ups": "\"Chest!\", \"Map!\" bursts at the dig face"
    - "Lamp flicker": "The lamp light gently flickers"
    - A "Mine shaft" group of Step / Smooth / Off.
    - When `reduced` is true, the note "Your system asks for reduced motion, so these are off." appears, and the controls are disabled.
  - **World:** `worldSeed` in the mono font, a "Copy seed" button (`copyText`), and the line "Share it: the same seed builds the same mine for everyone. Loot is still your own luck."
  - **Game:**
    - "Loot filter…", which opens the existing `LootFilterDialog`;
    - "Export / import save…", which opens `SaveDialog`;
    - "Start a new world…", which opens `NewWorld`.
  - **Donate:** the link `Support the game (donate)` is rendered only when `DONATE_URL` (from `links.ts`, initially `''`) is non-empty.
- **NewWorld:** a dialog with two radios, "Random world" and "Use this seed", plus a text field with a 64-character `maxlength`.
  - Confirming asks "Really erase this game? Yes / No".
  - Yes runs `runAsOwner(() => store.newWorld(choice))`.
  - Invalid text shows "Type a seed, or pick a random world." and never reaches Yes.

- [ ] **Step 1: Write the failing test** in `tests/ui/motion.test.ts`

```ts
import { expect, it } from 'vitest';
import { DEFAULT_MOTION } from '../../src/core/types';
import { effectiveMotion } from '../../src/ui/settings/motion';

it('reduced motion turns everything off, otherwise settings rule', () => {
  expect(effectiveMotion(DEFAULT_MOTION, true)).toEqual({ floats: false, pops: false, lampFlicker: false, shaft: 'off' });
  const mine = { floats: false, pops: true, lampFlicker: false, shaft: 'smooth' as const };
  expect(effectiveMotion(mine, false)).toEqual(mine);
});
```

- [ ] **Step 2: Run it and see it fail**: `npx vitest run tests/ui/motion.test.ts`.
- [ ] **Step 3: Implement** the fonts, the Settings, SaveDialog and NewWorld dialogs, the reduced-motion hook, and the Header and App wiring.
  - Make `ShaftScene` and the particles read `effectiveMotion`.
  - In the README, the Saves section now says Settings, and a new "Worlds" paragraph explains seeds.
- [ ] **Step 4: Verify**: `npm test && npm run typecheck && npm run build`.
- [ ] **Step 5: Commit**: `Switch to Diablo-style fonts and add the Settings dialog`.

---

### Task 7: Final check

**Files:** none new, unless the check finds something.

- [ ] **Step 1: Smoke check** with the app on desktop and at 390 px:
  - **New player:**
    - the fonts are Metamorphous and Alegreya Sans;
    - Settings shows a word seed;
    - Copy works.
  - **Same seed:**
    1. Start a new world with the seed `golden mole` and dig 20 m. Note the finds.
    2. Export.
    3. Start a new world with `golden mole` again and dig 20 m.

    Expected: the same metres hold the same features. Chest contents may differ.
  - **Shaft:** it steps per metre, the lamp shows 3 m with labels, and the minimap matches.
  - **Gallery:** climb back via the minimap; the tunnel is shown.
  - **Motion:**
    - Settings → Motion off: no floats, pops, slide or flicker, while the feed and header still update.
    - With the system's reduced motion on, the same, plus the note.
  - **Old save:** import a Plan 2 export (`tests/fixtures/save-schema-2.txt`).
    - It loads as world `9090`, generation 1, and the shaft renders.
    - Its finds still come from its stored rolls.
    - Its deep band names would stay "The Abyss…"; no need to dig there.
  - **Plans 1–2 checks** still pass: items, stash, loot filter, export and import.
- [ ] **Step 2: Fix anything found**, then run `npm test && npm run typecheck && npm run build`.
- [ ] **Step 3: Commit** (only if changes were needed): `Fix issues found in the seeds and mine check`.
