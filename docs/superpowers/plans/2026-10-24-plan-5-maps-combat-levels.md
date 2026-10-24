# Golden Miner — Plan 5: Maps, Combat and Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn dungeon entrances into maps the miner can run, through dungeons generated from the world seed:
- **Combat:** fighting is automatic, and every click is an extra hit.
- **Rewards:** maps are the only source of XP and Souls.
- **Levels:** XP raises one level, capped at 60.
- **Gear:** battle gear finally counts.
- **Digging:** it pauses while a map runs, offline too.
- **Generation:** each world generates its own dungeon types, monster looks, champion and boss names from the seed. Difficulty and rewards per tier stay the same in every world.

**Architecture:**
- **Activity.** `GameState.activity` is `{ kind: 'dig' }` or `{ kind: 'map', run }`, and `applyTicks` sends each tick to digging or to `mapTick`. A map tick advances combat by `1 / autoTicksPerSecond` seconds, so pumped play, one long catch-up and offline play all give the same result.
- **World generation.** A pure function of `(seed, position)` builds the dungeons, as Plan 3 did for the mine:
  - fixed species lists;
  - 3 dungeon types per band;
  - a layout per map entrance metre;
  - names and monster looks.

  Combat, loot and every damage roll draw from `state.rng`.
- **Saves and UI.** Maps live in the stash's Maps tab (Plan 4's placeholder), and the save moves to schema 5. Monsters and dungeon floors are drawn by code from a part kit and palettes, not from the swappable atlas (round-2 §4.4).

**Tech Stack:** unchanged: Node 24, TypeScript 7, Vite 8, React 19, Vitest 5 (node environment), lz-string. No new dependencies.

**Spec:**
- `docs/superpowers/specs/2026-10-23-golden-miner-revival-design.md`:
  - §4.4 maps and combat, except map infusion (Plan 7) and auto-mapping (Plan 8);
  - §4.5, the level only (the passive web is Plan 6);
  - §4.2, clicks as extra hits;
  - §4.7, Souls as a resource;
  - §5: the header, tabs and the map run.
- **Amended by** `docs/superpowers/specs/2026-10-24-round-2-seeds-procedural-inventory-design.md`:
  - §3.3, which says what the seed decides;
  - §4.1 monsters;
  - §4.2 dungeons;
  - §4.4 art;
  - §7.3, the Maps stash tab.

The combat model and tuning come from the shelved draft `.superpowers/drafts/maps-combat-levels-draft.md`, re-checked by simulation for this plan (see Decisions). The run screen's look comes from mockup board 2, `.superpowers/mockups/project/MapRun.dc.html`, published at https://claude.ai/artifact/WntzjRci7LNrLL9hWjyAKR.

