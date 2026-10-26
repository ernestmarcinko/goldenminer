import { describe, expect, it } from 'vitest';
import fixture8 from '../fixtures/save-schema-8.txt?raw';
import { DEATH_LOG_LIMIT, DROP_LOG_LIMIT, GEM_BAG_STACK, MATERIAL_STASH_STACK, MAX_HELD, MAX_TRAIL_STEPS } from '../../src/core/balance';
import { metreTier } from '../../src/core/bands';
import { deriveBattleStats } from '../../src/core/battle';
import { advance } from '../../src/core/clock';
import { onKill } from '../../src/core/combat';
import { craft } from '../../src/core/crafting';
import { applyTicks, collect } from '../../src/core/dig';
import { logDeath, logDrop, trail } from '../../src/core/dropLog';
import { equip, sell, sendItem, unequip } from '../../src/core/inventory';
import { MATERIALS } from '../../src/core/items';
import type { GearItem, Item, MapItem } from '../../src/core/items';
import { drainOverflow, receiveItem, receiveMaterial } from '../../src/core/loot';
import { addMap, leaveMap, startMap } from '../../src/core/maps';
import { gamble } from '../../src/core/merchant';
import { newGame } from '../../src/core/newGame';
import { decodeSave, validateState } from '../../src/core/save';
import { soulUpgrade } from '../../src/core/soulUpgrade';
import { deriveStats } from '../../src/core/stats';
import type { DropEntry, DropOrigin, GameState, MapRun, MonsterState } from '../../src/core/types';
import { gear, gem, stashMap } from '../helpers/items';

const HERE: DropOrigin = { kind: 'metre', metre: 312 };

const entryOf = (s: GameState, id: number): DropEntry | undefined => s.drops.find((e) => e.id === id);
const events = (e: DropEntry | undefined) => e?.trail.map((t) => t.event);
const bagIndex = (s: GameState, id: number): number => s.bag.findIndex((c) => c?.id === id);

function fullBag(s: GameState): void {
  s.bag = s.bag.map(() => gear(s, 'boots', { rarity: 'rare', ilvl: 5 }));
}

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

const monster = (over: Partial<MonsterState> = {}): MonsterState => ({
  name: 'Bog Lurker', species: 0, rank: 'normal', mods: [], extra: 0, element: 'physical',
  life: 1_000_000_000, maxLife: 1_000_000_000, damage: 1_000_000, intervalS: 4.5, xp: 0, ...over,
});

it('a dug chest\'s gear gets an entry with its metre and a first step to bag', () => {
  const s = newGame(1, 0);
  const firstId = s.nextId;
  collect(s, { feature: 'chest', amount: 0, hardRock: false }, 312, metreTier(312), deriveStats(s));
  const found = s.bag.filter((c): c is GearItem => c?.type === 'gear' && c.id >= firstId);
  expect(found.length).toBeGreaterThan(0);
  for (const item of found) {
    expect(entryOf(s, item.id)).toEqual({
      id: item.id, kind: 'gear', name: item.name, rarity: item.rarity, base: item.slot, count: 1,
      origin: { kind: 'metre', metre: 312 }, trail: [{ event: 'bag' }],
    });
  }
  expect(validateState(s)).toBe(true);
});

it('a run\'s drop names the map tier and room', () => {
  const s = newGame(1, 0);
  startMap(s, stashMap(s, 2, 40).id);
  const run = runOf(s);
  run.room = 3;
  const before = s.drops.length;
  onKill(s, run, monster({ rank: 'boss', xp: 10 }), deriveBattleStats(s));
  const logged = s.drops.slice(before);
  expect(logged.length).toBeGreaterThan(0);
  for (const e of logged) expect(e.origin).toEqual({ kind: 'map', tier: 2, room: 3 });
  expect(validateState(s)).toBe(true);
});

it('a gambled item comes from the Merchant', () => {
  const s = newGame(1, 0);
  s.gold = 1_000_000;
  const { result, item } = gamble(s, 'ring');
  expect(result).toBe('ok');
  if (item === undefined) throw new Error('nothing gambled');
  expect(entryOf(s, item.id)).toMatchObject({ kind: 'gear', origin: { kind: 'merchant' }, trail: [{ event: 'bag' }] });
  expect(validateState(s)).toBe(true);
});

it('a Soul upgrade adds a step to the item\'s trail; a refused one adds nothing', () => {
  const s = newGame(1, 0);
  s.souls = 1_000;
  const ring = gear(s, 'ring', { rarity: 'rare', ilvl: 6 });
  receiveItem(s, ring, HERE);
  expect(soulUpgrade(s, { where: 'bag', index: bagIndex(s, ring.id) })).toBe('ok');
  s.souls = 0;
  expect(soulUpgrade(s, { where: 'bag', index: bagIndex(s, ring.id) })).toBe('noSouls');
  expect(entryOf(s, ring.id)?.trail).toEqual([{ event: 'bag' }, { event: 'upgraded' }]);
  expect(validateState(s)).toBe(true);
});

