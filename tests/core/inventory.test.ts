import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { itemAt, sameLoc } from '../../src/core/cells';
import { dropItem, equip, moveItem, salvage, sell, sendItem, socketGem, unequip } from '../../src/core/inventory';
import { GEM_GRADES, GEM_TYPES, isGear, MINING_SLOTS, BATTLE_SLOTS } from '../../src/core/items';
import type { GearSet, Gem, Slot } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { decodeSave, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { DropTarget, GameState, ItemLoc } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const bag = (set: GearSet, index: number): ItemLoc => ({ where: 'bag', set, index });
const cell = (index: number): ItemLoc => ({ where: 'stash', index });
const stack = (g: (typeof GEM_TYPES)[number], grade: (typeof GEM_GRADES)[number]): ItemLoc => ({ where: 'gems', gem: g, grade });

it('equip and unequip keep positions and swap', () => {
  const s = newGame(1, 0);
  const a = gear(s, 'pickaxe'); const b = gear(s, 'pickaxe');
  s.bags.mining[5] = a;
  expect(equip(s, bag('mining', 5))).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bags.mining[5]]).toEqual([a, null]);
  s.bags.mining[9] = b;
  expect(dropItem(s, bag('mining', 9), { where: 'worn', slot: 'pickaxe' })).toBe('ok');
  expect([s.equipped.mining.pickaxe, s.bags.mining[9]]).toEqual([b, a]);
  expect(dropItem(s, { where: 'worn', slot: 'pickaxe' }, bag('mining', 9))).toBe('ok');   // swap back
  expect(s.equipped.mining.pickaxe).toEqual(a);
  s.bags.mining[2] = gear(s, 'boots');
  expect(unequip(s, 'pickaxe', bag('mining', 2))).toBe('wrongSlot');
  expect(unequip(s, 'pickaxe', bag('battle', 0))).toBe('wrongSet');
  expect(unequip(s, 'pickaxe', { where: 'gems', gem: 'ruby', grade: 'tiny' })).toBe('gemsOnly');
});

it('moves, swaps, merges and refuses', () => {
  const s = newGame(1, 0);
  const p = gear(s, 'pickaxe'); const w = gear(s, 'weapon');
  s.bags.mining[0] = p; s.stash.general[0] = w;
  expect(moveItem(s, bag('mining', 0), bag('mining', 23))).toBe('ok');
  expect(s.bags.mining[23]).toBe(p);
  expect(moveItem(s, cell(0), bag('mining', 23))).toBe('wrongSet');
  expect(moveItem(s, cell(0), bag('battle', 4))).toBe('ok');
  s.bags.mining[1] = gem(s, 'ruby', { count: 20 }); s.bags.mining[2] = gem(s, 'ruby', { count: 10 });
  expect(moveItem(s, bag('mining', 2), bag('mining', 1))).toBe('ok');
  expect([s.bags.mining[1], s.bags.mining[2]]).toEqual([expect.objectContaining({ count: 25 }), expect.objectContaining({ count: 5 })]);
  expect(moveItem(s, bag('mining', 2), bag('mining', 1))).toBe('stackFull');
  expect(moveItem(s, bag('mining', 2), cell(5))).toBe('gearOnly');
  expect(dropItem(s, bag('mining', 23), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(moveItem(s, bag('mining', 2), bag('mining', 2))).toBe('ok');
});

it('the Gems tab takes whole stacks and gives back up to 25', () => {
  const s = newGame(1, 0);
  s.stash.gems.ruby.tiny = 999_990;
  s.bags.battle[3] = gem(s, 'ruby', { count: 25 });
  expect(sendItem(s, bag('battle', 3), 'stash')).toBe('ok');
  expect([s.stash.gems.ruby.tiny, s.bags.battle[3]]).toEqual([1_000_000, expect.objectContaining({ count: 15 })]);
  expect(sendItem(s, bag('battle', 3), 'stash')).toBe('stackFull');
  s.bags.mining[0] = gem(s, 'ruby', { count: 20 });
  expect(sendItem(s, { where: 'gems', gem: 'ruby', grade: 'tiny' }, 'mining')).toBe('ok');
  expect(s.bags.mining[0]).toMatchObject({ count: 25 });
  expect(s.bags.mining[1]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 20 });
  expect(s.stash.gems.ruby.tiny).toBe(999_975);
});

it('a gem dropped on gear sockets one gem', () => {
  const s = newGame(1, 0);
  s.stash.general[4] = gear(s, 'ring', { sockets: 1 });
  s.bags.mining[0] = gem(s, 'sapphire', { grade: 'big', count: 2 });
  expect(dropItem(s, bag('mining', 0), cell(4))).toBe('ok');
  expect(s.stash.general[4]?.type === 'gear' && s.stash.general[4].gems).toEqual([{ gem: 'sapphire', grade: 'big' }]);
  expect(s.bags.mining[0]).toMatchObject({ count: 1 });
  expect(dropItem(s, bag('mining', 0), cell(4))).toBe('noSocket');
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 2 });
  expect(dropItem(s, bag('mining', 0), { where: 'worn', slot: 'lamp' })).toBe('ok');
  expect(s.bags.mining[0]).toBeNull();
});

