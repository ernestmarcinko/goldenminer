import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals } from '../../src/core/stats';
import { itemName } from '../../src/core/itemData';
import {
  battleStatLine, cardHead, clickIntent, compareLines, itemKindLine, itemLines, itemSprite, lootNoteText, miningStatLine, placeTooltip, rarityOf,
  statText,
} from '../../src/ui/character/itemView';
import { mapDungeon } from '../../src/ui/maps/mapsView';
import { gear, gem } from '../helpers/items';

it('stat text', () => {
  expect(statText('chestFind', 12)).toBe('+12% chest find');
  expect(statText('chestFind', -10)).toBe('−10% chest find');
  expect(statText('lampSight', 4)).toBe('+4 m lamp sight');
  expect(statText('offlineCap', 60)).toBe('+60 min offline cap');
  expect(statText('ticksPerClick', 1)).toBe('+1 tick per click');
  expect(statText('damage', 1234)).toBe('+1,234 damage');
});

it('kind lines', () => {
  const s = newGame(1, 0);
  expect(itemKindLine(gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, sockets: 2, gems: [gem(s)] }))).toBe('Rare pickaxe · item level 4 · 1/2 sockets');
  expect(itemKindLine(gear(s, 'lamp', { rarity: 'normal', ilvl: 1 }))).toBe('Normal lamp helm · item level 1');
  expect(itemKindLine(gem(s, 'ruby', { grade: 'small' }))).toBe('Gem · Small · socket into any gear');
  expect(itemKindLine(gem(s, 'ruby', { grade: 'small', count: 12 }))).toBe('Gem · Small · socket into any gear · 12 in this stack');
  expect(itemKindLine(gem(s, 'ruby', { grade: 'small', count: 1234 }))).toBe('Gem · Small · socket into any gear · 1,234 in this stack');
});

it('item lines list the implicit, affixes, gems and empty sockets', () => {
  const s = newGame(1, 0);
  const item = gear(s, 'pickaxe', {
    implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'chestFind', value: -10 }],
    sockets: 2, gems: [gem(s, 'ruby', { grade: 'small' })],
  });
  expect(itemLines(item)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: 'T1 −10% chest find', tone: 'down' },
    { text: 'Small Ruby: +13% Gold yield', tone: 'gem' },
    { text: '1 empty socket', tone: 'muted' },
  ]);
  expect(itemLines(gem(s, 'ruby', { grade: 'small' }))).toEqual([
    { text: 'In mining gear: +13% Gold yield', tone: 'plain' },
    { text: 'In battle gear: +13% damage', tone: 'plain' },
  ]);
});

it('card lines show each line\'s tier, prefixes first, then suffixes, then crafted lines', () => {
  const s = newGame(1, 0);
  const item = gear(s, 'pickaxe', {
    rarity: 'rare', implicit: { stat: 'digPower', value: 8 },
    affixes: [
      { stat: 'chestFind', value: 9, tier: 2 },
      { stat: 'sellBonus', value: 20, tier: 9, crafted: true },
      { stat: 'goldYield', value: 12, tier: 3 },
    ],
  });
  expect(itemLines(item)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: 'T3 +12% Gold yield', tone: 'plain' },
    { text: 'T2 +9% chest find', tone: 'plain' },
    { text: 'T9 +20% Gold from selling (crafted)', tone: 'plain' },
  ]);
  expect(itemLines(gear(s, 'pickaxe', { affixes: [{ stat: 'digPowerPct', value: 12, tier: 3 }] }))[1]?.text).toBe('T3 +12% dig power');
  expect(itemLines(gear(s, 'gloves', { affixes: [{ stat: 'digPower', value: 12, tier: 3 }] }))[1]?.text).toBe('T3 +12 dig power');
});

it('a legendary line has no tier, and a sealed item says so', () => {
  const s = newGame(1, 0);
  const legend = gear(s, 'pickaxe', { rarity: 'legendary', implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'chestFind', value: -10, tier: 0 }] });
  expect(itemLines(legend)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: '−10% chest find', tone: 'down' },
  ]);
  const sealed = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'goldYield', value: 4, tier: 1 }], sockets: 1, sealed: true });
  expect(itemLines(sealed)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: 'T1 +4% Gold yield', tone: 'plain' },
    { text: '1 empty socket', tone: 'muted' },
    { text: 'Tempered: it can\'t be crafted any more.', tone: 'muted' },
  ]);
});

