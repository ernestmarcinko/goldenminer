import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { itemAt, sameLoc } from '../../src/core/cells';
import { dropItem, equip, moveItem, salvage, sell, sendItem, socketGem, unequip } from '../../src/core/inventory';
import { GEM_GRADES, GEM_TYPES, isGear, MINING_SLOTS, BATTLE_SLOTS } from '../../src/core/items';
import type { Gem, MapItem, Slot } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { decodeSave, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { DropTarget, GameState, ItemLoc } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });
const cell = (index: number): ItemLoc => ({ where: 'stash', index });
const stack = (g: (typeof GEM_TYPES)[number], grade: (typeof GEM_GRADES)[number]): ItemLoc => ({ where: 'gems', gem: g, grade });

it('equip and unequip keep positions and swap', () => {
  const s = newGame(1, 0);
  const a = gear(s, 'pickaxe'); const b = gear(s, 'pickaxe');
  s.bag[5] = a;
  expect(equip(s, bag(5))).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bag[5]]).toEqual([a, null]);
  s.bag[9] = b;
  expect(dropItem(s, bag(9), { where: 'worn', slot: 'pickaxe' })).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bag[9]]).toEqual([b, a]);
  expect(dropItem(s, { where: 'worn', slot: 'pickaxe' }, bag(9))).toBe('ok');   // swap back
  expect(s.equipped.mining.pickaxe).toEqual(a);
  s.bag[2] = gear(s, 'boots');
  expect(unequip(s, 'pickaxe', bag(2))).toBe('wrongSlot');
  expect(unequip(s, 'pickaxe', { where: 'gems', gem: 'ruby', grade: 'tiny' })).toBe('gemsOnly');
  expect(unequip(s, 'pickaxe', { where: 'maps', index: 0 })).toBe('mapsOnly');
});

it('moves, swaps, merges and refuses', () => {
  const s = newGame(1, 0);
  const p = gear(s, 'pickaxe'); const w = gear(s, 'weapon');
  s.bag[0] = p; s.stash.general[0] = w;
  expect(moveItem(s, bag(0), bag(59))).toBe('ok');
  expect(s.bag[59]).toBe(p);
  expect(moveItem(s, cell(0), bag(59))).toBe('ok');   // a swap: battle gear and mining gear share the bag
  expect([s.bag[59], s.stash.general[0]]).toEqual([w, p]);
  expect(moveItem(s, bag(59), bag(60))).toBe('invalid');
  s.bag[1] = gem(s, 'ruby', { count: 20 }); s.bag[2] = gem(s, 'ruby', { count: 10 });
  expect(moveItem(s, bag(2), bag(1))).toBe('ok');
  expect([s.bag[1], s.bag[2]]).toEqual([expect.objectContaining({ count: 25 }), expect.objectContaining({ count: 5 })]);
  expect(moveItem(s, bag(2), bag(1))).toBe('stackFull');
  expect(moveItem(s, bag(2), cell(5))).toBe('gearOnly');
  expect(dropItem(s, bag(59), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(moveItem(s, bag(2), bag(2))).toBe('ok');
});

it('the Gems tab takes whole stacks and gives back up to 25', () => {
  const s = newGame(1, 0);
  s.stash.gems.ruby.tiny = 999_990;
  s.bag[3] = gem(s, 'ruby', { count: 25 });
  expect(sendItem(s, bag(3), 'stash')).toBe('ok');
  expect([s.stash.gems.ruby.tiny, s.bag[3]]).toEqual([1_000_000, expect.objectContaining({ count: 15 })]);
  expect(sendItem(s, bag(3), 'stash')).toBe('stackFull');
  s.bag[3] = gem(s, 'ruby', { count: 20 });
  expect(sendItem(s, { where: 'gems', gem: 'ruby', grade: 'tiny' }, 'bag')).toBe('ok');
  expect(s.bag[3]).toMatchObject({ count: 25 });
  expect(s.bag[0]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 20 });
  expect(s.stash.gems.ruby.tiny).toBe(999_975);
});

it('a gem dropped on gear sockets one gem', () => {
  const s = newGame(1, 0);
  s.stash.general[4] = gear(s, 'ring', { sockets: 1 });
  s.bag[0] = gem(s, 'sapphire', { grade: 'big', count: 2 });
  expect(dropItem(s, bag(0), cell(4))).toBe('ok');
  expect(s.stash.general[4]?.type === 'gear' && s.stash.general[4].gems).toEqual([{ gem: 'sapphire', grade: 'big' }]);
  expect(s.bag[0]).toMatchObject({ count: 1 });
  expect(dropItem(s, bag(0), cell(4))).toBe('noSocket');
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 2 });
  expect(dropItem(s, bag(0), { where: 'worn', slot: 'lamp' })).toBe('ok');
  expect(s.bag[0]).toBeNull();
});

