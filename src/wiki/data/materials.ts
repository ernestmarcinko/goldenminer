import {
  CRAFT_COST, EXCHANGE_DOWN, EXCHANGE_UP, MATERIAL_TABLE, PREMIUM_CAP, PREMIUM_DECAY_KEEP,
  PREMIUM_STEP, orbCost, orbOre,
} from '../../core/balance';
import { MATERIAL_LABELS } from '../../core/itemData';
import { MATERIALS, ORBS, type Material, type OrbFamily, type OrbSide, type OrbTier } from '../../core/items';
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

/** One orb's recipe: its family, side (absent for scattering/socketing/clearing), tier (absent for untiered), name and
 * the ore that buys it. */
export interface OrbRecipeRow {
  family: OrbFamily; side: OrbSide | undefined; tier: OrbTier | undefined; name: string; ore: Material; oreLabel: string; cost: number;
}

export function orbRecipes(): OrbRecipeRow[] {
  return ORBS.map((o) => {
    const ore = orbOre(o.family, o.side, o.tier);
    return {
      family: o.family, side: o.side, tier: o.tier, name: o.name,
      ore, oreLabel: MATERIAL_LABELS[ore], cost: orbCost(o.family, o.side, o.tier),
    };
  });
}

/** The material crafts: a cost of `base + floor(level / per)` of the material, or `base` alone when `per` is 0. */
export interface CraftCostRow {
  kind: CraftKind;
  label: string;
  base: number;
  per: number;
}

const CRAFT_LABELS: Readonly<Record<CraftKind, string>> = {
  ...MATERIAL_LABELS, diamond: 'Diamonds', makeMagic: 'Diamonds', makeRare: 'Diamonds',
};

export function craftCosts(): CraftCostRow[] {
  const rows: CraftCostRow[] = [];
  for (const kind of Object.keys(CRAFT_COST) as CraftKind[]) {
    const cost = CRAFT_COST[kind];
    if (cost === undefined) continue;
    rows.push({ kind, label: CRAFT_LABELS[kind], base: cost.base, per: cost.per });
  }
  return rows;
}

/** The Refiner's ore exchange: up the ladder 4 : 1, down the ladder 1 : 3. */
export const oreExchange = { up: EXCHANGE_UP, down: EXCHANGE_DOWN };

/** The decaying premium: each buy adds `step` (capped), and each tick multiplies what is left by `decayKeep`. */
export const orePremium = { step: PREMIUM_STEP, cap: PREMIUM_CAP, decayKeep: PREMIUM_DECAY_KEEP };
