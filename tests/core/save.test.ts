import { expect, it } from 'vitest';
import { compressToBase64, decompressFromBase64 } from 'lz-string';
import fixture from '../fixtures/save-schema-1.txt?raw';
import fixture2 from '../fixtures/save-schema-2.txt?raw';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import { applyTicks } from '../../src/core/dig';
import { BAG_SIZE, MAX_LOOT_RULES, MAX_OVERFLOW, STASH_SIZE } from '../../src/core/balance';
import { emptyInventory, firstEmpty } from '../../src/core/cells';
import { addMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, migrate, SCHEMA_VERSION } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { Cell, GemGrade, GemType } from '../../src/core/items';
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

it('migrates a real schema-1 save', () => {
  const r = decodeSave(fixture.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(r.savedAt).toBe(1_761_206_300_000);
  expect(s).toMatchObject({ gold: 10_972, diamonds: 119, depth: 123, deepest: 125, tickCount: 6300, goldCarry: 0, nextId: 36 });
  const empty = emptyInventory();
  expect([s.equipped, s.bags, { ...s.stash, maps: [] }, s.overflow, s.lootTally, s.settings]).toEqual([
    empty.equipped, empty.bags, empty.stash, empty.overflow,
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
  s.bags.mining[2] = gem(s, 'emerald', { grade: 'big', count: 7 });
  s.bags.battle[0] = (gear(s, 'weapon', { rarity: 'rare', affixes: [{ stat: 'critChance', value: 3 }, { stat: 'life', value: 20 }, { stat: 'armor', value: 12 }] }));
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
    ['battle gear in the mining bag', (s) => { s.bags.mining[0] = gear(s, 'weapon'); }],
    ['a bag of 25 cells', (s) => { s.bags.mining.push(null); }],
    ['a bag of 23 cells', (s) => { s.bags.mining.pop(); }],
    ['a General tab of 61 cells', (s) => { s.stash.general.push(null); }],
    ['a stack of 26', (s) => { s.bags.mining[0] = gem(s, 'ruby', { count: 26 }); }],
    ['an empty stack', (s) => { s.bags.mining[0] = gem(s, 'ruby', { count: 0 }); }],
    ['a gem in General', (s) => { s.stash.general[0] = gem(s) as never; }],
    ['worn under the wrong slot', (s) => { s.equipped.mining.lamp = gear(s, 'pickaxe'); }],
    ['worn in the wrong set', (s) => { s.equipped.battle.pickaxe = gear(s, 'pickaxe'); }],
    ['a shared id', (s) => { const g = gem(s); g.id = s.bags.mining[2]!.id; s.bags.mining[0] = g; }],
    ['an id from the future', (s) => { s.bags.mining[0] = gem(s, 'ruby', { id: 999 }); }],
    ['more gems than sockets', (s) => { s.equipped.mining.pickaxe!.gems.push({ gem: 'ruby', grade: 'tiny' }); }],
    ['a socketed gem with an unknown grade', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'ruby', grade: 'huge' as GemGrade }; }],
    ['a socketed gem with a bad type', (s) => { s.equipped.mining.pickaxe!.gems[0] = { gem: 'opal' as GemType, grade: 'tiny' }; }],
    ['a battle stat on mining gear', (s) => { s.equipped.mining.pickaxe!.affixes.push({ stat: 'damage', value: 3 }); }],
    ['a fractional stat', (s) => { s.equipped.mining.pickaxe!.implicit.value = 2.5; }],
    ['an unknown gem', (s) => { s.bags.mining[0] = { ...gem(s), gem: 'opal' as GemType }; }],
    ['an unknown grade on a stack', (s) => { s.bags.mining[0] = { ...gem(s), grade: 'huge' as GemGrade }; }],
    ['a Gems-tab count of 1,000,001', (s) => { s.stash.gems.ruby.tiny = 1_000_001; }],
    ['a fractional Gems-tab count', (s) => { s.stash.gems.ruby.tiny = 1.5; }],
    ['a negative Gems-tab count', (s) => { s.stash.gems.ruby.tiny = -1; }],
    ['a missing Gems-tab grade', (s) => { delete (s.stash.gems.ruby as Partial<Record<GemGrade, number>>).perfect; }],
    ['an extra Gems-tab type', (s) => { (s.stash.gems as Record<string, unknown>).opal = s.stash.gems.ruby; }],
    ['an unknown loot action', (s) => { s.settings.lootFilter.push({ rarity: 'any', target: 'any', action: 'burn' as LootAction }); }],
    ['too many loot rules', (s) => { for (let i = 0; i < MAX_LOOT_RULES + 1; i++) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' }); }],
    ['an unknown bag-full mode', (s) => { s.settings.bagFull = 'maybe' as BagFullMode; }],
    ['a find without an id', (s) => { s.finds.push({ depth: 0, kind: 'chest', amount: 0, tick: 0 } as FindRecord); }],
    ['a whole Gold left in the carry', (s) => { s.goldCarry = 1; }],
    ['held loot for the wrong bag', (s) => { s.overflow.push({ bag: 'mining', item: gear(s, 'ring') }); }],
    ['11 held items', (s) => { for (let i = 0; i < MAX_OVERFLOW + 1; i++) s.overflow.push({ bag: 'mining', item: gear(s, 'pickaxe') }); }],
    ['a held gem', (s) => { s.overflow.push({ bag: 'battle', item: gem(s) as never }); }],
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

it('accepts the limits: full grids, 10 held items, 20 rules, 3 gems in 3 sockets, a Gems-tab count of 1,000,000', () => {
  const s = stocked();
  s.bags.mining = s.bags.mining.map((c) => c ?? gem(s, 'sapphire', { count: 25 }));
  s.bags.battle = s.bags.battle.map((c) => c ?? gear(s, 'ring'));
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'boots'));
  for (let i = 0; i < MAX_OVERFLOW; i++) s.overflow.push({ bag: 'battle', item: gear(s, 'helm') });
  while (s.settings.lootFilter.length < MAX_LOOT_RULES) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' });
  s.equipped.battle.helm = gear(s, 'helm', { sockets: 3, gems: [{ gem: 'ruby', grade: 'tiny' }, { gem: 'ruby', grade: 'small' }, { gem: 'starstone', grade: 'perfect' }] });
  s.stash.gems.starstone.perfect = 1_000_000;
  expect([firstEmpty(s.bags.mining), firstEmpty(s.bags.battle), firstEmpty(s.stash.general), s.bags.mining.length, s.stash.general.length])
    .toEqual([-1, -1, -1, BAG_SIZE, STASH_SIZE]);
  expect(decodeSave(encodeSave(s, 1))).toEqual({ ok: true, state: s, savedAt: 1 });
});

it('migrates a real schema-3 save: gems become graded stacks in fixed slots', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(s).toMatchObject({ worldSeed: '9090', worldGen: 1, gold: 81_754, diamonds: 1_170, nextId: 267 });
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

it('migration keeps every gem', () => {
  const r = decodeSave(fixture3.trim());
  if (!r.ok) throw new Error(r.reason);
  type Socketed = { type?: string; gems?: unknown[] } | null | undefined;
  const sockets = (list: Socketed[]) => list.reduce((n, it) => n + (it?.gems?.length ?? 0), 0);
  const everywhere = (st: { bags: { mining: Socketed[]; battle: Socketed[] }; general: Socketed[]; held: Socketed[]; worn: Socketed[] }) =>
    sockets([...st.bags.mining, ...st.bags.battle, ...st.general, ...st.held, ...st.worn]);
  const old = JSON.parse(decompressFromBase64(fixture3.trim())).state;
  const oldSockets = everywhere({
    bags: old.bags, general: old.stash, held: old.overflow.map((o: { item: Socketed }) => o.item),
    worn: [...Object.values(old.equipped.mining), ...Object.values(old.equipped.battle)] as Socketed[],
  });
  const st = r.state;
  const newSockets = everywhere({
    bags: st.bags, general: st.stash.general, held: st.overflow.map((o) => o.item),
    worn: [...Object.values(st.equipped.mining), ...Object.values(st.equipped.battle)],
  });
  expect(newSockets).toBe(oldSockets);
  const total = (state: GameState) =>
    [...state.bags.mining, ...state.bags.battle].reduce((n, c) => n + (c?.type === 'gem' ? c.count : 0), 0)
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
    ...r.state.bags.mining, ...r.state.bags.battle, ...r.state.stash.general, ...r.state.overflow.map((o) => o.item),
  ].find((c) => c?.id === id);
  expect(byId(bagItem.id)).toMatchObject({ gems: graded });
  expect(byId(stashItem.id)).toMatchObject({ gems: graded });
  expect(r.state.overflow.find((o) => o.item.id === 251)?.item.gems).toEqual(graded);
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
    ...st.bags.mining, ...st.bags.battle, ...st.stash.general, ...st.overflow.map((o) => o.item),
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
  expect(r.state.bags.battle[0]).toEqual({ id: 249, type: 'gem', gem: 'ruby', grade: 'tiny', count: 24 });
  expect(r.state.bags.battle.slice(1).every((c) => c === null)).toBe(true);
  expect(r.state.stash.gems.emerald.small).toBe(1);
  expect(r.state.overflow).toEqual([]);
});

it('the schema-3 migration leaves a state that is not the old shape alone', () => {
  const s = newGame(1, 0);
  expect(decodeSave(raw({ schema: 3, savedAt: 0, state: s }))).toEqual({ ok: true, state: s, savedAt: 0 });
  expect(decodeSave(raw({ schema: 3, savedAt: 0, state: { ...s, overflow: 'x' } }))).toEqual({ ok: false, reason: 'invalid' });
});

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
  expect(r1.state.stash.maps.map((m) => [m.tier, m.metre])).toEqual([[1, 2], [1, 23], [1, 41], [2, 60], [2, 67]]);
  expect(r2.state.stash.maps.map((m) => [m.id, m.tier, m.metre])).toEqual([[79, 1, 2], [80, 1, 3], [81, 1, 4], [82, 1, 36], [83, 1, 47], [84, 2, 66], [85, 2, 79]]);
});

function running(): GameState {
  const s = newGame(1, 0);
  const map = addMap(s, 2, 60);
  s.stash.maps = [];
  s.activity = { kind: 'map', run: {
    map, room: 1, bossRoom: 6, life: 40, hitCarry: 0, monsterCarry: 0, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [],
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

const decodes = (s: GameState) => decodeSave(raw({ schema: SCHEMA_VERSION, savedAt: 0, state: s })).ok;
const GAINS = { xp: 5, souls: 2, gold: 9, levels: 1 };

it('accepts the legal extremes of maps, runs and levels', () => {
  const run = (s: GameState) => { if (s.activity.kind !== 'map') throw new Error('no run'); return s.activity.run; };
  const monster = (s: GameState) => { const m = run(s).queue[0]; if (!m) throw new Error('no monster'); return m; };
  const cases: [string, (s: GameState) => void][] = [
    ['level 60 at xp 0', (s) => { s.level = 60; s.xp = 0; }],
    ['the last xp below a level', (s) => { s.level = 2; s.xp = 282; }],
    ['a champion with two distinct mods', (s) => { Object.assign(monster(s), { rank: 'champion', mods: ['brutal', 'swift'] }); }],
    ['the boss room with a boss in front', (s) => { run(s).room = 6; monster(s).rank = 'boss'; }],
    ['a log with heal, drop and level lines', (s) => {
      run(s).log = [
        { kind: 'heal', monster: 'Mud Slime', amount: 3 },
        { kind: 'drop', note: { name: 'Test ring', rarity: 'magic', base: 'ring', outcome: 'bag', value: 0 } },
        { kind: 'level', level: 2 },
      ];
    }],
    ['a cleared last run in the boss room', (s) => {
      const m = addMap(s, 1, 1);
      s.stash.maps.pop();
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
