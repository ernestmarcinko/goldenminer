import { expect, it } from 'vitest';
import {
  combatLineText, deathOfLastRun, fightTiles, gainsLine, hurtParticle, mapDungeon, mapModLines, mapRewardsText, mapSpecialLine, monsterCaption, monsterTags,
  roomTrack, runMapLine, runTitle, strikeParticle, xpBar,
} from '../../src/ui/run/runView';
import { dungeonIndexAt, dungeonType } from '../../src/core/dungeons';
import type { MapItem } from '../../src/core/items';
import type { MapRun, MonsterState, RunOutcome } from '../../src/core/types';

const shades: [string, string, string] = ['#111111', '#222222', '#333333'];

const monster = (over: Partial<MonsterState> = {}): MonsterState => ({
  name: 'Bog Leech', species: 0, rank: 'normal', mods: [], extra: 0, element: 'elemental',
  life: 9, maxLife: 9, damage: 2, intervalS: 2, xp: 80, ...over,
});

const run = (room: number, left: number, bossRoom = 6): MapRun => ({
  map: { id: 1, type: 'map', tier: 4, metre: 305, rarity: 'normal', mods: [] }, room, bossRoom, life: 50, hitCarry: 0, monsterCarry: 0, regenCarry: 0,
  gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [],  loot: [], items: 0, strikes: 0, minLifeShare: 1, elapsedS: 0, attempt: 0, startedWith: { emptySlot: false, plainGear: false, noBattleGear: false, noPassives: false },
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

it('the room track names both bosses on a second-boss map', () => {
  const r = run(6, 1);
  r.map.special = 'secondBoss';
  expect(roomTrack(r, 'Grub King').at(-1)).toEqual({ label: 'Bosses', note: 'Grub King and its Twin', state: 'now' });
});

it('the room track follows the run\'s boss room', () => {
  const rows = roomTrack(run(8, 1, 8), 'Grub King');
  expect(rows.map((r) => r.label)).toEqual(['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Room 7', 'Boss']);
  expect(rows.slice(0, 7).every((r) => r.state === 'done')).toBe(true);
  expect(rows[7]).toEqual({ label: 'Boss', note: 'Grub King', state: 'now' });
});

it('combat log lines in words', () => {
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 62, crit: true })).toEqual({ text: 'You hit Drowned Digger for 62 (crit)', tone: 'crit' });
  expect(combatLineText({ kind: 'hit', monster: 'Drowned Digger', amount: 38, crit: false })).toEqual({ text: 'You hit Drowned Digger for 38', tone: 'plain' });
  expect(combatLineText({ kind: 'hurt', monster: 'Drowned Digger', amount: 21 })).toEqual({ text: 'Drowned Digger hits you for 21', tone: 'hurt' });
  expect(combatLineText({ kind: 'heal', monster: 'Drowned Digger', amount: 7 })).toEqual({ text: 'Drowned Digger heals 7', tone: 'hurt' });
  expect(combatLineText({ kind: 'kill', monster: 'Bog Leech', xp: 1210, souls: 0 })).toEqual({ text: 'Bog Leech dies: +1,210 XP', tone: 'gain' });
  expect(combatLineText({ kind: 'kill', monster: 'Bog Leech', xp: 80, souls: 3 })).toEqual({ text: 'Bog Leech dies: +80 XP, +3 Souls', tone: 'gain' });
  expect(combatLineText({ kind: 'room', room: 2 })).toEqual({ text: 'Room 2 cleared', tone: 'gain' });
  expect(combatLineText({ kind: 'level', level: 12 })).toEqual({ text: 'Level 12!', tone: 'level' });
  expect(combatLineText({ kind: 'saved', monster: 'Bog Leech' }))
    .toEqual({ text: "Kraken Leather holds: Bog Leech's blow leaves you at 1 life", tone: 'level' });
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
    { text: 'Monsters attack 15% faster', tone: 'plain', tier: 4 },
    { text: 'Monsters take 6% less damage', tone: 'plain', tier: 1 },
  ]);
  expect(mapRewardsText(enchanted)).toBe('Rewards: +11% items · +6% rarity · +11% Souls');
  expect(mapRewardsText(plain.map)).toBe('');
});

