import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { MINER_ROW, SHAFT_ROWS, shaftModel, shaftShift } from '../../src/ui/mine/shaftModel';

it('a new game: surface above, the face below the miner, 3 lit metres', () => {
  const s = newGame(1, 0);
  const { top, rows, gallery } = shaftModel(s, 3);
  expect([top, rows.length, gallery]).toEqual([-MINER_ROW, SHAFT_ROWS, false]);
  expect(rows.slice(0, MINER_ROW + 1).every((r) => r.cell === 'surface')).toBe(true);
  expect(rows[MINER_ROW + 1]).toMatchObject({ metre: 1, cell: 'face' });
  expect(rows[MINER_ROW + 2]).toMatchObject({ metre: 2, cell: 'lit', feature: 'map', label: '+2 m: Map' });
  expect(rows[MINER_ROW + 3]).toMatchObject({ metre: 3, cell: 'lit' });
  expect(rows[MINER_ROW + 4]).toMatchObject({ metre: 4, cell: 'dark', label: null });
  expect(rows[MINER_ROW + 1]?.left).toHaveLength(4);
});

it('deeper down, and in a side gallery', () => {
  const s = newGame(1, 0);
  s.depth = 40; s.deepest = 40;
  s.ahead = { 41: { feature: null, amount: 0, hardRock: true }, 42: { feature: 'chest', amount: 0, hardRock: false }, 43: { feature: null, amount: 0, hardRock: false } };
  const face = shaftModel(s, 3);
  expect(face.rows.map((r) => r.label).filter(Boolean)).toEqual(['+1 m: harder rock', '+2 m: Chest']);
  s.depth = 30;
  const g = shaftModel(s, 3);
  expect(g.gallery).toBe(true);
  expect(g.rows.find((r) => r.metre === 30)?.tunnel).toBe(true);
  expect(g.rows.every((r) => r.label === null)).toBe(true);
  expect(g.rows.find((r) => r.metre === 38)?.cell).toBe('dug');
});

it('the shaft moves once per change, however many metres', () => {
  expect(shaftShift(10, 11, 'step', 0)).toEqual({ fromPx: 56, toPx: 0, animate: true });
  expect(shaftShift(10, 13, 'step', 0)).toEqual({ fromPx: 168, toPx: 0, animate: true });
  expect(shaftShift(10, 400, 'step', 0)).toEqual({ fromPx: 0, toPx: 0, animate: false });
  expect(shaftShift(10, 10, 'smooth', 0.5)).toEqual({ fromPx: -28, toPx: -28, animate: false });
  expect(shaftShift(10, 11, 'off', 0.5)).toEqual({ fromPx: 0, toPx: 0, animate: false });
});
