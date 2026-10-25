import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals } from '../../src/core/stats';
import { itemName } from '../../src/core/itemData';
import {
  battleStatLine, cardHead, clickIntent, compareLines, itemKindLine, itemLines, itemSprite, lootNoteText, miningStatLine, anchorCraft, craftAnchor, cardMaxHeight, cardScroll, cardWindow, craftSlots, fittedCardTop, keptHeight, placeCardLeft, placeCardTop, rarityOf,
  statText, userScrolled,
} from '../../src/ui/character/itemView';
import { mapDungeon } from '../../src/ui/run/runView';
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
    { text: '−10% chest find', tone: 'down', tier: 1 },
    { text: 'Small Ruby: +13% Gold yield', tone: 'gem' },
    { text: '1 empty socket', tone: 'muted' },
  ]);
  expect(itemLines(gem(s, 'ruby', { grade: 'small' }))).toEqual([
    { text: 'In mining gear: +13% Gold yield', tone: 'plain' },
    { text: 'In battle gear: +13% damage', tone: 'plain' },
  ]);
});

it('tiers sit on the right', () => {
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
    { text: '+12% Gold yield', tone: 'plain', tier: 3 },
    { text: '+9% chest find', tone: 'plain', tier: 2 },
    { text: '+20% Gold from selling (crafted)', tone: 'plain', tier: 9 },
  ]);
  expect(itemLines(item)[0]).not.toHaveProperty('tier');
  expect(itemLines(gear(s, 'pickaxe', { affixes: [{ stat: 'digPowerPct', value: 12, tier: 3 }] }))[1]).toEqual({ text: '+12% dig power', tone: 'plain', tier: 3 });
  expect(itemLines(gear(s, 'gloves', { affixes: [{ stat: 'digPower', value: 12, tier: 3 }] }))[1]).toEqual({ text: '+12 dig power', tone: 'plain', tier: 3 });
});

