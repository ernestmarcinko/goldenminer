import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals } from '../../src/core/stats';
import { itemName } from '../../src/core/itemData';
import {
  battleStatLine, cardHead, clickIntent, compareLines, itemKindLine, itemLines, itemSprite, lootNoteText, miningStatLine, anchorCraft, craftAnchor, craftSlots, fittedCardTop, keptHeight, placeCardTop, placeTooltip, rarityOf,
  statText,
} from '../../src/ui/character/itemView';
import { mapDungeon } from '../../src/ui/maps/mapsView';
import type { MapItem } from '../../src/core/items';
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

describe('an action card stays inside the rows that show', () => {
  const view = { top: 100, bottom: 900 };
  const anchor = { top: 500, bottom: 552 };

  it('below its item when it fits there', () => {
    expect(placeCardTop(anchor, 344, view)).toBe(556);              // ends at 900, the view's bottom
    expect(placeCardTop({ top: 120, bottom: 172 }, 700, view)).toBe(176);
  });

  it('above its item when it does not fit below', () => {
    expect(placeCardTop(anchor, 345, view)).toBe(151);              // ends at 496, 4 px above the item
    expect(placeCardTop(anchor, 396, view)).toBe(100);              // starts at the view's top
  });

  it('pinned to the top of the view when it fits neither way, even when it is taller than the view', () => {
    expect(placeCardTop(anchor, 397, view)).toBe(100);
    expect(placeCardTop(anchor, 1024, view)).toBe(100);
    expect(placeCardTop({ top: 848, bottom: 900 }, 1024, { top: -40, bottom: 860 })).toBe(-40);
  });

  it('fits only when it opens on an item, so a craft that changes its height leaves it where it is', () => {
    const fit = { anchor, view };
    expect(fittedCardTop(undefined, fit, 344)).toBe(556);           // opens below its item
    expect(fittedCardTop(fit, fit, 345)).toBeUndefined();           // a craft grew it: it stays, and runs down
    expect(fittedCardTop(fit, fit, 200)).toBeUndefined();           // or shrank it
    const other = { anchor: { top: 500, bottom: 552 }, view };      // the same spot, but opened anew
    expect(fittedCardTop(fit, other, 345)).toBe(151);
    expect(fittedCardTop(fit, undefined, 345)).toBeUndefined();     // a hover or tap card is never fitted
  });

  // a grid of craft buttons, two to a row, 48 px apart, starting 300 px down the card
  const grid = (kinds: string[], top = 300) => ({ top, kinds, tops: kinds.map((_, i) => top + 48 * Math.floor(i / 2)) });

  it('after a craft, keeps the clicked craft button where it was, found again by its kind', () => {
    const was = craftAnchor(grid(['copper', 'tin', 'iron', 'obsidian']), 'iron');
    expect(was).toEqual({ kind: 'iron', slot: 2, top: 348, inGrid: 48 });
    // lines unchanged: the card stays, grown or not
    expect(anchorCraft(224, was, grid(['copper', 'tin', 'iron', 'obsidian'])).top).toBe(224);
    // a modifier line added above the buttons: up by as much, with no limit, even above the rows that show
    expect(anchorCraft(8, was, grid(['copper', 'tin', 'iron', 'obsidian'], 362)).top).toBe(-54);
    // and taken away again
    expect(anchorCraft(-54, { ...was, top: 410 }, grid(['copper', 'tin', 'iron', 'obsidian'])).top).toBe(8);
    // other crafts came and went, and the clicked one moved to another slot: the card follows it
    const moved = anchorCraft(224, was, grid(['silver', 'obsidian', 'starsteel', 'iron', 'mithril']));
    expect(moved).toEqual({ top: 224 + 348 - 348, anchor: { kind: 'iron', slot: 3, top: 348, inGrid: 48 } });
    expect(anchorCraft(224, was, grid(['iron', 'silver'])).top).toBe(224 + 348 - 300);
  });

  it('when the clicked craft is gone, keeps the button now in its slot, or the slot itself, where it was', () => {
    const was = craftAnchor(grid(['copper', 'tin', 'iron']), 'copper');
    expect(anchorCraft(224, was, grid(['tin', 'iron', 'silver'], 433)))
      .toEqual({ top: 91, anchor: { kind: 'tin', slot: 0, top: 433, inGrid: 0 } });
    const last = craftAnchor(grid(['copper', 'tin', 'iron', 'obsidian']), 'obsidian');
    expect(anchorCraft(224, last, grid(['tin', 'iron'], 250)))       // the grid got shorter: its slot is empty
      .toEqual({ top: 224 + 348 - 298, anchor: { kind: 'obsidian', slot: 3, top: 298, inGrid: 48 } });
  });

  it('keeps its craft slots in the order they first showed, and leaves a gone craft\'s slot empty', () => {
    expect(craftSlots([], ['tin', 'iron', 'mithril'])).toEqual(['tin', 'iron', 'mithril']);
    // Iron made it rare: Tin went, Silver came; Iron keeps its slot and Silver goes at the end
    expect(craftSlots(['tin', 'iron', 'mithril'], ['iron', 'silver', 'mithril'])).toEqual(['tin', 'iron', 'mithril', 'silver']);
    const was = craftAnchor(grid(['tin', 'iron', 'mithril']), 'iron');
    // Tin's slot is empty (''), so nothing moves and the card stays
    expect(anchorCraft(224, was, grid(['', 'iron', 'mithril', 'silver'])).top).toBe(224);
    // and a craft that went away is anchored on its empty slot, keeping its kind for when it comes back
    expect(anchorCraft(224, craftAnchor(grid(['tin', 'iron']), 'tin'), grid(['', 'iron'], 262)))
      .toEqual({ top: 262, anchor: { kind: 'tin', slot: 0, top: 262, inGrid: 0 } });
  });

  it('anchors the Soul upgrade, the first slot, by its action id, as it does a craft', () => {
    // the upgrade's button sits above the grid: 52 px tall, then the Craft label
    const card = (kinds: string[], top = 280) => {
      const g = grid(kinds.slice(1), top + 80);
      return { top, kinds, tops: [top, ...g.tops] };
    };
    expect(craftSlots([], ['soulUpgrade', 'copper', 'mithril'])).toEqual(['soulUpgrade', 'copper', 'mithril']);
    const was = craftAnchor(card(['soulUpgrade', 'copper', 'mithril']), 'soulUpgrade');
    expect(was).toEqual({ kind: 'soulUpgrade', slot: 0, top: 280, inGrid: 0 });
    // the sell label above it wrapped onto a second line: the card moves up by as much
    expect(anchorCraft(224, was, card(['soulUpgrade', 'copper', 'mithril'], 298)).top).toBe(206);
    // a temper sealed the item: the upgrade's slot stays, empty, and the grid below it stays put
    expect(craftSlots(['soulUpgrade', 'voidCrystal'], [])).toEqual(['soulUpgrade', 'voidCrystal']);
    const sealed = anchorCraft(224, craftAnchor(card(['soulUpgrade', 'voidCrystal']), 'voidCrystal'), card(['', '']));
    expect(sealed).toEqual({ top: 224, anchor: { kind: 'voidCrystal', slot: 1, top: 360, inGrid: 80 } });
  });

  it('never gets shorter while it is open, so the pointer cannot fall off its bottom', () => {
    expect(keptHeight(0, 545)).toBe(545);                            // opens at its own height
    expect(keptHeight(545, 773)).toBe(773);                          // grows with a craft
    expect(keptHeight(773, 711)).toBe(773);                          // and keeps that height when a craft shrinks it
  });
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
  const map: MapItem = { id: 1, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  const { type } = mapDungeon(77, map);
  expect(cardHead(77, map)).toEqual({ name: type.name, kind: `Tier 4 map · ${type.rooms} rooms` });
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { name: 'Stonebiter', rarity: 'normal', ilvl: 1 });
  expect(cardHead(77, pick)).toEqual({ name: 'Stonebiter', kind: 'Normal pickaxe · item level 1' });
});

