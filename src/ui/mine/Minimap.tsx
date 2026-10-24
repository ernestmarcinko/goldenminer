import type { KeyboardEvent, MouseEvent } from 'react';
import type { FeatureKind } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { Sprite } from '../../sprites/Sprite';
import type { SpriteName } from '../../sprites/atlas';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { depthForClick, depthForKey, MINIMAP_METRES, MINIMAP_PX_PER_METRE, minimapModel } from './minimap';
import './minimap.css';

const ICONS: Record<FeatureKind, SpriteName> = {
  map: 'map', chest: 'chest', gem: 'gem', diamondVein: 'diamond', goldVein: 'coin',
};

export function Minimap({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const model = minimapModel(state, stats.lampSight);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const depth = depthForClick(
      model,
      { detail: e.detail, clientX: e.clientX, clientY: e.clientY, stripTop: e.currentTarget.getBoundingClientRect().top },
      state.deepest,
    );
    if (depth !== null) store.moveTo(depth);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const depth = depthForKey(e.key, state.depth, state.deepest);
    if (depth === null) return;
    e.preventDefault();
    store.moveTo(depth);
  };

  return (
    <section aria-label="Minimap" className="gm-minimap">
      <div className="gm-minimap__head">
        <h2 className="gm-minimap__title">Minimap</h2>
        <span className="gm-muted gm-minimap__range">{formatNumber(model.top)}–{formatNumber(model.bottom)} m</span>
      </div>
      <button
        type="button"
        className="gm-minimap__strip"
        aria-label="Minimap: choose a depth to dig at. Arrow keys move one metre, Page Up and Page Down ten, Home and End jump to the surface and the dig face."
        style={{ height: MINIMAP_METRES * MINIMAP_PX_PER_METRE }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span className="gm-minimap__ticks">
          {model.ticks.map((t) => (
            <span key={t.depth} className="gm-minimap__tick" style={{ top: t.y }}>{formatNumber(t.depth)}</span>
          ))}
        </span>
        <span className="gm-minimap__map">
          {model.bands.map((b) => (
            <span key={b.name} className="gm-minimap__band" style={{ top: b.y, height: b.height, background: b.color }}>
              <span className="gm-minimap__band-name">{b.name}</span>
            </span>
          ))}
          {model.markers.map((m) => (
            <span key={m.y} className="gm-minimap__marker" style={{ top: m.y }}>
              <Sprite name={ICONS[m.kind]} scale={2} />
              <span className="gm-minimap__marker-label">{m.label}</span>
            </span>
          ))}
          <span className="gm-minimap__dim" style={{ top: model.youY, height: Math.max(0, model.fogY - model.youY) }} />
          {model.ahead.map((a) => (
            <span key={a.y} className="gm-minimap__marker gm-minimap__marker--ahead" style={{ top: a.y }}>
              {a.kind === 'hardRock' ? (
                <span className="gm-minimap__ahead-label">harder rock</span>
              ) : (
                <Sprite name={ICONS[a.kind]} scale={2} />
              )}
            </span>
          ))}
          <span className="gm-minimap__fog" style={{ top: model.fogY }}>?</span>
          <span className="gm-minimap__you-line" style={{ top: model.youY }} />
          <span className="gm-minimap__you-tag" style={{ top: model.youY + 4 }}>You · {formatNumber(state.depth)} m</span>
        </span>
      </button>
      <p className="gm-muted gm-minimap__caption">
        Everything found so far, by depth. Tap an explored depth to climb back. Your lamp lights {formatNumber(stats.lampSight)} m past the dig face.
      </p>
    </section>
  );
}
