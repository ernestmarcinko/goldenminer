import {
  HAZARD_SLOW, LAYER_SALT, MATERIAL_RAMP_CAP, MATERIAL_RAMP_METRES, MATERIAL_TABLE, MATERIAL_VEIN_CHANCE,
  MAX_HAZARD_WARD, hazardChance,
} from './balance';
import { metreTier } from './bands';
import { MATERIALS, type Material } from './items';
import { hash2, mulberry32 } from './rng';
import type { Hazard } from './types';

export interface MetreLayer { vein: { material: Material; amount: number } | null; hazard: Hazard | null }

/** Deeper metres favour rarer materials: each weight ramps up from its first depth, then holds. */
export function materialWeights(metre: number): Record<Material, number> {
  const weights = {} as Record<Material, number>;
  for (const m of MATERIALS) {
    const { from, weight } = MATERIAL_TABLE[m];
    weights[m] = metre <= from ? 0 : weight * Math.min(MATERIAL_RAMP_CAP, 1 + (metre - from) / MATERIAL_RAMP_METRES);
  }
  return weights;
}

export function pickMaterial(metre: number, u: number): Material {
  const weights = materialWeights(metre);
  let total = 0;
  for (const m of MATERIALS) total += weights[m];
  const pick = u * total;
  let cumulative = 0;
  let last: Material = 'copper';
  for (const m of MATERIALS) {
    if (weights[m] === 0) continue;
    cumulative += weights[m];
    last = m;
    if (pick < cumulative) return m;
  }
  return last;
}

export function materialAmount(material: Material, metre: number, u: number): number {
  const base = MATERIAL_TABLE[material].amount * (1 + Math.floor(metreTier(metre) / 4));
  return Math.max(1, Math.round(base * (0.8 + 0.4 * u)));
}

// All five values are always drawn, in a fixed order, so no field depends on another.
export function metreLayer(seed: number, metre: number): MetreLayer {
  let state = hash2(hash2(seed, LAYER_SALT), metre);
  const next = (): number => {
    const r = mulberry32(state);
    state = r.state;
    return r.value;
  };
  const u1 = next(), u2 = next(), u3 = next(), u4 = next(), u5 = next();
  let vein: MetreLayer['vein'] = null;
  if (u1 < MATERIAL_VEIN_CHANCE) {
    const material = pickMaterial(metre, u2);
    vein = { material, amount: materialAmount(material, metre, u3) };
  }
  const hazard: Hazard | null = u4 < hazardChance(metre) ? (u5 < 0.5 ? 'gas' : 'unstable') : null;
  return { vein, hazard };
}

/** How much a hazard stretches the ticks a metre costs; ward softens it, up to MAX_HAZARD_WARD percent. */
export function hazardFactor(hazard: Hazard | null, ward: number): number {
  if (hazard === null) return 1;
  return 1 + (HAZARD_SLOW[hazard] - 1) * (1 - Math.min(ward, MAX_HAZARD_WARD) / 100);
}
