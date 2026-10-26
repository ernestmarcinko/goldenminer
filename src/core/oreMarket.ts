import {
  ESSENCE_BAG_STACK, ESSENCE_COST, ESSENCE_STASH_STACK, EXCHANGE_DOWN, EXCHANGE_UP, ORB_COST, PREMIUM_CAP,
  PREMIUM_DECAY_KEEP, PREMIUM_STEP, oreForTier,
} from './balance';
import { firstEmpty } from './cells';
import { ESSENCE_TIER_MAX, MATERIALS, essenceKey, type EssenceItem, type Material, type OrbItem, type OrbSide, type StatKey } from './items';
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
 * Exchanges `amount` units of `from` ore into `to` ore, adjacent rungs only: up-ladder 4 : 1, down-ladder 1 : 3.
 * `amount` is how many units of `to` the player receives; its cost is premium-scaled via `costOf`, and a successful
 * exchange raises `to`'s premium. A refusal (short holdings, or a non-adjacent pair) changes nothing.
 */
export function tradeOres(state: GameState, from: Material, to: Material, amount: number): MarketResult {
  if (!Number.isInteger(amount) || amount <= 0) return 'invalid';
  const f = materialIndex(from);
  const t = materialIndex(to);
  let cost: number;
  if (t === f + 1) cost = Math.ceil(costOf(state, to, amount * EXCHANGE_UP));        // 4 from : 1 to
  else if (t === f - 1) cost = Math.ceil(costOf(state, to, amount / EXCHANGE_DOWN)); // 1 from : 3 to
  else return 'invalid';
  if (heldMaterial(state, from) < cost) return 'short';
  spendMaterial(state, from, cost);
  stashMaterials(state, { [to]: amount });
  raisePremium(state, to);
  return 'ok';
}

/** The Essences-tab key of an essence or orb. */
function tabKey(item: EssenceItem | OrbItem): string {
  return item.type === 'essence' ? essenceKey(item.stat, item.tier) : item.side;
}

/** Puts one bought essence or orb into the bag (topping a stack, then an empty cell), then the Essences tab. */
function stowStack(state: GameState, item: EssenceItem | OrbItem): void {
  const same = (c: EssenceItem | OrbItem): boolean =>
    item.type === 'essence' ? c.type === 'essence' && c.stat === item.stat && c.tier === item.tier
      : c.type === 'orb' && c.side === item.side;
  for (const c of state.bag) {
    if (c !== null && (c.type === 'essence' || c.type === 'orb') && same(c) && c.count < ESSENCE_BAG_STACK) {
      c.count += 1;
      return;
    }
  }
  const empty = firstEmpty(state.bag);
  if (empty >= 0) {
    state.bag[empty] = { ...item, id: state.nextId++, count: 1 };
    return;
  }
  const key = tabKey(item);
  state.stash.essences[key] = Math.min(ESSENCE_STASH_STACK, (state.stash.essences[key] ?? 0) + 1);
}

/** The fixed recipe: a tier-t essence of `stat` costs ESSENCE_COST[t] of its ore. Buying never draws from state.rng. */
export function essencePrice(tier: number): number {
  return ESSENCE_COST[tier] ?? 0;
}

/** Buys one essence of `stat` at `tier`, paying its ore; adds it to the bag or the Essences tab. */
export function buyEssence(state: GameState, stat: StatKey, tier: number): MarketResult {
  if (!Number.isInteger(tier) || tier < 1 || tier > ESSENCE_TIER_MAX) return 'invalid';
  const ore = oreForTier(tier);
  if (ore === undefined) return 'invalid';
  const cost = essencePrice(tier);
  if (heldMaterial(state, ore) < cost) return 'short';
  spendMaterial(state, ore, cost);
  stowStack(state, { id: state.nextId++, type: 'essence', stat, tier, count: 1 });
  return 'ok';
}

/** Buys one orb of `side`, paying ORB_COST Iron; adds it to the bag or the Essences tab. */
export function buyOrb(state: GameState, side: OrbSide): MarketResult {
  if (heldMaterial(state, 'iron') < ORB_COST) return 'short';
  spendMaterial(state, 'iron', ORB_COST);
  stowStack(state, { id: state.nextId++, type: 'orb', side, count: 1 });
  return 'ok';
}
