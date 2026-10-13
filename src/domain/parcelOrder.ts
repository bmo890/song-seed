/**
 * Ordering a parcel before it is sealed — the phone's version of the desktop
 * sender page's drag-to-reorder and Sort A→Z. Pure list moves on item keys;
 * the sheet renders them, the creator applies them.
 */
export type ParcelItem = { key: string; title: string };

/** Moves the item at `from` to `to`, clamped; a no-op returns the same array. */
export function moveParcelItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (target === from) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** A→Z by title, case- and accent-insensitive, stable for equal titles. */
export function sortParcelItemsAz<T extends { title: string }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        a.item.title.localeCompare(b.item.title, undefined, { sensitivity: "base", numeric: true }) ||
        a.index - b.index
    )
    .map(({ item }) => item);
}

/** Applies a chosen key order to the real items. Keys the order does not
 *  name keep their place after the ordered ones; unknown keys are ignored, so
 *  a stale order can never drop an item. */
export function orderByKeys<T>(items: T[], keys: readonly string[] | undefined, keyOf: (item: T) => string): T[] {
  if (!keys || keys.length === 0) return items;
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const item = byKey.get(key);
    if (item && !seen.has(key)) {
      ordered.push(item);
      seen.add(key);
    }
  }
  for (const item of items) if (!seen.has(keyOf(item))) ordered.push(item);
  return ordered;
}