it('unequipping with no target takes the first empty bag cell, and needs one', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = pick;
  s.bag = s.bag.map(() => gem(s));
  expect(unequip(s, 'pickaxe')).toBe('bagFull');
  expect(s.equipped.mining.pickaxe).toBe(pick);
  s.bag[9] = null;
  expect(unequip(s, 'pickaxe')).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBeUndefined();
  expect(s.bag[9]).toBe(pick);
  expect(unequip(s, 'pickaxe')).toBe('invalid');
  expect(unequip(s, 'lamp', cell(0))).toBe('invalid');
});

it('worn gear goes to the General tab, or swaps with the same slot there', () => {
  const s = newGame(1, 0);
  const a = gear(s, 'ring'); const b = gear(s, 'ring');
  s.equipped.battle.ring = a;
  s.stash.general[3] = b;
  expect(unequip(s, 'ring', cell(3))).toBe('ok');
  expect([s.equipped.battle.ring, s.stash.general[3]]).toEqual([b, a]);
  s.stash.general[4] = gear(s, 'helm');
  expect(unequip(s, 'ring', cell(4))).toBe('wrongSlot');
  expect(sendItem(s, { where: 'worn', slot: 'ring' }, 'stash')).toBe('ok');
  expect(s.equipped.battle.ring).toBeUndefined();
  expect(s.stash.general[0]).toBe(b);
});

it('sendItem sends gear to the General tab and back to the bag', () => {
  const s = newGame(1, 0);
  const ring = gear(s, 'ring');
  s.bag[7] = ring;
  expect(sendItem(s, bag(7), 'stash')).toBe('ok');
  expect([s.bag[7], s.stash.general[0]]).toEqual([null, ring]);
  expect(sendItem(s, cell(0), 'bag')).toBe('ok');
  expect([s.stash.general[0], s.bag[0]]).toEqual([null, ring]);
  s.bag = s.bag.map((c) => c ?? gem(s));
  s.stash.general[0] = gear(s, 'weapon');
  expect(sendItem(s, cell(0), 'bag')).toBe('bagFull');
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'amulet'));
  s.bag[0] = gear(s, 'boots');
  expect(sendItem(s, bag(0), 'stash')).toBe('stashFull');
});

it('a Gems-tab take tops up stacks and refuses a cell holding something else', () => {
  const s = newGame(1, 0);
  s.stash.gems.emerald.small = 3;
  s.bag[0] = gear(s, 'boots');
  expect(moveItem(s, stack('emerald', 'small'), bag(0))).toBe('invalid');
  expect(moveItem(s, stack('emerald', 'small'), bag(1))).toBe('ok');
  expect(s.bag[1]).toMatchObject({ gem: 'emerald', grade: 'small', count: 3 });
  expect(s.stash.gems.emerald.small).toBe(0);
  expect(itemAt(s, stack('emerald', 'small'))).toBeUndefined();
  expect(moveItem(s, stack('emerald', 'small'), bag(2))).toBe('invalid');
});

it('a gem dropped on the Gems tab goes to its own kind, whichever stack it lands on', () => {
  const s = newGame(1, 0);
  s.stash.gems.ruby.tiny = 5;
  s.bag[0] = gem(s, 'emerald', { grade: 'perfect', count: 3 });
  expect(moveItem(s, bag(0), stack('ruby', 'tiny'))).toBe('ok');
  expect(s.stash.gems.emerald.perfect).toBe(3);
  expect(s.stash.gems.ruby.tiny).toBe(5);
  expect(s.bag[0]).toBeNull();
});

