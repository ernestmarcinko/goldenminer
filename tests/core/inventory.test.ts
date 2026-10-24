import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { itemAt } from '../../src/core/cells';
import { dropItem, equip, moveItem, salvage, sell, sendItem, socketGem, unequip } from '../../src/core/inventory';
import { GEM_GRADES, GEM_TYPES, isGear, MINING_SLOTS, BATTLE_SLOTS } from '../../src/core/items';
import type { GearSet } from '../../src/core/items';
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

function gemTotal(s: GameState): number {
  let total = 0;
  const addGear = (g: { gems: unknown[] }): void => { total += g.gems.length; };
  for (const set of ['mining', 'battle'] as const) {
    for (const c of s.bags[set]) if (c !== null) { if (isGear(c)) addGear(c); else total += c.count; }
    for (const g of Object.values(s.equipped[set])) addGear(g);
  }
  for (const c of s.stash.general) if (c !== null) addGear(c);
  for (const o of s.overflow) addGear(o.item);
  for (const t of GEM_TYPES) for (const grade of GEM_GRADES) total += s.stash.gems[t][grade];
  return total;
}

it('drops never create or lose items', () => {
  const decoded = decodeSave(fixture3);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const s = decoded.state;
  // enough gems of several kinds to make stacks, merges and takes likely
  s.stash.gems.ruby.tiny = 40;
  s.stash.gems.sapphire.big = 7;
  s.bags.mining[20] = gem(s, 'ruby', { count: 12 });
  s.bags.battle[20] = gem(s, 'sapphire', { grade: 'big', count: 25 });
  expect(validateState(s)).toBe(true);
  const ids = gearIds(s);
  const gems = gemTotal(s);

  let rng = 7;
  const draw = (n: number): number => {
    const r = mulberry32(rng);
    rng = r.state;
    return Math.floor(r.value * n);
  };
  const cellLoc = (): ItemLoc => {
    const kind = draw(4);
    if (kind === 0) return bag('mining', draw(24));
    if (kind === 1) return bag('battle', draw(24));
    if (kind === 2) return cell(draw(60));
    return stack(GEM_TYPES[draw(GEM_TYPES.length)] ?? 'ruby', GEM_GRADES[draw(GEM_GRADES.length)] ?? 'tiny');
  };
  const anyLoc = (): ItemLoc => {
    if (draw(5) > 0) return cellLoc();
    const slots = [...MINING_SLOTS, ...BATTLE_SLOTS];
    return { where: 'worn', slot: slots[draw(slots.length)] ?? 'pickaxe' };
  };
  const target = (): DropTarget => {
    if (draw(12) > 0) return anyLoc();
    const tabs = ['general', 'gems', 'auto'] as const;
    return { where: 'stashTab', tab: tabs[draw(3)] ?? 'auto' };
  };
  // aim at things that exist most of the time, so most drops do something
  const occupied = (): ItemLoc => {
    for (let i = 0; i < 30; i++) {
      const loc = anyLoc();
      if (itemAt(s, loc) !== undefined) return loc;
    }
    return anyLoc();
  };

  const results = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    results.add(dropItem(s, occupied(), target()));
    expect(gearIds(s)).toEqual(ids);
    expect(gemTotal(s)).toBe(gems);
    expect(validateState(s)).toBe(true);
  }
  // the run exercised more than the happy path
  expect(results.has('ok')).toBe(true);
  expect(results.size).toBeGreaterThan(4);
});
