import { expect, it } from 'vitest';
import { BAG_SIZE, STASH_SIZE } from '../../src/core/balance';
import { equip, moveItem, salvage, sell, socketGem, unequip } from '../../src/core/inventory';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { gear, gem } from '../helpers/items';

it('equipping swaps with the worn item in place', () => {
  const s = newGame(1, 0);
  const worn = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = worn;
  const [a, b, c] = [gear(s, 'boots'), gear(s, 'pickaxe'), gear(s, 'gloves')];
  s.bags.mining.push(a, b, c);
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBe(b);
  expect(s.bags.mining).toEqual([a, worn, c]);
});

it('equipping into an empty slot takes the item out of the bag', () => {
  const s = newGame(1, 0);
  const lamp = gear(s, 'lamp');
  s.bags.mining.push(gem(s), lamp);
  expect(equip(s, 'mining', 1)).toBe('ok');
  expect(s.equipped.mining.lamp).toBe(lamp);
  expect(s.bags.mining).toHaveLength(1);
});

it('only gear from its own bag can be equipped', () => {
  const s = newGame(1, 0);
  s.bags.mining.push(gem(s));
  s.bags.battle.push(gear(s, 'ring'));
  expect(equip(s, 'mining', 0)).toBe('invalid');
  expect(equip(s, 'mining', 5)).toBe('invalid');
  expect(equip(s, 'battle', 0)).toBe('ok');
});

it('unequipping needs room in the bag', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  s.equipped.mining.pickaxe = pick;
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
  expect(unequip(s, 'pickaxe')).toBe('bagFull');
  expect(s.equipped.mining.pickaxe).toBe(pick);
  s.bags.mining.pop();
  expect(unequip(s, 'pickaxe')).toBe('ok');
  expect(s.equipped.mining.pickaxe).toBeUndefined();
  expect(s.bags.mining.at(-1)).toBe(pick);
  expect(unequip(s, 'pickaxe')).toBe('invalid');
});

it('selling and salvaging pay out and remove the item', () => {
  const s = newGame(1, 0);
  s.stash.push(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }));
  s.bags.mining.push(gear(s, 'boots', { rarity: 'rare', ilvl: 10 }));
  expect(sell(s, 'stash', 0)).toBe('ok');
  expect(salvage(s, 'mining', 0)).toBe('ok');
  expect([s.gold, s.diamonds, s.stash.length, s.bags.mining.length]).toEqual([300, 12, 0, 0]);
  expect(sell(s, 'stash', 0)).toBe('invalid');
});

it('items move between the bags and the stash within the rules', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe');
  const ruby = gem(s);
  s.bags.mining.push(pick, ruby);
  expect(moveItem(s, 'mining', 0, 'stash')).toBe('ok');
  expect(moveItem(s, 'stash', 0, 'battle')).toBe('invalid');
  expect(moveItem(s, 'mining', 0, 'battle')).toBe('ok');
  expect(s.bags.battle).toEqual([ruby]);
  expect(moveItem(s, 'stash', 0, 'stash')).toBe('invalid');
  for (let i = 0; i < STASH_SIZE - 1; i++) s.stash.push(gem(s));
  expect(moveItem(s, 'battle', 0, 'stash')).toBe('stashFull');
});

it('a socketed gem stays in its item and counts toward stats', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { sockets: 1 });
  s.equipped.mining.pickaxe = pick;
  s.bags.mining.push(gem(s, 'ruby', { ilvl: 4 }), gem(s, 'emerald'));
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('ok');
  expect([pick.gems.length, s.bags.mining.length]).toEqual([1, 1]);
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.12);
  expect(socketGem(s, 'mining', 0, 'pickaxe')).toBe('noSocket');
  expect(socketGem(s, 'mining', 0, 'lamp')).toBe('invalid');
});

it('a better lamp reveals more metres at once, and taking it off keeps their rolls', () => {
  const s = newGame(1, 0);
  s.bags.mining.push(gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 3 } }));
  expect(equip(s, 'mining', 0)).toBe('ok');
  expect(Object.keys(s.ahead).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  const rolls = structuredClone(s.ahead);
  expect(unequip(s, 'lamp')).toBe('ok');
  expect(s.ahead).toEqual(rolls);
});
