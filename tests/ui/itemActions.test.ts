import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import type { ItemLoc } from '../../src/core/types';
import { addMap, startMap } from '../../src/core/maps';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { actionForIntent, hoverNote, itemActions, resultText, runAction } from '../../src/ui/character/itemActions';
import { gear, gem } from '../helpers/items';
import { lootNoteText } from '../../src/ui/character/itemView';
import { MATERIAL_STASH_STACK } from '../../src/core/balance';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });
const labels = (specs: ReturnType<typeof itemActions>) => specs.map((a) => [a.id, a.label]);

it('bag gear offers equip, sell, salvage and stash', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bag[0] = pick;
  expect(itemActions(s, bag(0))).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'sell', label: 'Sell (+48 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Copper ore, +1 Tin ore)', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  expect(hoverNote(bag(0), pick)).toBe('Click to equip · Alt+click to sell · Shift+click to stash');
});

it('a bag gem stack offers sockets in worn then carried gear, then sell, salvage and the Gems tab', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { name: 'Stonebiter', sockets: 1 });
  s.equipped.battle.helm = gear(s, 'helm', { name: 'Grim Visor', sockets: 2, gems: [gem(s), gem(s)] });
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  s.bag[3] = gear(s, 'amulet', { name: 'Tin Charm', sockets: 1 });
  s.stash.general[8] = gear(s, 'boots', { name: 'Old Boots', sockets: 2 });
  s.bag[0] = gem(s, 'ruby', { count: 3 });
  const specs = itemActions(s, bag(0));
  expect(labels(specs)).toEqual([
    ['socket', 'Socket into Stonebiter (+8% Gold yield)'],
    ['socket', 'Socket into Brass Loop (+6% damage)'],
    ['socket', 'Socket into Tin Charm (+6% damage) (bag)'],
    ['socket', 'Socket into Old Boots (+8% Gold yield) (stash)'],
    ['sell', 'Sell (+120 Gold)'],
    ['salvage', 'Salvage (+3 Tin ore)'],
    ['toStash', 'To Gems tab'],
  ]);
  expect(specs.filter((a) => a.id === 'socket').map((a) => a.into)).toEqual([
    { where: 'worn', slot: 'pickaxe' }, { where: 'worn', slot: 'ring' }, bag(3), { where: 'stash', index: 8 },
  ]);
});

it('General gear offers equip, to bag, sell and salvage', () => {
  const s = newGame(1, 0);
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 2 });
  const t: ItemLoc = { where: 'stash', index: 0 };
  expect(itemActions(s, t)).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'toBag', label: 'To bag', disabled: false },
    { id: 'sell', label: 'Sell (+10 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+1 Copper ore)', disabled: false },
  ]);
  s.bag = s.bag.map((c) => c ?? gem(s));
  expect(itemActions(s, t).find((a) => a.id === 'toBag')?.disabled).toBe(true);
  expect(actionForIntent(itemActions(s, t), t, 'primary')).toMatchObject({ id: 'toBag' });
  expect(hoverNote(t, gear(s, 'boots'))).toBe('Click to move to your bag · Alt+click to sell');
});

it('a Gems-tab stack takes, sockets, and sells or salvages all of it', () => {
  const s = newGame(1, 0);
  s.stash.gems.sapphire.big = 100;
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  const t: ItemLoc = { where: 'gems', gem: 'sapphire', grade: 'big' };
  const specs = itemActions(s, t);
  expect(labels(specs)).toEqual([
    ['take', 'Take to bag (up to 25)'],
    ['socket', 'Socket into Brass Loop (+11% all resistances)'],
    ['sell', 'Sell all (+16,000 Gold)'],
    ['salvage', 'Salvage all (+200 Tin ore)'],
  ]);
  expect(specs.every((a) => !a.disabled)).toBe(true);
  s.bag = s.bag.map((c) => c ?? gem(s, 'ruby'));
  expect(itemActions(s, t)[0]).toMatchObject({ id: 'take', disabled: true });
  s.bag[5] = gem(s, 'sapphire', { grade: 'big', count: 10 });   // a stack with room can be topped up
  expect(itemActions(s, t)[0]).toMatchObject({ id: 'take', disabled: false });
});

