# Plan 6: Economy and inventory, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Golden Miner earns only from veins and maps. Mined materials stack in one 60-cell bag and a Materials tab. The stash grows by pages. Maps are items. Deep hazards slow digging. The minimap becomes a scrollable history with no climbing.

**Architecture:**
- A new pure module, `src/core/layer.ts`, adds a second seeded roll per metre (material veins and hazards). It never touches `rollMetre`, so every seed keeps its chests, veins, gems and maps.
- Save schema 6 reshapes the inventory:
  - `bags` becomes one `bag`;
  - the General and Maps tabs become flat cell arrays, a whole number of 60-cell pages;
  - map and material items live in cells;
  - the gallery fields go.
- Behaviour moves into the existing core modules (`dig`, `inventory`, `loot`, `maps`, `combat`), and the UI follows.

**Tech stack:** TypeScript 7, React 19, Vite 8, Vitest 5, lz-string. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-round-3-economy-inventory-crafting-design.md`. This plan covers §3, §4 and the §7 rules that apply now. The prefix/suffix rework, crafting and map enchanting are Plan 7.

## Global Constraints

- **Node:** prefix every command with `export PATH=/root/.nvm/versions/node/v24.22.1/bin:$PATH`.
  - Tests: `npx vitest run`.
  - Types: `npx tsc --noEmit`.
  - Both must be clean at the end of every task.
- **Commits:** a plain imperative sentence, like the repo's ("Add the map-run screen with generated monsters and floors"). Never add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.
- **Fixtures:** `tests/fixtures/save-schema-1.txt` … `save-schema-5.txt` are real exports. Never regenerate or edit them. `save-schema-5.txt` comes from the current engine and covers:
  - deepest 1,786 m, standing in a gallery at 1,766 m;
  - both bags full (24 + 24, 7 gem stacks);
  - General full (60);
  - 73 maps;
  - 2 held items;
  - a map run in progress.
- **Seeds:** a seed must keep generating what it generates today. `rollMetre`, `fillAhead`, the dungeon and monster code and the RNG streams they use stay byte-for-byte the same. The new layer uses its own hash.
- **Anti-goals:** never punish absence. A hazard only slows digging; it never takes, destroys or permanently blocks anything.
- **Copy:** plain words, no jargon. Exact strings in this plan are copy. Use them verbatim.
- **Targets:** interactive targets are at least 40 px tall, like today's `gm-btn`.
- **Code style:** match the surrounding code: sparse comments that say why, `readonly` tables in `balance.ts`, exhaustive `switch` over unions.
- **README:** each task that changes play updates its README paragraph, in the README's existing voice.

## Review Focus

1. **Loading an old save mid-run.** A schema-5 save with a map running, held items and both bags full loads into one bag. The run continues, no item or map is lost, and every id stays unique. The Task 2 fixture test covers this.
2. **A full Maps tab.** With every Maps page full, a found map replaces the lowest-tier, oldest map in the tab. Maps the player carries in the bag are never dropped. A new map below every tab map is not kept. Task 2 tests this.
3. **Featured metres.** A metre whose seeded roll has a feature never yields a material vein. A material-vein metre still counts as empty for find-gear bonus finds, so both can drop on one metre. Task 4 tests both.
4. **Idle digging must not clog the bag with materials.** Found materials top up the bag stack of their kind and open at most one new stack per kind. The rest goes to the Materials tab, so at most 8 bag cells ever fill with materials on their own. Task 3 tests this.
5. **The minimap must not yank the view.** After the player scrolls away from the face, new metres do not scroll the minimap back. Only "Jump to the dig face" (or scrolling back to the face) resumes following. Task 8 tests this through `isFollowing`.

## Decisions this plan makes (my calls, for Ernest to check)

- **Found maps go to the Maps tab,** at the first empty cell on any page, not into the bag. The full-tab rule above applies to the tab only.
- **Found materials** (veins and map drops) use the bag-then-tab rule in Review Focus 4.
- **Salvage puts its materials straight into the Materials tab,** never into the bag.
- **Materials and maps cannot be sold or salvaged in Plan 6.** There is no discard action yet. A full bag clears by moving them to their tabs.
- **Material-vein amounts are seeded.** Hazards slow a metre by gas ×2 or unstable rock ×1.6, and the hazard ward stat cuts the extra, up to 75 %.
- **The gold vein amount** becomes `round((200 + 110 × tier) × (0.8 + 0.4u))`. Per metre this matches today's per-tick Gold plus veins, within about 2 % from tier 4 up. Diamond vein amounts are unchanged, so Diamonds get scarcer, as the spec wants.
- **Map material drops:** each kill rolls `MAP_MATERIAL_CHANCE` (0.25) once per reward rank (1, 3 or 5 times). Each success is one stack picked at the map's own metre, so a tier-7 map (found below 1,000 m) can drop Void crystals.
- **The speed counter** shows the current dig-face metre's rate. While a map runs, or held loot stops digging, it says "Digging paused".

---

### Task 1: The seeded layer, with materials and hazards

**Files:**
- Create: `src/core/layer.ts`
- Modify: `src/core/items.ts` (materials), `src/core/types.ts` (hazards), `src/core/balance.ts`
- Test: `tests/core/layer.test.ts`

**Interfaces:**
- Produces, in `items.ts`:
  - `MATERIALS = ['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal'] as const`;
  - `type Material`.
- Produces, in `types.ts`:
  - `HAZARDS = ['gas', 'unstable'] as const`;
  - `type Hazard`.
- Produces, in `balance.ts`:
  - `MATERIAL_TABLE: Readonly<Record<Material, { from: number; weight: number; amount: number }>>`, exactly:

    | Material | from | weight | amount |
    |---|---|---|---|
    | copper | 0 | 40 | 4 |
    | tin | 0 | 30 | 3 |
    | iron | 50 | 20 | 3 |
    | silver | 150 | 12 | 2 |
    | mithril | 300 | 8 | 2 |
    | starsteel | 450 | 5 | 1 |
    | obsidian | 700 | 3 | 1 |
    | voidCrystal | 1000 | 1 | 1 |

  - `MATERIAL_VEIN_CHANCE = 0.3`;
  - `MATERIAL_RAMP_METRES = 500`;
  - `MATERIAL_RAMP_CAP = 3`;
  - `LAYER_SALT = 0x1a7e2`;
  - `HAZARD_START_METRE = 300`;
  - `hazardChance(metre: number): number` = `metre <= 300 ? 0 : Math.min(0.25, 0.05 + (metre - 300) / 20_000)`;
  - `HAZARD_SLOW: Readonly<Record<Hazard, number>> = { gas: 2, unstable: 1.6 }`;
  - `MAX_HAZARD_WARD = 75`.
- Produces, in `layer.ts`:
  - `interface MetreLayer { vein: { material: Material; amount: number } | null; hazard: Hazard | null }`;
  - `metreLayer(seed: number, metre: number): MetreLayer`;
  - `materialWeights(metre: number): Record<Material, number>`;
  - `pickMaterial(metre: number, u: number): Material`;
  - `materialAmount(material: Material, metre: number, u: number): number`;
  - `hazardFactor(hazard: Hazard | null, ward: number): number`.

- [ ] **Step 1: Write the failing tests** in `tests/core/layer.test.ts`:

```ts
it('the layer is a pure function of seed and metre', () => {
  expect(metreLayer(77, 412)).toEqual(metreLayer(77, 412));
  const differs = Array.from({ length: 200 }, (_, m) => m + 1)
    .some((m) => JSON.stringify(metreLayer(1, m)) !== JSON.stringify(metreLayer(2, m)));
  expect(differs).toBe(true);
});
it('no material is found at or above its first depth', () => {
  for (let seed = 1; seed <= 20; seed++) for (let m = 1; m <= 1200; m++) {
    const v = metreLayer(seed, m).vein;
    if (v) expect(m).toBeGreaterThan(MATERIAL_TABLE[v.material].from);
  }
});
it('veins sit on about MATERIAL_VEIN_CHANCE of metres', () => {
  let n = 0;
  for (let m = 1; m <= 10_000; m++) if (metreLayer(9, m).vein) n++;
  expect(Math.abs(n / 10_000 - MATERIAL_VEIN_CHANCE)).toBeLessThan(0.02);
});
it('void crystals turn up below 1,000 m, and deeper favours them', () => {
  let found = false;
  for (let seed = 1; seed <= 50 && !found; seed++) for (let m = 1001; m <= 1600; m++) {
    if (metreLayer(seed, m).vein?.material === 'voidCrystal') { found = true; break; }
  }
  expect(found).toBe(true);
  const share = (m: number) => { const w = materialWeights(m); return w.voidCrystal / Object.values(w).reduce((a, b) => a + b, 0); };
  expect(share(1600)).toBeGreaterThan(share(1100));
  expect(materialWeights(1000).voidCrystal).toBe(0);
  expect(materialWeights(1).copper).toBeCloseTo(40.08);   // 40 × (1 + 1/500)
});
it('pickMaterial and materialAmount', () => {
  expect(pickMaterial(10, 0)).toBe('copper');
  expect(pickMaterial(10, 0.999)).toBe('tin');           // only copper and tin above 50 m
  for (const mat of MATERIALS) {
    const a = materialAmount(mat, 1500, 0.5);
    expect(Number.isInteger(a) && a >= 1).toBe(true);
  }
  expect(materialAmount('copper', 10, 0.5)).toBe(4);     // tier 1: 4 × (1 + 0) × 1.0
  expect(materialAmount('copper', 1100, 0.5)).toBe(8);   // tier 7: 4 × (1 + floor(7/4)) × 1.0
});
it('no hazards above Granite Veins; more of them deeper', () => {
  for (let seed = 1; seed <= 20; seed++) for (let m = 1; m <= 300; m++) expect(metreLayer(seed, m).hazard).toBeNull();
  const rate = (from: number) => { let n = 0; for (let m = from; m < from + 2000; m++) if (metreLayer(5, m).hazard) n++; return n / 2000; };
  expect(rate(301)).toBeLessThan(rate(5000));
});
it('hazardFactor', () => {
  expect(hazardFactor(null, 0)).toBe(1);
  expect(hazardFactor('gas', 0)).toBe(2);
  expect(hazardFactor('gas', 50)).toBe(1.5);
  expect(hazardFactor('unstable', 0)).toBeCloseTo(1.6);
  expect(hazardFactor('gas', 200)).toBe(1.25);            // ward capped at MAX_HAZARD_WARD
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core/layer.test.ts`.
  - Expected: FAIL, because `../../src/core/layer` cannot be resolved.

- [ ] **Step 3: Implement the layer.**
  - **`metreLayer`** seeds `mulberry32` from `hash2(hash2(seed, LAYER_SALT), metre)`. It always draws five values in this order, so each field is independent of the others:
    1. `u1 < MATERIAL_VEIN_CHANCE`: a vein exists;
    2. `u2` picks the material;
    3. `u3` gives the amount;
    4. `u4 < hazardChance(metre)`: a hazard exists;
    5. `u5 < 0.5` → `'gas'`, otherwise `'unstable'`.
  - **`materialWeights(metre)`:** for each material, `0` when `metre <= from`, otherwise `weight × Math.min(MATERIAL_RAMP_CAP, 1 + (metre - from) / MATERIAL_RAMP_METRES)`.
  - **`pickMaterial`** walks the cumulative weights in `MATERIALS` order.
  - **`materialAmount(material, metre, u)`** = `Math.max(1, Math.round(amount × (1 + Math.floor(metreTier(metre) / 4)) × (0.8 + 0.4u)))`.
  - **`hazardFactor`** = `1 + (HAZARD_SLOW[h] - 1) × (1 - Math.min(ward, MAX_HAZARD_WARD) / 100)`, and `1` for `null`.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run tests/core/layer.test.ts && npx tsc --noEmit`.
  - Expected: PASS, with no type errors.

- [ ] **Step 5: Commit.**
  - Run: `git add src/core/layer.ts src/core/items.ts src/core/types.ts src/core/balance.ts tests/core/layer.test.ts`.
  - Run: `git commit -m "Add the seeded layer of material veins and hazards"`.

---

### Task 2: Schema 6, with one bag, stash pages, maps in cells and no galleries

The structural task. Every compile site changes in this one commit, so the game keeps loading and running. Materials get their types and validation here; their behaviour is Task 3. Maps get cells and moves here; their card actions are Task 6.

**Files:**
- Modify (core): `src/core/items.ts`, `src/core/types.ts`, `src/core/balance.ts`, `src/core/cells.ts`, `src/core/newGame.ts`, `src/core/save.ts`, `src/core/inventory.ts`, `src/core/loot.ts`, `src/core/maps.ts`, `src/core/dig.ts`, `src/core/metres.ts`, `src/core/summary.ts`, `src/core/itemData.ts`.
- Modify (store): `src/store/gameStore.ts`.
- Modify (UI):
  - `src/ui/character/{CharacterPanel,StashDialog,ItemGrid,dragDrop,itemActions,itemView,stashView}.ts(x)`;
  - `src/ui/maps/{MapList,MapsView}.tsx`;
  - `src/ui/mine/{MineView,Minimap,minimap}.ts(x)`;
  - `src/ui/Header.tsx`, `src/ui/OfflineSummary.tsx`;
  - `README.md`.
- Test: `tests/core/save.test.ts`, `tests/core/inventory.test.ts`, `tests/core/maps.test.ts`, `tests/core/loot.test.ts`. Update every other test that used `bags`, `depth`, `galleryProgress`, `goldCarry`, `moveTo`, `STASH_SIZE` or `MAP_STASH_SIZE`.

**Interfaces:**
- **`items.ts`:**
  - `MapItem` moves here: `{ id: number; type: 'map'; tier: number; metre: number }`. `types.ts` re-exports it.
  - `interface MaterialItem { id: number; type: 'material'; material: Material; count: number }`.
  - `type Item = GearItem | GemItem | MaterialItem | MapItem`.
  - `type Stack = GemItem | MaterialItem`.
  - `isStack(item: Item): item is Stack`, `isMap(item: Item): item is MapItem`. `isGear` is unchanged.
- **`balance.ts`:**
  - `BAG_SIZE = 60`;
  - `STASH_PAGE_SIZE = 60`, which replaces `STASH_SIZE`;
  - `START_GENERAL_PAGES = 2`, `START_MAP_PAGES = 1`;
  - `MAX_STASH_PAGES = 1000`;
  - `MATERIAL_BAG_STACK = 50`, `MATERIAL_STASH_STACK = 1_000_000`;
  - remove `MAP_STASH_SIZE`.
- **`types.ts`, `GameState`:**
  - **Removed:** `depth`, `galleryProgress`, `goldCarry` and `bags`.
  - **Added:**

    ```ts
    bag: Cell[];                               // exactly BAG_SIZE: gear of either set, gem stacks 1..GEM_BAG_STACK, material stacks 1..MATERIAL_BAG_STACK, maps
    stash: {
      general: (GearItem | null)[];            // STASH_PAGE_SIZE × pages, START_GENERAL_PAGES..MAX_STASH_PAGES pages
      gems: Record<GemType, Record<GemGrade, number>>;
      maps: (MapItem | null)[];                // STASH_PAGE_SIZE × pages, START_MAP_PAGES..MAX_STASH_PAGES pages
      materials: Record<Material, number>;     // 0..MATERIAL_STASH_STACK each
      bought: { general: number; maps: number };   // pages bought with Gold (Task 6); free pages never count
    };
    overflow: GearItem[];
    ```

- **`types.ts`, other types:**
  - `ItemLoc`:

    ```ts
    | { where: 'bag'; index: number }
    | { where: 'stash'; index: number }            // a General cell, any page
    | { where: 'maps'; index: number }             // a Maps-tab cell, any page
    | { where: 'gems'; gem: GemType; grade: GemGrade }
    | { where: 'materials'; material: Material }   // a Materials-tab stack (virtual, id 0, while its count > 0)
    | { where: 'worn'; slot: Slot }
    ```

  - `DropTarget`'s tab becomes `'general' | 'gems' | 'maps' | 'materials' | 'auto'`.
  - `InvResult` gains `'mapsOnly' | 'materialsOnly' | 'busy'`.
  - `FIND_KINDS = [...FEATURE_KINDS, 'materialVein'] as const`, `type FindKind`.
  - `FindRecord.kind: FindKind`, plus `material?: Material`, which is set exactly when the kind is `'materialVein'`.
  - The `TickEvent` `'metre'` loses `gallery`.
  - `OfflineSummary.stoppedBag` becomes `bagStopped: boolean`, and `finds` becomes `Record<FindKind, number>`.
- **`cells.ts`:**
  - `emptyMaterialCounts(): Record<Material, number>`;
  - `emptyInventory()` returns the new shape;
  - `pageCount(cells: readonly unknown[]): number` = `cells.length / STASH_PAGE_SIZE`;
  - `itemAt` and `sameLoc` cover `'maps'` and `'materials'`.
- **`inventory.ts`:**
  - `sendItem(state, from, to: 'stash' | 'bag')`;
  - `equip`, `unequip`, `moveItem`, `dropItem` and `socketGem` keep their signatures.
- **`loot.ts`:** `receiveItem(state: GameState, item: GearItem | GemItem): LootNote[]`. The `gemBag` parameter goes.
- **`maps.ts`:**
  - `addMap(state, tier, metre): MapItem`;
  - `startMap(state, mapId): 'ok' | 'busy' | 'invalid'`. It finds the map in the bag or the Maps tab.
- **`dig.ts`:** `moveTo` and the gallery code are removed.
- **`gameStore.ts`:**
  - `moveTo` is removed;
  - `sendItem(from, to: 'stash' | 'bag')`.
- **`save.ts`:** `SCHEMA_VERSION = 6`, with `MIGRATIONS[5]`.

- [ ] **Step 1: Write the failing save tests** in `tests/core/save.test.ts`. Import `fixture5 from '../fixtures/save-schema-5.txt?raw'` and `decompressFromBase64` from `lz-string`.

```ts
it('the schema-5 fixture migrates to one bag, stash pages and map cells', () => {
  const raw = JSON.parse(decompressFromBase64(fixture5.trim())).state;
  const r = decodeSave(fixture5.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  const carried = [...raw.bags.mining, ...raw.bags.battle].filter((c: unknown) => c !== null);
  expect(s.bag).toHaveLength(BAG_SIZE);
  expect(s.bag.slice(0, carried.length)).toEqual(carried);                  // mining bag first, then battle, in order
  expect(s.bag.slice(carried.length).every((c) => c === null)).toBe(true);
  expect(s.stash.general).toHaveLength(START_GENERAL_PAGES * STASH_PAGE_SIZE);
  expect(s.stash.general.slice(0, 60)).toEqual(raw.stash.general);
  expect(s.stash.maps).toHaveLength(2 * STASH_PAGE_SIZE);                   // 73 maps fill two pages
  expect(s.stash.maps.filter((m) => m !== null)).toEqual(raw.stash.maps);
  expect(Object.values(s.stash.materials).every((n) => n === 0)).toBe(true);
  expect(s.stash.bought).toEqual({ general: 0, maps: 0 });
  expect(s.overflow).toEqual(raw.overflow.map((h: { item: unknown }) => h.item));
  expect(s.activity.kind).toBe('map');                                       // the run carries on
  for (const gone of ['depth', 'galleryProgress', 'goldCarry', 'bags']) expect(gone in s).toBe(false);
  expect(s.deepest).toBe(raw.deepest);
});
it('every older fixture still loads', () => {
  for (const f of [fixture, fixture2, fixture3, fixture4]) expect(decodeSave(f.trim()).ok).toBe(true);
});
it('the validator holds the schema-6 shape', () => {
  const ok = newGame(3, 0);
  const bad = (change: (s: any) => void) => { const s = structuredClone(ok) as any; change(s); return validateState(s); };
  expect(validateState(ok)).toBe(true);
  expect(bad((s) => s.bag.pop())).toBe(false);                                         // 59 cells
  expect(bad((s) => { s.stash.general = s.stash.general.slice(0, 90); })).toBe(false);  // not whole pages
  expect(bad((s) => { s.stash.general = s.stash.general.slice(0, 60); })).toBe(false);  // fewer than 2 pages
  expect(bad((s) => { s.stash.maps[0] = gear(s, 'pickaxe'); })).toBe(false);            // gear in the Maps tab
  expect(bad((s) => { s.stash.general[0] = { id: s.nextId++, type: 'map', tier: 1, metre: 2 }; })).toBe(false);
  expect(bad((s) => { s.bag[0] = { id: s.nextId++, type: 'material', material: 'copper', count: 51 }; })).toBe(false);
  expect(bad((s) => { s.stash.materials.copper = 1_000_001; })).toBe(false);
  expect(bad((s) => { const m = { id: s.nextId++, type: 'map', tier: 1, metre: 2 }; s.bag[0] = m; s.stash.maps[0] = { ...m }; })).toBe(false); // duplicate id
  expect(bad((s) => { s.stash.bought.maps = 2; })).toBe(false);                          // more bought than the 1 page held
  expect(bad((s) => { s.finds.push({ id: s.nextId++, depth: 1, kind: 'materialVein', amount: 3, tick: 0 }); })).toBe(false); // no material
});
it('a new game starts with one bag of 60, two General pages and one Maps page', () => {
  const s = newGame(1, 0);
  expect([s.bag.length, s.stash.general.length, s.stash.maps.length]).toEqual([60, 120, 60]);
});
```

- [ ] **Step 2: Write the failing inventory, loot and maps tests.** Rewrite the existing tests in `tests/core/inventory.test.ts`, `loot.test.ts` and `maps.test.ts` for `state.bag` and `{ where: 'bag', index }`. Add these tests:
  - **`gear of either set lives in the one bag`:** `bag[0]` is a pickaxe and `bag[1]` a weapon. `equip` returns `'ok'` for both, and `s.equipped.mining.pickaxe` and `s.equipped.battle.weapon` are set.
  - **`unequip goes to the first empty bag cell`:** it returns `'bagFull'` when all 60 cells are full.
  - **`the stash shortcut fills the next General page`:** with General cells 0–59 full, `sendItem(s, bagLoc(0), 'stash')` returns `'ok'`, the item is at General index 60, and `sendItem` from General to `'bag'` puts it in the first empty bag cell.
  - **`found gear fills the bag, then General pages in order`:** with the bag full and General 0–59 full, `receiveItem` puts gear at General index 60, and the note's outcome is `'stash'`.
  - **`sell-the-worst looks at the bag and every General page`:** the worst item sits at General index 100 and gets sold.
  - **`a found map takes the first empty Maps-tab cell`:** `addMap(s, 3, 120)` puts it at `stash.maps[0]`; the next at `[1]`.
  - **`a full Maps tab drops its lowest-tier, oldest map, never one in the bag`:**
    - fill all 60 tab cells with tier-3 maps, except index 7, which is tier 2;
    - put a tier-1 map in `bag[0]`;
    - `addMap(s, 3, 500)` replaces index 7, and `bag[0]` is untouched;
    - `addMap(s, 2, 500)` with every tab map at tier 3 is not kept, though its id is still used.
  - **`maps run from the bag or the Maps tab`:**
    - `startMap(s, mapInBag.id)` returns `'ok'` and empties that bag cell;
    - `startMap` on a map in the Maps tab empties that cell;
    - an unknown id returns `'invalid'`;
    - while running, it returns `'busy'`.
  - **`maps live in the bag and the Maps tab only`:**
    - `moveItem` of a map to a General cell returns `'gearOnly'`;
    - gear to a Maps cell returns `'mapsOnly'`;
    - a map from `bag[0]` to `{ where: 'maps', index: 5 }` returns `'ok'`;
    - `dropItem` of a bag map on `{ where: 'stashTab', tab: 'maps' }` lands in the first empty Maps cell.
  - **`digging only works the face`** (in `tests/core/dig.test.ts`): after `applyTicks`, `deepest` grows and the state has no `depth` key.

- [ ] **Step 3: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core`.
  - Expected: FAIL, on the missing `bag`, `BAG_SIZE` mismatch and the missing migration.

- [ ] **Step 4: Implement the shape, the migration and the validator.**
  - **`MIGRATIONS[5]`** turns a schema-5 state into schema 6:
    - `bag`: the mining bag's non-null cells, then the battle bag's, padded with `null` to 60. Valid schema-5 bags hold at most 48 items.
    - `general`: the 60 cells, padded to `START_GENERAL_PAGES × 60`.
    - `maps`: the maps in order, padded to `max(START_MAP_PAGES, ceil(n / 60)) × 60`.
    - `materials`: `emptyMaterialCounts()`.
    - `bought`: `{ general: 0, maps: 0 }`.
    - `overflow`: each held entry becomes `held.item`.
    - Drop `depth`, `galleryProgress`, `goldCarry` and `bags`.
    - Anything malformed returns the state unchanged, so the validator rejects it, as the earlier migrations do.
  - **The validator checks:**
    - the bag is exactly 60 cells;
    - each tab is a whole number of pages, at least the starting count and at most `MAX_STASH_PAGES`;
    - General holds gear only, and Maps holds map items only;
    - bag cells are gear, gem stacks `1..GEM_BAG_STACK`, material stacks `1..MATERIAL_BAG_STACK` with a known material, or maps (`isMapItem`);
    - material counts are integers `0..MATERIAL_STASH_STACK`;
    - `0 <= bought.x <= pageCount(tab)`;
    - overflow holds at most `MAX_OVERFLOW` gear;
    - find kinds are in `FIND_KINDS`, and `material` is a known material exactly when the kind is `'materialVein'`;
    - ids are unique across the bag, every tab cell, the worn gear, overflow and the running map (the shared `seen` set).
- [ ] **Step 5: Implement one bag in the core.**
  - **`inventory.ts`:**
    - `fits` allows gear of any set in the bag;
    - General takes gear only (`'gearOnly'`), Maps takes maps only (`'mapsOnly'`), and Gems takes gems only (`'gemsOnly'`);
    - `inGrid` uses the cell array's own length for `'stash'` and `'maps'`;
    - `unequip` and `sendItem(…, 'bag')` use the bag's first empty cell;
    - the `'stash'` shortcut sends a map to the first empty Maps cell (`'stashFull'` when none);
    - `dropItem` on `stashTab 'maps'` does the same;
    - moves that involve materials return `'invalid'` until Task 3.
  - **`loot.ts`:** `stowGear` fills the bag, then General in index order. `sellWorst` scans the bag and every General cell. Overflow holds plain `GearItem`s.
  - **`maps.ts`:** `addMap` writes the first empty Maps cell, and when there is none it applies the Plan 5 rule over the tab's cells. `startMap` looks in the bag, then the tab, and empties the cell.
  - **`dig.ts`:** delete `digGallery` and `moveTo`. `applyTicks` always digs the face. Delete `rollGallery` from `metres.ts`.
  - **`summary.ts`:** `bagStopped: after.overflow.length > 0`; count `finds` over `FIND_KINDS`.
- [ ] **Step 6: Make the UI compile and behave with one bag.**
  - **`CharacterPanel`** shows one grid, `state.bag`, under the heading "Bag 41 / 60" (`Bag ${filled} / ${BAG_SIZE}`). The Mining/Battle toggle switches only the paper doll and its stat line.
  - **`StashDialog`** shows the one bag (no bag toggle) and the General cells of page 1 only. Page buttons come in Task 6.
  - **The Maps tab** keeps the `MapList` for now, fed from the non-null Maps cells.
  - **`dragDrop.parseDrop`** accepts `bag {index}` (`< BAG_SIZE`), `stash {index}`, `maps {index}` and `materials {material}` (non-negative integer indexes), and the five tab names.
  - **`itemActions`:**
    - `'toBag'` and `'take'` go to `'bag'`;
    - "That gear belongs in the other bag." is deleted with `'wrongSet'`. Remove `'wrongSet'` from `InvResult` too;
    - new texts: `mapsOnly` "Only maps go in the Maps tab.", `materialsOnly` "Only materials go in the Materials tab.", `busy` "Leave the current map first.";
    - a map or material item has no actions yet (`[]`).
  - **`itemView`:**
    - `rarityOf` returns `'map'` or `'material'` for those items;
    - `itemKindLine` gives "Tier 4 map" for a map;
    - `itemLines` gives "Found at 327 m";
    - `itemSprite` gives `'map'`;
    - `itemName` (`itemData.ts`) gives "Tier 4 map".
  - **`ItemGrid`** shows a map's sprite with a `T4` badge (class `gm-item__tier`).
  - **`MineView`** drops the gallery wording; the caption is `Dig face at ${deepest} m · tier N`. **`Header`** shows `state.deepest`.
  - **`Minimap`** loses its click and key handlers and the climbing caption. The strip becomes a plain `<div role="img" aria-label="Minimap of finds by depth">`; Task 8 rebuilds it. `minimapModel` uses `deepest`.
  - **The banner** reads "Your bag and the stash are full, so digging has stopped. Sell or salvage something to carry on."
  - **`OfflineSummary`** uses `bagStopped`.
- [ ] **Step 7: Update the README.**
  - Edit the inventory paragraph: one bag of 60 holds every item, the paper doll switches between mining and battle gear, and the stash has General pages.
  - Remove the gallery sentence from the seed paragraph ("gallery finds").
  - Say found maps go to the Maps tab.

- [ ] **Step 8: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS, with no type errors.
- [ ] **Step 9: Commit.**
  - Run: `git add -A src tests README.md`.
  - Run: `git commit -m "Merge the two bags into one, page the stash and keep maps in cells"`.

---

### Task 3: Materials as stackable items

**Files:**
- Modify: `src/core/inventory.ts`, `src/core/loot.ts`, `src/core/balance.ts`, `src/core/itemData.ts`, `src/sprites/grids.ts`.
- Modify (UI): `src/ui/character/{itemActions,itemView,ItemGrid,stashView,StashDialog}.ts(x)`, `src/ui/character/lootFilterView.ts` (labels only, if any).
- Create: `src/ui/character/MaterialTab.tsx`.
- Test: `tests/core/materials.test.ts`, `tests/core/loot.test.ts`, `tests/ui/itemActions.test.ts`, `tests/ui/stashView.test.ts`.

**Interfaces:**
- Consumes `MaterialItem`, `Stack`, `isStack`, `MATERIAL_BAG_STACK`, `MATERIAL_STASH_STACK` and `ItemLoc 'materials'` from Task 2.
- Produces, in `loot.ts`:
  - `receiveMaterial(state: GameState, material: Material, count: number): LootNote[]`;
  - `salvageYield(item: Item): Partial<Record<Material, number>>`.
- Produces, in `balance.ts`: `SALVAGE_MATERIALS: Readonly<Record<Rarity, Partial<Record<Material, number>>>>`, exactly:

  ```ts
  { normal: { copper: 1 }, magic: { copper: 2, tin: 1 }, rare: { copper: 3, tin: 2, iron: 1 }, legendary: { tin: 3, iron: 3, silver: 1 } }
  ```

  `GEM_SALVAGE_TIN = 1`. Remove `SALVAGE_DIAMONDS` and `GEM_SALVAGE_DIAMONDS`.
- Produces, in `itemData.ts`: `MATERIAL_LABELS: Readonly<Record<Material, string>>`, exactly:

  ```ts
  { copper: 'Copper ore', tin: 'Tin ore', iron: 'Iron ore', silver: 'Silver ore', mithril: 'Mithril', starsteel: 'Starsteel', obsidian: 'Obsidian shard', voidCrystal: 'Void crystal' }
  ```

- `LootNote.rarity` gains `'material'`, and `LootNote.base` gains `Material`. For `'salvaged'`, `value` is the number of material units gained.
- `STASH_TABS = ['general', 'gems', 'maps', 'materials']`.

- [ ] **Step 1: Write the failing tests** in `tests/core/materials.test.ts`:

```ts
it('a found material tops up its bag stack, opens at most one stack, then joins the tab', () => {
  const s = newGame(1, 0);
  receiveMaterial(s, 'copper', 30);
  expect(s.bag[0]).toMatchObject({ type: 'material', material: 'copper', count: 30 });
  receiveMaterial(s, 'copper', 30);
  expect([s.bag[0]?.type === 'material' && s.bag[0].count, s.stash.materials.copper]).toEqual([50, 10]);
  receiveMaterial(s, 'copper', 5);                       // the bag already has a copper stack: no second one
  expect([s.bag.filter((c) => c !== null).length, s.stash.materials.copper]).toEqual([1, 15]);
  receiveMaterial(s, 'tin', 2);
  expect(s.bag[1]).toMatchObject({ material: 'tin', count: 2 });
});
it('a full bag sends found materials to the tab; past the cap they are lost', () => {
  const s = newGame(1, 0);
  for (let i = 0; i < BAG_SIZE; i++) s.bag[i] = gear(s, 'pickaxe');
  s.stash.materials.iron = MATERIAL_STASH_STACK - 3;
  const notes = receiveMaterial(s, 'iron', 10);
  expect(s.stash.materials.iron).toBe(MATERIAL_STASH_STACK);
  expect(notes[0]).toMatchObject({ rarity: 'material', base: 'iron', outcome: 'stash' });
});
it('material stacks move, merge, swap and come out of the tab', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'tin', count: 40 };
  s.bag[1] = { id: s.nextId++, type: 'material', material: 'tin', count: 30 };
  expect(moveItem(s, bagLoc(1), bagLoc(0))).toBe('ok');
  expect([(s.bag[0] as MaterialItem).count, (s.bag[1] as MaterialItem).count]).toEqual([50, 20]);
  expect(moveItem(s, bagLoc(1), { where: 'materials', material: 'tin' })).toBe('ok');
  expect([s.bag[1], s.stash.materials.tin]).toEqual([null, 20]);
  expect(moveItem(s, bagLoc(0), { where: 'materials', material: 'iron' })).toBe('invalid');   // its own slot only
  s.stash.materials.silver = 120;
  expect(sendItem(s, { where: 'materials', material: 'silver' }, 'bag')).toBe('ok');
  expect(s.stash.materials.silver).toBe(70);                                                    // up to 50 taken
  expect(moveItem(s, bagLoc(0), { where: 'stash', index: 0 })).toBe('gearOnly');
  expect(moveItem(s, bagLoc(0), { where: 'gems', gem: 'ruby', grade: 'tiny' })).toBe('gemsOnly');
  s.bag[5] = gem(s);
  expect(moveItem(s, bagLoc(5), { where: 'materials', material: 'tin' })).toBe('materialsOnly');
});
it('salvage gives low-tier materials to the Materials tab, never Diamonds', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4 });
  s.bag[1] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 10, sockets: 1, gems: [{ gem: 'ruby', grade: 'tiny' }] });
  s.bag[2] = gem(s, 'ruby', { count: 4 });
  expect(salvageYield(s.bag[0]!)).toEqual({ copper: 3, tin: 2, iron: 1 });
  expect(salvageYield(s.bag[1]!)).toEqual({ copper: 9, tin: 7, iron: 3 });      // ×3 at ilvl 10, plus 1 tin for the gem
  expect(salvageYield(s.bag[2]!)).toEqual({ tin: 4 });
  expect(salvage(s, bagLoc(0))).toBe('ok');
  expect([s.stash.materials.copper, s.diamonds, s.bag[0]]).toEqual([3, 0, null]);
  s.bag[3] = { id: s.nextId++, type: 'material', material: 'tin', count: 5 };
  expect(salvage(s, bagLoc(3))).toBe('invalid');
});
it('the loot filter salvages into materials and notes the units', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [{ rarity: 'any', target: 'any', action: 'salvage' }];
  const notes = receiveItem(s, gear(s, 'boots', { rarity: 'magic', ilvl: 4 }));
  expect(notes[0]).toMatchObject({ outcome: 'salvaged', value: 3 });
  expect([s.stash.materials.copper, s.stash.materials.tin, s.diamonds]).toEqual([2, 1, 0]);
});
```

  Add these to `tests/ui/itemActions.test.ts`:
  - A bag copper stack's action labels are `['To Materials tab']`.
  - A Materials-tab stack's labels are `['Take to bag (up to 50)']`.
  - Rare ilvl-4 gear in the bag has a salvage label of exactly `Salvage (+3 Copper ore, +2 Tin ore, +1 Iron ore)`.
  - `lootNoteText` of a salvaged note with value 3 contains `salvaged into 3 materials`.

  Add this to `tests/ui/stashView.test.ts`: `materialTabCells(state)` returns 8 cells in `MATERIALS` order, with `{ material, label, count, text }`, where `text` is `formatCompact(count)`, or `''` at 0.

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core/materials.test.ts tests/ui/itemActions.test.ts tests/ui/stashView.test.ts`.
  - Expected: FAIL, because `receiveMaterial` is not exported.
