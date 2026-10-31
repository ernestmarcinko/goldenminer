import { MAX_ITEM_LEVEL, SOUL_UPGRADE_BASE } from './balance';
import { checkAchievements } from './achievements';
import { itemAt } from './cells';
import { trail } from './dropLog';
import { isGear, setOfSlot } from './items';
import { hasKeystone } from './passives';
import type { GearItem } from './items';
import type { GameState, ItemLoc } from './types';

export type SoulUpgradeCheck = 'ok' | 'notBattle' | 'sealed' | 'maxLevel' | 'noSouls' | 'invalid';

/** The Souls that raise gear of this item level by one. */
export function soulUpgradeCost(ilvl: number): number {
  return SOUL_UPGRADE_BASE * ilvl * ilvl;
}

/** What an upgrade actually costs: Soul Debt makes Soul upgrades 25% cheaper. */
export function soulUpgradeCostFor(state: GameState, ilvl: number): number {
  return Math.round(soulUpgradeCost(ilvl) * (hasKeystone(state, 'soulDebt') ? 0.75 : 1));
}

/** Battle gear that is worn, in the bag or in the General tab; anything else, or nothing, is undefined. */
function upgradable(state: GameState, target: ItemLoc): GearItem | undefined {
  if (target.where !== 'worn' && target.where !== 'bag' && target.where !== 'stash') return undefined;
  const item = itemAt(state, target);
  return item !== undefined && isGear(item) ? item : undefined;
}

/** Whether an upgrade would go through: battle gear first, then sealed, the level cap, and the Souls. */
export function canUpgrade(state: GameState, target: ItemLoc): SoulUpgradeCheck {
  const item = upgradable(state, target);
  if (item === undefined) return 'invalid';
  if (setOfSlot(item.slot) !== 'battle') return 'notBattle';
  if (item.sealed === true) return 'sealed';
  if (item.ilvl >= MAX_ITEM_LEVEL) return 'maxLevel';
  return state.souls >= soulUpgradeCostFor(state, item.ilvl) ? 'ok' : 'noSouls';
}

/**
 * Raises battle gear one item level for Souls, which lifts its tier cap so later crafts roll higher. Only the level
 * changes: its name, lines, implicit and sockets stay. A refusal changes nothing.
 */
export function soulUpgrade(state: GameState, target: ItemLoc): SoulUpgradeCheck {
  const check = canUpgrade(state, target);
  if (check !== 'ok') return check;
  const item = upgradable(state, target) as GearItem;
  state.souls -= soulUpgradeCostFor(state, item.ilvl);
  state.stats.soulsSpent += soulUpgradeCostFor(state, item.ilvl);
  checkAchievements(state, 'soulsSpent');
  item.ilvl++;
  trail(state, item.id, { event: 'upgraded' });
  return check;
}