it('sell and salvage take a whole stack, from a cell or the Gems tab', () => {
  const s = newGame(1, 0);
  s.stash.general[3] = gear(s, 'ring', { rarity: 'rare', ilvl: 10 });
  s.bag[4] = gear(s, 'boots', { rarity: 'rare', ilvl: 10 });
  expect(sell(s, cell(3))).toBe('ok');
  expect(salvage(s, bag(4))).toBe('ok');
  expect([s.gold, s.diamonds, s.stash.general[3], s.bag[4]]).toEqual([300, 0, null, null]);
  expect([s.stash.materials.copper, s.stash.materials.tin, s.stash.materials.iron]).toEqual([9, 6, 3]);
  expect(sell(s, cell(3))).toBe('invalid');
  s.bag[0] = gem(s, 'ruby', { grade: 'big', count: 3 });
  expect(sell(s, bag(0))).toBe('ok');
  expect(s.gold).toBe(780);
  s.stash.gems.ruby.big = 10;
  expect(salvage(s, stack('ruby', 'big'))).toBe('ok');
  expect([s.stash.gems.ruby.big, s.stash.materials.tin]).toEqual([0, 6 + 10 * 2]);
  expect(sell(s, { where: 'worn', slot: 'pickaxe' })).toBe('invalid');
});

it('a socketed gem is taken from its stack and counts toward stats', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { sockets: 1 });
  s.equipped.mining.pickaxe = pick;
  s.bag[0] = gem(s, 'ruby', { count: 2 });
  s.bag[1] = gem(s, 'emerald');
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  expect(socketGem(s, bag(0), worn)).toBe('ok');
  expect(pick.gems).toEqual([{ gem: 'ruby', grade: 'tiny' }]);
  expect(s.bag[0]).toMatchObject({ gem: 'ruby', count: 1 });
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.08);
  expect(socketGem(s, bag(0), worn)).toBe('noSocket');
  expect(socketGem(s, bag(0), { where: 'worn', slot: 'lamp' })).toBe('invalid');
  pick.sockets = 2;
  expect(socketGem(s, bag(0), worn)).toBe('ok');
  expect([pick.gems.length, s.bag[0]]).toEqual([2, null]);
  expect(socketGem(s, bag(1), bag(1))).toBe('invalid');
});

it('a Gems-tab stack sockets one gem at a time', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'ring', { sockets: 1 });
  s.stash.gems.sapphire.giant = 2;
  expect(socketGem(s, stack('sapphire', 'giant'), bag(0))).toBe('ok');
  expect(s.stash.gems.sapphire.giant).toBe(1);
  expect(s.bag[0]).toMatchObject({ gems: [{ gem: 'sapphire', grade: 'giant' }] });
});

it('dropping on a tab goes to its first free place, with tab checks', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.bag[0] = pick;
  s.bag[1] = gem(s, 'ruby', { count: 4 });
  expect(dropItem(s, bag(0), { where: 'stashTab', tab: 'general' })).toBe('ok');
  expect(s.stash.general[0]).toBe(pick);
  expect(dropItem(s, cell(0), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(dropItem(s, bag(1), { where: 'stashTab', tab: 'general' })).toBe('gearOnly');
  expect(dropItem(s, bag(1), { where: 'stashTab', tab: 'auto' })).toBe('ok');
  expect([s.bag[1], s.stash.gems.ruby.tiny]).toEqual([null, 4]);
  expect(dropItem(s, cell(0), { where: 'stashTab', tab: 'auto' })).toBe('ok');   // already there
  expect(s.stash.general[0]).toBe(pick);
});

it('a lamp worn by a drop reveals more metres at once, and taking it off keeps their rolls', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 3 } });
  expect(equip(s, bag(0))).toBe('ok');
  expect(Object.keys(s.ahead).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  const rolls = structuredClone(s.ahead);
  expect(unequip(s, 'lamp')).toBe('ok');
  expect(s.ahead).toEqual(rolls);
});

it('equip refuses the wrong things', () => {
  const s = newGame(1, 0);
  s.bag[0] = gem(s);
  expect(equip(s, bag(0))).toBe('invalid');
  expect(equip(s, bag(5))).toBe('invalid');
  expect(equip(s, { where: 'worn', slot: 'lamp' })).toBe('invalid');
  s.bag[1] = gear(s, 'boots');
  expect(dropItem(s, bag(1), { where: 'worn', slot: 'lamp' })).toBe('wrongSlot');
});

function gearIds(s: GameState): number[] {
  const ids: number[] = [];
  for (const c of s.bag) if (c !== null && isGear(c)) ids.push(c.id);
  for (const set of ['mining', 'battle'] as const) for (const g of Object.values(s.equipped[set])) ids.push(g.id);
  for (const c of s.stash.general) if (c !== null) ids.push(c.id);
  for (const o of s.overflow) ids.push(o.id);
  return ids.sort((a, b) => a - b);
}

function mapIds(s: GameState): number[] {
  return [...s.bag, ...s.stash.maps].flatMap((c) => (c?.type === 'map' ? [c.id] : [])).sort((a, b) => a - b);
}

