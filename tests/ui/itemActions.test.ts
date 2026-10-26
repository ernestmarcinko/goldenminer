import { expect, it } from 'vitest';
import { queueForAutoMap } from '../../src/core/autoMap';
import { newGame } from '../../src/core/newGame';
import type { MapItem } from '../../src/core/items';
import type { ItemLoc } from '../../src/core/types';
import { startMap } from '../../src/core/maps';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import {
  actionForIntent, hoverLines, hoverNotes, itemActions, materialsText, menuNote, noShortcutText, refusedMap, resultText,
  runAction, soulUpgradeResultText,
} from '../../src/ui/character/itemActions';
import { gear, gem, stashMap } from '../helpers/items';
import { lootNoteText } from '../../src/ui/character/itemView';
import { sellPay } from '../../src/core/loot';
import { deriveStats } from '../../src/core/stats';
import { buyStock, stockAt, stockPrice, type StockItem } from '../../src/core/trader';
import { formatNumber } from '../../src/ui/format';
import { MAP_TIER_CAP, MATERIAL_STASH_STACK, MAX_ITEM_LEVEL } from '../../src/core/balance';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });
const labels = (specs: ReturnType<typeof itemActions>) => specs.map((a) => [a.id, a.label]);
/** The actions besides crafts, which have tests of their own. */
const noCrafts = (specs: ReturnType<typeof itemActions>) =>
  specs.filter((a) => a.id !== 'craft' && a.id !== 'targetedCraft');

it('bag gear offers equip, sell, salvage and stash', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bag[0] = pick;
  expect(noCrafts(itemActions(s, bag(0)))).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'sell', label: 'Sell (+48 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Copper ore, +1 Tin ore)', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
});

it('a hover card shows what an item sells and salvages for, and the shortcuts', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  s.bag[0] = pick;
  expect(hoverNotes(s, bag(0), pick, false)).toEqual([
    'Sells for 48 Gold · Salvages into 2 Copper ore, 1 Tin ore',
    'Click to pick up · Ctrl+click sell · Alt+click salvage · Shift+click move',
  ]);
  expect(hoverNotes(s, bag(0), pick, true)[1]).toBe('Click to pick up · ⌘+click sell · Alt+click salvage · Shift+click move');
  // a normal tier-4 map: 25 × 4² Gold; Copper ore, and Tin ore from tier 3
  const map: MapItem = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.bag[1] = map;
  expect(hoverNotes(s, bag(1), map, false)[0]).toBe('Sells for 400 Gold · Salvages into 2 Copper ore, 1 Tin ore');
  s.stash.maps[4] = [{ ...map, id: s.nextId++ }];
  const tab: ItemLoc = { where: 'maps', tier: 4, index: 0 };
  expect(hoverNotes(s, tab, map, false)[1]).toBe('Click to pick up · Ctrl+click sell · Alt+click salvage · Shift+click move');
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 2 });
  const general: ItemLoc = { where: 'stash', index: 0 };
  expect(hoverNotes(s, general, s.stash.general[0], false)).toEqual([
    'Sells for 10 Gold · Salvages into 1 Copper ore',
    'Click to pick up · Ctrl+click sell · Alt+click salvage · Shift+click move',
  ]);
  // a material has no values, and its own shortcut line
  const copper = { id: s.nextId++, type: 'material', material: 'copper', count: 3 } as const;
  s.bag[2] = copper;
  expect(hoverNotes(s, bag(2), copper, false)).toEqual(['Click to pick up · Shift+click move · right-click for actions']);
  s.stash.materials.tin = 4;
  const mats: ItemLoc = { where: 'materials', material: 'tin' };
  expect(hoverNotes(s, mats, { ...copper, material: 'tin', count: 4 }, false))
    .toEqual(['Click to pick up · Shift+click take to bag · right-click for actions']);
  // worn gear stashes; a Gems-tab stack shows the whole stack's values
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  expect(hoverNotes(s, worn, s.equipped.mining.pickaxe, false)).toEqual([
    'Sells for 48 Gold · Salvages into 2 Copper ore, 1 Tin ore',
    'Click to pick up · Shift+click stash · right-click for actions',
  ]);
  s.stash.gems.sapphire.big = 100;
  const gems: ItemLoc = { where: 'gems', gem: 'sapphire', grade: 'big' };
  expect(hoverNotes(s, gems, gem(s, 'sapphire', { grade: 'big', count: 100 }), false)).toEqual([
    'Sells for 16,000 Gold · Salvages into 200 Tin ore',
    'Click to pick up · Shift+click take to bag · right-click for actions',
  ]);
  expect(materialsText({ tin: 1, copper: 2 })).toBe('2 Copper ore, 1 Tin ore');
  expect(materialsText({ copper: 1_234, iron: 0 })).toBe('1,234 Copper ore');
});

