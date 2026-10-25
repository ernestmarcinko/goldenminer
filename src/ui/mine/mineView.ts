import { digSpeed } from '../../core/dig';
import { hazardFactor } from '../../core/layer';
import type { GameState, Hazard, Stats } from '../../core/types';
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

export type DigStatusKind = 'run' | 'paused' | 'bagFull' | 'digging';

/** The Mine view's one status line: a map run, then the player's Pause, then a full bag, else the dig speed. */
export function digStatus(state: GameState, stats: Stats): { kind: DigStatusKind; text: string } {
  if (state.activity.kind === 'map') return { kind: 'run', text: 'Paused while the map runs.' };
  if (state.paused) return { kind: 'paused', text: 'Paused. Press Continue digging to dig on.' };
  if (state.overflow.length > 0) return { kind: 'bagFull', text: 'Your bag is full. Make room to dig on.' };
  return { kind: 'digging', text: speedText(digSpeed(state, stats)) };
}

export function pauseLabel(paused: boolean): string {
  return paused ? 'Continue digging' : 'Pause digging';
}
