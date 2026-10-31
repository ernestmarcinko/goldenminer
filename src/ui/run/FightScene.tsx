import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameStore } from '../../store/gameStore';
import { monsterLook, type MonsterLook } from '../../core/monsterLook';
import type { DungeonType } from '../../core/dungeons';
import type { MapRun } from '../../core/types';
import { formatNumber, formatRate } from '../format';
import { pruneParticles } from '../mine/particles';
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
const MINION_SCALE = 4;
/** The scene draws the main target plus this many monsters behind it; the rest are counted in the caption. */
const SHOWN = 6;

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
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  // null until the stage is measured; the monster is drawn at its full scale until then
  const [stageWidth, setStageWidth] = useState<number | null>(null);

  const tiles = useMemo(() => fightTiles(floor), [floor]);
  const monster = run.queue[0];
  const { seed } = state;
  const { tier } = run.map;
  // The looks are drawn again only when the monsters change, not on every life change.
  const looks = useMemo(
    () => run.queue.slice(0, SHOWN).map((m) => monsterLook(seed, tier, { species: m.species, rank: m.rank, extra: m.extra })),
    [seed, tier, run.queue],
  );
  const mainLook = looks[0] ?? null;
  const minions = run.queue.slice(1, SHOWN).map((m, i) => ({ m, look: looks[i + 1] ?? null }));

  // A big monster must fit a narrow stage: it is drawn at the largest whole scale that does, never scaled by CSS.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return undefined;
    setStageWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setStageWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const gridWidth = mainLook?.grid[0]?.length ?? 1;
  const scale = mainLook === null ? MONSTER_SCALE
    : Math.max(1, Math.min(MONSTER_SCALE * mainLook.scale, stageWidth === null ? Infinity : Math.floor(stageWidth / gridWidth)));
  const minionScale = (look: MonsterLook): number => Math.max(1, Math.round(MINION_SCALE * look.scale));

  // Auto strikes and the damage taken arrive once a second, summed by the store.
  useEffect(() => {
    // strikes piled up while another tab was showing would burst out all at once
    store.drainFeedback();
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

  const maxLife = battle.maxLife;
  const tags = monster === undefined ? [] : monsterTags(monster);
  return (
    // the fight is automatic: the scene only shows it, and a click on it does nothing
    <div ref={sceneRef} className="gm-fight">
      <span className="gm-visually-hidden">
        {monster !== undefined && `${monster.name}: ${formatNumber(monster.life)} of ${formatNumber(monster.maxLife)} life. `}
        {run.queue.length > 1 && `${formatNumber(run.queue.length)} monsters in this room. `}
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
        {minions.length > 0 && (
          <div className="gm-fight__mobrow">
            {minions.map(({ m, look }) => (
              <div key={`${m.species}-${m.extra}`} className="gm-fight__minion" data-rank={m.rank} title={m.name}>
                {look !== null && (
                  <PixelArt grid={look.grid} palette={look.palette} scale={minionScale(look)} aura={look.aura} />
                )}
                <div className="gm-fight__minionbar">
                  <div className="gm-fight__fill gm-fight__fill--enemy" style={{ width: pct(m.life, m.maxLife) }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {mainLook !== null && (
          <PixelArt grid={mainLook.grid} palette={mainLook.palette} scale={scale} aura={mainLook.aura} />
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
        <div className="gm-fight__hint">Auto {formatRate(battle.attacksPerSecond)} hit/s</div>
      </div>
      {floats.map((p) => (
        <span key={p.id} aria-hidden="true" className="gm-float" data-kind={p.kind} style={{ left: p.x, top: p.y }}>{p.text}</span>
      ))}
    </div>
  );
}
