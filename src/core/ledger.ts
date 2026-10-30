/**
 * Puts `value` into a sorted, duplicate-free list, keeping it sorted; true when the value was new. The lifetime ledger's
 * sets are such lists, so the save stays plain JSON and a set's order never depends on when its members were found.
 */
export function addToSet<T extends string | number>(list: T[], value: T): boolean {
  let at = 0;
  while (at < list.length && (list[at] as T) < value) at++;
  if (list[at] === value) return false;
  list.splice(at, 0, value);
  return true;
}

/** Whether a list is strictly ascending: sorted with no duplicate, as `addToSet` keeps the ledger's sets. */
export function isSortedSet(list: readonly (string | number)[]): boolean {
  return list.every((v, i) => i === 0 || (list[i - 1] as string | number) < v);
}
