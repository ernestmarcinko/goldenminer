import { hash2, hashN } from './rng';
import { BODIES, EYES, HEADS, HORNS, LEGS, MIDDLE_HORNS, MOUTHS, SPIKES, TAILS, WINGS, type Part, type Socket } from './monsterParts';
import { speciesOf, type BodyKind } from './species';
import type { MonsterState, Rank } from './types';

/** Monsters are drawn on a square canvas of this many pixels; the body's anchor sits at BODY_AT. */
const LOOK_SIZE = 24;
const BODY_AT: [number, number] = [12, 22];
const SALT_LOOK = 0x100c;

const PUPILS = ['#ffe08a', '#ff6b5a', '#7fe8ff', '#c6ff7a', '#ffffff'] as const;
const AURAS = ['#ff9b45', '#b39cff', '#7fe8ff', '#e2604f'] as const;

export interface Placed { part: Part; at: [number, number] }
export interface Extra { kind: 'spikes' | 'horns'; index: number }
/** Kit indices for one creature; parts the body has no socket for are left out. */
export interface LookChoice {
  body: BodyKind; head: number; eyes: number; mouth: number; horns: number | null;
  legs: number; wings: number; tail: number; extras: Extra[];
}
export interface Look { grid: string[]; palette: Record<string, string> }
export interface MonsterLook extends Look { aura: string | null; scale: 1 | 2 }

/** Draws parts in the order given, each with its anchor at `at`; a non-`.` pixel off the canvas throws. */
export function compose(parts: readonly Placed[]): string[] {
  const rows = Array.from({ length: LOOK_SIZE }, () => Array<string>(LOOK_SIZE).fill('.'));
  for (const { part, at } of parts) {
    const left = at[0] - part.anchor[0];
    const top = at[1] - part.anchor[1];
    part.grid.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const c = line[x];
        if (c === undefined || c === '.') continue;
        const row = rows[top + y];
        if (row === undefined || left + x < 0 || left + x >= LOOK_SIZE) {
          throw new Error(`part pixel (${left + x}, ${top + y}) falls outside the ${LOOK_SIZE}×${LOOK_SIZE} canvas`);
        }
        row[left + x] = c;
      }
    });
  }
  return rows.map((row) => row.join(''));
}

function attach(parent: Placed, socket: Socket, part: Part | undefined): Placed | null {
  const s = parent.part.sockets?.[socket];
  if (s === undefined || part === undefined) return null;
  return { part, at: [parent.at[0] - parent.part.anchor[0] + s[0], parent.at[1] - parent.part.anchor[1] + s[1]] };
}

function legKit(body: BodyKind): readonly Part[] {
  return body === 'quadruped' || body === 'biped' ? LEGS[body] : [];
}

/** Places the chosen parts back to front: tail, wings, legs, body, back extras, head, horns, eyes, mouth. */
export function layout(c: LookChoice): Placed[] {
  const body: Placed = { part: BODIES[c.body], at: BODY_AT };
  const head = attach(body, 'head', HEADS[c.head]);
  const spikes = c.extras.filter((e) => e.kind === 'spikes').map((e) => attach(body, 'back', SPIKES[e.index]));
  const horns = [...(c.horns === null ? [] : [c.horns]), ...c.extras.filter((e) => e.kind === 'horns').map((e) => e.index)];
  const placed = [
    attach(body, 'tail', TAILS[c.tail]),
    attach(body, 'wings', WINGS[c.wings]),
    attach(body, 'legs', legKit(c.body)[c.legs]),
    body,
    ...spikes,
    head,
    ...(head === null ? [] : [
      ...horns.map((i) => attach(head, 'horns', HORNS[i])),
      attach(head, 'eyes', EYES[c.eyes]),
      attach(head, 'mouth', MOUTHS[c.mouth]),
    ]),
  ];
  return placed.filter((p): p is Placed => p !== null);
}

function lookKey(seed: number, tier: number, speciesIndex: number): number {
  return hashN(seed, SALT_LOOK, tier, speciesIndex);
}

