export function mulberry32(state: number): { value: number; state: number } {
  const a = (state + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}

export function hash2(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n, 0x9E3779B1)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function nextRandom(s: { rng: number }): number {
  const r = mulberry32(s.rng);
  s.rng = r.state;
  return r.value;
}

export function pickWeighted<T>(s: { rng: number }, entries: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of entries) total += w;
  const pick = nextRandom(s) * total;
  let cumulative = 0;
  for (const [value, w] of entries) {
    cumulative += w;
    if (pick < cumulative) return value;
  }
  const last = entries[entries.length - 1];
  if (last === undefined) throw new Error('pickWeighted needs at least one entry');
  return last[0];
}
