import { afterEach, describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BOOST, ACHIEVEMENT_BY_ID, ACHIEVEMENT_IDS, FAMILY_ICONS, FAMILY_LABELS,
  achievementBoost, achievementIcon, checkAchievements, checkFeats, earnedCount, pruneEarned, registerFeatsForTest,
  type FeatDef, type FeatEvent,
} from '../../src/core/achievements';
import { ASCEND_LEVEL, MAX_DAMAGE, MAX_LIFE } from '../../src/core/balance';
import { ascend } from '../../src/core/ascend';
import { clickTicks } from '../../src/core/clock';
import { endRun, onKill } from '../../src/core/combat';
import { salvage, sell } from '../../src/core/inventory';
import { LEGENDARIES } from '../../src/core/itemData';
import { startMap } from '../../src/core/maps';
import { CHAMPION_MODS, type GameState, type MapRun, type MonsterState } from '../../src/core/types';
import { deriveBattleStats } from '../../src/core/battle';
import { collect, faceTicksPerMetre, finishMetre } from '../../src/core/dig';
import { addToSet } from '../../src/core/ledger';
import { GEM_GRADES, GEM_TYPES, MAP_SPECIALS, MATERIALS, RUNE_TYPES } from '../../src/core/items';
import { gamble } from '../../src/core/merchant';
import { receiveItem } from '../../src/core/loot';
import type { GearItem } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { ICON_GLYPHS } from '../../src/core/skillIcons';
import { deriveStats } from '../../src/core/stats';
import { emptyLifetimeStats } from '../../src/core/telemetry';
import { gear, stashMap } from '../helpers/items';