- [ ] **Step 3: Implement the stacks.** Generalise the gem stack helpers in `inventory.ts` to `Stack`:
  - `sameStack(a, b)`: same type, and the same gem and grade, or the same material;
  - `bagStackCap(item)`: `GEM_BAG_STACK` for gems, `MATERIAL_BAG_STACK` for materials;
  - `tabCount` and `addToTab` read and write the gem or material count;
  - put, take, merge and the virtual `'materials'` location then work like the Gems tab;
  - `'materials'` takes only a material, and only into its own slot.
- [ ] **Step 4: Implement `receiveMaterial` and the new salvage** in `loot.ts`, as the tests and Review Focus 4 fix.
  - **`receiveMaterial`** returns one note, for where the first unit went: `'bag'` or `'stash'`. When everything was lost, it notes `'stash'` with the tab already at its cap.
  - **`salvageYield(gear)`** = `SALVAGE_MATERIALS[rarity] × tierFactor(ilvl)` per material, plus `GEM_SALVAGE_TIN × tierFactor(GEM_GRADE_LEVEL[grade])` tin per socketed gem.
  - **`salvageYield(gem stack)`** = `GEM_SALVAGE_TIN × tierFactor(level) × count` tin.
  - **Maps and materials** yield `{}`, and salvaging them returns `'invalid'`.
  - **Salvage, the loot filter and `drainOverflow`** add the yield to the Materials tab, capped.
