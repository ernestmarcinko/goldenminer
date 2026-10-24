const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  notation: 'standard',
});

export function formatNumber(n: number): string {
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