describe('the achievement table', () => {
  it('holds a well-spaced set of unique achievements across every family', () => {
    expect(ACHIEVEMENTS.length).toBe(609);   // 529 ladders and 80 collection steps
    expect(ACHIEVEMENT_IDS.size).toBe(609);
    const families = new Set(ACHIEVEMENTS.map((a) => a.family));
    expect(families).toEqual(new Set([
      'depth', 'dig', 'clicks', 'handMined', 'autoMined', 'gold', 'goldSpent', 'diamonds', 'diamondsSpent', 'soulsEarned', 'soulsSpent',
      'gems', 'chests', 'maps', 'mapsFound', 'mapsLost', 'kills', 'champions', 'bosses', 'deaths',
      'levels', 'levelsGained', 'ascensions', 'craft', 'merchant', 'itemsKept', 'itemsSold', 'itemsSalvaged',
      'oresTraded', 'legendaries', 'sockets', 'timePlayed', 'timeAway',
      ...MATERIALS.map((m) => `ore.${m}`),
      'collection.legendaries', 'collection.legendaryTier1', 'collection.legendaryTier2', 'collection.legendaryTier3',
      'collection.legendaryTier4', 'collection.legendaryTier5', 'collection.runes', 'collection.championMods',
      'collection.specials', 'collection.gems', 'collection.dungeons',
    ]));
    expect(Object.keys(FAMILY_LABELS).sort()).toEqual([...families].sort());
  });

  it('ids are `<family>.<value>`, each threshold positive with a unique name and a description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBe(`${a.family}.${a.value}`);
      expect(a.value).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('the by-id and family-icon lookups', () => {
  it('ACHIEVEMENT_BY_ID has one entry per achievement and resolves every id', () => {
    expect(ACHIEVEMENT_BY_ID.size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_BY_ID.get(a.id)).toBe(a);
    }
    for (const id of ACHIEVEMENT_IDS) {
      expect(ACHIEVEMENT_BY_ID.get(id)).toBeDefined();
    }
  });

  it('every family has an icon, and every icon is a real glyph in the kit', () => {
    const families = Object.keys(FAMILY_LABELS).sort();
    expect(Object.keys(FAMILY_ICONS).sort()).toEqual(families);
    for (const family of families) {
      const def = ACHIEVEMENTS.find((a) => a.family === family);
      expect(def).toBeDefined();
      if (def === undefined) continue;
      const icon = achievementIcon(def);
      expect(ICON_GLYPHS[icon]).toBeDefined();
    }
  });

  it('the five new family glyphs are defined', () => {
    for (const id of ['heart', 'flask', 'star', 'skull', 'anvil']) {
      expect(ICON_GLYPHS[id as keyof typeof ICON_GLYPHS]).toBeDefined();
    }
  });
});

describe('the boost', () => {
  it('adds 1% per earned achievement', () => {
    const s = newGame(1, 0);
    expect(earnedCount(s)).toBe(0);
    expect(achievementBoost(s)).toBe(1);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 40).map((a) => a.id);
    expect(earnedCount(s)).toBe(40);
    expect(achievementBoost(s)).toBe(1 + ACHIEVEMENT_BOOST * 40);
  });

  it('multiplies the final battle values and the effective dig power and vein yields', () => {
    const s = newGame(1, 0);
    const stats = deriveStats(s);
    const bareBattle = deriveBattleStats(s);
    const bareTicks = faceTicksPerMetre(s, stats);
    const bareGold = newGame(1, 0);
    collect(bareGold, { feature: 'goldVein', amount: 100, hardRock: false }, 1, 1, stats);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    const pow = 1 + ACHIEVEMENT_BOOST * 100;
    const boostedBattle = deriveBattleStats(s);
    expect(boostedBattle.damageMin).toBe(Math.round(bareBattle.damageMin * pow));
    expect(boostedBattle.damageMax).toBe(Math.round(bareBattle.damageMax * pow));
    expect(boostedBattle.maxLife).toBe(Math.round(bareBattle.maxLife * pow));
    expect(boostedBattle.armor).toBe(Math.round(bareBattle.armor * pow));
    // The effective dig power rises with the boost, so the face metre takes fewer ticks.
    expect(faceTicksPerMetre(s, stats)).toBeCloseTo(bareTicks / pow);
    const richGold = newGame(1, 0);
    richGold.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    collect(richGold, { feature: 'goldVein', amount: 100, hardRock: false }, 1, 1, stats);
    expect(richGold.gold).toBe(Math.round(bareGold.gold * pow));
  });

  it('never bypasses a clamp', () => {
    const s = newGame(1, 0);
    s.achievements.earned = ACHIEVEMENTS.map((a) => a.id);
    const battle = deriveBattleStats(s);
    expect(battle.damageMin).toBeLessThanOrEqual(MAX_DAMAGE);
    expect(battle.damageMax).toBeLessThanOrEqual(MAX_DAMAGE);
    expect(battle.maxLife).toBeLessThanOrEqual(MAX_LIFE);
    expect(battle.armor).toBeLessThanOrEqual(MAX_DAMAGE);
  });

  it('leaves a no-achievement run alone', () => {
    const s = newGame(1, 0);
    expect(achievementBoost(s)).toBe(1);
    const stats = deriveStats(s);
    expect(faceTicksPerMetre(s, stats)).toBe(faceTicksPerMetre(s, stats));
  });
});

describe('checks', () => {
  it('marks a family once, idempotently, and only when its condition holds', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 2_000_000;
    checkAchievements(s, 'gold');
    const earned = [...s.achievements.earned];
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.every((id) => id.startsWith('gold.'))).toBe(true);
    expect(s.achievements.earned).toContain('gold.1000000');
    expect(s.achievements.earned).toContain('gold.123456');
    checkAchievements(s, 'gold');
    expect(s.achievements.earned).toEqual(earned);
    s.stats.goldFound = 10_000_000;
    checkAchievements(s, 'gold');
    expect(s.achievements.earned.length).toBeGreaterThan(earned.length);
    expect(s.achievements.earned).toContain('gold.10000000');
  });

  it('a family check touches only that family', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 1_000_000;
    s.stats.monstersKilled = 50_000;
    checkAchievements(s, 'gold');
    expect(s.achievements.earned.some((id) => id.startsWith('gold.'))).toBe(true);
    expect(s.achievements.earned.some((id) => id.startsWith('kills.'))).toBe(false);
  });
});

