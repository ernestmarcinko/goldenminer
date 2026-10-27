import { GRIDS, type SpriteName } from '../sprites/grids';
import { ASCENDANCY_GROUPS, type AscendancyGroupId, type AscendancyNode } from './ascendancy';
import type { StatKey } from './items';
import type { PassiveNode } from './passives';

/**
 * The hand-drawn icon kit for the passive and ascendancy trees.
 *
 * Every glyph is a 16 × 16 grid of one-letter palette colours, centred in a 24 × 24 frame. The frames carry the
 * side's accent (`a`/`A`); the glyphs themselves stay bone, steel, gold, wood and blood so they read when a node is
 * dim. The composer is pure: no React, no canvas, no DOM.
 */
export type IconFrameKind = 'small' | 'notable' | 'keystone' | 'start' | 'ascendancy';
export interface IconGlyph { grid: string[]; anchor: [number, number] }
export interface IconFrame { grid: string[]; glyphAt: [number, number]; palette: Record<string, string> }

export const ICON_SIZE = 24;
export const GLYPH_SIZE = 16;
const GLYPH_AT: [number, number] = [4, 4];

export type KeystoneGlyphId =
  | 'earthshaker' | 'cartographer' | 'prospectorsLuck' | 'berserker'
  | 'soulReaper' | 'bulwark' | 'deepPockets' | 'twoWayStreet'
  | 'oreBaron' | 'allOrNothing' | 'deepBreath' | 'bloodMoney' | 'soulDebt' | 'prospectorsEye';

export type PassiveNotableGlyphId =
  | 'veinSense' | 'prospector' | 'deepLungs' | 'oreSniffer' | 'steadyHands'
  | 'thickSkin' | 'sharpened' | 'deadlyAim' | 'soulWarden' | 'treasureHunter'
  | 'lampAndBlade' | 'wellRested' | 'sureFooting' | 'careful' | 'gemPouch'
  | 'oreCart' | 'surveyor' | 'deepMiner' | 'reckoner' | 'vanguard' | 'alchemist' | 'nightowl';

export type AscendancyNamedGlyphId =
  | 'midasTouch' | 'deepRoots' | 'secondSight' | 'masterSurveyor' | 'tireless' | 'luckyBreak'
  | 'goldRush' | 'worldCore' | 'thirdEye' | 'worldAtlas' | 'perpetualMotion' | 'jackpot'
  | 'gladiator' | 'colossus' | 'deepVeins' | 'elDorado';

export type StructuralGlyphId =
  | 'gemStack' | 'materialStack' | 'stashPages' | 'autoMap'
  | 'startingDepth' | 'passivePoints' | 'autoMapTier';

/** The one-icon-per-family glyphs the achievement toasts and tab share (Plan 32). */
export type AchievementFamilyGlyphId =
  | 'heart' | 'flask' | 'star' | 'skull' | 'anvil';

/** The 64 composed group-glyph ids: each cluster's base at slot tiers 1–8 (`groupWealth1` … `groupGreed8`). */
type GroupVariation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type AscendancyGroupGlyphId = `group${Capitalize<AscendancyGroupId>}${GroupVariation}`;

export type IconGlyphId =
  | 'miner' | 'minerReborn'
  | KeystoneGlyphId
  | PassiveNotableGlyphId
  | AscendancyNamedGlyphId
  | AscendancyGroupGlyphId
  | StatKey
  | StructuralGlyphId
  | AchievementFamilyGlyphId;

/** The glyph palette. `a`/`A` are deliberately absent: they belong to the frame's side accent. */
export const ICON_PALETTE: Record<string, string> = {
  k: '#16110d',
  b: '#5a3a24',
  B: '#8f6138',
  d: '#332015',
  s: '#7d858c',
  S: '#cfd8de',
  g: '#b8862a',
  G: '#f0c75e',
  w: '#5c3a1e',
  W: '#a06a38',
  c: '#2f8fa8',
  C: '#a8ecf8',
  r: '#8e2f26',
  R: '#e3574b',
  t: '#e6d7b4',
  i: '#a89670',
  e: '#f7f1e3',
  p: '#15100c',
  h: '#4a1512',
  j: '#6b4429',
  f: '#ff6a2a',
  o: '#ffb347',
  u: '#9fd8ff',
  v: '#2a1838',
};

type Pixel = readonly [x: number, y: number, colour: string];

const BLANK_16 = '.'.repeat(16);

function paint(rows: readonly string[], patches: readonly Pixel[], size: number): string[] {
  const grid = rows.map((row) => [...row]);
  for (const [x, y, colour] of patches) {
    const row = grid[y];
    if (row === undefined || x < 0 || x >= size) {
      throw new Error(`icon pixel (${x}, ${y}) falls outside the ${size}×${size} grid`);
    }
    row[x] = colour;
  }
  return grid.map((row) => row.join(''));
}

function glyph(rows: readonly string[], patches: readonly Pixel[] = []): IconGlyph {
  if (rows.length !== GLYPH_SIZE) throw new Error(`icon glyph has ${rows.length} rows, expected ${GLYPH_SIZE}`);
  for (const row of rows) {
    if (row.length !== GLYPH_SIZE) throw new Error(`icon glyph row '${row}' is ${row.length} wide, expected ${GLYPH_SIZE}`);
  }
  return { grid: paint(rows, patches, GLYPH_SIZE), anchor: [8, 8] };
}

/** Turns a 12 × 12 hand drawing into a 16 × 16 glyph with a two-pixel margin all round. */
function glyph12(rows: readonly string[], patches: readonly Pixel[] = []): IconGlyph {
  if (rows.length !== 12) throw new Error(`icon drawing has ${rows.length} rows, expected 12`);
  for (const row of rows) {
    if (row.length !== 12) throw new Error(`icon drawing row '${row}' is ${row.length} wide, expected 12`);
  }
  const padded = [
    BLANK_16,
    BLANK_16,
    ...rows.map((row) => `..${row}..`),
    BLANK_16,
    BLANK_16,
  ];
  return glyph(padded, patches);
}

/**
 * Reuses an item sprite as a glyph, centred in the 16 × 16 canvas. `letters` translates the sprite palette's extra
 * letters (`l`, `L`, `y`, `p`, `P`, `v`, …) into the icon palette; the source art is never drawn, so nothing clips.
 */
function spriteGlyph(name: SpriteName, letters: Record<string, string> = {}): IconGlyph {
  const source = GRIDS[name];
  const width = source[0]?.length ?? 0;
  const left = Math.floor((GLYPH_SIZE - width) / 2);
  const top = Math.floor((GLYPH_SIZE - source.length) / 2);
  if (left < 0 || top < 0 || left + width > GLYPH_SIZE || top + source.length > GLYPH_SIZE) {
    throw new Error(`item sprite ${name} does not fit a ${GLYPH_SIZE}×${GLYPH_SIZE} glyph`);
  }
  const rows = Array.from({ length: GLYPH_SIZE }, () => Array<string>(GLYPH_SIZE).fill('.'));
  source.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const raw = line[x];
      if (raw === undefined || raw === '.') continue;
      const row = rows[top + y];
      if (row === undefined) throw new Error(`item sprite ${name} clips on row ${top + y}`);
      const mapped = letters[raw] ?? raw;
      row[left + x] = mapped;
    }
  });
  return { grid: rows.map((row) => row.join('')), anchor: [8, 8] };
}

// The starts, keystones and notables.
const MINER = glyph12([
  '....kkkk....',
  '...kGggGk...',
  '..kkGGGGkk..',
  '.kjjjjjjjjk.',
  'kjWWWWWWWWjk',
  'kjttttttttjk',
  'kttttttttttk',
  'kteppteppetk',
  'kttttttttttk',
  'kttkkttkkttk',
  '.kttttttttk.',
  '..kkkkkkkk..',
]);

const MINER_REBORN = glyph12([
  '.....ff.....',
  '....foof....',
  '...f.oo.f...',
  '..kkkkkkkk..',
  '.kjjjjjjjjk.',
  'kjWWWWWWWWjk',
  'kjttttttttjk',
  'kteppteppetk',
  'kttttttttttk',
  '.kttttttttk.',
  '..kttttttk..',
  '...kkkkkk...',
]);

const EARTHSHAKER = glyph12([
  '...kkkkkk...',
  '..kBBBBBBk..',
  '.kBBbbbbBBk.',
  '.kBbbkkbbBk.',
  'kBbbkookbbBk',
  'kBbbkkkkbbBk',
  'kbbkkobbbbbk',
  'kbbkbbbbkkbk',
  'kbbbbbbkoobk',
  '.kbbbbkkbbk.',
  '..kbbbbbbk..',
  '...kkkkkk...',
]);

