export interface Band {
  name: string;
  start: number;
  end: number;
  tier: number;
}

const NAMED_BANDS: readonly Band[] = [
  { name: 'Topsoil', start: 0, end: 50, tier: 1 },
  { name: 'Clay Beds', start: 50, end: 150, tier: 2 },
  { name: 'Limestone', start: 150, end: 300, tier: 3 },
  { name: 'Granite Veins', start: 300, end: 450, tier: 4 },
  { name: 'Basalt Deep', start: 450, end: 700, tier: 5 },
  { name: 'Obsidian Reach', start: 700, end: 1000, tier: 6 },
];

export const ABYSS_START = 1000;
export const ABYSS_BAND_HEIGHT = 300;
const ABYSS_BASE_TIER = 6;

const ROMAN: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  if (n > 3999) return String(Math.floor(n));
  let rest = Math.floor(n);
  let out = '';
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export function bandAt(depth: number): Band {
  const d = Number.isNaN(depth) ? 0 : Math.min(Math.max(0, depth), Number.MAX_SAFE_INTEGER);
  if (d < ABYSS_START) {
    for (const band of NAMED_BANDS) {
      if (d < band.end) return band;
    }
  }
  const k = Math.floor((d - ABYSS_START) / ABYSS_BAND_HEIGHT) + 1;
  const start = ABYSS_START + ABYSS_BAND_HEIGHT * (k - 1);
  return {
    name: `The Abyss ${toRoman(k)}`,
    start,
    end: start + ABYSS_BAND_HEIGHT,
    tier: ABYSS_BASE_TIER + k,
  };
}

export function tierAt(depth: number): number {
  return bandAt(depth).tier;
}

export function metreTier(metre: number): number {
  return tierAt(metre - 1);
}
