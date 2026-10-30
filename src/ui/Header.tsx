import { LEVEL_CAP } from '../core/balance';
import { pointsToSpend } from '../core/passives';
import type { GameStore } from '../store/gameStore';
import { Sprite } from '../sprites/Sprite';
import { formatNumber, plural } from './format';
import { xpBar } from './run/runView';
import { useGame } from './useGame';
import './mine/mine.css';

export function Header({ store, onOpenSettings, onOpenTest }: { store: GameStore; onOpenSettings: () => void; onOpenTest?: () => void }) {
  const { state } = useGame(store);
  const bar = xpBar(state.level, state.xp);
  const run = state.activity.kind === 'map' ? state.activity.run : null;
  const points = pointsToSpend(state);
  const pointsText = points === 0 ? 'No points to spend' : `${plural(points, 'point', 'points')} to spend`;
  return (
    <header className="gm-header">
      <div className="gm-header__title">
        <span className="gm-header__title-name">{state.characterName}</span>
        <span className="gm-header__title-game">The Golden Minder</span>
      </div>
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
        <div className="gm-pill">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 14 C4 14 3 10 5 7 C6 9 7 9 7 9 C6 6 8 3 10 2 C10 5 13 7 13 10 C13 12.5 11 14 8 14 Z"
              fill="none" stroke="var(--gm-soul)" strokeWidth="1.8" strokeLinejoin="round"
            />
          </svg>
          <span className="gm-pill__value gm-pill__value--soul">{formatNumber(state.souls)}</span>
          <span className="gm-muted">Souls</span>
        </div>
      </div>
      <div className="gm-header__level">
        <div className="gm-header__level-text">
          <span><strong>{bar.label}</strong> <span className="gm-muted">/ {formatNumber(LEVEL_CAP)}</span></span>
          <span className="gm-muted">{run === null ? pointsText : `+${formatNumber(run.gained.xp)} XP this run`}</span>
        </div>
        <div
          className="gm-header__xpbar"
          role="progressbar"
          aria-label="Experience toward the next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(bar.pct * 100)}
        >
          <div className="gm-header__xpfill" style={{ width: `${bar.pct * 100}%` }} />
        </div>
      </div>
      <div className="gm-header__depth">
        {run !== null && <div className="gm-muted gm-header__paused">Digging paused while in a map</div>}
        <div className="gm-header__depth-now">{formatNumber(state.deepest)} m</div>
      </div>
      <a
        className="gm-header__wiki"
        href="https://github.com/ernestmarcinko/goldenminer"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source
      </a>
      <a className="gm-header__wiki" href="./wiki.html">
        Wiki
      </a>
      {import.meta.env.DEV && onOpenTest !== undefined && (
        <button type="button" className="gm-header__settings" onClick={onOpenTest}>
          Test
        </button>
      )}
      <button type="button" className="gm-header__settings" onClick={onOpenSettings}>
        Settings
      </button>
    </header>
  );
}