/** How many gems of each type and grade exist: in bag stacks, the Gems tab and every socket. */
function gemCounts(s: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (g: { gem: string; grade: string }, n: number): void => {
    const key = `${g.gem}/${g.grade}`;
    counts[key] = (counts[key] ?? 0) + n;
  };
  const addSocketed = (g: { gems: Gem[] }): void => { for (const x of g.gems) add(x, 1); };
  for (const c of s.bag) if (c !== null) { if (isGear(c)) addSocketed(c); else if (c.type === 'gem') add(c, c.count); }
  for (const set of ['mining', 'battle'] as const) for (const g of Object.values(s.equipped[set])) addSocketed(g);
  for (const c of s.stash.general) if (c !== null) addSocketed(c);
  for (const o of s.overflow) addSocketed(o);
  for (const t of GEM_TYPES) for (const grade of GEM_GRADES) if (s.stash.gems[t][grade] > 0) add({ gem: t, grade }, s.stash.gems[t][grade]);
  return counts;
}

const ALL_SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS];
const TABS = ['general', 'gems', 'maps', 'auto'] as const;

it('drops, sends and unequips never create or lose items, and the walk reaches every rule', () => {
  const decoded = decodeSave(fixture3);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const s = decoded.state;
  // Identical stacks to merge, Gems-tab counts to take from or fill, maps to move, and nearly full grids to run out of room.
  s.bag[40] = gem(s, 'ruby', { count: 10 });
  s.bag[41] = gem(s, 'ruby', { count: 20 });
  s.bag[42] = gem(s, 'ruby', { count: 25 });
  s.bag[43] = gem(s, 'sapphire', { grade: 'big', count: 25 });
  s.bag[44] = gem(s, 'sapphire', { grade: 'big', count: 7 });
  s.bag[45] = { id: s.nextId++, type: 'map', tier: 2, metre: 70 };
  s.stash.gems.ruby.tiny = 60;
  s.stash.gems.sapphire.big = 999_990;
  s.stash.gems.emerald.small = 30;
  s.stash.gems.amethyst.giant = 3;
  for (let i = 0; i < 8; i++) s.stash.maps[i] ??= { id: s.nextId++, type: 'map', tier: 1 + (i % 3), metre: 5 + i };
  let n = 0;
  for (let i = 0; i < s.bag.length; i++) {
    if (s.bag[i] !== null) continue;
    if (s.bag.filter((c) => c === null).length <= 2) break;
    const slot: Slot = ALL_SLOTS[n % ALL_SLOTS.length] ?? 'pickaxe';
    s.bag[i] = n++ % 3 === 0 ? gem(s, GEM_TYPES[n % GEM_TYPES.length] ?? 'ruby', { grade: GEM_GRADES[n % 2] ?? 'tiny', count: 1 + (n % 25) }) : gear(s, slot, { sockets: n % 4 });
  }
  // General starts full: bag gems drain into the Gems tab as the walk goes, so General gains room from there
  s.stash.general = s.stash.general.map((c, i) => c ?? gear(s, ALL_SLOTS[i % ALL_SLOTS.length] ?? 'pickaxe', { sockets: i % 4 }));
  s.equipped.mining.lamp ??= gear(s, 'lamp', { sockets: 2 });
  expect(validateState(s)).toBe(true);
  const ids = gearIds(s);
  const maps = mapIds(s);
  const gems = gemCounts(s);

  let rng = 7;
  const draw = (k: number): number => {
    const r = mulberry32(rng);
    rng = r.state;
    return Math.floor(r.value * k);
  };
  const pick = <T,>(list: readonly T[]): T => {
    const x = list[draw(list.length)];
    if (x === undefined) throw new Error('empty list');
    return x;
  };
  const cellLocs: ItemLoc[] = [];
  for (let i = 0; i < s.bag.length; i++) cellLocs.push(bag(i));
  for (let i = 0; i < s.stash.general.length; i++) cellLocs.push(cell(i));
  for (let i = 0; i < s.stash.maps.length; i++) cellLocs.push({ where: 'maps', index: i });
  for (const t of GEM_TYPES) for (const g of GEM_GRADES) cellLocs.push(stack(t, g));
  const wornLocs: ItemLoc[] = ALL_SLOTS.map((slot) => ({ where: 'worn', slot }));
  const everyLoc = [...cellLocs, ...wornLocs];
  const occupied = (): ItemLoc => {
    const filled = everyLoc.filter((l) => itemAt(s, l) !== undefined);
    return pick(filled);
  };
  // A place the item would merge or swap with: an identical gem stack, gear for the same slot, or another map.
  const partnerOf = (from: ItemLoc): ItemLoc | undefined => {
    const item = itemAt(s, from);
    if (item === undefined) return undefined;
    const partners = everyLoc.filter((l) => {
      const other = itemAt(s, l);
      if (other === undefined || sameLoc(l, from) || other.type !== item.type) return false;
      if (isGear(item)) return isGear(other) && other.slot === item.slot;
      return item.type !== 'gem' || (other.type === 'gem' && other.gem === item.gem && other.grade === item.grade);
    });
    return partners.length > 0 ? pick(partners) : undefined;
  };
  const wornNow = (): ItemLoc[] => wornLocs.filter((l) => itemAt(s, l) !== undefined);
  const target = (from: ItemLoc): DropTarget => {
    const roll = draw(10);
    if (roll < 4) return partnerOf(from) ?? pick(everyLoc);
    const worn = wornNow();
    if (roll < 5 && worn.length > 0) return pick(worn);
    if (roll < 6) return { where: 'stashTab', tab: pick(TABS) };
    return pick(everyLoc);
  };

  const seen = {
    merge: 0, takeTopUp: 0, wornSwap: 0, wornSwapOut: 0, stackFull: 0, bagFull: 0, stashFull: 0,
    send: 0, unequip: 0, socket: 0, mapMove: 0,
  };
  const kind = (l: ItemLoc | DropTarget): string => {
    if (l.where === 'stashTab') return 'tab';
    return itemAt(s, l)?.type ?? 'empty';
  };
  for (let i = 0; i < 4000; i++) {
    const op = draw(10);
    let result: string;
    if (op < 6) {
      // the grids are large, so worn gear is picked up on purpose now and then
      const worn = wornNow();
      const from = draw(10) === 0 && worn.length > 0 ? pick(worn) : occupied();
      const to = target(from);
      const [a, b] = [itemAt(s, from), to.where === 'stashTab' ? undefined : itemAt(s, to)];
      const kinds = [kind(from), kind(to)];
      result = dropItem(s, from, to);
      if (result === 'ok' && a?.type === 'gem' && b?.type === 'gem' && a.gem === b.gem && a.grade === b.grade) {
        if (from.where === 'bag' && to.where === 'bag') seen.merge++;
        if (from.where === 'gems' && to.where === 'bag') seen.takeTopUp++;
      }
      if (result === 'ok' && to.where === 'worn' && from.where !== 'worn' && kinds.join() === 'gear,gear') seen.wornSwap++;
      if (result === 'ok' && from.where === 'worn' && (to.where === 'bag' || to.where === 'stash') && kinds[1] === 'gear') seen.wornSwapOut++;
      if (result === 'ok' && a?.type === 'gem' && b !== undefined && isGear(b)) seen.socket++;
      if (result === 'ok' && a?.type === 'map' && !sameLoc(from, to.where === 'stashTab' ? from : to)) seen.mapMove++;
    } else if (op < 8) {
      result = sendItem(s, occupied(), pick(['stash', 'bag'] as const));
      if (result === 'ok') seen.send++;
    } else {
      result = unequip(s, pick(ALL_SLOTS));
      if (result === 'ok') seen.unequip++;
    }
    if (result === 'stackFull') seen.stackFull++;
    if (result === 'bagFull') seen.bagFull++;
    if (result === 'stashFull') seen.stashFull++;
    expect(gearIds(s)).toEqual(ids);
    expect(mapIds(s)).toEqual(maps);
    expect(gemCounts(s)).toEqual(gems);
    expect(validateState(s)).toBe(true);
  }
  for (const [name, count] of Object.entries(seen)) expect([name, count > 0]).toEqual([name, true]);
});

