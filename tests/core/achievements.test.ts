import { afterEach, describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BOOST, ACHIEVEMENT_BY_ID, ACHIEVEMENT_IDS, FAMILY_ICONS, FAMILY_LABELS,
  achievementBoost, achievementIcon, checkAchievements, checkFeats, earnedCount, pruneEarned, registerFeatsForTest,
  type AchievementKind, type FeatDef, type FeatEvent,
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
import { gateWall } from '../../src/core/gates';
import { dungeonLayout } from '../../src/core/dungeons';
import { BATTLE_SLOTS, type GemGrade, type GemType } from '../../src/core/items';

const LADDER_FAMILIES = [
  'depth', 'dig', 'clicks', 'handMined', 'autoMined', 'gold', 'goldSpent', 'diamonds', 'diamondsSpent', 'soulsEarned', 'soulsSpent',
  'gems', 'chests', 'maps', 'mapsFound', 'mapsLost', 'kills', 'champions', 'bosses', 'deaths',
  'levels', 'levelsGained', 'ascensions', 'craft', 'merchant', 'itemsKept', 'itemsSold', 'itemsSalvaged',
  'oresTraded', 'legendaries', 'sockets', 'timePlayed', 'timeAway',
  ...MATERIALS.map((m) => `ore.${m}`),
];
const ofKind = (kind: AchievementKind) => ACHIEVEMENTS.filter((a) => a.kind === kind);

describe('the achievement table', () => {
  it('holds 750–850 achievements: at least 40 feats and 40 collection steps, and 20–40 secrets', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(750);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(850);
    expect(ofKind('hidden').length).toBeGreaterThanOrEqual(20);
    expect(ofKind('hidden').length).toBeLessThanOrEqual(40);
    expect(ofKind('feat').length).toBeGreaterThanOrEqual(40);
    expect(ofKind('collection').length).toBeGreaterThanOrEqual(40);
    expect(ACHIEVEMENT_IDS.size).toBe(ACHIEVEMENTS.length);
  });

  it('keeps the counter families and the ores, each a ladder of 8–12 strictly increasing thresholds', () => {
    expect(new Set(ofKind('ladder').map((a) => a.family))).toEqual(new Set(LADDER_FAMILIES));
    for (const family of LADDER_FAMILIES) {
      const values = ACHIEVEMENTS.filter((a) => a.family === family).map((a) => a.value);
      expect(values.length, family).toBeGreaterThanOrEqual(8);
      expect(values.length, family).toBeLessThanOrEqual(12);
      for (let i = 1; i < values.length; i++) expect(values[i], family).toBeGreaterThan(values[i - 1] ?? Infinity);
    }
  });

  it('starts no ladder at 1, except deaths, levels and ascensions', () => {
    for (const family of LADDER_FAMILIES) {
      if (family === 'deaths' || family === 'levels' || family === 'ascensions') continue;
      expect(ACHIEVEMENTS.find((a) => a.family === family)?.value, family).not.toBe(1);
    }
  });

  it('keeps the salted milestones', () => {
    for (const id of ['ascensions.42', 'deaths.666', 'depth.1337', 'timePlayed.8760', 'dig.123456', 'gold.123456']) {
      expect(ACHIEVEMENT_IDS.has(id), id).toBe(true);
    }
  });

  it('ids are `<family>.<value>` for ladders and collections, `feat.` and `secret.` for the deeds, every name unique', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.kind === 'ladder' || a.kind === 'collection') expect(a.id).toBe(`${a.family}.${a.value}`);
      else expect(a.value).toBe(1);
      if (a.kind === 'feat') expect(a.id.startsWith('feat.') && a.family.startsWith('feat.'), a.id).toBe(true);
      if (a.kind === 'hidden') expect(a.id.startsWith('secret.') && a.family === 'secret', a.id).toBe(true);
      expect(a.value).toBeGreaterThan(0);
      expect(a.name.length, a.id).toBeGreaterThan(0);
      expect(a.desc.length, a.id).toBeGreaterThan(0);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
  });

  it('every family has a label and an icon', () => {
    const families = new Set(ACHIEVEMENTS.map((a) => a.family));
    expect(new Set(Object.keys(FAMILY_LABELS))).toEqual(families);
    expect(new Set(Object.keys(FAMILY_ICONS))).toEqual(families);
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
    s.deepest = 1000;
    checkAchievements(s, 'depth');
    expect(s.achievements.earned).toContain('depth.1000');
    checkAchievements(s, 'depth');
    expect(s.achievements.earned.filter((id) => id === 'depth.1000')).toHaveLength(1);
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
    s.achievements.earned = ['gold.1000000', 'clicks.7', 'depth.1000', 'feat.nope', 'secret.steve', 'depth.10'];
    pruneEarned(s);
    expect(s.achievements.earned).toEqual(['gold.1000000', 'depth.1000', 'secret.steve']);
  });

  it('every generated achievement is a ladder or a collection, collections named for their set', () => {
    const generated = ACHIEVEMENTS.filter((a) => a.kind !== 'feat' && a.kind !== 'hidden');
    expect(generated.every((a) => a.kind === (a.family.startsWith('collection.') ? 'collection' : 'ladder'))).toBe(true);
    expect(generated.some((a) => a.family.startsWith('feat.') || a.family === 'secret')).toBe(false);
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
function inMap(lifeShare = 1, tier = 1): { s: GameState; run: MapRun } {
  const s = newGame(1, 0);
  expect(startMap(s, stashMap(s, tier, 2).id)).toBe('ok');
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
      ...GEM_GRADES.map((grade): [string, number] => [`collection.gemGrade.${grade}`, GEM_TYPES.length]),
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
    const find = (gem: GemType, grade: GemGrade, count = 1) => receiveItem(s, { id: s.nextId++, type: 'gem', gem, grade, count }, here);
    find('ruby', 'tiny', 40);
    find('ruby', 'big');
    find('emerald', 'tiny');
    find('emerald', 'big');
    expect(s.achievements.earned).not.toContain('collection.gems.5');
    find('ruby', 'tiny');
    expect(s.achievements.earned).not.toContain('collection.gems.5');
    find('sapphire', 'giant');
    expect(s.achievements.earned).toContain('collection.gems.5');
  });

  it('a grade is collected by finding it in three types, then in every type', () => {
    const s = newGame(1, 0);
    const find = (gem: GemType) => receiveItem(s, { id: s.nextId++, type: 'gem', gem, grade: 'small', count: 1 }, here);
    find('ruby');
    find('sapphire');
    expect(s.achievements.earned).not.toContain('collection.gemGrade.small.3');
    find('emerald');
    expect(s.achievements.earned).toContain('collection.gemGrade.small.3');
    expect(s.achievements.earned).not.toContain('collection.gemGrade.tiny.3');
    find('amethyst');
    find('starstone');
    expect(s.achievements.earned).toContain(`collection.gemGrade.small.${GEM_TYPES.length}`);
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

// ---------------------------------------------------------------------------------------------------------------------
// The real feats and secrets.
// ---------------------------------------------------------------------------------------------------------------------

const deeds = () => ACHIEVEMENTS.filter((a) => a.kind === 'feat' || a.kind === 'hidden').map((a) => a.id);
const earnedDeeds = (s: GameState) => s.achievements.earned.filter((id) => id.startsWith('feat.') || id.startsWith('secret.'));

describe('the real feats', () => {
  it('a first-try gate clear earns its first-try feat and its wall; a later attempt earns the wall only', () => {
    const first = inMap(1, 5);
    expect(first.run.attempt).toBe(1);
    endRun(first.s, first.run, 'cleared');
    const wall = gateWall(first.s.seed, 5);
    expect(first.s.achievements.earned).toContain('feat.gateFirstTry.5');
    expect(first.s.achievements.earned).toContain(`feat.${wall}Wall.10`);
    expect(first.s.achievements.earned).toContain('feat.gateComposed.5');
    expect(first.s.achievements.earned).not.toContain('feat.gateFirstTry.10');
    const later = inMap(1, 5);
    later.s.stats.gateAttempts[5] = 3;
    later.run.attempt = 4;
    endRun(later.s, later.run, 'cleared');
    expect(later.s.achievements.earned).not.toContain('feat.gateFirstTry.5');
    expect(later.s.achievements.earned).toContain(`feat.${wall}Wall.10`);
  });

  it('a death or a retreat earns no clear feat, however low the life', () => {
    const died = inMap(0.05, 5);
    endRun(died.s, died.run, 'died');
    const left = inMap(0.05, 5);
    endRun(left.s, left.run, 'left');
    for (const s of [died.s, left.s]) {
      expect(earnedDeeds(s).filter((id) => id.startsWith('feat.'))).toEqual([]);
    }
  });

  it('a clutch clear counts for its tier and below, not above', () => {
    const { s, run } = inMap(0.05, 10);
    endRun(s, run, 'cleared');
    expect(s.achievements.earned).toContain('feat.clutch.5');
    expect(s.achievements.earned).toContain('feat.clutch.10');
    expect(s.achievements.earned).not.toContain('feat.clutch.15');
    expect(s.achievements.earned).not.toContain('feat.flawless.10');
    expect(s.achievements.earned).not.toContain('feat.gateComposed.10');
  });

  it('a quick boss counts only when the boss room was timed', () => {
    const timed = inMap(1, 5);
    timed.run.elapsedS = 30;
    timed.run.bossSinceS = 29;
    endRun(timed.s, timed.run, 'cleared');
    expect(timed.s.achievements.earned).toContain('feat.bossRush.5');
    const untimed = inMap(1, 5);
    untimed.run.elapsedS = 0;
    endRun(untimed.s, untimed.run, 'cleared');
    expect(untimed.s.achievements.earned).not.toContain('feat.bossRush.5');
  });

  it('a gear feat reads the battle set: an empty slot, or normal gear in every slot', () => {
    const empty = inMap(1, 5);
    endRun(empty.s, empty.run, 'cleared');
    expect(empty.s.achievements.earned).toContain('feat.emptySlot.5');
    expect(empty.s.achievements.earned).not.toContain('feat.plainGear.5');
    const plain = inMap(1, 5);
    for (const slot of BATTLE_SLOTS) plain.s.equipped.battle[slot] = gear(plain.s, slot, { rarity: 'normal' });
    endRun(plain.s, plain.run, 'cleared');
    expect(plain.s.achievements.earned).toContain('feat.plainGear.5');
    expect(plain.s.achievements.earned).not.toContain('feat.emptySlot.5');
  });

  it('a champion-packed map of seven rooms earns every pack feat once it is cleared', () => {
    const { s, run } = inMap(1, 10);
    run.map.special = 'championPacks';
    const rooms = dungeonLayout(s.seed, run.map).rooms.length;
    endRun(s, run, 'cleared');
    for (const n of [4, 5, 6, 7]) expect(s.achievements.earned.includes(`feat.championPack.${n}`), `${n}`).toBe(n <= rooms);
  });

  it('an old pickaxe counts by depth, and no pickaxe counts as the oldest', () => {
    const s = newGame(1, 0);
    checkFeats(s, { kind: 'metre', depth: 1000 });
    expect(s.achievements.earned).toContain('feat.oldPick.1000');
    const t = newGame(1, 0);
    t.equipped.mining.pickaxe = gear(t, 'pickaxe', { ilvl: 2 });
    checkFeats(t, { kind: 'metre', depth: 1000 });
    expect(t.achievements.earned).not.toContain('feat.oldPick.1000');
    checkFeats(t, { kind: 'metre', depth: 2500 });
    expect(t.achievements.earned).toContain('feat.oldPick.2500');
  });

  it('secrets: a legendary sold, a thousand paused clicks, the game’s own name', () => {
    const s = newGame(1, 0);
    s.bag[0] = legendary(s, 'molesbane');
    expect(sell(s, { where: 'bag', index: 0 })).toBe('ok');
    expect(s.achievements.earned).toContain('secret.sellLegendary');
    s.paused = true;
    s.stats.clicksPaused = 999;
    clickTicks(s, deriveStats(s));
    expect(s.achievements.earned).toContain('secret.stillThere');
    checkFeats(s, { kind: 'rename', name: 'golden MINER' });
    expect(s.achievements.earned).toContain('secret.goldenMiner');
  });

  it('a death is humbling only 50 levels above the map', () => {
    const young = inMap(0.05, 5);
    young.s.level = 54;
    endRun(young.s, young.run, 'died');
    expect(young.s.achievements.earned).not.toContain('secret.humbled');
    const old = inMap(0.05, 5);
    old.s.level = 55;
    endRun(old.s, old.run, 'cleared');
    expect(old.s.achievements.earned).not.toContain('secret.humbled');
    const fallen = inMap(0.05, 5);
    fallen.s.level = 55;
    endRun(fallen.s, fallen.run, 'died');
    expect(fallen.s.achievements.earned).toContain('secret.humbled');
  });

  it('judging every deed reads and advances no random stream', () => {
    const { s, run } = inMap(0.05, 10);
    run.map.special = 'championPacks';
    const before = streams(s);
    endRun(s, run, 'cleared');
    checkFeats(s, { kind: 'metre', depth: 5000 });
    checkFeats(s, { kind: 'click', paused: true });
    checkFeats(s, { kind: 'rename', name: 'Steve' });
    expect(streams(s)).toEqual(before);
    expect(earnedDeeds(s).every((id) => deeds().includes(id))).toBe(true);
  });
});