const CARTOGRAPHER = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSbbbbbbSk.',
  '.kSbbkkbbSk.',
  'kSbbkRRkbbSk',
  'kSbbkRRkbbSk',
  'kSbbkkkkbbSk',
  'kSbbkrrkbbSk',
  'kSbbkrrkbbSk',
  '.kSbbkkbbSk.',
  '..kSbbbbSk..',
  '...kkkkkk...',
]);

const PROSPECTORS_LUCK = glyph12([
  '..kk....kk..',
  '.kCCk..kCCk.',
  '.kCCCkkCCCk.',
  '..kCCCCCCk..',
  '...kkCCkk...',
  '...kCCCCk...',
  '..kCCkkCCk..',
  '.kCCk..kCCk.',
  '.kkk....kkk.',
  '.kGGGGGGGGk.',
  'kGgggggggggk',
  '.kkkkkkkkkk.',
]);

const BERSERKER = glyph12([
  '.kk......kk.',
  'kSSk....kSSk',
  'kSsk....ksSk',
  'kSssk..kssSk',
  '.kSSskksSSk.',
  '..kSSGGSSk..',
  '...kSGGSSk..',
  '....kGGk....',
  '....kWWk....',
  '....kWWk....',
  '...kWWk.....',
  '...kkk......',
]);

const SOUL_REAPER = glyph12([
  '....kkkk....',
  '..kkSSSSkk..',
  '.kSSkkkkSSk.',
  'kSSk....kSk.',
  'kSk......kk.',
  'kSk.........',
  '.kk.........',
  '..kWWk......',
  '...kWWk.....',
  '....kWWk....',
  '.....kWWk...',
  '......kk....',
]);

const BULWARK = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSskkkkkksSk',
  'kSskttttksSk',
  'kSskteetksSk',
  'kSskttttksSk',
  'kSskkkkkksSk',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kkkk....',
]);

const DEEP_POCKETS = glyph12([
  '.....kk.....',
  '...kkjjkk...',
  '..kjjjjjjk..',
  '.kjjWjjWjjk.',
  '.kjjjjjjjjk.',
  'kjjjjjjjjjjk',
  'kjjjGGGGjjjk',
  'kjjGGGGGGjjk',
  '.kjjGGGGjjk.',
  '.kjjjjjjjjk.',
  '..kjjjjjjk..',
  '...kkkkkk...',
]);

const TWO_WAY_STREET = glyph12([
  '............',
  '............',
  '..k......k..',
  '.kGk....kGk.',
  'kGGGkkkkGGGk',
  'kGGGSSSSGGGk',
  'kGGGSSSSGGGk',
  'kGGGkkkkGGGk',
  '.kGk....kGk.',
  '..k......k..',
  '............',
  '............',
]);

const ORE_BARON = glyph12([
  '....kCCk....',
  '...kCCCCk...',
  '...kCccCk...',
  '....kkkk....',
  '...kGGGGk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '..kGggggGk..',
  '..kGGggGGk..',
  '...kGGGGk...',
  '....kkkk....',
  '............',
]);

const ALL_OR_NOTHING = glyph12([
  '.....kk.....',
  '....kGGk....',
  '....kGGk....',
  '...kGGGGk...',
  '..kGGGGGGk..',
  'kkGGGGGGGGkk',
  '.kGGGGGGGGk.',
  '..kGGGGGGk..',
  '...kGGGGk...',
  '....kGGk....',
  '.....kk.....',
  '............',
]);

const DEEP_BREATH = glyph12([
  '...kk..kk...',
  '..kuukkuuk..',
  '.kuuukkuuuk.',
  '.kuuk..kuuk.',
  'kuuuk..kuuuk',
  'kuuuk..kuuuk',
  'kuuuk..kuuuk',
  'kuuuk..kuuuk',
  '.kuuk..kuuk.',
  '..kuukkuuk..',
  '...kuuuuk...',
  '....kkkk....',
]);

const BLOOD_MONEY = glyph12([
  '....kkkk....',
  '...kGGGGk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '..kGgRRgGk..',
  '..kGgRRgGk..',
  '..kGggggGk..',
  '..kGGggGGk..',
  '...kGGGGk...',
  '....kkkk....',
  '............',
  '............',
]);

const SOUL_DEBT = glyph12([
  '.....kk.....',
  '....kuuk....',
  '...kuCCuk...',
  '..kuCCCCuk..',
  '..kuCCCCuk..',
  '...kuCCuk...',
  '....kuuk....',
  '.....kk.....',
  '...kkkkkk...',
  '..kjjjjjjk..',
  '..kj....jk..',
  '...kkkkkk...',
]);

const PROSPECTORS_EYE = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSssssssSk.',
  '.kSskGGksSk.',
  '.kSsGppGsSk.',
  '.kSsGppGsSk.',
  '.kSskGGksSk.',
  '.kSssssssSk.',
  '..kSSSSSSk..',
  '...kkkkkk...',
  '............',
  '............',
]);

const VEIN_SENSE = glyph12([
  '...kkkkkk...',
  '..keeeeeek..',
  '.keepppppek.',
  '.keepppppek.',
  '..keeeeeek..',
  '...kkkkkk...',
  '....kRk.....',
  '...kRk......',
  '..kRRk......',
  '.kRk........',
  '.kRk........',
  '..kk........',
]);

const PROSPECTOR = glyph12([
  '.kk.........',
  'kSSkk.......',
  'kSSSSkk.....',
  '.kkkSSSk....',
  '....kkSSk...',
  '......kSk...',
  '.....kSk....',
  '....kSk.....',
  '...kSk......',
  '..kWk..kk...',
  '.kWk..kGgk..',
  '.kk...kkk...',
]);

const DEEP_LUNGS = glyph12([
  '.....kk.....',
  '....kRRk....',
  '....kRRk....',
  '..kkkRRkkk..',
  '.kRRRRRRRRk.',
  'kRRRRkkRRRRk',
  'kRRRkkkkRRRk',
  'kRRRRkkRRRRk',
  'kRrrrrrrrrRk',
  '.kRrrrrrrRk.',
  '..kRrrrrRk..',
  '...kkkkkk...',
]);

const ORE_SNIFFER = glyph12([
  '....kkkk....',
  '...kttttk...',
  '..kttttttk..',
  '..ktteettk..',
  '..ktteettk..',
  '..kttkkttk..',
  '...kttttk...',
  '....kkkk....',
  '.o........o.',
  '..o......o..',
  '...kkkkkk...',
  '...kCccck...',
]);

const STEADY_HANDS = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSssssssSk.',
  '.kSkSkSkSk..',
  '.kSkSkSkSk..',
  '.kSSSSSSSSk.',
  '.kSssssssSk.',
  '.kSssssssSSk',
  '.kSssssssSSk',
  '..kSssssSk..',
  '...kSSSSk...',
  '....kkkk....',
]);

const THICK_SKIN = glyph12([
  '.kk......kk.',
  'kjjk....kjjk',
  'kjWjkkkkjWjk',
  'kjWWWWWWWWjk',
  'kjWkkkkkkWjk',
  'kjWkWWWWkWjk',
  'kjWkWWWWkWjk',
  'kjWkkkkkkWjk',
  'kjWWWWWWWWjk',
  '.kjWWWWWWjk.',
  '..kjjjjjjk..',
  '...kkkkkk...',
]);

const SHARPENED = glyph12([
  '.........o..',
  '........ooo.',
  '.......o.o..',
  '...kkkkkkk..',
  '..kSSSSSSSk.',
  '.kSssssssSSk',
  '.kSssssssSSk',
  '.kSssssssSSk',
  '.kSSSSSSSSSk',
  '..kkkkkkkkk.',
  '............',
  '............',
]);

const DEADLY_AIM = glyph12([
  '....kkkk....',
  '..kk....kk..',
  '.k........k.',
  '.k...kk...k.',
  '.k..kRRk..k.',
  'kk..kRRk..kk',
  'kk..kRRk..kk',
  '.k..kRRk..k.',
  '.k...kk...k.',
  '.k........k.',
  '..kk....kk..',
  '....kkkk....',
]);

const SOUL_WARDEN = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSskkkkkksSk',
  'kSskuCCuksSk',
  'kSskuCCuksSk',
  'kSskuuuuksSk',
  'kSskkuukksSk',
  '.kSsskuuksSk',
  '..kSssssssSk',
  '...kSssssSk.',
  '....kkkkkk..',
]);

const TREASURE_HUNTER = glyph12([
  '.....kk.....',
  '....kGGk....',
  '....kGGk....',
  '.kkkGGGGkkk.',
  'kGGGGGGGGGGk',
  '.kkkGGGGkkk.',
  '....kGGk....',
  '..kkkkkkkk..',
  '.kWWWWWWWWk.',
  '.kWwkGGkwWk.',
  '.kWWWWWWWWk.',
  '..kkkkkkkk..',
]);