**Builds on:** `dev-ernest` after Plan 4 (PR #4). The save schema is 4. `tests/fixtures/save-schema-4.txt` is a real Plan 4 export, committed with this plan. It is the schema-3 fixture after an offline catch-up, and it holds 21 map finds.

**Roadmap:** this is plan 5 of 9.
1. Foundation
2. Items
3. Seeds and the mine
4. Inventory, round 2
5. **Maps, combat and levels** (this plan)
6. Passive web
7. Merchant and crafting
8. Auto-mapping and ascension
9. Balance and launch

## Global Constraints

- **Stack and build:**
  - Static site: TypeScript + Vite + React, with no backend and no new npm dependencies. Node 24.
  - `tsconfig` is unchanged. Tests read fixtures only through `?raw` imports.
- **Purity:**
  - Nothing under `src/core/` may import React, touch `window`/`document`/`localStorage`, or call `Date.now()` / `Math.random()`.
  - **World generation is a pure function of `(seed, position)`** (round-2 §3.3). It covers dungeon types, layouts, species looks, champion and boss names, and floors. It never reads or advances `state.rng`, and never reads gear, stats or level.
  - Combat rolls, rewards and loot use `state.rng`.
- **Balance-neutral seeds (round-2 §4.2):** the seed decides shape, names, looks and species mix, never difficulty or reward per tier. Every map has a budget of 15 monster units. A champion costs 3 units. There is 1 champion per map, or 2 from tier 8.
- **Readable numbers:**
  - Every number shown goes through `formatNumber`, `formatRate` or `formatCompact`.
  - Life, damage, XP, Souls and Gold are integers.
  - Growth is polynomial in tier and level, never exponential.
- **No login pressure:** a run left going continues offline and ends on its own. Nothing expires.
- **Saves:**
  - `SCHEMA_VERSION = 5`. Schemas 1–4 migrate.
  - The fixtures in `tests/fixtures/` are real exports. Never regenerate them.
  - An impossible run or map decodes as `invalid`, never a crash.
- **Phones:** the layout works at 390 px, and every button and click target is ≥ 44 px.
- **Look:**
  - Fonts and tokens as Plans 3–4, plus these colours: Soul `#b39cff`; enemy life `#e2604f`; player life `#6fcf97`; map badge `#2c2440` on `#d6c9ff`; room done `#1f3326` / `#a6e8bf`; room now `#3a1c18` / `#ffb4a8`, with border `#e2604f`.
  - A crit number is orange `#ff9b45` and larger.
- **Motion:** floating damage numbers honour `settings.motion.floats`. Under reduced motion they don't animate.
- **Where things live:**
  - Tunable numbers: `src/core/balance.ts`.
  - Species lists: `src/core/species.ts`.
  - Word and syllable lists: `src/core/names.ts`.
  - Part templates: `src/core/monsterParts.ts`.
- No `!` non-null assertions in `src/`.
- **Git:** work on `dev-ernest` and stage explicit file paths. Commit messages are short imperative sentences with no Claude/Anthropic attribution of any kind. Never push.

## Review Focus

1. **Closing the tab in the middle of a map, or a long absence during a run.**
   - The run keeps fighting offline at real-time speed and ends (cleared or died).
   - Digging resumes for the rest of the gap, and the offline summary reports the run.
   - Pumped play and one long catch-up give the same state.
   - Tests: Task 4 (core) and Task 6 (store lifecycle).
2. **Old saves (schemas 1, 2 and 4, from real fixtures).**
   - Every past map find becomes a map in the Maps tab, with its tier and metre.
   - Nothing else changes.
   - Tests: Task 1.
3. **Two players on the same seed.**
   - The same map entrance metre gives the same dungeon type, name, room count, monsters, champions (names and modifiers) and boss, whatever their gear, level or loot stream.
   - Their combat rolls and drops differ.
   - Tests: Task 2.
4. **A hand-edited or broken run in a save.** Expected result: `invalid`, never a crash. Examples:
   - a negative life or an empty room;
   - a boss outside the boss room;
   - an unknown modifier;
   - a level-61 miner;
   - 201 maps.

   Tests: Task 1.
5. **Bags full during a map under "stop digging".**
   - The fight goes on and drops are held.
   - After the run, digging stays paused until there is room.
   - Nothing is sold that the rules don't say to sell.
   - Tests: Task 5.

## Decisions this plan makes (my calls; overrule them in review)

**Combat (from the shelved draft, re-simulated with generated dungeons)**
- Combat runs in real time. A tick advances the fight by `1 / autoTicksPerSecond` s, so mining-speed gear never speeds up combat.
- The miner attacks at its attack speed (1 hit/s base), and a click adds one hit. Monsters attack on their own timers (1.8–3.2 s).
- Only one monster fights at a time. Clearing a room heals 30 % of max life. Potions come with the merchant (Plan 7).
- **Player base:**
  - life 50 + 10·level;
  - damage (2 + level)–(4 + 2·level);
  - 5 % crits at ×1.5.
  - Armor softens physical hits: `armor / (armor + 10·hit)`, at most 90 %. All-resistance softens elemental hits, at most 75 %.
- **Monsters:**
  - life `15·tier^1.3 × species mult`;
  - damage `(2 + 1.5·tier^1.2) × species mult`;
  - XP `round(10·tier^1.5)`.
  - A champion has ×2.5 life, ×1.5 damage and ×3 rewards.
  - A boss has ×5 life, ×1.5 damage and ×5 rewards.
- **Simulated with the generated layouts and random champion modifiers** (2,000 runs each):

  | Naked level-1 miner | Result |
  |---|---|
  | Tier 1, auto hits only | clears 100 % |
  | Tier 2, auto hits only | dies 100 % |
  | Tier 2, 3 clicks a second | clears 100 % |
  | Tier 4 | dies in room 1, 100 % |
- **XP and rewards:**
  - XP to the next level is `round(100·level^1.5)`.
  - **Per kill:** Souls `0.25·tier`, raised by Soul find; Gold `2·tier`; a 15 % chance of an item (80 % battle gear), with magic find raising rarity; a 4 % chance of a gem, which goes to the battle bag.
  - **Champions:** ×3 the rewards, plus one guaranteed item rolled with magic find ×3.
  - **Bosses:** ×5 the rewards, and 2 guaranteed items.
- Dying or leaving loses the map but keeps everything gained. A run started from the Maps screen switches the character panel to the Battle set, and back to Mining afterwards.

**Generated dungeons (round-2 §4.1–4.2)**
- **Species:** each named band has 4 fixed species, and deep bands cycle 4 fixed lists of 4, by deep band index. A species has fixed combat traits (element, interval, life and damage multipliers) and a fixed body kind. The seed gives each species its look once per world.
- **Dungeon types:** 3 per band and world. Each has:
  - a generated name;
  - a floor (3 shades and one of 4 tile patterns);
  - an element bias, which only orders which species are picked;
  - 2–3 of the band's species;
  - 4–7 rooms before the boss room;
  - a boss species with a generated name and title.
- **A map's dungeon:** a map found at metre `m` leads to type `hash(seed, m) mod 3` of its tier. Its whole layout comes from `(seed, m)`. Several maps from the same metre (a side gallery found more than once) are the same dungeon.
- **Layout:**
  - The 15 units are spread over the rooms as evenly as possible.
  - Champions take 3 units each and are placed first, in rooms picked by the seed.
  - Each room's champion fights last.
  - A 4-room dungeon packs 3–4 units per room; a 7-room one 2–3, or 1–3 when two champions are present.
- **Boss names belong to the dungeon type** (round-2 §4.2), not to the individual map. §4.1 says "per map entrance"; §4.2 is the more specific rule, and it lets the room track name the boss before you get there.
- **Champion modifiers:** 1–2 of these:

  | Modifier | Effect |
  |---|---|
  | Armored | the miner's hits on it ×0.6 |
  | Swift | attacks 40 % faster |
  | Vampiric | heals 20 % of the damage it deals |
  | Fire-touched | its hits are elemental |
  | Brutal | +50 % damage |
  | Thick-skinned | +80 % life |
- **Names:** from curated syllable and word lists only, such as "Gorvash the Hollow", "Thulmar, Warden of the Weeping Hollows", "The Weeping Hollows" and "Gloomvein Pits".
- **World generation versions:** generated dungeons apply to every world, both generation 1 and 2, because no dungeons existed before. Future changes to them add a version, as for the mine.

**Maps and the stash**
- **Map items:** `{ id, type: 'map', tier, metre }`. The name and layout come from world generation, so they are never stored.
- **The Maps tab:** it holds 200 maps. When it is full, the lowest-tier, oldest map is dropped.
- **Display:** the Maps screen and the stash's Maps tab show the same list, grouped by dungeon and tier.
- **Old saves:** they get one map per past map find (the newest 200), at `metreTier(depth)`.

**Monster art (round-2 §4.4)**
- **Canvas:** a 24 × 24 pixel creature composed from a part kit: 5 bodies (blob, quadruped, biped, serpent, winged), plus heads, eyes, mouths, horns or antennae, legs, wings and tails. Each part has anchor points.
- **Palettes:** a body hue, a highlight, a shade, an accent and eyes, from curated ranges that read well on dark floors.
- **Champions:** one extra part and a coloured aura outline.
- **Bosses:** 2–3 extra parts, drawn at a larger scale.
- **Owner check:** the part kit is checked by Ernest from a gallery screenshot before the run screen is built (Task 7).

**Out of scope:**
- **Plan 6:** spending passive points. The count is `level − 1` until then.
- **Plan 7:** map infusion, potions and Soul spending.
- **Plan 8:** auto-mapping.
- **Plan 9:** balance, and the deferred minors of Plans 2–4.

---

## File structure

```
src/core/
  maps.ts         NEW  addMap, startMap, leaveMap
  species.ts      NEW  Species, BodyKind, NAMED_SPECIES, DEEP_SPECIES, speciesOf
  names.ts        NEW  word/syllable lists, creatureName, championName, bossName, dungeonName
  dungeons.ts     NEW  DungeonType, dungeonType, dungeonIndexAt, LayoutMonster, dungeonLayout
  battle.ts       NEW  BattleStats, deriveBattleStats, mitigate
  levels.ts       NEW  xpToNext, gainXp
  monsters.ts     NEW  monsterState (layout slot → MonsterState with stats and modifiers)
  combat.ts       NEW  mapTick, clickHit, soulsForKill, rewards
  monsterParts.ts NEW  the part kit (templates + anchors)
  monsterLook.ts  NEW  speciesLook, monsterLook (grid + palette + aura)
  rng.ts          MOD  hashN
  types.ts, balance.ts, newGame.ts, save.ts, dig.ts, itemGen.ts, summary.ts, cells.ts   MOD
src/store/gameStore.ts   MOD  battle getter, startMap/leaveMap/dismissRun, click routing, feedback
src/ui/
  PixelArt.tsx NEW (canvas sprite from a grid + palette), Nav.tsx NEW, Header.tsx, App.tsx, app.css, theme.css,
  OfflineSummary.tsx, mine/MineView.tsx, character/CharacterPanel.tsx, character/StashDialog.tsx   MOD
  maps/mapsView.ts, maps/MapList.tsx, maps/MapsView.tsx, maps/maps.css                         NEW
  run/runView.ts, run/RunView.tsx, run/FightScene.tsx, run/RoomTrack.tsx, run/CombatLog.tsx,
  run/RunResultDialog.tsx, run/run.css                                                          NEW
tests/fixtures/save-schema-4.txt   NEW (committed with this plan)
```

---

### Task 1: Maps in the stash, and save schema 5

**Files:**
- Create: `src/core/maps.ts` (only `addMap` here), `tests/core/maps.test.ts`
- Modify:
  - `src/core/types.ts`, `src/core/balance.ts`, `src/core/newGame.ts`, `src/core/cells.ts` (`emptyInventory`), `src/core/save.ts`;
  - `src/core/dig.ts`: every map find becomes a map, whether from the face, a bonus or a gallery;
  - `src/core/levels.ts` (create it with `xpToNext` only; Task 3 completes it);
  - `tests/core/save.test.ts`.

**Interfaces:**
- **`types.ts`:**

```ts
export const ELEMENTS = ['physical', 'elemental'] as const;            export type Element = (typeof ELEMENTS)[number];
export const RANKS = ['normal', 'champion', 'boss'] as const;          export type Rank = (typeof RANKS)[number];
export const CHAMPION_MODS = ['armored', 'swift', 'vampiric', 'fireTouched', 'brutal', 'thickSkinned'] as const;
export type ChampionMod = (typeof CHAMPION_MODS)[number];
export const RUN_OUTCOMES = ['cleared', 'died', 'left'] as const;      export type RunOutcome = (typeof RUN_OUTCOMES)[number];
export interface MapItem { id: number; type: 'map'; tier: number; metre: number }
export interface MonsterState {
  name: string; species: number; rank: Rank; mods: ChampionMod[]; extra: number;   // extra: the look seed for champion/boss parts
  element: Element; life: number; maxLife: number; damage: number; intervalS: number; xp: number;
}
export type CombatLine =
  | { kind: 'hit'; monster: string; amount: number; crit: boolean; click: boolean }
  | { kind: 'hurt'; monster: string; amount: number }
  | { kind: 'heal'; monster: string; amount: number }
  | { kind: 'kill'; monster: string; xp: number; souls: number }
  | { kind: 'room'; room: number }
  | { kind: 'level'; level: number }
  | { kind: 'drop'; note: LootNote };
export interface RunGains { xp: number; souls: number; gold: number; levels: number }
export interface MapRun {
  map: MapItem; room: number; bossRoom: number;   // rooms 1..bossRoom; bossRoom = regular rooms + 1 (5..8)
  queue: MonsterState[];                           // monsters left in this room, the fighting one first; never empty
  life: number; hitCarry: number; monsterCarry: number;
  gained: RunGains; log: CombatLine[]; loot: LootNote[];
}
export interface RunResult { map: MapItem; outcome: RunOutcome; room: number; bossRoom: number; gained: RunGains; items: number; seen: boolean }
export type Activity = { kind: 'dig' } | { kind: 'map'; run: MapRun };
// GameState gains: level: number; xp: number; souls: number; activity: Activity;
//                  lastRun: RunResult | null; mapTally: { cleared: number; lost: number }
// GameState.stash gains: maps: MapItem[]
```

- **`balance.ts`:**
  - Limits: `LEVEL_CAP = 60`, `MAP_STASH_SIZE = 200`, `COMBAT_LOG_LIMIT = 20`, `RUN_LOOT_LIMIT = 30`, `MAX_LIFE = 1_000_000`, `MAX_DAMAGE = 1_000_000`.
  - Layout: `MONSTER_BUDGET = 15`, `CHAMPION_UNITS = 3`, `MIN_ROOMS = 4`, `MAX_ROOMS = 7`.
- **`newGame` and `emptyInventory`:**
  - `newGame` adds `level: 1`, `xp: 0`, `souls: 0`, `activity: { kind: 'dig' }`, `lastRun: null` and `mapTally: { cleared: 0, lost: 0 }`.
  - `emptyInventory().stash.maps = []`.
- **`maps.ts` `addMap(state, tier, metre): MapItem`:**
  - The new map is `{ id: state.nextId++, type: 'map', tier, metre }`, pushed onto `stash.maps`.
  - When the tab already holds `MAP_STASH_SIZE`, first remove the lowest-tier map, the oldest (first in list order) among ties.
  - When the new map's tier is strictly the lowest, the tab is unchanged and the map is returned unkept.
- **`dig.ts` `collect`:** a `map` find calls `addMap(state, tier, depth)` after the find takes its id. This covers face, bonus and gallery finds.
- **`levels.ts`:** `xpToNext(level) = round(100·level^1.5)`, and 0 at `LEVEL_CAP`.
- **`save.ts`:**
  - `SCHEMA_VERSION = 5`.
  - **`MIGRATIONS[4]`:**
    - It leaves anything that isn't an object with a `finds` array and an object `stash` unchanged.
    - Otherwise it adds the `newGame` fields above.
    - `stash.maps` gets one map per `finds` entry of kind `map`, in order, keeping the newest `MAP_STASH_SIZE`. Each is `{ id: nextId++, type: 'map', tier: metreTier(depth), metre: depth }`, and `nextId` is updated.
  - **`validateState` adds:**
    - `level` is an integer in `1..LEVEL_CAP`.
    - `xp` is an integer `≥ 0` and `< xpToNext(level)` below the cap, and `0` at the cap.
    - `souls` is a non-negative integer.
    - `stash.maps` holds at most `MAP_STASH_SIZE` maps. Each has an id in the shared unique-id set, a `tier` that is an integer in `1..100_000`, and a `metre` that is an integer `≥ 1`.
    - `activity` is `{ kind: 'dig' }` or `{ kind: 'map', run }`, where:
      - `run.map` is a valid map, with its id in the set;
      - `bossRoom` is an integer in `MIN_ROOMS + 1..MAX_ROOMS + 1`, and `room` is an integer in `1..bossRoom`;
      - `queue` holds `1..MONSTER_BUDGET` monsters, and `queue[0].rank === 'boss'` exactly when `room === bossRoom`;
      - each monster has a name of 1–80 characters, a non-negative integer `species`, a rank in `RANKS`, `mods` from `CHAMPION_MODS` with no repeats and at most 2 (non-empty only for a champion), a uint32 `extra`, and an element in `ELEMENTS`;
      - each monster's numbers are integers with `1 ≤ life ≤ maxLife ≤ MAX_LIFE`, `0 ≤ damage ≤ MAX_DAMAGE` and `xp ≥ 0`, and `0 < intervalS ≤ 60`;
      - `life` is an integer in `1..MAX_LIFE`;
      - the carries are in `[0, 1)`;
      - `gained` holds non-negative integers;
      - `log` holds at most `COMBAT_LOG_LIMIT` valid lines (`drop` lines carry a valid loot note);
      - `loot` holds at most `RUN_LOOT_LIMIT` notes.
    - `lastRun` is `null` or a RunResult. It must have a valid map (id in the set), an outcome in `RUN_OUTCOMES`, `room` and `bossRoom` as above, valid gains, a non-negative integer `items`, and a boolean `seen`.
    - `mapTally` holds two non-negative integers.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/save.test.ts: add (import fixture4 from '../fixtures/save-schema-4.txt?raw')
it('migrates a real schema-4 save: past map finds become maps', () => {
  const r = decodeSave(fixture4.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s).toMatchObject({ worldSeed: '9090', gold: 94_523, diamonds: 1_375, deepest: 215, tickCount: 47_235, level: 1, xp: 0, souls: 0, lastRun: null, nextId: 309 });
  expect(s.activity).toEqual({ kind: 'dig' });
  expect(s.stash.maps.map((m) => m.id)).toEqual(Array.from({ length: 21 }, (_, i) => 288 + i));
  expect(s.stash.maps.map((m) => [m.tier, m.metre]).slice(0, 8)).toEqual([[1, 2], [1, 3], [1, 4], [1, 36], [1, 47], [2, 66], [2, 79], [3, 214]]);
  expect(s.stash.maps.slice(7).every((m) => m.tier === 3 && m.metre === 214)).toBe(true);
});

it('older fixtures gain their maps too', () => {
  const r1 = decodeSave(fixture.trim());
  const r2 = decodeSave(fixture2.trim());
  if (!r1.ok || !r2.ok) throw new Error('fixture rejected');
  expect(r1.state.stash.maps.map((m) => m.id)).toEqual([31, 32, 33, 34, 35]);
  expect(r1.state.nextId).toBe(36);
  expect(r2.state.stash.maps.map((m) => [m.id, m.tier, m.metre])).toEqual([[79, 1, 2], [80, 1, 3], [81, 1, 4], [82, 1, 36], [83, 1, 47], [84, 2, 66], [85, 2, 79]]);
});

it('rejects impossible maps, runs and levels', () => {
  const running = (): GameState => {
    const s = newGame(1, 0);
    const map = addMap(s, 2, 60);
    s.stash.maps = [];
    s.activity = { kind: 'map', run: {
      map, room: 1, bossRoom: 6, life: 40, hitCarry: 0, monsterCarry: 0, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [],
      queue: [{ name: 'Mud Slime', species: 1, rank: 'normal', mods: [], extra: 7, element: 'elemental', life: 30, maxLife: 37, damage: 4, intervalS: 2, xp: 28 }],
    } };
    return s;
  };
  expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: running() })).ok).toBe(true);
  const run = (s: GameState) => (s.activity.kind === 'map' ? s.activity.run : null);
  const first = (s: GameState) => run(s)?.queue[0];
  const cases: [string, (s: GameState) => void][] = [
    ['level 61', (s) => { s.level = 61; }],
    ['xp past the next level', (s) => { s.xp = 100; }],
    ['negative souls', (s) => { s.souls = -1; }],
    ['an empty room', (s) => { run(s)?.queue.splice(0); }],
    ['a boss in room 1', (s) => { const m = first(s); if (m) m.rank = 'boss'; }],
    ['a normal in the boss room', (s) => { const r = run(s); if (r) r.room = 6; }],
    ['zero life', (s) => { const r = run(s); if (r) r.life = 0; }],
    ['monster life above max', (s) => { const m = first(s); if (m) m.life = 99; }],
    ['an unknown modifier', (s) => { const m = first(s); if (m) { m.rank = 'champion'; m.mods = ['cursed' as ChampionMod]; } }],
    ['modifiers on a normal', (s) => { const m = first(s); if (m) m.mods = ['brutal']; }],
    ['three modifiers', (s) => { const m = first(s); if (m) { m.rank = 'champion'; m.mods = ['brutal', 'swift', 'armored']; } }],
    ['boss room 9', (s) => { const r = run(s); if (r) r.bossRoom = 9; }],
    ['a whole hit carried', (s) => { const r = run(s); if (r) r.hitCarry = 1; }],
    ['a map id reused in the stash', (s) => { const r = run(s); if (r) s.stash.maps.push({ ...r.map }); }],
    ['an unknown outcome', (s) => { const m = addMap(s, 1, 1); s.stash.maps.pop(); s.lastRun = { map: m, outcome: 'won' as RunOutcome, room: 6, bossRoom: 6, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false }; }],
    ['201 maps', (s) => { for (let i = 0; i < 201; i++) s.stash.maps.push({ id: s.nextId++, type: 'map', tier: 1, metre: 1 }); }],
    ['a map at metre 0', (s) => { s.stash.maps.push({ id: s.nextId++, type: 'map', tier: 1, metre: 0 }); }],
  ];
  for (const [name, mutate] of cases) {
    const s = running();
    mutate(s);
    expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })), name).toEqual({ ok: false, reason: 'invalid' });
  }
});
```

```ts
// tests/core/maps.test.ts
it('a map find becomes a map in the stash', () => {
  const s = newGame(1, 0);
  while (s.deepest < 2) applyTicks(s, 1, deriveStats(s));
  expect(s.stash.maps).toEqual([expect.objectContaining({ type: 'map', tier: 1, metre: 2 })]);
  expect(s.stash.maps[0]?.id).toBeGreaterThan(s.finds.find((f) => f.kind === 'map')?.id ?? Infinity);
});

