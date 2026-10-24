/** The open modal dialogs, oldest first: only the last one answers Escape and Tab. */
const stack: number[] = [];
const depths = new Map<number, number>();
let lastId = 0;

export function nextDialogId(): number {
  lastId += 1;
  return lastId;
}

/** Opens `id` on top; returns its depth, one more than the deepest dialog open, so a later dialog always paints over an earlier one. */
export function pushDialog(id: number): number {
  const depth = Math.max(0, ...depths.values()) + 1;
  stack.push(id);
  depths.set(id, depth);
  return depth;
}

/** Removes `id` wherever it sits, so a dialog that closes out of order leaves the others in place. */
export function popDialog(id: number): void {
  const at = stack.lastIndexOf(id);
  if (at >= 0) stack.splice(at, 1);
  depths.delete(id);
}

export function isTopDialog(id: number): boolean {
  return stack[stack.length - 1] === id;
}

/** The index Tab (or Shift+Tab) moves to among `count` elements, wrapping at both ends; -1 when there are none. */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (backwards) return current <= 0 ? count - 1 : current - 1;
  return current >= count - 1 ? 0 : current + 1;
}
