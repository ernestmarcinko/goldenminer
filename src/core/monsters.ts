import {
  BOSS_DAMAGE, BOSS_LIFE, BOSS_REWARD, BRUTAL_DAMAGE, CHAMPION_DAMAGE, CHAMPION_LIFE, CHAMPION_REWARD, MAX_DAMAGE,
  MAX_LIFE, SWIFT_SPEED, THICK_LIFE, monsterDamageBase, monsterLifeBase, monsterXp,
} from './balance';
import type { LayoutMonster } from './dungeons';
import { NO_MAP_EFFECTS, type MapEffects } from './mapMods';
import { speciesOf } from './species';
import type { MonsterState, Rank } from './types';

const RANK_LIFE: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_LIFE, boss: BOSS_LIFE };
const RANK_DAMAGE: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_DAMAGE, boss: BOSS_DAMAGE };
const RANK_REWARD: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_REWARD, boss: BOSS_REWARD };

/** What a rank multiplies a monster's XP, Souls and Gold by. */
export const rankReward = (rank: Rank): number => RANK_REWARD[rank];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A layout slot made fightable: its species, rank and champion modifiers decide the numbers, scaled by the map's
 * modifiers (`fx`), up to the save limits.
 */
export function monsterState(tier: number, lm: LayoutMonster, fx: MapEffects = NO_MAP_EFFECTS): MonsterState {
  const s = speciesOf(tier)[lm.species];
  if (s === undefined) throw new Error(`no species ${lm.species} at tier ${tier}`);
  const power = lm.rank === 'normal' ? 1 : fx.bossMult;
  const maxLife = clamp(Math.round(
    monsterLifeBase(tier) * s.lifeMult * RANK_LIFE[lm.rank] * (lm.mods.includes('thickSkinned') ? THICK_LIFE : 1)
      * fx.lifeMult * power,
  ), 1, MAX_LIFE);
  return {
    name: lm.name, species: lm.species, rank: lm.rank, mods: [...lm.mods], extra: lm.extra,
    element: lm.mods.includes('fireTouched') ? 'elemental' : s.element,
    life: maxLife, maxLife,
    damage: clamp(Math.round(
      monsterDamageBase(tier) * s.damageMult * RANK_DAMAGE[lm.rank] * (lm.mods.includes('brutal') ? BRUTAL_DAMAGE : 1)
        * fx.damageMult * power,
    ), 1, MAX_DAMAGE),
    intervalS: s.intervalS / (lm.mods.includes('swift') ? SWIFT_SPEED : 1) / fx.speedMult,
    xp: monsterXp(tier) * RANK_REWARD[lm.rank],
  };
}
