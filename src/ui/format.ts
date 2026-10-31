const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  notation: 'standard',
});

// A million and more reads compact: three significant digits and the unit's suffix (4.60M, 12.3B, 1.00T).
const UNITS: readonly (readonly [number, string])[] = [[1e6, 'M'], [1e9, 'B'], [1e12, 'T']];

export function formatNumber(n: number): string {
  // compared on the rounded value: 999,999.5 prints as a million, so it reads as one
  const abs = Math.round(Math.abs(n));
  if (!Number.isFinite(n) || abs < 1e6) return numberFormat.format(n);
  const sign = n < 0 ? '-' : '';
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, suffix] = UNITS[i] ?? [1, ''];
    if (abs < unit) continue;
    const value = Number((abs / unit).toPrecision(3));
    const next = UNITS[i + 1];
    // 999.9M rounds to 1000M, which is the next unit's 1.00
    if (value >= 1000 && next !== undefined) return `${sign}${(value / 1000).toFixed(2)}${next[1]}`;
    if (value >= 1000) return `${sign}${numberFormat.format(abs / unit)}${suffix}`;
    return `${sign}${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)}${suffix}`;
  }
  return numberFormat.format(n);
}

const rateFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatRate(n: number): string {
  return rateFormat.format(n);
}

const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Short counts for item cells ("1.2K", "1M"); every other number goes through `formatNumber`. */
export function formatCompact(n: number): string {
  return compactFormat.format(n);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** A countdown, rounded up: "42 s", "2 min 5 s", "1 h 2 min". */
export function formatEta(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  if (total < 60) return `${total} s`;
  if (total < 3600) {
    const s = total % 60;
    return s === 0 ? `${Math.floor(total / 60)} min` : `${Math.floor(total / 60)} min ${s} s`;
  }
  return `${Math.floor(total / 3600)} h ${Math.floor((total % 3600) / 60)} min`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m`;
  return 'less than a minute';
}
