import { dungeonIndexAt, dungeonType, type DungeonType } from '../../core/dungeons';
import { filledCount } from '../../core/cells';
import { xpToNext } from '../../core/levels';
import { STASH_PAGE_SIZE } from '../../core/balance';
import { MAP_MOD_TEXT, mapEffects } from '../../core/mapMods';
import type { GameState, MapItem, RunGains, RunResult } from '../../core/types';
import { formatNumber, plural } from '../format';

export interface XpBar { label: string; text: string; pct: number }

export function xpBar(level: number, xp: number): XpBar {
  const need = xpToNext(level);
  const label = `Level ${formatNumber(level)}`;
  if (need === 0) return { label, text: 'Max level', pct: 1 };
  return { label, text: `${formatNumber(xp)} / ${formatNumber(need)} XP`, pct: Math.min(1, Math.max(0, xp / need)) };
}

const roomWords = (room: number, bossRoom: number): string => (room >= bossRoom ? 'the boss room' : `room ${formatNumber(room)}`);

export function runTitle(r: RunResult): string {
  switch (r.outcome) {
    case 'cleared': return 'Map cleared!';
    case 'died': return `You fell in ${roomWords(r.room, r.bossRoom)}`;
    case 'left': return `You left the map in ${roomWords(r.room, r.bossRoom)}`;
  }
}

export function gainsLine(g: RunGains, items: number): string {
  const parts = [`+${formatNumber(g.xp)} XP`, `+${formatNumber(g.souls)} Souls`, `+${formatNumber(g.gold)} Gold`, plural(items, 'item', 'items')];
  if (g.levels > 0) parts.push(`+${plural(g.levels, 'level', 'levels')}`);
  return parts.join(' · ');
}

/** The dungeon a map opens into. */
export function mapDungeon(seed: number, map: Pick<MapItem, 'tier' | 'metre'>): { key: string; type: DungeonType } {
  const index = dungeonIndexAt(seed, map.metre);
  return { key: `${map.tier}:${index}`, type: dungeonType(seed, map.tier, index) };
}

/** A map's modifiers with their tiers, in their rolled order. */
export function mapModTexts(map: MapItem): string[] {
  return map.mods.map((m) => `T${formatNumber(m.tier)} ${MAP_MOD_TEXT[m.kind](m.value)}`);
}

/** What a map's modifiers pay, or '' for a map with none. */
export function mapRewardsText(map: MapItem): string {
  if (map.mods.length === 0) return '';
  const e = mapEffects(map);
  return `Rewards: +${formatNumber(e.quantity)}% items · +${formatNumber(e.rarity)}% rarity · +${formatNumber(e.souls)}% Souls`;
}

/** A map's modifiers, then what they pay; none for a normal map. The item card and the run's head show these. */
export function mapModLines(map: MapItem): string[] {
  const rewards = mapRewardsText(map);
  return rewards === '' ? [] : [...mapModTexts(map), rewards];
}

/**
 * One map to run, and where it lies. `page` is 1-based within the Maps tab, and 0 for the bag. `mods` is the
 * modifier lines, and `rewards` what they pay ('' for a normal map).
 */
export interface MapRow {
  id: number; name: string; tier: number; metre: number; rooms: number; where: 'bag' | 'maps'; page: number;
  rarity: MapItem['rarity']; mods: string[]; rewards: string;
}

/** Every map in the bag and the Maps tab, the highest tier first, then by name, then by id. */
export function mapRows(state: GameState): MapRow[] {
  const rows: MapRow[] = [];
  const add = (m: MapItem, where: 'bag' | 'maps', page: number): void => {
    const { type } = mapDungeon(state.seed, m);
    rows.push({
      id: m.id, name: type.name, tier: m.tier, metre: m.metre, rooms: type.rooms, where, page,
      rarity: m.rarity, mods: mapModTexts(m), rewards: mapRewardsText(m),
    });
  };
  state.bag.forEach((c) => { if (c !== null && c.type === 'map') add(c, 'bag', 0); });
  state.stash.maps.forEach((c, i) => { if (c !== null) add(c, 'maps', Math.floor(i / STASH_PAGE_SIZE) + 1); });
  return rows.sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name) || a.id - b.id);
}

/** Every map you hold: those in the bag and those in the Maps tab. */
export function mapCount(state: GameState): number {
  return filledCount(state.stash.maps) + state.bag.filter((c) => c !== null && c.type === 'map').length;
}
