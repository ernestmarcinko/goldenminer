import { expect, it } from 'vitest';
import { compressToBase64, decompressFromBase64 } from 'lz-string';
import fixture from '../fixtures/save-schema-1.txt?raw';
import fixture2 from '../fixtures/save-schema-2.txt?raw';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import fixture5 from '../fixtures/save-schema-5.txt?raw';
import { applyTicks } from '../../src/core/dig';
import {
  BAG_SIZE, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_LOOT_RULES, MAX_OVERFLOW, START_GENERAL_PAGES, START_MAP_PAGES, STASH_PAGE_SIZE,
} from '../../src/core/balance';
import { emptyInventory, firstEmpty } from '../../src/core/cells';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, migrate, MIGRATIONS, SCHEMA_VERSION, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { Cell, GemGrade, GemType, MapItem } from '../../src/core/items';
import type { BagFullMode, ChampionMod, FindRecord, GameState, LootAction, RunOutcome } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

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
    { ...newGame(1, 0), deepest: -3 },
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

it('migrates a real schema-1 save', () => {
  const r = decodeSave(fixture.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(r.savedAt).toBe(1_761_206_300_000);
  expect(s).toMatchObject({ gold: 10_972, diamonds: 119, deepest: 125, tickCount: 6300, nextId: 36 });
  const empty = emptyInventory();
  expect([s.equipped, s.bag, { ...s.stash, maps: empty.stash.maps }, s.overflow, s.lootTally, s.settings]).toEqual([
    empty.equipped, empty.bag, empty.stash, empty.overflow,
    { kept: 0, sold: 0, salvaged: 0 },
    { lootFilter: [], bagFull: 'sellWorst', motion: { floats: true, pops: true, lampFlicker: true, shaft: 'step' } },
  ]);
  expect(s.finds.map((f) => f.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect(s.finds[0]).toEqual({ id: 1, depth: 2, kind: 'map', amount: 0, tick: 50 });
  applyTicks(s, 100, deriveStats(s));
  expect(s.tickCount).toBe(6400);
});

function stocked(): GameState {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { sockets: 1, gems: [{ gem: 'ruby', grade: 'tiny' }] });
  s.bag[2] = gem(s, 'emerald', { grade: 'big', count: 7 });
  s.bag[0] = (gear(s, 'weapon', { rarity: 'rare', affixes: [{ stat: 'critChance', value: 3 }, { stat: 'life', value: 20 }, { stat: 'armor', value: 12 }] }));
  s.stash.general[5] = gear(s, 'boots', { rarity: 'legendary', name: 'Long Voyage', uniqueId: 'longVoyage' });
  s.stash.gems.ruby.small = 40;
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
    ['a bag of 61 cells', (s) => { s.bag.push(null); }],
    ['a bag of 59 cells', (s) => { s.bag.pop(); }],
    ['a General tab of 121 cells', (s) => { s.stash.general.push(null); }],
    ['a stack of 26', (s) => { s.bag[1] = gem(s, 'ruby', { count: 26 }); }],
    ['an empty stack', (s) => { s.bag[1] = gem(s, 'ruby', { count: 0 }); }],
    ['an empty material stack', (s) => { s.bag[1] = { id: s.nextId++, type: 'material', material: 'tin', count: 0 }; }],
    ['an unknown material', (s) => { s.bag[1] = { id: s.nextId++, type: 'material', material: 'gold' as never, count: 1 }; }],
    ['a missing Materials-tab count', (s) => { delete (s.stash.materials as Partial<typeof s.stash.materials>).tin; }],
    ['a fractional Materials-tab count', (s) => { s.stash.materials.tin = 0.5; }],
    ['a negative bought count', (s) => { s.stash.bought.general = -1; }],
    ['a map in the bag at metre 0', (s) => { s.bag[1] = { id: s.nextId++, type: 'map', tier: 1, metre: 0 }; }],
    ['a gem in General', (s) => { s.stash.general[0] = gem(s) as never; }],
    ['worn under the wrong slot', (s) => { s.equipped.mining.lamp = gear(s, 'pickaxe'); }],
    ['worn in the wrong set', (s) => { s.equipped.battle.pickaxe = gear(s, 'pickaxe'); }],
    ['a shared id', (s) => { const g = gem(s); g.id = s.bag[2]!.id; s.bag[1] = g; }],
    ['an id from the future', (s) => { s.bag[1] = gem(s, 'ruby', { id: 999 }); }],
    ['more gems than sockets', (s) => { s.equipped.mining.pickaxe!.gems.push({ gem: 'ruby', grade: 'tiny' }); }],
    ['a socketed gem with an unknown grade', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'ruby', grade: 'huge' as GemGrade }; }],
    ['a socketed gem with a bad type', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'opal' as GemType, grade: 'tiny' }; }],
    ['a battle stat on mining gear', (s) => { s.equipped.mining.pickaxe!.affixes.push({ stat: 'damage', value: 3 }); }],
    ['a fractional stat', (s) => { s.equipped.mining.pickaxe!.implicit.value = 2.5; }],
    ['an unknown gem', (s) => { s.bag[1] = { ...gem(s), gem: 'opal' as GemType }; }],
    ['an unknown grade on a stack', (s) => { s.bag[1] = { ...gem(s), grade: 'huge' as GemGrade }; }],
    ['a Gems-tab count of 1,000,001', (s) => { s.stash.gems.ruby.tiny = 1_000_001; }],
    ['a fractional Gems-tab count', (s) => { s.stash.gems.ruby.tiny = 1.5; }],
    ['a negative Gems-tab count', (s) => { s.stash.gems.ruby.tiny = -1; }],
    ['a missing Gems-tab grade', (s) => { delete (s.stash.gems.ruby as Partial<Record<GemGrade, number>>).perfect; }],
    ['an extra Gems-tab type', (s) => { (s.stash.gems as Record<string, unknown>).opal = s.stash.gems.ruby; }],
    ['an unknown loot action', (s) => { s.settings.lootFilter.push({ rarity: 'any', target: 'any', action: 'burn' as LootAction }); }],
    ['too many loot rules', (s) => { for (let i = 0; i < MAX_LOOT_RULES + 1; i++) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' }); }],
    ['an unknown bag-full mode', (s) => { s.settings.bagFull = 'maybe' as BagFullMode; }],
    ['a find without an id', (s) => { s.finds.push({ depth: 0, kind: 'chest', amount: 0, tick: 0 } as FindRecord); }],
    ['11 held items', (s) => { for (let i = 0; i < MAX_OVERFLOW + 1; i++) s.overflow.push(gear(s, 'pickaxe')); }],
    ['a held gem', (s) => { s.overflow.push(gem(s) as never); }],
  ];
  for (const [name, mutate] of cases) {
    const s = stocked();
    mutate(s);
    expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })), name).toEqual({ ok: false, reason: 'invalid' });
  }
});

