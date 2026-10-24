import type { Element } from './types';

export const BODY_KINDS = ['blob', 'quadruped', 'biped', 'serpent', 'winged'] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

// Combat traits are fixed per species, so the seed never changes difficulty; only the look comes from the seed.
export interface Species {
  name: string; body: BodyKind; element: Element; intervalS: number; lifeMult: number; damageMult: number;
}

function sp(name: string, body: BodyKind, element: Element, intervalS: number, lifeMult: number, damageMult: number): Species {
  return { name, body, element, intervalS, lifeMult, damageMult };
}

// Indexed by tier - 1 (tiers 1-6 are the named bands).
export const NAMED_SPECIES: readonly (readonly Species[])[] = [
  [
    sp('Mole Rat', 'quadruped', 'physical', 2.0, 0.8, 0.9),
    sp('Cave Beetle', 'quadruped', 'physical', 2.5, 1.2, 0.8),
    sp('Tunnel Bat', 'winged', 'physical', 2.0, 0.7, 1.0),
    sp('Root Grub', 'blob', 'physical', 2.4, 1.1, 0.8),
  ],
  [
    sp('Clay Golem', 'biped', 'physical', 3.0, 1.3, 1.0),
    sp('Mud Slime', 'blob', 'elemental', 2.0, 1.0, 0.8),
    sp('Burrow Snake', 'serpent', 'physical', 2.2, 0.8, 1.1),
    sp('Kiln Imp', 'winged', 'elemental', 1.8, 0.7, 1.1),
  ],
  [
    sp('Cave Spider', 'quadruped', 'physical', 2.0, 0.9, 1.0),
    sp('Drip Slime', 'blob', 'elemental', 2.5, 1.1, 0.9),
    sp('Stalker Bat', 'winged', 'physical', 1.8, 0.7, 1.0),
    sp('Chalk Crawler', 'serpent', 'physical', 2.6, 1.2, 0.9),
  ],
  [
    sp('Drowned Digger', 'biped', 'physical', 2.5, 1.2, 1.0),
    sp('Bog Leech', 'serpent', 'elemental', 2.0, 0.8, 1.0),
    sp('Granite Crawler', 'quadruped', 'physical', 3.0, 1.4, 1.1),
    sp('Quarry Ghoul', 'biped', 'elemental', 2.2, 1.0, 1.1),
  ],
  [
    sp('Ember Imp', 'winged', 'elemental', 1.8, 0.7, 1.1),
    sp('Basalt Hound', 'quadruped', 'physical', 2.2, 1.0, 1.0),
    sp('Ash Wraith', 'biped', 'elemental', 2.5, 0.9, 1.2),
    sp('Magma Slug', 'blob', 'elemental', 2.8, 1.3, 0.9),
  ],
  [
    sp('Glass Stalker', 'quadruped', 'physical', 2.0, 0.9, 1.1),
    sp('Obsidian Golem', 'biped', 'physical', 3.0, 1.5, 1.0),
    sp('Shade', 'winged', 'elemental', 1.8, 0.8, 1.1),
    sp('Mirror Eel', 'serpent', 'elemental', 2.2, 1.0, 1.1),
  ],
];

// The deep bands (tier 7 on) cycle these four lists by deep band index.
export const DEEP_SPECIES: readonly (readonly Species[])[] = [
  [
    sp('Hollow One', 'biped', 'elemental', 2.2, 1.0, 1.1),
    sp('Deep Wyrm', 'serpent', 'physical', 2.5, 1.3, 1.2),
    sp('Void Eye', 'blob', 'elemental', 2.0, 0.9, 1.2),
    sp('Gloom Bat', 'winged', 'physical', 1.8, 0.8, 1.2),
  ],
  [
    sp('Bone Crawler', 'quadruped', 'physical', 2.4, 1.2, 1.1),
    sp('Pale Maw', 'blob', 'physical', 2.6, 1.3, 1.0),
    sp('Wailing Shade', 'winged', 'elemental', 1.9, 0.8, 1.2),
    sp('Rust Golem', 'biped', 'physical', 3.0, 1.5, 1.0),
  ],
  [
    sp('Ember Wyrm', 'serpent', 'elemental', 2.3, 1.1, 1.2),
    sp('Cinder Hound', 'quadruped', 'elemental', 2.1, 1.0, 1.1),
    sp('Ash Colossus', 'biped', 'physical', 3.2, 1.6, 1.0),
    sp('Soot Bat', 'winged', 'elemental', 1.8, 0.7, 1.2),
  ],
  [
    sp('Crystal Mite', 'quadruped', 'physical', 2.0, 0.9, 1.1),
    sp('Prism Slime', 'blob', 'elemental', 2.4, 1.2, 1.0),
    sp('Shard Serpent', 'serpent', 'physical', 2.4, 1.1, 1.2),
    sp('Glass Wraith', 'biped', 'elemental', 2.2, 1.0, 1.2),
  ],
];

export function speciesOf(tier: number): readonly Species[] {
  const t = Math.max(1, Math.floor(tier));
  if (t <= NAMED_SPECIES.length) return NAMED_SPECIES[t - 1] ?? [];
  return DEEP_SPECIES[(t - NAMED_SPECIES.length - 1) % DEEP_SPECIES.length] ?? [];
}