it('unequipping with no target takes the first empty bag cell, and needs one', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = pick;
  s.bags.mining = s.bags.mining.map(() => gem(s));
  expect(unequip(s, 'pickaxe')).toBe('bagFull');
  expect(s.equipped.mining.pickaxe).toBe(pick);
  s.bags.mining[9] = null;
  expect(unequip(s, 'pickaxe')).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBeUndefined();
  expect(s.bags.mining[9]).toBe(pick);
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

it('sendItem sends gear to the General tab and General gear home', () => {
  const s = newGame(1, 0);
  const ring = gear(s, 'ring');
  s.bags.battle[7] = ring;
  expect(sendItem(s, bag('battle', 7), 'stash')).toBe('ok');
  expect([s.bags.battle[7], s.stash.general[0]]).toEqual([null, ring]);
  expect(sendItem(s, cell(0), 'mining')).toBe('ok');   // gear goes to its own set's bag
  expect([s.stash.general[0], s.bags.battle[0]]).toEqual([null, ring]);
  s.bags.battle = s.bags.battle.map((c) => c ?? gem(s));
  s.stash.general[0] = gear(s, 'weapon');
  expect(sendItem(s, cell(0), 'battle')).toBe('bagFull');
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'amulet'));
  s.bags.mining[0] = gear(s, 'boots');
  expect(sendItem(s, bag('mining', 0), 'stash')).toBe('stashFull');
});

it('a Gems-tab take tops up stacks and refuses a cell holding something else', () => {
  const s = newGame(1, 0);
  s.stash.gems.emerald.small = 3;
  s.bags.mining[0] = gear(s, 'boots');
  expect(moveItem(s, stack('emerald', 'small'), bag('mining', 0))).toBe('invalid');
  expect(moveItem(s, stack('emerald', 'small'), bag('mining', 1))).toBe('ok');
  expect(s.bags.mining[1]).toMatchObject({ gem: 'emerald', grade: 'small', count: 3 });
  expect(s.stash.gems.emerald.small).toBe(0);
  expect(itemAt(s, stack('emerald', 'small'))).toBeUndefined();
  expect(moveItem(s, stack('emerald', 'small'), bag('mining', 2))).toBe('invalid');
});

it('a gem dropped on the Gems tab goes to its own kind, whichever stack it lands on', () => {
  const s = newGame(1, 0);
  s.stash.gems.ruby.tiny = 5;
  s.bags.mining[0] = gem(s, 'emerald', { grade: 'perfect', count: 3 });
  expect(moveItem(s, bag('mining', 0), stack('ruby', 'tiny'))).toBe('ok');
  expect(s.stash.gems.emerald.perfect).toBe(3);
  expect(s.stash.gems.ruby.tiny).toBe(5);
  expect(s.bags.mining[0]).toBeNull();
});

