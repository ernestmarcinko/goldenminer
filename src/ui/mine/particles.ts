import type { Feedback } from '../../store/gameStore';
import type { FeatureKind, TickEvent } from '../../core/types';
import { formatNumber } from '../format';

export type ParticleKind = 'gold' | 'diamond' | FeatureKind;
export interface Particle { id: number; kind: ParticleKind; text: string; x: number; y: number; bornAt: number }

const MAX_FIND_PARTICLES = 3;

function findText(kind: FeatureKind, amount: number): string {
  switch (kind) {
    case 'chest': return 'Chest!';
    case 'map': return 'Map!';
    case 'gem': return 'Gem!';
    case 'goldVein': return `Gold vein +${formatNumber(amount)}`;
    case 'diamondVein': return `Diamonds +${formatNumber(amount)}`;
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
        text: findText(e.find.kind, e.find.amount),
        x: origin.x - 10,
        y: origin.y - 24 * finds.length,
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

export function pruneParticles(list: Particle[], nowMs: number, lifeMs = 1300, max = 30): Particle[] {
  const alive = list.filter((p) => nowMs - p.bornAt <= lifeMs);
  return alive.length > max ? alive.slice(alive.length - max) : alive;
}
