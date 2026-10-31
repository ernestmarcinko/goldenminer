export type SpriteName = 'miner' | 'coin' | 'diamond' | 'chest' | 'map' | 'gem' | 'ruby'
  | 'sapphire' | 'emerald' | 'amethyst' | 'starstone'
  | 'fehu' | 'uruz' | 'thurisaz' | 'ansuz' | 'raidho' | 'kenaz' | 'gebo' | 'wunjo' | 'hagalaz' | 'isa'
  | 'pickaxe' | 'lamphelm' | 'gloves' | 'boots' | 'maul' | 'armor' | 'helm' | 'ring' | 'amulet'
  | 'copper' | 'tin' | 'iron' | 'silver' | 'mithril' | 'starsteel' | 'obsidian' | 'voidCrystal'
  | 'brannoc' | 'mirela' | 'ferrel'
  | 'orbPrefixMinor' | 'orbPrefixNormal' | 'orbPrefixGreater'
  | 'orbSuffixMinor' | 'orbSuffixNormal' | 'orbSuffixGreater'
  | 'orbSeveranceMinor' | 'orbSeveranceNormal' | 'orbSeveranceGreater'
  | 'orbUnmakingMinor' | 'orbUnmakingNormal' | 'orbUnmakingGreater'
  | 'orbScatterMinor' | 'orbScatterNormal' | 'orbScatterGreater'
  | 'orbSocket' | 'orbClearSocket';

export const PALETTE: Record<string, string> = { k: '#1b1410', w: '#8a5a32', W: '#b07a45', s: '#9aa4ad', S: '#d5dde3', g: '#e8b44a', G: '#f5d68a', o: '#b8741c', r: '#c8453a', R: '#ff8a7a', b: '#3f6fc8', c: '#7fd3e8', C: '#c9f1fa', l: '#6b4429', L: '#9a6a40', y: '#ffe08a', p: '#d9c39a', P: '#a88d5c', v: '#8a6fe0', n: '#e0b08a', d: '#3b3550', D: '#5a5278', m: '#5f8a6a', M: '#8fb89a' };

const GEM = ['............', '....kkkk....', '...kCCcck...', '..kCccccbk..', '..kccccccbk.', '...kccccbk..', '....kccbk...', '.....kbk....', '......k.....', '............', '............', '............'];
// Materials share two shapes, recoloured per material like the gems: a lump of ore, and a shard.
const ORE = ['............', '............', '.....kkk....', '...kkCCckk..', '..kCCcccbbk.', '.kCccccccbk.', '.kcccccccbbk', '.kccccccbbbk', '..kbcccbbbk.', '...kkbbbkk..', '.....kkk....', '............'];
const SHARD = ['............', '.......kk...', '......kCbk..', '.....kCcbk..', '....kCccbk..', '...kCccbk...', '...kCcbbk...', '..kCccbk....', '..kCcbbk....', '..kcbbk.....', '...kkk......', '............'];
// A rune: a carved stone, recoloured per kind in the ember family.
const RUNE = ['............', '...kkkkkk...', '..kCCCCcck..', '.kCccccccbk.', '.kCccccccbk.', '.kCkkkkkkbk.', '.kCccccccbk.', '.kCccccccbk.', '..kCccccbk..', '...kcccck...', '....kcck....', '.....kk.....'];

// The 15 crafting orbs share one 12×12 silhouette (outline `k`, a `C` highlight rim, a `c` body and a `b` shadow),
// with a per-family glyph drawn in light grey `S` over the middle, and the fill recoloured per tier via overrides.
const ORB_BASE = [
  '............',
  '....kkkk....',
  '..kkCCCCkk..',
  '.kCccccccCk.',
  '.kCccccccCk.',
  'kCccccccccbk',
  'kCccccccccbk',
  '.kCccccccbk.',
  '.kCccccccbk.',
  '..kcccccbk..',
  '...kbbbbk...',
  '....kkkk....',
];
// An up chevron: the craft-prefix orb.
const ORB_PREFIX = [
  '............',
  '............',
  '............',
  '.....SS.....',
  '....S..S....',
  '...S....S...',
  '..S......S..',
  '.S........S.',
  '............',
  '............',
  '............',
  '............',
];
// A down chevron: the craft-suffix orb.
const ORB_SUFFIX = [
  '............',
  '............',
  '............',
  '.S........S.',
  '..S......S..',
  '...S....S...',
  '....S..S....',
  '.....SS.....',
  '............',
  '............',
  '............',
  '............',
];
// A slash: the removal orbs.
const ORB_SLASH = [
  '............',
  '............',
  '............',
  '.........SS.',
  '........SS..',
  '.......SS...',
  '......SS....',
  '.....SS.....',
  '....SS......',
  '...SS.......',
  '............',
  '............',
];
// A burst: the scattering orbs.
const ORB_BURST = [
  '............',
  '............',
  '.....SS.....',
  '.....SS.....',
  '..SS.SS.SS..',
  '....SSSS....',
  '..SS.SS.SS..',
  '.....SS.....',
  '.....SS.....',
  '............',
  '............',
  '............',
];
// A plus: the socketing orb.
const ORB_PLUS = [
  '............',
  '............',
  '.....SS.....',
  '.....SS.....',
  '.....SS.....',
  '..SSSSSSSS..',
  '.....SS.....',
  '.....SS.....',
  '.....SS.....',
  '............',
  '............',
  '............',
];
// A hollow ring: the socket-clearing orb.
const ORB_CLEAR = [
  '............',
  '............',
  '....SSSS....',
  '..SS....SS..',
  '.S........S.',
  '.S........S.',
  '.S........S.',
  '.S........S.',
  '..SS....SS..',
  '....SSSS....',
  '............',
  '............',
];