/** The kit indices of a species' look, from (seed, tier, species index). */
export function speciesChoice(seed: number, tier: number, speciesIndex: number): LookChoice {
  const key = lookKey(seed, tier, speciesIndex);
  const body = speciesOf(tier)[speciesIndex]?.body ?? 'blob';
  const pick = (n: number, length: number) => (length > 0 ? hash2(key, n) % length : 0);
  return {
    body,
    head: pick(1, HEADS.length),
    eyes: pick(2, EYES.length),
    mouth: pick(3, MOUTHS.length),
    horns: hash2(key, 4) % 2 === 0 ? null : pick(5, HORNS.length),
    legs: pick(6, legKit(body).length),
    wings: pick(7, WINGS.length),
    tail: pick(8, TAILS.length),
    extras: [],
  };
}

const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

function lookPalette(key: number): Record<string, string> {
  const at = (n: number, length: number) => hash2(key, n) % length;
  const hue = at(10, 360);
  const sat = 35 + at(11, 26);
  const light = 42 + at(12, 17);
  const accentHue = (hue + 150 + at(13, 61)) % 360;
  const accentSat = 45 + at(14, 26);
  const accentLight = 50 + at(15, 13);
  return {
    k: '#120d0a', m: '#3a1414', t: '#efe6cf', e: '#f4ecd8',
    b: hsl(hue, sat, light), B: hsl(hue, sat, light + 14), d: hsl(hue, sat, light - 14),
    a: hsl(accentHue, accentSat, accentLight), A: hsl(accentHue, accentSat, accentLight + 12),
    p: PUPILS[at(16, PUPILS.length)] ?? '#ffffff',
  };
}

/** A species' look, generated once per world from (seed, tier, species index). */
export function speciesLook(seed: number, tier: number, speciesIndex: number): Look {
  return {
    grid: compose(layout(speciesChoice(seed, tier, speciesIndex))),
    palette: lookPalette(lookKey(seed, tier, speciesIndex)),
  };
}

/**
 * The extra parts a rank adds to a species' choice, picked by the monster's `extra`: none for a normal monster,
 * one spikes or horns part for a champion, two or three (horns first) for a boss.
 * A head carries at most one side pair and one middle piece, so an extra horn never lands on the species' own.
 */
export function rankExtras(choice: LookChoice, rank: Rank, extra: number): Extra[] {
  if (rank === 'normal') return [];
  const middle = (i: number) => MIDDLE_HORNS.includes(i);
  const shuffled = (kind: Extra['kind'], length: number, salt: number): Extra[] => Array.from({ length }, (_, index) => ({ kind, index }))
    .map((e) => ({ e, key: hash2(extra, salt + e.index) })).sort((x, y) => x.key - y.key).map((x) => x.e);
  const spikes = shuffled('spikes', SPIKES.length, 100);
  const own = choice.horns;
  const horns = shuffled('horns', HORNS.length, 200).filter((e) => own === null || middle(e.index) !== middle(own));
  if (rank === 'boss') return [...horns.slice(0, 1), ...spikes].slice(0, 2 + (hash2(extra, 1) % 2));
  const pool = [...spikes, ...horns];
  const pick = pool[hash2(extra, 2) % pool.length];
  return pick === undefined ? [] : [pick];
}

/** Champions add one extra part and an aura; bosses add two or three and are drawn twice as large. */
export function monsterLook(seed: number, tier: number, m: Pick<MonsterState, 'species' | 'rank' | 'extra'>): MonsterLook {
  const palette = lookPalette(lookKey(seed, tier, m.species));
  const choice = speciesChoice(seed, tier, m.species);
  const grid = compose(layout({ ...choice, extras: rankExtras(choice, m.rank, m.extra) }));
  if (m.rank === 'normal') return { grid, palette, aura: null, scale: 1 };
  if (m.rank === 'boss') return { grid, palette, aura: null, scale: 2 };
  return { grid, palette, aura: AURAS[hash2(m.extra, 0) % AURAS.length] ?? null, scale: 1 };
}
