import { useRef, useState } from 'react';
import { autoMapMaxTier, autoMapQueueSize, autoMapping, nextEligibleAutoMap } from '../../core/autoMap';
import { itemAt } from '../../core/cells';
import type { GameStore } from '../../store/gameStore';
import { ItemGrid } from '../character/ItemGrid';
import type { ItemHandlers } from '../character/ItemGrid';
import type { ItemTarget } from '../character/itemActions';
import { mapTierCaption, mapTierCells, mapTiers, pickTier } from '../character/stashView';
import type { ClickIntent } from '../character/itemView';
import { useItemDrag } from '../character/useItemDrag';
import { useItemInteractions } from '../character/useItemInteractions';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import '../character/character.css';
import './battle.css';

/**
 * The Battle menu: two map inventories side by side — the auto-map queue (a fixed grid of slots) and the whole map
 * stash (tiered, like the inventory). Both are hoverable grids. Shift+click a map, or drag it, to move it between the
 * stash and the queue; click or right-click it for its actions. The start/stop button turns auto-mapping on and off:
 * while it is on, queued maps run back-to-back — live and while away — until the queue is empty or the player stops.
 */
export function BattleView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const queueRef = useRef<HTMLHeadingElement>(null);
  const drag = useItemDrag({ store, onResult: (text) => say(text) });
  const { handlers, say, cards, tapCard } = useItemInteractions({ store, state, fallbackRef: queueRef, drag });
  const [wantedTier, setWantedTier] = useState<number | null>(null);

  const queueSize = autoMapQueueSize(state);
  const enabled = autoMapping(state);
  const battleRunning = state.activity.kind === 'map';
  const tiers = mapTiers(state);
  const shownTier = pickTier(tiers.map((t) => t.tier), wantedTier);
  const stash = shownTier === null ? [] : mapTierCells(state, shownTier);
  const canStart = enabled && !state.autoMap.on && !battleRunning && nextEligibleAutoMap(state) !== undefined;

  // Shift+click moves a map between the stash and the queue; every other click keeps the normal behaviour.
  const battleHandlers: ItemHandlers = {
    ...handlers,
    onPick: (target: ItemTarget, intent: ClickIntent, el: HTMLElement) => {
      if (intent === 'move' && target.where !== 'stock') {
        const item = itemAt(state, target);
        if (item?.type === 'map') {
          if (target.where === 'queue') store.unqueueForAutoMap(item.id);
          else store.queueForAutoMap(item.id);
          return;
        }
      }
      handlers.onPick(target, intent, el);
    },
  };

  return (
    <div className="gm-battle">
      <div className="gm-battle__head">
        <h2 className="gm-battle__title">Battle</h2>
        <div className="gm-battle__actions">
          <button
            type="button"
            className="gm-btn gm-battle__start"
            disabled={!canStart}
            aria-disabled={!canStart || undefined}
            title={canStart ? undefined
              : !enabled ? 'Allocate Surveyor in the Skills tree first'
                : state.autoMap.on ? 'Auto-mapping is running'
                  : battleRunning ? 'A map is running'
                    : 'Queue a map first'}
            onClick={() => store.startAutoMap()}
          >
            Start auto-map
          </button>
          {state.autoMap.on && (
            <button type="button" className="gm-btn" onClick={() => store.setAutoMap(false)}>
              {battleRunning ? 'Stop after this map' : 'Stop auto-map'}
            </button>
          )}
        </div>
      </div>

      {!enabled && (
        <p className="gm-muted gm-small">
          Auto-mapping is locked. Allocate the Surveyor notable in the Skills tree to queue maps and run them automatically.
        </p>
      )}

      <div className="gm-battle__columns">
        <section className="gm-battle__card" aria-label="Auto-map queue">
          <div className="gm-battle__head">
            <h3 ref={queueRef} tabIndex={-1} className="gm-battle__name">
              Auto-map queue <span className="gm-muted">{formatNumber(state.autoMap.queue.length)} / {formatNumber(queueSize)}</span>
            </h3>
            <span className="gm-muted gm-small">Up to tier {formatNumber(autoMapMaxTier(state))}</span>
          </div>
          <p className="gm-muted gm-small">
            Shift+click or drag maps here to queue them. With auto-map on, they run one after another until the queue is empty.
          </p>
          <div className={`gm-battle__queue${enabled ? '' : ' gm-battle__queue--locked'}`} aria-disabled={enabled ? undefined : true}>
            <ItemGrid
              items={state.autoMap.queue}
              capacity={queueSize}
              targetOf={(index) => ({ where: 'queue', index })}
              handlers={battleHandlers}
            />
            {!enabled && <div className="gm-battle__lock">Allocate Surveyor to queue maps</div>}
          </div>
        </section>

        <section className="gm-battle__card" aria-label="Your maps">
          <div className="gm-battle__head">
            <h3 className="gm-battle__name">Your maps</h3>
            <span className="gm-muted gm-small">{formatNumber(state.autoMap.queue.length + stashTotal(state))} in all</span>
          </div>
          <p className="gm-muted gm-small">
            Right-click a map and choose “Run this map” to run it manually, or drag it into the queue to auto-map it.
          </p>
          {tiers.length > 0 && (
            <div className="gm-stash__pages" role="group" aria-label="Map tiers">
              {tiers.map((t) => (
                <button
                  key={t.tier}
                  type="button"
                  className="gm-stash__page"
                  aria-pressed={t.tier === shownTier}
                  onClick={() => setWantedTier(t.tier)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {stash.length === 0 ? (
            <p className="gm-muted gm-small">No maps in the stash. Dig or clear maps to find some.</p>
          ) : (
            <ItemGrid
              items={stash.map((c) => c.item)}
              capacity={stash.length}
              targetOf={(index) => stash[index]?.loc ?? { where: 'maps', tier: shownTier ?? 1, index }}
              handlers={battleHandlers}
              emptyTarget={{ where: 'stashTab', tab: 'maps' }}
            />
          )}
          {shownTier !== null && (
            <div className="gm-muted gm-small">{mapTierCaption(shownTier, stash.length)}</div>
          )}
        </section>
      </div>

      {tapCard}
      {cards}
    </div>
  );
}

/** Every map in the stash, across all tiers. */
function stashTotal(state: ReturnType<typeof useGame>['state']): number {
  return Object.values(state.stash.maps).reduce((n, list) => n + list.length, 0);
}
