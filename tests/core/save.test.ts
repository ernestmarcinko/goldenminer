import { describe, expect, it } from 'vitest';
import { compressToBase64, decompressFromBase64 } from 'lz-string';
import fixture from '../fixtures/save-schema-1.txt?raw';
import fixture2 from '../fixtures/save-schema-2.txt?raw';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import fixture5 from '../fixtures/save-schema-5.txt?raw';
import fixture6 from '../fixtures/save-schema-6.txt?raw';
import fixture7 from '../fixtures/save-schema-7.txt?raw';
import fixture8 from '../fixtures/save-schema-8.txt?raw';
import { applyTicks } from '../../src/core/dig';
import {
  BAG_SIZE, DEATH_LOG_LIMIT, DROP_LOG_LIMIT, MAP_TIER_CAP, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_HELD, MAX_LOOT_RULES,
  MAX_TIER_OVER_CAP, MAX_TRAIL_STEPS, START_GENERAL_PAGES, STASH_PAGE_SIZE,
} from '../../src/core/balance';
import { emptyInventory, firstEmpty } from '../../src/core/cells';
import { sideCount } from '../../src/core/itemGen';
import { addMap, startMap, takeMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, migrate, MIGRATIONS, SCHEMA_VERSION, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import { tierFor, tierRange } from '../../src/core/tiers';
import { MAP_MOD_KINDS, MOD_SIDE } from '../../src/core/items';
import type { Cell, GemGrade, GemType, MapItem, MapMod, ModLine } from '../../src/core/items';
import type { ChampionMod, DeathEntry, DropEntry, FindRecord, GameState, LootAction, MapRun, RunOutcome } from '../../src/core/types';
import { gear, gem, stashMap } from '../helpers/items';

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
    { lootFilter: [], motion: { floats: true, pops: true, lampFlicker: true, shaft: 'step' } },
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
    ['a map in the bag at metre 0', (s) => { s.bag[1] = { id: s.nextId++, type: 'map', tier: 1, metre: 0, rarity: 'normal', mods: [] }; }],
    ['a gem in General', (s) => { s.stash.general[0] = gem(s) as never; }],
    ['worn under the wrong slot', (s) => { s.equipped.mining.lamp = gear(s, 'pickaxe'); }],
    ['worn in the wrong set', (s) => { s.equipped.battle.pickaxe = gear(s, 'pickaxe'); }],
    ['a shared id', (s) => { const g = gem(s); g.id = s.bag[2]!.id; s.bag[1] = g; }],
    ['an id from the future', (s) => { s.bag[1] = gem(s, 'ruby', { id: 999 }); }],
    ['more gems than sockets', (s) => { s.equipped.mining.pickaxe!.gems.push({ gem: 'ruby', grade: 'tiny' }); }],
    ['a socketed gem with an unknown grade', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'ruby', grade: 'huge' as GemGrade }; }],
    ['a socketed gem with a bad type', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'opal' as GemType, grade: 'tiny' }; }],
    ['a battle stat on mining gear', (s) => { s.equipped.mining.pickaxe!.affixes.push({ stat: 'damage', value: 3, tier: 1 }); }],
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
    ['a find without an id', (s) => { s.finds.push({ depth: 0, kind: 'chest', amount: 0, tick: 0 } as FindRecord); }],
    ['61 held items', (s) => { for (let i = 0; i < MAX_HELD + 1; i++) s.overflow.push(gear(s, 'pickaxe')); }],
    ['a held gem stack of 26', (s) => { s.overflow.push(gem(s, 'ruby', { count: 26 })); }],
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

it('accepts the limits: full grids, a full map tier, 60 held items, 20 rules, 3 gems in 3 sockets, full stacks and tab counts', () => {
  const s = stocked();
  s.bag = s.bag.map((c, i) => c ?? (
    i % 4 === 0 ? gem(s, 'sapphire', { count: 25 })
      : i % 4 === 1 ? { id: s.nextId++, type: 'material', material: 'voidCrystal', count: MATERIAL_BAG_STACK }
      : i % 4 === 2 ? { id: s.nextId++, type: 'map', tier: 3, metre: 200, rarity: 'normal', mods: [] }
      : gear(s, i % 8 === 3 ? 'ring' : 'lamp')));
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'boots'));
  s.stash.maps[1] = Array.from({ length: MAP_TIER_CAP }, () => ({ id: s.nextId++, type: 'map', tier: 1, metre: 5, rarity: 'normal', mods: [] }));
  s.stash.materials.copper = MATERIAL_STASH_STACK;
  s.stash.bought.general = 2;
  for (let i = 0; i < MAX_HELD; i++) s.overflow.push(gear(s, 'helm'));
  while (s.settings.lootFilter.length < MAX_LOOT_RULES) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' });
  s.equipped.battle.helm = gear(s, 'helm', { sockets: 3, gems: [{ gem: 'ruby', grade: 'tiny' }, { gem: 'ruby', grade: 'small' }, { gem: 'starstone', grade: 'perfect' }] });
  s.stash.gems.starstone.perfect = 1_000_000;
  expect([firstEmpty(s.bag), firstEmpty(s.stash.general), s.bag.length, s.stash.general.length])
    .toEqual([-1, -1, BAG_SIZE, START_GENERAL_PAGES * STASH_PAGE_SIZE]);
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
  expect(r.state.overflow.find((o) => o.id === 251)).toMatchObject({ gems: graded });
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