const mapAt = (s: GameState, tier: number, metre = 10): MapItem => ({ id: s.nextId++, type: 'map', tier, metre });
const mapsLoc = (index: number): ItemLoc => ({ where: 'maps', index });

it('gear of either set lives in the one bag', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe'); const weapon = gear(s, 'weapon');
  s.bag[0] = pick; s.bag[1] = weapon;
  expect(equip(s, bag(0))).toBe('ok');
  expect(equip(s, bag(1))).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.equipped.battle.weapon]).toEqual([pick, weapon]);
});

it('unequip goes to the first empty bag cell', () => {
  const s = newGame(1, 0);
  const helm = gear(s, 'helm');
  s.equipped.battle.helm = helm;
  s.bag = s.bag.map((_, i) => (i === 0 ? null : gem(s)));
  expect(unequip(s, 'helm')).toBe('ok');
  expect(s.bag[0]).toBe(helm);
  s.equipped.battle.helm = gear(s, 'helm');
  expect(unequip(s, 'helm')).toBe('bagFull');   // all 60 cells are full
});

it('the stash shortcut fills the next General page', () => {
  const s = newGame(1, 0);
  for (let i = 0; i < 60; i++) s.stash.general[i] = gear(s, 'boots');
  const ring = gear(s, 'ring');
  s.bag[0] = ring;
  expect(sendItem(s, bag(0), 'stash')).toBe('ok');
  expect(s.stash.general[60]).toBe(ring);
  s.bag[0] = gem(s);
  expect(sendItem(s, cell(60), 'bag')).toBe('ok');
  expect([s.stash.general[60], s.bag[1]]).toEqual([null, ring]);
});

