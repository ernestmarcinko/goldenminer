import {
  EXCHANGE_DOWN, EXCHANGE_UP, ORB_BAG_STACK, ORB_STASH_STACK, PREMIUM_CAP,
  PREMIUM_DECAY_KEEP, PREMIUM_STEP, orbCost, orbOre,
} from './balance';
import { checkAchievements } from './achievements';
import { firstEmpty } from './cells';
import { MATERIALS, orbKey, type Material, type OrbFamily, type OrbItem, type OrbSide, type OrbTier } from './items';
import { stashMaterials } from './loot';
import type { GameState } from './types';

export type MarketResult = 'ok' | 'short' | 'invalid';

/** A zeroed premium: every ore starts at no premium. */
export function emptyPremium(): Record<Material, number> {
  const premium = {} as Record<Material, number>;
  for (const m of MATERIALS) premium[m] = 0;
  return premium;
}

/** The premium-scaled cost of buying `to` at a base rate: `base × (1 + premium[to])`. */
export function costOf(state: GameState, to: Material, baseRate: number): number {
  return baseRate * (1 + state.oreMarket.premium[to]);
}

/** Buying into `ore` raises its premium by PREMIUM_STEP, capped at PREMIUM_CAP. */
export function raisePremium(state: GameState, ore: Material): void {
  state.oreMarket.premium[ore] = Math.min(PREMIUM_CAP, state.oreMarket.premium[ore] + PREMIUM_STEP);
}

/** Each applied tick multiplies every premium toward 0 by the decay factor, live and offline alike. */
export function decayPremiums(state: GameState, tickDelta: number): void {
  if (!(tickDelta > 0)) return;
  const factor = Math.pow(PREMIUM_DECAY_KEEP, tickDelta);
  const { premium } = state.oreMarket;
  for (const m of MATERIALS) premium[m] = premium[m] * factor;
}

const materialIndex = (m: Material): number => MATERIALS.indexOf(m);

/** How much of a material the player holds: every bag stack and the Materials tab. */
export function heldMaterial(state: GameState, m: Material): number {
  let n = state.stash.materials[m];
  for (const c of state.bag) if (c?.type === 'material' && c.material === m) n += c.count;
  return n;
}

/** Spends a material from the bag stacks first, then the Materials tab. */
function spendMaterial(state: GameState, m: Material, n: number): void {
  let left = n;
  for (let i = 0; i < state.bag.length && left > 0; i++) {
    const c = state.bag[i];
    if (c?.type !== 'material' || c.material !== m) continue;
    const take = Math.min(left, c.count);
    c.count -= take;
    left -= take;
    if (c.count <= 0) state.bag[i] = null;
  }
  if (left > 0) state.stash.materials[m] -= left;
}

/**
 * Exchanges `amount` units of `from` ore into `to` ore — every ore trades for every ore. Up the ladder costs
 * EXCHANGE_UP per rung (so 4 : 1 one rung up, 16 : 1 two rungs up, …); down the ladder pays 1 for EXCHANGE_DOWN per rung
 * (1 : 3 one rung down, 1 : 9 two rungs down, …). `amount` is how many units of `to` the player receives; its cost is
 * premium-scaled via `costOf`, and a successful exchange raises `to`'s premium. A refusal (short holdings, the same ore,
 * or a bad amount) changes nothing.
 */
export function tradeOres(state: GameState, from: Material, to: Material, amount: number): MarketResult {
  if (!Number.isInteger(amount) || amount <= 0) return 'invalid';
  const f = materialIndex(from);
  const t = materialIndex(to);
  const d = t - f;
  if (d === 0) return 'invalid';
  const cost = d > 0
    ? Math.ceil(costOf(state, to, amount * EXCHANGE_UP ** d))
    : Math.ceil(costOf(state, to, amount / EXCHANGE_DOWN ** -d));
  if (heldMaterial(state, from) < cost) return 'short';
  spendMaterial(state, from, cost);
  stashMaterials(state, { [to]: amount });
  state.stats.oresTraded[to] += amount;
  checkAchievements(state, 'oresTraded');
  raisePremium(state, to);
  return 'ok';
}

/** Puts one bought orb into the bag (topping a stack, then an empty cell), then the Orbs tab. */
function stowOrb(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): void {
  const same = (c: OrbItem): boolean => c.family === family && c.side === side && c.tier === tier;
  for (const c of state.bag) {
    if (c !== null && c.type === 'orb' && same(c) && c.count < ORB_BAG_STACK) {
      c.count += 1;
      return;
    }
  }
  const empty = firstEmpty(state.bag);
  if (empty >= 0) {
    state.bag[empty] = { id: state.nextId++, type: 'orb', family, side, tier, count: 1 };
    return;
  }
  const key = orbKey(family, side, tier);
  state.stash.orbs[key] = Math.min(ORB_STASH_STACK, (state.stash.orbs[key] ?? 0) + 1);
}

/** Buys one orb of `family`/`side`/`tier`, paying its ore; adds it to the bag or the Orbs tab. Buying never draws from state.rng. */
export function buyOrb(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): MarketResult {
  const ore = orbOre(family, side, tier);
  const cost = orbCost(family, side, tier);
  if (heldMaterial(state, ore) < cost) return 'short';
  spendMaterial(state, ore, cost);
  stowOrb(state, family, side, tier);
  return 'ok';
}
