import type { BodyKind } from './species';

/**
 * The hand-drawn part kit that generated monsters are built from.
 * Pixels: `.` clear, `k` outline, `b`/`B`/`d` body / light / dark, `a`/`A` accent / light,
 * `e` eye white, `p` pupil, `m` mouth, `t` tooth or bone.
 * A part's anchor is placed on its parent's socket (the body's anchor on the canvas ground point).
 */
export type Socket = 'head' | 'legs' | 'wings' | 'tail' | 'back' | 'eyes' | 'mouth' | 'horns';
export interface Part { grid: string[]; anchor: [number, number]; sockets?: Partial<Record<Socket, [number, number]>> }

/** Mirrors left halves into symmetric front-view rows; the anchor column is then the half width. */
function mirror(half: string[]): string[] {
  return half.map((row) => row + [...row].reverse().join(''));
}

/** Each body's grid reaches down to the ground row, where its anchor sits; legs fill the clear rows below the body. */
export const BODIES: Record<BodyKind, Part> = {
  blob: {
    grid: mirror([
      '......kkkk',
      '....kkBBBB',
      '...kBBBbbb',
      '..kBBbbbbb',
      '.kBbbbbbbb',
      '.kbbbbbbbb',
      'kbbbbbbbbb',
      'kbbbbbbbbb',
      'kdbbbbbbbb',
      'kddbbdbbbd',
      '.kkdkkdddk',
      '...k..kkk.',
    ]),
    anchor: [10, 11],
    sockets: { head: [10, 3], back: [10, 3] },
  },
  quadruped: {
    grid: [
      '...kkkkkkkkkk...',
      '..kBBBBBBBBBBk..',
      '.kBbbbbbbbbbbbk.',
      'kbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbdk',
      'kdaaaaaaabbbbddk',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
      '................',
    ],
    anchor: [7, 10],
    sockets: { head: [3, 2], legs: [7, 6], tail: [13, 2], back: [9, 0] },
  },
  biped: {
    grid: mirror([
      '...kkkkk',
      '.kkkBBBB',
      'kBkBBbbb',
      'kbkbbbaa',
      'kbkbbaaa',
      'kbkbbbaa',
      'kdkdbbbb',
      'kkkkkkkk',
      '........',
      '........',
      '........',
      '........',
    ]),
    anchor: [8, 11],
    sockets: { head: [8, 1], legs: [8, 7], back: [8, 2] },
  },
  serpent: {
    grid: [
      '...kkkkk..........',
      '..kaBbbdk.........',
      '..kaBbbdk.........',
      '..kaBbbbdk........',
      '...kaBbbdk........',
      '...kkaBbbdk.......',
      '..kBBkaBbbdkkkkk..',
      '.kBbbbkaBbbdBBBBk.',
      'kBbbbbbkaabbbbbbdk',
      'kbbbbbbbkkaaabbbdk',
      'kdbbbbbbbbkkkaaddk',
      '.kkkkkkkkkkkkkkkk.',
    ],
    anchor: [9, 11],
    sockets: { head: [5, 1], tail: [15, 8], back: [8, 7] },
  },
  winged: {
    grid: mirror([
      '.kkk',
      'kBBB',
      'kbba',
      'kbba',
      'kbbb',
      'kddd',
      '.kbk',
      '.kk.',
      '....',
      '....',
      '....',
      '....',
    ]),
    anchor: [4, 11],
    sockets: { head: [4, 1], wings: [4, 2], back: [4, 2] },
  },
};

export const HEADS: Part[] = [
  {
    grid: mirror([
      '..kkk',
      '.kBBB',
      'kBBbb',
      'kbbbb',
      'kbbbb',
      'kbbbb',
      '.kddd',
      '..kkk',
    ]),
    anchor: [5, 7],
    sockets: { horns: [5, 0], eyes: [5, 3], mouth: [5, 5] },
  },
  {
    grid: mirror([
      '.kkkkk',
      'kBBBBB',
      'kbbbbb',
      'kbbbbb',
      'kbbbbb',
      '.kdddd',
      '..kkkk',
    ]),
    anchor: [6, 6],
    sockets: { horns: [6, 0], eyes: [6, 3], mouth: [6, 5] },
  },
  {
    grid: mirror([
      'kk....',
      'kAk...',
      'kAbkkk',
      'kbBBBB',
      'kbbbbb',
      'kbbbbb',
      '.kbbbb',
      '.kdddd',
      '..kkkk',
    ]),
    anchor: [6, 8],
    sockets: { horns: [6, 2], eyes: [6, 5], mouth: [6, 7] },
  },
  {
    grid: mirror([
      '...kk',
      '..kBB',
      '.kBbb',
      'kBbbb',
      'kbbbb',
      'kbbbb',
      'kbbbb',
      '.kddd',
      '..kkk',
    ]),
    anchor: [5, 8],
    sockets: { horns: [5, 2], eyes: [5, 5], mouth: [5, 7] },
  },
  {
    grid: mirror([
      '..kkkk',
      '.kBBBB',
      'kBbbbb',
      'kbbbbb',
      'kbbbbb',
      '.kbAAA',
      '.kAaaa',
      '..kkkk',
    ]),
    anchor: [6, 7],
    sockets: { horns: [6, 0], eyes: [6, 3], mouth: [6, 5] },
  },
];

/** Eyes sit with their row 1 on the head's eye socket and stay within three rows, a row clear of the horns and the mouth. */
export const EYES: Part[] = [
  { grid: ['.ee..ee.', '.kp..kp.'], anchor: [4, 1] },
  { grid: ['eee..eee', 'epk..kpe', 'eee..eee'], anchor: [4, 1] },
  { grid: ['..eeee..', '.epkkpe.', '..eeee..'], anchor: [4, 1] },
  { grid: mirror(['kk..', '.kk.', '.pp.']), anchor: [4, 1] },
  { grid: mirror(['kpk.', '.k..']), anchor: [4, 1] },
];