it('maps live in the bag and the Maps tab only', () => {
  const s = newGame(1, 0);
  const map = mapAt(s, 2);
  s.bag[0] = map;
  s.bag[1] = gear(s, 'lamp');
  expect(moveItem(s, bag(0), cell(3))).toBe('gearOnly');
  expect(moveItem(s, bag(1), mapsLoc(5))).toBe('mapsOnly');
  expect(moveItem(s, bag(0), mapsLoc(5))).toBe('ok');
  expect([s.bag[0], s.stash.maps[5]]).toEqual([null, map]);
  expect(moveItem(s, mapsLoc(5), bag(2))).toBe('ok');
  expect(dropItem(s, bag(2), { where: 'stashTab', tab: 'maps' })).toBe('ok');
  expect([s.bag[2], s.stash.maps[0]]).toEqual([null, map]);   // the first empty Maps cell
  expect(dropItem(s, bag(1), { where: 'stashTab', tab: 'maps' })).toBe('mapsOnly');
  expect(dropItem(s, mapsLoc(0), { where: 'stashTab', tab: 'general' })).toBe('gearOnly');
  expect(dropItem(s, mapsLoc(0), { where: 'worn', slot: 'lamp' })).toBe('invalid');
});

it('the stash shortcut sends a map to the first empty Maps cell, and back to the bag', () => {
  const s = newGame(1, 0);
  const map = mapAt(s, 4);
  s.stash.maps[0] = mapAt(s, 1);
  s.bag[3] = map;
  expect(sendItem(s, bag(3), 'stash')).toBe('ok');
  expect(s.stash.maps[1]).toBe(map);
  expect(sendItem(s, mapsLoc(1), 'bag')).toBe('ok');
  expect(s.bag[0]).toBe(map);
  s.stash.maps = s.stash.maps.map((c) => c ?? mapAt(s, 1));
  expect(sendItem(s, bag(0), 'stash')).toBe('stashFull');
  expect(sell(s, bag(0))).toBe('invalid');
  expect(salvage(s, mapsLoc(0))).toBe('invalid');
});

it('materials go only in their own tab, and cannot be sold or salvaged', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'copper', count: 5 };
  s.stash.materials.tin = 9;
  const tab: ItemLoc = { where: 'materials', material: 'tin' };
  expect(itemAt(s, tab)).toEqual({ id: 0, type: 'material', material: 'tin', count: 9 });
  s.bag[2] = gear(s, 'boots');
  expect(moveItem(s, bag(2), tab)).toBe('materialsOnly');
  expect(dropItem(s, bag(2), { where: 'stashTab', tab: 'materials' })).toBe('materialsOnly');
  expect(dropItem(s, bag(0), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(sell(s, bag(0))).toBe('invalid');
  expect(salvage(s, tab)).toBe('invalid');
  expect([s.bag[0]?.type, s.stash.materials.tin]).toEqual(['material', 9]);
  expect(dropItem(s, bag(0), { where: 'stashTab', tab: 'materials' })).toBe('ok');
  expect([s.bag[0], s.stash.materials.copper]).toEqual([null, 5]);
  expect(dropItem(s, tab, { where: 'stashTab', tab: 'materials' })).toBe('ok');   // already home
  expect(s.stash.materials.tin).toBe(9);
  s.bag[3] = { id: s.nextId++, type: 'material', material: 'iron', count: 2 };
  expect(dropItem(s, bag(3), { where: 'stashTab', tab: 'auto' })).toBe('ok');      // the Stash button
  expect([s.bag[3], s.stash.materials.iron]).toEqual([null, 2]);
});