it('migrates a real schema-2 save into world generation 1', () => {
  const r = decodeSave(fixture2.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  expect(r.state).toMatchObject({ seed: 9090, worldSeed: '9090', worldGen: 1, gold: 22_975, deepest: 215 });
  expect(r.state.settings.motion).toEqual({ floats: true, pops: true, lampFlicker: true, shaft: 'step' });
  expect(r.state.nextId).toBe(86);
});

it('rejects a seed text that does not match the seed', () => {
  const s = newGame(1, 0);
  expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })).ok).toBe(true);
  for (const mutate of [
    (x: GameState) => { x.worldSeed = 'golden mole'; },
    (x: GameState) => { x.worldSeed = ''; },
    (x: GameState) => { (x as { worldGen: number }).worldGen = 3; },
    (x: GameState) => { (x.settings.motion as { shaft: string }).shaft = 'wobble'; },
  ]) {
    const bad = newGame(1, 0);
    mutate(bad);
    expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: bad }))).toEqual({ ok: false, reason: 'invalid' });
  }
});

it('accepts the limits: full grids, 10 held items, 20 rules, 3 gems in 3 sockets, full stacks and tab counts', () => {
  const s = stocked();
  s.bag = s.bag.map((c, i) => c ?? (
    i % 4 === 0 ? gem(s, 'sapphire', { count: 25 })
      : i % 4 === 1 ? { id: s.nextId++, type: 'material', material: 'voidCrystal', count: MATERIAL_BAG_STACK }
      : i % 4 === 2 ? { id: s.nextId++, type: 'map', tier: 3, metre: 200 }
      : gear(s, i % 8 === 3 ? 'ring' : 'lamp')));
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'boots'));
  s.stash.maps = s.stash.maps.map((c) => c ?? { id: s.nextId++, type: 'map', tier: 1, metre: 5 });
  s.stash.materials.copper = MATERIAL_STASH_STACK;
  s.stash.bought.general = 2;
  s.stash.bought.maps = 1;
  for (let i = 0; i < MAX_OVERFLOW; i++) s.overflow.push(gear(s, 'helm'));
  while (s.settings.lootFilter.length < MAX_LOOT_RULES) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' });
  s.equipped.battle.helm = gear(s, 'helm', { sockets: 3, gems: [{ gem: 'ruby', grade: 'tiny' }, { gem: 'ruby', grade: 'small' }, { gem: 'starstone', grade: 'perfect' }] });
  s.stash.gems.starstone.perfect = 1_000_000;
  expect([firstEmpty(s.bag), firstEmpty(s.stash.general), firstEmpty(s.stash.maps), s.bag.length, s.stash.general.length])
    .toEqual([-1, -1, -1, BAG_SIZE, START_GENERAL_PAGES * STASH_PAGE_SIZE]);
  expect(decodeSave(encodeSave(s, 1))).toEqual({ ok: true, state: s, savedAt: 1 });
});