it('sell and salvage take a whole stack, from a cell or the Gems tab', () => {
  const s = newGame(1, 0);
  s.stash.general[3] = gear(s, 'ring', { rarity: 'rare', ilvl: 10 });
  s.bags.mining[4] = gear(s, 'boots', { rarity: 'rare', ilvl: 10 });
  expect(sell(s, cell(3))).toBe('ok');
  expect(salvage(s, bag('mining', 4))).toBe('ok');
  expect([s.gold, s.diamonds, s.stash.general[3], s.bags.mining[4]]).toEqual([300, 12, null, null]);
  expect(sell(s, cell(3))).toBe('invalid');
  s.bags.mining[0] = gem(s, 'ruby', { grade: 'big', count: 3 });
  expect(sell(s, bag('mining', 0))).toBe('ok');
  expect(s.gold).toBe(780);
  s.stash.gems.ruby.big = 10;
  expect(salvage(s, stack('ruby', 'big'))).toBe('ok');
  expect([s.stash.gems.ruby.big, s.diamonds]).toEqual([0, 12 + 10 * 4]);
  expect(sell(s, { where: 'worn', slot: 'pickaxe' })).toBe('invalid');
});

it('a socketed gem is taken from its stack and counts toward stats', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { sockets: 1 });
  s.equipped.mining.pickaxe = pick;
  s.bags.mining[0] = gem(s, 'ruby', { count: 2 });
  s.bags.mining[1] = gem(s, 'emerald');
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  expect(socketGem(s, bag('mining', 0), worn)).toBe('ok');
  expect(pick.gems).toEqual([{ gem: 'ruby', grade: 'tiny' }]);
  expect(s.bags.mining[0]).toMatchObject({ gem: 'ruby', count: 1 });
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.08);
  expect(socketGem(s, bag('mining', 0), worn)).toBe('noSocket');
  expect(socketGem(s, bag('mining', 0), { where: 'worn', slot: 'lamp' })).toBe('invalid');
  pick.sockets = 2;
  expect(socketGem(s, bag('mining', 0), worn)).toBe('ok');
  expect([pick.gems.length, s.bags.mining[0]]).toEqual([2, null]);
  expect(socketGem(s, bag('mining', 1), bag('mining', 1))).toBe('invalid');
});

it('a Gems-tab stack sockets one gem at a time', () => {
  const s = newGame(1, 0);
  s.bags.battle[0] = gear(s, 'ring', { sockets: 1 });
  s.stash.gems.sapphire.giant = 2;
  expect(socketGem(s, stack('sapphire', 'giant'), bag('battle', 0))).toBe('ok');
  expect(s.stash.gems.sapphire.giant).toBe(1);
  expect(s.bags.battle[0]).toMatchObject({ gems: [{ gem: 'sapphire', grade: 'giant' }] });
});

it('dropping on a tab goes to its first free place, with tab checks', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.bags.mining[0] = pick;
  s.bags.mining[1] = gem(s, 'ruby', { count: 4 });
  expect(dropItem(s, bag('mining', 0), { where: 'stashTab', tab: 'general' })).toBe('ok');
  expect(s.stash.general[0]).toBe(pick);
  expect(dropItem(s, cell(0), { where: 'stashTab', tab: 'gems' })).toBe('gemsOnly');
  expect(dropItem(s, bag('mining', 1), { where: 'stashTab', tab: 'general' })).toBe('gearOnly');
  expect(dropItem(s, bag('mining', 1), { where: 'stashTab', tab: 'auto' })).toBe('ok');
  expect([s.bags.mining[1], s.stash.gems.ruby.tiny]).toEqual([null, 4]);
  expect(dropItem(s, cell(0), { where: 'stashTab', tab: 'auto' })).toBe('ok');   // already there
  expect(s.stash.general[0]).toBe(pick);
});

it('a lamp worn by a drop reveals more metres at once, and taking it off keeps their rolls', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 3 } });
  expect(equip(s, bag('mining', 0))).toBe('ok');
  expect(Object.keys(s.ahead).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  const rolls = structuredClone(s.ahead);
  expect(unequip(s, 'lamp')).toBe('ok');
  expect(s.ahead).toEqual(rolls);
});

it('equip refuses the wrong things', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gem(s);
  expect(equip(s, bag('mining', 0))).toBe('invalid');
  expect(equip(s, bag('mining', 5))).toBe('invalid');
  expect(equip(s, { where: 'worn', slot: 'lamp' })).toBe('invalid');
  s.bags.mining[1] = gear(s, 'boots');
  expect(dropItem(s, bag('mining', 1), { where: 'worn', slot: 'lamp' })).toBe('wrongSlot');
});