it('the loot filter\'s sale or salvage is the whole trail', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [{ rarity: 'magic', target: 'mining', action: 'sell' }, { rarity: 'magic', target: 'any', action: 'salvage' }];
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  receiveItem(s, pick, HERE);
  expect(entryOf(s, pick.id)?.trail).toEqual([{ event: 'filterSold', gold: 48 }]);
  const ring = gear(s, 'ring', { rarity: 'magic', ilvl: 4 });
  receiveItem(s, ring, HERE);
  expect(entryOf(s, ring.id)?.trail).toEqual([{ event: 'filterSalvaged', materials: { copper: 2, tin: 1 } }]);
});

it('a held item the loot filter settles while draining says so on its entry', () => {
  const s = newGame(1, 0);
  fullBag(s);
  const ring = gear(s, 'ring', { rarity: 'normal', ilvl: 4 });
  const boots = gear(s, 'boots', { rarity: 'magic', ilvl: 4 });
  receiveItem(s, ring, HERE);
  receiveItem(s, boots, HERE);
  s.settings.lootFilter = [{ rarity: 'normal', target: 'any', action: 'sell' }, { rarity: 'magic', target: 'any', action: 'salvage' }];
  drainOverflow(s);
  expect(s.overflow).toEqual([]);
  expect(entryOf(s, ring.id)?.trail).toEqual([{ event: 'held' }, { event: 'filterSold', gold: 20 }]);
  expect(entryOf(s, boots.id)?.trail).toEqual([{ event: 'held' }, { event: 'filterSalvaged', materials: { copper: 2, tin: 1 } }]);
});

it('gems and materials get one entry each and no trail', () => {
  const s = newGame(1, 0);
  const ruby = gem(s, 'ruby', { grade: 'small' });
  receiveItem(s, ruby, HERE);
  expect(entryOf(s, ruby.id)).toMatchObject({ kind: 'gem', name: 'Small Ruby', rarity: 'gem', base: 'ruby', count: 1, trail: [{ event: 'bag' }] });
  expect(sell(s, { where: 'bag', index: bagIndex(s, ruby.id) })).toBe('ok');
  expect(entryOf(s, ruby.id)?.trail).toEqual([{ event: 'bag' }]);

  const t = newGame(1, 0);
  fullBag(t);
  t.bag[20] = null;
  t.bag[41] = null;
  const before = t.drops.length;
  receiveMaterial(t, 'copper', 130, HERE);
  const logged = t.drops.slice(before);
  expect(logged).toEqual([{
    id: expect.any(Number), kind: 'material', name: 'Copper ore', rarity: 'material', base: 'copper', count: 130,
    origin: HERE, trail: [{ event: 'bag' }],
  }]);
  expect(t.overflow).toHaveLength(1);
  // the entry's id is its own, not one of the stacks'
  const stackIds = [...t.bag, ...t.overflow].map((c) => c?.id);
  expect(stackIds).not.toContain(logged[0]?.id);
  expect(validateState(t)).toBe(true);
});

it('a gem stack split between the bag and a sale logs the sale too', () => {
  const s = newGame(1, 0);
  fullBag(s);
  s.bag[5] = gem(s, 'ruby', { count: GEM_BAG_STACK - 1 });   // one short of a full bag stack
  for (let i = 0; i < MAX_HELD; i++) s.overflow.push(gear(s, 'boots'));
  const rubies = gem(s, 'ruby', { count: 3 });
  const gold = s.gold;
  const notes = receiveItem(s, rubies, HERE);
  expect(notes.map((n) => [n.outcome, n.value])).toEqual([['bag', 0], ['sold', 80]]);
  expect(s.gold).toBe(gold + 80);
  const logged = s.drops.filter((e) => e.kind === 'gem');
  expect(logged.map((e) => [e.count, e.trail])).toEqual([[1, [{ event: 'bag' }]], [2, [{ event: 'sold', gold: 80 }]]]);
  expect(logged[0]?.id).toBe(rubies.id);
  expect(validateState(s)).toBe(true);
});

it('a gem stack the loot filter sells is one entry for the whole stack', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [{ rarity: 'any', target: 'gem', action: 'sell' }];
  const rubies = gem(s, 'ruby', { count: 3 });
  receiveItem(s, rubies, HERE);
  expect(entryOf(s, rubies.id)).toMatchObject({ count: 3, trail: [{ event: 'filterSold', gold: 120 }] });
});

