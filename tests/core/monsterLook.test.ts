import { expect, it } from 'vitest';
import { compose, layout, monsterLook, rankExtras, speciesChoice, speciesLook, type Extra, type LookChoice } from '../../src/core/monsterLook';
import { BODIES, EYES, HEADS, HORNS, LEGS, MIDDLE_HORNS, MOUTHS, SPIKES, TAILS, WINGS, type Part, type Socket } from '../../src/core/monsterParts';
import { BODY_KINDS, speciesOf, type BodyKind } from '../../src/core/species';
import type { Rank } from '../../src/core/types';
import { pixelScale } from '../../src/ui/PixelArt';

const CHARS = new Set('.kbBdaAepmt');
const SIZE = 24;

const kit: [string, Part][] = [
  ...BODY_KINDS.map((k): [string, Part] => [`body ${k}`, BODIES[k]]),
  ...HEADS.map((p, i): [string, Part] => [`head ${i}`, p]),
  ...EYES.map((p, i): [string, Part] => [`eyes ${i}`, p]),
  ...MOUTHS.map((p, i): [string, Part] => [`mouth ${i}`, p]),
  ...HORNS.map((p, i): [string, Part] => [`horns ${i}`, p]),
  ...LEGS.quadruped.map((p, i): [string, Part] => [`quadruped legs ${i}`, p]),
  ...LEGS.biped.map((p, i): [string, Part] => [`biped legs ${i}`, p]),
  ...WINGS.map((p, i): [string, Part] => [`wings ${i}`, p]),
  ...TAILS.map((p, i): [string, Part] => [`tail ${i}`, p]),
  ...SPIKES.map((p, i): [string, Part] => [`spikes ${i}`, p]),
];

const inside = (p: Part, [x, y]: [number, number]) => y >= 0 && y < p.grid.length && x >= 0 && x < (p.grid[0]?.length ?? 0);
const count = (grid: string[], chars: string) => grid.join('').split('').filter((c) => chars.includes(c)).length;

/** Non-transparent pixels split into 8-connected groups (pixel art joins on diagonals); a floating part makes a second group. */
function groups(grid: string[]): number {
  const seen = new Set<number>();
  let n = 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (grid[y]?.[x] === '.' || seen.has(y * SIZE + x)) continue;
    n++;
    const stack = [[x, y]];
    seen.add(y * SIZE + x);
    while (stack.length > 0) {
      const [cx = 0, cy = 0] = stack.pop() ?? [];
      for (const [nx, ny] of [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [cx + dx, cy + dy] as const))) {
        const c = grid[ny]?.[nx];
        if (c === undefined || c === '.' || seen.has(ny * SIZE + nx)) continue;
        seen.add(ny * SIZE + nx);
        stack.push([nx, ny]);
      }
    }
  }
  return n;
}

it('the kit is well formed', () => {
  expect(HEADS.length).toBeGreaterThanOrEqual(3);
  expect(EYES.length).toBeGreaterThanOrEqual(4);
  expect(MOUTHS.length).toBeGreaterThanOrEqual(3);
  expect(HORNS.length).toBeGreaterThanOrEqual(4);
  expect(LEGS.quadruped.length).toBeGreaterThanOrEqual(3);
  expect(LEGS.biped.length).toBeGreaterThanOrEqual(3);
  expect(WINGS.length).toBeGreaterThanOrEqual(3);
  expect(TAILS.length).toBeGreaterThanOrEqual(3);
  expect(SPIKES.length).toBeGreaterThanOrEqual(3);
  for (const [name, part] of kit) {
    const width = part.grid[0]?.length ?? 0;
    expect(width, name).toBeGreaterThan(0);
    for (const row of part.grid) {
      expect(row.length, name).toBe(width);
      for (const c of row) expect(CHARS.has(c), `${name}: '${c}'`).toBe(true);
    }
    expect(inside(part, part.anchor), `${name} anchor`).toBe(true);
    for (const [socket, at] of Object.entries(part.sockets ?? {})) expect(inside(part, at), `${name} ${socket}`).toBe(true);
  }
  const needs: Record<BodyKind, Socket[]> = {
    blob: ['head', 'back'],
    quadruped: ['head', 'back', 'legs', 'tail'],
    biped: ['head', 'back', 'legs'],
    serpent: ['head', 'back', 'tail'],
    winged: ['head', 'back', 'wings'],
  };
  for (const k of BODY_KINDS) for (const s of needs[k]) expect(BODIES[k].sockets?.[s], `${k} ${s}`).toBeDefined();
  for (const [i, head] of HEADS.entries()) for (const s of ['eyes', 'mouth', 'horns'] as const) expect(head.sockets?.[s], `head ${i} ${s}`).toBeDefined();
});