/** Every map in the Map stash, the lowest tier first. */
const tabMaps = (s: GameState): MapItem[] => Object.values(s.stash.maps).flat();

/** A new map that is in no cell: for a run or a last run. */
function looseMap(s: GameState, tier: number, metre: number): MapItem {
  const map = takeMap(s, stashMap(s, tier, metre).id);
  if (map === undefined) throw new Error('map not kept');
  return map;
}

// Seed 1's tier-2 dungeon at metre 2 has 5 rooms, so its boss room is 6.
function running(): GameState {
  const s = newGame(1, 0);
  const map = looseMap(s, 2, 2);
  s.activity = { kind: 'map', run: {
    map, room: 1, bossRoom: 6, life: 40, hitCarry: 0, monsterCarry: 0, regenCarry: 0, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [], items: 0,
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
      startMap(s, stashMap(s, 1, 11).id);
      const r = run(s);
      if (r) r.bossRoom = 8;
    }],
    ['a last run with the wrong boss room', (s) => { const m = looseMap(s, 1, 2); s.lastRun = { map: m, outcome: 'cleared', room: 7, bossRoom: 7, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false }; }],
    ['a negative item count', (s) => { const r = run(s); if (r) r.items = -1; }],
    ['no item count', (s) => { const r = run(s); if (r) delete (r as Partial<typeof r>).items; }],
    ['a whole hit carried', (s) => { const r = run(s); if (r) r.hitCarry = 1; }],
    ['a whole life regenerated and carried', (s) => { const r = run(s); if (r) r.regenCarry = 1; }],
    ['no regeneration carry', (s) => { const r = run(s); if (r) delete (r as Partial<typeof r>).regenCarry; }],
    ['a map id reused in the stash', (s) => { const r = run(s); if (r) s.stash.maps[r.map.tier] = [{ ...r.map }]; }],
    ['an unknown outcome', (s) => { const m = looseMap(s, 1, 2); s.lastRun = { map: m, outcome: 'won' as RunOutcome, room: 6, bossRoom: 6, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false }; }],
    ['a map at metre 0', (s) => { s.stash.maps[1] = [{ id: s.nextId++, type: 'map', tier: 1, metre: 0, rarity: 'normal', mods: [] }]; }],
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
    ['a started map with its own boss room', (s) => { s.activity = { kind: 'dig' }; startMap(s, stashMap(s, 1, 11).id); }],
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

/** Cells with schema 7's tiers and crafted marks taken off their lines, to compare with an older save. */
const untiered = (cells: Cell[]): unknown[] => cells.map((c) =>
  (c?.type === 'gear' ? { ...c, affixes: c.affixes.map(({ stat, value }) => ({ stat, value })) } : c));

it('the schema-5 fixture migrates to one bag, stash pages and map cells', () => {
  const raw = JSON.parse(decompressFromBase64(fixture5.trim())).state;
  const r = decodeSave(fixture5.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  const carried = [...raw.bags.mining, ...raw.bags.battle].filter((c: unknown) => c !== null);
  expect(s.bag).toHaveLength(BAG_SIZE);
  expect(untiered(s.bag.slice(0, carried.length))).toEqual(carried);       // mining bag first, then battle, in order
  expect(s.bag.slice(carried.length).every((c) => c === null)).toBe(true);
  expect(s.stash.general).toHaveLength(START_GENERAL_PAGES * STASH_PAGE_SIZE);
  expect(untiered(s.stash.general.slice(0, 60))).toEqual(raw.stash.general);
  // all 73 maps, grouped by tier, each tier in the old order
  const byTier = [...raw.stash.maps].sort((a: MapItem, b: MapItem) => a.tier - b.tier);
  expect(tabMaps(s)).toEqual(byTier.map((m: object) => ({ ...m, rarity: 'normal', mods: [] })));
  expect(tabMaps(s)).toHaveLength(73);
  expect(Object.values(s.stash.materials).every((n) => n === 0)).toBe(true);
  expect(s.stash.bought).toEqual({ general: 0 });
  expect(untiered(s.overflow)).toEqual(raw.overflow.map((h: { item: unknown }) => h.item));
  expect(s.activity.kind).toBe('map');                                       // the run carries on
  for (const gone of ['depth', 'galleryProgress', 'goldCarry', 'bags']) expect(gone in s).toBe(false);
  expect(s.deepest).toBe(raw.deepest);
});

it('a schema-5 save with no maps comes out with an empty Map stash', () => {
  const env = JSON.parse(decompressFromBase64(fixture5.trim()));
  env.state.stash.maps = [];
  const r = decodeSave(compressToBase64(JSON.stringify(env)));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  expect(r.state.stash.maps).toEqual({});
});

it('every older fixture still loads', () => {
  for (const f of [fixture, fixture2, fixture3, fixture4, fixture5, fixture6, fixture7, fixture8]) expect(decodeSave(f.trim()).ok).toBe(true);
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
  expect(bad((s) => { s.stash.maps[1] = [gear(s, 'pickaxe')]; })).toBe(false);          // gear in the Maps tab
  expect(bad((s) => { s.stash.general[0] = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] }; })).toBe(false);
  expect(bad((s) => { s.bag[0] = { id: s.nextId++, type: 'material', material: 'copper', count: 51 }; })).toBe(false);
  expect(bad((s) => { s.stash.materials.copper = 1_000_001; })).toBe(false);
  expect(bad((s) => { const m = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] }; s.bag[0] = m; s.stash.maps[1] = [{ ...m }]; })).toBe(false); // duplicate id
  expect(bad((s) => { s.stash.bought.general = 3; })).toBe(false);                       // more bought than the 2 pages held
  expect(bad((s) => { s.finds.push({ id: s.nextId++, depth: 1, kind: 'materialVein', amount: 3, tick: 0 }); })).toBe(false); // no material
});

