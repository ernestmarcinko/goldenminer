import type { GameStore } from '../../store/gameStore';
import { bandAt } from '../../core/bands';
import { bandTitle, worldOf } from '../../core/mineLook';
import { formatNumber, formatRate, plural } from '../format';
import { useGame } from '../useGame';
import { FindsFeed } from './FindsFeed';
import { Minimap } from './Minimap';
import { ShaftScene } from './ShaftScene';
import './mine.css';

export function MineView({ store, onBackToMap }: { store: GameStore; onBackToMap: () => void }) {
  const { state, stats } = useGame(store);
  const band = bandAt(state.deepest);
  const pct = Math.round(Math.min(1, Math.max(0, state.progress)) * 100);
  return (
    <div className="gm-mine">
      {state.activity.kind === 'map' && (
        <div role="status" className="gm-banner gm-banner--run">
          <span>Digging is paused while you're in a map.</span>
          <button type="button" className="gm-btn" onClick={onBackToMap}>Back to the map</button>
        </div>
      )}
      {state.overflow.length > 0 && (
        <div role="status" className="gm-banner">
          Your bag and the stash are full, so digging has stopped. Sell or salvage something to carry on.
        </div>
      )}
      <div className="gm-mine__top">
        <section aria-label="The mine" className="gm-mine__scene">
          <div className="gm-mine__caption">
            <span className="gm-mine__band">{bandTitle(worldOf(state), band)}</span>
            <span className="gm-muted">
              {`Dig face at ${formatNumber(state.deepest)} m · tier ${formatNumber(band.tier)}`}
            </span>
          </div>
          <ShaftScene store={store} />
          <div className="gm-mine__progress">
            <div className="gm-mine__progress-text gm-muted">
              <span>Next metre</span>
              <span>Auto {formatRate(stats.autoTicksPerSecond)} tick/s · each click +{plural(stats.ticksPerClick, 'tick', 'ticks')}</span>
            </div>
            <div
              className="gm-bar"
              role="progressbar"
              aria-label="Progress to the next metre"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="gm-bar__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </section>
        <div className="gm-mine__minimap-slot">
          <Minimap store={store} />
        </div>
      </div>
      <FindsFeed store={store} />
    </div>
  );
}
