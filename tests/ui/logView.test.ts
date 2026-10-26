import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import type { MapItem } from '../../src/core/items';
import type { DeathEntry, DropEntry, TrailStep } from '../../src/core/types';
import { deathRows, dropRows, originText, stepText, trailText } from '../../src/ui/log/logView';
import { mapModLines, runMapLine } from '../../src/ui/run/runView';

const entry = (over: Partial<DropEntry> = {}): DropEntry => ({
  id: 1, kind: 'gear', name: 'Ember Grasp', rarity: 'rare', base: 'gloves', count: 1,
  origin: { kind: 'metre', metre: 412 }, trail: [{ event: 'bag' }], ...over,
});
const steps = (...events: TrailStep[]): TrailStep[] => events;

it('says where a find came from', () => {
  expect(originText({ kind: 'metre', metre: 312 })).toBe('312 m');
  expect(originText({ kind: 'metre', metre: 1204 })).toBe('1,204 m');
  expect(originText({ kind: 'map', tier: 4, room: 3 })).toBe('Tier 4 map, room 3');
  expect(originText({ kind: 'merchant' })).toBe('Merchant');
});

it('words every step', () => {
  const gearEntry = entry();
  const ore = entry({ kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 3 });
  const map = entry({ kind: 'map', name: 'Tier 5 map', rarity: 'normal', base: 'map' });
  expect(stepText(gearEntry, { event: 'bag' })).toBe('to bag');
  expect(stepText(gearEntry, { event: 'held' })).toBe('held (bag full)');
  expect(stepText(gearEntry, { event: 'filterSold', gold: 72 })).toBe('loot filter sold (+72 Gold)');
  expect(stepText(gearEntry, { event: 'filterSalvaged', materials: { copper: 2 } })).toBe('loot filter salvaged (+2 Copper ore)');
  expect(stepText(gearEntry, { event: 'stashed' })).toBe('stashed');
  expect(stepText(ore, { event: 'stashed' })).toBe('to Materials tab');
  expect(stepText(gearEntry, { event: 'filterStashed' })).toBe('loot filter stashed');
  expect(stepText(ore, { event: 'filterStashed' })).toBe('loot filter → Materials tab');
  expect(stepText(gearEntry, { event: 'toBag' })).toBe('moved to bag');
  expect(stepText(gearEntry, { event: 'equipped' })).toBe('equipped');
  expect(stepText(gearEntry, { event: 'sold', gold: 1500 })).toBe('sold (+1,500 Gold)');
  expect(stepText(gearEntry, { event: 'salvaged', materials: { copper: 2, tin: 1 } })).toBe('salvaged (+2 Copper ore, +1 Tin ore)');
  expect(stepText(gearEntry, { event: 'crafted' })).toBe('crafted');
  expect(stepText(map, { event: 'crafted' })).toBe('enchanted');
  expect(stepText(gearEntry, { event: 'upgraded' })).toBe('upgraded with Souls');
  expect(stepText(map, { event: 'run' })).toBe('run');
  expect(stepText(map, { event: 'lost' })).toBe('lost');
});

it('joins a trail with arrows, and a stack leads with its count', () => {
  expect(trailText(entry({ trail: steps({ event: 'bag' }, { event: 'stashed' }, { event: 'sold', gold: 72 }) })))
    .toBe('to bag → stashed → sold (+72 Gold)');
  expect(trailText(entry({ trail: steps({ event: 'held' }, { event: 'bag' }, { event: 'equipped' }) })))
    .toBe('held (bag full) → to bag → equipped');
  expect(trailText(entry({ trail: steps({ event: 'filterSalvaged', materials: { copper: 2 } }) })))
    .toBe('loot filter salvaged (+2 Copper ore)');
  expect(trailText(entry({
    kind: 'map', name: 'Tier 5 map', rarity: 'normal', base: 'map',
    trail: steps({ event: 'bag' }, { event: 'crafted' }, { event: 'run' }, { event: 'lost' }),
  }))).toBe('to bag → enchanted → run → lost');
  expect(trailText(entry({ kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 3 })))
    .toBe('+3 Iron ore → bag');
  expect(trailText(entry({ kind: 'gem', name: 'Small Ruby', rarity: 'gem', base: 'ruby', count: 2, trail: steps({ event: 'held' }) })))
    .toBe('+2 Small Ruby → held (bag full)');
  expect(trailText(entry({ kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 9, trail: steps({ event: 'stashed' }) })))
    .toBe('+9 Iron ore → Materials tab');
  expect(trailText(entry({ trail: steps({ event: 'filterStashed' }, { event: 'toBag' }) }))).toBe('loot filter stashed → moved to bag');
  expect(trailText(entry({ kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 3, trail: steps({ event: 'filterStashed' }) })))
    .toBe('+3 Iron ore → loot filter → Materials tab');
});

