import { expect, it } from 'vitest';
import {
  combatLineText, fightTiles, hurtParticle, monsterCaption, monsterTags, roomTrack, runMapLine, strikeParticle,
} from '../../src/ui/run/runView';
import type { MapRun, MonsterState } from '../../src/core/types';
import { mapDungeon, mapModLines } from '../../src/ui/maps/mapsView';

const shades: [string, string, string] = ['#111111', '#222222', '#333333'];

const monster = (over: Partial<MonsterState> = {}): MonsterState => ({
  name: 'Bog Leech', species: 0, rank: 'normal', mods: [], extra: 0, element: 'elemental',
  life: 9, maxLife: 9, damage: 2, intervalS: 2, xp: 80, ...over,
});

const run = (room: number, left: number, bossRoom = 6): MapRun => ({
  map: { id: 1, type: 'map', tier: 4, metre: 305, rarity: 'normal', mods: [] }, room, bossRoom, life: 50, hitCarry: 0, monsterCarry: 0, regenCarry: 0,
  gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [],  loot: [], items: 0,
  queue: Array.from({ length: left }, () => monster({ rank: room === bossRoom ? 'boss' : 'normal' })),
});

it('the room track', () => {
  expect(roomTrack(run(3, 2), 'The Drowned Foreman')).toEqual([
    { label: 'Room 1', note: 'cleared', state: 'done' },
    { label: 'Room 2', note: 'cleared', state: 'done' },
    { label: 'Room 3', note: '2 left', state: 'now' },
    { label: 'Room 4', note: '', state: 'next' },
    { label: 'Room 5', note: '', state: 'next' },
    { label: 'Boss', note: 'The Drowned Foreman', state: 'next' },
  ]);
  expect(roomTrack(run(6, 1), 'The Drowned Foreman').at(-1)).toEqual({ label: 'Boss', note: 'The Drowned Foreman', state: 'now' });
});

it('the room track follows the run\'s boss room', () => {
  const rows = roomTrack(run(8, 1, 8), 'Grub King');
  expect(rows.map((r) => r.label)).toEqual(['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Room 7', 'Boss']);
  expect(rows.slice(0, 7).every((r) => r.state === 'done')).toBe(true);
  expect(rows[7]).toEqual({ label: 'Boss', note: 'Grub King', state: 'now' });
});

it('combat log lines in words', () => {
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 41, crit: false, click: true })).toEqual({ text: 'You hit Drowned Digger for 41 (click)', tone: 'click' });
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 62, crit: true, click: false })).toEqual({ text: 'You hit Drowned Digger for 62 (crit)', tone: 'crit' });
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 80, crit: true, click: true })).toEqual({ text: 'You hit Drowned Digger for 80 (crit) (click)', tone: 'crit' });
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 38, crit: false, click: false })).toEqual({ text: 'You hit Drowned Digger for 38', tone: 'plain' });
  expect(combatLineText({ kind: 'hurt', monster: 'Drowned Digger', amount: 21 })).toEqual({ text: 'Drowned Digger hits you for 21', tone: 'hurt' });
  expect(combatLineText({ kind: 'heal', monster: 'Drowned Digger', amount: 7 })).toEqual({ text: 'Drowned Digger heals 7', tone: 'hurt' });
  expect(combatLineText({ kind: 'kill', monster: 'Bog Leech', xp: 1210, souls: 0 })).toEqual({ text: 'Bog Leech dies: +1,210 XP', tone: 'gain' });
  expect(combatLineText({ kind: 'kill', monster: 'Bog Leech', xp: 80, souls: 3 })).toEqual({ text: 'Bog Leech dies: +80 XP, +3 Souls', tone: 'gain' });
  expect(combatLineText({ kind: 'room', room: 2 })).toEqual({ text: 'Room 2 cleared', tone: 'gain' });
  expect(combatLineText({ kind: 'level', level: 12 })).toEqual({ text: 'Level 12!', tone: 'level' });
  const note = { name: 'Gloomward Mail', rarity: 'rare', base: 'armor', outcome: 'bag', value: 0 } as const;
  expect(combatLineText({ kind: 'drop', note })).toEqual({ text: 'Gloomward Mail dropped (to bag)', tone: 'drop' });
});