it('a map item reads as its tier and where it was found', () => {
  const map: MapItem = { id: 1, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  expect([itemName(map), itemKindLine(map), rarityOf(map), itemSprite(map)]).toEqual(['Tier 4 map', 'Tier 4 map', 'map', 'map']);
  expect(itemLines(map)).toEqual([{ text: 'Found at 327 m', tone: 'plain' }]);
  expect(rarityOf({ id: 2, type: 'material', material: 'tin', count: 3 })).toBe('material');
});

it('an enchanted map card shows its rarity, its modifiers with their tiers and what they pay', () => {
  const map: MapItem = { id: 1, type: 'map', tier: 4, metre: 327, rarity: 'magic', mods: [
    { kind: 'monsterLife', tier: 4, value: 27 },
    { kind: 'monsterDamage', tier: 3, value: 17 },
  ] };
  const { type } = mapDungeon(77, map);
  expect(type.rooms).toBe(6);
  expect(cardHead(77, map)).toEqual({ name: type.name, kind: 'Magic tier 4 map · 6 rooms' });
  expect(itemKindLine({ ...map, rarity: 'rare' })).toBe('Rare tier 4 map');
  expect(rarityOf(map)).toBe('magic');
  expect(rarityOf({ ...map, rarity: 'rare' })).toBe('rare');
  const four: MapItem = { ...map, rarity: 'rare', mods: [...map.mods, { kind: 'monsterSpeed', tier: 4, value: 15 }, { kind: 'weakHealing', tier: 2, value: 16 }] };
  expect(itemLines(four)).toEqual([
    { text: 'T4 Monsters have +27% life', tone: 'plain' },
    { text: 'T3 Monsters deal +17% damage', tone: 'plain' },
    { text: 'T4 Monsters attack 15% faster', tone: 'plain' },
    { text: 'T2 Rooms heal 16% less', tone: 'plain' },
    { text: 'Rewards: +38% items · +23% rarity · +38% Souls', tone: 'plain' },
    { text: 'Found at 327 m', tone: 'plain' },
  ]);
  expect(itemLines({ ...four, sealed: true }).at(-1)).toEqual({ text: "Tempered: it can't be enchanted any more.", tone: 'muted' });
});

it('a material item reads as a crafting material and where it is first found', () => {
  const tin = { id: 2, type: 'material', material: 'tin', count: 3 } as const;
  const iron = { id: 3, type: 'material', material: 'iron', count: 1 } as const;
  expect([itemName(tin), itemKindLine(tin), rarityOf(tin), itemSprite(tin)]).toEqual(['Tin ore', 'Crafting material', 'material', 'tin']);
  expect(itemLines(tin)).toEqual([
    { text: 'Found at every depth', tone: 'plain' },
    { text: 'Kept for crafting.', tone: 'muted' },
    { text: "Drag it onto gear or a map, or pick it under Craft or Enchant in that item's card.", tone: 'muted' },
  ]);
  expect(itemLines(iron)[0]).toEqual({ text: 'First found below 50 m', tone: 'plain' });
  expect(itemSprite({ id: 4, type: 'material', material: 'voidCrystal', count: 1 })).toBe('voidCrystal');
});

it('a material loot note reads as how many and where they went', () => {
  const n = { name: 'Copper ore', rarity: 'material', base: 'copper', value: 1240 } as const;
  expect(lootNoteText({ ...n, outcome: 'bag' })).toBe('×1,240 to bag');
  expect(lootNoteText({ ...n, outcome: 'stash' })).toBe('×1,240 to Materials tab');
});