it('the run\'s head lists a map\'s special in the legendary colour, with no tier, and nothing for a map without one', () => {
  const plain = run(1, 3).map;
  expect(mapSpecialLine(plain)).toBeNull();
  expect(mapSpecialLine({ ...plain, special: 'treasureRoom' })).toEqual({ text: 'A treasure room before the boss', tone: 'special' });
  expect(mapSpecialLine({ ...plain, special: 'tripleSouls' })).toEqual({ text: 'Souls ×3, but rooms don\'t heal', tone: 'special' });
  expect(mapModLines({ ...plain, special: 'secondBoss' })).toEqual([]);
});

it('the last run names its map\'s rarity when it was enchanted', () => {
  const m = run(1, 3).map;
  const name = mapDungeon(77, m).type.name;
  expect(runMapLine(77, m)).toBe(`${name} · Tier 4 map`);
  expect(runMapLine(77, { ...m, rarity: 'magic', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe(`${name} · Magic tier 4 map`);
  expect(runMapLine(77, { ...m, rarity: 'rare', mods: [{ kind: 'monsterLife', tier: 4, value: 27 }] })).toBe(`${name} · Rare tier 4 map`);
});

const plainMap = (id: number, tier: number, metre = 1): MapItem => ({ id, type: 'map', tier, metre, rarity: 'normal', mods: [] });

it('xp bar', () => {
  expect(xpBar(1, 50)).toEqual({ label: 'Level 1', text: '50 / 100 XP', pct: 0.5 });
  expect(xpBar(100, 0)).toEqual({ label: 'Level 100', text: 'Max level', pct: 1 });
  expect(xpBar(30, 1234).text).toBe('1,234 / 101,741 XP');
  // the late levels cost millions, shown compact
  expect(xpBar(99, 12_345_678).text).toBe('12.3M / 169M XP');
  expect(xpBar(1, 0)).toEqual({ label: 'Level 1', text: '0 / 100 XP', pct: 0 });
  // the last xp below a level stays short of a full bar
  expect(xpBar(1, 99).text).toBe('99 / 100 XP');
  expect(xpBar(1, 99).pct).toBeCloseTo(0.99);
});

it('run results in words', () => {
  const g = { xp: 200, souls: 5, gold: 40, levels: 1 };
  const r = (outcome: RunOutcome, room: number) => ({ map: plainMap(1, 1), outcome, room, bossRoom: 6, gained: g, items: 2, seen: false });
  expect(runTitle(r('cleared', 6))).toBe('Map cleared!');
  expect(runTitle(r('died', 3))).toBe('You fell in room 3');
  expect(runTitle(r('died', 6))).toBe('You fell in the boss room');
  expect(runTitle(r('left', 2))).toBe('You left the map in room 2');
  expect(runTitle(r('left', 6))).toBe('You left the map in the boss room');
  expect(gainsLine(g, 2)).toBe('+200 XP · +5 Souls · +40 Gold · 2 items · +1 level');
  expect(gainsLine({ ...g, levels: 0 }, 1)).toBe('+200 XP · +5 Souls · +40 Gold · 1 item');
});

it('a map opens into the dungeon at its metre, the same for every map of that tier and place', () => {
  const seed = 9090;
  for (const [tier, metre] of [[1, 1], [4, 305], [5, 40]] as const) {
    const index = dungeonIndexAt(seed, metre);
    expect(mapDungeon(seed, { tier, metre })).toEqual({ key: `${tier}:${index}`, type: dungeonType(seed, tier, index) });
    expect(mapDungeon(seed, plainMap(99, tier, metre))).toEqual(mapDungeon(seed, { tier, metre }));
  }
});

it('the run result links only to its own death', () => {
  const map: MapItem = { id: 7, type: 'map', tier: 4, metre: 305, rarity: 'normal', mods: [] };
  const death = { id: 9, tick: 1, at: 0, map, room: 2, bossRoom: 6, killer: 'Bog Leech' };
  const lastRun = { map, outcome: 'died' as RunOutcome, room: 2, bossRoom: 6, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: false };
  expect(deathOfLastRun({ lastRun, deaths: [death] })).toBe(death);
  expect(deathOfLastRun({ lastRun, deaths: [] })).toBeUndefined();                                     // an old save's death
  expect(deathOfLastRun({ lastRun, deaths: [{ ...death, map: { ...map, id: 3 } }] })).toBeUndefined();  // another run's
  expect(deathOfLastRun({ lastRun: { ...lastRun, outcome: 'left' }, deaths: [death] })).toBeUndefined();
});