it('compares against the worn item', () => {
  const s = newGame(1, 0);
  const worn = gear(s, 'pickaxe', { name: 'Stonebiter', implicit: { stat: 'digPower', value: 18 }, affixes: [{ stat: 'diamondYield', value: 6 }] });
  const next = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 26 }, affixes: [{ stat: 'ticksPerClick', value: 1 }, { stat: 'chestFind', value: -10 }] });
  expect(compareLines(next, worn)).toEqual({
    title: 'If equipped, instead of Stonebiter:',
    lines: [
      { text: '+8 dig power', tone: 'up' },
      { text: '+1 tick per click', tone: 'up' },
      { text: '−10% chest find', tone: 'down' },
      { text: '−6% Diamond yield', tone: 'down' },
    ],
  });
  expect(compareLines(next, undefined).title).toBe('If equipped (the slot is empty):');
});

it('summarises each set', () => {
  const s = newGame(1, 0);
  expect(miningStatLine(deriveStats(s), s.deepest)).toBe('Dig 2.4 m/min · chest find 6% · gem find 3% · map find 4% · lamp sight 3 m · offline cap 8h 0m');
  expect(battleStatLine(gearTotals(s, 'battle'))).toBe('Battle gear: nothing equipped yet');
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 }, affixes: [{ stat: 'critChance', value: 5 }] });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 } });
  expect(battleStatLine(gearTotals(s, 'battle'))).toBe('Battle gear: +14 damage · +30 armor · +5% crit chance');
});

it('keeps the tooltip inside the panel', () => {
  expect(placeTooltip({ left: 0, top: 0, width: 52, height: 52 }, 342)).toEqual({ left: 0, top: 56 });
  expect(placeTooltip({ left: 290, top: 116, width: 52, height: 52 }, 342)).toEqual({ left: 72, top: 172 });
});

it('reads what a click means', () => {
  const base = { altKey: false, shiftKey: false, detail: 1, pointerType: 'mouse' };
  expect(clickIntent(base)).toBe('primary');
  expect(clickIntent({ ...base, altKey: true })).toBe('sell');
  expect(clickIntent({ ...base, shiftKey: true })).toBe('move');
  expect(clickIntent({ ...base, detail: 0 })).toBe('menu');
  expect(clickIntent({ ...base, pointerType: 'touch', altKey: true })).toBe('menu');
});

it('loot notes in words', () => {
  const n = { name: 'X', rarity: 'magic', base: 'pickaxe' } as const;
  expect(lootNoteText({ ...n, outcome: 'sold', value: 48 })).toBe('sold +48 Gold');
  expect(lootNoteText({ ...n, outcome: 'salvaged', value: 1 })).toBe('salvaged into 1 material');
  expect(lootNoteText({ ...n, outcome: 'stash', value: 0 })).toBe('to stash');
  expect(lootNoteText({ ...n, outcome: 'held', value: 0 })).toBe('waiting for space');
});

it('a map card is named after its dungeon, with the tier and the rooms on the kind line', () => {
  const map = { id: 1, type: 'map', tier: 4, metre: 327 } as const;
  const { type } = mapDungeon(77, map);
  expect(cardHead(77, map)).toEqual({ name: type.name, kind: `Tier 4 map · ${type.rooms} rooms` });
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { name: 'Stonebiter', rarity: 'normal', ilvl: 1 });
  expect(cardHead(77, pick)).toEqual({ name: 'Stonebiter', kind: 'Normal pickaxe · item level 1' });
});

it('a map item reads as its tier and where it was found', () => {
  const map = { id: 1, type: 'map', tier: 4, metre: 327 } as const;
  expect([itemName(map), itemKindLine(map), rarityOf(map), itemSprite(map)]).toEqual(['Tier 4 map', 'Tier 4 map', 'map', 'map']);
  expect(itemLines(map)).toEqual([{ text: 'Found at 327 m', tone: 'plain' }]);
  expect(rarityOf({ id: 2, type: 'material', material: 'tin', count: 3 })).toBe('material');
});

it('a material item reads as a crafting material and where it is first found', () => {
  const tin = { id: 2, type: 'material', material: 'tin', count: 3 } as const;
  const iron = { id: 3, type: 'material', material: 'iron', count: 1 } as const;
  expect([itemName(tin), itemKindLine(tin), rarityOf(tin), itemSprite(tin)]).toEqual(['Tin ore', 'Crafting material', 'material', 'tin']);
  expect(itemLines(tin)).toEqual([
    { text: 'Found at every depth', tone: 'plain' },
    { text: 'Kept for crafting.', tone: 'muted' },
  ]);
  expect(itemLines(iron)[0]).toEqual({ text: 'First found below 50 m', tone: 'plain' });
  expect(itemSprite({ id: 4, type: 'material', material: 'voidCrystal', count: 1 })).toBe('voidCrystal');
});

it('a material loot note reads as how many and where they went', () => {
  const n = { name: 'Copper ore', rarity: 'material', base: 'copper', value: 1240 } as const;
  expect(lootNoteText({ ...n, outcome: 'bag' })).toBe('×1,240 to bag');
  expect(lootNoteText({ ...n, outcome: 'stash' })).toBe('×1,240 to Materials tab');
});