it('a material vein find names its material, and only that kind of find does', () => {
  const s = newGame(3, 0);
  s.finds.push({ id: s.nextId++, depth: 1, kind: 'materialVein', material: 'iron', amount: 3, tick: 0 });
  expect(validateState(s)).toBe(true);
  s.finds.push({ id: s.nextId++, depth: 2, kind: 'chest', material: 'iron', amount: 0, tick: 0 });
  expect(validateState(s)).toBe(false);
});

it('a new game starts with one bag of 60, two General pages and an empty Map stash', () => {
  const s = newGame(1, 0);
  expect([s.bag.length, s.stash.general.length, s.stash.maps]).toEqual([60, 120, {}]);
  expect([s.paused, s.drops, s.deaths, s.stash.bought]).toEqual([false, [], [], { general: 0 }]);
});

it('the schema-6 fixture migrates every line to a tiered prefix or suffix', () => {
  const raw = JSON.parse(decompressFromBase64(fixture6.trim())).state;
  const r = decodeSave(fixture6.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const gearOf = (s: any): any[] => [...s.bag, ...s.stash.general, ...Object.values(s.equipped.mining), ...Object.values(s.equipped.battle), ...s.overflow]
    .filter((c: any) => c?.type === 'gear');
  const before = gearOf(raw); const after = gearOf(r.state);
  expect(after.map((g) => g.id)).toEqual(before.map((g) => g.id));
  for (const [i, g] of after.entries()) {
    const old = before[i];
    expect({ ...g, affixes: undefined }).toEqual({ ...old, affixes: undefined });          // nothing else changes
    expect(g.affixes.map((a: ModLine) => [a.stat, a.value])).toEqual(old.affixes.map((a: any) => [a.stat, a.value]));
    for (const a of g.affixes) expect(a.tier).toBe(g.rarity === 'legendary' ? 0 : Math.min(tierFor(a.stat, a.value), g.ilvl + MAX_TIER_OVER_CAP));
    for (const side of ['prefix', 'suffix'] as const) expect(sideCount(g.affixes, side)).toBeLessThanOrEqual(3);
    const sides = g.affixes.map((a: ModLine) => MOD_SIDE[a.stat]);
    // a line is crafted exactly when it is the 4th or later on its side, or the 2nd on a magic item's side
    g.affixes.forEach((a: ModLine, j: number) => {
      const before = sides.slice(0, j).filter((x: string) => x === sides[j]).length;
      expect(a.crafted === true).toBe(before >= (g.rarity === 'magic' ? 1 : 3));
    });
  }
  expect(after.some((g) => g.affixes.some((a: ModLine) => a.crafted))).toBe(true);    // the fixture has such items
});

it('the validator holds the schema-7 lines', () => {
  const ok = stocked();
  const bad = (change: (s: GameState) => void) => { const s = structuredClone(ok); change(s); return decodes(s); };
  const pick = (s: GameState) => s.equipped.mining.pickaxe!;
  const rare = (s: GameState, affixes: ModLine[]) => { Object.assign(pick(s), { rarity: 'rare', affixes }); };
  const line = (stat: ModLine['stat'], tier = 1, crafted = false): ModLine => ({ stat, value: 3, tier, ...(crafted ? { crafted: true } : {}) });
  expect(decodes(ok)).toBe(true);
  // a rare holds 3 prefixes, 3 suffixes and 2 crafted lines
  const full = [line('goldYield'), line('diamondYield'), line('veinYield'), line('chestFind'), line('gemFind'), line('mapFind'),
    line('sellBonus', 1, true), line('oreFind', 1, true)];
  expect(bad((s) => rare(s, full))).toBe(true);
  expect(bad((s) => rare(s, [...full.slice(0, 3), line('sellBonus')]))).toBe(false);                    // a 4th prefix
  expect(bad((s) => rare(s, [...full, line('salvageYield', 1, true)]))).toBe(false);                    // a 3rd crafted line
  expect(bad((s) => rare(s, [line('goldYield', 4 + MAX_TIER_OVER_CAP)]))).toBe(true);                    // ilvl 4: T6 at most
  expect(bad((s) => rare(s, [line('goldYield', 5 + MAX_TIER_OVER_CAP)]))).toBe(false);
  expect(bad((s) => rare(s, [line('goldYield', 0)]))).toBe(false);                                       // tier 0 is a legendary's
  expect(bad((s) => rare(s, [line('goldYield', 1.5)]))).toBe(false);
  expect(bad((s) => rare(s, [{ ...line('goldYield'), crafted: false as never }]))).toBe(false);
  expect(bad((s) => rare(s, [{ ...line('goldYield'), note: 'x' } as ModLine]))).toBe(false);                // a key a line doesn't have
  expect(bad((s) => { pick(s).affixes = [line('goldYield'), line('diamondYield')]; })).toBe(false);      // two prefixes on a magic item
  expect(bad((s) => { pick(s).affixes = [line('goldYield'), line('chestFind')]; })).toBe(true);
  expect(bad((s) => { pick(s).affixes = [line('goldYield'), line('diamondYield', 1, true)]; })).toBe(true);
  expect(bad((s) => { Object.assign(pick(s), { rarity: 'legendary', affixes: [line('goldYield', 0)] }); })).toBe(true);
  expect(bad((s) => { Object.assign(pick(s), { rarity: 'legendary', affixes: [line('goldYield', 1)] }); })).toBe(false);
  expect(bad((s) => { pick(s).sealed = true; })).toBe(true);
  expect(bad((s) => { (pick(s) as { sealed?: unknown }).sealed = false; })).toBe(false);
  expect(bad((s) => { (pick(s) as { sealed?: unknown }).sealed = 'yes'; })).toBe(false);
});

it('tierFor answers at once, even for absurd values', () => {
  const t0 = performance.now();
  expect(tierFor('digPower', 1_000_000)).toBe(500_000);
  expect(tierFor('ticksPerClick', 1_000_000)).toBeGreaterThan(1);
  expect(tierFor('digPower', 1e300)).toBeGreaterThan(1);
  expect(performance.now() - t0).toBeLessThan(50);
  // the closed form agrees with walking the tiers one by one
  for (const stat of Object.keys(MOD_SIDE) as ModLine['stat'][]) {
    for (let v = -3; v <= 400; v++) {
      let t = 1;
      while (tierRange(stat, t).hi < v) t++;
      expect(tierFor(stat, v), `${stat} ${v}`).toBe(t);
    }
  }
});

it('a schema-6 line with an absurd value is rejected, not hung on', () => {
  for (const value of [1e999, -1e999, 1e300, 2.5, 'VALUE_TEXT']) {
    const env = JSON.parse(decompressFromBase64(fixture6.trim()));
    const item = [...env.state.bag, ...env.state.stash.general].find((c) => c?.type === 'gear' && c.rarity !== 'legendary' && c.affixes.length > 0);
    item.affixes[0].value = 'VALUE';
    const literal = value === 1e999 ? '1e999' : value === -1e999 ? '-1e999' : typeof value === 'string' ? '"x"' : String(value);
    const text = JSON.stringify(env).replace('"VALUE"', literal);   // JSON.stringify would turn Infinity into null
    expect(decodeSave(compressToBase64(text)), String(value)).toEqual({ ok: false, reason: 'invalid' });
  }
});

it('a schema-6 line whose value is far above its item level keeps the value, at the highest tier the item allows', () => {
  const env = JSON.parse(decompressFromBase64(fixture6.trim()));
  const item = [...env.state.bag, ...env.state.stash.general].find((c) => c?.type === 'gear' && c.rarity === 'rare');
  const line = item.affixes[0];
  line.value = tierRange(line.stat, item.ilvl + 5).lo;
  expect(tierFor(line.stat, line.value)).toBe(item.ilvl + 5);
  const r = decodeSave(compressToBase64(JSON.stringify(env)));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  const after = [...r.state.bag, ...r.state.stash.general].find((c) => c?.id === item.id);
  expect(after?.type === 'gear' && after.affixes[0]).toEqual({ stat: line.stat, value: line.value, tier: item.ilvl + MAX_TIER_OVER_CAP });
});

it('a schema-6 line keeps only its stat and value, with the tier and crafted mark the migration gives it', () => {
  const env = JSON.parse(decompressFromBase64(fixture6.trim()));
  const item = [...env.state.bag, ...env.state.stash.general].find((c) => c?.type === 'gear' && c.rarity === 'rare' && c.affixes.length > 0);
  item.affixes[0].note = 'stray';
  item.affixes[0].crafted = 'yes';
  const r = decodeSave(compressToBase64(JSON.stringify(env)));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  const after = [...r.state.bag, ...r.state.stash.general].find((c) => c?.id === item.id);
  if (after?.type !== 'gear') throw new Error('item lost');
  for (const a of after.affixes) expect(Object.keys(a).sort()).toEqual(a.crafted ? ['crafted', 'stat', 'tier', 'value'] : ['stat', 'tier', 'value']);
  expect(after.affixes[0]?.crafted).toBeUndefined();
});

it('a schema-6 run in progress loads with an empty life-regeneration carry', () => {
  const s = running();
  if (s.activity.kind !== 'map') throw new Error('no run');
  delete (s.activity.run as Partial<MapRun>).regenCarry;
  const r = decodeSave(raw({ schema: 6, savedAt: 0, state: s }));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  expect(r.state.activity.kind === 'map' && r.state.activity.run.regenCarry).toBe(0);
});

it('the schema-7 fixture migrates every map to a normal map with no modifiers, keeping the rest', () => {
  const old = JSON.parse(decompressFromBase64(fixture7.trim())).state;
  const r = decodeSave(fixture7.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const normal = (m: any) => ({ ...m, rarity: 'normal', mods: [] });
  const mapsOf = (s: any, tab: any[]): any[] => [
    ...s.bag, ...tab, s.activity.kind === 'map' ? s.activity.run.map : null, s.lastRun?.map ?? null,
  ].filter((c: any) => c?.type === 'map');
  // the Maps tab comes out grouped by tier, each tier in its old order
  const oldTab = old.stash.maps.filter((m: any) => m !== null);
  const before = mapsOf(old, [...oldTab].sort((a: any, b: any) => a.tier - b.tier));
  expect(before).toHaveLength(1 + 51 + 1 + 1);   // the bag, the Maps tab, the run in progress and the last run
  expect(mapsOf(r.state, tabMaps(r.state))).toEqual(before.map(normal));
  for (const [tier, list] of Object.entries(r.state.stash.maps)) {
    expect(list).toEqual(oldTab.filter((m: any) => m.tier === Number(tier)).map(normal));
  }
  expect(r.state.gold).toBe(old.gold);   // no Maps page was bought
  expect(old.stash.bought.maps).toBe(0);
  expect(r.state.activity.kind === 'map' && r.state.activity.run.map).toEqual({ ...old.activity.run.map, rarity: 'normal', mods: [] });
  expect(r.state.lastRun?.map).toEqual({ ...old.lastRun.map, rarity: 'normal', mods: [] });
});

it('a malformed schema-7 save is left for the validator to reject', () => {
  for (const change of [(s: any) => { s.stash.maps = 'x'; }, (s: any) => { s.bag = null; }, (s: any) => { s.stash.maps[0] = { ...s.stash.maps.find((m: any) => m), metre: 0 }; }]) {
    const env = JSON.parse(decompressFromBase64(fixture7.trim()));
    change(env.state);
    expect(decodeSave(raw(env))).toEqual({ ok: false, reason: 'invalid' });
  }
});

it('the validator holds the schema-8 maps', () => {
  const ok = running();
  const mod = (kind: MapMod['kind'], tier = 1, value = 10): MapMod => ({ kind, tier, value });
  const SIX = MAP_MOD_KINDS.map((k) => mod(k));
  // a tier-4 map in the Maps tab, enchanted as `change` says
  const check = (change: (m: MapItem) => void) => { const s = structuredClone(ok); change(stashMap(s, 4, 327)); return decodes(s); };
  const as = (rarity: MapItem['rarity'], mods: MapMod[], extra: Partial<MapItem> = {}) => (m: MapItem) => { Object.assign(m, { rarity, mods, ...extra }); };
  expect(check(() => {})).toBe(true);
  expect(check(as('magic', [mod('monsterLife')]))).toBe(true);
  expect(check(as('magic', [mod('monsterLife'), mod('hardened')]))).toBe(true);
  expect(check(as('rare', SIX))).toBe(true);
  expect(check(as('rare', SIX, { sealed: true }))).toBe(true);
  expect(check(as('rare', [mod('monsterLife', 6)]))).toBe(true);                                      // tier 4 + 2
  expect(check(as('rare', [mod('monsterLife'), mod('monsterLife')]))).toBe(false);                     // a repeated kind
  expect(check(as('rare', [...SIX, mod('bossPower')]))).toBe(false);                                   // more than 6
  expect(check(as('magic', [mod('monsterLife'), mod('monsterDamage'), mod('monsterSpeed')]))).toBe(false);
  expect(check(as('normal', [mod('monsterLife')]))).toBe(false);
  expect(check(as('rare', [mod('monsterLife', 0)]))).toBe(false);
  expect(check(as('rare', [mod('monsterLife', 7)]))).toBe(false);                                      // above tier 4 + 2
  expect(check(as('rare', [mod('monsterLife', 1, 2.5)]))).toBe(false);
  expect(check(as('rare', [mod('monsterLife', 1.5)]))).toBe(false);
  expect(check(as('rare', [mod('golden' as never)]))).toBe(false);
  expect(check(as('rare', [{ ...mod('monsterLife'), note: 'x' } as MapMod]))).toBe(false);             // a key a modifier doesn't have
  expect(check(as('legendary' as never, []))).toBe(false);
  expect(check((m) => { delete (m as Partial<MapItem>).mods; })).toBe(false);
  expect(check((m) => { delete (m as Partial<MapItem>).rarity; })).toBe(false);
  expect(check(as('rare', SIX, { sealed: false as never }))).toBe(false);
  expect(check(as('rare', SIX, { sealed: 'yes' as never }))).toBe(false);
  // the running map is held to the same rules
  const s = structuredClone(ok);
  if (s.activity.kind !== 'map') throw new Error('no run');
  Object.assign(s.activity.run.map, { rarity: 'magic', mods: [mod('monsterLife', 1), mod('monsterDamage', 1), mod('bossPower', 1)] });
  expect(decodes(s)).toBe(false);
});

it('a found map is a normal map with no modifiers', () => {
  const s = newGame(1, 0);
  addMap(s, 3, 40);
  expect(s.bag[0]).toEqual(expect.objectContaining({ type: 'map', rarity: 'normal', mods: [] }));
  expect(s.bag[0]?.type === 'map' && s.bag[0].sealed).toBeUndefined();
});

it('the schema-8 fixture migrates to hold mode, keeps its held gear, groups its maps by tier and refunds its Maps page', () => {
  const old = JSON.parse(decompressFromBase64(fixture8.trim())).state;
  const r = decodeSave(fixture8.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s.paused).toBe(false);
  expect([s.drops, s.deaths]).toEqual([[], []]);
  const { bagFull, ...settings } = old.settings;
  expect(bagFull).toBe('sellWorst');
  expect(s.settings).toEqual(settings);
  expect(old.overflow).toHaveLength(4);
  expect(s.overflow).toEqual(old.overflow);
  expect(s.gold).toBe(old.gold + 5000);
  expect(s.gold).toBe(83_311);
  expect(s.stash.bought).toEqual({ general: 0 });
  expect(Object.keys(s.stash.maps)).toEqual(['1', '2', '3', '4']);
  expect(Object.values(s.stash.maps).map((list) => list.length)).toEqual([2, 1, 4, 3]);
  const oldTab = old.stash.maps.filter((m: MapItem | null) => m !== null);
  for (const [tier, list] of Object.entries(s.stash.maps)) {
    expect(list.every((m) => m.tier === Number(tier))).toBe(true);
    expect(list).toEqual(oldTab.filter((m: MapItem) => m.tier === Number(tier)));
  }
  expect([s.bag, s.equipped, s.stash.general, s.activity, s.lastRun, s.finds])
    .toEqual([old.bag, old.equipped, old.stash.general, old.activity, old.lastRun, old.finds]);
  // the run in progress plays on to its end
  const runMap = old.activity.run.map.id;
  for (let t = 0; t < 20_000 && s.activity.kind !== 'dig'; t += 50) applyTicks(s, 50, deriveStats(s));
  expect(s.activity.kind).toBe('dig');
  expect(s.lastRun?.map.id).toBe(runMap);
  expect(validateState(s)).toBe(true);
});

it('a migrated tier past 200 spills into the bag, then the held list, then is sold', () => {
  const env = JSON.parse(decompressFromBase64(fixture8.trim()));
  const old = env.state;
  const first = old.nextId;
  old.stash.maps = Array.from({ length: 5 * STASH_PAGE_SIZE }, (_, i) => (
    i < 261 ? { id: first + i, type: 'map', tier: 3, metre: 214, rarity: 'normal', mods: [] } : null));
  old.stash.bought.maps = 4;
  old.nextId = first + 261;
  const r = decodeSave(raw(env));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  const s = r.state;
  expect(Object.keys(s.stash.maps)).toEqual(['3']);
  expect(s.stash.maps[3]?.map((m) => m.id)).toEqual(Array.from({ length: 200 }, (_, i) => first + i));
  expect(s.bag).toEqual(old.bag);   // it was full
  expect(s.overflow).toHaveLength(MAX_HELD);
  expect(s.overflow.slice(0, 4)).toEqual(old.overflow);
  expect(s.overflow.slice(4).map((m) => m.id)).toEqual(Array.from({ length: 56 }, (_, i) => first + 200 + i));
  // the four bought pages are refunded, and the last 5 maps are sold at 25 × 3² each
  expect(s.gold).toBe(old.gold + 5000 * (1 + 4 + 9 + 16) + 5 * 225);
});

it('a migrated tier past 200 fills the bag\'s empty cells first', () => {
  const env = JSON.parse(decompressFromBase64(fixture8.trim()));
  const old = env.state;
  const first = old.nextId;
  old.stash.maps = Array.from({ length: 4 * STASH_PAGE_SIZE }, (_, i) => (
    i < 203 ? { id: first + i, type: 'map', tier: 3, metre: 214, rarity: 'normal', mods: [] } : null));
  old.stash.bought.maps = 3;
  old.nextId = first + 203;
  old.bag[7] = null;
  old.bag[50] = null;
  const r = decodeSave(raw(env));
  if (!r.ok) throw new Error(`rejected: ${r.reason}`);
  const s = r.state;
  expect([s.bag[7]?.id, s.bag[50]?.id]).toEqual([first + 200, first + 201]);
  expect(s.overflow.map((i) => i.id)).toEqual([...old.overflow.map((i: { id: number }) => i.id), first + 202]);
  expect(s.gold).toBe(old.gold + 5000 * (1 + 4 + 9));
});

it('a malformed schema-8 save is left for the validator to reject', () => {
  const changes = [
    (s: any) => { s.stash.maps = 'x'; },
    (s: any) => { s.stash.maps[0] = { ...s.stash.maps.find((m: any) => m), tier: 1.5 }; },
    (s: any) => { s.stash.maps[0] = { ...s.stash.maps.find((m: any) => m), rarity: 'legendary' }; },
    (s: any) => { s.stash.maps[0] = 7; },
    (s: any) => { s.stash.bought = null; },
    (s: any) => { s.stash.bought.maps = 1e15; },
    (s: any) => { s.settings = null; },
    (s: any) => { s.overflow = 'x'; },
  ];
  for (const change of changes) {
    const env = JSON.parse(decompressFromBase64(fixture8.trim()));
    change(env.state);
    const before = structuredClone(env.state);
    expect(MIGRATIONS[8]?.(env.state)).toBe(env.state);
    expect(env.state).toEqual(before);
    expect(decodeSave(raw(env))).toEqual({ ok: false, reason: 'invalid' });
  }
});

describe('the validator holds the schema-9 shapes', () => {
  // A run on seed 1's tier-2 map at metre 2, whose boss room is 6; a drop entry and a death entry to vary.
  function logged(): GameState {
    const s = running();
    const map: MapItem = { id: s.nextId++, type: 'map', tier: 2, metre: 2, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 1, value: 10 }] };
    const drop: DropEntry = {
      id: s.nextId++, kind: 'gear', name: 'Test ring', rarity: 'magic', base: 'ring', count: 1, origin: { kind: 'metre', metre: 12 },
      trail: [{ event: 'bag' }, { event: 'sold', gold: 48 }],
    };
    const death: DeathEntry = { id: s.nextId++, tick: 40, at: 1_000, map, room: 3, bossRoom: 6, killer: 'Mud Slime' };
    s.drops.push(drop);
    s.deaths.push(death);
    return s;
  }
  const drop0 = (s: GameState): DropEntry => s.drops[0] as DropEntry;
  const death0 = (s: GameState): DeathEntry => s.deaths[0] as DeathEntry;
  const bad = (change: (s: GameState) => void) => { const s = logged(); change(s); return validateState(s); };

  it('accepts what the logs and the Map stash may hold', () => {
    expect(validateState(logged())).toBe(true);
    expect(bad((s) => { s.paused = true; })).toBe(true);
    expect(bad((s) => { s.stash.maps[3] = []; })).toBe(true);
    expect(bad((s) => {
      s.drops.push(
        { id: s.nextId++, kind: 'map', name: 'Tier 4 map', rarity: 'rare', base: 'map', count: 1, origin: { kind: 'map', tier: 3, room: 2 }, trail: [{ event: 'bag' }, { event: 'salvaged', materials: { copper: 2, tin: 1 } }] },
        { id: s.nextId++, kind: 'gem', name: 'Tiny ruby', rarity: 'gem', base: 'ruby', count: 3, origin: { kind: 'merchant' }, trail: [{ event: 'held' }] },
        { id: s.nextId++, kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 130, origin: { kind: 'metre', metre: 60 }, trail: [{ event: 'bag' }] },
      );
    })).toBe(true);
    expect(bad((s) => { drop0(s).trail = Array.from({ length: MAX_TRAIL_STEPS }, () => ({ event: 'stashed' as const })); })).toBe(true);
    expect(bad((s) => { s.nextId += DROP_LOG_LIMIT; while (s.drops.length < DROP_LOG_LIMIT) s.drops.push({ ...drop0(s), id: s.nextId - 1 - s.drops.length }); })).toBe(true);
    expect(bad((s) => { while (s.deaths.length < DEATH_LOG_LIMIT) s.deaths.push(structuredClone(death0(s))); })).toBe(true);
    // a death's map may share its id with the last run's map
    expect(bad((s) => { s.lastRun = { map: structuredClone(death0(s).map), outcome: 'died', room: 3, bossRoom: 6, gained: GAINS, items: 0, seen: true }; })).toBe(true);
  });

  it('refuses anything else', () => {
    const cases: [string, (s: GameState) => void][] = [
      ['paused as text', (s) => { (s as { paused: unknown }).paused = 'yes'; }],
      ['a maps key 3.5', (s) => { (s.stash.maps as Record<string, MapItem[]>)['3.5'] = []; }],
      ['a maps key x', (s) => { (s.stash.maps as Record<string, MapItem[]>).x = []; }],
      ['a maps key 0', (s) => { s.stash.maps[0] = []; }],
      ['a tier list of 201', (s) => { s.stash.maps[1] = Array.from({ length: MAP_TIER_CAP + 1 }, () => ({ id: s.nextId++, type: 'map', tier: 1, metre: 5, rarity: 'normal', mods: [] })); }],
      ['a map under the wrong tier', (s) => { s.stash.maps[2] = [{ id: s.nextId++, type: 'map', tier: 1, metre: 5, rarity: 'normal', mods: [] }]; }],
      ['a null in a tier list', (s) => { s.stash.maps[1] = [null as never]; }],
      ['a Maps bought count', (s) => { (s.stash.bought as Record<string, number>).maps = 0; }],
      ['61 held items', (s) => { for (let i = 0; i < MAX_HELD + 1; i++) s.overflow.push(gear(s, 'pickaxe')); }],
      ['a drop log of 301', (s) => { s.nextId += DROP_LOG_LIMIT + 1; while (s.drops.length < DROP_LOG_LIMIT + 1) s.drops.push({ ...drop0(s), id: s.nextId - 1 - s.drops.length }); }],
      ['a drop step eaten', (s) => { drop0(s).trail.push({ event: 'eaten' as never }); }],
      ['a drop id from the future', (s) => { drop0(s).id = s.nextId; }],
      ['a duplicate drop id', (s) => { s.drops.push({ ...drop0(s) }); }],
      ['an empty trail', (s) => { drop0(s).trail = []; }],
      ['a trail of 25 steps', (s) => { drop0(s).trail = Array.from({ length: MAX_TRAIL_STEPS + 1 }, () => ({ event: 'stashed' as const })); }],
      ['a drop with no items', (s) => { drop0(s).count = 0; }],
      ['a drop with an unknown kind', (s) => { (drop0(s) as { kind: string }).kind = 'chest'; }],
      ['a drop with an empty name', (s) => { drop0(s).name = ''; }],
      ['a map drop of a gear rarity', (s) => { Object.assign(drop0(s), { base: 'map', rarity: 'legendary' }); }],
      ['a drop from nowhere', (s) => { (drop0(s) as { origin: unknown }).origin = { kind: 'chest' }; }],
      ['a drop from a map room 0', (s) => { drop0(s).origin = { kind: 'map', tier: 2, room: 0 }; }],
      ['a negative Gold step', (s) => { drop0(s).trail[1] = { event: 'sold', gold: -1 }; }],
      ['a step of an unknown material', (s) => { drop0(s).trail[1] = { event: 'salvaged', materials: { gold: 1 } as never }; }],
      ['a death log of 51', (s) => { while (s.deaths.length < DEATH_LOG_LIMIT + 1) s.deaths.push(structuredClone(death0(s))); }],
      ['a death on a map at metre 0', (s) => { death0(s).map.metre = 0; }],
      ['a death with no killer', (s) => { death0(s).killer = ''; }],
      ['a death id from the future', (s) => { death0(s).id = s.nextId; }],
      ['a death at a negative tick', (s) => { death0(s).tick = -1; }],
      ['a death in the wrong boss room', (s) => { death0(s).bossRoom = 7; }],
      ['a death past the boss room', (s) => { death0(s).room = 7; }],
    ];
    for (const [name, change] of cases) expect(bad(change), name).toBe(false);
  });

  it('a held map, a held material stack of 50 and a held gem stack stay valid', () => {
    expect(bad((s) => {
      s.overflow.push(
        { id: s.nextId++, type: 'map', tier: 3, metre: 214, rarity: 'normal', mods: [] },
        { id: s.nextId++, type: 'material', material: 'copper', count: MATERIAL_BAG_STACK },
        gem(s, 'sapphire', { count: 25 }),
      );
    })).toBe(true);
  });
});
