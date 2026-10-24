import type { GameStore } from '../../store/gameStore';
import { formatRate, plural } from '../format';
import { useGame } from '../useGame';
import { FindsFeed } from './FindsFeed';
import { MineScene } from './MineScene';
import { Minimap } from './Minimap';
import './mine.css';

export function MineView({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const heldBag = state.overflow[0]?.bag;
  const inGallery = state.depth < state.deepest;
  const pct = Math.round(Math.min(1, Math.max(0, inGallery ? state.galleryProgress : state.progress)) * 100);
  return (
    <div className="gm-mine">
      {heldBag !== undefined && (
        <div role="status" className="gm-banner">
          Your {heldBag} bag and the stash are full, so digging has stopped. Sell or salvage something from the {heldBag} bag or the stash to carry on.
        </div>
      )}
      <div className="gm-mine__top">
        <section aria-label="The mine" className="gm-mine__scene">
          <MineScene store={store} />
          <div className="gm-mine__progress">
            <div className="gm-mine__progress-text gm-muted">
              <span>{inGallery ? 'Next gallery find' : 'Next metre'}</span>
              <span>Auto {formatRate(stats.autoTicksPerSecond)} tick/s · each click +{plural(stats.ticksPerClick, 'tick', 'ticks')}</span>
            </div>
            <div
              className="gm-bar"
              role="progressbar"
              aria-label={inGallery ? 'Progress to the next gallery find' : 'Progress to the next metre'}
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
