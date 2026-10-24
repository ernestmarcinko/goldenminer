import { expect, it } from 'vitest';
import { MATERIAL_LABELS } from '../../src/core/itemData';
import { metreLayer } from '../../src/core/layer';
import { newGame } from '../../src/core/newGame';
import { MINER_ROW, SHAFT_ROWS, shaftModel, shaftShift } from '../../src/ui/mine/shaftModel';

it('a new game: surface above, the face below the miner, 3 lit metres', () => {
  const s = newGame(1, 0);
  const { top, rows } = shaftModel(s, 3);
  expect([top, rows.length]).toEqual([-MINER_ROW, SHAFT_ROWS]);
  expect(rows.slice(0, MINER_ROW + 1).every((r) => r.cell === 'surface')).toBe(true);
  expect(rows[MINER_ROW + 1]).toMatchObject({ metre: 1, cell: 'face' });
  expect(rows[MINER_ROW + 2]).toMatchObject({ metre: 2, cell: 'lit', feature: 'map', label: '+2 m: Map' });
  expect(rows[MINER_ROW + 3]).toMatchObject({ metre: 3, cell: 'lit' });
  expect(rows[MINER_ROW + 4]).toMatchObject({ metre: 4, cell: 'dark', label: null });
  expect(rows[MINER_ROW + 1]?.left).toHaveLength(4);
});

it('deeper down', () => {
  const s = newGame(1, 0);
  s.deepest = 40;
  s.ahead = { 41: { feature: null, amount: 0, hardRock: true }, 42: { feature: 'chest', amount: 0, hardRock: false }, 43: { feature: null, amount: 0, hardRock: false } };
  const face = shaftModel(s, 3);
  expect(face.top).toBe(40 - MINER_ROW);
  expect(face.rows.map((r) => r.label).filter(Boolean)).toEqual(['+1 m: harder rock', '+2 m: Chest']);
  expect(face.rows.find((r) => r.metre === 38)?.cell).toBe('dug');
});

it('the shaft moves once per change, however many metres', () => {
  expect(shaftShift(10, 11, 'step', 0)).toEqual({ fromPx: 56, toPx: 0, animate: true });
  expect(shaftShift(10, 13, 'step', 0)).toEqual({ fromPx: 168, toPx: 0, animate: true });
  expect(shaftShift(10, 400, 'step', 0)).toEqual({ fromPx: 0, toPx: 0, animate: false });
  expect(shaftShift(10, 10, 'smooth', 0.5)).toEqual({ fromPx: -28, toPx: -28, animate: false });
  expect(shaftShift(10, 11, 'off', 0.5)).toEqual({ fromPx: 0, toPx: 0, animate: false });
});

it('a material vein ahead is lit on a metre whose roll holds no feature', () => {
  const s = newGame(11, 0);
  let m = 10;
  while (metreLayer(11, m).vein === null || metreLayer(11, m + 1).vein === null) m++;
  const vein = metreLayer(11, m).vein!;
  s.deepest = m - 2;
  s.ahead = {
    [m - 1]: { feature: null, amount: 0, hardRock: true }, [m]: { feature: null, amount: 0, hardRock: false },
    [m + 1]: { feature: 'chest', amount: 0, hardRock: false },
  };
  const rows = shaftModel(s, 3).rows;
  expect(rows.find((r) => r.metre === m)).toMatchObject({ feature: null, material: vein.material, label: `+2 m: ${MATERIAL_LABELS[vein.material]}` });
  expect(rows.find((r) => r.metre === m + 1)).toMatchObject({ feature: 'chest', material: null, label: '+3 m: Chest' });
});