it('a gem\'s action card lists no sockets and says to drag it', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { name: 'Stonebiter', sockets: 1 });
  s.equipped.battle.helm = gear(s, 'helm', { name: 'Grim Visor', sockets: 2, gems: [gem(s), gem(s)] });
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  s.bag[3] = gear(s, 'amulet', { name: 'Tin Charm', sockets: 1 });
  s.stash.general[8] = gear(s, 'boots', { name: 'Old Boots', sockets: 2 });
  s.bag[0] = gem(s, 'ruby', { count: 3 });
  const specs = itemActions(s, bag(0));
  expect(labels(specs)).toEqual([
    ['sell', 'Sell (+120 Gold)'],
    ['salvage', 'Salvage (+3 Tin ore)'],
    ['toStash', 'To Gems tab'],
  ]);
  expect(specs.map((a) => a.id)).not.toContain('socket');
  expect(menuNote(gem(s))).toBe('Drag it onto an item with a free socket to socket it.');
  expect(menuNote(gear(s, 'ring'))).toBeNull();
  expect(menuNote({ id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] })).toBeNull();
});

it('General gear offers equip, to bag, sell and salvage', () => {
  const s = newGame(1, 0);
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 2 });
  const t: ItemLoc = { where: 'stash', index: 0 };
  expect(noCrafts(itemActions(s, t))).toEqual([
    { id: 'equip', label: 'Equip', disabled: false },
    { id: 'toBag', label: 'To bag', disabled: false },
    { id: 'sell', label: 'Sell (+10 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+1 Copper ore)', disabled: false },
  ]);
  s.bag = s.bag.map((c) => c ?? gem(s));
  expect(itemActions(s, t).find((a) => a.id === 'toBag')?.disabled).toBe(true);
  expect(actionForIntent(itemActions(s, t), t, 'move')).toMatchObject({ id: 'toBag' });
});

it('a Gems-tab stack takes, and sells or salvages all of it', () => {
  const s = newGame(1, 0);
  s.stash.gems.sapphire.big = 100;
  s.equipped.battle.ring = gear(s, 'ring', { name: 'Brass Loop', sockets: 1 });
  const t: ItemLoc = { where: 'gems', gem: 'sapphire', grade: 'big' };
  const specs = itemActions(s, t);
  expect(labels(specs)).toEqual([
    ['take', 'Take to bag (up to 25)'],
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
  expect(noCrafts(itemActions(s, t))).toEqual([
    { id: 'unequip', label: 'Unequip', disabled: false },
    { id: 'toStash', label: 'To stash', disabled: false },
  ]);
  s.stash.general = s.stash.general.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, t)[1]).toMatchObject({ id: 'toStash', disabled: true });
});