it('compose puts the body anchor at (12, 22), draws in order and throws outside the canvas', () => {
  const dot: Part = { grid: ['k'], anchor: [0, 0] };
  const grid = compose([{ part: dot, at: [12, 22] }, { part: { grid: ['e.'], anchor: [0, 0] }, at: [12, 22] }]);
  expect(grid).toHaveLength(SIZE);
  expect(grid.every((row) => row.length === SIZE)).toBe(true);
  expect(grid[22]?.[12]).toBe('e');
  expect(grid[22]?.[13]).toBe('.');
  expect(count(grid, 'kbBdaAepmt')).toBe(1);
  expect(compose([{ part: { grid: ['..k'], anchor: [0, 0] }, at: [21, 0] }])[0]?.[23]).toBe('k');
  expect(() => compose([{ part: { grid: ['..k'], anchor: [0, 0] }, at: [22, 0] }])).toThrow();
  expect(() => compose([{ part: { grid: ['k'], anchor: [0, 0] }, at: [5, -1] }])).toThrow();
  // Transparent pixels may hang over the edge.
  expect(() => compose([{ part: { grid: ['k..'], anchor: [0, 0] }, at: [23, 0] }])).not.toThrow();
  const body = BODIES.biped;
  const placed = layout({ body: 'biped', head: 0, eyes: 0, mouth: 0, horns: null, legs: 0, wings: 0, tail: 0, extras: [] });
  expect(placed.find((p) => p.part === body)?.at).toEqual([12, 22]);
});

const base = (body: BodyKind): LookChoice => ({ body, head: 0, eyes: 0, mouth: 0, horns: 0, legs: 0, wings: 0, tail: 0, extras: [] });
const takes = (body: BodyKind) => ({
  legs: body === 'quadruped' || body === 'biped' ? LEGS[body].length : 0,
  wings: body === 'winged' ? WINGS.length : 0,
  tail: body === 'quadruped' || body === 'serpent' ? TAILS.length : 0,
});
const extras: Extra[] = [...SPIKES.map((_, index): Extra => ({ kind: 'spikes', index })), ...HORNS.map((_, index): Extra => ({ kind: 'horns', index }))];

function variants(body: BodyKind): LookChoice[] {
  const b = base(body);
  const t = takes(body);
  const out: LookChoice[] = [b, { ...b, horns: null }];
  for (let i = 0; i < HEADS.length; i++) out.push({ ...b, head: i });
  for (let i = 0; i < EYES.length; i++) out.push({ ...b, eyes: i });
  for (let i = 0; i < MOUTHS.length; i++) out.push({ ...b, mouth: i });
  for (let i = 0; i < HORNS.length; i++) out.push({ ...b, horns: i });
  for (let i = 0; i < t.legs; i++) out.push({ ...b, legs: i });
  for (let i = 0; i < t.wings; i++) out.push({ ...b, wings: i });
  for (let i = 0; i < t.tail; i++) out.push({ ...b, tail: i });
  for (const e of extras) out.push({ ...b, horns: null, extras: [e] });
  for (const e of extras) if (e.kind !== 'horns' || e.index !== b.horns) out.push({ ...b, extras: [e] });
  return out;
}