describe('carry-over', () => {
  it('achievements and stats survive ascension', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 1000;
    checkAchievements(s, 'gold');
    const earned = [...s.achievements.earned];
    s.level = ASCEND_LEVEL;
    s.deepest = 100;
    expect(ascend(s)).toBe('ok');
    expect(s.stats.goldFound).toBe(1000);
    expect(earned.every((id) => s.achievements.earned.includes(id))).toBe(true);
    expect(s.achievements.earned).toContain('ascensions.1');
  });

  it('finishing a metre counts it and marks the depth achievements once', () => {
    const s = newGame(1, 0);
    expect(s.stats.metresDug).toBe(0);
    finishMetre(s, 1, { feature: null, amount: 0, hardRock: false }, deriveStats(s));
    expect(s.deepest).toBe(1);
    expect(s.stats.metresDug).toBe(1);
    s.deepest = 250;
    checkAchievements(s, 'depth');
    expect(s.achievements.earned).toContain('depth.250');
    checkAchievements(s, 'depth');
    expect(s.achievements.earned.filter((id) => id === 'depth.250')).toHaveLength(1);
  });
});

describe('emptyLifetimeStats', () => {
  it('starts every counter at zero', () => {
    const stats = emptyLifetimeStats();
    expect(stats.goldFound).toBe(0);
    expect(stats.metresDug).toBe(0);
    expect(stats.monstersKilled).toBe(0);
    expect(Object.keys(stats.oresFound)).toEqual([...MATERIALS]);
    expect(MATERIALS.every((m) => stats.oresFound[m] === 0)).toBe(true);
    expect(MATERIALS.every((m) => stats.oresTraded[m] === 0)).toBe(true);
    expect(Object.keys(stats.gemsFound)).toEqual([...GEM_TYPES]);
    expect(GEM_TYPES.every((t) => Object.keys(stats.gemsFound[t]).join() === GEM_GRADES.join())).toBe(true);
  });
});

describe('the lifetime ledger sets', () => {
  it('addToSet inserts in sorted order and reports whether the value was new', () => {
    const list = [2, 5];
    expect(addToSet(list, 3)).toBe(true);
    expect(list).toEqual([2, 3, 5]);
    expect(addToSet(list, 3)).toBe(false);
    expect(addToSet(list, 1)).toBe(true);
    expect(addToSet(list, 9)).toBe(true);
    expect(list).toEqual([1, 2, 3, 5, 9]);
    const words = ['molesbane', 'wolfEye'];
    expect(addToSet(words, 'peacemaker')).toBe(true);
    expect(words).toEqual(['molesbane', 'peacemaker', 'wolfEye']);
  });

  it('receiving the same legendary twice records it once, from a drop and from the merchant alike', () => {
    const s = newGame(1, 0);
    const item = (): GearItem => ({ ...gear(s, 'pickaxe', { rarity: 'legendary', uniqueId: 'molesbane' }) });
    receiveItem(s, item(), { kind: 'metre', metre: 1 });
    receiveItem(s, item(), { kind: 'metre', metre: 1 });
    expect(s.stats.legendariesFound).toEqual(['molesbane']);
    expect(s.stats.legendaries).toBe(2);
    receiveItem(s, { ...item(), uniqueId: 'deepdelver' }, { kind: 'metre', metre: 1 });
    expect(s.stats.legendariesFound).toEqual(['deepdelver', 'molesbane']);
  });

  it('a gambled legendary joins the set', () => {
    const s = newGame(1, 0);
    s.gold = 1e12;
    s.deepest = 5000;
    for (let i = 0; i < 400 && s.stats.legendaries === 0; i++) {
      const bag = s.bag.findIndex((c) => c === null);
      if (bag < 0) s.bag.fill(null);
      gamble(s, 'pickaxe');
    }
    expect(s.stats.legendaries).toBeGreaterThan(0);
    expect(s.stats.legendariesFound.length).toBeGreaterThan(0);
  });

  it('rune drops join the runes found, once each', () => {
    const s = newGame(1, 0);
    receiveItem(s, { id: s.nextId++, type: 'rune', rune: 'isa', count: 2 }, { kind: 'metre', metre: 1 });
    receiveItem(s, { id: s.nextId++, type: 'rune', rune: 'fehu', count: 1 }, { kind: 'metre', metre: 1 });
    receiveItem(s, { id: s.nextId++, type: 'rune', rune: 'isa', count: 1 }, { kind: 'metre', metre: 1 });
    expect(s.stats.runesFound).toEqual(['fehu', 'isa']);
  });
});

