import type { GameStore } from '../../store/gameStore';
import { MATERIAL_LABELS } from '../../core/itemData';
import type { Material } from '../../core/items';
import type { FeatureKind, FindKind, FindRecord } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import type { SpriteName } from '../../sprites/atlas';
import { baseSprite, lootNoteText } from '../character/itemView';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { findMaterial } from './findMaterial';
import './mine.css';

const MAX_SHOWN = 6;

const ICONS: Record<FeatureKind, SpriteName> = {
  chest: 'chest', map: 'map', gem: 'gem', goldVein: 'coin', diamondVein: 'diamond',
};

// A material vein shows its material's sprite; every other find its kind's.
function icon(f: FindRecord): SpriteName {
  return f.kind === 'materialVein' ? baseSprite(findMaterial(f)) : ICONS[f.kind];
}

/** `material` is the vein's material, read only for a material vein. */
export function label(kind: FindKind, amount: number, bonus: boolean, material?: Material): string {
  const base = baseLabel(kind, amount, material);
  return bonus ? `${base} (bonus)` : base;
}

function baseLabel(kind: FindKind, amount: number, material: Material = 'copper'): string {
  switch (kind) {
    case 'chest': return 'Chest';
    case 'map': return 'Map';
    case 'gem': return 'Gem';
    case 'goldVein': return `Gold vein +${formatNumber(amount)}`;
    case 'diamondVein': return `Diamonds +${formatNumber(amount)}`;
    case 'materialVein': return `${MATERIAL_LABELS[material]} ×${formatNumber(amount)}`;
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
              <Sprite name={icon(f)} scale={2} />
              <span className="gm-finds__label">
                {label(f.kind, f.amount, f.bonus === true, f.material)}{f.loot && f.loot.length > 0 ? ':' : ''}
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