it('a sell or salvage shortcut with no action says why; a move with none, or an item that has one, says nothing', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'copper', count: 3 };
  s.bag[1] = gear(s, 'gloves');
  s.stash.materials.tin = 4;
  const worn: ItemLoc = { where: 'worn', slot: 'pickaxe' };
  const mats: ItemLoc = { where: 'materials', material: 'tin' };
  for (const intent of ['sell', 'salvage'] as const) {
    expect(actionForIntent(itemActions(s, worn), worn, intent)).toBeUndefined();
    expect(noShortcutText(s, worn, intent)).toBe('Unequip it first to sell or salvage it.');
    for (const t of [bag(0), mats]) {
      expect(actionForIntent(itemActions(s, t), t, intent)).toBeUndefined();
      expect(noShortcutText(s, t, intent)).toBe('Materials can\'t be sold or salvaged.');
    }
    expect(noShortcutText(s, bag(1), intent)).toBeNull();
  }
  expect(noShortcutText(s, worn, 'move')).toBeNull();
  expect(noShortcutText(s, bag(0), 'card')).toBeNull();
});

it('actionForIntent routes the shortcuts', () => {
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
  s.stash.materials.tin = 4;
  const mats: ItemLoc = { where: 'materials', material: 'tin' };
  for (const t of [bag(0), bag(1), general, gems, worn, mats]) {
    expect(act(t, 'card')).toBe('card');
    expect(act(t, 'menu')).toBe('menu');
  }
  expect(act(bag(0), 'sell')).toMatchObject({ id: 'sell' });
  expect(act(bag(0), 'salvage')).toMatchObject({ id: 'salvage' });
  expect(act(bag(0), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(bag(1), 'sell')).toMatchObject({ id: 'sell' });
  expect(act(bag(1), 'move')).toMatchObject({ id: 'toStash', label: 'To Gems tab' });
  expect(act(general, 'salvage')).toMatchObject({ id: 'salvage' });
  expect(act(general, 'move')).toMatchObject({ id: 'toBag' });
  // a Gems-tab stack can be huge, so selling or salvaging it goes through its card
  expect(act(gems, 'sell')).toBe('menu');
  expect(act(gems, 'salvage')).toBe('menu');
  expect(act(gems, 'move')).toMatchObject({ id: 'take' });
  expect(act(worn, 'move')).toMatchObject({ id: 'toStash' });
  expect(act(worn, 'sell')).toBeUndefined();
  expect(act(mats, 'move')).toMatchObject({ id: 'take' });
  expect(act(mats, 'sell')).toBeUndefined();
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
  const map: MapItem = { id: 1, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  expect(resultText('mapTierFull', map)).toBe('The tier 4 maps are full.');
  expect(() => resultText('mapTierFull')).toThrow();   // never a guess at which tier
});

it('a full tier is named by the map it refused: the moved map, or the bag map a Maps-tab map swaps with', () => {
  const s = newGame(1, 0);
  const carried: MapItem = { id: s.nextId++, type: 'map', tier: 5, metre: 327, rarity: 'normal', mods: [] };
  const stashed: MapItem = { id: s.nextId++, type: 'map', tier: 3, metre: 214, rarity: 'normal', mods: [] };
  s.bag[0] = carried;
  s.bag[1] = gear(s, 'ring');
  s.stash.maps[3] = [stashed];
  const tab: ItemLoc = { where: 'maps', tier: 3, index: 0 };
  expect(refusedMap(s, bag(0))).toBe(carried);                                          // the card's To Maps tab
  expect(refusedMap(s, bag(0), { where: 'stashTab', tab: 'maps' })).toBe(carried);
  expect(refusedMap(s, bag(0), tab)).toBe(carried);                                     // a bag map onto the Maps tab
  expect(refusedMap(s, tab, bag(0))).toBe(carried);                                     // a swap: the bag map's tier
  expect(refusedMap(s, tab, bag(5))).toBe(stashed);                                     // out to an empty cell
  expect(refusedMap(s, bag(1), tab)).toBeUndefined();                                   // not a map
  expect(refusedMap(s, bag(9))).toBeUndefined();
});

it('a bag map runs or goes to the Maps tab; a Maps-tab map runs or comes back to the bag', () => {
  const s = newGame(1, 0);
  const carried: MapItem = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.bag[0] = carried;
  s.stash.maps[1] = [{ id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] }];
  const tab: ItemLoc = { where: 'maps', tier: 1, index: 0 };
  expect(noCrafts(itemActions(s, bag(0)))).toEqual([
    { id: 'run', label: 'Run this map', disabled: false },
    { id: 'toStash', label: 'To Maps tab', disabled: false },
    { id: 'sell', label: 'Sell (+400 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Copper ore, +1 Tin ore)', disabled: false },
  ]);
  expect(noCrafts(itemActions(s, tab))).toEqual([
    { id: 'run', label: 'Run this map', disabled: false },
    { id: 'toBag', label: 'To bag', disabled: false },
    { id: 'sell', label: 'Sell (+25 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Copper ore)', disabled: false },
  ]);
  const act = (t: ItemLoc, intent: Parameters<typeof actionForIntent>[2]) => actionForIntent(itemActions(s, t), t, intent);
  expect(act(bag(0), 'card')).toBe('card');
  expect(act(tab, 'card')).toBe('card');
  expect(act(bag(0), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(tab, 'move')).toMatchObject({ id: 'toBag' });
  expect(act(tab, 'sell')).toMatchObject({ id: 'sell' });
  expect(act(bag(0), 'salvage')).toMatchObject({ id: 'salvage' });
});

it('a map cannot run while another run is going, and moves need room', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.stash.maps[1] = [{ id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] }];
  startMap(s, stashMap(s, 1, 2).id);
  const tab: ItemLoc = { where: 'maps', tier: 1, index: 0 };
  expect(itemActions(s, bag(0))[0]).toMatchObject({ id: 'run', disabled: true });
  expect(itemActions(s, tab)[0]).toMatchObject({ id: 'run', disabled: true });
  // the bag map is tier 4: a full tier 1 leaves its move open, a full tier 4 shuts it
  s.stash.maps[1] = Array.from({ length: MAP_TIER_CAP }, () => ({ id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] }));
  expect(itemActions(s, bag(0))[1]).toMatchObject({ id: 'toStash', disabled: false });
  s.stash.maps[4] = Array.from({ length: MAP_TIER_CAP }, () => ({ id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] }));
  expect(itemActions(s, bag(0))[1]).toMatchObject({ id: 'toStash', disabled: true });
  s.bag = s.bag.map((c) => c ?? gear(s, 'ring'));
  expect(itemActions(s, tab)[1]).toMatchObject({ id: 'toBag', disabled: true });
});

