import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { GameStore } from '../../store/gameStore';
import { bandAt } from '../../core/bands';
import { bandLook, worldOf, type WallTile } from '../../core/mineLook';
import type { FeatureKind } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import type { SpriteName } from '../../sprites/atlas';
import { effectiveMotion, usePrefersReducedMotion } from '../settings/motion';
import { useGame } from '../useGame';
import {
  eventsForMotion, feedbackToEvents, particlesFromEvents, pruneParticles, shaftFaceOrigin, type Particle,
} from './particles';
import { MINER_ROW, SHAFT_ROW_PX, shaftModel, shaftShift, type ShaftRow } from './shaftModel';
import './mine.css';
import './shaft.css';

const SWEEP_MS = 250;
const DRAIN_MS = 1000;
const TUNNEL_TILES = 3;
const MINER_PX = 60;
const LABELS_ID = 'gm-shaft-labels';

const FEATURE_SPRITE: Record<FeatureKind, SpriteName> = {
  goldVein: 'coin', diamondVein: 'diamond', chest: 'chest', gem: 'gem', map: 'map',
};

interface SceneRow { row: ShaftRow; rock: string }

function faceOf(scene: HTMLElement | null): { x: number; y: number } {
  return shaftFaceOrigin(scene?.getBoundingClientRect().width ?? 0);
}

function wallOffset(bits: number): CSSProperties {
  return { left: 4 + (bits & 15) * 2, top: 4 + (bits >> 4) * 2 };
}

function Wall({ tile, dug }: { tile: WallTile; dug: boolean }) {
  if (dug) return <div className="gm-shaft__tile gm-shaft__tile--dug" />;
  return (
    <div className="gm-shaft__tile" style={{ background: tile.shade }}>
      {tile.detail && <span className={`gm-shaft__detail gm-shaft__detail--${tile.detail}`} style={wallOffset(tile.bits)} />}
    </div>
  );
}

function ShaftCell({ row, rock, depth, progress }: { row: ShaftRow; rock: string; depth: number; progress: number }) {
  const feature = row.feature;
  if (row.cell === 'dug') {
    return (
      <div className="gm-shaft__cell gm-shaft__cell--dug">
        {row.metre < depth && <span className="gm-shaft__rope" />}
      </div>
    );
  }
  if (row.cell === 'dark') return <div className="gm-shaft__cell gm-shaft__cell--dark" />;
  const face = row.cell === 'face';
  return (
    <div className="gm-shaft__cell gm-shaft__cell--rock" style={{ background: rock }}>
      {row.hard && <span className="gm-shaft__hard" />}
      {feature && (
        <span className="gm-shaft__feature" data-feature={feature} style={{ opacity: face ? 0.9 : 0.55 }}>
          <Sprite name={FEATURE_SPRITE[feature]} scale={2} />
        </span>
      )}
      {face && progress > 0 && <span className="gm-shaft__crack" style={{ height: Math.round(progress * SHAFT_ROW_PX) }} />}
    </div>
  );
}