const LAMP_AND_BLADE = glyph12([
  '...kkkk.....',
  '..kGggGk....',
  '..kGggGk.kk.',
  '..kGggGk.kSk',
  '..kGggGk.kSk',
  '...kGGk..kSk',
  '...kGGk..kSk',
  '...kGGk..kSk',
  '..kGggGk.kSk',
  '..kGggGk.kSk',
  '..kGggGk.kSk',
  '...kkkk..kkk',
]);

const WELL_RESTED = glyph12([
  '.....kkkk...',
  '...kkGGGGk..',
  '..kGGkkkkk..',
  '.kGGk.......',
  '.kGk........',
  'kGGk........',
  'kGGk........',
  'kGGk........',
  '.kGk........',
  '.kGGk.......',
  '..kGGkkkkk..',
  '...kkGGGGk..',
]);

const SURE_FOOTING = glyph12([
  '...kkkk.....',
  '..kjjjjk....',
  '..kjjjjk....',
  '..kjjjjk....',
  '..kjjjjk....',
  '..kjjjjk....',
  '..kjjjjkk...',
  '..kjjjjjjk..',
  '..kjjjjjjjk.',
  '..kjjjjjjjjk',
  '..kkkkkkkkkk',
  '............',
]);

const CAREFUL = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSskkkkkksSk',
  'kSskeeeeksSk',
  'kSskepkeksSk',
  'kSskeeeeksSk',
  'kSskkkkkksSk',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kkkk....',
]);

const GEM_POUCH = glyph12([
  '....kkkk....',
  '...kCccCk...',
  '..kCccccbk..',
  '...kkkkkk...',
  '..kjjjjjjk..',
  '.kjjWjjWjjk.',
  'kjjjjjjjjjjk',
  'kjjjkkkkjjjk',
  'kjjjjjjjjjjk',
  '.kjjjjjjjjk.',
  '..kjjjjjjk..',
  '...kkkkkk...',
]);

const ORE_CART = glyph12([
  '....kkkk....',
  '...kCccck...',
  '..kCccccbk..',
  '...kkkkkk...',
  '..kkkkkkkk..',
  '.kWWWWWWWWk.',
  '.kWwwwwwwWk.',
  '.kWWWWWWWWk.',
  '..kkkkkkkk..',
  '.kSk....kSk.',
  'kSkkk..kkkSk',
  '.kkk....kkk.',
]);

const SURVEYOR = glyph12([
  '.kkkkkkkkkk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.ktteeeettk.',
  '.ktteppettk.',
  '.ktteeeettk.',
  '.ktiiiiiitk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.kttttttttk.',
  '.kkkkkkkkkk.',
  '............',
]);

const DEEP_MINER = glyph12([
  '.....kk.....',
  '....kSSk....',
  '...kSSSSk...',
  '..kSSSSSSk..',
  '..kSSSSSSk..',
  '...kSSSSk...',
  '....kSSk....',
  '.....kk.....',
  '...kGGGGk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '...kkkkkk...',
]);

const RECKONER = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSSSSSSSSk.',
  'kSSR....RSSk',
  'kSS.kRRk.SSk',
  'kSS.kRRk.SSk',
  'kSSR....RSSk',
  '.kSSSSSSSSk.',
  '..kSSSSSSk..',
  '...kkkkkk...',
  '............',
  '............',
]);

const VANGUARD = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSSssssssSSk',
  'kSskkkkkksSk',
  'kSskkRRkksSk',
  'kSskkRRkksSk',
  'kSskRRRRksSk',
  'kSskkRRkksSk',
  'kSskkRRkksSk',
  'kSskkkkkksSk',
  '.kSssssssSk.',
  '..kkkkkkkk..',
]);

const ALCHEMIST = glyph12([
  '.....kk.....',
  '....kSSk....',
  '....kSSk....',
  '...kkkkkk...',
  '..kGggggGk..',
  '.kGggggggGk.',
  '.kGgGGGGgGk.',
  '.kGgGccGgGk.',
  '.kGgGGGGgGk.',
  '.kGggggggGk.',
  '..kGggggGk..',
  '...kkkkkk...',
]);

const NIGHTOWL = glyph12([
  '...kkkk.....',
  '..kSSSSk....',
  '.kSSssSSk...',
  '.kSSssSSk...',
  '..kSSSSk....',
  '...kkkk.....',
  '.....o......',
  '....o.o.....',
  '.....o......',
  '............',
  '............',
  '............',
]);

const MIDAS_TOUCH = glyph12([
  '....kkkk....',
  '...kGggGk...',
  '..kGggggGk..',
  '..kGggggGk..',
  '...kGggGk...',
  '....kkkk....',
  '..kkkkkkkk..',
  '.kttkttkttk.',
  '.kttkttkttk.',
  'kttttttttttk',
  'kttttttttttk',
  '.kkkkkkkkkk.',
]);

const DEEP_ROOTS = glyph12([
  '.....kk.....',
  '....kWWk....',
  '...kWWWWk...',
  '..kWWkkWWk..',
  '.kWWk..kWWk.',
  '.kWk....kWk.',
  'kWWk....kWWk',
  'kWk......kWk',
  'kWWk....kWWk',
  '.kWk....kWk.',
  'kWWk....kWWk',
  'kkk......kkk',
]);

const SECOND_SIGHT = glyph12([
  '............',
  '...kkkkkk...',
  '.kkeeeeekk..',
  'keeeeeeeeeek',
  'keeeCCCCeeek',
  'keeCCppCCeek',
  'keeCCppCCeek',
  'keeeCCCCeeek',
  'keeeeeeeeeek',
  '.kkeeeeekk..',
  '...kkkkkk...',
  '............',
]);

const MASTER_SURVEYOR = glyph12([
  '.kkkkkkkkkk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.ktiiRRiitk.',
  '.ktiRRRRitk.',
  '.ktiiRRiitk.',
  '.ktiiiiiitk.',
  '.ktiiiiiiitk',
  '.kttttttttk.',
  '.kkkkkkkkkk.',
  '............',
  '............',
]);

const TIRELESS = glyph12([
  '.kkkkkkkkkk.',
  '.kSSSSSSSSk.',
  '.kSggggggSk.',
  '..kSggggSk..',
  '...kSggSk...',
  '....kSSk....',
  '....kggk....',
  '...kSggSk...',
  '..kSggggSk..',
  '.kSggggggSk.',
  '.kSSSSSSSSk.',
  '.kkkkkkkkkk.',
]);

const LUCKY_BREAK = glyph12([
  '..kk....kk..',
  '.kCCk..kCCk.',
  '.kCCCkkCCCk.',
  '..kCCCCCCk..',
  '...kkCCkk...',
  '...kCCCCk...',
  '..kCCkkCCk..',
  '.kCCk..kCCk.',
  '.kkk....kkk.',
  '..o......o..',
  '...o....o...',
  '............',
]);

const GOLD_RUSH = glyph12([
  '..kk....kk..',
  '.kGGk..kGGk.',
  '.kGgk..kGgk.',
  '..kk....kk..',
  '...kkkkkk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '...kkkkkk...',
  '....kGGk....',
  '....kGgk....',
  '....kkkk....',
  '............',
]);

const WORLD_CORE = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSssssssSk.',
  '.kSskGGksSk.',
  '.kSsGppGsSk.',
  '.kSsGppGsSk.',
  '.kSskGGksSk.',
  '.kSssssssSk.',
  '..kSSSSSSk..',
  '...kkkkkk...',
  '.....kk.....',
  '.....kk.....',
]);

const THIRD_EYE = glyph12([
  '...kk.kk....',
  '..kGGkGGk...',
  '..kGpkGpk...',
  '..kGGkGGk...',
  '...kk.kk....',
  '..kkkkkkkk..',
  '.keeeeeeeeek',
  '.keeGppGeeek',
  '.keeGppGeeek',
  '.keeeeeeeeek',
  '..keeeeeek..',
  '...kkkkkk...',
]);

const WORLD_ATLAS = glyph12([
  '.kkkkkkkkkk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.ktikkkkitk.',
  '.ktikRRkitk.',
  '.ktikRRkitk.',
  '.ktikkkkitk.',
  '.ktiiiiiitk.',
  '.kttttttttk.',
  '.kkkkkkkkkk.',
  '............',
  '............',
]);

const PERPETUAL_MOTION = glyph12([
  '..kk....kk..',
  '.kGGk..kGGk.',
  'kGGGGkkGGGGk',
  'kGGGGSSGGGGk',
  'kGGGGSSGGGGk',
  '.kGGkkkkGGk.',
  '..kkGGGGkk..',
  '.kGGGGGGGGk.',
  'kGGGGGGGGGGk',
  '.kGGGGGGGGk.',
  '..kkkkkkkk..',
  '............',
]);