it('a trail follows the item', () => {
  const s = newGame(1, 0);
  const ring = gear(s, 'ring', { rarity: 'rare', ilvl: 5 });
  receiveItem(s, ring, HERE);
  expect(sendItem(s, { where: 'bag', index: bagIndex(s, ring.id) }, 'stash')).toBe('ok');
  const inStash = s.stash.general.findIndex((c) => c?.id === ring.id);
  expect(sendItem(s, { where: 'stash', index: inStash }, 'bag')).toBe('ok');
  expect(equip(s, { where: 'bag', index: bagIndex(s, ring.id) })).toBe('ok');
  expect(unequip(s, 'ring')).toBe('ok');
  expect(sell(s, { where: 'bag', index: bagIndex(s, ring.id) })).toBe('ok');
  expect(entryOf(s, ring.id)?.trail).toEqual([
    { event: 'bag' }, { event: 'stashed' }, { event: 'toBag' }, { event: 'equipped' }, { event: 'toBag' }, { event: 'sold', gold: 150 },
  ]);
});

it('a swap logs both items, and an item taken off into the General tab is stashed', () => {
  const s = newGame(1, 0);
  const a = gear(s, 'ring', { rarity: 'rare' });
  const b = gear(s, 'ring', { rarity: 'magic' });
  receiveItem(s, a, HERE);
  receiveItem(s, b, HERE);
  expect(equip(s, { where: 'bag', index: bagIndex(s, a.id) })).toBe('ok');
  expect(equip(s, { where: 'bag', index: bagIndex(s, b.id) })).toBe('ok');   // a comes back into b's cell
  expect(events(entryOf(s, a.id))).toEqual(['bag', 'equipped', 'toBag']);
  expect(sendItem(s, { where: 'worn', slot: 'ring' }, 'stash')).toBe('ok');
  expect(events(entryOf(s, b.id))).toEqual(['bag', 'equipped', 'stashed']);
});

it('a map\'s trail: to bag, enchanted, run, lost; a cleared map stops at run', () => {
  const s = newGame(1, 0);
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.souls = 10_000;
  addMap(s, 4, 400);
  const map = s.bag.find((c): c is MapItem => c?.type === 'map');
  if (map === undefined) throw new Error('no map');
  expect(craft(s, { where: 'bag', index: bagIndex(s, map.id) }, 'copper').check).toBe('ok');
  expect(startMap(s, map.id)).toBe('ok');
  const stats = deriveStats(s);
  for (let t = 0; t < 5000 && s.activity.kind === 'map'; t++) applyTicks(s, 1, stats);
  expect(s.lastRun?.outcome).toBe('died');
  expect(entryOf(s, map.id)?.trail).toEqual([{ event: 'bag' }, { event: 'crafted' }, { event: 'run' }, { event: 'lost' }]);

  const left = newGame(1, 0);
  addMap(left, 2, 40);
  const leftMap = left.bag.find((c): c is MapItem => c?.type === 'map');
  if (leftMap === undefined) throw new Error('no map');
  startMap(left, leftMap.id);
  leaveMap(left);
  expect(events(entryOf(left, leftMap.id))).toEqual(['bag', 'run', 'lost']);
  expect(left.deaths).toEqual([]);

  const c = newGame(1, 0);
  addMap(c, 1, 2);
  const cleared = c.bag.find((x): x is MapItem => x?.type === 'map');
  if (cleared === undefined) throw new Error('no map');
  startMap(c, cleared.id);
  const cs = deriveStats(c);
  for (let t = 0; t < 5000 && c.activity.kind === 'map'; t++) applyTicks(c, 1, cs);
  expect(c.lastRun?.outcome).toBe('cleared');
  expect(events(entryOf(c, cleared.id))).toEqual(['bag', 'run']);
});

it('held and past-the-cap finds say so', () => {
  const s = newGame(1, 0);
  fullBag(s);
  const ring = gear(s, 'ring');
  receiveItem(s, ring, HERE);
  s.bag[3] = null;
  drainOverflow(s);
  expect(events(entryOf(s, ring.id))).toEqual(['held', 'bag']);

  const t = newGame(1, 0);
  fullBag(t);
  for (let i = 0; i < MAX_HELD; i++) t.overflow.push(gear(t, 'boots'));
  const map: MapItem = { id: t.nextId++, type: 'map', tier: 4, metre: 400, rarity: 'normal', mods: [] };
  receiveItem(t, map, HERE);
  expect(entryOf(t, map.id)?.trail).toEqual([{ event: 'sold', gold: 400 }]);
  const before = t.drops.length;
  receiveMaterial(t, 'iron', 9, HERE);
  expect(t.drops.slice(before)).toEqual([expect.objectContaining({ kind: 'material', count: 9, trail: [{ event: 'stashed' }] })]);
});

