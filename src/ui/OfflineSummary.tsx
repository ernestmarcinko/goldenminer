import { useRef } from 'react';
import type { FindKind, OfflineSummary as Summary } from '../core/types';
import { formatDuration, formatNumber, plural } from './format';
import { useDialog } from './useDialog';

const FIND_LABELS: Record<FindKind, [string, string]> = {
  chest: ['chest', 'chests'],
  map: ['map', 'maps'],
  gem: ['gem', 'gems'],
  goldVein: ['gold vein', 'gold veins'],
  diamondVein: ['diamond vein', 'diamond veins'],
  materialVein: ['material vein', 'material veins'],
};

/** The Souls and levels a run away gained, naming only the parts that aren't zero. */
export function soulsLine(souls: number, levels: number): string {
  const parts: string[] = [];
  if (souls > 0) parts.push(`+${formatNumber(souls)} Souls`);
  if (levels > 0) parts.push(`${plural(levels, 'level', 'levels')} gained`);
  return parts.join(' · ');
}

export function OfflineSummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: okRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const finds = (Object.keys(FIND_LABELS) as FindKind[]).filter((k) => (summary.finds[k] ?? 0) > 0);
  return (
    <div className="gm-overlay" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-offline-title">
        <h2 id="gm-offline-title" className="gm-dialog__title">
          While you were away ({formatDuration(summary.elapsedMs)}): dug {formatNumber(summary.metres)} m, +
          {formatNumber(summary.gold)} Gold, +{formatNumber(summary.diamonds)} Diamonds
        </h2>
        {summary.elapsedMs > summary.capMs && (
          <p>You were away longer than {formatDuration(summary.capMs)}, so only that much counted.</p>
        )}
        {(summary.items.kept > 0 || summary.items.sold > 0 || summary.items.salvaged > 0) && (
          <p>
            Items: {formatNumber(summary.items.kept)} kept · {formatNumber(summary.items.sold)} sold ·{' '}
            {formatNumber(summary.items.salvaged)} salvaged
          </p>
        )}
        {(summary.maps.cleared > 0 || summary.maps.lost > 0) && (
          <p>
            Maps: {formatNumber(summary.maps.cleared)} cleared · {formatNumber(summary.maps.lost)} lost
          </p>
        )}
        {(summary.souls > 0 || summary.levels > 0) && <p>{soulsLine(summary.souls, summary.levels)}</p>}
        {summary.bagStopped && <p>Digging stopped because your bag and the stash were full.</p>}
        {finds.length > 0 && (
          <ul className="gm-dialog__list">
            {finds.map((k) => (
              <li key={k}>
                {plural(summary.finds[k], ...FIND_LABELS[k])}
              </li>
            ))}
          </ul>
        )}
        <div className="gm-dialog__actions">
          <button type="button" ref={okRef} className="gm-btn gm-btn--primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