it('migrates a real schema-3 save: gems become graded stacks in fixed slots', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s).toMatchObject({ worldSeed: '9090', worldGen: 1, gold: 81_754, diamonds: 1_170, nextId: 267 });
  const label = (c: Cell) => (c?.type === 'gem' ? `${c.gem}×${c.count}` : c?.type === 'gear' ? c.slot : null);
  // the mining bag's cells first, then the battle bag's, in one bag
  expect(s.bag.slice(0, 12).map(label)).toEqual([
    'boots', 'starstone×7', 'amethyst×4', 'lamp', 'sapphire×3', 'boots', 'boots', 'emerald×1', 'pickaxe', 'pickaxe',
    'lamp', 'gloves']);
  expect(s.bag.slice(12, 15).map((c) => c?.id)).toEqual([15, 43, 82]);
  expect(s.bag.slice(15).every((c) => c === null)).toBe(true);
  expect(s.stash.general).toHaveLength(120);
  expect(s.stash.general.filter((c) => c !== null).map((c) => c.id)).toEqual([168, 172, 215, 218, 236]);
  expect(s.stash.gems).toMatchObject({
    ruby: { tiny: 3 }, emerald: { tiny: 3 }, amethyst: { tiny: 1 }, starstone: { tiny: 1 }, sapphire: { tiny: 1 } });
  expect(s.equipped.mining.pickaxe?.gems).toEqual([{ gem: 'starstone', grade: 'tiny' }]);
});