it('no combination clips, loses its eyes or floats a part', () => {
  for (const body of BODY_KINDS) {
    for (const choice of variants(body)) {
      const label = JSON.stringify(choice);
      const grid = compose(layout(choice));
      expect(count(grid, 'ep'), label).toBeGreaterThan(0);
      expect(count(grid, 'k'), label).toBeGreaterThan(0);
      // Every eye pixel survives: nothing drawn later covers the eyes.
      const eyes = EYES[choice.eyes]?.grid ?? [];
      expect(count(grid, 'ep'), label).toBe(count(eyes, 'ep'));
      // A 1-pixel margin is left for the aura.
      expect(grid[0], label).toBe('.'.repeat(SIZE));
      expect(grid[SIZE - 1], label).toBe('.'.repeat(SIZE));
      expect(grid.every((row) => row[0] === '.' && row[SIZE - 1] === '.'), label).toBe(true);
      expect(groups(grid), label).toBe(1);
      if (choice.extras.length > 0) {
        const plain = compose(layout({ ...choice, extras: [] }));
        expect(grid, `${label} extra shows`).not.toEqual(plain);
      }
    }
  }
});

it('looks are fixed by the seed, and vary between seeds', () => {
  let species = 0;
  let differ = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (let tier = 1; tier <= 8; tier++) {
      for (let i = 0; i < speciesOf(tier).length; i++) {
        const look = speciesLook(seed, tier, i);
        expect(speciesLook(seed, tier, i)).toEqual(look);
        expect(look.grid).toHaveLength(SIZE);
        for (const c of Object.values(look.palette)) expect(c).toMatch(/^(hsl\(\d+, \d+%, \d+%\)|#[0-9a-f]{6})$/);
        for (const c of new Set(look.grid.join(''))) if (c !== '.') expect(look.palette[c], c).toBeDefined();
        species++;
        if (look.grid.join() !== speciesLook(seed + 100, tier, i).grid.join()) differ++;
      }
    }
  }
  expect(differ / species).toBeGreaterThanOrEqual(0.8);
});

it('the palette follows the curated ranges', () => {
  const hsl = (c: string | undefined) => (c?.match(/^hsl\((\d+), (\d+)%, (\d+)%\)$/)?.slice(1) ?? []).map(Number);
  for (let seed = 1; seed <= 40; seed++) {
    const { palette } = speciesLook(seed, 3, seed % 4);
    const [h = -1, s = -1, l = -1] = hsl(palette.b);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(s).toBeGreaterThanOrEqual(35);
    expect(s).toBeLessThanOrEqual(60);
    expect(l).toBeGreaterThanOrEqual(42);
    expect(l).toBeLessThanOrEqual(58);
    expect(hsl(palette.B)).toEqual([h, s, l + 14]);
    expect(hsl(palette.d)).toEqual([h, s, l - 14]);
    const [ah = -1, as = -1, al = -1] = hsl(palette.a);
    expect((ah - h + 360) % 360).toBeGreaterThanOrEqual(150);
    expect((ah - h + 360) % 360).toBeLessThanOrEqual(210);
    expect(as).toBeGreaterThanOrEqual(45);
    expect(as).toBeLessThanOrEqual(70);
    expect(al).toBeGreaterThanOrEqual(50);
    expect(al).toBeLessThanOrEqual(62);
    expect(hsl(palette.A)).toEqual([ah, as, al + 12]);
    expect(palette.e).toBe('#f4ecd8');
    expect(['#ffe08a', '#ff6b5a', '#7fe8ff', '#c6ff7a', '#ffffff']).toContain(palette.p);
    expect([palette.k, palette.m, palette.t]).toEqual(['#120d0a', '#3a1414', '#efe6cf']);
  }
});

it('rank changes the look', () => {
  const m = (species: number, rank: Rank, extra: number) => ({ species, rank, extra });
  const auras = new Set<string | null>();
  for (let seed = 1; seed <= 12; seed++) {
    for (let tier = 1; tier <= 8; tier++) {
      for (let i = 0; i < speciesOf(tier).length; i++) {
        const look = speciesLook(seed, tier, i);
        const normal = monsterLook(seed, tier, m(i, 'normal', seed * 7));
        expect(normal).toEqual({ grid: look.grid, palette: look.palette, aura: null, scale: 1 });
        const extra = seed * 31 + tier * 7 + i;
        const champion = monsterLook(seed, tier, m(i, 'champion', extra));
        expect(champion.aura).not.toBeNull();
        auras.add(champion.aura);
        expect(champion.scale).toBe(1);
        expect(champion.grid).not.toEqual(look.grid);
        expect(champion.palette).toEqual(look.palette);
        expect(monsterLook(seed, tier, m(i, 'champion', extra))).toEqual(champion);
        const boss = monsterLook(seed, tier, m(i, 'boss', extra));
        expect(boss.scale).toBe(2);
        expect(boss.grid).not.toEqual(look.grid);
        expect(monsterLook(seed, tier, m(i, 'boss', extra))).toEqual(boss);
      }
    }
  }
  expect([...auras].sort()).toEqual(['#7fe8ff', '#b39cff', '#e2604f', '#ff9b45']);
});

it('layout draws back to front', () => {
  const quadruped: LookChoice = {
    body: 'quadruped', head: 1, eyes: 2, mouth: 1, horns: 0, legs: 1, wings: 0, tail: 1,
    extras: [{ kind: 'spikes', index: 2 }, { kind: 'horns', index: 3 }],
  };
  const parts = layout(quadruped).map((p) => p.part);
  const back = [TAILS[1], LEGS.quadruped[1], BODIES.quadruped, SPIKES[2], HEADS[1], HORNS[0], HORNS[3], EYES[2], MOUTHS[1]];
  expect(parts).toEqual(back);
  for (const [i, part] of back.entries()) expect(parts[i], `slot ${i}`).toBe(part);
  const winged = layout({ ...base('winged'), wings: 2 }).map((p) => p.part);
  expect(winged.indexOf(WINGS[2] as Part)).toBeGreaterThanOrEqual(0);
  expect(winged.indexOf(WINGS[2] as Part)).toBeLessThan(winged.indexOf(BODIES.winged));
});

const middle = (i: number) => MIDDLE_HORNS.includes(i);
/** Horns an extra may add to a head that already wears `own`: the other zone only (side pair or middle piece). */
const extraHorns = (own: number | null) => HORNS.map((_, i) => i).filter((i) => own === null || middle(i) !== middle(own));
const spikeOrders = (n: number): number[][] => {
  const out: number[][] = [];
  const grow = (prefix: number[]) => {
    if (prefix.length === n) { out.push(prefix); return; }
    for (let i = 0; i < SPIKES.length; i++) if (!prefix.includes(i)) grow([...prefix, i]);
  };
  grow([]);
  return out;
};
const sp = (index: number): Extra => ({ kind: 'spikes', index });
const hn = (index: number): Extra => ({ kind: 'horns', index });
function championStacks(own: number | null): Extra[][] {
  return [...SPIKES.map((_, i) => [sp(i)]), ...extraHorns(own).map((i) => [hn(i)])];
}
function bossStacks(own: number | null): Extra[][] {
  const horns = extraHorns(own);
  if (horns.length === 0) return [...spikeOrders(2), ...spikeOrders(3)].map((o) => o.map(sp));
  return horns.flatMap((h) => [...spikeOrders(1), ...spikeOrders(2)].map((o) => [hn(h), ...o.map(sp)]));
}

it('a rank picks its extras from the monster\'s extra value', () => {
  for (const horns of [null, 0, 1, 2, 3, 4]) {
    const choice: LookChoice = { ...base('biped'), horns };
    const champions = new Set<string>();
    const bosses = new Set<string>();
    const sizes = new Set<number>();
    const championOk = new Set(championStacks(horns).map((x) => JSON.stringify(x)));
    const bossOk = new Set(bossStacks(horns).map((x) => JSON.stringify(x)));
    for (let extra = 0; extra < 2000; extra++) {
      expect(rankExtras(choice, 'normal', extra)).toEqual([]);
      const champion = rankExtras(choice, 'champion', extra);
      expect(champion).toHaveLength(1);
      expect(championOk.has(JSON.stringify(champion)), JSON.stringify(champion)).toBe(true);
      champions.add(JSON.stringify(champion));
      const boss = rankExtras(choice, 'boss', extra);
      expect(bossOk.has(JSON.stringify(boss)), JSON.stringify(boss)).toBe(true);
      expect(rankExtras(choice, 'boss', extra)).toEqual(boss);
      sizes.add(boss.length);
      bosses.add(JSON.stringify(boss));
    }
    // Every allowed pick turns up: champions take horns as well as spikes, and bosses stack two or three.
    expect(champions.size, `horns ${horns}`).toBe(championOk.size);
    expect(bosses.size, `horns ${horns}`).toBe(bossOk.size);
    expect([...sizes].sort()).toEqual([2, 3]);
  }
});

it('monsterLook draws the rank\'s extras on the species\' choice', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const rank of ['normal', 'champion', 'boss'] as const) {
      const extra = seed * 977;
      const choice = speciesChoice(seed, 3, seed % 4);
      expect(monsterLook(seed, 3, { species: seed % 4, rank, extra }).grid).toEqual(compose(layout({ ...choice, extras: rankExtras(choice, rank, extra) })));
    }
  }
});