export function ShaftScene({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const reduced = usePrefersReducedMotion();
  const motion = effectiveMotion(state.settings.motion, reduced);
  const { depth, deepest, progress } = state;
  // During a map the shaft doesn't dig or strike: the banner above it leads back to the map.
  const paused = state.activity.kind === 'map';
  const sceneRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const prevTopRef = useRef<number | null>(null);
  const prevShaftModeRef = useRef(motion.shaft);
  const nextIdRef = useRef(0);
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const [particles, setParticles] = useState<Particle[]>([]);

  // Only the lit rows' rolls reach the model, so the 250 ms pump rebuilds it only when something visible changed.
  const lit: unknown[] = [];
  for (let m = deepest + 1; m <= deepest + stats.lampSight; m++) lit.push(state.ahead[m] ?? null);
  const modelKey = `${state.seed}|${state.worldGen}|${depth}|${deepest}|${stats.lampSight}|${JSON.stringify(lit)}`;
  // modelKey carries every input the model reads, so it alone is the dependency.
  const model = useMemo(() => {
    const world = worldOf(state);
    const built = shaftModel(state, stats.lampSight);
    const rows: SceneRow[] = built.rows.map((row) => ({
      row,
      rock: row.cell === 'face' || row.cell === 'lit' ? bandLook(world, bandAt(row.metre - 1)).palette[0] : '',
    }));
    const firstDark = built.rows.findIndex((r) => r.cell === 'dark');
    return { top: built.top, rows, firstDark: firstDark < 0 ? built.rows.length : firstDark };
  }, [modelKey]);

  // Slide the strip by the rows it moved since the last render (one slide however many metres one tick dug).
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const prevTop = prevTopRef.current ?? model.top;
    const topChanged = prevTop !== model.top;
    prevTopRef.current = model.top;
    const modeChanged = prevShaftModeRef.current !== motion.shaft;
    prevShaftModeRef.current = motion.shaft;
    // In a gallery the face is frozen, so its progress must not offset the strip.
    const { fromPx, toPx, animate } = shaftShift(prevTop, model.top, motion.shaft, depth < deepest ? 0 : progress);
    if (modeChanged) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${toPx}px)`;
    } else if (animate) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${fromPx}px)`;
      void el.offsetHeight;
      el.style.transition = 'transform 0.2s ease-out';
      el.style.transform = `translateY(${toPx}px)`;
    } else if (motion.shaft === 'smooth') {
      el.style.transition = topChanged ? 'none' : 'transform 0.25s linear';
      el.style.transform = `translateY(${toPx}px)`;
    } else if (motion.shaft === 'off' || topChanged) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${toPx}px)`;
    }
  });

  useEffect(() => {
    let lastDrain = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      let spawned: Particle[] = [];
      if (now - lastDrain >= DRAIN_MS) {
        lastDrain = now;
        const events = eventsForMotion(feedbackToEvents(store.drainFeedback()), motionRef.current);
        if (events.length > 0) {
          spawned = particlesFromEvents(events, faceOf(sceneRef.current), now, () => ++nextIdRef.current);
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
    if (paused) return;
    const events = eventsForMotion(store.click(), motion);
    if (events.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const keyboard = e.clientX === 0 && e.clientY === 0;
    const origin = keyboard ? faceOf(e.currentTarget) : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const now = Date.now();
    const spawned = particlesFromEvents(events, origin, now, () => ++nextIdRef.current);
    setParticles((prev) => pruneParticles([...prev, ...spawned], now));
  };

  const inTunnel = depth < deepest && depth > 0;
  const minerTop = (MINER_ROW + 1) * SHAFT_ROW_PX - MINER_PX - (depth === 0 ? 6 : 2);
  const minerX = inTunnel ? `calc(50% + ${(88 + SHAFT_ROW_PX) / 2}px)` : '50%';
  const fogTop = Math.max(0, (model.firstDark - 1) * SHAFT_ROW_PX);

  return (
    <>
      <button
        ref={sceneRef}
        type="button"
        className="gm-shaft"
        aria-label={paused ? "Digging is paused while you're in a map" : 'Dig: click the rock'}
        aria-describedby={LABELS_ID}
        disabled={paused}
        onClick={onClick}
      >
        <div ref={stripRef} className="gm-shaft__strip">
          {model.rows.map(({ row, rock }) => {
            if (row.cell === 'surface') {
              return (
                <div key={row.metre} className="gm-shaft__row gm-shaft__row--surface">
                  {row.metre === 0 && <span className="gm-shaft__grass" />}
                </div>
              );
            }
            const tunnel = row.tunnel && row.metre > 0;
            const k = row.metre - deepest;
            return (
              <div key={row.metre} className="gm-shaft__row">
                {row.left.map((t, c) => <Wall key={c} tile={t} dug={false} />)}
                <ShaftCell row={row} rock={rock} depth={depth} progress={depth < deepest ? 0 : progress} />
                {row.right.map((t, c) => <Wall key={c} tile={t} dug={tunnel && c < TUNNEL_TILES} />)}
                {row.label && (
                  <span className="gm-shaft__label" data-feature={row.feature ?? 'hard'} style={{ opacity: Math.max(0.5, 1 - (k - 1) * 0.15) }}>
                    {row.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="gm-shaft__vignette" />
        <div aria-hidden="true" className="gm-shaft__fog" style={{ top: fogTop }} />
        <div
          aria-hidden="true"
          className="gm-shaft__glow"
          data-flicker={motion.lampFlicker}
          style={{ left: minerX, top: minerTop + MINER_PX / 2 }}
        />
        <div aria-hidden="true" className="gm-shaft__miner" style={{ left: minerX, top: minerTop }}>
          <Sprite name="miner" scale={3} />
        </div>
        <div className="gm-shaft__hint">{paused ? 'Digging is paused' : 'Click the rock to dig'}</div>
        {particles.map((p) => (
          <span key={p.id} aria-hidden="true" className="gm-particle" data-kind={p.kind} style={{ left: p.x, top: p.y }}>
            {p.text}
          </span>
        ))}
      </button>
      <ul id={LABELS_ID} className="gm-visually-hidden">
        {model.rows.map(({ row }) => row.label && <li key={row.metre}>{row.label}</li>)}
      </ul>
    </>
  );
}