it('a map card offers Auto-map once Surveyor is allocated, and Remove from auto-map while it is queued', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  const map: MapItem = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] };
  s.bag[0] = map;
  const t = bag(0);
  const ids = () => itemActions(s, t).map((a) => a.id);

  // without the notable, a map card has neither queue action
  expect(ids()).not.toContain('autoMap');
  expect(ids()).not.toContain('unqueueAutoMap');

  s.passives.allocated = ['surveyor'];
  expect(ids()).not.toContain('unqueueAutoMap');
  expect(ids().indexOf('autoMap')).toBe(ids().indexOf('run') + 1);
  const auto = itemActions(s, t).find((a) => a.id === 'autoMap');
  if (auto === undefined) throw new Error('no auto-map action');
  expect(auto.label).toBe('Auto-map');

  // queueing turns the same action into its removal
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  expect(s.autoMap.queue).toEqual([map.id]);
  expect(ids()).not.toContain('autoMap');
  const unqueue = itemActions(s, t).find((a) => a.id === 'unqueueAutoMap');
  expect(unqueue?.label).toBe('Remove from auto-map');

  // both run through the store
  if (unqueue === undefined) throw new Error('no unqueue action');
  expect(runAction(store, t, unqueue)).toBe('ok');
  expect(s.autoMap.queue).toEqual([]);
  const again = itemActions(s, t).find((a) => a.id === 'autoMap');
  if (again === undefined) throw new Error('no auto-map action');
  expect(runAction(store, t, again)).toBe('ok');
  expect(s.autoMap.queue).toEqual([map.id]);
});