it('migration keeps every gem', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(r.reason);
  type Socketed = { type?: string; gems?: unknown[] } | null | undefined;
  const sockets = (list: Socketed[]) => list.reduce((n, it) => n + (it?.gems?.length ?? 0), 0);
  const everywhere = (st: { bag: Socketed[]; general: Socketed[]; held: Socketed[]; worn: Socketed[] }) =>
    sockets([...st.bag, ...st.general, ...st.held, ...st.worn]);
  const old = JSON.parse(decompressFromBase64(fixture3.trim())).state;
  const oldSockets = everywhere({
    bag: [...old.bags.mining, ...old.bags.battle], general: old.stash, held: old.overflow.map((o: { item: Socketed }) => o.item),
    worn: [...Object.values(old.equipped.mining), ...Object.values(old.equipped.battle)] as Socketed[],
  });
  const st = r.state;
  const newSockets = everywhere({
    bag: st.bag, general: st.stash.general, held: st.overflow,
    worn: [...Object.values(st.equipped.mining), ...Object.values(st.equipped.battle)],
  });
  expect(newSockets).toBe(oldSockets);
  const total = (state: GameState) =>
    state.bag.reduce((n, c) => n + (c?.type === 'gem' ? c.count : 0), 0)
    + Object.values(state.stash.gems).reduce((n, g) => n + Object.values(g).reduce((a, b) => a + b, 0), 0)
    + newSockets;
  expect(total(r.state)).toBe(25);   // the old save holds 15 bag gems, 9 stash gems and 1 socketed gem
});

it('schema-3 gems socketed in unworn gear (bag, General, held) migrate to graded gems', () => {
  const env = JSON.parse(decompressFromBase64(fixture3.trim()));
  const old = env.state;
  const oldGem = (id: number) => ({ id, type: 'gem', gem: 'ruby', ilvl: 5 });
  const socket = (item: { sockets: number; gems: unknown[] }, id: number) => { item.sockets = Math.max(item.sockets, 1); item.gems = [oldGem(id)]; };
  const bagItem = old.bags.mining.find((i: { type: string }) => i.type === 'gear');
  const stashItem = old.stash.find((i: { type: string }) => i.type === 'gear');
  socket(bagItem, 248);
  socket(stashItem, 249);
  const held = { ...structuredClone(old.bags.mining.filter((i: { type: string }) => i.type === 'gear')[1]), id: 251 };
  socket(held, 250);
  old.overflow.push({ bag: 'mining', item: held });
  old.nextId = 252;
  const r = decodeSave(raw(env));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  const graded = [{ gem: 'ruby', grade: 'small' }];
  const byId = (id: number) => [
    ...r.state.bag, ...r.state.stash.general, ...r.state.overflow,
  ].find((c) => c?.id === id);
  expect(byId(bagItem.id)).toMatchObject({ gems: graded });
  expect(byId(stashItem.id)).toMatchObject({ gems: graded });
  expect(r.state.overflow.find((o) => o.id === 251)?.gems).toEqual(graded);
});

it('migration keeps every gear id', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(r.reason);
  const old = JSON.parse(decompressFromBase64(fixture3.trim())).state;
  type OldItem = { id: number; type: string; gems?: unknown[] } | null;
  const oldGear = (list: OldItem[]) => list.filter((i): i is NonNullable<OldItem> => i !== null && i.type === 'gear');
  const oldAll = [
    ...oldGear(old.bags.mining), ...oldGear(old.bags.battle), ...oldGear(old.stash),
    ...oldGear(old.overflow.map((o: { item: OldItem }) => o.item)),
    ...oldGear([...Object.values(old.equipped.mining), ...Object.values(old.equipped.battle)] as OldItem[]),
  ];
  const st = r.state;
  const newAll = [
    ...st.bag, ...st.stash.general, ...st.overflow,
    ...Object.values(st.equipped.mining), ...Object.values(st.equipped.battle),
  ].filter((i) => i != null && i.type === 'gear');
  const ids = (list: { id: number }[]) => list.map((i) => i.id).sort((a, b) => a - b);
  expect(ids(newAll)).toEqual(ids(oldAll));
  expect(newAll).toHaveLength(17);
  const equippedGems = (equipped: Record<string, { gems?: unknown[] } | undefined>[]) =>
    equipped.flatMap((set) => Object.values(set)).reduce((n, it) => n + (it?.gems?.length ?? 0), 0);
  expect(equippedGems([st.equipped.mining, st.equipped.battle])).toBe(equippedGems([old.equipped.mining, old.equipped.battle]));
  const socketed = (list: { gems?: unknown[] }[]) => list.reduce((n, it) => n + (it.gems?.length ?? 0), 0);
  expect(socketed(newAll as { gems?: unknown[] }[])).toBe(socketed(oldAll));
});