it('a full Maps tab drops its lowest-tier, oldest map', () => {
  const s = newGame(1, 0);
  for (let i = 0; i < MAP_STASH_SIZE; i++) addMap(s, i < 2 ? 1 : 3, 10 + i);
  const firstLow = s.stash.maps[0]?.id;
  addMap(s, 2, 999);
  expect(s.stash.maps).toHaveLength(MAP_STASH_SIZE);
  expect(s.stash.maps.some((m) => m.id === firstLow)).toBe(false);
  expect(s.stash.maps.filter((m) => m.tier === 1)).toHaveLength(1);
  const kept = addMap(s, 1, 5);
  expect(s.stash.maps.some((m) => m.id === kept.id)).toBe(false);   // strictly the lowest: not kept
  expect(s.stash.maps).toHaveLength(MAP_STASH_SIZE);
});
```

The schema-1 fixture test expected `nextId: 31`; update it to `nextId: 36`. Its 5 map finds become maps 31–35. The schema-2 fixture test's `nextId` likewise becomes `86`. These are value changes forced by this task, not plan-authored values of earlier plans.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** the Interfaces block.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Both must be green.
- [ ] **Step 5: Commit** with the message "Keep maps in the stash and move saves to schema 5".

---

### Task 2: Dungeons from the seed

**Files:**
- Create: `src/core/species.ts`, `src/core/names.ts`, `src/core/dungeons.ts`, `tests/core/dungeons.test.ts`
- Modify: `src/core/rng.ts` (`hashN`)

**Interfaces:**
- **`rng.ts`:** `hashN(seed: number, ...ns: number[]): number`. It starts with `h = seed >>> 0` and, for each `n`, sets `h = hash2(h, n)`, returning the uint32.

  Every world-generation value below uses its own salt as the first `n`. One feature never reuses another feature's hash; Plan 3's chained deep bands were exactly that bug. Where a single hash feeds several picks, take them from different bit ranges: `h % a`, `(h >>> 8) % b`, `(h >>> 16) % c`.
- **`species.ts`:**
  - `BODY_KINDS = ['blob', 'quadruped', 'biped', 'serpent', 'winged'] as const`.
  - `interface Species { name: string; body: BodyKind; element: Element; intervalS: number; lifeMult: number; damageMult: number }`.
  - **`NAMED_SPECIES`** (tiers 1–6, four each). Each entry gives name, body, element, interval, life × and damage ×:
    - **Tier 1:**
      - Mole Rat: quadruped, physical, 2.0, 0.8, 0.9
      - Cave Beetle: quadruped, physical, 2.5, 1.2, 0.8
      - Tunnel Bat: winged, physical, 2.0, 0.7, 1.0
      - Root Grub: blob, physical, 2.4, 1.1, 0.8
    - **Tier 2:**
      - Clay Golem: biped, physical, 3.0, 1.3, 1.0
      - Mud Slime: blob, elemental, 2.0, 1.0, 0.8
      - Burrow Snake: serpent, physical, 2.2, 0.8, 1.1
      - Kiln Imp: winged, elemental, 1.8, 0.7, 1.1
    - **Tier 3:**
      - Cave Spider: quadruped, physical, 2.0, 0.9, 1.0
      - Drip Slime: blob, elemental, 2.5, 1.1, 0.9
      - Stalker Bat: winged, physical, 1.8, 0.7, 1.0
      - Chalk Crawler: serpent, physical, 2.6, 1.2, 0.9
    - **Tier 4:**
      - Drowned Digger: biped, physical, 2.5, 1.2, 1.0
      - Bog Leech: serpent, elemental, 2.0, 0.8, 1.0
      - Granite Crawler: quadruped, physical, 3.0, 1.4, 1.1
      - Quarry Ghoul: biped, elemental, 2.2, 1.0, 1.1
    - **Tier 5:**
      - Ember Imp: winged, elemental, 1.8, 0.7, 1.1
      - Basalt Hound: quadruped, physical, 2.2, 1.0, 1.0
      - Ash Wraith: biped, elemental, 2.5, 0.9, 1.2
      - Magma Slug: blob, elemental, 2.8, 1.3, 0.9
    - **Tier 6:**
      - Glass Stalker: quadruped, physical, 2.0, 0.9, 1.1
      - Obsidian Golem: biped, physical, 3.0, 1.5, 1.0
      - Shade: winged, elemental, 1.8, 0.8, 1.1
      - Mirror Eel: serpent, elemental, 2.2, 1.0, 1.1
  - **`DEEP_SPECIES`** (four lists of four):
    - **List 1:**
      - Hollow One: biped, elemental, 2.2, 1.0, 1.1
      - Deep Wyrm: serpent, physical, 2.5, 1.3, 1.2
      - Void Eye: blob, elemental, 2.0, 0.9, 1.2
      - Gloom Bat: winged, physical, 1.8, 0.8, 1.2
    - **List 2:**
      - Bone Crawler: quadruped, physical, 2.4, 1.2, 1.1
      - Pale Maw: blob, physical, 2.6, 1.3, 1.0
      - Wailing Shade: winged, elemental, 1.9, 0.8, 1.2
      - Rust Golem: biped, physical, 3.0, 1.5, 1.0
    - **List 3:**
      - Ember Wyrm: serpent, elemental, 2.3, 1.1, 1.2
      - Cinder Hound: quadruped, elemental, 2.1, 1.0, 1.1
      - Ash Colossus: biped, physical, 3.2, 1.6, 1.0
      - Soot Bat: winged, elemental, 1.8, 0.7, 1.2
    - **List 4:**
      - Crystal Mite: quadruped, physical, 2.0, 0.9, 1.1
      - Prism Slime: blob, elemental, 2.4, 1.2, 1.0
      - Shard Serpent: serpent, physical, 2.4, 1.1, 1.2
      - Glass Wraith: biped, elemental, 2.2, 1.0, 1.2
  - `speciesOf(tier): readonly Species[]` returns `NAMED_SPECIES[tier − 1]` for tiers 1–6, else `DEEP_SPECIES[(tier − 7) % 4]`.
- **`names.ts`:** curated lists only, written out in full by the implementer:
  - `SYLLABLE_START` (≥ 16) + optional `SYLLABLE_MIDDLE` (≥ 6) + `SYLLABLE_END` (≥ 12), so `creatureName` gives names like "Gorvash" or "Thulmar";
  - `EPITHETS` (≥ 16), for "the Hollow", "the Unbroken" and the like;
  - `BOSS_TITLES` (≥ 8): Warden, Keeper, Tyrant, Matron, Lord, Howler, Devourer, Shepherd;
  - `DUNGEON_ADJECTIVES` (≥ 16), for Weeping, Sunken and so on;
  - `DUNGEON_PREFIXES` (≥ 10) and `DUNGEON_SUFFIXES` (≥ 8), for "Gloom" + "vein";
  - `DUNGEON_PLACES`, a record from band slot (tiers 1–6, then one list for all deep tiers) to ≥ 4 place nouns. For example, tier 1 has Burrows, Hollows, Warrens and Roots, and tier 2 has Pits, Kilns, Mudworks and Ovens.

  No word in any list may be a slur or a profanity, and every generated name must be pronounceable: no three consonants in a row across a syllable join. The functions:
  - `creatureName(h)` is Capitalised.
  - `championName(h)` returns `` `${creatureName(h)} the ${epithet}` ``.
  - `dungeonName(h, tier)` returns either `` `The ${adjective} ${place}` `` or `` `${prefix}${suffix} ${place}` ``, chosen by a bit of `h`.
  - `bossName(h, dungeon)` returns `` `${creatureName(h)}, ${title} of ${dungeon with a leading "The " lowered to "the "}` ``.
- **`dungeons.ts`:**
  - `interface DungeonType { name: string; floor: { shades: [string, string, string]; pattern: 0 | 1 | 2 | 3 }; bias: Element; species: number[]; rooms: number; bossSpecies: number; bossName: string }`.
  - `dungeonType(seed, tier, index: 0 | 1 | 2): DungeonType`. Each feature has its own salt:
    - **name:** the three types of one tier get three different names. On a clash, rehash with an attempt counter.
    - **floor:** shades are `hsl(h, s%, l%)`, with `h` from the hash, `s` in 8–20 and `l` steps of 11/13/15 %. The pattern comes from the hash.
    - **bias:** physical or elemental.
    - **species:** order `speciesOf(tier)` with the bias-matching species first, each group in hash order, and take the first 2 or 3.
    - **rooms:** `MIN_ROOMS + h % 4`.
    - **bossSpecies:** one of `species`.
    - **bossName:** from `bossName`.
  - `dungeonIndexAt(seed, metre): 0 | 1 | 2` is `hashN(seed, SALT_TYPE, metre) % 3`.
  - `interface LayoutMonster { species: number; rank: Rank; name: string; mods: ChampionMod[]; extra: number }`, where `name` is the species name for a normal monster.
  - **`dungeonLayout(seed, map: { tier: number; metre: number }): { type: DungeonType; rooms: LayoutMonster[][]; boss: LayoutMonster }`.** The algorithm is fixed, because the tests pin its shape:
    1. `type = dungeonType(seed, tier, dungeonIndexAt(seed, metre))`, and `R = type.rooms`.
    2. `C = tier >= 8 ? 2 : 1`. A hash permutation of the rooms (from `(seed, metre)`) gives the order; the first `C` rooms of it get a champion, each worth `CHAMPION_UNITS`.
    3. The `MONSTER_BUDGET − C·CHAMPION_UNITS` normal units are added one at a time, each to the room with the smallest total. Ties go to the earlier room in the permutation.
    4. Each room lists its normal monsters, then its champion. Each monster's species is a hash pick from `type.species` keyed by `(seed, metre, room, slot)`, and so is its `extra`. A champion also gets `championName` and 1–2 distinct modifiers, keyed the same way.
    5. `boss = { species: type.bossSpecies, rank: 'boss', name: type.bossName, mods: [], extra: hashN(seed, SALT_BOSS, tier, index) }`.

- [ ] **Step 1: Write the failing tests** in `tests/core/dungeons.test.ts`

```ts
import { expect, it } from 'vitest';
import { CHAMPION_UNITS, MAX_ROOMS, MIN_ROOMS, MONSTER_BUDGET } from '../../src/core/balance';
import { dungeonIndexAt, dungeonLayout, dungeonType } from '../../src/core/dungeons';
import { DEEP_SPECIES, NAMED_SPECIES, speciesOf } from '../../src/core/species';
import { seedFromText } from '../../src/core/seed';