it('Run this map starts that map', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  const map: MapItem = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] };
  s.stash.maps[1] = [map];
  const t: ItemLoc = { where: 'maps', tier: 1, index: 0 };
  const run = itemActions(s, t).find((a) => a.id === 'run');
  if (run === undefined) throw new Error('no run action');
  expect(runAction(store, t, run)).toBe('ok');
  expect(store.state.activity.kind).toBe('map');
  expect(store.state.activity.kind === 'map' && store.state.activity.run.map.id).toBe(map.id);
  expect(s.stash.maps).toEqual({});
});

it('Run this map during a run is refused as busy', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] };
  store.startMap(stashMap(s, 1, 2).id);
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
  expect(act(bag(1), 'card')).toBe('card');
  expect(act(bag(1), 'move')).toMatchObject({ id: 'toStash' });
  expect(act(bag(1), 'sell')).toBeUndefined();
  expect(act(tab, 'card')).toBe('card');
  expect(act(tab, 'move')).toMatchObject({ id: 'take' });
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

it('the sell and salvage labels show what sell bonus and salvage yield will pay', () => {
  const s = newGame(1, 0);
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'sellBonus', value: 50 }, { stat: 'salvageYield', value: 100 }] });
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 });
  expect(labels(noCrafts(itemActions(s, bag(0))))).toEqual([
    ['equip', 'Equip'], ['sell', 'Sell (+72 Gold)'], ['salvage', 'Salvage (+4 Copper ore, +2 Tin ore)'], ['toStash', 'To stash'],
  ]);
});

it('a card for gear lists one craft action per option after its other actions', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
  s.bag[1] = { id: s.nextId++, type: 'material', material: 'copper', count: 37 };
  s.equipped.mining.lamp = gear(s, 'lamp', { rarity: 'normal', ilvl: 4 });
  s.stash.general[0] = gear(s, 'boots', { rarity: 'normal', ilvl: 4 });
  const crafts = [
    { id: 'craft', kind: 'copper', label: 'Copper ore ×3: make it magic', disabled: false },
    { id: 'craft', kind: 'mithril', label: 'Mithril ×2: reroll its sockets', disabled: true },
  ];
  expect(itemActions(s, bag(0)).slice(4)).toEqual(crafts);
  expect(itemActions(s, bag(0)).slice(0, 4).map((a) => a.id)).toEqual(['equip', 'sell', 'salvage', 'toStash']);
  expect(itemActions(s, { where: 'worn', slot: 'lamp' }).slice(2)).toEqual(crafts);
  expect(itemActions(s, { where: 'stash', index: 0 }).slice(4)).toEqual(crafts);
  expect(itemActions(s, bag(1)).some((a) => a.id === 'craft')).toBe(false);
});

it('a craft action crafts through the store', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
  s.stash.materials.copper = 5;
  const copper = itemActions(s, bag(0)).find((a) => a.id === 'craft' && a.kind === 'copper');
  if (copper === undefined) throw new Error('no copper craft');
  expect(runAction(store, bag(0), copper)).toBe('ok');
  expect(s.bag[0]).toMatchObject({ rarity: 'magic' });
  expect(s.stash.materials.copper).toBe(2);
  expect(store.lastCraft).toMatchObject({ kind: 'copper', check: 'ok' });
});

