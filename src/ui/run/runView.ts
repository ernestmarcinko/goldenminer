import type { DungeonType } from '../../core/dungeons';
import type { ChampionMod, CombatLine, MapRun, MonsterState } from '../../core/types';
import { lootNoteText } from '../character/itemView';
import { formatNumber } from '../format';

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

export interface RoomRow { label: string; note: string; state: 'done' | 'now' | 'next' }

/** Rooms 1 to bossRoom - 1, then the boss: cleared, the one being fought, and the ones still ahead. */
export function roomTrack(run: MapRun, bossName: string): RoomRow[] {
  const rows: RoomRow[] = [];
  for (let room = 1; room < run.bossRoom; room++) {
    if (room < run.room) rows.push({ label: `Room ${room}`, note: 'cleared', state: 'done' });
    else if (room === run.room) rows.push({ label: `Room ${room}`, note: `${run.queue.length} left`, state: 'now' });
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