const JACKPOT = glyph12([
  '....o..o....',
  '...ooo.oo...',
  '....o..o....',
  '..kkkkkkkk..',
  '.kGGGGGGGGk.',
  '.kGgGGggGgk.',
  '.kGgGGggGgk.',
  '.kGGGGGGGGk.',
  '..kkkkkkkk..',
  '...kGGGGk...',
  '...kggggk...',
  '....kkkk....',
]);

const GLADIATOR = glyph12([
  '....kkkk....',
  '...kSSSSk...',
  '..kSSSSSSk..',
  '...kSSSSk...',
  '....kSSk....',
  '.....kk.....',
  '....kWWk....',
  '...kWWWWk...',
  '....kWWk....',
  '....kWWk....',
  '.....kk.....',
  '............',
]);

const COLOSSUS = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSskkkkkksSk',
  'kSskWWWWksSk',
  'kSskWWWWksSk',
  'kSskWWWWksSk',
  'kSskkkkkksSk',
  'kSssssssssSk',
  '.kSSSSSSSSk.',
  '..kkkkkkkk..',
  '............',
]);

const DEEP_VEINS = glyph12([
  '..kk....kk..',
  '.kCCk..kCCk.',
  '.kCcbk.kCcbk',
  '.kcbk...kcbk',
  '..kk.....kk.',
  '...kkkkkk...',
  '..kCCcccck..',
  '.kCccccccbk.',
  '..kcccccbk..',
  '...kcccbk...',
  '....kcbk....',
  '.....kk.....',
]);

const EL_DORADO = glyph12([
  '....kkkk....',
  '...kGGGGk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '..kGGggGGk..',
  '...kGGGGk...',
  '....kkkk....',
  '.kkkkkkkkkk.',
  'kGGGGGGGGGGk',
  'kGggggggggGk',
  '.kkkkkkkkkk.',
  '............',
]);

// ---- The eight ascendancy group glyphs (Plan 29) ----
// Each cluster is one hand-drawn 16 × 16 base with eight built-in "slots". A tiny painter fills the first `n` slots for
// variation `n`, so the eight smalls of a cluster read as one family escalating outward toward its mid/big.

interface GroupGlyphSpec {
  /** The always-present skeleton: a 16 × 16 grid where `.` is empty. */
  skeleton: string[];
  /** Eight slots in fill order; each is the pixels it lights up. */
  slots: readonly (readonly Pixel[])[];
}

/** Composes a group glyph with the first `n` of eight slots filled, into a 16 × 16 glyph centred at its anchor. */
function groupGlyph(spec: GroupGlyphSpec, n: number): IconGlyph {
  if (spec.skeleton.length !== GLYPH_SIZE) {
    throw new Error(`group skeleton has ${spec.skeleton.length} rows, expected ${GLYPH_SIZE}`);
  }
  for (const row of spec.skeleton) {
    if (row.length !== GLYPH_SIZE) throw new Error(`group skeleton row '${row}' is ${row.length} wide, expected ${GLYPH_SIZE}`);
  }
  if (spec.slots.length !== 8) throw new Error(`group glyph has ${spec.slots.length} slots, expected 8`);
  if (n < 1 || n > 8) throw new Error(`group variation ${n} is outside 1–8`);
  const grid = spec.skeleton.map((row) => [...row]);
  for (let i = 0; i < n; i++) {
    const slot = spec.slots[i];
    if (slot === undefined) throw new Error(`group glyph slot ${i} is missing`);
    for (const [x, y, colour] of slot) {
      const row = grid[y];
      if (row === undefined || x < 0 || x >= GLYPH_SIZE) {
        throw new Error(`group slot pixel (${x}, ${y}) falls outside the ${GLYPH_SIZE}×${GLYPH_SIZE} grid`);
      }
      row[x] = colour;
    }
  }
  return { grid: grid.map((row) => row.join('')), anchor: [8, 8] };
}

/** A 2 × 2 gold coin — wealth's slot. */
const coin = (x: number, y: number): Pixel[] => [
  [x, y, 'G'], [x + 1, y, 'g'], [x, y + 1, 'g'], [x + 1, y + 1, 'G'],
];
/** A 2 × 2 cyan gem — greed's slot. */
const gem = (x: number, y: number): Pixel[] => [
  [x, y, 'C'], [x + 1, y, 'c'], [x, y + 1, 'c'], [x + 1, y + 1, 'C'],
];
/** A horizontal run of one colour from x0 to x1 (inclusive) on a single row. */
const hline = (x0: number, x1: number, y: number, colour: string): Pixel[] => {
  const out: Pixel[] = [];
  for (let x = x0; x <= x1; x++) out.push([x, y, colour]);
  return out;
};
/** A map pin: a red head over a darker stem. */
const pin = (x: number, y: number): Pixel[] => [[x, y, 'R'], [x, y + 1, 'r']];

// Wealth: a gold-rimmed hoard whose eight coin slots pile from the base up to the crown.
const WEALTH: GroupGlyphSpec = {
  skeleton: [
    '................',
    '....kkkkkkkk....',
    '...kGGGGGGGGk...',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kG........Gk..',
    '..kGG......GGk..',
    '.kGGG......GGGk.',
    '.kGGGGGGGGGGGGk.',
    '.kGGGGGGGGGGGGk.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
  slots: [
    coin(4, 8), coin(6, 8), coin(8, 8), coin(10, 8),
    coin(5, 6), coin(7, 6), coin(9, 6),
    coin(7, 4),
  ],
};

// Depth: a downward shaft/drill whose eight notches deepen the shaft toward the tip.
const DEPTH: GroupGlyphSpec = {
  skeleton: [
    '................',
    '....kkkkkkkk....',
    '...kSSSSSSSk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '...kS.....Sk....',
    '.kkkSSSSSSSkkk..',
    '.kkSSSSSSSSkk...',
    '..kkkkkkkkkk....',
  ],
  slots: [
    hline(6, 8, 3, 's'), hline(6, 8, 4, 's'), hline(6, 8, 5, 's'), hline(6, 8, 6, 's'),
    hline(6, 8, 7, 's'), hline(6, 8, 8, 's'), hline(6, 8, 9, 's'), hline(6, 8, 10, 's'),
  ],
};

// Insight: an eye whose eight rays open one by one into a sunburst of vision.
const INSIGHT: GroupGlyphSpec = {
  skeleton: [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '....kkeeeeekk...',
    '..keeeeeeeeeek..',
    '..keeeCCCCeeek..',
    '..keeCCppCCeek..',
    '..keeCCppCCeek..',
    '..keeeCCCCeeek..',
    '..keeeeeeeeeek..',
    '....kkeeeeekk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  slots: [
    [[7, 1, 'G'], [8, 1, 'G']],
    [[12, 1, 'G'], [13, 2, 'G']],
    [[14, 7, 'G'], [15, 7, 'G']],
    [[14, 13, 'G'], [15, 13, 'G']],
    [[7, 14, 'G'], [8, 14, 'G']],
    [[2, 13, 'G'], [1, 13, 'G']],
    [[1, 7, 'G'], [0, 7, 'G']],
    [[2, 1, 'G'], [3, 1, 'G']],
  ],
};

// Cartography: a parchment map whose eight pins chart more and more ground.
const CARTOGRAPHY: GroupGlyphSpec = {
  skeleton: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  slots: [
    pin(4, 3), pin(7, 3), pin(10, 3),
    pin(5, 6), pin(9, 6),
    pin(4, 9), pin(7, 9), pin(10, 9),
  ],
};

// Endurance: an hourglass whose eight sand levels rise in the lower bulb as time passes.
const ENDURANCE: GroupGlyphSpec = {
  skeleton: [
    '................',
    '....kkkkkkkk....',
    '...kSSSSSSSSk...',
    '...kS......Sk...',
    '....kS....Sk....',
    '.....kS..Sk.....',
    '......kSSk......',
    '.....kS..Sk.....',
    '.....kS..Sk.....',
    '....kS....Sk....',
    '...kS......Sk...',
    '...kS......Sk...',
    '...kS......Sk...',
    '...kS......Sk...',
    '...kS......Sk...',
    '...kkkkkkkkkk...',
  ],
  slots: [
    hline(5, 10, 14, 'o'), hline(5, 10, 13, 'o'), hline(5, 10, 12, 'o'), hline(5, 10, 11, 'o'),
    hline(5, 10, 10, 'o'), hline(6, 9, 9, 'o'), hline(7, 8, 8, 'o'), hline(7, 8, 7, 'o'),
  ],
};

// Fortuna: a clover whose eight leaves unfurl around its golden heart.
const FORTUNA: GroupGlyphSpec = {
  skeleton: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......G........',
    '................',
    '................',
    '................',
    '.......c........',
    '.......c........',
    '.......c........',
    '.......c........',
    '................',
  ],
  slots: [
    [[7, 5, 'C'], [7, 4, 'C']],
    [[9, 5, 'C'], [10, 4, 'C']],
    [[9, 7, 'C'], [10, 7, 'C']],
    [[9, 9, 'C'], [10, 10, 'C']],
    [[7, 9, 'C'], [7, 10, 'C']],
    [[5, 9, 'C'], [4, 10, 'C']],
    [[5, 7, 'C'], [4, 7, 'C']],
    [[5, 5, 'C'], [4, 4, 'C']],
  ],
};