it('a map card lists Run this map, the move, Sell and Salvage, then its enchants', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.stash.maps[4] = [{
    id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 2, value: 15 }],
  }];
  s.stash.materials.copper = 37;
  s.stash.materials.iron = 37;
  s.souls = 50;
  expect(itemActions(s, bag(0))).toEqual([
    { id: 'run', label: 'Run this map', disabled: false },
    { id: 'toStash', label: 'To Maps tab', disabled: false },
    { id: 'sell', label: 'Sell (+400 Gold)', disabled: false },
    { id: 'salvage', label: 'Salvage (+2 Copper ore, +1 Tin ore)', disabled: false },
    { id: 'craft', kind: 'copper', label: 'Copper ore ×3 + 20 Souls: enchant it', disabled: false },
  ]);
  const tab = itemActions(s, { where: 'maps', tier: 4, index: 0 });
  expect(labels(tab.slice(0, 4))).toEqual([
    ['run', 'Run this map'], ['toBag', 'To bag'], ['sell', 'Sell (+600 Gold)'], ['salvage', 'Salvage (+2 Copper ore, +1 Tin ore)'],
  ]);
  expect(tab.slice(4).map((a) => [a.id, a.kind, a.disabled])).toEqual([
    ['craft', 'obsidian', true], ['craft', 'voidCrystal', true],
  ]);
  s.souls = 19;
  expect(itemActions(s, bag(0))[4]).toMatchObject({ kind: 'copper', disabled: true });
});

it('an enchant action enchants a map through the store, and spends its Souls', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.stash.maps[4] = [{ id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] }];
  s.stash.materials.copper = 5;
  s.souls = 50;
  const t: ItemLoc = { where: 'maps', tier: 4, index: 0 };
  const copper = itemActions(s, t).find((a) => a.id === 'craft' && a.kind === 'copper');
  if (copper === undefined) throw new Error('no copper enchant');
  expect(runAction(store, t, copper)).toBe('ok');
  expect(s.stash.maps[4]?.[0]).toMatchObject({ rarity: 'magic' });
  expect(s.stash.materials.copper).toBe(2);
  expect(s.souls).toBe(30);
});

it("a map's hover card says once what enchanting does; other items add nothing", () => {
  const s = newGame(1, 0);
  const note = {
    text: 'Enchanting never changes the dungeon itself; it scales the monsters and the rewards. Dying still loses the map.',
    tone: 'muted',
  };
  expect(hoverLines({ id: 1, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] })).toEqual([note]);
  expect(hoverLines({ id: 2, type: 'map', tier: 4, metre: 327, rarity: 'rare', mods: [], sealed: true })).toEqual([note]);
  expect(hoverLines(gear(s, 'pickaxe'))).toEqual([]);
  expect(hoverLines(gem(s))).toEqual([]);
});

it('battle gear offers a Soul upgrade after its other actions and before its crafts, in the bag, the General tab and worn', () => {
  const s = newGame(1, 0);
  s.souls = 180;
  s.bag[0] = gear(s, 'ring', { rarity: 'normal', ilvl: 6 });
  s.stash.general[0] = gear(s, 'helm', { rarity: 'normal', ilvl: 6 });
  s.equipped.battle.weapon = gear(s, 'weapon', { rarity: 'normal', ilvl: 6 });
  const upgrade = { id: 'soulUpgrade', label: 'Upgrade with Souls: item level 6 → 7 · 180 Souls', disabled: false };
  const ids = (t: ItemLoc) => itemActions(s, t).map((a) => a.id);
  expect(itemActions(s, bag(0))[4]).toEqual(upgrade);
  expect(ids(bag(0))).toEqual(['equip', 'sell', 'salvage', 'toStash', 'soulUpgrade', 'craft', 'craft']);
  expect(itemActions(s, { where: 'stash', index: 0 })[4]).toEqual(upgrade);
  expect(ids({ where: 'stash', index: 0 })).toEqual(['equip', 'toBag', 'sell', 'salvage', 'soulUpgrade', 'craft', 'craft']);
  expect(itemActions(s, { where: 'worn', slot: 'weapon' })[2]).toEqual(upgrade);
  expect(ids({ where: 'worn', slot: 'weapon' })).toEqual(['unequip', 'toStash', 'soulUpgrade', 'craft', 'craft']);
  s.souls = 179;
  expect(itemActions(s, bag(0))[4]).toEqual({ ...upgrade, disabled: true });
  s.souls = 1_000_000;
  (s.bag[0] as { ilvl: number }).ilvl = 7;
  expect(itemActions(s, bag(0))[4]).toMatchObject({ label: 'Upgrade with Souls: item level 7 → 8 · 245 Souls', disabled: false });
  (s.bag[0] as { ilvl: number }).ilvl = 1_234;
  expect(itemActions(s, bag(0))[4]).toMatchObject({ label: 'Upgrade with Souls: item level 1,234 → 1,235 · 7,613,780 Souls', disabled: true });
});