it('lists the drops newest first, each with its kind and tone', () => {
  const s = newGame(1, 0);
  s.drops = [
    entry({ id: 1, name: 'Cruel Iron Mace', rarity: 'magic', base: 'weapon', origin: { kind: 'map', tier: 4, room: 3 } }),
    entry({ id: 2, kind: 'map', name: 'Tier 5 map', rarity: 'normal', base: 'map', origin: { kind: 'metre', metre: 408 } }),
    entry({ id: 3, kind: 'material', name: 'Iron ore', rarity: 'material', base: 'iron', count: 3, origin: { kind: 'metre', metre: 405 } }),
    entry({ id: 4, trail: steps({ event: 'bag' }, { event: 'stashed' }) }),
  ];
  s.nextId = 10;
  expect(dropRows(s)).toEqual([
    { id: 4, origin: '412 m', name: 'Ember Grasp', kind: 'rare gloves', tone: 'rare', trail: 'to bag → stashed', stack: false },
    { id: 3, origin: '405 m', name: '+3 Iron ore', kind: '', tone: 'material', trail: '→ bag', stack: true },
    { id: 2, origin: '408 m', name: 'Tier 5 map', kind: '', tone: 'map', trail: 'to bag', stack: false },
    { id: 1, origin: 'Tier 4 map, room 3', name: 'Cruel Iron Mace', kind: 'magic weapon', tone: 'magic', trail: 'to bag', stack: false },
  ]);
});

it('lists the deaths newest first, each with its map, room, killer and loss', () => {
  const s = newGame(1, 0);
  const map: MapItem = { id: 3, type: 'map', tier: 4, metre: 305, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 2, value: 40 }] };
  const death = (over: Partial<DeathEntry>): DeathEntry => ({
    id: 5, tick: 100, at: 1_700_000_000_000, map, room: 3, bossRoom: 6, killer: 'Bog Lurker', ...over,
  });
  s.deaths = [death({ id: 5 }), death({ id: 6, room: 6, killer: 'The Drowned Foreman', at: 1_700_000_100_000 })];
  expect(deathRows(s)).toEqual([
    {
      id: 6, when: new Date(1_700_000_100_000).toLocaleString(), map: runMapLine(s.seed, map), mods: mapModLines(map),
      line: 'Fell in the boss room to The Drowned Foreman.', lost: 'Lost: the map.',
    },
    {
      id: 5, when: new Date(1_700_000_000_000).toLocaleString(), map: runMapLine(s.seed, map), mods: mapModLines(map),
      line: 'Fell in room 3 to Bog Lurker.', lost: 'Lost: the map.',
    },
  ]);
});

it('a map row is no stack: its name says its tier, with no kind beside it, and its trail goes under the name', () => {
  const s = newGame(1, 0);
  s.drops = [entry({
    id: 2, kind: 'map', name: 'Tier 5 map', rarity: 'normal', base: 'map', origin: { kind: 'metre', metre: 408 },
    trail: steps({ event: 'bag' }, { event: 'crafted' }, { event: 'run' }, { event: 'lost' }),
  })];
  s.nextId = 3;
  expect(dropRows(s)).toEqual([
    { id: 2, origin: '408 m', name: 'Tier 5 map', kind: '', tone: 'map', trail: 'to bag → enchanted → run → lost', stack: false },
  ]);
});