// Might: crossed blades radiating from a wooden pommel, one blade per slot.
const MIGHT: GroupGlyphSpec = {
  skeleton: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......W........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  slots: [
    [[7, 6, 'S'], [7, 5, 's'], [7, 4, 's']],
    [[8, 6, 'S'], [9, 5, 's'], [10, 4, 's']],
    [[8, 7, 'S'], [9, 7, 's'], [10, 7, 's']],
    [[8, 8, 'S'], [9, 9, 's'], [10, 10, 's']],
    [[7, 8, 'S'], [7, 9, 's'], [7, 10, 's']],
    [[6, 8, 'S'], [5, 9, 's'], [4, 10, 's']],
    [[6, 7, 'S'], [5, 7, 's'], [4, 7, 's']],
    [[6, 6, 'S'], [5, 5, 's'], [4, 4, 's']],
  ],
};

// Greed: a rock vein whose eight gems glint out as the seam is worked.
const GREED: GroupGlyphSpec = {
  skeleton: [
    '................',
    '.....kkkkkk.....',
    '...kkbbbbbbkk...',
    '..kbbbbbbbbbbk..',
    '..kbdbbbbbbbbk..',
    '.kbbbbbbbbbbbbk.',
    '.kbbbdbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbdbbbbbbk.',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '...kkbbbbbbkk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  slots: [
    gem(4, 3), gem(6, 3), gem(8, 4), gem(10, 5),
    gem(9, 6), gem(7, 7), gem(5, 8), gem(3, 9),
  ],
};

const GROUP_SPECS: Record<AscendancyGroupId, GroupGlyphSpec> = {
  wealth: WEALTH, depth: DEPTH, insight: INSIGHT, cartography: CARTOGRAPHY,
  endurance: ENDURANCE, fortuna: FORTUNA, might: MIGHT, greed: GREED,
};

/** The 64 composed group variations, keyed `groupWealth1` … `groupGreed8`. */
const GROUP_VARIATION_GLYPHS = (() => {
  const out = {} as Record<AscendancyGroupGlyphId, IconGlyph>;
  for (const group of ASCENDANCY_GROUPS) {
    const spec = GROUP_SPECS[group];
    for (let n = 1; n <= 8; n++) {
      const key = `group${group.charAt(0).toUpperCase()}${group.slice(1)}${n}` as AscendancyGroupGlyphId;
      out[key] = groupGlyph(spec, n);
    }
  }
  return out;
})();

/** The group glyph id for a cluster and slot tier: `wealth` + 3 → `groupWealth3`. */
function groupGlyphId(group: AscendancyGroupId, variation: number): AscendancyGroupGlyphId {
  return `group${group.charAt(0).toUpperCase()}${group.slice(1)}${variation}` as AscendancyGroupGlyphId;
}

// The small nodes' stat and structural glyphs.
const DIG_POWER = spriteGlyph('pickaxe');

const DIG_POWER_PCT = glyph12([
  '.k...kk.....',
  'kGk.kSSk....',
  '.kGkkSSk....',
  '..kGSSk.....',
  '...kSSk.....',
  '...kSSk.....',
  '..kSSk......',
  '.kgggk......',
  'kgggk.......',
  '.kkk........',
  '............',
  '............',
]);

const GOLD_YIELD = glyph12([
  '...kkkkkk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '...kkkkkk...',
  '.kkGGggGGkk.',
  'kGGggggggGGk',
  'kGggggggggGk',
  '.kkkkkkkkkk.',
  '.kkGGggGGkk.',
  'kGGggggggGGk',
  'kGggggggggGk',
  '.kkkkkkkkkk.',
]);

const DIAMOND_YIELD = glyph12([
  '...kkkkkk...',
  '..kCCccCCk..',
  '.kCccccccCk.',
  'kCccccccccbk',
  'kcccccccccbk',
  '.kcccccccbk.',
  '..kcccccbk..',
  '...kcccbk...',
  '....kcbk....',
  '.....kk.....',
  '............',
  '............',
]);

const VEIN_YIELD = glyph12([
  '.kk.....kk..',
  'kCCk...kCCk.',
  'kCcbk..kCcbk',
  '.kcbk...kcbk',
  '..kk.....kk.',
  '...kkkkkk...',
  '..kCCcccck..',
  '.kCccccccbk.',
  '..kcccccbk..',
  '...kcccbk...',
  '....kcbk....',
  '.....kk.....',
]);

const AUTO_TICK_RATE = glyph12([
  '....kkkk....',
  '.kkkSSSSkkk.',
  '.kSSSSSSSSk.',
  'kSSkkkkkkSSk',
  'kSSk....kSSk',
  'kSk..kk..kSk',
  'kSk..kk..kSk',
  'kSSk....kSSk',
  'kSSkkkkkkSSk',
  '.kSSSSSSSSk.',
  '.kkkSSSSkkk.',
  '....kkkk....',
]);

const TICKS_PER_CLICK = glyph12([
  '.........o..',
  '...kkkk..o..',
  '..kSSSSk....',
  '.kSssssSk...',
  '.kSkSkSk....',
  '.kSkSkSk....',
  '.kSSSSSSk...',
  '.kSsssssSk..',
  '.kSsssssSSk.',
  '..kSssssSk..',
  '...kSSSSk...',
  '....kkkk....',
]);

const SELL_BONUS = glyph12([
  '...kkkkkk...',
  '..kGGggGGk..',
  '..kGggggGk..',
  '...kkkkkk...',
  '.........kk.',
  '........kjk.',
  '.......kjjk.',
  '......kjWWjk',
  '.....kjWWjk.',
  '....kjjjjk..',
  '...kjjjjk...',
  '...kkkkk....',
]);

const CHEST_FIND = spriteGlyph('chest');

const GEM_FIND = spriteGlyph('gem');

const MAP_FIND = spriteGlyph('map', { p: 't', P: 'i', v: 'j' });

const ORE_FIND = spriteGlyph('copper');

const LAMP_SIGHT = spriteGlyph('lamphelm', { y: 'G', l: 'j', L: 'W' });

const OFFLINE_CAP = glyph12([
  '.kkkkkkkkkk.',
  '.kSSSSSSSSk.',
  '.kSttttttSk.',
  '.kSttttttSk.',
  '..kSttttSk..',
  '...kSttSk...',
  '....kSSk....',
  '...kSttSk...',
  '..kSttttSk..',
  '.kSttttttSk.',
  '.kSSSSSSSSk.',
  '.kkkkkkkkkk.',
]);

const HAZARD_WARD = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSskkkkkksSk',
  'kSskeeeeksSk',
  'kSskepkeksSk',
  'kSskeeeeksSk',
  'kSskkkkkksSk',
  '.kSstttjsSk.',
  '..kSssssSk..',
  '...kSSSSk...',
  '....kkkk....',
]);

const SALVAGE_YIELD = glyph12([
  '....kkkk....',
  '...kSSSSk...',
  '..kSSSSSSk..',
  '..kSssssSk..',
  '.kkkkkkkkkk.',
  'kSSSSSSSSSSk',
  'kSssssssssSk',
  '.kkkkkkkkkk.',
  '....kSSk....',
  '....kSSk....',
  '...kSSSSk...',
  '...kkkkkk...',
]);

const DAMAGE = glyph12([
  '.........kk.',
  '........kSSk',
  '.......kSSk.',
  '......kSSk..',
  '.....kSSk...',
  '....kSSk....',
  '...kSSk.....',
  '..kSSk......',
  '.kgggk......',
  'kgggk.......',
  'kggk........',
  '.kk.........',
]);

const DAMAGE_PCT = glyph12([
  '.k...kk.....',
  'kGk.kSSk....',
  '.kGkkSSk....',
  '..kGSSk.....',
  '...kSSk.....',
  '...kSSk.....',
  '..kSSk......',
  '.kgggk......',
  'kgggk.......',
  '.kkk........',
  '............',
  '............',
]);

const ELEMENTAL_DAMAGE = glyph12([
  '......k.....',
  '.....kfk....',
  '....kffk....',
  '...kffffk...',
  '..kffoffk...',
  '.kffoooffk..',
  '.kffooffk...',
  'kffooooffk..',
  'kffooofffk..',
  '.kfffffffk..',
  '..kfffffk...',
  '...kkkkk....',
]);