it('a worn item offers unequip and to stash', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  const t: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  expect(itemActions(s, t)).toEqual([
    { id: 'unequip', label: 'Unequip', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, t)[1]).toMatchObject({ id: 'toStash', disabled: true });
});

it('what clicks do', () => {
  const s = newGame(1, 0);
  s.stash.general[0] = gear(s, 'boots');
  s.stash.gems.ruby.tiny = 7;
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.bag[0] = gear(s, 'gloves');
  s.bag[1] = gem(s);
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  const gems: ItemLoc = { where: 'gems', gem: 'ruby', grade: 'tiny' };
  const general: ItemLoc = { where: 'stash', index: 0 };
  const act = (t: ItemLoc, intent: Parameters<typeof actionForIntent>[2]) => actionForIntent(itemActions(s, t), t, intent);
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
  expect(hoverNote(gems, gem(s))).toBe('Click to take up to 25 · right-click for more');
  expect(hoverNote(bag(1), gem(s))).toBe('Click for actions · Alt+click to sell · Shift+click to the Gems tab');
});

it('every refusal has a message, and success has none', () => {
  expect(resultText('stashFull')).toBe('The stash is full.');
  expect(resultText('wrongSlot')).toBe("That doesn't fit that slot.");
  expect(resultText('gemsOnly')).toBe('Only gems go in the Gems tab.');
  expect(resultText('gearOnly')).toBe('Only gear goes in the General tab.');
  expect(resultText('mapsOnly')).toBe('Only maps go in the Maps tab.');
  expect(resultText('materialsOnly')).toBe('Only materials go in the Materials tab.');
  expect(resultText('busy')).toBe('Leave the current map first.');
  expect(resultText('bagFull')).toBe('The bag is full.');
  expect(resultText('stackFull')).toBe('That stack is full.');
  expect(resultText('invalid')).toBe("That can't go there.");
  expect(resultText('ok')).toBeNull();
});

it('a bag map runs or goes to the Maps tab; a Maps-tab map runs or comes back to the bag', () => {
  const s = newGame(1, 0);
  const carried = { id: s.nextId++, type: 'map', tier: 4, metre: 327 } as const;
  s.bag[0] = carried;
  s.stash.maps[2] = { id: s.nextId++, type: 'map', tier: 1, metre: 2 };
  const tab: ItemLoc = { where: 'maps', index: 2 };
  expect(itemActions(s, bag(0))).toEqual([
    { id: 'run', label: 'Run this map', disabled: false },
    { id: 'toStash', label: 'To Maps tab', disabled: false },
  ]);
  expect(itemActions(s, tab)).toEqual([
    { id: 'run', label: 'Run this map', disabled: false },
    { id: 'toBag', label: 'To bag', disabled: false },
  ]);
  const act = (t: ItemLoc, intent: Parameters<typeof actionForIntent>[2]) => actionForIntent(itemActions(s, t), t, intent);
  expect(act(bag(0), 'primary')).toBe('menu');
  expect(act(tab, 'primary')).toBe('menu');
  expect(act(bag(0), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(tab, 'move')).toMatchObject({ id: 'toBag' });
  expect(hoverNote(bag(0), carried)).toBe('Click for actions · Shift+click to the Maps tab');
  expect(hoverNote(tab, carried)).toBe('Click for actions · Shift+click to your bag');
});

it('a map cannot run while another run is going, and moves need room', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 4, metre: 327 };
  s.stash.maps[2] = { id: s.nextId++, type: 'map', tier: 1, metre: 2 };
  startMap(s, addMap(s, 1, 2).id);
  const tab: ItemLoc = { where: 'maps', index: 2 };
  expect(itemActions(s, bag(0))[0]).toMatchObject({ id: 'run', disabled: true });
  expect(itemActions(s, tab)[0]).toMatchObject({ id: 'run', disabled: true });
  s.stash.maps = s.stash.maps.map((c) => c ?? { id: s.nextId++, type: 'map', tier: 1, metre: 2 });
  expect(itemActions(s, bag(0))[1]).toMatchObject({ id: 'toStash', disabled: true });
  s.bag = s.bag.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, tab)[1]).toMatchObject({ id: 'toBag', disabled: true });
});

