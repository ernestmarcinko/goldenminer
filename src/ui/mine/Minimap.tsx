import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameStore } from '../../store/gameStore';
import { Sprite } from '../../sprites/Sprite';
import { formatNumber } from '../format';
import { effectiveMotion, usePrefersReducedMotion } from '../settings/motion';
import { useGame } from '../useGame';
import { MINIMAP_METRES, MINIMAP_PX_PER_METRE, followTop, isFollowing, minimapModel } from './minimap';
import './minimap.css';

const PX = MINIMAP_PX_PER_METRE;

export function Minimap({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const smooth = effectiveMotion(state.settings.motion, usePrefersReducedMotion()).shaft !== 'off';
  const boxRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const frame = useRef(0);
  const deepest = useRef(state.deepest);
  deepest.current = state.deepest;
  const [top, setTop] = useState(() => followTop(state.deepest));
  const model = minimapModel(state, stats.lampSight, top, stats.hazardSight);

  // While following, every new metre (or a change in scroll height) brings the window back to the face.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !following.current) return;
    box.scrollTop = followTop(state.deepest) * PX;
    setTop(Math.floor(box.scrollTop / PX));
  }, [state.deepest, model.height]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = (): void => {
    if (frame.current !== 0) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const box = boxRef.current;
      if (!box) return;
      following.current = isFollowing(box.scrollTop, deepest.current);
      setTop(Math.floor(box.scrollTop / PX));
    });
  };

  const jump = (): void => {
    following.current = true;
    boxRef.current?.scrollTo({ top: followTop(state.deepest) * PX, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <section aria-label="Minimap" className="gm-minimap">
      <div className="gm-minimap__head">
        <h2 className="gm-minimap__title">Minimap</h2>
        <span className="gm-muted gm-minimap__range">{formatNumber(model.top)}–{formatNumber(model.bottom)} m</span>
      </div>
      <div
        ref={boxRef}
        role="region"
        className="gm-minimap__scroll"
        aria-label="Minimap: everything found, by depth"
        tabIndex={0}
        onScroll={onScroll}
        style={{ height: MINIMAP_METRES * PX }}
      >
        <div className="gm-minimap__strip" style={{ height: model.height }}>
          <span className="gm-minimap__ticks">
            {model.ticks.map((t) => (
              <span key={t.depth} className="gm-minimap__tick" style={{ top: t.y }}>{formatNumber(t.depth)}</span>
            ))}
          </span>
          <span className="gm-minimap__map">
            {model.bands.map((b) => (
              <span key={b.y} className="gm-minimap__band" style={{ top: b.y, height: b.height, background: b.color }}>
                <span className="gm-minimap__band-name">{b.name}</span>
              </span>
            ))}
            {model.markers.map((m) => (
              <span key={m.y} className="gm-minimap__marker" style={{ top: m.y }}>
                <Sprite name={m.icon} scale={2} />
                <span className="gm-minimap__marker-label">{m.label}</span>
              </span>
            ))}
            <span className="gm-minimap__dim" style={{ top: model.youY, height: Math.max(0, model.fogY - model.youY) }} />
            {model.ahead.map((a) => (
              <span key={`${a.y}-${a.kind}`} className="gm-minimap__marker gm-minimap__marker--ahead" style={{ top: a.y }}>
                {a.icon ? (
                  <Sprite name={a.icon} scale={2} label={a.label} />
                ) : (
                  <span className="gm-minimap__ahead-label">{a.label}</span>
                )}
              </span>
            ))}
            <span className="gm-minimap__fog" style={{ top: model.fogY }}>?</span>
            <span className="gm-minimap__you-line" style={{ top: model.youY }} />
            <span className={`gm-minimap__you-tag${model.youTagBelow ? ' gm-minimap__you-tag--below' : ''}`} style={{ top: model.youY }}>You · {formatNumber(state.deepest)} m</span>
          </span>
        </div>
      </div>
      <button type="button" className="gm-btn gm-minimap__jump" onClick={jump}>Jump to the dig face</button>
      <p className="gm-muted gm-minimap__caption">
        Everything found so far, by depth. Your lamp lights {formatNumber(stats.lampSight)} m past the dig face.
      </p>
    </section>
  );
}
