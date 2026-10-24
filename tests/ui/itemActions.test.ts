import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import type { ItemLoc } from '../../src/core/types';
import { actionForIntent, hoverNote, itemActions, resultText } from '../../src/ui/character/itemActions';
import { gear, gem } from '../helpers/items';

const bag = (index: number, set: 'mining' | 'battle' = 'mining'): ItemLoc => ({ where: 'bag', set, index });
const labels = (specs: ReturnType<typeof itemActions>) => specs.map((a) => [a.id, a.label]);

it('bag gear offers equip, sell, salvage and stash', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bags.mining[0] = pick;
  expect(itemActions(s, bag(0), 'mining')).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'sell', label: 'Sell (+48 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Diamonds)', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  expect(hoverNote(bag(0), pick)).toBe('Click to equip · Alt+click to sell · Shift+click to stash');
});

it('a bag gem stack offers sockets in worn then carried gear, then sell, salvage and the Gems tab', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { name: 'Stonebiter', sockets: 1 });
  s.equipped.battle.helm = gear(s, 'helm', { name: 'Grim Visor', sockets: 2, gems: [gem(s), gem(s)] });
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  s.bags.battle[3] = gear(s, 'amulet', { name: 'Tin Charm', sockets: 1 });
  s.stash.general[8] = gear(s, 'boots', { name: 'Old Boots', sockets: 2 });
  s.bags.mining[0] = gem(s, 'ruby', { count: 3 });
  const specs = itemActions(s, bag(0), 'mining');
  expect(labels(specs)).toEqual([
    ['socket', 'Socket into Stonebiter (+8% Gold yield)'],
    ['socket', 'Socket into Brass Loop (+6% damage)'],
    ['socket', 'Socket into Tin Charm (+6% damage) (bag)'],
    ['socket', 'Socket into Old Boots (+8% Gold yield) (stash)'],
    ['sell', 'Sell (+120 Gold)'],
    ['salvage', 'Salvage (+6 Diamonds)'],
    ['toStash', 'To Gems tab'],
  ]);
  expect(specs.filter((a) => a.id === 'socket').map((a) => a.into)).toEqual([
    { where: 'worn', slot: 'pickaxe' }, { where: 'worn', slot: 'ring' }, bag(3, 'battle'), { where: 'stash', index: 8 },
  ]);
});

it('General gear offers equip, to bag, sell and salvage', () => {
  const s = newGame(1, 0);
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 2 });
  const t: ItemLoc = { where: 'stash', index: 0 };
  expect(itemActions(s, t, 'battle')).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'toBag', label: 'To bag', disabled: false },
    { id: 'sell', label: 'Sell (+10 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+1 Diamond)', disabled: false },
  ]);
  s.bags.mining = s.bags.mining.map((c) => c ?? gem(s));
  expect(itemActions(s, t, 'battle').find((a) => a.id === 'toBag')?.disabled).toBe(true);
  expect(actionForIntent(itemActions(s, t, 'battle'), t, 'primary')).toMatchObject({ id: 'toBag' });
  expect(hoverNote(t, gear(s, 'boots'))).toBe('Click to move to your bag · Alt+click to sell');
});

it('a Gems-tab stack takes, sockets, and sells or salvages all of it', () => {
  const s = newGame(1, 0);
  s.stash.gems.sapphire.big = 100;
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  const t: ItemLoc = { where: 'gems', gem: 'sapphire', grade: 'big' };
  const specs = itemActions(s, t, 'mining');
  expect(labels(specs)).toEqual([
    ['take', 'Take to bag (up to 25)'],
    ['socket', 'Socket into Brass Loop (+11% all resistances)'],
    ['sell', 'Sell all (+16,000 Gold)'],
    ['salvage', 'Salvage all (+400 Diamonds)'],
  ]);
  expect(specs.every((a) => !a.disabled)).toBe(true);
  s.bags.mining = s.bags.mining.map((c) => c ?? gem(s, 'ruby'));
  expect(itemActions(s, t, 'mining')[0]).toMatchObject({ id: 'take', disabled: true });
  s.bags.mining[5] = gem(s, 'sapphire', { grade: 'big', count: 10 });   // a stack with room can be topped up
  expect(itemActions(s, t, 'mining')[0]).toMatchObject({ id: 'take', disabled: false });
});

it('a worn item offers unequip and to stash', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  const t: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  expect(itemActions(s, t, 'mining')).toEqual([
    { id: 'unequip', label: 'Unequip', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, t, 'mining')[1]).toMatchObject({ id: 'toStash', disabled: true });
});

it('what clicks do', () => {
  const s = newGame(1, 0);
  s.stash.general[0] = gear(s, 'boots');
  s.stash.gems.ruby.tiny = 7;
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.bags.mining[0] = gear(s, 'gloves');
  s.bags.mining[1] = gem(s);
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  const gems: ItemLoc = { where: 'gems', gem: 'ruby', grade: 'tiny' };
  const general: ItemLoc = { where: 'stash', index: 0 };
  const act = (t: ItemLoc, intent: Parameters<typeof actionForIntent>[2]) => actionForIntent(itemActions(s, t, 'mining'), t, intent);
  expect(act(bag(0), 'primary')).toMatchObject({ id: 'equip' });
  expect(act(bag(0), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(bag(0), 'sell')).toMatchObject({ id: 'sell' });
  expect(act(bag(1), 'primary')).toBe('menu');
  expect(act(bag(1), 'move')).toMatchObject({ id: 'toStash', label: 'To Gems tab' });
  expect(act(general, 'primary')).toMatchObject({ id: 'toBag' });
  expect(act(gems, 'primary')).toMatchObject({ id: 'take' });
  expect(act(gems, 'move')).toMatchObject({ id: 'take' });
  expect(act(gems, 'sell')).toBe('menu');
  expect(act(gems, 'menu')).toBe('menu');
  expect(act(worn, 'primary')).toMatchObject({ id: 'unequip' });
  expect(act(worn, 'move')).toMatchObject({ id: 'toStash' });
});

it('every refusal has a message, and success has none', () => {
  expect(resultText('stashFull')).toBe('The stash is full.');
  expect(resultText('wrongSet')).toBe('That gear belongs in the other bag.');
  expect(resultText('wrongSlot')).toBe("That doesn't fit that slot.");
  expect(resultText('gemsOnly')).toBe('Only gems go in the Gems tab.');
  expect(resultText('gearOnly')).toBe('Gems go in the Gems tab.');
  expect(resultText('stackFull')).toBe('That stack is full.');
  expect(resultText('invalid')).toBe("That can't go there.");
  expect(resultText('ok')).toBeNull();
});