it('a legendary takes a Soul upgrade; sealed gear, mining gear and other items offer none', () => {
  const s = newGame(1, 0);
  s.souls = 1_000;
  s.bag[0] = gear(s, 'amulet', { rarity: 'legendary', ilvl: 6, affixes: [{ stat: 'life', value: 20, tier: 0 }] });
  s.bag[1] = gear(s, 'armor', { rarity: 'rare', ilvl: 6, sealed: true });
  s.bag[2] = gear(s, 'pickaxe', { ilvl: 6 });
  s.bag[3] = gem(s);
  s.bag[4] = { id: s.nextId++, type: 'material', material: 'copper', count: 5 };
  s.bag[5] = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.equipped.mining.boots = gear(s, 'boots', { ilvl: 6 });
  const has = (t: ItemLoc) => itemActions(s, t).some((a) => a.id === 'soulUpgrade');
  expect(has(bag(0))).toBe(true);
  for (const i of [1, 2, 3, 4, 5]) expect(has(bag(i)), `bag ${i}`).toBe(false);
  expect(has({ where: 'worn', slot: 'boots' })).toBe(false);
});

it('at the highest item level the Soul upgrade stays on the card, disabled', () => {
  const s = newGame(1, 0);
  s.souls = Number.MAX_SAFE_INTEGER;
  s.bag[0] = gear(s, 'ring', { ilvl: MAX_ITEM_LEVEL });
  expect(itemActions(s, bag(0)).find((a) => a.id === 'soulUpgrade')).toEqual({
    id: 'soulUpgrade', label: 'Upgrade with Souls: item level 100,000 is the highest', disabled: true,
  });
});

it('a Soul upgrade action upgrades through the store, and says why it was refused', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.bag[0] = gear(s, 'ring', { ilvl: 6 });
  s.souls = 200;
  const upgrade = itemActions(s, bag(0)).find((a) => a.id === 'soulUpgrade');
  if (upgrade === undefined) throw new Error('no Soul upgrade');
  expect(runAction(store, bag(0), upgrade)).toBe('ok');
  expect(s.bag[0]).toMatchObject({ ilvl: 7 });
  expect(s.souls).toBe(20);
  expect(runAction(store, bag(0), upgrade)).toBe('craftRefused');
  expect(s.bag[0]).toMatchObject({ ilvl: 7 });
  expect(soulUpgradeResultText('ok')).toBeNull();
  expect(soulUpgradeResultText('noSouls')).toBe('Not enough Souls.');
  expect(soulUpgradeResultText('maxLevel')).toBe("It can't go any higher.");
  for (const r of ['notBattle', 'sealed', 'invalid'] as const) expect(soulUpgradeResultText(r)).toEqual(expect.any(String));
});

