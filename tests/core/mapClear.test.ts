import { expect, it } from 'vitest';
import { ABYSS_BAND_HEIGHT, ABYSS_START, bandAt, metreTier } from '../../src/core/bands';
import { ACHIEVEMENTS } from '../../src/core/achievements';
import { BAG_SIZE, expectedAchievements } from '../../src/core/balance';
import * as combat from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { isGateTier } from '../../src/core/gates';
import { rollGear } from '../../src/core/itemGen';
import { BATTLE_SLOTS, type Rarity } from '../../src/core/items';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { hashN } from '../../src/core/rng';
import { deriveStats } from '../../src/core/stats';
import type { GameState } from '../../src/core/types';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { stashMap } from '../helpers/items';
import fightScene from '../../src/ui/run/FightScene.tsx?raw';

/** The first metre whose map is of `tier`: one past its band's start (a map's tier is that of the metre above it). */
function firstMetreOfTier(tier: number): number {
  if (tier >= 7) return ABYSS_START + ABYSS_BAND_HEIGHT * (tier - 7) + 1;
  let depth = 0;
  while (bandAt(depth).tier < tier) depth = bandAt(depth).end;
  return depth + 1;
}

/** A miner of `level` wearing five battle items of item level `ilvl` and `rarity`, one per slot. */
function miner(tier: number, i: number, level: number, ilvl: number, rarity: Rarity): GameState {
  const s = newGame(hashN(0xc1ea7, tier, i), 0, { lootSeed: hashN(0xc1ea7, 99, tier, i) });
  s.level = level;
  for (const slot of BATTLE_SLOTS) s.equipped.battle[slot] = rollGear(s, ilvl, 'battle', rarity, slot);
  return s;
}

/** Plays a normal map of `tier` to its end on auto strikes alone, emptying the bag and the held list as it goes. */
function cleared(s: GameState, tier: number, i: number): boolean {
  const metre = firstMetreOfTier(tier) + (i % 40);
  expect(metreTier(metre)).toBe(tier);
  expect(startMap(s, stashMap(s, tier, metre).id)).toBe('ok');
  const stats = deriveStats(s);
  while (s.activity.kind === 'map') {
    applyTicks(s, 10, stats);
    s.bag = Array.from({ length: BAG_SIZE }, () => null);
    s.overflow = [];
  }
  return s.lastRun?.outcome === 'cleared';
}

const MAPS = 100;

it('a fresh tier-N map is cleared by magic item-level-N gear at level 3N, with the achievements expected there; gates hold it', () => {
  const rates: number[] = [];
  for (let tier = 1; tier <= 10; tier++) {
    let wins = 0;
    for (let i = 0; i < MAPS; i++) {
      const s = miner(tier, i, Math.min(60, 3 * tier), tier, 'magic');
      s.achievements.earned = ACHIEVEMENTS.slice(0, Math.round(expectedAchievements(s.level))).map((a) => a.id);
      if (cleared(s, tier, i)) wins++;
    }
    rates.push(wins / MAPS);
  }
  const table = rates.map((r, i) => `tier ${i + 1}: ${Math.round(r * 100)}%`).join(', ');
  rates.forEach((r, i) => {
    // Plan 35's curve keeps pace with the achievement boost a player should hold, so this miner wins the tiers between
    // gates often (about 50–100 %), and a gate tier at most one time in five: a gate is a wall, not a slope. The bounds
    // guard both an accidental nerf and an accidental buff.
    const tier = i + 1;
    const [lo, hi] = isGateTier(tier) ? [0, 0.2] : tier <= 2 ? [0.6, 1] : [0.4, 1];
    expect(r >= lo && r <= hi, table).toBe(true);
  });
}, 120_000);

// The early-tier rule (Ernest, 2026-10-26; Plan 35 restores it): tiers 1 and 2 are gentle and won without clicking.
const EARLY_MAPS = 500;

it('the first map of a new world is won without clicks by a naked level-1 miner 55–75 % of the time', () => {
  // maps are the only XP and a new world wears nothing, so the guaranteed first map is played naked at level 1.
  let wins = 0;
  for (let i = 0; i < EARLY_MAPS; i++) {
    const s = newGame(hashN(0xc1ea7, 1, i), 0, { lootSeed: hashN(0xc1ea7, 99, 1, i) });
    if (cleared(s, 1, i)) wins++;
  }
  expect(wins / EARLY_MAPS).toBeGreaterThanOrEqual(0.55);
  expect(wins / EARLY_MAPS).toBeLessThanOrEqual(0.75);
}, 60_000);

it('an early miner wins a tier-2 map most of the time: level 3 in normal item-level-2 gear, 60–80 % of the time', () => {
  // the miner fresh from tier 1 has a few levels and the normal gear its maps dropped, not the reference miner's magic
  let wins = 0;
  for (let i = 0; i < EARLY_MAPS; i++) if (cleared(miner(2, i, 3, 2, 'normal'), 2, i)) wins++;
  expect(wins / EARLY_MAPS).toBeGreaterThanOrEqual(0.6);
  expect(wins / EARLY_MAPS).toBeLessThanOrEqual(0.8);
}, 60_000);

it('clicking in a map does nothing', () => {
  expect('clickHit' in combat).toBe(false);
  const make = () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    expect(store.startMap(stashMap(store.state, 1, 2).id)).toBe('ok');
    return store;
  };
  const still = make();
  const clicked = make();
  for (let t = 0; t < 30; t++) {
    expect(clicked.click()).toEqual([]);
    applyTicks(still.state, 1, deriveStats(still.state));
    applyTicks(clicked.state, 1, deriveStats(clicked.state));
  }
  expect(clicked.state.activity.kind).toBe('map');
  expect(clicked.state).toEqual(still.state);
  // the fight scene is no button: nothing on it takes a click
  expect(fightScene).not.toMatch(/onClick|<button|click to hit|click for/i);
});