it('Run this map starts that map', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  const map = { id: s.nextId++, type: 'map', tier: 1, metre: 2 } as const;
  s.stash.maps[5] = map;
  const t: ItemLoc = { where: 'maps', index: 5 };
  const run = itemActions(s, t).find((a) => a.id === 'run');
  if (run === undefined) throw new Error('no run action');
  expect(runAction(store, t, run)).toBe('ok');
  expect(store.state.activity.kind).toBe('map');
  expect(store.state.activity.kind === 'map' && store.state.activity.run.map.id).toBe(map.id);
  expect(s.stash.maps[5]).toBeNull();
});

it('Run this map during a run is refused as busy', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 1, metre: 2 };
  store.startMap(addMap(s, 1, 2).id);
  expect(runAction(store, bag(0), { id: 'run', label: 'Run this map', disabled: true })).toBe('busy');
  expect(s.bag[0]).not.toBeNull();
});

it('a bag material stack goes to the Materials tab; a tab stack comes back to the bag', () => {
  const s = newGame(1, 0);
  const copper = { id: s.nextId++, type: 'material', material: 'copper', count: 3 } as const;
  s.bag[1] = copper;
  s.stash.materials.tin = 4;
  const tab: ItemLoc = { where: 'materials', material: 'tin' };
  expect(itemActions(s, bag(1)).map((a) => a.label)).toEqual(['To Materials tab']);
  expect(itemActions(s, tab).map((a) => a.label)).toEqual(['Take to bag (up to 50)']);
  expect(itemActions(s, bag(1))[0]).toMatchObject({ id: 'toStash', disabled: false });
  expect(itemActions(s, tab)[0]).toMatchObject({ id: 'take', disabled: false });
  const act = (t: ItemLoc, intent: Parameters<typeof actionForIntent>[2]) => actionForIntent(itemActions(s, t), t, intent);
  expect(act(bag(1), 'primary')).toBe('menu');
  expect(act(bag(1), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(tab, 'primary')).toMatchObject({ id: 'take' });
  expect(act(tab, 'move')).toMatchObject({ id: 'take' });
  expect(hoverNote(bag(1), copper)).toBe('Click for actions · Shift+click to the Materials tab');
  expect(hoverNote(tab, copper)).toBe('Click to take up to 50 · right-click for more');
  s.stash.materials.copper = MATERIAL_STASH_STACK;
  expect(itemActions(s, bag(1))[0]).toMatchObject({ disabled: true });
  s.bag = s.bag.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, tab)[0]).toMatchObject({ disabled: true });
});

it('salvage lists the materials it gives, in material order', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4 });
  expect(itemActions(s, bag(0)).find((a) => a.id === 'salvage')?.label)
    .toBe('Salvage (+3 Copper ore, +2 Tin ore, +1 Iron ore)');
});

it('a salvaged note counts the materials it gave', () => {
  expect(lootNoteText({ name: 'X', rarity: 'magic', base: 'boots', outcome: 'salvaged', value: 3 }))
    .toContain('salvaged into 3 materials');
});

it('one bag: unequip and To bag need a free cell in it', () => {
  const s = newGame(1, 0);
  s.equipped.battle.helm = gear(s, 'helm');
  s.stash.general[0] = gear(s, 'ring');
  const worn: ItemLoc = { where: 'worn', slot: 'helm' };
  const general: ItemLoc = { where: 'stash', index: 0 };
  expect(itemActions(s, worn)[0]).toMatchObject({ id: 'unequip', disabled: false });
  s.bag = s.bag.map(() => gear(s, 'pickaxe'));
  expect(itemActions(s, worn)[0]).toMatchObject({ id: 'unequip', disabled: true });
  expect(itemActions(s, general)[1]).toMatchObject({ id: 'toBag', disabled: true });
});