it('a schema-3 bag gem with an impossible item level is rejected', () => {
  const env = JSON.parse(decompressFromBase64(fixture3.trim()));
  const gemCell = env.state.bags.mining.find((i: { type: string }) => i.type === 'gem');
  gemCell.ilvl = 0;
  expect(decodeSave(raw(env))).toEqual({ ok: false, reason: 'invalid' });
});

it('old held gems reach the Gems tab, and 24 identical gems become one stack', () => {
  const env = JSON.parse(decompressFromBase64(fixture3.trim()));   // the real schema-3 envelope, before migration
  const old = env.state;
  old.bags.battle = Array.from({ length: 24 }, (_, i) => ({ id: 249 + i, type: 'gem', gem: 'ruby', ilvl: 1 }));
  old.overflow = [{ bag: 'mining', item: { id: 248, type: 'gem', gem: 'emerald', ilvl: 5 } }];
  old.nextId = 273;
  const r = decodeSave(raw(env));
  if (!r.ok) throw new Error(r.reason);
  expect(r.state.bag[12]).toEqual({ id: 249, type: 'gem', gem: 'ruby', grade: 'tiny', count: 24 });   // after the 12 mining cells
  expect(r.state.bag.slice(13).every((c) => c === null)).toBe(true);
  expect(r.state.stash.gems.emerald.small).toBe(1);
  expect(r.state.overflow).toEqual([]);
});

it('the schema-3 migration leaves a state that is not the old shape alone', () => {
  const s = newGame(1, 0);
  expect(MIGRATIONS[3]?.(s)).toBe(s);
  const odd = { ...s, overflow: 'x' };
  expect(MIGRATIONS[3]?.(odd)).toBe(odd);
  expect(decodeSave(raw({ schema: 3, savedAt: 0, state: odd }))).toEqual({ ok: false, reason: 'invalid' });
});

it('migrates a real schema-4 save: past map finds become maps', () => {
  const r = decodeSave(fixture4.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s).toMatchObject({ worldSeed: '9090', gold: 94_523, diamonds: 1_375, deepest: 215, tickCount: 47_235, level: 1, xp: 0, souls: 0, lastRun: null, nextId: 309 });
  expect(s.activity).toEqual({ kind: 'dig' });
  const maps = tabMaps(s);
  expect(s.stash.maps).toHaveLength(STASH_PAGE_SIZE);
  expect(maps.map((m) => m.id)).toEqual(Array.from({ length: 21 }, (_, i) => 288 + i));
  expect(maps.map((m) => [m.tier, m.metre]).slice(0, 8)).toEqual([[1, 2], [1, 3], [1, 4], [1, 36], [1, 47], [2, 66], [2, 79], [3, 214]]);
  expect(maps.slice(7).every((m) => m.tier === 3 && m.metre === 214)).toBe(true);
});

it('older fixtures gain their maps too', () => {
  const r1 = decodeSave(fixture.trim());
  const r2 = decodeSave(fixture2.trim());
  if (!r1.ok || !r2.ok) throw new Error('fixture rejected');
  expect(tabMaps(r1.state).map((m) => m.id)).toEqual([31, 32, 33, 34, 35]);
  expect(r1.state.nextId).toBe(36);
  expect(tabMaps(r1.state).map((m) => [m.tier, m.metre])).toEqual([[1, 2], [1, 23], [1, 41], [2, 60], [2, 67]]);
  expect(tabMaps(r2.state).map((m) => [m.id, m.tier, m.metre])).toEqual([[79, 1, 2], [80, 1, 3], [81, 1, 4], [82, 1, 36], [83, 1, 47], [84, 2, 66], [85, 2, 79]]);
});

const tabMaps = (s: GameState): MapItem[] => s.stash.maps.filter((m) => m !== null);

/** A new map that is in no cell: for a run or a last run. */
function looseMap(s: GameState, tier: number, metre: number): MapItem {
  const map = addMap(s, tier, metre);
  s.stash.maps[s.stash.maps.indexOf(map)] = null;
  return map;
}

