import { describe, expect, it } from 'vitest';
import { MATERIAL_TABLE, MATERIAL_VEIN_CHANCE } from '../../src/core/balance';
import { MATERIALS } from '../../src/core/items';
import { hazardFactor, materialAmount, materialWeights, metreLayer, pickMaterial } from '../../src/core/layer';

describe('the seeded layer', () => {
  it('the layer is a pure function of seed and metre', () => {
    expect(metreLayer(77, 412)).toEqual(metreLayer(77, 412));
    const differs = Array.from({ length: 200 }, (_, m) => m + 1)
      .some((m) => JSON.stringify(metreLayer(1, m)) !== JSON.stringify(metreLayer(2, m)));
    expect(differs).toBe(true);
  });
  it('no material is found at or above its first depth', () => {
    for (let seed = 1; seed <= 20; seed++) for (let m = 1; m <= 1200; m++) {
      const v = metreLayer(seed, m).vein;
      if (v) expect(m).toBeGreaterThan(MATERIAL_TABLE[v.material].from);
    }
  });
  it('veins sit on about MATERIAL_VEIN_CHANCE of metres', () => {
    let n = 0;
    for (let m = 1; m <= 10_000; m++) if (metreLayer(9, m).vein) n++;
    expect(Math.abs(n / 10_000 - MATERIAL_VEIN_CHANCE)).toBeLessThan(0.02);
  });
  it('void crystals turn up below 1,000 m, and deeper favours them', () => {
    let found = false;
    for (let seed = 1; seed <= 50 && !found; seed++) for (let m = 1001; m <= 1600; m++) {
      if (metreLayer(seed, m).vein?.material === 'voidCrystal') { found = true; break; }
    }
    expect(found).toBe(true);
    const share = (m: number) => { const w = materialWeights(m); return w.voidCrystal / Object.values(w).reduce((a, b) => a + b, 0); };
    expect(share(1600)).toBeGreaterThan(share(1100));
    expect(materialWeights(1000).voidCrystal).toBe(0);
    expect(materialWeights(1).copper).toBeCloseTo(40.08);   // 40 × (1 + 1/500)
  });
  it('pickMaterial and materialAmount', () => {
    expect(pickMaterial(10, 0)).toBe('copper');
    expect(pickMaterial(10, 0.999)).toBe('tin');           // only copper and tin above 50 m
    for (const mat of MATERIALS) {
      const a = materialAmount(mat, 1500, 0.5);
      expect(Number.isInteger(a) && a >= 1).toBe(true);
    }
    expect(materialAmount('copper', 10, 0.5)).toBe(4);     // tier 1: 4 × (1 + 0) × 1.0
    expect(materialAmount('copper', 1100, 0.5)).toBe(8);   // tier 7: 4 × (1 + floor(7/4)) × 1.0
  });
  it('no hazards above Granite Veins; more of them deeper', () => {
    for (let seed = 1; seed <= 20; seed++) for (let m = 1; m <= 300; m++) expect(metreLayer(seed, m).hazard).toBeNull();
    const rate = (from: number) => { let n = 0; for (let m = from; m < from + 2000; m++) if (metreLayer(5, m).hazard) n++; return n / 2000; };
    expect(rate(301)).toBeLessThan(rate(5000));
  });
  it('hazardFactor', () => {
    expect(hazardFactor(null, 0)).toBe(1);
    expect(hazardFactor('gas', 0)).toBe(2);
    expect(hazardFactor('gas', 50)).toBe(1.5);
    expect(hazardFactor('unstable', 0)).toBeCloseTo(1.6);
    expect(hazardFactor('gas', 200)).toBe(1.25);            // ward capped at MAX_HAZARD_WARD
  });
});
