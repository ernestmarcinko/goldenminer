import type { Feedback } from '../../store/gameStore';
import { MATERIAL_LABELS } from '../../core/itemData';
import type { FindKind, FindRecord, MotionSettings, TickEvent } from '../../core/types';
import { formatNumber } from '../format';
import { MINER_ROW, SHAFT_ROW_PX } from './shaftModel';

export type ParticleKind = 'gold' | 'diamond' | FindKind;
export interface Particle { id: number; kind: ParticleKind; text: string; x: number; y: number; bornAt: number }

const MAX_FIND_PARTICLES = 3;

function findText({ kind, amount, material }: FindRecord): string {
  switch (kind) {
    case 'chest': return 'Chest!';
    case 'map': return 'Map!';
    case 'gem': return 'Gem!';
    case 'goldVein': return `Gold vein +${formatNumber(amount)}`;
    case 'diamondVein': return `Diamonds +${formatNumber(amount)}`;
    case 'materialVein': return `${MATERIAL_LABELS[material ?? 'copper']}!`;
  }
}

export function particlesFromEvents(
  events: TickEvent[],
  origin: { x: number; y: number },
  nowMs: number,
  nextId: () => number,
): Particle[] {
  let gold = 0;
  let diamonds = 0;
  const out: Particle[] = [];
  const finds: Particle[] = [];
  for (const e of events) {
    if (e.kind === 'gold') gold += e.amount;
    else if (e.kind === 'diamond') diamonds += e.amount;
    else if (e.kind === 'find' && finds.length < MAX_FIND_PARTICLES) {
      finds.push({
        id: nextId(),
        kind: e.find.kind,
        text: findText(e.find),
        x: origin.x - 10,
        y: origin.y - 24 * (finds.length + 1),
        bornAt: nowMs,
      });
    }
  }
  if (gold > 0) out.push({ id: nextId(), kind: 'gold', text: `+${formatNumber(gold)}`, x: origin.x, y: origin.y, bornAt: nowMs });
  if (diamonds > 0) {
    out.push({ id: nextId(), kind: 'diamond', text: `+${formatNumber(diamonds)}`, x: origin.x + 26, y: origin.y + 14, bornAt: nowMs });
  }
  return [...out, ...finds];
}

export function feedbackToEvents(f: Feedback): TickEvent[] {
  const events: TickEvent[] = [];
  if (f.gold > 0) events.push({ kind: 'gold', amount: f.gold });
  if (f.diamonds > 0) events.push({ kind: 'diamond', amount: f.diamonds });
  for (const find of f.finds) events.push({ kind: 'find', find });
  return events;
}

export function pruneParticles<T extends { bornAt: number }>(list: T[], nowMs: number, lifeMs = 1300, max = 30): T[] {
  const alive = list.filter((p) => nowMs - p.bornAt <= lifeMs);
  return alive.length > max ? alive.slice(alive.length - max) : alive;
}

// The dig face is the shaft cell one row below the miner; the strip is centred, so that cell is mid-width.
export function shaftFaceOrigin(sceneWidth: number): { x: number; y: number } {
  return { x: sceneWidth / 2, y: (MINER_ROW + 1.5) * SHAFT_ROW_PX };
}

// Floats off drops the Gold and Diamond numbers, pops off drops the find pop-ups.
export function eventsForMotion(events: TickEvent[], motion: Pick<MotionSettings, 'floats' | 'pops'>): TickEvent[] {
  return events.filter((e) => (e.kind === 'find' ? motion.pops : motion.floats));
}