// Seed 1's tier-2 dungeon at metre 2 has 5 rooms, so its boss room is 6.
function running(): GameState {
  const s = newGame(1, 0);
  const map = looseMap(s, 2, 2);
  s.activity = { kind: 'map', run: {
    map, room: 1, bossRoom: 6, life: 40, hitCarry: 0, monsterCarry: 0, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [], items: 0,
    queue: [{ name: 'Mud Slime', species: 1, rank: 'normal', mods: [], extra: 7, element: 'elemental', life: 30, maxLife: 37, damage: 4, intervalS: 2, xp: 28 }],
  } };
  return s;
}

it('rejects impossible maps, runs and levels', () => {
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
    ['a species the tier does not have', (s) => { const m = first(s); if (m) m.species = 99; }],
    ['modifiers on a normal', (s) => { const m = first(s); if (m) m.mods = ['brutal']; }],
    ['three modifiers', (s) => { const m = first(s); if (m) { m.rank = 'champion'; m.mods = ['brutal', 'swift', 'armored']; } }],
    ['boss room 9', (s) => { const r = run(s); if (r) r.bossRoom = 9; }],
    ['a boss room the dungeon does not have', (s) => { const r = run(s); if (r) r.bossRoom = 7; }],
    ['a hand-edited boss room on a started map', (s) => {
      // seed 1's tier-1 dungeon at metre 11 has 6 rooms: its boss room is 7, not 8
      s.activity = { kind: 'dig' };
      startMap(s, addMap(s, 1, 11).id);
      const r = run(s);
      if (r) r.bossRoom = 8;
    }],
    ['a last run with the wrong boss room', (s) => { const m = looseMap(s, 1, 2); s.lastRun = { map: m, outcome: 'cleared', room: 7, bossRoom: 7, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false }; }],
    ['a negative item count', (s) => { const r = run(s); if (r) r.items = -1; }],
    ['no item count', (s) => { const r = run(s); if (r) delete (r as Partial<typeof r>).items; }],
    ['a whole hit carried', (s) => { const r = run(s); if (r) r.hitCarry = 1; }],
    ['a map id reused in the stash', (s) => { const r = run(s); if (r) s.stash.maps[3] = { ...r.map }; }],
    ['an unknown outcome', (s) => { const m = looseMap(s, 1, 2); s.lastRun = { map: m, outcome: 'won' as RunOutcome, room: 6, bossRoom: 6, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false }; }],
    ['a Maps tab of 61 cells', (s) => { s.stash.maps.push(null); }],
    ['a map at metre 0', (s) => { s.stash.maps[0] = { id: s.nextId++, type: 'map', tier: 1, metre: 0 }; }],
    ['a material note for a gem', (s) => { run(s)?.loot.push({ name: 'Ruby', rarity: 'material', base: 'ruby', outcome: 'bag', value: 2 }); }],
    ['a gem note for a material', (s) => { run(s)?.loot.push({ name: 'Tin ore', rarity: 'gem', base: 'tin', outcome: 'bag', value: 2 }); }],
  ];
  for (const [name, mutate] of cases) {
    const s = running();
    mutate(s);
    expect(decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })), name).toEqual({ ok: false, reason: 'invalid' });
  }
});

const decodes = (s: GameState) => decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })).ok;
const GAINS = { xp: 5, souls: 2, gold: 9, levels: 1 };

it('a run keeps its material loot notes', () => {
  const s = running();
  if (s.activity.kind === 'map') s.activity.run.loot.push({ name: 'Void crystal', rarity: 'material', base: 'voidCrystal', outcome: 'stash', value: 3 });
  expect(decodes(s)).toBe(true);
});

