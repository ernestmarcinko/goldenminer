import { expect, it } from 'vitest';
import { bandPalette, sceneTiles } from '../../src/ui/mine/sceneTiles';

it('builds the 14×12 shaft cutaway in the band colours', () => {
  const tiles = sceneTiles(4);
  expect(tiles).toHaveLength(168);
  const at = (r: number, c: number) => tiles[r * 14 + c]!;
  expect(at(0, 5).shaft).toBe(true); expect(at(8, 8).shaft).toBe(true);
  expect(at(9, 6).shaft).toBe(false); expect(at(3, 4).shaft).toBe(false);
  const granite = bandPalette(4);
  for (const t of tiles) if (!t.shaft) expect(granite).toContain(t.shade);
  expect(sceneTiles(4)).toEqual(tiles);
  expect(bandPalette(7)).toEqual(bandPalette(30));
});
