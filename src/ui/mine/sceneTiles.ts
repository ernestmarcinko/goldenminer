export interface SceneTile { shade: string; edge: string; fleck: 'gold' | 'diamond' | null; shaft: boolean }

export const SCENE_COLS = 14;
export const SCENE_ROWS = 12;

type Palette = readonly [string, string, string, string];

const ABYSS_PALETTE: Palette = ['#1a1620', '#201a27', '#17131c', '#241d2c'];

const NAMED_PALETTES: readonly Palette[] = [
  ['#5a4030', '#4e3828', '#614634', '#553b2b'],
  ['#6b4a35', '#5c3f2d', '#734f39', '#63442f'],
  ['#6a5f4f', '#5e5446', '#716553', '#665b4a'],
  ['#4a4550', '#524c59', '#433e49', '#5a5462'],
  ['#2c2832', '#332e3a', '#28242d', '#38323f'],
  ['#1f1b24', '#241f2a', '#1b1820', '#2a2430'],
];

export function bandPalette(tier: number): [string, string, string, string] {
  const palette = NAMED_PALETTES[Math.max(Math.floor(tier), 1) - 1] ?? ABYSS_PALETTE;
  return [palette[0], palette[1], palette[2], palette[3]];
}

export function sceneTiles(tier: number): SceneTile[] {
  const palette = bandPalette(tier);
  const tiles: SceneTile[] = [];
  for (let r = 0; r < SCENE_ROWS; r++) {
    for (let c = 0; c < SCENE_COLS; c++) {
      const shaft = c >= 5 && c <= 8 && r <= 8;
      if (shaft) {
        tiles.push({ shade: r % 2 === 0 ? '#1d191f' : '#1a171c', edge: '#141116', fleck: null, shaft });
        continue;
      }
      const gold = (r * 3 + c * 5) % 17 === 0 || (r >= 9 && (r + c * 2) % 7 === 0);
      const diamond = !gold && ((r * 5 + c * 3) % 23 === 0 || (r === 10 && c === 8));
      tiles.push({
        shade: palette[(r * 7 + c * 13 + ((r * c) % 5)) % 4] ?? palette[0],
        edge: 'rgba(0, 0, 0, 0.25)',
        fleck: gold ? 'gold' : diamond ? 'diamond' : null,
        shaft,
      });
    }
  }
  return tiles;
}
