import { expect, it } from 'vitest';
import { MINIMAP_METRES, followTop, isFollowing, minimapModel } from '../../src/ui/mine/minimap';
import { metreLayer } from '../../src/core/layer';
import { MATERIAL_LABELS } from '../../src/core/itemData';
import { newGame } from '../../src/core/newGame';
import type { MetreLayer } from '../../src/core/layer';

const PX = 6;

function at(deepest: number) {
  const s = newGame(1, 0);
  s.deepest = deepest;
  s.ahead = {};
  return s;
}

/** The first metre past `from` whose seeded layer passes `test`. */
function metreWhere(seed: number, from: number, test: (layer: MetreLayer) => boolean): number {
  for (let m = from; m < from + 5000; m++) if (test(metreLayer(seed, m))) return m;
  throw new Error('no such metre');
}

it('covers only the scrolled-to window, with absolute positions and the full scroll height', () => {
  const s = at(950);
  s.finds = [
    { id: 1, depth: 10, kind: 'map', amount: 0, tick: 1 },
    { id: 2, depth: 400, kind: 'chest', amount: 0, tick: 2 },
    { id: 3, depth: 900, kind: 'goldVein', amount: 20, tick: 3 },
  ];
  const m = minimapModel(s, 3, 380);
  expect(m.markers).toEqual([{ y: 402 * PX, kind: 'chest', count: 1, label: 'Chest', icon: 'chest' }]);
  expect(m.height).toBe((950 + 3 + 2) * PX);
  expect(m).toMatchObject({ top: 380, bottom: 380 + MINIMAP_METRES, youY: 950 * PX, fogY: 953 * PX });
  for (const t of m.ticks) {
    expect(t.depth).toBeGreaterThanOrEqual(370);
    expect(t.depth).toBeLessThanOrEqual(380 + MINIMAP_METRES + 10);
    expect(t.y).toBe(t.depth * PX);
  }
  expect(m.ticks.length).toBeGreaterThan(0);
  for (const b of m.bands) {
    expect(b.y).toBeGreaterThanOrEqual(370 * PX);
    expect(b.y + b.height).toBeLessThanOrEqual((380 + MINIMAP_METRES + 10) * PX);
  }
});

it('nearby finds share one marker, most important kind first', () => {
  const s = at(340);
  s.finds = [
    { id: 1, depth: 301, kind: 'chest', amount: 0, tick: 1 },
    { id: 2, depth: 302, kind: 'map', amount: 0, tick: 2 },
    { id: 3, depth: 330, kind: 'goldVein', amount: 20, tick: 3 },
  ];
  expect(minimapModel(s, 2, 290).markers).toEqual([
    { y: 302 * PX, kind: 'map', count: 2, label: 'Map T4 ×2', icon: 'map' },
    { y: 330 * PX, kind: 'goldVein', count: 1, label: 'Gold vein', icon: 'coin' },
  ]);
});

it('a material vein find is marked with its material', () => {
  const s = at(950);
  s.finds = [{ id: 1, depth: 412, kind: 'materialVein', amount: 3, tick: 1, material: 'copper' }];
  expect(minimapModel(s, 3, 380).markers).toEqual([
    { y: 414 * PX, kind: 'materialVein', count: 1, label: 'Copper ore', icon: 'copper' },
  ]);
});

it('lamp hints name a material vein, a hazard or harder rock where the roll holds no feature', () => {
  const s = at(1000);
  const vein = metreWhere(s.seed, 1001, (l) => l.vein !== null && l.hazard === null);
  const gas = metreWhere(s.seed, 1001, (l) => l.vein === null && l.hazard === 'gas');
  const unstable = metreWhere(s.seed, 1001, (l) => l.vein === null && l.hazard === 'unstable');
  const plain = metreWhere(s.seed, 1001, (l) => l.vein === null && l.hazard === null);
  const material = metreLayer(s.seed, vein).vein!.material;

  const hint = (metre: number, hardRock: boolean) => {
    const t = at(metre - 1);
    t.ahead = { [metre]: { feature: null, amount: 0, hardRock } };
    return minimapModel(t, 1, followTop(t.deepest)).ahead;
  };
  expect(hint(vein, false)).toEqual([
    { y: (vein - 0.5) * PX, kind: 'materialVein', label: MATERIAL_LABELS[material], icon: material },
  ]);
  expect(hint(gas, false)).toEqual([{ y: (gas - 0.5) * PX, kind: 'gas', label: 'gas pocket' }]);
  expect(hint(unstable, false)).toEqual([{ y: (unstable - 0.5) * PX, kind: 'unstable', label: 'unstable rock' }]);
  expect(hint(plain, true)).toEqual([{ y: (plain - 0.5) * PX, kind: 'hardRock', label: 'harder rock' }]);
  expect(hint(plain, false)).toEqual([]);
  // A hazard outranks harder rock, and a vein outranks both.
  expect(hint(gas, true)).toEqual([{ y: (gas - 0.5) * PX, kind: 'gas', label: 'gas pocket' }]);
  expect(hint(vein, true)[0]).toMatchObject({ kind: 'materialVein' });
});

it('a feature outranks every other hint in its metre', () => {
  const s = at(1000);
  const both = metreWhere(s.seed, 1001, (l) => l.vein !== null && l.hazard !== null);
  const t = at(both - 1);
  t.ahead = { [both]: { feature: 'chest', amount: 0, hardRock: true } };
  expect(minimapModel(t, 1, followTop(t.deepest)).ahead).toEqual([
    { y: (both - 0.5) * PX, kind: 'chest', label: 'Chest', icon: 'chest' },
  ]);
});

it('only metres within the current lamp sight are shown ahead', () => {
  const s = at(340);
  s.ahead = { 341: { feature: 'chest', amount: 0, hardRock: false }, 342: { feature: 'gem', amount: 0, hardRock: false } };
  expect(minimapModel(s, 1, 290).ahead).toEqual([{ y: 340.5 * PX, kind: 'chest', label: 'Chest', icon: 'chest' }]);
});

it('follows the dig face about 50 m down the window', () => {
  expect(followTop(30)).toBe(0);
  expect(followTop(950)).toBe(900);
});

it('is following while the dig face is in view', () => {
  expect(isFollowing(900 * PX, 950)).toBe(true);
  expect(isFollowing(0, 950)).toBe(false);
  expect(isFollowing((950 - MINIMAP_METRES) * PX, 950)).toBe(true);
  expect(isFollowing((951 - MINIMAP_METRES) * PX, 950)).toBe(true);
  expect(isFollowing(951 * PX, 950)).toBe(false);
  expect(isFollowing((949 - MINIMAP_METRES) * PX, 950)).toBe(false);
});
