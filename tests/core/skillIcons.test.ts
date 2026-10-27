import { expect, it } from 'vitest';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import { PASSIVE_NODES } from '../../src/core/passives';
import {
  ICON_FRAMES,
  ICON_GLYPHS,
  ICON_PALETTE,
  ICON_SIZE,
  SIDE_COLOURS,
  composeIcon,
  iconForAscendancy,
  iconForPassive,
  type IconFrameKind,
  type IconGlyphId,
} from '../../src/core/skillIcons';

const FRAME_KINDS: readonly IconFrameKind[] = ['small', 'notable', 'keystone', 'start', 'ascendancy'];
const GLYPH_IDS = Object.keys(ICON_GLYPHS) as IconGlyphId[];
const SIDES = Object.keys(SIDE_COLOURS) as (keyof typeof SIDE_COLOURS)[];

it('every passive and ascendancy node resolves to a known glyph', () => {
  expect(PASSIVE_NODES).toHaveLength(202);
  expect(ASCENDANCY_NODES).toHaveLength(81);
  for (const node of PASSIVE_NODES) {
    const id = iconForPassive(node);
    expect(ICON_GLYPHS[id], `${node.kind} ${node.id}`).toBeDefined();
  }
  for (const node of ASCENDANCY_NODES) {
    const id = iconForAscendancy(node);
    expect(ICON_GLYPHS[id], `${node.kind} ${node.id}`).toBeDefined();
  }
});

it('all named nodes keep their own glyph and the starts use the miner faces', () => {
  const keystones = PASSIVE_NODES.filter((node) => node.kind === 'keystone').map((node) => node.id);
  const notables = PASSIVE_NODES.filter((node) => node.kind === 'notable').map((node) => node.id);
  const ascendancyNotables = ASCENDANCY_NODES.filter((node) => node.kind === 'mid' || node.kind === 'big')
    .map((node) => node.id);
  expect(keystones.sort()).toEqual([
    'allOrNothing', 'berserker', 'bloodMoney', 'bulwark', 'cartographer', 'deepBreath', 'deepPockets',
    'earthshaker', 'oreBaron', 'prospectorsEye', 'prospectorsLuck', 'soulDebt', 'soulReaper', 'twoWayStreet',
  ]);
  expect(notables).toHaveLength(22);
  expect(new Set(notables).size).toBe(22);
  expect(ascendancyNotables).toHaveLength(16);
  expect(new Set(ascendancyNotables).size).toBe(16);
  for (const id of [...keystones, ...notables, ...ascendancyNotables]) {
    expect(ICON_GLYPHS[id as IconGlyphId], id).toBeDefined();
  }
  for (const node of PASSIVE_NODES.filter((n) => n.kind === 'keystone' || n.kind === 'notable')) {
    expect(iconForPassive(node), node.id).toBe(node.id);
  }
  for (const node of ASCENDANCY_NODES.filter((n) => n.kind === 'mid' || n.kind === 'big')) {
    expect(iconForAscendancy(node), node.id).toBe(node.id);
  }
  const passiveStart = PASSIVE_NODES.find((node) => node.kind === 'start');
  const ascendancyStart = ASCENDANCY_NODES.find((node) => node.kind === 'start');
  expect(passiveStart).toBeDefined();
  expect(ascendancyStart).toBeDefined();
  if (passiveStart !== undefined) expect(iconForPassive(passiveStart)).toBe('miner');
  if (ascendancyStart !== undefined) expect(iconForAscendancy(ascendancyStart)).toBe('minerReborn');
});

it('passive smalls use their first effect, including stats and structural bonuses', () => {
  for (const node of PASSIVE_NODES.filter((n) => n.kind === 'small')) {
    const effect = node.effects[0];
    expect(effect, node.id).toBeDefined();
    if (effect === undefined) continue;
    const expected = effect.kind === 'stat' ? effect.stat : effect.kind;
    expect(iconForPassive(node), node.id).toBe(expected);
  }

  const digPower = PASSIVE_NODES.find((node) => node.kind === 'small'
    && node.effects[0]?.kind === 'stat' && node.effects[0].stat === 'digPower');
  expect(digPower).toBeDefined();
  if (digPower !== undefined) expect(iconForPassive(digPower)).toBe('digPower');

  const gemPouch = PASSIVE_NODES.find((node) => node.id === 'gemPouch');
  expect(gemPouch).toBeDefined();
  if (gemPouch !== undefined) expect(iconForPassive(gemPouch)).toBe('gemPouch');

  const surveyor = PASSIVE_NODES.find((node) => node.id === 'surveyor');
  expect(surveyor).toBeDefined();
  if (surveyor !== undefined) expect(iconForPassive(surveyor)).toBe('surveyor');

  const earthshaker = PASSIVE_NODES.find((node) => node.id === 'earthshaker');
  expect(earthshaker).toBeDefined();
  if (earthshaker !== undefined) expect(iconForPassive(earthshaker)).toBe('earthshaker');
});