describe('pruneEarned', () => {
  it('drops ids the list does not have and keeps the rest in order', () => {
    const s = newGame(1, 0);
    s.achievements.earned = ['gold.1000000', 'clicks.7', 'depth.10', 'feat.nope'];
    pruneEarned(s);
    expect(s.achievements.earned).toEqual(['gold.1000000', 'depth.10']);
  });

  it('every generated achievement is a ladder or a collection, collections named for their set', () => {
    expect(ACHIEVEMENTS.every((a) => a.kind === (a.family.startsWith('collection.') ? 'collection' : 'ladder'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The feat engine. The real list arrives later; these tests register their own.
// ---------------------------------------------------------------------------------------------------------------------

const clutchWin: FeatDef = {
  id: 'feat.test-clutch', family: 'test', kind: 'feat', name: 'Clutch', desc: 'Clear a map below 10% life.', on: 'runEnd',
  test: (s, e) => e.kind === 'runEnd' && e.result.outcome === 'cleared' && e.run.minLife / deriveBattleStats(s).maxLife < 0.1,
};
const pausedClick: FeatDef = {
  id: 'secret.test-paused', family: 'test', kind: 'hidden', name: 'Idle hands', desc: 'Click while paused.', on: 'click',
  test: (_s, e) => e.kind === 'click' && e.paused,
};

/** A feat that earns nothing and records every event it is offered, to see where the hooks fire. */
function spy(on: FeatEvent['kind']): { feat: FeatDef; seen: FeatEvent[] } {
  const seen: FeatEvent[] = [];
  return { seen, feat: { id: `feat.spy-${on}`, family: 'test', kind: 'feat', name: 'Spy', desc: 'Watches.', on, test: (_s, e) => { seen.push(e); return false; } } };
}

/** Every random stream a game owns. */
const streams = (s: GameState): number[] => [s.rng, s.uniqueRng, s.runeRng];

/** A fresh game running a tier-1 map, whose lowest life so far is a share of max life. */
function inMap(lifeShare = 1): { s: GameState; run: MapRun } {
  const s = newGame(1, 0);
  expect(startMap(s, stashMap(s, 1, 2).id)).toBe('ok');
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  const run = s.activity.run;
  run.minLife = Math.max(1, Math.round(deriveBattleStats(s).maxLife * lifeShare));
  return { s, run };
}

afterEach(() => registerFeatsForTest(null));

describe('the feat engine', () => {
  it('a run-end feat earns on a clear at 5% life, not on a death at 5%, nor a clear at 50%', () => {
    registerFeatsForTest([clutchWin]);
    const clear = inMap(0.05);
    endRun(clear.s, clear.run, 'cleared');
    expect(clear.s.achievements.earned).toContain('feat.test-clutch');
    const died = inMap(0.05);
    endRun(died.s, died.run, 'died');
    expect(died.s.achievements.earned).not.toContain('feat.test-clutch');
    const easy = inMap(0.5);
    endRun(easy.s, easy.run, 'cleared');
    expect(easy.s.achievements.earned).not.toContain('feat.test-clutch');
  });

  it('a click feat earns on a click while paused, not on one while unpaused', () => {
    registerFeatsForTest([pausedClick]);
    const s = newGame(1, 0);
    clickTicks(s, deriveStats(s));
    expect(s.achievements.earned).not.toContain('secret.test-paused');
    s.paused = true;
    clickTicks(s, deriveStats(s));
    expect(s.achievements.earned).toContain('secret.test-paused');
  });

  it('counts clicks made while paused', () => {
    const s = newGame(1, 0);
    clickTicks(s, deriveStats(s));
    expect(s.stats.clicksPaused).toBe(0);
    s.paused = true;
    clickTicks(s, deriveStats(s));
    clickTicks(s, deriveStats(s));
    expect(s.stats.clicksPaused).toBe(2);
    expect(s.stats.clicks).toBe(3);
  });

  it('never earns an id twice and only tries the feats of the event it is given', () => {
    registerFeatsForTest([pausedClick, clutchWin]);
    const s = newGame(1, 0);
    checkFeats(s, { kind: 'click', paused: true });
    checkFeats(s, { kind: 'click', paused: true });
    expect(s.achievements.earned).toEqual(['secret.test-paused']);
    checkFeats(s, { kind: 'rename', name: 'x' });
    expect(s.achievements.earned).toEqual(['secret.test-paused']);
  });

  it('reads and advances no random stream', () => {
    registerFeatsForTest([pausedClick, clutchWin]);
    const s = newGame(1, 0);
    const before = streams(s);
    checkFeats(s, { kind: 'click', paused: true });
    checkFeats(s, { kind: 'rename', name: 'x' });
    expect(streams(s)).toEqual(before);
    const { s: t, run } = inMap(0.05);
    const rng = streams(t);
    checkFeats(t, { kind: 'runEnd', run, result: { map: run.map, outcome: 'cleared', room: 1, bossRoom: 1, gained: run.gained, items: 0, seen: false } });
    expect(t.achievements.earned).toContain('feat.test-clutch');
    expect(streams(t)).toEqual(rng);
  });

  it('the real table has no feat yet', () => {
    expect(ACHIEVEMENTS.filter((a) => a.kind === 'feat' || a.kind === 'hidden')).toEqual([]);
  });
});

describe('where the feat hooks fire', () => {
  it('endRun offers the run once, after the counters moved', () => {
    const { feat, seen } = spy('runEnd');
    registerFeatsForTest([feat]);
    const { s, run } = inMap();
    const cleared = s.stats.mapsCleared;
    endRun(s, run, 'cleared');
    expect(seen).toHaveLength(1);
    expect(s.stats.mapsCleared).toBe(cleared + 1);
    const first = seen[0];
    expect(first?.kind === 'runEnd' && first.result.outcome).toBe('cleared');
    expect(first?.kind === 'runEnd' && first.run).toBe(run);
  });

  it('a kill offers the monster and the run, once', () => {
    const { feat, seen } = spy('kill');
    registerFeatsForTest([feat]);
    const { s, run } = inMap();
    const m: MonsterState = { ...(run.queue[0] as MonsterState) };
    onKill(s, run, m, deriveBattleStats(s));
    expect(seen).toEqual([{ kind: 'kill', run, monster: m }]);
  });

  it('a click offers whether the game was paused', () => {
    const { feat, seen } = spy('click');
    registerFeatsForTest([feat]);
    const s = newGame(1, 0);
    clickTicks(s, deriveStats(s));
    s.paused = true;
    clickTicks(s, deriveStats(s));
    expect(seen).toEqual([{ kind: 'click', paused: false }, { kind: 'click', paused: true }]);
  });

  it('a finished metre offers its depth', () => {
    const { feat, seen } = spy('metre');
    registerFeatsForTest([feat]);
    const s = newGame(1, 0);
    finishMetre(s, 1, { feature: null, amount: 0, hardRock: false }, deriveStats(s));
    expect(seen).toEqual([{ kind: 'metre', depth: 1 }]);
  });

  it('a manual sale and a manual salvage offer the item', () => {
    const sold = spy('sell');
    const salvaged = spy('salvage');
    registerFeatsForTest([sold.feat, salvaged.feat]);
    const s = newGame(1, 0);
    const a = gear(s, 'pickaxe');
    const b = gear(s, 'lamp');
    s.bag[0] = a;
    s.bag[1] = b;
    expect(sell(s, { where: 'bag', index: 0 })).toBe('ok');
    expect(salvage(s, { where: 'bag', index: 1 })).toBe('ok');
    expect(sold.seen).toEqual([{ kind: 'sell', item: a }]);
    expect(salvaged.seen).toEqual([{ kind: 'salvage', item: b }]);
  });

  it('a sell is offered once, after itemsSold moved, on the manual and the filter path alike', () => {
    const counts: number[] = [];
    const { feat, seen } = spy('sell');
    registerFeatsForTest([{ ...feat, test: (s, e) => { counts.push(s.stats.itemsSold); return feat.test(s, e); } }]);
    const s = newGame(1, 0);
    s.bag[0] = gear(s, 'pickaxe');
    expect(sell(s, { where: 'bag', index: 0 })).toBe('ok');
    expect(counts).toEqual([1]);
    expect(s.stats.itemsSold).toBe(1);
    s.settings.lootFilter = [{ kind: 'gear', rarity: 'normal', action: 'sell' }];
    receiveItem(s, gear(s, 'lamp', { rarity: 'normal' }), { kind: 'metre', metre: 1 });
    expect(counts).toEqual([1, 2]);
    expect(seen).toHaveLength(2);
    expect(s.stats.itemsSold).toBe(2);
  });

  it('a salvage is offered once, after itemsSalvaged moved, on the manual and the filter path alike', () => {
    const counts: number[] = [];
    const { feat, seen } = spy('salvage');
    registerFeatsForTest([{ ...feat, test: (s, e) => { counts.push(s.stats.itemsSalvaged); return feat.test(s, e); } }]);
    const s = newGame(1, 0);
    s.bag[0] = gear(s, 'pickaxe');
    expect(salvage(s, { where: 'bag', index: 0 })).toBe('ok');
    s.settings.lootFilter = [{ kind: 'gear', rarity: 'normal', action: 'salvage' }];
    receiveItem(s, gear(s, 'lamp', { rarity: 'normal' }), { kind: 'metre', metre: 1 });
    expect(counts).toEqual([1, 2]);
    expect(seen).toHaveLength(2);
  });

  it('a find the loot filter sells or salvages offers the item too', () => {
    const sold = spy('sell');
    const salvaged = spy('salvage');
    registerFeatsForTest([sold.feat, salvaged.feat]);
    const s = newGame(1, 0);
    s.settings.lootFilter = [{ kind: 'gear', rarity: 'normal', action: 'sell' }, { kind: 'gear', rarity: 'magic', action: 'salvage' }];
    const a = gear(s, 'pickaxe', { rarity: 'normal' });
    const b = gear(s, 'lamp', { rarity: 'magic' });
    receiveItem(s, a, { kind: 'metre', metre: 1 });
    receiveItem(s, b, { kind: 'metre', metre: 1 });
    expect(sold.seen).toEqual([{ kind: 'sell', item: a }]);
    expect(salvaged.seen).toEqual([{ kind: 'salvage', item: b }]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Collections.
// ---------------------------------------------------------------------------------------------------------------------

const collection = (family: string) => ACHIEVEMENTS.filter((a) => a.family === family);
const legendary = (s: GameState, id: string): GearItem => gear(s, 'pickaxe', { rarity: 'legendary', uniqueId: id });
const here = { kind: 'metre', metre: 1 } as const;

describe('collections', () => {
  it('each set has a ladder of collection achievements that ends at its full size', () => {
    const tiers = [1, 2, 3, 4, 5].map((t) => LEGENDARIES.filter((d) => d.tier === t).length);
    const expected: [string, number][] = [
      ['collection.legendaries', LEGENDARIES.length],
      ...tiers.map((n, i): [string, number] => [`collection.legendaryTier${i + 1}`, n]),
      ['collection.runes', RUNE_TYPES.length],
      ['collection.championMods', CHAMPION_MODS.length],
      ['collection.specials', MAP_SPECIALS.length],
      ['collection.gems', GEM_TYPES.length * GEM_GRADES.length],
      ['collection.dungeons', 100],
    ];
    for (const [family, size] of expected) {
      const list = collection(family);
      expect(list.length, family).toBeGreaterThan(0);
      expect(list.every((a) => a.kind === 'collection' && a.id === `${family}.${a.value}`), family).toBe(true);
      expect(list.map((a) => a.value), family).toEqual([...list.map((a) => a.value)].sort((x, y) => x - y));
      expect(list[list.length - 1]?.value, family).toBe(size);
      expect(FAMILY_LABELS[family], family).toBeDefined();
    }
    expect(collection('collection.dungeons').map((a) => a.value)).toEqual([5, 10, 25, 50, 100]);
  });

  it('the first distinct legendary earns the first step, and the same one again does not move it', () => {
    const s = newGame(1, 0);
    receiveItem(s, legendary(s, 'molesbane'), here);
    expect(s.achievements.earned).toContain('collection.legendaries.1');
    expect(s.achievements.earned).toContain('collection.legendaryTier1.1');
    const earned = [...s.achievements.earned];
    receiveItem(s, legendary(s, 'molesbane'), here);
    expect(s.stats.legendariesFound).toEqual(['molesbane']);
    expect(s.achievements.earned.filter((id) => id.startsWith('collection.'))).toEqual(earned.filter((id) => id.startsWith('collection.')));
  });

  it('a legendary counts toward its own tier only', () => {
    const s = newGame(1, 0);
    const t5 = LEGENDARIES.find((d) => d.tier === 5);
    if (t5 === undefined) throw new Error('no tier-5 legendary');
    receiveItem(s, legendary(s, t5.id), here);
    expect(s.achievements.earned).toContain('collection.legendaryTier5.1');
    expect(s.achievements.earned).not.toContain('collection.legendaryTier1.1');
  });

  it('the legendary total climbs with the set, up to every legendary', () => {
    const s = newGame(1, 0);
    for (const d of LEGENDARIES) receiveItem(s, legendary(s, d.id), here);
    expect(s.achievements.earned).toContain(`collection.legendaries.${LEGENDARIES.length}`);
    for (let t = 1; t <= 5; t++) {
      const n = LEGENDARIES.filter((d) => d.tier === t).length;
      expect(s.achievements.earned, `tier ${t}`).toContain(`collection.legendaryTier${t}.${n}`);
    }
  });

  it('runes earn their collection as each new type is found', () => {
    const s = newGame(1, 0);
    receiveItem(s, { id: s.nextId++, type: 'rune', rune: 'isa', count: 1 }, here);
    expect(s.achievements.earned).toContain('collection.runes.1');
    expect(s.achievements.earned).not.toContain('collection.runes.2');
    receiveItem(s, { id: s.nextId++, type: 'rune', rune: 'fehu', count: 1 }, here);
    expect(s.achievements.earned).toContain('collection.runes.2');
  });

  it('gems count (type, grade) pairs, not gems', () => {
    const s = newGame(1, 0);
    const find = (gem: 'ruby' | 'emerald', grade: 'tiny' | 'big', count: number) =>
      receiveItem(s, { id: s.nextId++, type: 'gem', gem, grade, count }, here);
    find('ruby', 'tiny', 40);
    expect(s.achievements.earned).toContain('collection.gems.1');
    expect(s.achievements.earned).not.toContain('collection.gems.2');
    find('ruby', 'big', 1);
    find('emerald', 'tiny', 1);
    expect(s.achievements.earned).toContain('collection.gems.3');
  });

  it('champion mods are collected by killing champions that carry them', () => {
    const { s, run } = inMap();
    const m: MonsterState = { ...(run.queue[0] as MonsterState), rank: 'champion', mods: ['armored', 'swift'] };
    onKill(s, run, m, deriveBattleStats(s));
    expect(s.achievements.earned).toContain('collection.championMods.1');
    expect(s.achievements.earned).toContain('collection.championMods.2');
    expect(s.achievements.earned).not.toContain('collection.championMods.3');
  });

  it('a cleared map with a special grows the specials collection', () => {
    const { s, run } = inMap();
    run.map.special = 'treasureRoom';
    endRun(s, run, 'cleared');
    expect(s.stats.specialsCleared).toEqual(['treasureRoom']);
    expect(s.achievements.earned).toContain('collection.specials.1');
  });

  it('a cleared map of a new dungeon type grows the dungeons collection', () => {
    const { s, run } = inMap();
    s.stats.dungeonTypesCleared = ['2:0', '2:1', '2:2', '3:0'];
    endRun(s, run, 'cleared');
    expect(s.stats.dungeonTypesCleared).toHaveLength(5);
    expect(s.achievements.earned).toContain('collection.dungeons.5');
  });

  it('collections never touch the random streams', () => {
    const s = newGame(1, 0);
    const before = streams(s);
    s.stats.runesFound = ['fehu'];
    checkAchievements(s, 'collection.runes');
    expect(streams(s)).toEqual(before);
  });
});