/** Lays a family glyph over the shared orb silhouette. */
function orbGrid(glyph: string[]): string[] {
  return ORB_BASE.map((row, y) => [...row].map((ch, x) => (glyph[y]?.[x] !== undefined && glyph[y][x] !== '.' ? glyph[y][x] : ch)).join(''));
}

/** The tier recolours: Minor iron-grey, Normal mithril-blue, Greater void-purple. */
const ORB_TIER_COLOURS: Readonly<Record<'Minor' | 'Normal' | 'Greater', Record<string, string>>> = {
  Minor: { C: '#9a9ea4', c: '#5e6268', b: '#383b40' },
  Normal: { C: '#b8f2e6', c: '#3fb8a4', b: '#1f6e62' },
  Greater: { C: '#e4c8ff', c: '#9a4fe0', b: '#4e2286' },
};

/** The 15 orb sprites and their tier recolours, in catalogue order. */
export const ORB_SPRITES: readonly { name: SpriteName; grid: string[]; colours: Record<string, string> }[] = (
  [
    ['orbPrefix', ORB_PREFIX], ['orbSuffix', ORB_SUFFIX],
    ['orbSeverance', ORB_SLASH], ['orbUnmaking', ORB_SLASH], ['orbScatter', ORB_BURST],
  ] as const
).flatMap(([base, glyph]) =>
  (['Minor', 'Normal', 'Greater'] as const).map((tier) => ({
    name: `${base}${tier}` as SpriteName,
    grid: orbGrid(glyph as string[]),
    colours: ORB_TIER_COLOURS[tier],
  })));

