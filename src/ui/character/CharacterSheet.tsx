import { deriveCharacterSheet } from '../../core/stats';
import type { SheetRow } from '../../core/stats';
import type { GameState } from '../../core/types';
import { formatDuration, formatNumber, formatRate } from '../format';

/** A sheet row's value, in its own unit, reusing the shared number formatters. */
function rowText(r: SheetRow): string {
  switch (r.format) {
    case 'number': return formatNumber(r.value);
    case 'rate': return formatRate(r.value);
    case 'percent': return `${formatRate(r.value)}%`;
    case 'multiplier': return `×${formatRate(r.value)}`;
    case 'perSecond': return `${formatRate(r.value)}/s`;
    case 'mPerMin': return `${formatRate(r.value)} m/min`;
    case 'durationMs': return formatDuration(r.value);
    case 'range': return `${formatNumber(r.value)}–${formatNumber(r.value2 ?? r.value)}`;
  }
}

type SheetHalf = 'mining' | 'battle' | 'both';

/**
 * The character sheet, drawn from `deriveCharacterSheet` so it can never disagree with what a tick uses. `half` picks
 * the mining half, the battle half, or both (mining first).
 */
export function CharacterSheet({ state, half }: { state: GameState; half: SheetHalf }) {
  const sheet = deriveCharacterSheet(state);
  const halves: readonly (readonly [string, readonly SheetRow[]])[] = half === 'both'
    ? [['Mining', sheet.mining], ['Battle', sheet.battle]]
    : half === 'mining' ? [['Mining', sheet.mining]] : [['Battle', sheet.battle]];
  return (
    <div className="gm-sheet">
      {halves.map(([title, rows]) => (
        <section key={title} className="gm-sheet__half" aria-label={title}>
          {half === 'both' && <h3 className="gm-sheet__title">{title}</h3>}
          <dl className="gm-sheet__rows">
            {rows.map((r) => (
              <div key={r.label} className="gm-sheet__row">
                <dt className="gm-sheet__label">{r.label}</dt>
                <dd className="gm-sheet__value">{rowText(r)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
