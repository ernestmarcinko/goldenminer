import { GATE_EVERY } from './balance';
import { hashN } from './rng';
import type { Element } from './types';

// Gate tiers (round 5a): every GATE_EVERY-th map tier is a wall that asks for one kind of defence. Like the rest of the
// world, the wall is a pure function of (seed, tier) with its own salt and never reads game state.
export type Wall = Element;

const SALT_GATE = 0x6a7e;

export function isGateTier(tier: number): boolean {
  return tier >= GATE_EVERY && tier % GATE_EVERY === 0;
}

/** 1, 2, 3 … for tiers 5, 10, 15 …; 0 for a tier that is not a gate. */
export function gateIndex(tier: number): number {
  return isGateTier(tier) ? tier / GATE_EVERY : 0;
}

/** The wall of a gate tier; consecutive gate pairs (5 and 10, 15 and 20 …) have one of each, in an order the seed picks. */
export function gateWall(seed: number, tier: number): Wall | undefined {
  if (!isGateTier(tier)) return undefined;
  const g = gateIndex(tier);
  const pair = Math.floor((g - 1) / 2);
  const swapped = (hashN(seed, SALT_GATE, pair) & 1) === 1;
  const first = g % 2 === 1;
  return first !== swapped ? 'physical' : 'elemental';
}