- [ ] **Step 5: Add the UI for materials.**
  - **Sprites:** one sprite per material in `grids.ts`, named after the material (`copper` … `voidCrystal`), following how the gem types each have a sprite:
    - an ore-lump shape for copper, tin, iron, silver, mithril and starsteel, each in its own palette (copper orange, tin pale grey, iron dark grey, silver white, mithril teal, starsteel pale blue);
    - a shard shape for obsidian (near black) and voidCrystal (violet).
  - **`itemView`:**
    - `rarityOf` returns `'material'`;
    - the kind line is "Crafting material";
    - the lines are "First found below N m" (`MATERIAL_TABLE.from`; copper and tin say "Found at every depth") and "Kept for crafting.";
    - `itemSprite` is the material's sprite;
    - `itemName` is the label.
  - **`ItemGrid`** shows the count like a gem stack.
  - **`itemActions`:**
    - a bag stack: `To Materials tab` (`toStash`; disabled at the cap);
    - a tab stack: `Take to bag (up to 50)` (`take`);
    - Shift+click moves it, and a plain click opens the card;
    - the hover notes are "Click for actions · Shift+click to the Materials tab" and "Click to take up to 50 · right-click for more";
    - the salvage label lists the yield in `MATERIALS` order as `+N Label`, joined with ", ".
  - **`MaterialTab.tsx`** is like `GemTab`: one cell per material in a row of 8, each a drop target `{ where: 'materials', material }`.
  - **`StashDialog`** adds the Materials tab, labelled "Materials".
  - **`lootNoteText`** gives `salvaged into ${plural(value, 'material', 'materials')}`. A material note reads like a gem note: `${label} ×${count}` in the bag or the stash.
