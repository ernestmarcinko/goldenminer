import { expect, it } from 'vitest';
import { cardClickTracker, HOVER_RECHECK_MS, recheckHover } from '../../src/ui/platform';

it('remembers a click inside a card until the pointer moves more than 3 px from its point', () => {
  const t = cardClickTracker();
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, true);
  expect(t.through(100, 200)).toBe(true);
  expect(t.through(103, 200)).toBe(true);
  expect(t.through(103, 201)).toBe(false);
  // a click outside a card at the same point (what the closed card uncovered) keeps it, so a third is refused too
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(true);
  // a hand on a mouse jitters: a move of up to 3 px keeps it, and a click there still counts as aimed at the card
  t.move(100, 200);
  t.move(103, 200);
  t.move(102, 202);
  expect(t.through(101, 202)).toBe(true);
  expect(t.through(104, 200)).toBe(false);
  t.move(104, 200);
  expect(t.through(100, 200)).toBe(false);
  t.move(100, 200);
  expect(t.through(100, 200)).toBe(false);
});

it('a cell that missed :hover on its mount looks again at the next frame, then once more a moment later', () => {
  // a fake clock: the frame and the timer each run only when flushed, unless cancelled first
  const pending: { kind: 'frame' | 'after'; ms: number; cb: () => void; live: boolean }[] = [];
  const timers = {
    frame: (cb: () => void) => { const t = { kind: 'frame' as const, ms: 0, cb, live: true }; pending.push(t); return () => { t.live = false; }; },
    after: (ms: number, cb: () => void) => { const t = { kind: 'after' as const, ms, cb, live: true }; pending.push(t); return () => { t.live = false; }; },
  };
  const flush = (): string[] => pending.splice(0).filter((t) => t.live).map((t) => { t.cb(); return t.kind === 'frame' ? 'frame' : `${t.ms} ms`; });
  const looks = (answers: boolean[]) => { let n = 0; return { look: () => { n++; return answers.shift() ?? false; }, count: () => n }; };

  // Chrome can set :hover later than one frame: the frame misses, the later look finds it
  const late = looks([false, true]);
  recheckHover(late.look, timers);
  expect(late.count()).toBe(0);
  expect(flush()).toEqual(['frame']);
  expect(flush()).toEqual([`${HOVER_RECHECK_MS} ms`]);
  expect([late.count(), pending.length]).toEqual([2, 0]);
  expect(HOVER_RECHECK_MS).toBe(100);

  // a hit at the frame needs no second look
  const early = looks([true]);
  recheckHover(early.look, timers);
  flush();
  expect([early.count(), pending.length]).toEqual([1, 0]);

  // the cell unmounting or taking another item cancels whichever look is still to come
  const gone = looks([]);
  recheckHover(gone.look, timers)();
  expect(flush()).toEqual([]);
  expect(gone.count()).toBe(0);
  const changed = looks([false]);
  const cancel = recheckHover(changed.look, timers);
  flush();
  cancel();
  expect(flush()).toEqual([]);
  expect(changed.count()).toBe(1);
});
