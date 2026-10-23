import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { GameStore } from '../../store/gameStore';
import { bandAt } from '../../core/bands';
import { Sprite } from '../../sprites/Sprite';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { SCENE_ROWS, sceneTiles } from './sceneTiles';
import { feedbackToEvents, particlesFromEvents, pruneParticles, type Particle } from './particles';
import './mine.css';

const SWEEP_MS = 250;
const DRAIN_MS = 1000;
const DIG_FACE_ROW = 9;
const FLECK_COLOURS = { gold: 'var(--gm-gold)', diamond: 'var(--gm-diamond)' } as const;

export function MineScene({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const band = bandAt(state.depth);
  const tiles = useMemo(() => sceneTiles(band.tier), [band.tier]);
  const sceneRef = useRef<HTMLButtonElement>(null);
  const nextIdRef = useRef(0);
  const [particles, setParticles] = useState<Particle[]>([]);

  const digFace = () => {
    const rect = sceneRef.current?.getBoundingClientRect();
    return rect
      ? { x: rect.width / 2, y: (rect.height * DIG_FACE_ROW) / SCENE_ROWS }
      : { x: 0, y: 0 };
  };

  useEffect(() => {
    let lastDrain = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      let spawned: Particle[] = [];
      if (now - lastDrain >= DRAIN_MS) {
        lastDrain = now;
        const events = feedbackToEvents(store.drainFeedback());
        if (events.length > 0) {
          spawned = particlesFromEvents(events, digFace(), now, () => ++nextIdRef.current);
        }
      }
      setParticles((prev) => {
        const next = pruneParticles([...prev, ...spawned], now);
        return spawned.length === 0 && next.length === prev.length ? prev : next;
      });
    }, SWEEP_MS);
    return () => window.clearInterval(id);
  }, [store]);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const events = store.click();
    if (events.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const keyboard = e.clientX === 0 && e.clientY === 0;
    const origin = keyboard ? digFace() : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const now = Date.now();
    const spawned = particlesFromEvents(events, origin, now, () => ++nextIdRef.current);
    setParticles((prev) => pruneParticles([...prev, ...spawned], now));
  };

  const inGallery = state.depth < state.deepest;
  const bandLabel = inGallery
    ? `${band.name} · side gallery at ${formatNumber(state.depth)} m · tier ${band.tier}`
    : `${band.name} · dig face at ${formatNumber(state.deepest)} m · tier ${band.tier}`;

  return (
    <button ref={sceneRef} type="button" className="gm-scene" aria-label="Dig: click the rock" onClick={onClick}>
      <div className="gm-scene__grid">
        {tiles.map((t, i) => (
          <div key={i} className="gm-tile" style={{ background: t.shade, boxShadow: `inset -2px -2px 0 ${t.edge}` }}>
            {t.fleck && (
              <div
                className="gm-tile__fleck"
                style={{ background: FLECK_COLOURS[t.fleck], boxShadow: `10px 8px 0 ${FLECK_COLOURS[t.fleck]}, 4px 16px 0 ${FLECK_COLOURS[t.fleck]}` }}
              />
            )}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="gm-scene__glow" />
      <div aria-hidden="true" className="gm-scene__rope" />
      <div aria-hidden="true" className="gm-scene__miner"><Sprite name="miner" scale={4} /></div>
      <div className="gm-scene__label">{bandLabel}</div>
      <div className="gm-scene__hint">Click the rock to dig</div>
      {particles.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          className="gm-particle"
          data-kind={p.kind}
          style={{ left: p.x, top: p.y }}
        >
          {p.text}
        </span>
      ))}
    </button>
  );
}