const ATTACK_SPEED = glyph12([
  '..kk....kk..',
  '.kSSk..kSSk.',
  '.kSsk..ksSk.',
  '..kSk..kSk..',
  '...kSkkSk...',
  '....kSSk....',
  '....kSSk....',
  '...kSkkSk...',
  '..kSk..kSk..',
  '.kWSk..kWSk.',
  '.kWk....kWk.',
  '..kk....kk..',
]);

const CRIT_CHANCE = glyph12([
  '...kkkkkk...',
  '.kk......kk.',
  '.k...kk...k.',
  'k...kRRk...k',
  'k..kRRRRk..k',
  'k..kRRRRk..k',
  'k...kRRk...k',
  '.k...kk...k.',
  '.kk......kk.',
  '...kkkkkk...',
  '............',
  '............',
]);

const CRIT_MULTIPLIER = glyph12([
  '.....kk.....',
  '..k..kk..k..',
  '...k.kk.k...',
  '....kkkk....',
  'kk..kRRk..kk',
  '.kkkkRRkkkk.',
  '..kRRRRRRk..',
  '.kkkkRRkkkk.',
  'kk..kRRk..kk',
  '....kkkk....',
  '...k.kk.k...',
  '..k..kk..k..',
]);

const LIFE = glyph12([
  '............',
  '.kk....kk...',
  'kRRk..kRRk..',
  'kRRRkkRRRRk.',
  'kRRRRRRRRRRk',
  'kRRRRRRRRRRk',
  '.kRRRRRRRRk.',
  '..kRRRRRRk..',
  '...kRRRRk...',
  '....kRRk....',
  '.....kk.....',
  '............',
]);

const LIFE_PCT = glyph12([
  '....kGk.....',
  '...kGGGk....',
  '....kGk.....',
  '.kk..k..kk..',
  'kRRk..kRRk..',
  'kRRRkkRRRRk.',
  'kRRRRRRRRRRk',
  'kRRRRRRRRRRk',
  '.kRRRRRRRRk.',
  '..kRRRRRRk..',
  '...kRRRRk...',
  '....kkkk....',
]);

const ARMOR = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSssssssssSk',
  'kSssssssssSk',
  'kSssssssssSk',
  '.kSssssssSk.',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kSSk....',
  '.....kk.....',
]);

const ARMOR_PCT = glyph12([
  '....kGk.....',
  '...kGGGk....',
  '....kGk.....',
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSssssssssSk',
  'kSssssssssSk',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kkkk....',
]);

const RESIST_ALL = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSsskkkkssSk',
  'kSskCCCCksSk',
  'kSskCcccksSk',
  'kSskCcccksSk',
  'kSsskkkkssSk',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kkkk....',
]);

const MAX_RESIST = glyph12([
  '..kkkkkkkk..',
  '.kSSSSSSSSk.',
  'kSssssssssSk',
  'kSsskkkkssSk',
  'kSskgGGgksSk',
  'kSskGggGksSk',
  'kSskgGGgksSk',
  'kSsskkkkssSk',
  '.kSssssssSk.',
  '..kSssssSk..',
  '...kSssSk...',
  '....kkkk....',
]);

const LIFE_REGEN = glyph12([
  '....kkkk....',
  '...kGGGGk...',
  '....kGGk....',
  '.kk..kk..kk.',
  'kRRk....kRRk',
  'kRRRkkkkRRRk',
  'kRRRRRRRRRRk',
  'kRRRRRRRRRRk',
  '.kRRRRRRRRk.',
  '..kRRRRRRk..',
  '...kRRRRk...',
  '....kkkk....',
]);

const LIFE_ON_KILL = glyph12([
  '....kkkk....',
  '...kttttk...',
  '..ktteettk..',
  '..ktteettk..',
  '..kttkkttk..',
  '...kttttk...',
  '....kkkk....',
  '.kk....kk...',
  'kRRk..kRRk..',
  'kRRRkkRRRRk.',
  '.kRRRRRRRRk.',
  '..kkkkkkkk..',
]);

const SOUL_FIND = glyph12([
  '.....kk.....',
  '....kuuk....',
  '...kuCCuk...',
  '..kuCCCCuk..',
  '..kuCCCCuk..',
  '...kuCCuk...',
  '....kuuk....',
  '...kuCCuk...',
  '..kuCCCCuk..',
  '.kuCCCCCCuk.',
  '.kuCuuuuCuk.',
  '..kkkkkkkk..',
]);

const MAGIC_FIND = glyph12([
  '.....kk.....',
  '....kGGk....',
  '....kGGk....',
  '.kkkGGGGkkk.',
  'kGGGGGGGGGGk',
  '.kkkGGGGkkk.',
  '....kGGk....',
  '....kGGk....',
  '.....kk.....',
  '..o......o..',
  '...o....o...',
  '............',
]);

const XP_FIND = glyph12([
  '..kkkkkkkk..',
  '.kttttttttk.',
  '.ktiiiiiiitk',
  '.kttttttttk.',
  '.ktiiiiiiitk',
  '.kttttttttk.',
  '.ktiiiiiiitk',
  '.kttttttttk.',
  '..kkkkkkkk..',
  '....kjj.....',
  '....kjj.....',
  '....kkk.....',
]);

const GEM_STACK = glyph12([
  '..kk...kk...',
  '.kCCk.kCCk..',
  '.kcck.kcck..',
  '..kk...kk...',
  '...kkkkkk...',
  '..kjjjjjjk..',
  '.kjjWjjWjjk.',
  'kjjjjjjjjjjk',
  'kjjjkkkkjjjk',
  '.kjjjjjjjjk.',
  '..kjjjjjjk..',
  '...kkkkkk...',
]);

const MATERIAL_STACK = glyph12([
  '.kkk..kkk...',
  'kCCCkkCCCk..',
  'kCcckkCcck..',
  '.kkkkkkkkk..',
  '..kkkkkkkk..',
  '.kWWWWWWWWk.',
  '.kWwwwwwwWk.',
  '.kWWWWWWWWk.',
  '..kkkkkkkk..',
  '.kSk....kSk.',
  'kSkkk..kkkSk',
  '.kkk....kkk.',
]);

const STASH_PAGES = glyph12([
  '..kkkkkkkk..',
  '.kWWWWWWWWk.',
  '.kWwwwwwwWk.',
  '.kWWWWWWWWk.',
  '.kkkkkkkkkk.',
  '.kWWWWWWWWk.',
  '.kWwwkGkwwWk',
  '.kWwwkGkwwWk',
  '.kWwwkkkwwWk',
  '.kWwwwwwwWk.',
  '.kkkkkkkkkk.',
  '............',
]);

const AUTO_MAP = glyph12([
  '.kkkkkkkkkk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.ktiiiiitk..',
  '.ktikkkkkk..',
  '.ktikSSSSSk.',
  '.ktikkkkkk..',
  '.ktiiiiiitk.',
  '.kttttttttk.',
  '.kkkkkkkkkk.',
  '............',
  '............',
]);

const STARTING_DEPTH = glyph12([
  '.....kk.....',
  '....kSSk....',
  '....kSSk....',
  '....kSSk....',
  '....kSSk....',
  '....kSSk....',
  '....kSSk....',
  '.kkkSSSSkkk.',
  '.kkSSSSSSkk.',
  '..kSSSSSSk..',
  '...kSSSSk...',
  '....kkkk....',
]);

const PASSIVE_POINTS = glyph12([
  '.....kk.....',
  '....kGGk....',
  '....kGGk....',
  '....kGGk....',
  '.kkkGGGGkkk.',
  'kGGGGGGGGGGk',
  'kGGGGGGGGGGk',
  '.kkkGGGGkkk.',
  '....kGGk....',
  '....kGGk....',
  '....kGGk....',
  '.....kk.....',
]);

const AUTO_MAP_TIER = glyph12([
  '......kk....',
  '.....kGGk...',
  '....kGGk....',
  '...kGGk.....',
  '...kkk......',
  '.kkkkkkkkkk.',
  '.kttttttttk.',
  '.ktiiiiiitk.',
  '.ktiiiiiitk.',
  '.kttttttttk.',
  '.kkkkkkkkkk.',
  '............',
]);

// ---- The achievement family glyphs (Plan 32) ----
// One icon per achievement family, shared by the toasts and the tab. Drawn at 12 × 12 in the kit's palette; the families
// that had a natural stat/structural glyph reuse it, these five cover the rest.

const HEART = glyph12([
  '.kk....kk...',
  'kRRk..kRRk..',
  'kRRRkkRRRRk.',
  'kRRRkkRRRRk.',
  'kRRRpkRRRRk.',
  'kRRRpkRRRRk.',
  '.kRRpkRRRk..',
  '..kRpkRRk...',
  '...kpkRk....',
  '....kpk.....',
  '.....kk.....',
  '............',
]);

