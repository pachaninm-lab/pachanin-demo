/**
 * Fail-closed grouping counters for evidence-producing builders.
 *
 * A plain object is not a safe accumulator. `acc[key] = (acc[key] ?? 0) + 1`
 * silently loses every record whose key is `__proto__` (the read returns the
 * prototype, `?? 0` never fires, and assigning a number is a no-op), and
 * corrupts every record whose key is `constructor` (the read returns the
 * `Object` function, so `+ 1` concatenates into a string).
 *
 * Artefacts built here are cited by legal instruments, so a silently
 * undercounted breakdown is worse than a failed build: it is wrong evidence
 * that looks correct. `tallyBy` accumulates in a `Map`, which has no
 * inherited keys, and then checks the total against the input length so a
 * future miscount cannot pass unnoticed.
 */

/**
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {(item: T) => string} keyOf
 * @param {string} label human-readable name of the breakdown, used in errors
 * @returns {Record<string, number>} counts per key, insertion-ordered
 */
export function tallyBy(items, keyOf, label) {
  const counts = new Map();
  for (const item of items) {
    const key = String(keyOf(item));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total !== items.length) {
    throw new Error(
      `${label}: breakdown lost records — counted ${total} of ${items.length}. Refusing to emit incomplete evidence.`,
    );
  }
  return Object.fromEntries(counts);
}