function gearIds(s: GameState): number[] {
  const ids: number[] = [];
  for (const set of ['mining', 'battle'] as const) {
    for (const c of s.bags[set]) if (c !== null && isGear(c)) ids.push(c.id);
    for (const g of Object.values(s.equipped[set])) ids.push(g.id);
  }
  for (const c of s.stash.general) if (c !== null) ids.push(c.id);
  for (const o of s.overflow) ids.push(o.item.id);
  return ids.sort((a, b) => a - b);
}

/** How many gems of each type and grade exist: in bag stacks, the Gems tab and every socket. */
function gemCounts(s: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (g: { gem: string; grade: string }, n: number): void => {
    const key = `${g.gem}/${g.grade}`;
    counts[key] = (counts[key] ?? 0) + n;
  };
  const addSocketed = (g: { gems: Gem[] }): void => { for (const x of g.gems) add(x, 1); };
  for (const set of ['mining', 'battle'] as const) {
    for (const c of s.bags[set]) if (c !== null) { if (isGear(c)) addSocketed(c); else add(c, c.count); }
    for (const g of Object.values(s.equipped[set])) addSocketed(g);
  }
  for (const c of s.stash.general) if (c !== null) addSocketed(c);
  for (const o of s.overflow) addSocketed(o.item);
  for (const t of GEM_TYPES) for (const grade of GEM_GRADES) if (s.stash.gems[t][grade] > 0) add({ gem: t, grade }, s.stash.gems[t][grade]);
  return counts;
}

const ALL_SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS];
const TABS = ['general', 'gems', 'auto'] as const;