it('every ascendancy small resolves to its cluster group glyph at its slot tier', () => {
  const groups = ['wealth', 'depth', 'insight', 'cartography', 'endurance', 'fortuna', 'might', 'greed'] as const;
  for (const group of groups) {
    const smalls = ASCENDANCY_NODES.filter((node) => node.kind === 'small' && node.group === group);
    expect(smalls, group).toHaveLength(8);
    // Each cluster reads as one family: eight distinct variations, none falling back to a stat glyph.
    const seen = new Set(smalls.map((node) => iconForAscendancy(node)));
    expect(seen.size, group).toBe(8);
    for (const node of smalls) {
      const variation = node.variation;
      expect(variation, node.id).toBeGreaterThanOrEqual(1);
      expect(variation, node.id).toBeLessThanOrEqual(8);
      const prefix = group.charAt(0).toUpperCase() + group.slice(1);
      expect(iconForAscendancy(node), node.id).toBe(`group${prefix}${variation}`);
    }
  }
  // The mapping table (8 × 8) is pinned.
  expect(iconForAscendancy(ascendancyNode('wealthSmall1'))).toBe('groupWealth1');
  expect(iconForAscendancy(ascendancyNode('wealthSmall8'))).toBe('groupWealth8');
  expect(iconForAscendancy(ascendancyNode('depthSmall1'))).toBe('groupDepth1');
  expect(iconForAscendancy(ascendancyNode('greedSmall8'))).toBe('groupGreed8');
  expect(iconForAscendancy(ascendancyNode('mightSmall5'))).toBe('groupMight5');
});

const ascendancyNode = (id: string) => {
  const node = ASCENDANCY_NODES.find((n) => n.id === id);
  if (node === undefined) throw new Error(`missing ascendancy node ${id}`);
  return node;
};

it('every glyph is 16 × 16 with only glyph-palette letters', () => {
  expect(GLYPH_IDS).toHaveLength(158);
  for (const id of GLYPH_IDS) {
    const glyph = ICON_GLYPHS[id];
    expect(glyph.grid, id).toHaveLength(16);
    expect(glyph.anchor, id).toEqual([8, 8]);
    for (const row of glyph.grid) {
      expect(row.length, `${id}: ${row}`).toBe(16);
      expect(row.includes('a') || row.includes('A'), `${id} must not use a frame accent`).toBe(false);
      for (const c of row) {
        if (c === '.') continue;
        expect(ICON_PALETTE[c], `${id}: '${c}'`).toBeDefined();
      }
    }
  }
});

/** The filled positions of a glyph grid, as `x,y` keys. */
const filledPositions = (grid: readonly string[]): Set<string> => {
  const out = new Set<string>();
  grid.forEach((row, y) => {
    [...row].forEach((c, x) => { if (c !== '.') out.add(`${x},${y}`); });
  });
  return out;
};

it('the eight group glyphs are distinct and each variation fills one more slot', () => {
  const groups = ['wealth', 'depth', 'insight', 'cartography', 'endurance', 'fortuna', 'might', 'greed'] as const;
  const bases = groups.map((group) => ICON_GLYPHS[`group${group.charAt(0).toUpperCase()}${group.slice(1)}8` as IconGlyphId]);
  // The eight families are genuinely distinct from one another.
  for (let a = 0; a < bases.length; a++) {
    for (let b = a + 1; b < bases.length; b++) {
      expect(bases[a]?.grid, groups[a]).not.toEqual(bases[b]?.grid);
    }
  }
  for (const group of groups) {
    const prefix = group.charAt(0).toUpperCase() + group.slice(1);
    for (let n = 1; n <= 8; n++) {
      const id = `group${prefix}${n}` as IconGlyphId;
      expect(ICON_GLYPHS[id], id).toBeDefined();
      if (n > 1) {
        const prevId = `group${prefix}${n - 1}` as IconGlyphId;
        const prev = filledPositions(ICON_GLYPHS[prevId].grid);
        const curr = filledPositions(ICON_GLYPHS[id].grid);
        // Monotonic: a slot only adds (or repaints) pixels, never removes them.
        for (const px of prev) expect(curr.has(px), `${id} keeps ${px}`).toBe(true);
        // Each tier lights one more slot, so it differs from the one before.
        expect(ICON_GLYPHS[id].grid, id).not.toEqual(ICON_GLYPHS[prevId].grid);
      }
    }
    // Eight escalating tiers within one family: none equals another.
    for (let n = 1; n <= 8; n++) {
      for (let m = n + 1; m <= 8; m++) {
        expect(ICON_GLYPHS[`group${prefix}${n}` as IconGlyphId].grid, `${prefix}${n}`)
          .not.toEqual(ICON_GLYPHS[`group${prefix}${m}` as IconGlyphId].grid);
      }
    }
  }
});

