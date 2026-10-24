import type { ReactNode } from 'react';
import { compose, layout, monsterLook, type LookChoice } from '../core/monsterLook';
import { EYES, HEADS, HORNS, LEGS, MOUTHS, SPIKES, TAILS, WINGS } from '../core/monsterParts';
import { hashN } from '../core/rng';
import { seedFromText } from '../core/seed';
import { BODY_KINDS, speciesOf, type BodyKind } from '../core/species';
import { RANKS } from '../core/types';
import { PixelArt } from './PixelArt';

// Dev-only page (?gallery=monsters) for judging the generated monsters; main.tsx keeps it out of the build.

const SEEDS = ['golden mole', 'amber-fox-427'];
const TIERS = [1, 2, 3, 4, 5, 6, 7, 8];
const FLOOR = 'hsl(30, 15%, 14%)';
const KIT_PALETTE: Record<string, string> = {
  k: '#120d0a', m: '#3a1414', t: '#efe6cf', e: '#f4ecd8', p: '#ffe08a',
  b: 'hsl(95, 45%, 48%)', B: 'hsl(95, 45%, 62%)', d: 'hsl(95, 45%, 34%)', a: 'hsl(275, 55%, 56%)', A: 'hsl(275, 55%, 68%)',
};

/** Every variant of every part a body takes, one at a time, the rest at variant 0. */
function kitVariants(body: BodyKind): { label: string; choice: LookChoice }[] {
  const base: LookChoice = { body, head: 0, eyes: 0, mouth: 0, horns: null, legs: 0, wings: 0, tail: 0, extras: [] };
  const out: { label: string; choice: LookChoice }[] = [];
  const add = (name: string, count: number, f: (i: number) => Partial<LookChoice>) => {
    for (let i = 0; i < count; i++) out.push({ label: `${name} ${i}`, choice: { ...base, ...f(i) } });
  };
  add('head', HEADS.length, (head) => ({ head }));
  add('eyes', EYES.length, (eyes) => ({ eyes }));
  add('mouth', MOUTHS.length, (mouth) => ({ mouth }));
  add('horns', HORNS.length, (horns) => ({ horns }));
  if (body === 'quadruped' || body === 'biped') add('legs', LEGS[body].length, (legs) => ({ legs }));
  if (body === 'winged') add('wings', WINGS.length, (wings) => ({ wings }));
  if (body === 'quadruped' || body === 'serpent') add('tail', TAILS.length, (tail) => ({ tail }));
  add('spikes', SPIKES.length, (index) => ({ extras: [{ kind: 'spikes', index }] }));
  return out;
}

function Cell({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure style={{ margin: 0, padding: 8, background: FLOOR, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {children}
      <figcaption style={{ fontSize: 11, color: 'var(--gm-muted)' }}>{caption}</figcaption>
    </figure>
  );
}

export function MonsterGallery() {
  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0 }}>Monster gallery</h1>
      {SEEDS.map((text) => {
        const seed = seedFromText(text);
        return (
          <section key={text}>
            <h2>Seed “{text}”</h2>
            {TIERS.map((tier) => (
              <div key={tier} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
                <strong style={{ width: 32 }}>T{tier}</strong>
                {speciesOf(tier).map((species, i) => (
                  <div key={species.name} style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    {RANKS.map((rank, r) => {
                      const look = monsterLook(seed, tier, { species: i, rank, extra: hashN(seed, tier, i, r) });
                      return (
                        <Cell key={rank} caption={rank === 'normal' ? species.name : rank}>
                          <PixelArt grid={look.grid} palette={look.palette} scale={4 * look.scale} aura={look.aura} label={`${species.name} (${rank})`} />
                        </Cell>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </section>
        );
      })}
      <section>
        <h2>Part kit</h2>
        {BODY_KINDS.map((body) => (
          <div key={body} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {kitVariants(body).map(({ label, choice }) => (
              <Cell key={label} caption={`${body} ${label}`}>
                <PixelArt grid={compose(layout(choice))} palette={KIT_PALETTE} scale={3} />
              </Cell>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