it('drops, sends and unequips never create or lose items, and the walk reaches every rule', () => {
  const decoded = decodeSave(fixture3);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const s = decoded.state;
  // Identical stacks to merge, Gems-tab counts to take from or fill, and nearly full grids to run out of room.
  s.bags.mining[20] = gem(s, 'ruby', { count: 10 });
  s.bags.mining[21] = gem(s, 'ruby', { count: 20 });
  s.bags.mining[22] = gem(s, 'ruby', { count: 25 });
  s.bags.battle[20] = gem(s, 'sapphire', { grade: 'big', count: 25 });
  s.bags.battle[21] = gem(s, 'sapphire', { grade: 'big', count: 7 });
  s.stash.gems.ruby.tiny = 60;
  s.stash.gems.sapphire.big = 999_990;
  s.stash.gems.emerald.small = 30;
  s.stash.gems.amethyst.giant = 3;
  const fill = (set: GearSet, free: number): void => {
    const slots: readonly Slot[] = set === 'mining' ? MINING_SLOTS : BATTLE_SLOTS;
    const cells = s.bags[set];
    let n = 0;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== null) continue;
      if (cells.filter((c) => c === null).length <= free) break;
      cells[i] = n++ % 3 === 0 ? gem(s, GEM_TYPES[n % GEM_TYPES.length] ?? 'ruby', { grade: GEM_GRADES[n % 2] ?? 'tiny', count: 1 + (n % 25) }) : gear(s, slots[n % slots.length] ?? 'pickaxe', { sockets: n % 4 });
    }
  };
  fill('mining', 1);
  fill('battle', 2);
  for (let i = 0; i < s.stash.general.length; i++) {
    if (s.stash.general[i] === null && s.stash.general.filter((c) => c === null).length > 2) {
      s.stash.general[i] = gear(s, ALL_SLOTS[i % ALL_SLOTS.length] ?? 'pickaxe', { sockets: i % 4 });
    }
  }
  s.equipped.mining.lamp ??= gear(s, 'lamp', { sockets: 2 });
  expect(validateState(s)).toBe(true);
  const ids = gearIds(s);
  const gems = gemCounts(s);

  let rng = 7;
  const draw = (n: number): number => {
    const r = mulberry32(rng);
    rng = r.state;
    return Math.floor(r.value * n);
  };
  const pick = <T,>(list: readonly T[]): T => {
    const x = list[draw(list.length)];
    if (x === undefined) throw new Error('empty list');
    return x;
  };
  const cellLocs: ItemLoc[] = [];
  for (const set of ['mining', 'battle'] as const) for (let i = 0; i < 24; i++) cellLocs.push(bag(set, i));
  for (let i = 0; i < 60; i++) cellLocs.push(cell(i));
  for (const t of GEM_TYPES) for (const g of GEM_GRADES) cellLocs.push(stack(t, g));
  const wornLocs: ItemLoc[] = ALL_SLOTS.map((slot) => ({ where: 'worn', slot }));
  const everyLoc = [...cellLocs, ...wornLocs];
  const occupied = (): ItemLoc => {
    const filled = everyLoc.filter((l) => itemAt(s, l) !== undefined);
    return pick(filled);
  };
  // A place the item would merge or swap with: an identical gem stack, or gear for the same slot.
  const partnerOf = (from: ItemLoc): ItemLoc | undefined => {
    const item = itemAt(s, from);
    if (item === undefined) return undefined;
    const partners = everyLoc.filter((l) => {
      const other = itemAt(s, l);
      if (other === undefined || sameLoc(l, from)) return false;
      return isGear(item) ? isGear(other) && other.slot === item.slot : !isGear(other) && other.gem === item.gem && other.grade === item.grade;
    });
    return partners.length > 0 ? pick(partners) : undefined;
  };
  const target = (from: ItemLoc): DropTarget => {
    const roll = draw(10);
    if (roll < 4) return partnerOf(from) ?? pick(everyLoc);
    const wornNow = wornLocs.filter((l) => itemAt(s, l) !== undefined);
    if (roll < 5 && wornNow.length > 0) return pick(wornNow);
    if (roll < 6) return { where: 'stashTab', tab: pick(TABS) };
    return pick(everyLoc);
  };

  const seen = {
    merge: 0, takeTopUp: 0, wornSwap: 0, wornSwapOut: 0, stackFull: 0, bagFull: 0, stashFull: 0,
    send: 0, unequip: 0, socket: 0,
  };
  const kind = (l: ItemLoc | DropTarget): string => {
    if (l.where === 'stashTab') return 'tab';
    const item = itemAt(s, l);
    return item === undefined ? 'empty' : isGear(item) ? 'gear' : 'gem';
  };
  for (let i = 0; i < 4000; i++) {
    const op = draw(10);
    let result: string;
    if (op < 6) {
      const from = occupied();
      const to = target(from);
      const [a, b] = [itemAt(s, from), to.where === 'stashTab' ? undefined : itemAt(s, to)];
      const kinds = [kind(from), kind(to)];
      result = dropItem(s, from, to);
      if (result === 'ok' && a !== undefined && b !== undefined && !isGear(a) && !isGear(b) && a.gem === b.gem && a.grade === b.grade) {
        if (from.where === 'bag' && to.where === 'bag') seen.merge++;
        if (from.where === 'gems' && to.where === 'bag') seen.takeTopUp++;
      }
      if (result === 'ok' && to.where === 'worn' && from.where !== 'worn' && kinds.join() === 'gear,gear') seen.wornSwap++;
      if (result === 'ok' && from.where === 'worn' && (to.where === 'bag' || to.where === 'stash') && kinds[1] === 'gear') seen.wornSwapOut++;
      if (result === 'ok' && a !== undefined && !isGear(a) && b !== undefined && isGear(b)) seen.socket++;
    } else if (op < 8) {
      result = sendItem(s, occupied(), pick(['stash', 'mining', 'battle'] as const));
      if (result === 'ok') seen.send++;
    } else {
      result = unequip(s, pick(ALL_SLOTS));
      if (result === 'ok') seen.unequip++;
    }
    if (result === 'stackFull') seen.stackFull++;
    if (result === 'bagFull') seen.bagFull++;
    if (result === 'stashFull') seen.stashFull++;
    expect(gearIds(s)).toEqual(ids);
    expect(gemCounts(s)).toEqual(gems);
    expect(validateState(s)).toBe(true);
  }
  for (const [name, n] of Object.entries(seen)) expect([name, n > 0]).toEqual([name, true]);
});