const units = (room: { rank: string }[]) => room.reduce((n, m) => n + (m.rank === 'champion' ? CHAMPION_UNITS : 1), 0);

it('species lists are fixed per tier and cycle in the deep', () => {
  expect(speciesOf(1).map((s) => s.name)).toEqual(['Mole Rat', 'Cave Beetle', 'Tunnel Bat', 'Root Grub']);
  expect(speciesOf(7)).toBe(DEEP_SPECIES[0]);
  expect(speciesOf(11)).toBe(DEEP_SPECIES[0]);
  expect(speciesOf(10)).toBe(DEEP_SPECIES[3]);
  expect(NAMED_SPECIES.every((list) => list.length === 4)).toBe(true);
});

it('the same seed and metre give the same dungeon, for everyone', () => {
  const seed = seedFromText('golden mole');
  const a = dungeonLayout(seed, { tier: 3, metre: 214 });
  const b = dungeonLayout(seed, { tier: 3, metre: 214 });
  expect(a).toEqual(b);
  const other = dungeonLayout(seedFromText('amber-fox-427'), { tier: 3, metre: 214 });
  expect(JSON.stringify(other)).not.toEqual(JSON.stringify(a));
});

it('every layout spends exactly the budget, champions first', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const tier of [1, 3, 7, 8, 12]) {
      const { type, rooms, boss } = dungeonLayout(seed, { tier, metre: seed * 37 });
      expect(rooms).toHaveLength(type.rooms);
      expect(type.rooms).toBeGreaterThanOrEqual(MIN_ROOMS);
      expect(type.rooms).toBeLessThanOrEqual(MAX_ROOMS);
      expect(rooms.reduce((n, r) => n + units(r), 0)).toBe(MONSTER_BUDGET);
      expect(rooms.flat().filter((m) => m.rank === 'champion')).toHaveLength(tier >= 8 ? 2 : 1);
      for (const r of rooms) {
        expect(r.length).toBeGreaterThan(0);
        expect(r.slice(0, -1).every((m) => m.rank === 'normal')).toBe(true);   // a champion, if any, fights last
      }
      if (type.rooms === 4) expect(rooms.map(units).every((u) => u === 3 || u === 4)).toBe(true);
      expect(boss).toMatchObject({ rank: 'boss', species: type.bossSpecies, name: type.bossName });
      for (const m of rooms.flat()) {
        expect(type.species).toContain(m.species);
        if (m.rank === 'champion') expect([1, 2]).toContain(new Set(m.mods).size);
        else expect(m.mods).toEqual([]);
      }
    }
  }
});

