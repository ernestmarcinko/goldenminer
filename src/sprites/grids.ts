export type SpriteName = 'miner' | 'coin' | 'diamond' | 'chest' | 'map' | 'gem' | 'ruby';

export const PALETTE: Record<string, string> = { k: '#1b1410', w: '#8a5a32', W: '#b07a45', s: '#9aa4ad', S: '#d5dde3', g: '#e8b44a', G: '#f5d68a', o: '#b8741c', r: '#c8453a', R: '#ff8a7a', b: '#3f6fc8', c: '#7fd3e8', C: '#c9f1fa', l: '#6b4429', L: '#9a6a40', y: '#ffe08a', p: '#d9c39a', P: '#a88d5c', v: '#8a6fe0', n: '#e0b08a', d: '#3b3550', D: '#5a5278', m: '#5f8a6a', M: '#8fb89a' };

const GEM = ['............', '....kkkk....', '...kCCcck...', '..kCccccbk..', '..kccccccbk.', '...kccccbk..', '....kccbk...', '.....kbk....', '......k.....', '............', '............', '............'];

export const GRIDS: Record<SpriteName, string[]> = {
  miner: ['......kkkk......', '.....kyyyyk.....', '....kkkyykkk....', '...kllllllllk...', '..kLLLLLLLLLLk..', '...knnnnnnnnk...', '...knkknnkknk...', '...knnnnnnnnk...', '....knwwwwnk....', '..kkkddddddkkk..', '.kdDkDDDDDDkDdk.', 'kdDDkDDggDDkDDdk', 'knnkkDDDDDDkknnk', 'kk..kDDDDDDk..kk', '....kggggggk....', '....kddkkddk....', '....kddk.kddk...', '....kddk.kddk...', '...klllk.klllk..', '...kkkkk.kkkkk..'],
  coin: ['..kkkk..', '.kGGGgk.', 'kGGggggk', 'kGggggok', 'kGggggok', 'kgggggok', '.kggook.', '..kkkk..'],
  diamond: ['........', '.kkkkkk.', 'kCCccCck', 'kcccccbk', '.kcccbk.', '..kcbk..', '...kk...', '........'],
  chest: ['............', '............', '..kkkkkkkk..', '.kwwwwwwwwk.', '.kWWWWWWWWk.', '.kkkkggkkkk.', '.kwwwkgkwwk.', '.kWWWWWWWWk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............'],
  map: ['............', '.kkkkkkkkk..', '.kpppppppkk.', '.kpPpppvpk..', '.kppPpvpvk..', '.kpppPpppk..', '.kpvppPppk..', '.kppvpppPk..', '.kpppppppk..', 'kkpppppppk..', '.kkkkkkkkk..', '............'],
  gem: GEM,
  ruby: GEM,
};

export const PALETTE_OVERRIDES: Partial<Record<SpriteName, Record<string, string>>> = {
  ruby: { C: '#ffb0a6', c: '#e0574a', b: '#8a2a22' },
};