const FLASK = glyph12([
  '....kkkk....',
  '...kWWWWk...',
  '...kW..Wk...',
  '....k..k....',
  '...kCccCk...',
  '..kCccccCk..',
  '..kCccccCk..',
  '..kCccccCk..',
  '..kCccccCk..',
  '...kCccCk...',
  '....kCCk....',
  '....kkkk....',
]);

const STAR = glyph12([
  '.....kk.....',
  '.....kGk....',
  '....kGGGk...',
  '....kGGGk...',
  '..kkGGGGGkk.',
  '.kGGGGGGGGk.',
  'kGGGGGGGGGGk',
  '.kGGGGGGGGk.',
  '..kGGkGGk...',
  '..kGk..kGk..',
  '..kk....kk..',
  '............',
]);

const SKULL = glyph12([
  '...kkkkkk...',
  '..keeeeeek..',
  '.keeeeeeeek.',
  '.kepeekepek.',
  '.kepeekepek.',
  '.keeeeeeeek.',
  '.keeekkeek..',
  '.keeekkeek..',
  '..keeeeeek..',
  '...kkkkkk...',
  '...k.k.k.k..',
  '...kkkkkk...',
]);

const ANVIL = glyph12([
  '...kkkkkk...',
  '..kSSSSSSk..',
  '..kSSSSSSk..',
  '..kkkkkkkk..',
  '....kSSk....',
  '...kSSSSk...',
  '...kSSSSk...',
  '...kSSSSk...',
  '...kkkkkk...',
  '...kSSSSk...',
  '...kkkkkk...',
  '............',
]);

/** Every glyph id, hand-drawn at 16 × 16 and anchored at its centre. */
export const ICON_GLYPHS: Record<IconGlyphId, IconGlyph> = {
  ...GROUP_VARIATION_GLYPHS,
  miner: MINER,
  minerReborn: MINER_REBORN,
  earthshaker: EARTHSHAKER,
  cartographer: CARTOGRAPHER,
  prospectorsLuck: PROSPECTORS_LUCK,
  berserker: BERSERKER,
  soulReaper: SOUL_REAPER,
  bulwark: BULWARK,
  deepPockets: DEEP_POCKETS,
  twoWayStreet: TWO_WAY_STREET,
  oreBaron: ORE_BARON,
  allOrNothing: ALL_OR_NOTHING,
  deepBreath: DEEP_BREATH,
  bloodMoney: BLOOD_MONEY,
  soulDebt: SOUL_DEBT,
  prospectorsEye: PROSPECTORS_EYE,
  veinSense: VEIN_SENSE,
  prospector: PROSPECTOR,
  deepLungs: DEEP_LUNGS,
  oreSniffer: ORE_SNIFFER,
  steadyHands: STEADY_HANDS,
  thickSkin: THICK_SKIN,
  sharpened: SHARPENED,
  deadlyAim: DEADLY_AIM,
  soulWarden: SOUL_WARDEN,
  treasureHunter: TREASURE_HUNTER,
  lampAndBlade: LAMP_AND_BLADE,
  wellRested: WELL_RESTED,
  sureFooting: SURE_FOOTING,
  careful: CAREFUL,
  gemPouch: GEM_POUCH,
  oreCart: ORE_CART,
  surveyor: SURVEYOR,
  deepMiner: DEEP_MINER,
  reckoner: RECKONER,
  vanguard: VANGUARD,
  alchemist: ALCHEMIST,
  nightowl: NIGHTOWL,
  midasTouch: MIDAS_TOUCH,
  deepRoots: DEEP_ROOTS,
  secondSight: SECOND_SIGHT,
  masterSurveyor: MASTER_SURVEYOR,
  tireless: TIRELESS,
  luckyBreak: LUCKY_BREAK,
  goldRush: GOLD_RUSH,
  worldCore: WORLD_CORE,
  thirdEye: THIRD_EYE,
  worldAtlas: WORLD_ATLAS,
  perpetualMotion: PERPETUAL_MOTION,
  jackpot: JACKPOT,
  gladiator: GLADIATOR,
  colossus: COLOSSUS,
  deepVeins: DEEP_VEINS,
  elDorado: EL_DORADO,
  digPower: DIG_POWER,
  digPowerPct: DIG_POWER_PCT,
  goldYield: GOLD_YIELD,
  diamondYield: DIAMOND_YIELD,
  veinYield: VEIN_YIELD,
  autoTickRate: AUTO_TICK_RATE,
  ticksPerClick: TICKS_PER_CLICK,
  sellBonus: SELL_BONUS,
  chestFind: CHEST_FIND,
  gemFind: GEM_FIND,
  mapFind: MAP_FIND,
  oreFind: ORE_FIND,
  lampSight: LAMP_SIGHT,
  offlineCap: OFFLINE_CAP,
  hazardWard: HAZARD_WARD,
  salvageYield: SALVAGE_YIELD,
  damage: DAMAGE,
  damagePct: DAMAGE_PCT,
  elementalDamage: ELEMENTAL_DAMAGE,
  attackSpeed: ATTACK_SPEED,
  critChance: CRIT_CHANCE,
  critMultiplier: CRIT_MULTIPLIER,
  life: LIFE,
  lifePct: LIFE_PCT,
  armor: ARMOR,
  armorPct: ARMOR_PCT,
  resistAll: RESIST_ALL,
  maxResist: MAX_RESIST,
  lifeRegen: LIFE_REGEN,
  lifeOnKill: LIFE_ON_KILL,
  soulFind: SOUL_FIND,
  magicFind: MAGIC_FIND,
  xpFind: XP_FIND,
  gemStack: GEM_STACK,
  materialStack: MATERIAL_STACK,
  stashPages: STASH_PAGES,
  autoMap: AUTO_MAP,
  startingDepth: STARTING_DEPTH,
  passivePoints: PASSIVE_POINTS,
  autoMapTier: AUTO_MAP_TIER,
  heart: HEART,
  flask: FLASK,
  star: STAR,
  skull: SKULL,
  anvil: ANVIL,
};

const FRAME_PALETTE: Record<string, string> = { ...ICON_PALETTE, a: '#d9c9a3', A: '#f0e6c8' };

// The frames are round: every pixel whose centre lies outside this circle is cut to `.`. The glyph socket at
// rows/cols 4–19 sits fully inside the circle, so only the frame's square corners are cut, never a glyph.
const CIRCLE_CX = ICON_SIZE / 2;
const CIRCLE_CY = ICON_SIZE / 2;
const CIRCLE_RADIUS = ICON_SIZE / 2;

function roundFrame(rows: readonly string[]): string[] {
  return rows.map((row, y) => [...row].map((c, x) => {
    const dx = x + 0.5 - CIRCLE_CX;
    const dy = y + 0.5 - CIRCLE_CY;
    return dx * dx + dy * dy <= CIRCLE_RADIUS * CIRCLE_RADIUS ? c : '.';
  }).join(''));
}

function frame(rows: readonly string[], patches: readonly Pixel[] = []): IconFrame {
  if (rows.length !== ICON_SIZE) throw new Error(`icon frame has ${rows.length} rows, expected ${ICON_SIZE}`);
  for (const row of rows) {
    if (row.length !== ICON_SIZE) throw new Error(`icon frame row '${row}' is ${row.length} wide, expected ${ICON_SIZE}`);
  }
  return { grid: roundFrame(paint(rows, patches, ICON_SIZE)), glyphAt: GLYPH_AT, palette: { ...FRAME_PALETTE } };
}

const SMALL_MIDDLE = `kbaB${'.'.repeat(GLYPH_SIZE)}Babk`;
const NOTABLE_MIDDLE = `kkaB${'.'.repeat(GLYPH_SIZE)}Bakk`;
const KEYSTONE_MIDDLE = `kkka${'.'.repeat(GLYPH_SIZE)}akkk`;
const START_MIDDLE = `gGaG${'.'.repeat(GLYPH_SIZE)}GaGg`;
const ASCENDANCY_MIDDLE = `gtai${'.'.repeat(GLYPH_SIZE)}iatg`;

const SMALL_FRAME = frame([
  'k'.repeat(ICON_SIZE),
  `k${'b'.repeat(22)}k`,
  `kb${'a'.repeat(20)}bk`,
  `kba${'B'.repeat(18)}abk`,
  ...Array.from({ length: GLYPH_SIZE }, () => SMALL_MIDDLE),
  `kba${'B'.repeat(18)}abk`,
  `kb${'a'.repeat(20)}bk`,
  `k${'b'.repeat(22)}k`,
  'k'.repeat(ICON_SIZE),
], [
  [1, 1, 'G'], [2, 1, 'g'], [1, 2, 'g'], [2, 2, 'G'],
  [21, 21, 'G'], [22, 21, 'g'], [21, 22, 'g'], [22, 22, 'G'],
  [10, 2, 'A'], [11, 2, 'A'], [12, 2, 'A'], [13, 2, 'A'],
  [10, 21, 'A'], [11, 21, 'A'], [12, 21, 'A'], [13, 21, 'A'],
]);