it('accepts the legal extremes of maps, runs and levels', () => {
  const run = (s: GameState) => { if (s.activity.kind !== 'map') throw new Error('no run'); return s.activity.run; };
  const monster = (s: GameState) => { const m = run(s).queue[0]; if (!m) throw new Error('no monster'); return m; };
  const cases: [string, (s: GameState) => void][] = [
    ['level 60 at xp 0', (s) => { s.level = 60; s.xp = 0; }],
    ['the last xp below a level', (s) => { s.level = 2; s.xp = 282; }],
    ['a champion with two distinct mods', (s) => { Object.assign(monster(s), { rank: 'champion', mods: ['brutal', 'swift'] }); }],
    ['the boss room with a boss in front', (s) => { run(s).room = 6; monster(s).rank = 'boss'; }],
    ['a started map with its own boss room', (s) => { s.activity = { kind: 'dig' }; startMap(s, addMap(s, 1, 11).id); }],
    ['more items than the run keeps notes of', (s) => { run(s).items = 500; }],
    ['a log with heal, drop and level lines', (s) => {
      run(s).log = [
        { kind: 'heal', monster: 'Mud Slime', amount: 3 },
        { kind: 'drop', note: { name: 'Test ring', rarity: 'magic', base: 'ring', outcome: 'bag', value: 0 } },
        { kind: 'level', level: 2 },
      ];
    }],
    ['a cleared last run in the boss room', (s) => {
      const m = looseMap(s, 1, 2);
      s.lastRun = { map: m, outcome: 'cleared', room: 6, bossRoom: 6, gained: GAINS, items: 3, seen: false };
    }],
  ];
  for (const [name, mutate] of cases) {
    const s = running();
    mutate(s);
    expect(decodes(s), name).toBe(true);
  }
});

it('rejects xp at the level cap', () => {
  const s = running();
  s.level = 60;
  s.xp = 1;
  expect(decodes(s)).toBe(false);
});

it('a schema-4 map find at an absurd depth decodes without crashing', () => {
  for (const depth of [1e300, 1e999, -5, 1.5, 30_000_001]) {
    const env = JSON.parse(decompressFromBase64(fixture4.trim()));
    env.state.finds.find((f: { kind: string }) => f.kind === 'map').depth = 'DEPTH';
    const text = JSON.stringify(env).replace('"DEPTH"', depth === 1e999 ? '1e999' : String(depth));   // JSON.stringify would turn Infinity into null
    expect(decodeSave(compressToBase64(text)), String(depth)).toEqual({ ok: false, reason: 'invalid' });
  }
});

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

it('a schema-5 save with no maps still gets the starting Maps pages', () => {
  const env = JSON.parse(decompressFromBase64(fixture5.trim()));
  env.state.stash.maps = [];
  const r = decodeSave(compressToBase64(JSON.stringify(env)));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  expect(r.state.stash.maps).toHaveLength(START_MAP_PAGES * STASH_PAGE_SIZE);
  expect(r.state.stash.maps).toHaveLength(60);
});

it('every older fixture still loads', () => {
  for (const f of [fixture, fixture2, fixture3, fixture4]) expect(decodeSave(f.trim()).ok).toBe(true);
});

it('a schema-5 save carrying more than one bag holds is rejected, not cut short', () => {
  const env = JSON.parse(decompressFromBase64(fixture5.trim()));
  const { state } = env;
  state.bags.battle.push(...Array.from({ length: 13 }, (_, i) => ({ ...state.bags.battle[0], id: state.nextId + i })));
  state.nextId += 13;
  expect(decodeSave(raw(env))).toEqual({ ok: false, reason: 'invalid' });
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

it('a material vein find names its material, and only that kind of find does', () => {
  const s = newGame(3, 0);
  s.finds.push({ id: s.nextId++, depth: 1, kind: 'materialVein', material: 'iron', amount: 3, tick: 0 });
  expect(validateState(s)).toBe(true);
  s.finds.push({ id: s.nextId++, depth: 2, kind: 'chest', material: 'iron', amount: 0, tick: 0 });
  expect(validateState(s)).toBe(false);
});

it('a new game starts with one bag of 60, two General pages and one Maps page', () => {
  const s = newGame(1, 0);
  expect([s.bag.length, s.stash.general.length, s.stash.maps.length]).toEqual([60, 120, 60]);
});
