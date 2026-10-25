import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { gambleResultText, gambleSlots, gambledLine } from '../../src/ui/merchant/merchantView';
import { gear } from '../helpers/items';

it('lists the mining slots, then the battle slots, with their price and whether you can pay it', () => {
  const s = newGame(1, 0);
  s.deepest = 1_100;
  s.gold = 14_700;
  const groups = gambleSlots(s);
  expect(groups.map((g) => g.set)).toEqual(['mining', 'battle']);
  expect(groups[0]?.slots.map((x) => [x.slot, x.label])).toEqual([
    ['pickaxe', 'Pickaxe'], ['lamp', 'Lamp helm'], ['gloves', 'Gloves'], ['boots', 'Boots'],
  ]);
  expect(groups[1]?.slots.map((x) => [x.slot, x.label])).toEqual([
    ['weapon', 'Weapon'], ['armor', 'Armor'], ['helm', 'Helm'], ['ring', 'Ring'], ['amulet', 'Amulet'],
  ]);
  const all = groups.flatMap((g) => g.slots);
  expect(all.every((x) => x.price === 14_700 && x.affordable)).toBe(true);
  s.gold = 14_699;
  expect(gambleSlots(s).flatMap((g) => g.slots).some((x) => x.affordable)).toBe(false);
  s.deepest = 0;
  expect(gambleSlots(s).flatMap((g) => g.slots).every((x) => x.price === 300 && x.affordable)).toBe(true);
});

it('says why a gamble was refused', () => {
  expect(gambleResultText('noGold')).toBe('Not enough Gold.');
  expect(gambleResultText('bagFull')).toBe('Your bag is full.');
  expect(gambleResultText('ok')).toBeNull();
});

it('describes the gambled item', () => {
  const s = newGame(1, 0);
  expect(gambledLine(gear(s, 'gloves', { rarity: 'rare', ilvl: 7 }))).toBe('Rare gloves · item level 7 · now in your bag');
  expect(gambledLine(gear(s, 'lamp', { rarity: 'normal', ilvl: 1_200 }))).toBe('Normal lamp helm · item level 1,200 · now in your bag');
});
