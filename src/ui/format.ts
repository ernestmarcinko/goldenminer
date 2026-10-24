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

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m`;
  return 'less than a minute';
}
