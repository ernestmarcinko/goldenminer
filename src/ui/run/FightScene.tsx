import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { GameStore } from '../../store/gameStore';
import { monsterLook } from '../../core/monsterLook';
import type { DungeonType } from '../../core/dungeons';
import type { MapRun, TickEvent } from '../../core/types';
import { formatNumber, formatRate } from '../format';
import { eventsForMotion, pruneParticles } from '../mine/particles';
import { PixelArt } from '../PixelArt';
import { effectiveMotion, usePrefersReducedMotion } from '../settings/motion';
import { useGame } from '../useGame';
import {
  fightTiles, hurtParticle, monsterCaption, monsterTags, strikeParticle, type FloatingNumber,
} from './runView';
import './run.css';

const SWEEP_MS = 250;
const DRAIN_MS = 1000;
const MONSTER_SCALE = 8;
const DESCRIPTION_ID = 'gm-fight-state';

type Point = { x: number; y: number };

/** The middle of `el`, in `scene`'s own coordinates (the floating numbers sit inside the scene). */
function centreOf(scene: HTMLElement | null, el: HTMLElement | null): Point {
  if (scene === null || el === null) return { x: 0, y: 0 };
  const s = scene.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}

const pct = (n: number, max: number): string => `${Math.round(Math.min(1, Math.max(0, max > 0 ? n / max : 0)) * 100)}%`;

export function FightScene({ store, run, floor, roomSize }: {
  store: GameStore; run: MapRun; floor: DungeonType['floor']; roomSize: number;
}) {
  const { state, battle } = useGame(store);
  const reduced = usePrefersReducedMotion();
  const motion = effectiveMotion(state.settings.motion, reduced);
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const sceneRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const [floats, setFloats] = useState<FloatingNumber[]>([]);

  const tiles = useMemo(() => fightTiles(floor), [floor]);
  const monster = run.queue[0];
  const { seed } = state;
  const { tier } = run.map;
  // The look is drawn again only when the monster is a different one, not on every life change.
  const species = monster?.species;
  const rank = monster?.rank;
  const extra = monster?.extra;
  const look = useMemo(
    () => (species === undefined || rank === undefined || extra === undefined ? null : monsterLook(seed, tier, { species, rank, extra })),
    [seed, tier, species, rank, extra],
  );

  // Auto strikes and the damage taken arrive once a second, summed by the store.
  useEffect(() => {
    let lastDrain = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      let spawned: FloatingNumber[] = [];
      if (now - lastDrain >= DRAIN_MS) {
        lastDrain = now;
        const fb = store.drainFeedback();
        if (motionRef.current.floats) {
          const at = centreOf(sceneRef.current, stageRef.current);
          spawned = fb.strikes.map((s) => strikeParticle(s, at, ++nextIdRef.current, now));
          if (fb.hurt > 0) spawned.push(hurtParticle(fb.hurt, centreOf(sceneRef.current, youRef.current), ++nextIdRef.current, now));
        }
      }
      setFloats((prev) => {
        const next = pruneParticles([...prev, ...spawned], now, 1100);
        return spawned.length === 0 && next.length === prev.length ? prev : next;
      });
    }, SWEEP_MS);
    return () => window.clearInterval(id);
  }, [store]);

  const onStrike = (e: MouseEvent<HTMLButtonElement>) => {
    const events: TickEvent[] = eventsForMotion(store.click(), motion);
    if (events.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // a keyboard "click" has no pointer position: the number floats off the monster instead
    const keyboard = e.clientX === 0 && e.clientY === 0;
    const origin = keyboard ? centreOf(e.currentTarget, stageRef.current) : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const now = Date.now();
    const spawned: FloatingNumber[] = [];
    for (const ev of events) {
      if (ev.kind === 'strike') spawned.push(strikeParticle(ev, origin, ++nextIdRef.current, now));
      else if (ev.kind === 'hurt') spawned.push(hurtParticle(ev.amount, centreOf(e.currentTarget, youRef.current), ++nextIdRef.current, now));
    }
    if (spawned.length > 0) setFloats((prev) => pruneParticles([...prev, ...spawned], now, 1100));
  };

  const maxLife = battle.maxLife;
  const tags = monster === undefined ? [] : monsterTags(monster);
  return (
    <button
      ref={sceneRef}
      type="button"
      className="gm-fight"
      aria-label="Strike: click to hit"
      aria-describedby={DESCRIPTION_ID}
      onClick={onStrike}
    >
      <span id={DESCRIPTION_ID} className="gm-visually-hidden">
        {monster !== undefined && `${monster.name}: ${formatNumber(monster.life)} of ${formatNumber(monster.maxLife)} life. `}
        You: {formatNumber(run.life)} of {formatNumber(maxLife)} life.
      </span>
      <div aria-hidden="true" className="gm-fight__floor">
        {tiles.map((t, i) => <div key={i} style={{ background: t.bg, boxShadow: `inset -2px -2px 0 ${t.edge}` }} />)}
      </div>
      <div aria-hidden="true" className="gm-fight__glow" />
      {monster !== undefined && (
        <div aria-hidden="true" className="gm-fight__enemy" data-rank={monster.rank}>
          <div className="gm-fight__row">
            <span className="gm-fight__name">{monster.name}</span>
            <span className="gm-fight__life">{formatNumber(monster.life)} / {formatNumber(monster.maxLife)}</span>
          </div>
          <div className="gm-fight__bar"><div className="gm-fight__fill gm-fight__fill--enemy" style={{ width: pct(monster.life, monster.maxLife) }} /></div>
          {tags.length > 0 && (
            <div className="gm-fight__tags">{tags.map((t) => <span key={t} className="gm-fight__tag">{t}</span>)}</div>
          )}
          <div className="gm-fight__count">{monsterCaption(run, roomSize)}</div>
        </div>
      )}
      <div ref={stageRef} aria-hidden="true" className="gm-fight__stage">
        {look !== null && (
          <PixelArt grid={look.grid} palette={look.palette} scale={MONSTER_SCALE * look.scale} aura={look.aura} />
        )}
      </div>
      <div aria-hidden="true" className="gm-fight__foot">
        <div ref={youRef} className="gm-fight__you">
          <div className="gm-fight__row">
            <span className="gm-fight__name">You</span>
            <span className="gm-fight__life">{formatNumber(run.life)} / {formatNumber(maxLife)}</span>
          </div>
          <div className="gm-fight__bar"><div className="gm-fight__fill gm-fight__fill--you" style={{ width: pct(run.life, maxLife) }} /></div>
        </div>
        <div className="gm-fight__hint">Auto {formatRate(battle.attacksPerSecond)} hit/s · click for an extra hit</div>
      </div>
      {floats.map((p) => (
        <span key={p.id} aria-hidden="true" className="gm-float" data-kind={p.kind} style={{ left: p.x, top: p.y }}>{p.text}</span>
      ))}
    </button>
  );
}