it('dungeon types: three per tier with distinct names, 2–3 species, a valid boss', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const tier of [1, 6, 9]) {
      const types = ([0, 1, 2] as const).map((i) => dungeonType(seed, tier, i));
      expect(new Set(types.map((t) => t.name)).size).toBe(3);
      for (const t of types) {
        expect([2, 3]).toContain(t.species.length);
        expect(t.species).toContain(t.bossSpecies);
        expect(t.bossName).toMatch(/^[A-Z][a-z]+, [A-Z][a-z]+ of /);
        expect(t.name.length).toBeGreaterThan(5);
        expect(t.floor.shades.every((c) => /^hsl\(\d+, \d+%, \d+%\)$/.test(c))).toBe(true);
      }
    }
  }
  expect([0, 1, 2]).toContain(dungeonIndexAt(5, 214));
});

it('world generation ignores the loot stream and the player', () => {
  const seed = 42;
  const layout = JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }));
  // dungeonLayout takes no GameState at all; this guards against a future signature that would
  expect(dungeonLayout.length).toBe(2);
  expect(JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }))).toBe(layout);
});
```

- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement.** Write the full name lists. Also generate 50 dungeon names, 50 champion names and 50 boss names for seeds 1–50 and paste them into your report for the reviewer to read.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.**
- [ ] **Step 5: Commit** with the message "Generate dungeons, species mixes and names from the seed".

---

### Task 3: Battle stats, levels and monster numbers

**Files:**
- Create: `src/core/battle.ts`, `src/core/monsters.ts`, `tests/core/battle.test.ts`
- Modify: `src/core/levels.ts` (add `gainXp`), `src/core/balance.ts`, `src/core/itemGen.ts` (magic find)

**Interfaces:**
- **`balance.ts`:**
  - Player:
    - `BASE_LIFE = 50`, `LIFE_PER_LEVEL = 10`;
    - `baseDamage(level) = { min: 2 + level, max: 4 + 2·level }`;
    - `BASE_ATTACKS_PER_SECOND = 1`, `MIN_ATTACKS_PER_SECOND = 0.2`, `MAX_ATTACKS_PER_SECOND = 5`;
    - `BASE_CRIT_CHANCE = 5`, `MAX_CRIT_CHANCE = 75`, `CRIT_MULTIPLIER = 1.5`;
    - `MAX_RESIST = 75`, `ARMOR_FACTOR = 10`, `MAX_ARMOR_REDUCTION = 0.9`.
  - Monster base values, not rounded:
    - `monsterLifeBase(tier) = 15·tier^1.3`;
    - `monsterDamageBase(tier) = 2 + 1.5·tier^1.2`;
    - `monsterXp(tier) = round(10·tier^1.5)`.
  - Rank multipliers: `CHAMPION_LIFE = 2.5`, `CHAMPION_DAMAGE = 1.5`, `CHAMPION_REWARD = 3`, `BOSS_LIFE = 5`, `BOSS_DAMAGE = 1.5`, `BOSS_REWARD = 5`.
  - Modifiers: `ARMORED_TAKEN = 0.6`, `SWIFT_SPEED = 1.4`, `VAMPIRIC_HEAL = 0.2`, `BRUTAL_DAMAGE = 1.5`, `THICK_LIFE = 1.8`.
  - Rewards and drops:
    - `soulsPerKill(tier) = 0.25·tier`, `goldPerKill(tier) = 2·tier`;
    - `DROP_CHANCE = 0.15`, `BOSS_DROPS = 2`, `CHAMPION_DROPS = 1`, `CHAMPION_MAGIC_FIND = 3`;
    - `MAP_DROP_BATTLE_CHANCE = 0.8`, `MAP_GEM_CHANCE = 0.04`;
    - `ROOM_REGEN = 0.3`.
- **`battle.ts`:**
  - `interface BattleStats { maxLife; damageMin; damageMax; attacksPerSecond; critChance; critMultiplier; armor; resistAll; soulMultiplier; magicFindMultiplier }`.
  - `deriveBattleStats(state)` follows the draft's formulas exactly, with `g = gearTotals(state, 'battle')` and `pct(n) = max(0, 1 + n/100)`:

    | Stat | Formula |
    |---|---|
    | maxLife | `clamp(BASE_LIFE + LIFE_PER_LEVEL·level + g.life, 1, MAX_LIFE)` |
    | damageMin | `clamp(round((base.min + g.damage)·pct(g.damagePct)), 1, MAX_DAMAGE)` |
    | damageMax | `max(damageMin, clamp(round((base.max + g.damage)·pct(g.damagePct)), 1, MAX_DAMAGE))` |
    | attacksPerSecond | `clamp(BASE_ATTACKS_PER_SECOND·pct(g.attackSpeed), MIN, MAX)` |
    | critChance | `clamp(BASE_CRIT_CHANCE + g.critChance, 0, MAX_CRIT_CHANCE) / 100` |
    | critMultiplier | `CRIT_MULTIPLIER` |
    | armor | `clamp(g.armor, 0, MAX_DAMAGE)` |
    | resistAll | `clamp(g.resistAll, 0, MAX_RESIST)` |
    | soulMultiplier | `pct(g.soulFind)` |
    | magicFindMultiplier | `pct(g.magicFind)` |
  - `mitigate(raw, element, b)`:
    - physical: `raw·(1 − min(MAX_ARMOR_REDUCTION, armor / (armor + ARMOR_FACTOR·raw)))`;
    - elemental: `raw·(1 − resistAll/100)`;
    - then round, with a minimum of 1.
- **`levels.ts` `gainXp(state, amount): number`:** it adds the XP, levels up while `xp ≥ xpToNext(level)` and `level < LEVEL_CAP`, and returns the levels gained. At the cap, XP stays 0.
- **`monsters.ts` `monsterState(tier, lm: LayoutMonster): MonsterState`:**
  - `s = speciesOf(tier)[lm.species]`, and `rankLife` / `rankDamage` / `rankReward` are 1, CHAMPION_* or BOSS_*.
  - `maxLife = life = max(1, round(monsterLifeBase(tier)·s.lifeMult·rankLife·(thickSkinned ? THICK_LIFE : 1)))`.
  - `damage = max(1, round(monsterDamageBase(tier)·s.damageMult·rankDamage·(brutal ? BRUTAL_DAMAGE : 1)))`.
  - `intervalS = s.intervalS / (swift ? SWIFT_SPEED : 1)`.
  - `element = fireTouched ? 'elemental' : s.element`.
  - `xp = monsterXp(tier)·rankReward`.
  - Name, species, rank, mods and extra are copied from `lm`.
- **`itemGen.ts`:** `rollRarity(state, magicFind = 1)` weights normal 60, and magic 30, rare 9 and legendary 1, each × `magicFind`.

- [ ] **Step 1: Write the failing tests** in `tests/core/battle.test.ts`

```ts
it('a naked level-1 miner', () => {
  expect(deriveBattleStats(newGame(1, 0))).toEqual({
    maxLife: 60, damageMin: 3, damageMax: 6, attacksPerSecond: 1, critChance: 0.05, critMultiplier: 1.5,
    armor: 0, resistAll: 0, soulMultiplier: 1, magicFindMultiplier: 1,
  });
});

it('battle gear and level add up', () => {
  const s = newGame(1, 0);
  s.level = 10;
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 }, affixes: [{ stat: 'attackSpeed', value: 20 }] });
  s.equipped.battle.amulet = gear(s, 'amulet', { implicit: { stat: 'damagePct', value: 50 } });
  s.equipped.battle.ring = gear(s, 'ring', { implicit: { stat: 'critChance', value: 5 } });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 }, affixes: [{ stat: 'resistAll', value: 90 }] });
  s.equipped.battle.helm = gear(s, 'helm', { implicit: { stat: 'life', value: 40 }, affixes: [{ stat: 'soulFind', value: 50 }] });
  expect(deriveBattleStats(s)).toMatchObject({ maxLife: 190, damageMin: 39, damageMax: 57, attacksPerSecond: 1.2, critChance: 0.1, armor: 30, resistAll: 75, soulMultiplier: 1.5 });
});

