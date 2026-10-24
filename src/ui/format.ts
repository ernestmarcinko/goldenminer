const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  notation: 'standard',
});

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m`;
  return 'less than a minute';
}
