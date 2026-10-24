import {
  BOSS_DAMAGE, BOSS_LIFE, BOSS_REWARD, BRUTAL_DAMAGE, CHAMPION_DAMAGE, CHAMPION_LIFE, CHAMPION_REWARD,
  SWIFT_SPEED, THICK_LIFE, monsterDamageBase, monsterLifeBase, monsterXp,
} from './balance';
import type { LayoutMonster } from './dungeons';
import { speciesOf } from './species';
import type { MonsterState, Rank } from './types';

const RANK_LIFE: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_LIFE, boss: BOSS_LIFE };
const RANK_DAMAGE: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_DAMAGE, boss: BOSS_DAMAGE };
const RANK_REWARD: Readonly<Record<Rank, number>> = { normal: 1, champion: CHAMPION_REWARD, boss: BOSS_REWARD };

/** A layout slot made fightable: its species, rank and champion modifiers decide the numbers. */
export function monsterState(tier: number, lm: LayoutMonster): MonsterState {
  const s = speciesOf(tier)[lm.species];
  if (s === undefined) throw new Error(`no species ${lm.species} at tier ${tier}`);
  const maxLife = Math.max(1, Math.round(
    monsterLifeBase(tier) * s.lifeMult * RANK_LIFE[lm.rank] * (lm.mods.includes('thickSkinned') ? THICK_LIFE : 1),
  ));
  return {
    name: lm.name, species: lm.species, rank: lm.rank, mods: [...lm.mods], extra: lm.extra,
    element: lm.mods.includes('fireTouched') ? 'elemental' : s.element,
    life: maxLife, maxLife,
    damage: Math.max(1, Math.round(
      monsterDamageBase(tier) * s.damageMult * RANK_DAMAGE[lm.rank] * (lm.mods.includes('brutal') ? BRUTAL_DAMAGE : 1),
    )),
    intervalS: s.intervalS / (lm.mods.includes('swift') ? SWIFT_SPEED : 1),
    xp: monsterXp(tier) * RANK_REWARD[lm.rank],
  };
}