it('armor and resistance soften hits', () => {
  const b = deriveBattleStats(newGame(1, 0));
  expect(mitigate(10, 'physical', { ...b, armor: 100 })).toBe(5);
  expect(mitigate(10, 'elemental', { ...b, resistAll: 75 })).toBe(3);
  expect(mitigate(4, 'physical', { ...b, armor: 1_000_000 })).toBe(1);
  expect(mitigate(10, 'physical', b)).toBe(10);
});

it('xp levels the miner up to the cap', () => {
  expect([1, 2, 10, 59].map(xpToNext)).toEqual([100, 283, 3162, 45_319]);
  expect(xpToNext(60)).toBe(0);
  const s = newGame(1, 0);
  expect(gainXp(s, 383)).toBe(2);
  expect([s.level, s.xp]).toEqual([3, 0]);
  s.level = 59; s.xp = 45_000;
  expect(gainXp(s, 1_000)).toBe(1);
  expect([s.level, s.xp]).toEqual([60, 0]);
  expect(gainXp(s, 5_000)).toBe(0);
});

it('monster numbers by rank and modifier', () => {
  const rat = { species: 0, rank: 'normal' as const, name: 'Mole Rat', mods: [], extra: 1 };
  expect(monsterState(1, rat)).toMatchObject({ life: 12, maxLife: 12, damage: 3, intervalS: 2, xp: 10, element: 'physical' });
  const champ = { ...rat, rank: 'champion' as const, name: 'Gorvash the Hollow', mods: ['thickSkinned', 'fireTouched'] as ChampionMod[] };
  expect(monsterState(1, champ)).toMatchObject({ life: 54, damage: 5, xp: 30, element: 'elemental' });
  const swift = monsterState(1, { ...champ, mods: ['swift', 'brutal'] });
  expect(swift.intervalS).toBeCloseTo(2 / 1.4);
  expect(swift.damage).toBe(7);
  expect(monsterState(1, { ...rat, rank: 'boss' })).toMatchObject({ life: 60, damage: 5, xp: 50 });
  expect([monsterXp(2), monsterXp(4), monsterXp(10)]).toEqual([28, 80, 316]);
});