- [ ] **Step 6: Update the README.** Salvage now gives crafting materials (Copper and Tin ore, and more for better items) instead of Diamonds. Materials stack 50 to a bag cell and without limit in the Materials tab.
- [ ] **Step 7: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
- [ ] **Step 8: Commit.** Run: `git commit -am "Add crafting materials as stacks, with a Materials tab and salvage into materials"`. Use `git add` for the new files first.

---

### Task 4: Veins-only income, material veins and map material drops

**Files:**
- Modify: `src/core/dig.ts`, `src/core/balance.ts`, `src/core/combat.ts`, `src/core/summary.ts`.
- Modify (UI): `src/ui/mine/{FindsFeed,particles,ShaftScene}.ts(x)`, `src/ui/OfflineSummary.tsx`, `src/ui/run/runView.ts` (loot note text if it switches on rarity), `README.md`.
- Test: `tests/core/dig.test.ts`, `tests/core/rewards.test.ts`, `tests/core/determinism.test.ts`, `tests/ui/findsFeed.test.ts`.

**Interfaces:**
- Consumes `metreLayer`, `pickMaterial` and `materialAmount` from Task 1, and `receiveMaterial` from Task 3.
- **`balance.ts`:**
  - remove `goldPerTick`, `diamondChancePerTick` and `DIAMOND_CHANCE_CAP`;
  - `goldVeinAmount(tier, u)` = `Math.round((200 + 110 * tier) * (0.8 + 0.4 * u))`;
  - add `MAP_MATERIAL_CHANCE = 0.25`.
