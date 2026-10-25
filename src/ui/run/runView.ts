import { dungeonIndexAt, dungeonType, type DungeonType } from '../../core/dungeons';
import type { MapItem } from '../../core/items';
import { xpToNext } from '../../core/levels';
import { MAP_MOD_TEXT, mapEffects } from '../../core/mapMods';
import type { ChampionMod, CombatLine, MapRun, MonsterState, RunGains, RunResult } from '../../core/types';
import { itemKindLine, lootNoteText } from '../character/itemView';
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

export const FIGHT_COLS = 14;
export const FIGHT_ROWS = 9;
const TILE_EDGE = 'rgba(0, 0, 0, 0.3)';

/** Which of a floor's three shades tile (r, c) takes, by the dungeon type's pattern. */
function shadeIndex(pattern: DungeonType['floor']['pattern'], r: number, c: number): number {
  switch (pattern) {
    case 0: return (r * 5 + c * 11 + ((r * c) % 3)) % 3;
    case 1: return (r + c) % 2 === 0 ? 0 : 1 + (r % 2);
    case 2: return (r + 2 * c) % 5 === 0 ? 2 : r % 2;
    case 3: return c % 4 === 0 || r % 3 === 0 ? 1 : 0;
  }
}

/** The fight scene's floor, row-major: each tile's background and the dark edge drawn under it. */
export function fightTiles(
  floor: DungeonType['floor'], cols = FIGHT_COLS, rows = FIGHT_ROWS,
): { bg: string; edge: string }[] {
  const tiles: { bg: string; edge: string }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) tiles.push({ bg: floor.shades[shadeIndex(floor.pattern, r, c)] ?? floor.shades[0], edge: TILE_EDGE });
  }
  return tiles;
}

/** The map a run was on, in the card's words, e.g. "Flooded Adit · Rare tier 4 map". */
export function runMapLine(seed: number, map: MapItem): string {
  return `${mapDungeon(seed, map).type.name} · ${itemKindLine(map)}`;
}

export interface RoomRow { label: string; note: string; state: 'done' | 'now' | 'next' }

/** Rooms 1 to bossRoom - 1, then the boss: cleared, the one being fought, and the ones still ahead. */
export function roomTrack(run: MapRun, bossName: string): RoomRow[] {
  const rows: RoomRow[] = [];
  for (let room = 1; room < run.bossRoom; room++) {
    if (room < run.room) rows.push({ label: `Room ${room}`, note: 'cleared', state: 'done' });
    else if (room === run.room) rows.push({ label: `Room ${room}`, note: `${formatNumber(run.queue.length)} left`, state: 'now' });
    else rows.push({ label: `Room ${room}`, note: '', state: 'next' });
  }
  rows.push({ label: 'Boss', note: bossName, state: run.room >= run.bossRoom ? 'now' : 'next' });
  return rows;
}

export type LineTone = 'plain' | 'click' | 'crit' | 'hurt' | 'gain' | 'level' | 'drop';

export function combatLineText(line: CombatLine): { text: string; tone: LineTone } {
  switch (line.kind) {
    case 'hit': {
      const text = `You hit ${line.monster} for ${formatNumber(line.amount)}${line.crit ? ' (crit)' : ''}${line.click ? ' (click)' : ''}`;
      return { text, tone: line.crit ? 'crit' : line.click ? 'click' : 'plain' };
    }
    case 'hurt': return { text: `${line.monster} hits you for ${formatNumber(line.amount)}`, tone: 'hurt' };
    case 'heal': return { text: `${line.monster} heals ${formatNumber(line.amount)}`, tone: 'hurt' };
    case 'kill': {
      const souls = line.souls > 0 ? `, +${formatNumber(line.souls)} Souls` : '';
      return { text: `${line.monster} dies: +${formatNumber(line.xp)} XP${souls}`, tone: 'gain' };
    }
    case 'room': return { text: `Room ${formatNumber(line.room)} cleared`, tone: 'gain' };
    case 'level': return { text: `Level ${formatNumber(line.level)}!`, tone: 'level' };
    case 'drop': return { text: `${line.note.name} dropped (${lootNoteText(line.note)})`, tone: 'drop' };
  }
}

/** Under the monster's life bar: its place in the room, or just Boss. `roomSize` is how many monsters the room began with. */
export function monsterCaption(run: MapRun, roomSize: number): string {
  if (run.room >= run.bossRoom) return 'Boss';
  const total = Math.max(roomSize, run.queue.length);
  return `Room ${formatNumber(run.room)} · enemy ${formatNumber(total - run.queue.length + 1)} of ${formatNumber(total)}`;
}

const MOD_LABELS: Record<ChampionMod, string> = {
  armored: 'Armored', swift: 'Swift', vampiric: 'Vampiric', fireTouched: 'Fire-touched', brutal: 'Brutal', thickSkinned: 'Thick-skinned',
};

export function monsterTags(m: Pick<MonsterState, 'mods'>): string[] {
  return m.mods.map((mod) => MOD_LABELS[mod]);
}

export type FloatKind = 'hit' | 'crit' | 'hurt';
export interface FloatingNumber { id: number; kind: FloatKind; text: string; x: number; y: number; bornAt: number }

const JITTER_PX = 30;

/** A strike's number at `origin`, shifted sideways by a fixed amount per id so a run of hits doesn't stack. */
export function strikeParticle(
  e: { amount: number; crit: boolean }, origin: { x: number; y: number }, id: number, nowMs: number,
): FloatingNumber {
  const jitter = ((id * 37) % (2 * JITTER_PX + 1)) - JITTER_PX;
  return {
    id, kind: e.crit ? 'crit' : 'hit', text: `${formatNumber(e.amount)}${e.crit ? '!' : ''}`,
    x: origin.x + jitter, y: origin.y, bornAt: nowMs,
  };
}

export function hurtParticle(amount: number, origin: { x: number; y: number }, id: number, nowMs: number): FloatingNumber {
  return { id, kind: 'hurt', text: `-${formatNumber(amount)}`, x: origin.x, y: origin.y, bornAt: nowMs };
}