export const GRIDS: Record<SpriteName, string[]> = {
  miner: ['......kkkk......', '.....kyyyyk.....', '....kkkyykkk....', '...kllllllllk...', '..kLLLLLLLLLLk..', '...knnnnnnnnk...', '...knkknnkknk...', '...knnnnnnnnk...', '....knwwwwnk....', '..kkkddddddkkk..', '.kdDkDDDDDDkDdk.', 'kdDDkDDggDDkDDdk', 'knnkkDDDDDDkknnk', 'kk..kDDDDDDk..kk', '....kggggggk....', '....kddkkddk....', '....kddk.kddk...', '....kddk.kddk...', '...klllk.klllk..', '...kkkkk.kkkkk..'],
  coin: ['..kkkk..', '.kGGGgk.', 'kGGggggk', 'kGggggok', 'kGggggok', 'kgggggok', '.kggook.', '..kkkk..'],
  diamond: ['........', '.kkkkkk.', 'kCCccCck', 'kcccccbk', '.kcccbk.', '..kcbk..', '...kk...', '........'],
  chest: ['............', '............', '..kkkkkkkk..', '.kwwwwwwwwk.', '.kWWWWWWWWk.', '.kkkkggkkkk.', '.kwwwkgkwwk.', '.kWWWWWWWWk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............'],
  map: ['............', '.kkkkkkkkk..', '.kpppppppkk.', '.kpPpppvpk..', '.kppPpvpvk..', '.kpppPpppk..', '.kpvppPppk..', '.kppvpppPk..', '.kpppppppk..', 'kkpppppppk..', '.kkkkkkkkk..', '............'],
  gem: GEM,
  ruby: GEM,
  sapphire: GEM,
  emerald: GEM,
  amethyst: GEM,
  starstone: GEM,
  fehu: RUNE,
  uruz: RUNE,
  thurisaz: RUNE,
  ansuz: RUNE,
  raidho: RUNE,
  kenaz: RUNE,
  gebo: RUNE,
  wunjo: RUNE,
  hagalaz: RUNE,
  isa: RUNE,
  pickaxe: ['....kkkk....', '..kkSSSSkk..', '.kSSkkkkSSk.', 'kSkk.kk.kkSk', 'kk..kWk...kk', '...kWk......', '..kWk.......', '..kWk.......', '.kWk........', '.kWk........', 'kWk.........', 'kk..........'],
  lamphelm: ['............', '....kkkk....', '...kyyyyk...', '..kkkyykkk..', '.kllllllllk.', 'klLLLLLLLLlk', 'klLLLLLLLLlk', 'kllllllllllk', 'kkkkkkkkkkkk', '.k........k.', '............', '............'],
  gloves: ['............', '...k.k.k....', '..kLkLkLk...', '..kLkLkLkk..', '..kLLLLLkLk.', '..kLLLLLLLk.', '..kLLLLLLk..', '..kllllllk..', '..kllllllk..', '...kkkkkk...', '............', '............'],
  boots: ['............', '...kkkk.....', '...kLLk.....', '...kLLk.....', '...kLLk.....', '...kLLk.....', '...kLLLkk...', '...kLLLLLk..', '..kLLLLLLLk.', '..kllllllllk', '..kkkkkkkkkk', '............'],
  maul: ['.....kkkk...', '....kssssk..', '...ksSSSsk..', '...ksSSSsk..', '....kssssk..', '....kWk.kk..', '...kWk......', '...kWk......', '..kWk.......', '..kWk.......', '.kWk........', '.kk.........'],
  armor: ['............', '..kk....kk..', '.kLLk..kLLk.', 'kLLLLkkLLLLk', 'kLLLLLLLLLLk', '.kLLLLLLLLk.', '..kLLLLLLk..', '..kLlllLLk..', '..kLLLLLLk..', '..kLLLLLLk..', '..kkkkkkkk..', '............'],
  helm: ['............', '....kkkk....', '...kSSSSk...', '..kSSsssSk..', '.ksssssssssk', '.kssskkksssk', '.ksskkkkkssk', '.kssk..kssk.', '.kssk..kssk.', '..kk....kk..', '............', '............'],
  ring: ['............', '.....kk.....', '....kRRk....', '.....kk.....', '...kkggkk...', '..kg....gk..', '..kg....gk..', '..kg....gk..', '...kggggk...', '....kkkk....', '............', '............'],
  amulet: ['..k......k..', '...k....k...', '....k..k....', '.....kk.....', '....kggk....', '...kgccgk...', '...kgCcgk...', '....kggk....', '.....kk.....', '............', '............', '............'],
  copper: ORE,
  tin: ORE,
  iron: ORE,
  silver: ORE,
  mithril: ORE,
  starsteel: ORE,
  obsidian: SHARD,
  voidCrystal: SHARD,
  // the merchants' portraits, 16 × 24: Brannoc broad, with a brown beard, a green coat and a pack on his back
  brannoc: [
    '................',
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '...kwwWwwWwwk...',
    '...kwnnnnnnwk...',
    '...knnnnnnnnk...',
    '...knkknnkknk...',
    '...knnnnnnnnk...',
    '...kwnnWWnnwk...',
    '...kwWwwwwWwk...',
    '.ll.kwWkkWwk.ll.',
    'lLlkkwWWWWwkklLl',
    'lLlmkwWWWWwkmlLl',
    'lLlmmkwWWwkmmlLl',
    'lLlmMmkwwkmMmlLl',
    'lLlmMmmkkmmMmlLl',
    'lLlmMmmmmmmMmlLl',
    'lLlmMmmmgmmMmlLl',
    'lLlmMmmmmmmMmlLl',
    'lLlllllgglllllLl',
    'lLlmMmmmmmmMmlLl',
    'lLlmMmmmgmmMmlLl',
    'lLlmMmmmmmmMmlLl',
    'lLlmMmmmmmmMmlLl',
  ],
  // Old Mirela: grey hair, a purple shawl over a dark dress, and a cane
  mirela: [
    '....kkkkk.......',
    '..kkSSSSSkk.....',
    '.kSSsSSSsSSk....',
    '.kSsnnnnnsSk....',
    '.kSnnnnnnnSk....',
    '.ksnkknkknsk....',
    '.ksnnnnnnnsk.LLL',
    '.ksnnnWnnnsk.L.L',
    '.kssnnnnnssk...L',
    '.kssnnknnssk...L',
    '.kvssnnnssvk...L',
    'kvvvvsnsvvvvk..L',
    'kvDvvvvvvvDvk..L',
    'kvDvvvvvvvDvvnnL',
    'kvvDvvvvvDvvk..L',
    'kdvdvdvdvdvdk..L',
    'kDdddddddddDk..L',
    '.kDdddddddDk...L',
    '.kDdddddddDk...L',
    '.kDdddddddDk...L',
    '.kDdddddddDk...L',
    '.kDdddddddDk...L',
    '.kDdddddddDk...L',
    '.kkkkkkkkkkk...k',
  ],
  // Ferrel the Refiner: a bronze cap, a broad face and a braided copper beard over a leather apron
  ferrel: [
    '....kkkkkk......',
    '...kSSSSSSk.....',
    '..kSssssssSk....',
    '..kssssssssk....',
    '..ksnnnnnnsk....',
    '..ksnWnnWnsk....',
    '..ksnnnnnnsk....',
    '...ksnnnnsk.....',
    '....kkkkkk......',
    '...kwwwwwwk.....',
    '..kwwwwwwwwk....',
    '.kwoooooooowk...',
    '.kwoooooooowk...',
    '.kwoooWWooowk...',
    '.kwoooooooowk...',
    '.kwowoooooowk...',
    '.kwwwooooowwk...',
    '..kwwwwwwwwk....',
    '...kwwwwwwk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ],
  orbPrefixMinor: orbGrid(ORB_PREFIX), orbPrefixNormal: orbGrid(ORB_PREFIX), orbPrefixGreater: orbGrid(ORB_PREFIX),
  orbSuffixMinor: orbGrid(ORB_SUFFIX), orbSuffixNormal: orbGrid(ORB_SUFFIX), orbSuffixGreater: orbGrid(ORB_SUFFIX),
  orbSeveranceMinor: orbGrid(ORB_SLASH), orbSeveranceNormal: orbGrid(ORB_SLASH), orbSeveranceGreater: orbGrid(ORB_SLASH),
  orbUnmakingMinor: orbGrid(ORB_SLASH), orbUnmakingNormal: orbGrid(ORB_SLASH), orbUnmakingGreater: orbGrid(ORB_SLASH),
  orbScatterMinor: orbGrid(ORB_BURST), orbScatterNormal: orbGrid(ORB_BURST), orbScatterGreater: orbGrid(ORB_BURST),
  orbSocket: orbGrid(ORB_PLUS), orbClearSocket: orbGrid(ORB_CLEAR),
};

export const PALETTE_OVERRIDES: Partial<Record<SpriteName, Record<string, string>>> = {
  ruby: { C: '#ffb0a6', c: '#e0574a', b: '#8a2a22' },
  sapphire: { C: '#b9cbff', c: '#3f6fc8', b: '#24407a' },
  emerald: { C: '#b8f0c8', c: '#3fae6a', b: '#1f6b3d' },
  amethyst: { C: '#e0d0ff', c: '#8a6fe0', b: '#4b3a8a' },
  starstone: { C: '#fff6d0', c: '#e8d27a', b: '#9a7a2a' },
  // Runes: an ember/orange family, distinct from every gem.
  fehu: { C: '#ffd9a0', c: '#ff9a3c', b: '#8a3c10' },
  uruz: { C: '#ffc7a0', c: '#ff7a2e', b: '#8a3008' },
  thurisaz: { C: '#ffb08a', c: '#ff5a1e', b: '#7a2408' },
  ansuz: { C: '#ffd0b0', c: '#ff8844', b: '#8a4018' },
  raidho: { C: '#ffe0a8', c: '#ffa04a', b: '#8a4818' },
  kenaz: { C: '#ffcaa8', c: '#ff6a2a', b: '#7a2810' },
  gebo: { C: '#ffdfb8', c: '#ff9050', b: '#8a3c20' },
  wunjo: { C: '#ffc090', c: '#ff7a38', b: '#8a3008' },
  hagalaz: { C: '#ffa880', c: '#ff4a1a', b: '#701c08' },
  isa: { C: '#ffb890', c: '#ff5e2e', b: '#7a2810' },
  copper: { C: '#f2b27a', c: '#d0702e', b: '#8a4418' },
  tin: { C: '#f4f5f6', c: '#c4c9ce', b: '#8a9096' },
  iron: { C: '#9a9ea4', c: '#5e6268', b: '#383b40' },
  silver: { C: '#ffffff', c: '#e6eaf0', b: '#a8b0bc' },
  mithril: { C: '#b8f2e6', c: '#3fb8a4', b: '#1f6e62' },
  starsteel: { C: '#eef5ff', c: '#a8c8f0', b: '#5a7aa8' },
  obsidian: { C: '#6a6478', c: '#2a2630', b: '#141118' },
  voidCrystal: { C: '#e4c8ff', c: '#9a4fe0', b: '#4e2286' },
  // The untiered socket orbs: the socketing orb in iron-grey, the cleansing orb in mithril-blue.
  orbSocket: { C: '#9a9ea4', c: '#5e6268', b: '#383b40' },
  orbClearSocket: { C: '#b8f2e6', c: '#3fb8a4', b: '#1f6e62' },
  ...Object.fromEntries(ORB_SPRITES.map((s) => [s.name, s.colours])) as Partial<Record<SpriteName, Record<string, string>>>,
};