it('a legendary line has no tier, and a sealed item says so', () => {
  const s = newGame(1, 0);
  const legend = gear(s, 'pickaxe', { rarity: 'legendary', implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'chestFind', value: -10, tier: 0 }] });
  expect(itemLines(legend)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: '−10% chest find', tone: 'down' },
  ]);
  expect(itemLines(legend)[1]).not.toHaveProperty('tier');
  const sealed = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'goldYield', value: 4, tier: 1 }], sockets: 1, sealed: true });
  expect(itemLines(sealed)).toEqual([
    { text: '+8 dig power', tone: 'plain' },
    { text: '+4% Gold yield', tone: 'plain', tier: 1 },
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

it('a card opens below its item, above it when there is more room above, and always inside the screen', () => {
  const view = { top: 8, bottom: 892 };
  expect(placeCardTop({ top: 100, bottom: 152 }, 344, view)).toBe(156);     // below
  expect(placeCardTop({ top: 800, bottom: 852 }, 344, view)).toBe(452);     // above: no room below
  expect(placeCardTop({ top: 400, bottom: 452 }, 900, view)).toBe(8);       // more room below, but taller than the view
  expect(placeCardTop({ top: 860, bottom: 900 }, 300, view)).toBe(556);     // the bag's last cell on a phone
  expect(placeCardTop({ top: 300, bottom: 352 }, 600, view)).toBe(292);     // more room below: there, moved up to fit
  expect(placeCardLeft(1200, 270, 1280)).toBe(1002);                         // kept 8 px inside the right edge
  expect(placeCardLeft(0, 548, 390)).toBe(8);                                // and the left one
  expect(placeCardLeft(100, 270, 1280)).toBe(100);
});

it('an action card taller than the screen scrolls inside, in the room beside its item; one that fits shows whole', () => {
  const view = { top: 8, bottom: 836 };
  expect(cardMaxHeight({ top: 814, bottom: 844 }, view, 930)).toBe(802);  // the bag's last cell on a phone: the room above
  expect(cardMaxHeight({ top: 133, bottom: 164 }, view, 930)).toBe(668);  // the first cell: the room below
  // capped to the room above, it opens above its item, inside the screen
  expect(placeCardTop({ top: 814, bottom: 844 }, 802, view)).toBe(8);
  // a card that fits the screen is never capped: it shows whole, over its item when neither side has the room
  expect(cardMaxHeight({ top: 219, bottom: 259 }, { top: 8, bottom: 892 }, 800)).toBeUndefined();
  expect(cardMaxHeight({ top: 219, bottom: 259 }, { top: 8, bottom: 892 }, 884)).toBeUndefined();
  expect(placeCardTop({ top: 219, bottom: 259 }, 800, { top: 8, bottom: 892 })).toBe(92);
});

it('after a craft, a card that scrolls inside scrolls its content as far as it can, and moves only by the rest', () => {
  // anchorCraft asks for the box to go from 8 to -54 (a line was added above the button)
  expect(cardScroll(8, -54, 0, 0)).toBe(0);         // it can't scroll: the box moves, as before
  expect(cardScroll(8, -54, 0, 200)).toBe(62);      // it scrolls 62 px down instead, and the box stays
  expect(cardScroll(8, -54, 30, 50)).toBe(50);      // as far as it can: the box moves the other 42 px
  // a line went away above the button: the box would go down to 60
  expect(cardScroll(8, 60, 100, 300)).toBe(48);
  expect(cardScroll(8, 60, 10, 300)).toBe(0);
});

it('an open action card shows the part of itself that is on the screen, its content left where it is', () => {
  const view = { top: 8, bottom: 892 };
  // inside the screen: all of it, where it is
  expect(cardWindow(100, 600, { top: 100, bottom: 700 }, view)).toEqual({ top: 100, bottom: 700 });
  // a craft moved it up past the top: it shows from the screen's top and scrolls inside to the rest
  expect(cardWindow(-109, 600, { top: -109, bottom: 491 }, view)).toEqual({ top: 8, bottom: 491 });
  // or down past the bottom
  expect(cardWindow(500, 600, { top: 500, bottom: 1100 }, view)).toEqual({ top: 500, bottom: 892 });
  // a card that scrolls inside (capped at 802 px) whose item scrolled 100 px up with the page: it follows, cut at the top
  expect(cardWindow(-92, 802, { top: -92, bottom: 838 }, { top: 8, bottom: 836 })).toEqual({ top: 8, bottom: 710 });
  // the same card scrolled 100 px inside by the player, where it was: unchanged
  expect(cardWindow(8, 802, { top: -92, bottom: 838 }, { top: 8, bottom: 836 })).toEqual({ top: 8, bottom: 810 });
  // past both edges
  expect(cardWindow(-100, 1200, { top: -100, bottom: 1100 }, view)).toEqual({ top: 8, bottom: 892 });
});

it('a scroll inside an open card that the card did not make is the player re-aiming', () => {
  expect(userScrolled(120, 120, 300)).toBe(false);
  expect(userScrolled(120, 120.4, 300)).toBe(false);   // rounding
  expect(userScrolled(120, 160, 300)).toBe(true);      // scrolled down
  expect(userScrolled(120, 40, 300)).toBe(true);       // scrolled up
  // a craft made the content shorter and the browser pulled the scroll back to its new end: not the player
  expect(userScrolled(120, 90, 90)).toBe(false);
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

it('click intents: click card, keyboard and touch menu, Ctrl or Cmd sells, Alt salvages, Shift moves', () => {
  const base = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, detail: 1, pointerType: 'mouse' };
  expect(clickIntent(base, false)).toBe('card');
  expect(clickIntent(base, true)).toBe('card');
  expect(clickIntent({ ...base, ctrlKey: true }, false)).toBe('sell');
  expect(clickIntent({ ...base, metaKey: true }, false)).toBe('card');
  expect(clickIntent({ ...base, metaKey: true }, true)).toBe('sell');
  expect(clickIntent({ ...base, ctrlKey: true }, true)).toBe('card');     // a Mac's Ctrl+click is its context menu
  for (const mac of [false, true]) {
    expect(clickIntent({ ...base, altKey: true }, mac)).toBe('salvage');
    expect(clickIntent({ ...base, shiftKey: true }, mac)).toBe('move');
    expect(clickIntent({ ...base, detail: 0 }, mac)).toBe('menu');
    expect(clickIntent({ ...base, detail: 0, ctrlKey: true, metaKey: true }, mac)).toBe('menu');
    expect(clickIntent({ ...base, pointerType: 'touch', altKey: true }, mac)).toBe('menu');
    expect(clickIntent({ ...base, pointerType: 'pen' }, mac)).toBe('card');
  }
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
    { text: 'Monsters have +27% life', tone: 'plain', tier: 4 },
    { text: 'Monsters deal +17% damage', tone: 'plain', tier: 3 },
    { text: 'Monsters attack 15% faster', tone: 'plain', tier: 4 },
    { text: 'Rooms heal 16% less', tone: 'plain', tier: 2 },
    { text: 'Rewards: +38% items · +23% rarity · +38% Souls', tone: 'plain' },
    { text: 'Found at 327 m', tone: 'plain' },
  ]);
  expect(itemLines(four)[4]).not.toHaveProperty('tier');
  expect(itemLines({ ...four, sealed: true }).at(-1)).toEqual({ text: "Tempered: it can't be enchanted any more.", tone: 'muted' });
});

it('a map\'s name, the label of its grid cell, leads with its rarity when it is enchanted', () => {
  const map: MapItem = { id: 1, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [] };
  expect(itemName(map)).toBe('Tier 4 map');
  expect(itemName({ ...map, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe('Magic tier 4 map');
  expect(itemName({ ...map, rarity: 'rare', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe('Rare tier 4 map');
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
