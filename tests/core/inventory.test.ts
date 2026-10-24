import { expect, it } from 'vitest';
import { filledCount } from '../../src/core/cells';
import { equip, moveItem, salvage, sell, socketGem, unequip } from '../../src/core/inventory';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { gear, gem } from '../helpers/items';

it('equipping swaps with the worn item in place', () => {
  const s = newGame(1, 0);
  const worn = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = worn;
  const [a, b, c] = [gear(s, 'boots'), gear(s, 'pickaxe'), gear(s, 'gloves')];
  s.bags.mining.splice(0, 3, a, b, c);
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBe(b);
  expect(s.bags.mining.slice(0, 3)).toEqual([a, worn, c]);
});

it('equipping into an empty slot leaves the cell empty', () => {
  const s = newGame(1, 0);
  const lamp = gear(s, 'lamp');
  s.bags.mining[0] = gem(s);
  s.bags.mining[1] = lamp;
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.lamp).toBe(lamp);
  expect(s.bags.mining[1]).toBeNull();
  expect(filledCount(s.bags.mining)).toBe(1);
});

it('only gear from its own bag can be equipped', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gem(s);
  s.bags.battle[0] = gear(s, 'ring');
  expect(equip(s, 'mining', 0)).toBe('invalid');
  expect(equip(s, 'mining', 5)).toBe('invalid');
  expect(equip(s, 'battle', 0)).toBe('ok');
});

it('unequipping needs room in the bag and takes the first empty cell', () => {
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
});

it('selling and salvaging pay out and empty the cell', () => {
  const s = newGame(1, 0);
  s.stash.general[3] = gear(s, 'ring', { rarity: 'rare', ilvl: 10 });
  s.bags.mining[4] = gear(s, 'boots', { rarity: 'rare', ilvl: 10 });
  expect(sell(s, 'stash', 3)).toBe('ok');
  expect(salvage(s, 'mining', 4)).toBe('ok');
  expect([s.gold, s.diamonds, filledCount(s.stash.general), filledCount(s.bags.mining)]).toEqual([300, 12, 0, 0]);
  expect(s.stash.general[3]).toBeNull();
  expect(sell(s, 'stash', 3)).toBe('invalid');
});

it('selling a gem stack pays for every gem in it', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gem(s, 'ruby', { grade: 'big', count: 3 });
  expect(sell(s, 'mining', 0)).toBe('ok');
  expect(s.gold).toBe(480);
});

it('items move between the bags and the stash within the rules', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  const ruby = gem(s);
  s.bags.mining[0] = pick;
  s.bags.mining[1] = ruby;
  expect(moveItem(s, 'mining', 0, 'stash')).toBe('ok');
  expect(s.stash.general[0]).toBe(pick);
  expect(s.bags.mining[0]).toBeNull();
  expect(moveItem(s, 'stash', 0, 'battle')).toBe('invalid');
  expect(moveItem(s, 'mining', 1, 'battle')).toBe('ok');
  expect(s.bags.battle[0]).toBe(ruby);
  expect(moveItem(s, 'stash', 0, 'stash')).toBe('invalid');
  s.bags.battle[1] = gear(s, 'ring');
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'amulet'));
  expect(moveItem(s, 'battle', 1, 'stash')).toBe('stashFull');
});

it('a gem stack moved to the stash joins the Gems tab', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gem(s, 'ruby', { grade: 'small', count: 7 });
  s.stash.gems.ruby.small = 3;
  expect(moveItem(s, 'mining', 0, 'stash')).toBe('ok');
  expect([s.bags.mining[0], s.stash.gems.ruby.small]).toEqual([null, 10]);
  s.bags.mining[0] = gem(s, 'ruby', { grade: 'small', count: 7 });
  s.stash.gems.ruby.small = 999_995;
  expect(moveItem(s, 'mining', 0, 'stash')).toBe('stashFull');
  expect([s.bags.mining[0]?.type, s.stash.gems.ruby.small]).toEqual(['gem', 999_995]);
});

it('a socketed gem is taken from its stack and counts toward stats', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { sockets: 1 });
  s.equipped.mining.pickaxe = pick;
  s.bags.mining[0] = gem(s, 'ruby', { count: 2 });
  s.bags.mining[1] = gem(s, 'emerald');
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('ok');
  expect(pick.gems).toEqual([{ gem: 'ruby', grade: 'tiny' }]);
  expect(s.bags.mining[0]).toMatchObject({ gem: 'ruby', count: 1 });
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.08);
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('noSocket');
  expect(socketGem(s, 'mining', 0, 'lamp')).toBe('invalid');
  pick.sockets = 2;
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('ok');
  expect([pick.gems.length, s.bags.mining[0], filledCount(s.bags.mining)]).toEqual([2, null, 1]);
});

it('a better lamp reveals more metres at once, and taking it off keeps their rolls', () => {
  const s = newGame(1, 0);
  s.bags.mining[0] = gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 3 } });
  expect(equip(s, 'mining', 0)).toBe('ok');
  expect(Object.keys(s.ahead).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  const rolls = structuredClone(s.ahead);
  expect(unequip(s, 'lamp')).toBe('ok');
  expect(s.ahead).toEqual(rolls);
});