const NOTABLE_FRAME = frame([
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
  `kk${'a'.repeat(20)}kk`,
  `kka${'B'.repeat(18)}akk`,
  ...Array.from({ length: GLYPH_SIZE }, () => NOTABLE_MIDDLE),
  `kka${'B'.repeat(18)}akk`,
  `kk${'a'.repeat(20)}kk`,
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
], [
  [1, 1, 'G'], [2, 1, 'g'], [1, 2, 'g'], [2, 2, 'G'],
  [21, 1, 'G'], [22, 1, 'g'], [21, 2, 'g'], [22, 2, 'G'],
  [1, 21, 'G'], [2, 21, 'g'], [1, 22, 'g'], [2, 22, 'G'],
  [21, 21, 'G'], [22, 21, 'g'], [21, 22, 'g'], [22, 22, 'G'],
  [10, 2, 'A'], [11, 2, 'A'], [12, 2, 'A'], [13, 2, 'A'],
  [10, 21, 'A'], [11, 21, 'A'], [12, 21, 'A'], [13, 21, 'A'],
]);

const KEYSTONE_FRAME = frame([
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
  `kkk${'a'.repeat(18)}kkk`,
  ...Array.from({ length: GLYPH_SIZE }, () => KEYSTONE_MIDDLE),
  `kkk${'a'.repeat(18)}kkk`,
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
  'k'.repeat(ICON_SIZE),
], [
  [1, 1, 'S'], [2, 1, 's'], [1, 2, 's'], [2, 2, 'S'],
  [21, 1, 'S'], [22, 1, 's'], [21, 2, 's'], [22, 2, 'S'],
  [1, 21, 'S'], [2, 21, 's'], [1, 22, 's'], [2, 22, 'S'],
  [21, 21, 'S'], [22, 21, 's'], [21, 22, 's'], [22, 22, 'S'],
  [15, 3, 'A'], [16, 3, 'A'], [17, 3, 'A'], [18, 3, 'A'],
  [10, 20, 'A'], [11, 20, 'A'], [12, 20, 'A'], [13, 20, 'A'],
  // A small gold notch cut into the top edge.
  [11, 0, '.'], [12, 0, '.'],
  [10, 1, 'k'], [11, 1, 'a'], [12, 1, 'a'], [13, 1, 'k'],
  [11, 2, 'a'], [12, 2, 'a'],
  [10, 3, 'G'], [11, 3, 'G'], [12, 3, 'G'], [13, 3, 'G'],
]);

const START_FRAME = frame([
  'g'.repeat(ICON_SIZE),
  `g${'G'.repeat(22)}g`,
  `gG${'a'.repeat(20)}Gg`,
  `gGa${'G'.repeat(18)}aGg`,
  ...Array.from({ length: GLYPH_SIZE }, () => START_MIDDLE),
  `gGa${'G'.repeat(18)}aGg`,
  `gG${'a'.repeat(20)}Gg`,
  `g${'G'.repeat(22)}g`,
  'g'.repeat(ICON_SIZE),
], [
  // Three-point crown on the top edge.
  [9, 0, 'G'], [10, 0, '.'], [11, 0, 'G'], [12, 0, '.'], [13, 0, 'G'],
  [9, 1, 'G'], [10, 1, 'G'], [11, 1, 'G'], [12, 1, 'G'], [13, 1, 'G'],
  [9, 2, 'g'], [10, 2, 'g'], [11, 2, 'g'], [12, 2, 'g'], [13, 2, 'g'],
  [10, 3, 'G'], [11, 3, 'G'], [12, 3, 'G'], [13, 3, 'G'],
  [14, 2, 'A'], [15, 2, 'A'], [16, 2, 'A'], [17, 2, 'A'],
  [10, 21, 'A'], [11, 21, 'A'], [12, 21, 'A'], [13, 21, 'A'],
]);

const ASCENDANCY_FRAME = frame([
  'g'.repeat(ICON_SIZE),
  `g${'t'.repeat(22)}g`,
  `gt${'a'.repeat(20)}tg`,
  `gta${'i'.repeat(18)}atg`,
  ...Array.from({ length: GLYPH_SIZE }, () => ASCENDANCY_MIDDLE),
  `gta${'i'.repeat(18)}atg`,
  `gt${'a'.repeat(20)}tg`,
  `g${'t'.repeat(22)}g`,
  'g'.repeat(ICON_SIZE),
], [
  // A small gold diamond at the top.
  [11, 0, 'G'], [12, 0, 'G'],
  [10, 1, 'G'], [11, 1, 'G'], [12, 1, 'G'], [13, 1, 'G'],
  [11, 2, 'g'], [12, 2, 'g'],
  [14, 2, 'A'], [15, 2, 'A'], [16, 2, 'A'], [17, 2, 'A'],
  [10, 21, 'A'], [11, 21, 'A'], [12, 21, 'A'], [13, 21, 'A'],
]);

/** The five frames. The glyph area is rows/columns 4–19 in every frame. */
export const ICON_FRAMES: Record<IconFrameKind, IconFrame> = {
  small: SMALL_FRAME,
  notable: NOTABLE_FRAME,
  keystone: KEYSTONE_FRAME,
  start: START_FRAME,
  ascendancy: ASCENDANCY_FRAME,
};

export type IconSide = 'mining' | 'battle' | 'hybrid' | 'start' | 'ascendancy';

/** The frame accent per side; the glyph palette stays constant so dim nodes still read. */
export const SIDE_COLOURS: Record<IconSide, { a: string; A: string }> = {
  mining: { a: '#e8b44a', A: '#f5cf7a' },
  battle: { a: '#ff8a7a', A: '#ffb0a6' },
  hybrid: { a: '#7fd3e8', A: '#c9f1fa' },
  start: { a: '#f1e9dc', A: '#ffffff' },
  ascendancy: { a: '#d9c9a3', A: '#f0e6c8' },
};

/**
 * Places a glyph at the frame's glyph socket and recolours the frame accent by side. A glyph `.` leaves the frame
 * showing; a non-`.` glyph pixel outside the canvas throws.
 */
export function composeIcon(
  kind: IconFrameKind,
  glyphId: IconGlyphId,
  side: keyof typeof SIDE_COLOURS,
): { id: IconGlyphId; grid: string[]; palette: Record<string, string> } {
  const iconFrame = ICON_FRAMES[kind];
  const iconGlyph = ICON_GLYPHS[glyphId];
  const rows = iconFrame.grid.map((row) => [...row]);
  iconGlyph.grid.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const c = line[x];
      if (c === undefined || c === '.') continue;
      const canvasX = iconFrame.glyphAt[0] + x;
      const canvasY = iconFrame.glyphAt[1] + y;
      const row = rows[canvasY];
      if (row === undefined || canvasX < 0 || canvasX >= ICON_SIZE) {
        throw new Error(`glyph ${glyphId} pixel (${canvasX}, ${canvasY}) falls outside the ${ICON_SIZE}×${ICON_SIZE} frame`);
      }
      row[canvasX] = c;
    }
  });
  const accent = SIDE_COLOURS[side];
  return {
    id: glyphId,
    grid: rows.map((row) => row.join('')),
    palette: { ...iconFrame.palette, ...ICON_PALETTE, a: accent.a, A: accent.A },
  };
}

function knownGlyph(id: string): IconGlyphId {
  if (Object.prototype.hasOwnProperty.call(ICON_GLYPHS, id)) return id as IconGlyphId;
  throw new Error(`unknown icon glyph id: ${id}`);
}

/** The icon for a passive node: the start's face, its own named id, or the first effect's stat/structural id. */
export function iconForPassive(node: PassiveNode): IconGlyphId {
  if (node.kind === 'start') return 'miner';
  if (node.kind === 'keystone' || node.kind === 'notable') return knownGlyph(node.id);
  const effect = node.effects[0];
  if (effect === undefined) throw new Error(`passive small ${node.id} has no effect`);
  switch (effect.kind) {
    case 'stat': return effect.stat;
    case 'gemStack': return 'gemStack';
    case 'materialStack': return 'materialStack';
    case 'stashPages': return 'stashPages';
    case 'autoMap': return 'autoMap';
    case 'keystone': return knownGlyph(effect.id);
  }
}

/** The icon for an ascendancy node: the reborn miner, its own named id, or its cluster's group glyph at its slot tier. */
export function iconForAscendancy(node: AscendancyNode): IconGlyphId {
  if (node.kind === 'start') return 'minerReborn';
  if (node.kind === 'mid' || node.kind === 'big') return knownGlyph(node.id);
  if (node.group === undefined || node.variation === undefined) {
    throw new Error(`ascendancy small ${node.id} has no group or variation`);
  }
  return groupGlyphId(node.group, node.variation);
}