it('magic find raises the better rarities', () => {
  const s = newGame(4, 0);
  const n = 20_000;
  const rares = Array.from({ length: n }, () => rollRarity(s, 3)).filter((r) => r === 'rare').length / n;
  expect(rares).toBeGreaterThan(0.14);
  expect(rares).toBeLessThan(0.16);
});
```

The arithmetic, with tier 1 base life 15 and base damage 3.5:
- **Mole Rat:** 15 × 0.8 = 12 life, round(3.5 × 0.9) = 3 damage.
- **The champion:** life 15 × 0.8 × 2.5 × 1.8 = 54, damage round(3.5 × 0.9 × 1.5) = round(4.725) = 5, and XP 30.
- **Swift + Brutal:** damage round(3.5 × 0.9 × 1.5 × 1.5) = round(7.0875) = 7.
- **The boss:** life 15 × 0.8 × 5 = 60, damage round(3.5 × 0.9 × 1.5) = 5, and XP 50.
- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Plans 2–4's item tests still pass, because `rollRarity`'s default multiplier is 1.
- [ ] **Step 5: Commit** with the message "Add battle stats, levels and monster numbers".

---

### Task 4: Map runs and the combat loop

**Files:**
- Create: `src/core/combat.ts`, `tests/core/combat.test.ts`
- Modify: `src/core/maps.ts` (`startMap`, `leaveMap`), `src/core/dig.ts` (activity dispatch), `src/core/types.ts` (`TickEvent`)

**Interfaces:**
- **`TickEvent` gains:**
  - `{ kind: 'strike'; amount: number; crit: boolean; click: boolean }`
  - `{ kind: 'hurt'; amount: number }`
  - `{ kind: 'runEnd'; result: RunResult }`
- **`maps.ts`:**
  - `startMap(state, mapId): 'ok' | 'busy' | 'invalid'`:
    - `'busy'` while a map runs, and `'invalid'` for an id not in `stash.maps`.
    - Otherwise it removes the map and computes `layout = dungeonLayout(state.seed, map)`.
    - It sets `activity` to a run with `room: 1`, `bossRoom: layout.rooms.length + 1`, `queue: layout.rooms[0].map((m) => monsterState(tier, m))` and `life: deriveBattleStats(state).maxLife`. The carries start at 0, gains at zero, and `log`/`loot` are empty.
  - `leaveMap(state): boolean` ends the run with `'left'`. It returns false when no map is running.
- **`combat.ts`:**
  - `mapTick(state, stats, events?)` runs one tick of combat, with `b = deriveBattleStats(state)` (re-derived after every level-up) and `dt = 1 / stats.autoTicksPerSecond`:
    1. **Player hits:** `hitCarry += b.attacksPerSecond·dt`. While `hitCarry ≥ 1`, subtract 1 and strike (auto). Stop when the run ends or the room is cleared.
    2. **Room cleared this tick:** `hitCarry -= floor(hitCarry)`, and the tick ends; the new room doesn't attack this tick.
    3. **Monster attacks, otherwise:** `monsterCarry += dt / queue[0].intervalS`. While it is ≥ 1, subtract 1 and resolve the hit:
       - `hurt = mitigate(m.damage, m.element, b)` and `life -= hurt`;
       - push a `hurt` event and a `hurt` log line;
       - **Vampiric:** `m.life = min(m.maxLife, m.life + round(hurt·VAMPIRIC_HEAL))`, logged as a `heal` line when the heal is above 0;
       - `life ≤ 0` ends the run as `'died'`.
  - `clickHit(state, events?)` makes one click strike immediately. It does nothing when no map runs, and a room cleared by a click advances at once.
  - **A strike:**
    - Damage is `damageMin + floor(u₁·(damageMax − damageMin + 1))`. It crits when `u₂ < critChance` (×`critMultiplier`, rounded).
    - **Armored:** the damage becomes `max(1, round(damage·ARMORED_TAKEN))`.
    - Subtract it from `queue[0].life`, then push a `strike` event and a `hit` line.
    - **At life ≤ 0:**
      - shift the monster out and reset `monsterCarry = 0`;
      - call `gainXp(monster.xp)`; for each level gained, add the max-life increase to `run.life` and log a `level` line;
      - log a `kill` line and add to `gained`.
    - **An emptied queue:**
      - in the boss room, the run ends as `'cleared'`;
      - otherwise log a `room` line and go to `room + 1`;
      - set `life = min(maxLife, life + round(maxLife·ROOM_REGEN))`;
      - the queue becomes the next room from `dungeonLayout` (rooms `1..bossRoom−1`), or `[monsterState(tier, layout.boss)]` for the boss room.
  - **Ending a run:**
    - `lastRun = { map, outcome, room, bossRoom, gained, items: loot.length, seen: false }`;
    - `mapTally.cleared` rises for `'cleared'` and `mapTally.lost` otherwise;
    - `activity = { kind: 'dig' }`, and push a `runEnd` event.
  - **Limits:** `log` keeps the newest `COMBAT_LOG_LIMIT` lines, and `loot` the newest `RUN_LOOT_LIMIT`.
- **`dig.ts` `applyTicks`:** while `activity.kind === 'map'`, a tick runs `mapTick` and adds 1 to `tickCount`. It never digs, pays no per-tick Gold and draws no Diamond. This check comes before the overflow idle check, so combat continues while loot is held. Once the run ends, the remaining ticks dig.

- [ ] **Step 1: Write the failing tests** in `tests/core/combat.test.ts`. These are the draft's tests, adapted to the stash and generated layouts:
  - `runMap(tier, clicksPerTick, seed)` uses `newGame(seed, 0)`, `addMap(s, tier, 10 + seed)` and `startMap`, then loops up to 5,000 ticks with clicks first, then `applyTicks(s, 1, stats)`.

```ts
it('a naked level-1 miner clears a tier-1 map on auto hits alone', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(1, 0, seed).lastRun?.outcome, `seed ${seed}`).toBe('cleared');
});
it('the same miner falls in a tier-2 map without clicking', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(2, 0, seed).lastRun?.outcome, `seed ${seed}`).toBe('died');
});
it('three clicks a second win that tier-2 map', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(2, 3, seed).lastRun?.outcome, `seed ${seed}`).toBe('cleared');
});
it('a tier-4 map kills a level-1 miner in the first room', () => {
  expect(runMap(4, 0, 1).lastRun).toMatchObject({ outcome: 'died', room: 1 });
});
it('a cleared run levels up, consumes the map and keeps the tally', () => {
  const s = runMap(1, 0, 1);
  expect(s.level).toBeGreaterThanOrEqual(2);
  expect(s.stash.maps).toEqual([]);
  expect(s.mapTally).toEqual({ cleared: 1, lost: 0 });
  expect(s.lastRun).toMatchObject({ room: s.lastRun?.bossRoom, seen: false, gained: { xp: 200 } });   // 12 normals + 1 champion ×3 + boss ×5 = 20 × 10 XP
  expect(s.activity).toEqual({ kind: 'dig' });
});
```

  Add a test, 'vampiric champions heal, armored ones soak hits'. Put a `MonsterState` with `mods: ['armored', 'vampiric']` and a known life as `queue[0]` of a started run. Set `run.life` high. Then check two things:
  - after `clickHit`, the monster's life dropped by `max(1, round(hit × 0.6))`, with the hit recovered from the `strike` event;
  - after enough `applyTicks` for one monster attack, a `heal` line exists and the monster's life rose by `round(hurt × 0.2)`.

  Also include, verbatim from Task 3 of the shelved draft at `/var/www/webcdev.local/goldenminer/.superpowers/drafts/maps-combat-levels-draft.md` (renaming `s.maps` to `s.stash.maps`):
  - 'digging pauses during a run and resumes after it';
  - 'only one run at a time, and only maps from the stash';
  - 'pumped play and one long catch-up give the same run'.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.**
- [ ] **Step 5: Commit** with the message "Run maps: rooms, champions, bosses and automatic combat".

---

### Task 5: Kill rewards, map loot and the offline report

**Files:**
- Modify: `src/core/combat.ts`, `src/core/summary.ts`, `src/core/types.ts` (`OfflineSummary`)
- Test: `tests/core/rewards.test.ts`

**Interfaces:**
- **`soulsForKill(u, tier, rank, soulMultiplier)`:** with `x = soulsPerKill(tier)·rankReward·soulMultiplier`, it returns `floor(x) + (u < x − floor(x) ? 1 : 0)`.
- **Every kill, after its XP, makes these draws in order:**
  1. **Souls**, via `nextRandom`.
  2. **Gold:** `goldPerKill(tier)·rankReward`.
  3. **Items:** `boss ? BOSS_DROPS : champion ? CHAMPION_DROPS : 0`, plus 1 more when `nextRandom < DROP_CHANCE`. For each item:
     - the set is `nextRandom < MAP_DROP_BATTLE_CHANCE ? 'battle' : 'mining'`;
     - roll `rollGear(state, tier, set, rollRarity(state, b.magicFindMultiplier·(this is a champion's guaranteed item ? CHAMPION_MAGIC_FIND : 1)))`;
     - the notes from `receiveItem(state, item, 'battle')` go into `run.loot`, and each is logged as a `drop` line.
  4. **Gem:** if `nextRandom < MAP_GEM_CHANCE`, then `receiveItem(state, rollGem(state, tier), 'battle')`, noted the same way.

  The kill line carries the XP and Souls.
- **`OfflineSummary`** gains `souls`, `levels` and `maps: { cleared; lost }`, as the differences between before and after.

- [ ] **Step 1: Write the failing tests.** These are the three reward tests from Task 4 of the shelved draft (`.superpowers/drafts/maps-combat-levels-draft.md`), adapted:
  - The fill helpers fill fixed cells (`s.bags.battle = s.bags.battle.map(() => gear(s, 'weapon'))`, and similarly for `stash.general`).
  - The gold expectation for a cleared tier-1 map stays 40: 12 normals × 2, one champion × 6, and the boss × 10.
  - `soulsForKill` cases:

```ts
expect(soulsForKill(0.5, 4, 'normal', 1)).toBe(1);
expect(soulsForKill(0.4, 2, 'normal', 1)).toBe(1);
expect(soulsForKill(0.6, 2, 'normal', 1)).toBe(0);
expect(soulsForKill(0, 1, 'boss', 2)).toBe(3);
expect(soulsForKill(0.1, 1, 'champion', 1)).toBe(1);   // 0.75: floor 0, 0.1 < 0.75 → 1
```

  - 'a cleared tier-1 map pays Souls, 40 Gold and at least the boss and champion drops' (`items ≥ 3`).
  - 'a full bag under stop holds map drops but the fight goes on'. Use cells: every bag and General cell is filled with gear, and `bagFull = 'stop'`.
  - 'the offline summary reports maps, levels and Souls'.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Task 4's balance probes still pass, because rewards don't change survival.
- [ ] **Step 5: Commit** with the message "Pay XP, Souls, Gold and loot for map kills".

---

### Task 6: Store intents for maps and combat feedback

**Files:** `src/store/gameStore.ts`, `tests/store/gameStore.test.ts`, `tests/store/lifecycle.test.ts`

**Interfaces:** as Task 5 of the shelved draft (`.superpowers/drafts/maps-combat-levels-draft.md`):
- `Feedback` gains `strikes` (the newest 6 auto strikes) and `hurt` (summed).
- `GameStore` gains `battle: BattleStats`, `startMap(mapId)`, `leaveMap()` and `dismissRun()`.
- A click during a map calls `clickHit` instead of `clickTicks`.

  **Two changes from the draft:** maps are added with `addMap(store.state, tier, metre)` into `stash.maps`, and the draft's `maps` getter usages become `stash.maps`.

- [ ] **Step 1: Write the failing tests.** These are the draft's store tests and its lifecycle test, verbatim apart from the `stash.maps` rename. In the lifecycle test the reference map is `addMap(reference, 1, 2)`, the same metre as in the store.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.**
- [ ] **Step 5: Commit** with the message "Add map intents and combat feedback to the store".

---

### Task 7: Monster looks from a part kit

**Files:**
- Create: `src/core/monsterParts.ts`, `src/core/monsterLook.ts`, `src/ui/PixelArt.tsx`, `tests/core/monsterLook.test.ts`

**Interfaces:**
- **`monsterParts.ts`, the kit.** These are pixel templates the implementer draws, within these rules:
  - **Characters:**
    - `.` transparent; `k` outline;
    - `b` body, `B` body light, `d` body dark;
    - `a` accent, `A` accent light;
    - `e` eye white, `p` pupil;
    - `m` mouth, `t` tooth or bone.
  - **Shapes:** `Part = { grid: string[]; anchor: [x, y]; sockets?: Partial<Record<Socket, [x, y]>> }`, where `Socket = 'head' | 'legs' | 'wings' | 'tail' | 'back' | 'eyes' | 'mouth' | 'horns'`.
  - **Bodies:** `BODIES: Record<BodyKind, Part>`. Each body has a `head` socket. Quadruped and biped have `legs`, winged has `wings`, serpent and quadruped have `tail`, and every body has `back`.
  - **Heads:** `HEADS: Part[]` (≥ 3), each with `eyes`, `mouth` and `horns` sockets.
  - **Other parts:** `EYES` (≥ 4), `MOUTHS` (≥ 3), `HORNS` (≥ 4, including antennae), `LEGS: Record<'quadruped' | 'biped', Part[]>` (≥ 3 each), `WINGS` (≥ 3), `TAILS` (≥ 3) and `SPIKES` (≥ 3, for the `back` socket, used as extra parts).
- **`monsterLook.ts`:**
  - **`compose(parts: { part: Part; at: [x, y] }[]): string[]`** draws on a 24 × 24 canvas. Parts are drawn back to front: tail, wings, legs, body, back extras, head, horns, eyes, mouth. A part's non-`.` pixels overwrite what is below. The body's anchor sits at (12, 22). Every other part's anchor sits at its parent's socket.
  - **`speciesLook(seed, tier, speciesIndex)`** returns `{ grid: string[]; palette: Record<string, string> }`, keyed by `hashN(seed, SALT_LOOK, tier, speciesIndex)`:
    - The parts are the species' body and a hash-picked variant of each other part its body takes. The horns are optional (one hash bit).
    - **Palette:**
      - **Body:** hue from the hash, saturation 35–60 %, lightness 42–58 %; `B` is lightness + 14 and `d` is − 14.
      - **Accent:** hue + 150–210°, saturation 45–70, lightness 50–62; `A` is + 12.
      - **Eyes:** `e` `#f4ecd8`, and `p` from `['#ffe08a', '#ff6b5a', '#7fe8ff', '#c6ff7a', '#ffffff']`.
      - **Fixed:** `k` `#120d0a`, `m` `#3a1414`, `t` `#efe6cf`.
      - All colours are written as `hsl()` or `#hex`.
  - **`monsterLook(seed, tier, m: Pick<MonsterState, 'species' | 'rank' | 'extra'>)`** returns `{ grid; palette; aura: string | null; scale: 1 | 2 }`:
    - **Normal:** the species look.
    - **Champion:** the species look, plus one `SPIKES` or `HORNS` variant picked by `m.extra`, and an aura colour from `['#ff9b45', '#b39cff', '#7fe8ff', '#e2604f']` picked by `m.extra`.
    - **Boss:** the species look, plus 2–3 extras picked by `m.extra`, and `scale: 2` (drawn larger).
    - In `species` and `extra`, the same inputs always give the same output.
- **`PixelArt({ grid, palette, scale, aura?, label? })`:**
  - It draws the grid to a `<canvas>` at integer scale with `image-rendering: pixelated`.
  - With an aura, every transparent pixel next to a filled one is drawn in the aura colour, giving a 1-pixel outline.
  - Its accessibility (`role="img"` with a label, or `aria-hidden`) matches `Sprite`.
  - It memoises the drawn image by grid and palette.

- [ ] **Step 1: Write the failing tests** in `tests/core/monsterLook.test.ts`:
  - **The kit is well formed:**
    - every part grid is rectangular and uses only the characters above;
    - every anchor and socket lies inside its grid;
    - every body has the sockets its kind needs (see above).
  - **No combination clips:** compose every body with every variant of every part it takes (one part varied at a time, the rest at variant 0), and with each `SPIKES`/`HORNS` extra. In every case, no part writes outside 24 × 24 (`compose` throws on an out-of-canvas pixel), the result has at least one `e` or `p`, and it has `k` pixels.
  - **Looks are deterministic:** for seeds 1–30 and tiers 1–8, every species' `speciesLook` is deterministic, and its grid differs between two seeds for at least 80 % of the species.
  - **Rank changes the look:** `monsterLook` for a champion has an `aura` and a grid different from its species look. A boss has `scale: 2`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement the kit, the composer and `PixelArt`.**
- [ ] **Step 4: Owner gallery.**
  - Add a dev-only route: when the URL has `?gallery=monsters`, `main.tsx` renders a page showing, for the seeds `golden mole` and `amber-fox-427`, every species of tiers 1–8 as normal, champion and boss at scale 4. Tree-shaking keeps it out of the production build: guard it with `import.meta.env.DEV`.
  - Screenshot it with puppeteer and save it as `task7-gallery.png` in the workspace. The controller shows it to Ernest.
  - The **anti-goal** is "creatures that look like noise": every creature must read as a creature, with eyes, a body and limbs. Fix any that don't before committing.
- [ ] **Step 5: Run `npm test`, `npm run typecheck` and `npm run build`.**
- [ ] **Step 6: Commit** with the message "Draw monsters from a part kit with seeded palettes".

---

### Task 8: Header, tabs and the maps list

**Files:**
- Create: `src/ui/Nav.tsx`, `src/ui/maps/mapsView.ts`, `src/ui/maps/MapList.tsx`, `src/ui/maps/MapsView.tsx`, `src/ui/maps/maps.css`, `tests/ui/mapsView.test.ts`
- Modify: `src/ui/Header.tsx`, `src/ui/App.tsx`, `src/ui/app.css`, `src/ui/theme.css`, `src/ui/mine/MineView.tsx`, `src/ui/character/CharacterPanel.tsx`, `src/ui/character/StashDialog.tsx` (the Maps tab shows `MapList`)

**Interfaces:**
- **`mapsView.ts` (pure):**
  - From Task 6 of the shelved draft (`.superpowers/drafts/maps-combat-levels-draft.md`), unchanged: `xpBar(level, xp)`, `runTitle(r)` and `gainsLine(g, items)`.
  - `runTitle` uses `r.bossRoom` to say "the boss room".
  - **New: `mapGroups(seed, maps)`** returns `{ key: string; name: string; tier: number; maps: { id: number; metre: number; rooms: number }[] }[]`:
    - The groups are keyed by `${tier}:${dungeonIndexAt(seed, metre)}`.
    - The name is `dungeonType(seed, tier, index).name`.
    - Groups are sorted by tier descending, then name. Within a group, maps are sorted by id ascending (oldest first).
    - `rooms` is that dungeon's room count.
- **Header (board 2):**
  - A Souls pill: the flame SVG from the mockup, in `--gm-soul`.
  - A level block: `Level <n>`, then ` / 60` in muted text, and an 8 px XP bar in `--gm-life`. Its right-hand text is `+<run xp> XP this run` during a run, otherwise the `xpBar` text.
  - During a run, the depth block shows `Digging paused while in a map`.
- **Nav (`<nav aria-label="Game sections">`):**
  - Two buttons, `Mine` and `Maps (<count>)`, each ≥ 44 px with `aria-pressed`.
  - The Maps tab uses Soul colours when active.
- **App:**
  - It holds `view: 'mine' | 'maps'`, and starting a run switches to `maps`.
  - The Maps view shows `MapsView`, or `RunView` during a run. RunView is Task 9; until then, show a "Run in progress" placeholder.
- **`MapList({ store, compact? })`:**
  - One section per group, headed with a T-badge, the dungeon name and `×<count>`.
  - Each row shows `found at <metre> m · <rooms> rooms` and a `Run` button.
  - Run buttons are disabled during a run.
  - Empty state: "No maps yet. Dungeon entrances you dig into become maps."
  - `MapsView` renders it with the heading "Maps" and `<n> / 200 in your Maps tab`, plus a "Last run" card when `lastRun` exists.
  - The stash dialog's Maps tab renders `MapList compact`.
- **MineView during a run:** a banner reading "Digging is paused while you're in a map.", with a `Back to the map` button.
- **CharacterPanel:**
  - A run starting switches it to the Battle set, and the run ending switches it back to Mining.
  - **Plan 4's slot-glow carry-over:** an equip notice for the set not shown no longer hides its glow. The panel switches to that set when the notice arrives.

- [ ] **Step 1: Write the failing test** in `tests/ui/mapsView.test.ts`:
  - the draft's `xpBar`, `runTitle` (with `bossRoom`) and `gainsLine` cases;
  - a `mapGroups` case on the migrated schema-4 fixture: the fixture's 14 maps at metre 214 share one group, the tier-3 group comes first, and the groups' map counts add up to 21.
- [ ] **Step 2: Run it and check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run build`, then a puppeteer check** at 1440 and 390 px:
  - the Maps tab and the stash Maps tab list the groups;
  - the header shows Souls and the level bar;
  - there is no horizontal scroll at 390.
- [ ] **Step 5: Commit** with the message "Add Souls, the level bar, tabs and the maps list".

---

### Task 9: The map-run screen

**Files:**
- Create in `src/ui/run/`: `runView.ts`, `RunView.tsx`, `FightScene.tsx`, `RoomTrack.tsx`, `CombatLog.tsx`, `RunResultDialog.tsx`, `run.css`, plus `tests/ui/runView.test.ts`
- Modify: `src/ui/theme.css` (`gmCrit` keyframes), `src/ui/App.tsx`

**Interfaces:** as Task 7 of the shelved draft (`.superpowers/drafts/maps-combat-levels-draft.md`), with these changes:
- **No atlas sprites for monsters.** `FightScene` draws `PixelArt` from `monsterLook(state.seed, map.tier, queue[0])` at scale 8, times the look's `scale`, with its aura.
- **The floor comes from the dungeon type.** `fightTiles(floor, cols = 14, rows = 9)` returns `{ bg, edge }` per tile in row-major order. `bg` is `floor.shades[pick]`, where `pick` follows the pattern:

  | Pattern | `pick` |
  |---|---|
  | 0 (the mockup) | `(r·5 + c·11 + ((r·c) % 3)) % 3` |
  | 1 | `(r + c) % 2 === 0 ? 0 : 1 + (r % 2)` |
  | 2 | `((r + 2c) % 5 === 0) ? 2 : (r % 2)` |
  | 3 | `(c % 4 === 0 \|\| r % 3 === 0) ? 1 : 0` |

  `edge` is `rgba(0, 0, 0, 0.3)`.
- **`roomTrack(run, bossName)`:** labels run from `Room 1` to `Room <bossRoom − 1>`, then `Boss`. The Boss row's note is the dungeon's `bossName`.
- **The monster panel** shows the name, champion modifiers as small tags (Armored, Swift, …), `<life> / <max>`, and `Room <n> · enemy <i> of <k>`, or `Boss`.
- **`combatLineText`:** gains the `heal` line, `<monster> heals <n>`, with tone `hurt`.
- **The map header** shows the dungeon name, `T<tier>` and `found at <metre> m`.

- [ ] **Step 1: Write the failing tests:**
  - the draft's `roomTrack` cases, adapted to `bossRoom: 6` and a `bossName` argument;
  - the draft's `combatLineText` cases, plus `heal`;
  - `fightTiles` for pattern 0: `tiles[0].bg === shades[0]`, `tiles[1].bg === shades[2]` and length 126;
  - pattern 1: `tiles[0].bg === shades[0]`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run build`, then a puppeteer check** on desktop and at 390 px:
  - start a map;
  - the fight scene shows the generated monster on the dungeon floor;
  - life bars and floating numbers work;
  - a click adds a hit;
  - champions show their aura and tags;
  - the boss is drawn larger;
  - Leave map works and the result dialog appears;
  - there is no horizontal scroll at 390.
- [ ] **Step 5: Commit** with the message "Add the map-run screen with generated monsters and floors".

---

### Task 10: Offline report, README and the final check

**Files:** `src/ui/OfflineSummary.tsx`, `README.md`

- [ ] **Step 1: Implement:**
  - **OfflineSummary:** add the draft's map lines (`Maps: <cleared> cleared · <lost> lost`), and a Souls and levels line.
  - **README:** add a "Maps" section covering these points:
    - dungeon entrances become maps, kept in the Maps tab;
    - each world generates its own dungeons, monsters and bosses from its seed;
    - running a map pauses digging, and a click is an extra hit;
    - maps are the only source of XP and Souls;
    - dying or leaving loses the map but keeps what you earned.
- [ ] **Step 2: Run `npm test && npm run typecheck && npm run build`.**
- [ ] **Step 3: Smoke check** on desktop and at 390 px:
  - **First map:** a new world digs to the guaranteed map at 2 m, and `Maps (1)` appears.
  - **The run:**
    - The view switches and the panel goes to the Battle set.
    - Digging is paused.
    - Auto hits float, and a click adds a hit.
    - Crits are orange.
    - The room track advances to the boss.
  - **After the run:** the result dialog shows, the level bar and Souls update, the panel is back on Mining, and digging resumes.
  - **Leave early:** leaving a second map early loses the map and keeps the gains.
  - **Offline:** start a map, close the tab, and come back after a while. The summary shows the map result, and the miner is digging.
  - **Same seed:** two new worlds on `golden mole` give the map at 2 m the same dungeon name, rooms and boss.
  - **Old saves:** import the schema-4 fixture. Its 21 maps appear in 7 or fewer groups.
  - **Earlier plans:** the Plans 1–4 checks still pass.
- [ ] **Step 4: Commit,** only if changes were needed, with the message "Report maps offline and document them".
