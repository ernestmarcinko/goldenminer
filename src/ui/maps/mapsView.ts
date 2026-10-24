import { dungeonIndexAt, dungeonType, type DungeonType } from '../../core/dungeons';
import { xpToNext } from '../../core/levels';
import type { MapItem, RunGains, RunResult } from '../../core/types';
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

/** Maps found at the same metre are one dungeon: a row has the oldest map's id, to run it, and how many there are. */
export interface MapEntry { id: number; metre: number; rooms: number; count: number }

export interface MapGroup {
  key: string; name: string; tier: number;
  maps: MapEntry[];
}

/**
 * The stash's maps by tier and dungeon: the highest tier first, then by name. Within a group the maps of one metre
 * collapse into one entry, and the entries go oldest first.
 */
export function mapGroups(seed: number, maps: readonly MapItem[]): MapGroup[] {
  const groups = new Map<string, MapGroup>();
  for (const m of maps) {
    const { key, type } = mapDungeon(seed, m);
    let group = groups.get(key);
    if (group === undefined) {
      group = { key, name: type.name, tier: m.tier, maps: [] };
      groups.set(key, group);
    }
    const same = group.maps.find((e) => e.metre === m.metre);
    if (same === undefined) group.maps.push({ id: m.id, metre: m.metre, rooms: type.rooms, count: 1 });
    else {
      same.id = Math.min(same.id, m.id);
      same.count++;
    }
  }
  const out = [...groups.values()];
  for (const g of out) g.maps.sort((a, b) => a.id - b.id);
  return out.sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
}