it('composeIcon frames a group glyph and never throws', () => {
  const icon = composeIcon('small', 'groupWealth3', 'ascendancy');
  expect(icon.id).toBe('groupWealth3');
  expect(icon.grid).toHaveLength(ICON_SIZE);
  for (const row of icon.grid) expect(row).toHaveLength(ICON_SIZE);
  expect(composeIcon('small', 'groupGreed8', 'ascendancy').id).toBe('groupGreed8');
});

it('every frame is 24 × 24 with the glyph socket at (4, 4)', () => {
  for (const kind of FRAME_KINDS) {
    const frame = ICON_FRAMES[kind];
    expect(frame.grid, kind).toHaveLength(ICON_SIZE);
    expect(frame.glyphAt, kind).toEqual([4, 4]);
    for (const row of frame.grid) expect(row.length, kind).toBe(ICON_SIZE);
    expect(frame.palette.a).toBeTypeOf('string');
    expect(frame.palette.A).toBeTypeOf('string');
    for (const row of frame.grid) {
      for (const c of row) {
        if (c === '.') continue;
        expect(frame.palette[c], `${kind}: '${c}'`).toBeDefined();
      }
    }
  }
});

it('the frames are round: the four corners are cut and the glyph socket stays a clean 16 × 16 canvas', () => {
  for (const kind of FRAME_KINDS) {
    const frame = ICON_FRAMES[kind];
    // The square corners are cut to a circle.
    expect(frame.grid[0]?.[0], kind).toBe('.');
    expect(frame.grid[0]?.[ICON_SIZE - 1], kind).toBe('.');
    expect(frame.grid[ICON_SIZE - 1]?.[0], kind).toBe('.');
    expect(frame.grid[ICON_SIZE - 1]?.[ICON_SIZE - 1], kind).toBe('.');
    // The circle still reaches each edge, so the frame reads as a ring, not a shrunken blob.
    const rowHasColour = (row: string | undefined) => (row ?? '').split('').some((c) => c !== '.');
    expect(rowHasColour(frame.grid[0]), `${kind} top`).toBe(true);
    expect(rowHasColour(frame.grid[ICON_SIZE - 1]), `${kind} bottom`).toBe(true);
    expect(frame.grid.some((row) => row[0] !== '.'), `${kind} left`).toBe(true);
    expect(frame.grid.some((row) => row[ICON_SIZE - 1] !== '.'), `${kind} right`).toBe(true);
    // The glyph socket at rows/cols 4–19 is a blank canvas: the border is a ring outside it, never clipping a glyph.
    for (let y = 4; y < 20; y++) {
      for (let x = 4; x < 20; x++) expect(frame.grid[y]?.[x], `${kind} socket ${x},${y}`).toBe('.');
    }
  }
});

it('composeIcon frames every kind for a representative glyph', () => {
  for (const kind of FRAME_KINDS) {
    const icon = composeIcon(kind, 'miner', 'start');
    expect(icon.id, kind).toBe('miner');
    expect(icon.grid, kind).toHaveLength(ICON_SIZE);
    for (const row of icon.grid) expect(row.length, kind).toBe(ICON_SIZE);
  }
});

it('every composed pixel has a colour in the merged palette', () => {
  for (const kind of FRAME_KINDS) {
    for (const side of SIDES) {
      for (const id of GLYPH_IDS) {
        const icon = composeIcon(kind, id, side);
        for (const row of icon.grid) {
          for (const c of row) {
            if (c === '.') continue;
            expect(icon.palette[c], `${kind}/${id}/${side}: '${c}'`).toBeDefined();
          }
        }
      }
    }
  }
});

it('composes deterministically and recolours the accent by side', () => {
  for (const kind of FRAME_KINDS) {
    for (const id of GLYPH_IDS) {
      const a = composeIcon(kind, id, 'mining');
      const b = composeIcon(kind, id, 'mining');
      expect(b, `${kind}/${id}`).toEqual(a);
    }
  }
  for (const side of SIDES) {
    const icon = composeIcon('notable', 'earthshaker', side);
    expect(icon.palette.a).toBe(SIDE_COLOURS[side].a);
    expect(icon.palette.A).toBe(SIDE_COLOURS[side].A);
  }
});