it('a material past the Materials tab\'s cap logs only what was kept, and the rest as lost', () => {
  const s = newGame(1, 0);
  fullBag(s);
  for (let i = 0; i < MAX_HELD; i++) s.overflow.push(gear(s, 'boots'));
  s.stash.materials.iron = MATERIAL_STASH_STACK - 4;
  const before = s.drops.length;
  expect(receiveMaterial(s, 'iron', 9, HERE)).toEqual([
    { name: 'Iron ore', rarity: 'material', base: 'iron', outcome: 'stash', value: 4 },
  ]);
  expect(s.stash.materials.iron).toBe(MATERIAL_STASH_STACK);
  expect(s.drops.slice(before).map((e) => [e.count, e.trail])).toEqual([[4, [{ event: 'stashed' }]], [5, [{ event: 'lost' }]]]);
  const after = s.drops.length;
  expect(receiveMaterial(s, 'iron', 3, HERE)).toEqual([]);
  expect(s.drops.slice(after).map((e) => [e.count, e.trail])).toEqual([[3, [{ event: 'lost' }]]]);
  expect(validateState(s)).toBe(true);
});

describe('limits', () => {
  it('the log keeps the 300 newest entries and a trail its first step and newest 23', () => {
    const s = newGame(1, 0);
    const items: Item[] = [];
    for (let i = 0; i < DROP_LOG_LIMIT + 5; i++) {
      const item = gear(s, 'ring');
      items.push(item);
      logDrop(s, item, HERE, { event: 'bag' });
    }
    expect(s.drops).toHaveLength(DROP_LOG_LIMIT);
    expect(s.drops[0]?.id).toBe(items[5]?.id);
    const last = items[items.length - 1];
    if (last === undefined) throw new Error('no item');
    for (let i = 0; i < 30; i++) trail(s, last.id, { event: 'sold', gold: i });
    const kept = entryOf(s, last.id)?.trail ?? [];
    expect(kept).toHaveLength(MAX_TRAIL_STEPS);
    expect(kept[0]).toEqual({ event: 'bag' });
    expect(kept.slice(1).map((t) => t.gold)).toEqual(Array.from({ length: MAX_TRAIL_STEPS - 1 }, (_, i) => 30 - (MAX_TRAIL_STEPS - 1) + i));
  });

  it('a map entry takes the map\'s rarity and the base map', () => {
    const s = newGame(1, 0);
    const map: MapItem = { id: s.nextId++, type: 'map', tier: 5, metre: 400, rarity: 'magic', mods: [] };
    expect(logDrop(s, map, HERE, { event: 'bag' })).toEqual({
      id: map.id, kind: 'map', name: 'Magic tier 5 map', rarity: 'magic', base: 'map', count: 1, origin: HERE, trail: [{ event: 'bag' }],
    });
  });
});

it('a death records when, the map, the room, the killer and the tick', () => {
  const s = newGame(1, 0);
  expect(s.lastTickAt).toBe(0);
  const map = stashMap(s, 2, 40);
  startMap(s, map.id);
  const run = runOf(s);
  run.room = 3;
  run.queue = [monster()];
  const lost = structuredClone(run.map);
  const stats = { ...deriveStats(s), autoTicksPerSecond: 1 };
  const tick0 = s.tickCount;
  advance(s, 10_000, stats);
  expect(s.lastRun?.outcome).toBe('died');
  expect(s.deaths).toEqual([{
    id: expect.any(Number), tick: tick0 + 4, at: 5000, map: lost, room: 3, bossRoom: run.bossRoom, killer: 'Bog Lurker',
  }]);
  expect(validateState(s)).toBe(true);

  for (let i = 0; i < DEATH_LOG_LIMIT + 2; i++) logDeath(s, run, `Killer ${i}`);
  expect(s.deaths).toHaveLength(DEATH_LOG_LIMIT);
  expect(s.deaths[s.deaths.length - 1]?.killer).toBe(`Killer ${DEATH_LOG_LIMIT + 1}`);
});

it('the fixture\'s run logs its end', () => {
  const r = decodeSave(fixture8.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  const run = runOf(s);
  const mapId = run.map.id;
  const itemsBefore = run.items;
  for (let t = 0; t < 20_000 && s.activity.kind !== 'dig'; t += 50) applyTicks(s, 50, deriveStats(s));
  expect(s.activity.kind).toBe('dig');
  if (s.lastRun?.outcome === 'died') {
    expect(s.deaths).toHaveLength(1);
    expect(s.deaths[0]?.map.id).toBe(mapId);
  } else {
    expect(s.deaths).toEqual([]);
  }
  const fromRun = s.drops.filter((e) => e.origin.kind === 'map');
  expect(fromRun.filter((e) => e.kind !== 'material').length).toBe((s.lastRun?.items ?? 0) - itemsBefore);
  expect(fromRun.length).toBeGreaterThan(0);
  expect(validateState(s)).toBe(true);
});