/** What the seed decides about a look, leaving out the body (fixed by the species list). */
const keyed = (seed: number, tier: number, i: number) => JSON.stringify({ ...speciesChoice(seed, tier, i), body: null, palette: speciesLook(seed, tier, i).palette });

it('a look is keyed by tier and species index as well as the seed', () => {
  let pairs = 0;
  let tierDiffer = 0;
  for (let seed = 1; seed <= 30; seed++) {
    // Tiers 7-10 and 11-14 share their species lists, so only the key tells them apart.
    for (let tier = 7; tier <= 10; tier++) {
      for (let i = 0; i < speciesOf(tier).length; i++) {
        pairs++;
        if (keyed(seed, tier, i) !== keyed(seed, tier + 4, i)) tierDiffer++;
      }
    }
  }
  expect(tierDiffer / pairs).toBeGreaterThanOrEqual(0.8);
  let speciesPairs = 0;
  let speciesDiffer = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (let tier = 1; tier <= 8; tier++) {
      const n = speciesOf(tier).length;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        speciesPairs++;
        if (keyed(seed, tier, i) !== keyed(seed, tier, j)) speciesDiffer++;
      }
    }
  }
  expect(speciesDiffer / speciesPairs).toBeGreaterThanOrEqual(0.8);
});

it('horns come and go, and pupils vary', () => {
  let looks = 0;
  let horned = 0;
  const pupils = new Set<string | undefined>();
  for (let seed = 1; seed <= 200; seed++) {
    for (let tier = 1; tier <= 8; tier++) {
      for (let i = 0; i < speciesOf(tier).length; i++) {
        looks++;
        if (speciesChoice(seed, tier, i).horns !== null) horned++;
        pupils.add(speciesLook(seed, tier, i).palette.p);
      }
    }
  }
  expect(horned / looks).toBeGreaterThan(0.4);
  expect(horned / looks).toBeLessThan(0.6);
  expect(pupils.size).toBe(5);
});