- **`collect`** gains the material-vein case: a `FindRecord` with `kind: 'materialVein'`, `material` and `amount`.
- **The `'gold'` and `'diamond'` `TickEvent`s** now come from gold and diamond vein payouts, with the vein's paid amount, so the floating numbers keep working.

- [ ] **Step 1: Write the failing tests** in `tests/core/dig.test.ts`. Find metres by scanning `rollMetre` and `metreLayer` for the seed in each test, not with hard-coded metres:
  - **`digging pays no Gold or Diamonds by the tick`:** at a fresh game with `ahead[1]` forced to `{ feature: null, amount: 0, hardRock: false }` and a seed whose metre 1 has no layer vein, 10 ticks leave `gold` and `diamonds` at 0.
  - **`a gold vein pays goldVeinAmount × the Gold multiplier and says so`:** dig a metre forced to `{ feature: 'goldVein', amount: 640 }`. With `goldYield` 0, gold grows by 640 and the events include `{ kind: 'gold', amount: 640 }`.
  - **`goldVeinAmount`:** `goldVeinAmount(4, 0.5)` is `640`, and `goldVeinAmount(1, 0)` is `248`.
  - **`a material vein on an empty metre is collected and logged`:**
    - pick the first metre `m` of seed 11 where `rollMetre(...).feature === null` and `metreLayer(11, m).vein !== null`;
    - set `deepest = m - 1` and `ahead = {}`, so the face rolls `m` from the seed;
    - dig until `deepest === m`;
    - the newest find is `{ kind: 'materialVein', material: layer.vein.material, amount: layer.vein.amount, depth: m }`, and the bag holds that material.
  - **`a metre with a seeded feature never gives a material vein`:** the same with a metre where `feature !== null` and `vein !== null`. No `'materialVein'` find is logged at `m`.
  - **`find gear still adds bonus finds on material-vein metres`:** a generation-2 game with stats `bonusChances.chest = 1` (a copy of `deriveStats` with that override, passed to `applyTicks`). Digging the empty-with-vein metre logs both a `'materialVein'` find and a bonus `'chest'` find at `m`.
  - **`worldGen 1 worlds get material veins too`:** the same as the empty-metre test, with `worldGen = 1`.
  - **`the face keeps its seeded features`:** for seed 21, dig 300 metres. Over metres 3..300 (metres 1–2 are newGame's forced start), the `depth`s of non-bonus, non-material finds equal the metres whose `rollMetre(21, m, BASE_ROLL_CHANCES).feature !== null`, and each `kind` matches.

  Add these to `tests/core/rewards.test.ts`:
  - **`map kills drop materials of the map's depth`:** 400 boss kills (`onKill` with a boss monster) on a run whose map has `metre: 1100, tier: 7`. Some material found is `'voidCrystal'`. On a map with `metre: 20, tier: 1`, every material found is `'copper'` or `'tin'`. Count materials through the run's loot notes with `rarity === 'material'`.
  - **`normal kills roll one material chance`:** across 2,000 normal kills the share of kills that drop a material is within 0.03 of 0.25.

  Add to `tests/ui/findsFeed.test.ts`: a `'materialVein'` find of 4 copper reads `Copper ore ×4`.

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core/dig.test.ts tests/core/rewards.test.ts tests/ui/findsFeed.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement the income and the veins.**
  - **`applyTicks`** no longer pays per tick or draws for Diamonds: the `mulberry32(state.rng)` draw goes, so it now draws nothing while digging.
  - **When the face metre is done**, `digFace` collects the seeded roll. Then, if `done.feature === null`, it collects `metreLayer(state.seed, next).vein` as a material vein through `receiveMaterial`. Then it rolls `collectBonus`, as today, for generation 2, still on `done.feature === null`.
  - **`collect`** pushes the gold and diamond events.
  - **`onKill`** appends after the gem chance: for `rankReward(rank)` times, `nextRandom(state) < MAP_MATERIAL_CHANCE` → `pickMaterial(run.map.metre, nextRandom(state))` and `materialAmount(material, run.map.metre, nextRandom(state))`, then `takeDrop(run, receiveMaterial(...))`.
  - **Existing tests:** reward and determinism tests that pin later draws may shift. Update their expected values only where the new draws come after the pinned ones, and say so in the report.
- [ ] **Step 4: Update the UI.**
  - **`FindsFeed`, `particles` and `ShaftScene`** know `'materialVein'`. The feed label is `${MATERIAL_LABELS[m]} ×${amount}`, the pop-up is `${label}!`, and the icon is the material's sprite.
  - **`ShaftScene`** lights material veins ahead in the wall like other features, using `metreLayer` on metres whose roll has no feature.
  - **`OfflineSummary`** lists material veins with the other finds ("material vein" / "material veins").
- [ ] **Step 5: Update the README.** Digging now earns only from what you dig into: Gold from gold veins, Diamonds from diamond veins, crafting materials from material veins. Selling items and map kills still pay Gold, and maps also drop materials, rarer ones in deeper maps.
- [ ] **Step 6: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
- [ ] **Step 7: Commit.** Run: `git commit -am "Pay only from veins, dig material veins and drop materials in maps"`.

---

### Task 5: Hazards, hazard ward and the mining-speed counter

**Files:**
- Modify: `src/core/dig.ts`, `src/core/items.ts`, `src/core/balance.ts`, `src/core/stats.ts`, `src/core/types.ts`, `src/core/itemData.ts`.
- Modify (UI): `src/ui/character/itemView.ts`, `src/ui/format.ts`, `src/ui/mine/MineView.tsx`, `src/ui/mine/mineView.ts` (create, for pure text helpers), `README.md`.
- Test: `tests/core/dig.test.ts`, `tests/core/gearStats.test.ts`, `tests/ui/format.test.ts`, `tests/ui/mineView.test.ts`.

**Interfaces:**
- Consumes `metreLayer`, `hazardFactor` and `MAX_HAZARD_WARD` from Task 1.
- **`items.ts`:** `MINING_STATS` gains `'hazardWard'`, appended last.
- **`balance.ts`:** `STAT_RANGES.hazardWard = { base: 5, perLevel: 1, cap: 40 }`.
- **`itemData.ts`:** `STAT_WORDS.hazardWard = { prefix: 'Masked', suffix: 'the Canary' }`.
- **`itemView.ts`:** `STAT_LABELS.hazardWard = { label: 'hazard ward', unit: '%' }`.
- **`types.ts`:** `Stats.hazardWard: number`. `deriveStats` sets it to `clamp(g.hazardWard, 0, MAX_HAZARD_WARD)`.
- **`dig.ts`:**
  - `faceTicksPerMetre(state: GameState, stats: Stats): number` = `hardness(m) × (hardRock ? HARD_ROCK_MULTIPLIER : 1) × hazardFactor(metreLayer(seed, m).hazard, stats.hazardWard) × TICKS_PER_METRE_AT_PARITY / stats.digPower`, for `m = deepest + 1`;
  - `digSpeed(state: GameState, stats: Stats): { metresPerMinute: number; secondsToNext: number } | null`, which is null while a map runs or `overflow` is non-empty.
- **`format.ts`:** `formatEta(seconds: number): string`.
- **`mineView.ts`:**
  - `speedText(speed: { metresPerMinute: number; secondsToNext: number } | null): string`;
  - `hazardText(hazard: Hazard | null, ward: number): string | null`.

- [ ] **Step 1: Write the failing tests.**

```ts
// dig.test.ts
it('a gas pocket doubles the ticks a metre needs; hazard ward shrinks that', () => {
  const s = newGame(1, 0);
  const m = firstMetre(1, (mm) => metreLayer(1, mm).hazard === 'gas');      // a helper scanning metres 301+
  s.deepest = m - 1; s.ahead = { [m]: { feature: null, amount: 0, hardRock: false } };
  const base = deriveStats(s);
  const plain = hardness(m) * TICKS_PER_METRE_AT_PARITY / base.digPower;
  expect(faceTicksPerMetre(s, base)).toBeCloseTo(plain * 2);
  expect(faceTicksPerMetre(s, { ...base, hazardWard: 50 })).toBeCloseTo(plain * 1.5);
});
it('digSpeed reports the face rate and the time to the next metre', () => {
  const s = newGame(1, 0);
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  s.progress = 0.5;
  const stats = { ...deriveStats(s), digPower: 10, autoTicksPerSecond: 1, hazardWard: 0 };
  const speed = digSpeed(s, stats)!;
  expect(speed.metresPerMinute).toBeCloseTo(60 / 25.325, 3);      // hardness(1) = 10.13 → 25.325 ticks a metre
  expect(speed.secondsToNext).toBeCloseTo(12.6625, 3);
  s.overflow.push(gear(s, 'boots'));
  expect(digSpeed(s, stats)).toBeNull();
});
// gearStats.test.ts
it('hazard ward rolls on mining gear and adds up, capped', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'hazardWard', value: 40 }] });
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'hazardWard', value: 40 }] });
  expect(deriveStats(s).hazardWard).toBe(MAX_HAZARD_WARD);
  expect(MINING_STATS).toContain('hazardWard');
});
// format.test.ts
it('formatEta', () => {
  expect([formatEta(42), formatEta(0.4), formatEta(125), formatEta(3725)]).toEqual(['42 s', '1 s', '2 min 5 s', '1 h 2 min']);
});
// mineView.test.ts
it('speedText and hazardText', () => {
  expect(speedText({ metresPerMinute: 1.3, secondsToNext: 42 })).toBe('1.3 m/min · next metre in 42 s');
  expect(speedText({ metresPerMinute: 0.05, secondsToNext: 1300 })).toBe('20 min per metre · next metre in 21 min 40 s');
  expect(speedText(null)).toBe('Digging paused');
  expect(hazardText('gas', 0)).toBe('Gas pocket: digging here takes 2× as long');
  expect(hazardText('unstable', 30)).toBe('Unstable rock: digging here takes 1.4× as long (hazard ward 30 %)');
  expect(hazardText(null, 30)).toBeNull();
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core/dig.test.ts tests/core/gearStats.test.ts tests/ui/format.test.ts tests/ui/mineView.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **`digFace`** uses `faceTicksPerMetre` for its step. The carried-progress rescale between metres also uses it, comparing `next` with `next + 1`, so hazards slow exactly the metres they sit on.
  - **`formatEta`** rounds seconds up: under 60 → `N s`; under 3,600 → `M min S s` (drop ` 0 s`); otherwise `H h M min`.
  - **`speedText`:**
    - at `metresPerMinute >= 0.1`, `${formatRate(mpm)} m/min`;
    - otherwise `${formatNumber(Math.round(1 / mpm))} min per metre`;
    - then ` · next metre in ${formatEta(secondsToNext)}`.
  - **`hazardText`:** the factor is printed with `formatRate`. Add ` (hazard ward N %)` when `ward > 0`.
- [ ] **Step 4: Update the UI.** `MineView` shows `speedText` on the right of the progress row, in place of the auto-tick text. It moves `Auto N tick/s · each click +N ticks` to a second muted line. When the face metre holds a hazard, a warning line shows `hazardText` under the caption.
- [ ] **Step 5: Update the README.** From Granite Veins down, some metres hold gas pockets or unstable rock that make digging slower. A new mining stat, hazard ward, cuts the slowdown. The mine shows your digging speed and the time to the next metre.
- [ ] **Step 6: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
- [ ] **Step 7: Commit.** Run: `git commit -am "Add mining hazards, hazard ward and a digging-speed counter"`. Add the new files first.

---

### Task 6: Stash pages, the Maps-tab grid and map item actions

**Files:**
- Modify: `src/core/inventory.ts` (or create `src/core/stashPages.ts`), `src/core/balance.ts`, `src/store/gameStore.ts`.
- Modify (UI): `src/ui/character/{StashDialog,stashView,itemActions,itemView,ItemCard}.ts(x)`, `src/ui/character/character.css`, `README.md`.
- Test: `tests/core/stashPages.test.ts`, `tests/ui/stashView.test.ts`, `tests/ui/itemActions.test.ts`, `tests/store/gameStore.test.ts`.

**Interfaces:**
- **`balance.ts`:** `STASH_PAGE_GOLD = 5000`, and `stashPagePrice(n: number): number` = `STASH_PAGE_GOLD * n * n`, where `n` is the number of the page being bought in that tab (`bought + 1`).
- **Core:** `buyStashPage(state: GameState, tab: 'general' | 'maps'): 'ok' | 'noGold' | 'full'` adds 60 empty cells, charges the price and counts `bought`.
- **Store:** `buyStashPage(tab)`, and `startMap` as today.
- **`stashView.ts`:**
  - `pageCells<T>(cells: readonly T[], page: number): T[]` (page from 0);
  - `tabLabel(state, tab)`, which gives "General 38 / 120", "Gems", "Maps 73 / 120" and "Materials";
  - `buyLabel(state, tab): { text: string; affordable: boolean }`.
- **`ActionSpec.id`** gains `'run'`.

- [ ] **Step 1: Write the failing tests.**
  - **`stashPages.test.ts`:**
    - with `gold = 5000`, `buyStashPage(s, 'general')` returns `'ok'`, General has 180 cells, `gold` is 0 and `bought.general` is 1;
    - with `gold = 19_999` it returns `'noGold'` and nothing changes;
    - at `gold = 20_000` it is `'ok'`;
    - the first Maps page costs 5,000, independently;
    - with General at `MAX_STASH_PAGES` pages it returns `'full'`.
  - **`stashView.test.ts`:**
    - `pageCells(Array.from({ length: 120 }, (_, i) => i), 1)` is `[60 … 119]`;
    - `tabLabel` of a fresh game's General is `General 0 / 120`;
    - `buyLabel(fresh, 'general')` is `{ text: '+ Page 3 · 5,000 Gold', affordable: false }`.
  - **`itemActions.test.ts`:**
    - a bag map gives `['Run this map', 'To Maps tab']`;
    - a Maps-tab map gives `['Run this map', 'To bag']`;
    - while a run is going, `Run this map` is disabled;
    - `actionForIntent` of a plain click on a map gives `'menu'`;
    - the move intent gives `toStash` or `toBag`;
    - `runAction` with `'run'` starts that map (`state.activity.kind === 'map'`).
  - **`gameStore.test.ts`:** `store.buyStashPage('maps')` with enough Gold bumps the version and the cell count.
- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/core/stashPages.test.ts tests/ui/stashView.test.ts tests/ui/itemActions.test.ts tests/store/gameStore.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement the core and the store.** Follow the interfaces. `'run'` maps to `store.startMap(item.id)`, and `'busy'` shows the busy text.
- [ ] **Step 4: Implement the stash UI.**
  - **General and Maps panels** show a page row: one `Page N` button per page (`aria-pressed` on the shown page), then a buy button with `buyLabel`'s text.
    - The buy button carries `aria-disabled` when it is not affordable, and a press then says "Not enough Gold." in the status line.
    - The row wraps on narrow screens.
    - The shown page is kept per tab while the dialog is open.
  - **The grid** shows `pageCells` of the shown page, with targets offset by `page × 60`.
  - **The Maps tab** is now an `ItemGrid` of map items. `MapList` leaves the stash.
  - **Map item card:** the name is the dungeon's name (`mapDungeon(state.seed, map).type.name`), the kind line is "Tier 4 map · 6 rooms", and the line is "Found at 327 m".
  - **Map actions:**
    - a bag map: `Run this map`, `To Maps tab`;
    - a tab map: `Run this map`, `To bag`;
    - the hover notes are "Click for actions · Shift+click to the Maps tab" and "Click for actions · Shift+click to your bag".
  - **`StashDialog`** closes itself when a run starts (`activity` turns to `'map'`). The App already switches to the Maps view.
  - **The bag grid** is 10 columns × 6 rows of 40 px cells in the panel and the dialog, following the Round 3 board. On narrow screens it keeps 10 columns and shrinks the cells to fit, never under 28 px. Below that it scrolls sideways inside its own box, never the page.
- [ ] **Step 5: Update the README.** The stash has pages. The General and Maps tabs start with 2 pages and 1 page, and more are bought with Gold, each page costing more than the last. Maps are items: run one from its card, keep it in the bag or the Maps tab.
- [ ] **Step 6: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
- [ ] **Step 7: Commit.** Run: `git commit -am "Add stash pages bought with Gold, and map items you run from their card"`.

---

### Task 7: The Maps screen as a picker

**Files:**
- Modify: `src/ui/maps/{mapsView.ts,MapList.tsx,MapsView.tsx,maps.css}`.
- Test: `tests/ui/mapsView.test.ts`.

**Interfaces:**
- Replaces `mapGroups` and `MapGroup` with `interface MapRow { id: number; name: string; tier: number; metre: number; rooms: number; where: 'bag' | 'maps'; page: number }`. `page` is 1-based, and 0 for the bag.
- `mapRows(state: GameState): MapRow[]` sorts by tier (highest first), then name, then id.

- [ ] **Step 1: Write the failing test.**
  - Put a tier-2 map in `bag[3]`, a tier-5 map at Maps index 61 and a tier-5 map with a lower id at Maps index 0.
  - `mapRows` gives the two tier-5 maps first (by name, then id), then the tier-2 one with `{ where: 'bag', page: 0 }`.
  - The index-61 row has `page: 2`.
  - `rooms` equals `dungeonType(...).rooms` (via `mapDungeon`).
- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run tests/ui/mapsView.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement the picker.**
  - **`MapList`** renders one row per map: `T4` badge, name, `found at 327 m · 6 rooms · in your bag` (or `· Maps tab, page 2`), and a `Run` button. The button keeps today's busy handling and its `aria-label`: `Run ${name}, found at ${metre} m`.
  - **Memoise** `mapRows` on `store.version` (fixes the Plan 5 deferral).
  - **`MapsView`'s header count** reads `${n} maps · ${inBag} in your bag`.
  - **Empty text:** "No maps yet. Dungeon entrances you dig into become maps."
- [ ] **Step 4: Run everything and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Run: `git commit -am "List every map on the Maps screen, from the bag and the Maps tab"`.

---

### Task 8: The minimap as a scrollable history

**Files:**
- Modify: `src/ui/mine/minimap.ts`, `src/ui/mine/Minimap.tsx`, `src/ui/mine/minimap.css`, `README.md`.
- Test: `tests/ui/minimap.test.ts`.

**Interfaces:**
- Keeps `MINIMAP_METRES = 88` (the visible window) and `MINIMAP_PX_PER_METRE = 6`.
- **`minimapModel(state: GameState, lampSight: number, top: number): MinimapModel`.** Every `y` is absolute (`depth × MINIMAP_PX_PER_METRE`). Bands, ticks, markers and lamp hints cover only `[top - 10, top + MINIMAP_METRES + 10]`.
- **`MinimapModel`** gains `height: number`, the full scroll height (`(state.deepest + lampSight + 2) × px`). Its `ahead` kinds become `FeatureKind | 'materialVein' | 'hardRock' | Hazard`, plus `label: string`.
- **`followTop(deepest: number): number`** = `Math.max(0, deepest - 50)`.
- **`isFollowing(scrollTop: number, deepest: number): boolean`** is true when the face's `y` lies inside `[scrollTop, scrollTop + MINIMAP_METRES × px]`.
- Removes `depthAtY`, `depthForKey` and `depthForClick`.

- [ ] **Step 1: Write the failing tests** in `tests/ui/minimap.test.ts`. Replace the climbing tests with these:
  - a state with finds at 10, 400 and 900 m and `deepest` 950: `minimapModel(s, 3, 380)` has markers only near 400. Its `y` is the bucket middle × 6, and `height` is `(950 + 3 + 2) × 6`;
  - a material-vein find of copper at 412 m gives a marker labelled `Copper ore`;
  - lamp hints:
    - an ahead metre with `feature: null` whose layer has a vein gives `{ kind: 'materialVein', label: <material label> }`;
    - one with a hazard gives `{ kind: 'gas', label: 'gas pocket' }` or `{ kind: 'unstable', label: 'unstable rock' }`;
    - `hardRock` stays `harder rock`;
  - `followTop(30)` is `0`, and `followTop(950)` is `900`;
  - `isFollowing(900 × 6, 950)` is `true`, and `isFollowing(0, 950)` is `false`.
- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npx vitest run tests/ui/minimap.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement the model.**
- [ ] **Step 4: Implement the component.**
  - **The scroll area** is a `MINIMAP_METRES × px`-tall box, `overflow-y: auto`, `role="region"`, `aria-label="Minimap: everything found, by depth"`, `tabIndex={0}`. Arrow keys and page keys scroll it natively.
  - **Inside it**, a `height`-tall spacer with absolutely placed bands, ticks, markers, lamp hints, the "You · N m" line at the face, and the fog.
  - **Scroll state:** the `top` metre comes from `scrollTop` (on scroll, throttled to an animation frame). A `following` flag starts true.
    - While following, a new metre scrolls to `followTop(deepest)`.
    - A user scroll sets `following = isFollowing(scrollTop, deepest)`.
  - **"Jump to the dig face"** sits under the box, always visible. It scrolls to `followTop(deepest)` (smooth only when motion allows) and sets following.
  - **The header range** shows the visible metres. **The caption** reads "Everything found so far, by depth. Your lamp lights N m past the dig face."
- [ ] **Step 5: Update the README.** The minimap is a record of everything found, by depth. Scroll it to look back, and use "Jump to the dig face" to return. The miner only digs down.
- [ ] **Step 6: Run everything, check the browser, and confirm it passes.**
  - Run: `npx vitest run && npx tsc --noEmit`.
  - Expected: PASS.
  - Then a browser smoke check with puppeteer-core (see Global Constraints for Node; Chrome at `/usr/bin/google-chrome`, `--no-sandbox`, a fresh browser context) on `http://127.0.0.1:5180/`, at 1280×900 and 390×844. Import `tests/fixtures/save-schema-5.txt` via Settings → Export / import save… → Load, then confirm:
    - the game loads and the map run continues;
    - the bag shows 48 items in a 10 × 6 grid;
    - the stash has General pages 1–2 and Maps pages 1–2;
    - the minimap scrolls, and Jump returns to the face;
    - there is no horizontal page scroll at 390 px.
- [ ] **Step 7: Commit.** Run: `git commit -am "Turn the minimap into a scrollable history with a jump to the dig face"`.
