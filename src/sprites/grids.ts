export type SpriteName = 'miner' | 'coin' | 'diamond' | 'chest' | 'map' | 'gem' | 'ruby'
  | 'sapphire' | 'emerald' | 'amethyst' | 'starstone'
  | 'pickaxe' | 'lamphelm' | 'gloves' | 'boots' | 'maul' | 'armor' | 'helm' | 'ring' | 'amulet'
  | 'copper' | 'tin' | 'iron' | 'silver' | 'mithril' | 'starsteel' | 'obsidian' | 'voidCrystal';

export const PALETTE: Record<string, string> = { k: '#1b1410', w: '#8a5a32', W: '#b07a45', s: '#9aa4ad', S: '#d5dde3', g: '#e8b44a', G: '#f5d68a', o: '#b8741c', r: '#c8453a', R: '#ff8a7a', b: '#3f6fc8', c: '#7fd3e8', C: '#c9f1fa', l: '#6b4429', L: '#9a6a40', y: '#ffe08a', p: '#d9c39a', P: '#a88d5c', v: '#8a6fe0', n: '#e0b08a', d: '#3b3550', D: '#5a5278', m: '#5f8a6a', M: '#8fb89a' };

const GEM = ['............', '....kkkk....', '...kCCcck...', '..kCccccbk..', '..kccccccbk.', '...kccccbk..', '....kccbk...', '.....kbk....', '......k.....', '............', '............', '............'];
// Materials share two shapes, recoloured per material like the gems: a lump of ore, and a shard.
const ORE = ['............', '............', '.....kkk....', '...kkCCckk..', '..kCCcccbbk.', '.kCccccccbk.', '.kcccccccbbk', '.kccccccbbbk', '..kbcccbbbk.', '...kkbbbkk..', '.....kkk....', '............'];
const SHARD = ['............', '.......kk...', '......kCbk..', '.....kCcbk..', '....kCccbk..', '...kCccbk...', '...kCcbbk...', '..kCccbk....', '..kCcbbk....', '..kcbbk.....', '...kkk......', '............'];

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
};

export const PALETTE_OVERRIDES: Partial<Record<SpriteName, Record<string, string>>> = {
  ruby: { C: '#ffb0a6', c: '#e0574a', b: '#8a2a22' },
  sapphire: { C: '#b9cbff', c: '#3f6fc8', b: '#24407a' },
  emerald: { C: '#b8f0c8', c: '#3fae6a', b: '#1f6b3d' },
  amethyst: { C: '#e0d0ff', c: '#8a6fe0', b: '#4b3a8a' },
  starstone: { C: '#fff6d0', c: '#e8d27a', b: '#9a7a2a' },
  copper: { C: '#f2b27a', c: '#d0702e', b: '#8a4418' },
  tin: { C: '#f4f5f6', c: '#c4c9ce', b: '#8a9096' },
  iron: { C: '#9a9ea4', c: '#5e6268', b: '#383b40' },
  silver: { C: '#ffffff', c: '#e6eaf0', b: '#a8b0bc' },
  mithril: { C: '#b8f2e6', c: '#3fb8a4', b: '#1f6e62' },
  starsteel: { C: '#eef5ff', c: '#a8c8f0', b: '#5a7aa8' },
  obsidian: { C: '#6a6478', c: '#2a2630', b: '#141118' },
  voidCrystal: { C: '#e4c8ff', c: '#9a4fe0', b: '#4e2286' },
};
