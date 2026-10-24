import type { GameStore } from '../store/gameStore';
import { Sprite } from '../sprites/Sprite';
import { formatNumber } from './format';
import { useGame } from './useGame';
import './mine/mine.css';

export function Header({ store, onOpenSettings }: { store: GameStore; onOpenSettings: () => void }) {
  const { state } = useGame(store);
  return (
    <header className="gm-header">
      <div className="gm-header__title">Golden Miner</div>
      <div className="gm-header__pills">
        <div className="gm-pill">
          <Sprite name="coin" scale={2} />
          <span className="gm-pill__value gm-pill__value--gold">{formatNumber(state.gold)}</span>
          <span className="gm-muted">Gold</span>
        </div>
        <div className="gm-pill">
          <Sprite name="diamond" scale={2} />
          <span className="gm-pill__value gm-pill__value--diamond">{formatNumber(state.diamonds)}</span>
          <span className="gm-muted">Diamonds</span>
        </div>
      </div>
      <div className="gm-header__depth">
        <div className="gm-header__depth-now">{formatNumber(state.depth)} m</div>
        <div className="gm-muted gm-small">deepest {formatNumber(state.deepest)} m</div>
      </div>
      <button type="button" className="gm-header__settings" onClick={onOpenSettings}>
        Settings
      </button>
    </header>
  );
}