export const MOUTHS: Part[] = [
  { grid: mirror(['.kk', '.t.']), anchor: [3, 0] },
  { grid: mirror(['ktm', '.km']), anchor: [3, 0] },
  { grid: mirror(['k..', '.kk']), anchor: [3, 0] },
  { grid: mirror(['tkk', 't..']), anchor: [3, 0] },
];

/** Horns standing in the middle of the head; they layer cleanly over a side pair. */
export const MIDDLE_HORNS: readonly number[] = [2, 3];

/** Horns and antennae stand on the head's horns socket with their bottom row. */
export const HORNS: Part[] = [
  { grid: mirror(['kk....', 'kAk...', 'kAak..', '.kaak.', '..kak.']), anchor: [6, 4] },
  { grid: mirror(['.kk..', 'kAak.', '.kdk.', '..kd.', '...d.']), anchor: [5, 4] },
  { grid: mirror(['.k', 'kt', 'kt', 'kt']), anchor: [2, 3] },
  { grid: mirror(['.k.k', 'kAkA', 'kAAa', 'kaaa']), anchor: [4, 3] },
  { grid: mirror(['k......', 'tk.....', 'ttk....', 'kttkk..', '.kkttk.']), anchor: [7, 4] },
];

export const LEGS: Record<'quadruped' | 'biped', Part[]> = {
  quadruped: [
    {
      grid: [
        '.kbkdk....kbkdk.',
        '.kbkdk....kbkdk.',
        '.kbkdk....kbkdk.',
        'kbbkddk..kbbkddk',
        'kkkkkkk..kkkkkkk',
      ],
      anchor: [7, 0],
    },
    {
      grid: [
        '..kbk.kbk..kbk..',
        '.kbk.kbk....kbk.',
        'kdk.kdk......kdk',
        'kdk.kdk......kdk',
        'kk..kk........kk',
      ],
      anchor: [7, 0],
    },
    {
      grid: [
        '..kbk.....kbk...',
        '..kbk.....kbk...',
        '..kdk.....kdk...',
        '..kbk.....kbk...',
        '.kttk....kttk...',
      ],
      anchor: [7, 0],
    },
  ],
  biped: [
    { grid: mirror(['.kbbk.', '.kbdk.', '.kbdk.', 'kbbdk.', 'kkkkk.']), anchor: [6, 0] },
    { grid: mirror(['..kbk.', '..kbk.', '..kdk.', '.kbdk.', 'ktktk.']), anchor: [6, 0] },
    { grid: mirror(['kbbbk.', 'kbbdk.', 'kbbdk.', 'kbbdk.', 'kkkkk.']), anchor: [6, 0] },
  ],
};

/** Wings spread from the shoulders; their anchor is between the wing roots. */
export const WINGS: Part[] = [
  {
    grid: mirror([
      '...........',
      'k..........',
      'kk.........',
      'kdk.....kk.',
      'kadk..kkdd.',
      'kaadkkddaak',
      'kaaaddaaaad',
      'kaaaaaaaadd',
      '.kaaakaaaak',
      '.kaak.kaak.',
      '..kk...kk..',
    ]),
    anchor: [11, 7],
  },
  {
    grid: mirror([
      'kk.........',
      'kBkk.......',
      'kBBBkk.....',
      'kbBBBBkk...',
      'kbbbbBBBkk.',
      'kbbbbbbbBBk',
      'kdbbbbbbbbb',
      'kdbdbbbbbbb',
      'kdkdbdbbbbk',
      '.kdkdkdbbk.',
      '..k.k.kkk..',
    ]),
    anchor: [11, 7],
  },
  {
    grid: mirror([
      '..kkkk.....',
      '.kAAAAkk...',
      'kAaaaaAAk..',
      'kaaakaaaAk.',
      'kaakAkaaaak',
      'kaaakaaaaak',
      '.kaaaaaaakk',
      '..kkkkkkkaa',
      '..kAaaak.kk',
      '...kaaak...',
      '....kkk....',
    ]),
    anchor: [11, 7],
  },
];

/** Tails grow from their root (the anchor) at the body's rear, behind the body. */
export const TAILS: Part[] = [
  { grid: ['.kk.', 'kAAk', 'kAak', '.kbk', '.kbk', 'kbk.', 'kk..'], anchor: [1, 6] },
  { grid: ['.kkk..', 'kttbk.', '.kkkbk', '...kbk', '...kbk', '..kbk.', '.kbk..'], anchor: [2, 6] },
  { grid: ['.kkk.', 'kAAAk', 'kAaak', 'kAaak', '.kkk.', '.kbk.', 'kbk..', 'kk...'], anchor: [0, 7] },
  { grid: ['..kk', '.kak', 'kaak', 'kbak', 'kbk.', 'kk..'], anchor: [0, 5] },
];

/**
 * Back extras: they stand on the body's back socket with their bottom row. Each is a pair at the two ends, so front
 * views show it on the shoulders and side views along the back, clear of the neck.
 */
export const SPIKES: Part[] = [
  { grid: mirror(['.k.k....', 'kAkAk...', 'kaaak...']), anchor: [8, 2] },
  { grid: mirror(['k.......', 'tk......', 'ttk.....', 'kttk....']), anchor: [8, 3] },
  { grid: mirror(['..k.....', '.kAk....', '.kAk....', 'kaaak...']), anchor: [8, 3] },
];