it("a map's Sell and Salvage run through the store, and a held note of any kind waits for space", () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.bag[0] = { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  s.stash.maps[3] = [{ id: s.nextId++, type: 'map', tier: 3, metre: 200, rarity: 'normal', mods: [] }];
  const sell = itemActions(s, bag(0)).find((a) => a.id === 'sell');
  const t: ItemLoc = { where: 'maps', tier: 3, index: 0 };
  const salvage = itemActions(s, t).find((a) => a.id === 'salvage');
  if (sell === undefined || salvage === undefined) throw new Error('no sell or salvage action');
  const gold = s.gold;
  expect(runAction(store, bag(0), sell)).toBe('ok');
  expect(runAction(store, t, salvage)).toBe('ok');
  expect([store.state.gold - gold, store.state.bag[0], store.state.stash.maps]).toEqual([400, null, {}]);
  expect([store.state.stash.materials.copper, store.state.stash.materials.tin]).toEqual([2, 1]);
  for (const n of [
    { name: 'Tier 4 map', rarity: 'normal', base: 'map', outcome: 'held', value: 0 },
    { name: 'Copper ore', rarity: 'material', base: 'copper', outcome: 'held', value: 30 },
    { name: 'Test ring', rarity: 'magic', base: 'ring', outcome: 'held', value: 0 },
  ] as const) expect(lootNoteText(n)).toBe('waiting for space');
});

it("a stock item's card has one action, Buy, disabled when sold, short of Gold or with a full bag", () => {
  const s = newGame(11, 0);
  s.deepest = 419;
  s.ahead = {};
  const t: ItemLoc = { where: 'stock', index: 4 };
  const item = stockAt(s, 4) as StockItem;
  const price = stockPrice(item);
  const label = `Buy · ${formatNumber(price)} Gold`;
  s.gold = price;
  expect(itemActions(s, t)).toEqual([{ id: 'buy', label, disabled: false }]);
  s.gold = price - 1;
  expect(itemActions(s, t)).toEqual([{ id: 'buy', label, disabled: true }]);
  s.gold = price;
  const bag = structuredClone(s.bag);
  for (let i = 0; i < s.bag.length; i++) s.bag[i] = gear(s, 'boots');
  expect(itemActions(s, t)).toEqual([{ id: 'buy', label, disabled: true }]);
  s.bag = bag;
  expect(buyStock(s, 4).result).toBe('ok');
  s.gold = 10 * price;
  expect(itemActions(s, t)).toEqual([{ id: 'buy', label, disabled: true }]);
  expect(itemActions(s, { where: 'stock', index: 12 })).toEqual([]);
});

it('a stock item takes no shortcut, and its hover card says what it costs and sells for', () => {
  const s = newGame(11, 0);
  s.deepest = 419;
  s.ahead = {};
  const t: ItemLoc = { where: 'stock', index: 4 };
  const item = stockAt(s, 4) as StockItem;
  const actions = itemActions(s, t);
  for (const intent of ['sell', 'salvage', 'move'] as const) {
    expect(actionForIntent(actions, t, intent)).toBeUndefined();
    expect(noShortcutText(s, t, intent)).toBeNull();
  }
  expect(actionForIntent(actions, t, 'menu')).toBe('menu');
  expect(hoverNotes(s, t, item, false)).toEqual([
    `Costs ${formatNumber(stockPrice(item))} Gold · Sells for ${formatNumber(sellPay(item, deriveStats(s)))} Gold`,
    'Click for its card · right-click to buy',
  ]);
});

it('Buy runs through the store', () => {
  const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
  store.load();
  const s = store.state;
  s.deepest = 419;
  s.ahead = {};
  const t: ItemLoc = { where: 'stock', index: 0 };
  s.gold = stockPrice(stockAt(s, 0) as StockItem);
  const [buy] = itemActions(s, t);
  if (buy === undefined) throw new Error('no buy action');
  expect(runAction(store, t, buy)).toBe('ok');
  expect(store.state.gold).toBe(0);
  expect(runAction(store, t, buy)).toBe('invalid');
  expect(runAction(store, { where: 'stock', index: 1 }, buy)).toBe('invalid');   // no Gold left

  // anything but Buy on a stock item is refused, even an action the card never offers
  const before = structuredClone(store.state);
  for (const id of ['run', 'sell', 'salvage', 'equip', 'toStash', 'toBag'] as const) {
    expect(runAction(store, { where: 'stock', index: 2 }, { id, label: id, disabled: false })).toBe('invalid');
  }
  expect(store.state).toEqual(before);
});