it('floor tiles follow the mockup pattern', () => {
  const tiles = fightTiles({ shades, pattern: 0 });
  expect(tiles).toHaveLength(126);
  expect(tiles[0]).toEqual({ bg: '#111111', edge: 'rgba(0, 0, 0, 0.3)' });
  expect(tiles[1]?.bg).toBe('#333333');
  expect(tiles[14 + 1]?.bg).toBe('#333333');
  expect(tiles[2 * 14 + 2]?.bg).toBe('#111111');
});

it('the other floor patterns', () => {
  const at = (pattern: 0 | 1 | 2 | 3, r: number, c: number) => fightTiles({ shades, pattern })[r * 14 + c]?.bg;
  expect(fightTiles({ shades, pattern: 1 })[0]?.bg).toBe('#111111');
  expect(at(1, 0, 1)).toBe('#222222');
  expect(at(1, 1, 1)).toBe('#111111');
  expect(at(1, 1, 2)).toBe('#333333');
  expect(at(2, 0, 0)).toBe('#333333');
  expect(at(2, 1, 0)).toBe('#222222');
  expect(at(2, 2, 0)).toBe('#111111');
  expect(at(2, 1, 2)).toBe('#333333');
  expect(at(3, 1, 1)).toBe('#111111');
  expect(at(3, 1, 4)).toBe('#222222');
  expect(at(3, 3, 1)).toBe('#222222');
});

it('a smaller floor can be asked for', () => {
  expect(fightTiles({ shades, pattern: 0 }, 2, 3)).toHaveLength(6);
});

it('the monster caption', () => {
  expect(monsterCaption(run(3, 2), 3)).toBe('Room 3 · enemy 2 of 3');
  expect(monsterCaption(run(3, 3), 3)).toBe('Room 3 · enemy 1 of 3');
  expect(monsterCaption(run(3, 1), 3)).toBe('Room 3 · enemy 3 of 3');
  expect(monsterCaption(run(6, 1), 0)).toBe('Boss');
});

it('champion modifiers as tags', () => {
  expect(monsterTags(monster({ rank: 'champion', mods: ['armored', 'fireTouched'] }))).toEqual(['Armored', 'Fire-touched']);
  expect(monsterTags(monster())).toEqual([]);
});

it('a strike floats its damage, a crit larger with a bang', () => {
  expect(strikeParticle({ amount: 41, crit: false }, { x: 100, y: 200 }, 7, 1000)).toMatchObject({ id: 7, kind: 'hit', text: '41', bornAt: 1000 });
  expect(strikeParticle({ amount: 1234, crit: true }, { x: 100, y: 200 }, 8, 1000)).toMatchObject({ kind: 'crit', text: '1,234!' });
  const a = strikeParticle({ amount: 1, crit: false }, { x: 100, y: 200 }, 7, 0);
  expect(strikeParticle({ amount: 1, crit: false }, { x: 100, y: 200 }, 7, 0)).toEqual(a);
  expect(Math.abs(a.x - 100)).toBeLessThanOrEqual(30);
});

it('hurt floats red', () => {
  expect(hurtParticle(21, { x: 50, y: 60 }, 3, 500)).toEqual({ id: 3, kind: 'hurt', text: '-21', x: 50, y: 60, bornAt: 500 });
});

it('the run\'s head lists an enchanted map\'s modifiers and what they pay, and nothing for a normal map', () => {
  const plain = run(1, 3);
  expect(mapModLines(plain.map)).toEqual([]);
  const enchanted = { ...plain.map, rarity: 'magic' as const, mods: [
    { kind: 'monsterSpeed' as const, tier: 4, value: 15 },
    { kind: 'hardened' as const, tier: 1, value: 6 },
  ] };
  expect(mapModLines(enchanted)).toEqual([
    'T4 Monsters attack 15% faster',
    'T1 Monsters take 6% less damage',
    'Rewards: +11% items · +6% rarity · +11% Souls',
  ]);
});

it('the last run names its map\'s rarity when it was enchanted', () => {
  const m = run(1, 3).map;
  const name = mapDungeon(77, m).type.name;
  expect(runMapLine(77, m)).toBe(`${name} · Tier 4 map`);
  expect(runMapLine(77, { ...m, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe(`${name} · Magic tier 4 map`);
  expect(runMapLine(77, { ...m, rarity: 'rare', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe(`${name} · Rare tier 4 map`);
});
