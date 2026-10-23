import type { FeatureKind, OfflineSummary as Summary } from '../core/types';
import { formatDuration, formatNumber } from './format';
import { useDialog } from './useDialog';

const FIND_LABELS: Record<FeatureKind, string> = {
  chest: 'chests',
  map: 'maps',
  gem: 'gems',
  goldVein: 'gold veins',
  diamondVein: 'diamond veins',
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
        {finds.length > 0 && (
          <ul className="gm-dialog__list">
            {finds.map((k) => (
              <li key={k}>
                {formatNumber(summary.finds[k])} {FIND_LABELS[k]}
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
