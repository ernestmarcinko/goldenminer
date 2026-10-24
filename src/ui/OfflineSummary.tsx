import type { FeatureKind, OfflineSummary as Summary } from '../core/types';
import { formatDuration, formatNumber, plural } from './format';
import { useDialog } from './useDialog';

const FIND_LABELS: Record<FeatureKind, [string, string]> = {
  chest: ['chest', 'chests'],
  map: ['map', 'maps'],
  gem: ['gem', 'gems'],
  goldVein: ['gold vein', 'gold veins'],
  diamondVein: ['diamond vein', 'diamond veins'],
};

export function OfflineSummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const okRef = useDialog<HTMLButtonElement>(onClose);
  const finds = (Object.keys(FIND_LABELS) as FeatureKind[]).filter((k) => (summary.finds[k] ?? 0) > 0);
  return (
    <div className="gm-overlay">
      <div className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-offline-title">
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
        {summary.stoppedBag !== null && <p>Digging stopped because your {summary.stoppedBag} bag and the stash were full.</p>}
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
