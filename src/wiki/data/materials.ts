import {
  CRAFT_COST, ESSENCE_COST, EXCHANGE_DOWN, EXCHANGE_UP, MATERIAL_TABLE, ORB_COST, PREMIUM_CAP, PREMIUM_DECAY_KEEP,
  PREMIUM_STEP, oreForTier,
} from '../../core/balance';
import { MATERIAL_LABELS } from '../../core/itemData';
import { ESSENCE_TIER_MAX, MATERIALS, type Material } from '../../core/items';
import type { CraftKind } from '../../core/types';

/** One ore: its depth, its weight in the material layer, and how many a vein gives. */
export interface MaterialRow {
  material: Material;
  label: string;
  index: number;
  from: number;
  weight: number;
  amount: number;
}

export function materialRows(): MaterialRow[] {
  return MATERIALS.map((material, index) => ({
    material,
    label: MATERIAL_LABELS[material],
    index,
    ...MATERIAL_TABLE[material],
  }));
}

/** A tier-t essence's recipe: which ore buys it and at what cost. Tier 1's ore is never a recipe (Copper/Tin craft). */
export interface EssenceRecipeRow {
  tier: number;
  ore: Material | undefined;
  oreLabel: string;
  cost: number;
}

export function essenceRecipes(): EssenceRecipeRow[] {
  const rows: EssenceRecipeRow[] = [];
  for (let tier = 1; tier <= ESSENCE_TIER_MAX; tier++) {
    const ore = oreForTier(tier);
    rows.push({
      tier,
      ore,
      oreLabel: ore === undefined ? '—' : MATERIAL_LABELS[ore],
      cost: ESSENCE_COST[tier] ?? 0,
    });
  }
  return rows;
}

/** The material crafts: a cost of `base + floor(level / per)` of the material, or `base` alone when `per` is 0. */
export interface CraftCostRow {
  kind: CraftKind;
  label: string;
  base: number;
  per: number;
}

const CRAFT_LABELS: Readonly<Record<CraftKind, string>> = { ...MATERIAL_LABELS, diamond: 'Diamonds' };

export function craftCosts(): CraftCostRow[] {
  return (Object.keys(CRAFT_COST) as CraftKind[]).map((kind) => ({
    kind,
    label: CRAFT_LABELS[kind],
    base: CRAFT_COST[kind].base,
    per: CRAFT_COST[kind].per,
  }));
}

/** The Refiner's ore exchange: up the ladder 4 : 1, down the ladder 1 : 3, and an orb's Iron cost. */
export const oreExchange = { up: EXCHANGE_UP, down: EXCHANGE_DOWN, orbCost: ORB_COST };

/** The decaying premium: each buy adds `step` (capped), and each tick multiplies what is left by `decayKeep`. */
export const orePremium = { step: PREMIUM_STEP, cap: PREMIUM_CAP, decayKeep: PREMIUM_DECAY_KEEP };