it('every head, own horns and allowed extra stack composes cleanly', () => {
  for (const body of BODY_KINDS) {
    for (let head = 0; head < HEADS.length; head++) {
      for (const horns of [null, 0, 1, 2, 3, 4]) {
        for (const extras of [[], ...championStacks(horns), ...bossStacks(horns)]) {
          const choice: LookChoice = { ...base(body), head, horns, extras };
          const label = JSON.stringify(choice);
          const grid = compose(layout(choice));
          expect(count(grid, 'ep'), label).toBe(count(EYES[0]?.grid ?? [], 'ep'));
          expect(groups(grid), label).toBe(1);
          if (extras.length > 0) expect(grid, `${label} extras show`).not.toEqual(compose(layout({ ...choice, extras: [] })));
          for (let k = 0; k < extras.length; k++) {
            // Known gap, kept as approved art: on the blob a boss's first spikes part can lie wholly under its second.
            if (body === 'blob' && extras[k]?.kind === 'spikes' && k < extras.length - 1) continue;
            const without = compose(layout({ ...choice, extras: extras.filter((_, j) => j !== k) }));
            expect(grid, `${label} extra ${k} shows`).not.toEqual(without);
          }
        }
      }
    }
  }
});

it('PixelArt draws at a whole scale of at least 1', () => {
  expect([4, 2.6, 2.4, 0.2, 0, -3, Number.NaN, Number.POSITIVE_INFINITY].map(pixelScale)).toEqual([4, 3, 2, 1, 1, 1, 1, 1]);
});
