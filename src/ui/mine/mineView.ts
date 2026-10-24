import { hazardFactor } from '../../core/layer';
import type { Hazard } from '../../core/types';
import { formatEta, formatNumber, formatRate } from '../format';

export function speedText(speed: { metresPerMinute: number; secondsToNext: number } | null): string {
  if (speed === null) return 'Digging paused';
  const rate = speed.metresPerMinute >= 0.1
    ? `${formatRate(speed.metresPerMinute)} m/min`
    : `${formatNumber(Math.round(1 / speed.metresPerMinute))} min per metre`;
  return `${rate} · next metre in ${formatEta(speed.secondsToNext)}`;
}

const HAZARD_NAMES: Readonly<Record<Hazard, string>> = { gas: 'Gas pocket', unstable: 'Unstable rock' };

export function hazardText(hazard: Hazard | null, ward: number): string | null {
  if (hazard === null) return null;
  const wardNote = ward > 0 ? ` (hazard ward ${formatNumber(ward)} %)` : '';
  return `${HAZARD_NAMES[hazard]}: digging here takes ${formatRate(hazardFactor(hazard, ward))}× as long${wardNote}`;
}
