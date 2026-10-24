import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { actionForIntent, hoverNote, itemActions, resultText } from '../../src/ui/character/itemActions';
import { gear, gem } from '../helpers/items';

it('a bag item offers equip, sell, salvage and stash', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bags.mining[0] = pick;
  const t = { where: 'bag', set: 'mining', index: 0 } as const;
  expect(itemActions(s, t, 'mining')).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'sell', label: 'Sell (+48 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Diamonds)', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  expect(hoverNote(t, pick)).toBe('Click to equip · Alt+click to sell · Shift+click to stash');
});

it('a gem offers a socket in each worn item with room', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { name: 'Stonebiter', sockets: 1 });
  s.equipped.battle.helm = gear(s, 'helm', { name: 'Grim Visor', sockets: 2, gems: [gem(s), gem(s)] });
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  s.bags.mining[0] = gem(s, 'ruby');
  expect(itemActions(s, { where: 'bag', set: 'mining', index: 0 }, 'mining').map((a) => a.label)).toEqual([
    'Socket into Stonebiter (+8% Gold yield)',
    'Socket into Brass Loop (+6% damage)',
    'Sell (+40 Gold)',
    'Salvage (+2 Diamonds)',
    'To stash',
  ]);
});

it('worn and stashed items, a full stash, and what clicks do', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 2 });
  expect(itemActions(s, { where: 'worn', slot: 'pickaxe' }, 'mining')).toEqual([{ id: 'unequip', label: 'Unequip', disabled: false }]);
  expect(itemActions(s, { where: 'stash', index: 0 }, 'battle').map((a) => [a.id, a.label])).toEqual([
    ['toBag', 'To bag'], ['sell', 'Sell (+10 Gold)'], ['salvage', 'Salvage (+1 Diamond)'],
  ]);
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'ring'));
  s.bags.mining[0] = gear(s, 'gloves');
  s.bags.mining[1] = gem(s);
  const t0 = { where: 'bag', set: 'mining', index: 0 } as const;
  const t1 = { where: 'bag', set: 'mining', index: 1 } as const;
  const a0 = itemActions(s, t0, 'mining');
  const a1 = itemActions(s, t1, 'mining');
  expect(a0.find((a) => a.id === 'toStash')?.disabled).toBe(true);
  expect(a1.find((a) => a.id === 'toStash')?.disabled).toBe(false);   // a gem joins the Gems tab
  expect(actionForIntent(a0, t0, 'primary')).toMatchObject({ id: 'equip' });
  expect(actionForIntent(a1, t1, 'primary')).toBe('menu');
  expect(actionForIntent(a1, t1, 'sell')).toMatchObject({ id: 'sell' });
  expect(actionForIntent(a0, t0, 'move')).toMatchObject({ id: 'toStash', disabled: true });
  expect(resultText('stashFull')).toBe('The stash is full.');
  expect(resultText('ok')).toBeNull();
});
