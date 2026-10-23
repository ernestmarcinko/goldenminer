import { expect, it } from 'vitest';
import { depthAtY, minimapModel } from '../../src/ui/mine/minimap';
import { newGame } from '../../src/core/newGame';

function at(depth: number, deepest = depth) {
  const s = newGame(1, 0);
  s.depth = depth; s.deepest = deepest;
  s.ahead = { [deepest + 1]: { feature: 'chest', amount: 0, hardRock: false }, [deepest + 2]: { feature: null, amount: 0, hardRock: true } };
  return s;
}

it('the window keeps the miner about 57% down', () => {
  expect(minimapModel(at(20), 2).top).toBe(0);
  const m = minimapModel(at(340), 2);
  expect(m).toMatchObject({ top: 290, bottom: 378, youY: 300, fogY: 312 });
});

it('nearby finds share one marker, most important kind first', () => {
  const s = at(340);
  s.finds = [
    { depth: 301, kind: 'chest', amount: 0, tick: 1 },
    { depth: 302, kind: 'map', amount: 0, tick: 2 },
    { depth: 330, kind: 'goldVein', amount: 20, tick: 3 },
    { depth: 10, kind: 'map', amount: 0, tick: 4 },
  ];
  const { markers } = minimapModel(s, 2);
  expect(markers).toEqual([
    { y: (302 - 290) * 6, kind: 'map', count: 2, label: 'Map T4 ×2' },
    { y: (330 - 290) * 6, kind: 'goldVein', count: 1, label: 'Gold vein' },
  ]);
});

it('shows what the lamp reveals ahead', () => {
  const { ahead } = minimapModel(at(340), 2);
  expect(ahead).toEqual([{ y: (340.5 - 290) * 6, kind: 'chest' }, { y: (341.5 - 290) * 6, kind: 'hardRock' }]);
});

it('a tap maps to an explored depth only', () => {
  const m = minimapModel(at(300, 340), 2);
  expect(depthAtY(m, 0, 340)).toBe(250);
  expect(depthAtY(m, 527, 340)).toBe(338);
  expect(depthAtY(minimapModel(at(340), 2), 520, 340)).toBe(340);
});
