import { expect, it } from 'vitest';
import { bandAt, metreTier, tierAt, toRoman } from '../../src/core/bands';

it('named bands follow the mockup', () => {
  expect(bandAt(0)).toMatchObject({ name: 'Topsoil', tier: 1 });
  expect(bandAt(49.9).name).toBe('Topsoil');
  expect(bandAt(50)).toMatchObject({ name: 'Clay Beds', tier: 2 });
  expect(bandAt(339)).toMatchObject({ name: 'Granite Veins', start: 300, end: 450, tier: 4 });
  expect(bandAt(999).name).toBe('Obsidian Reach');
});

it('the abyss continues forever in 300 m bands', () => {
  expect(bandAt(1000)).toMatchObject({ name: 'The Abyss I', start: 1000, end: 1300, tier: 7 });
  expect(bandAt(1300)).toMatchObject({ name: 'The Abyss II', tier: 8 });
  expect(bandAt(4000)).toMatchObject({ name: 'The Abyss XI', tier: 17 });
  expect(tierAt(250_000)).toBe(6 + Math.floor((250_000 - 1000) / 300) + 1);
});

it('a metre belongs to the band at its top', () => {
  expect(metreTier(300)).toBe(3);
  expect(metreTier(301)).toBe(4);
  expect(toRoman(14)).toBe('XIV');
});

it('absurd depths stay quick and finite', () => {
  expect(toRoman(3999)).toBe('MMMCMXCIX');
  expect(toRoman(4000)).toBe('4000');
  for (const depth of [1e300, Infinity, Number.NaN]) {
    const band = bandAt(depth);
    expect(Number.isFinite(band.tier)).toBe(true);
  }
});
