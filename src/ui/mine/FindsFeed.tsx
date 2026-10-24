import type { GameStore } from '../../store/gameStore';
import type { FeatureKind } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import type { SpriteName } from '../../sprites/atlas';
import { lootNoteText } from '../character/itemView';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import './mine.css';

const MAX_SHOWN = 6;

const ICONS: Record<FeatureKind, SpriteName> = {
  chest: 'chest', map: 'map', gem: 'gem', goldVein: 'coin', diamondVein: 'diamond',
};

function label(kind: FeatureKind, amount: number): string {
  switch (kind) {
    case 'chest': return 'Chest';
    case 'map': return 'Map';
    case 'gem': return 'Gem';
    case 'goldVein': return `Gold vein +${formatNumber(amount)}`;
    case 'diamondVein': return `Diamonds +${formatNumber(amount)}`;
  }
}

export function FindsFeed({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const shown = state.finds.slice(-MAX_SHOWN).reverse();
  return (
    <section aria-label="Finds" className="gm-finds">
      <h2 className="gm-finds__title">Latest finds</h2>
      {shown.length === 0 ? (
        <p className="gm-muted gm-finds__empty">Nothing found yet — keep digging.</p>
      ) : (
        <ul className="gm-finds__list">
          {shown.map((f) => (
            <li key={f.id} className="gm-finds__item">
              <Sprite name={ICONS[f.kind]} scale={2} />
              <span className="gm-finds__label">
                {label(f.kind, f.amount)}{f.loot && f.loot.length > 0 ? ':' : ''}
                {f.loot?.map((n, i) => (
                  <span key={i}>
                    {' '}
                    <span className="gm-finds__note" data-rarity={n.rarity}>{n.name}</span>
                    {' '}
                    <span className="gm-muted">({lootNoteText(n)})</span>
                  </span>
                ))}
              </span>
              <span className="gm-muted gm-small">at {formatNumber(f.depth)} m</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
