import { expect, it } from 'vitest';
import { hash2, mulberry32 } from '../../src/core/rng';

it('mulberry32 matches the reference sequence', () => {
  let s = 1;
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { const r = mulberry32(s); v.push(r.value); s = r.state; }
  expect(v).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  expect(s).toBe(1199730144);
});

it('hash2 is a stable uint32 mix', () => {
  expect(hash2(1, 1)).toBe(2980047484);
  expect(hash2(1, 2)).toBe(232174035);
  expect(hash2(42, 340)).toBe(1463892797);
});
