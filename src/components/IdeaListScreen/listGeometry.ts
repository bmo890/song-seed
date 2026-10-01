import type { IdeaListEntry } from "./types";

/**
 * Exact row geometry for the collection list, so the FlatList can be handed
 * `getItemLayout` (2026-09-30).
 *
 * Without `getItemLayout`, VirtualizedList sizes its content only up to the
 * highest row it has measured ("to prevent hyperscrolling into un-measured
 * area"), so nothing — the native scrollbar, `scrollToIndex`, a fast-scroll
 * scrubber — can reach past what has already been rendered. With it, the
 * content is full-length from the first frame and every jump lands exactly.
 *
 * Rows come in a handful of kinds whose heights are constant on a device
 * (single-line titles, fixed waveform and meta rows): an idea card at either
 * density, with or without a day divider above it, and a collapsed-day marker.
 * Each mounted row reports its measured height for its kind; a row that
 * measures differently from its kind keeps its own height. Until a kind has
 * been measured an estimate stands in, which only the first frame ever sees.
 *
 * Offsets are in the list content's frame: top padding, then the header cell,
 * then the rows, each followed by the container's `gap`. A spacer that stands
 * in for N rows then runs one gap long; that is at most two gaps of drift and
 * only while scrolled away from the top.
 */

export type ListDensity = "comfortable" | "compact";

export function rowKindOf(entry: IdeaListEntry, density: ListDensity): string {
  if (entry.type === "collapsedDay") return rowKind("collapsedDay", density, false);
  return rowKind("idea", density, !!entry.dayDividerLabel);
}

export function rowKind(type: "idea" | "collapsedDay", density: ListDensity, withDivider: boolean): string {
  return `${type}|${density}|${withDivider ? 1 : 0}`;
}

// First-frame stand-ins, per kind; replaced by the first measurement.
const DEFAULT_ESTIMATES: Record<string, number> = {
  "idea|comfortable|0": 110,
  "idea|comfortable|1": 150,
  "idea|compact|0": 64,
  "idea|compact|1": 100,
  "collapsedDay|comfortable|0": 64,
  "collapsedDay|compact|0": 56,
};

export type ListGeometryConfig = {
  entries: IdeaListEntry[];
  density: ListDensity;
  /** The content container's top padding (the collapsing header's height). */
  paddingTop: number;
  /** Measured height of the header cell (nested collections), 0 when empty. */
  headerLength: number;
  /** The content container's `gap`. */
  gap: number;
};

export type ListGeometry = {
  configure: (config: ListGeometryConfig) => void;
  /** A row reported its measured height. Returns true when it changed what
   *  other rows are placed at — the list should be re-rendered. */
  report: (entryKey: string, kind: string, height: number) => boolean;
  setHeaderLength: (length: number) => boolean;
  getItemLayout: (index: number) => { length: number; offset: number; index: number };
  /** Content offset of a row's top edge. */
  offsetOf: (index: number) => number;
  /** Every row's top edge, in order (the scrubber's readout searches it). */
  offsets: () => number[];
  /** Total content length, footer excluded. */
  contentLength: () => number;
};

export function createListGeometry(estimates: Record<string, number> = DEFAULT_ESTIMATES): ListGeometry {
  const byKind = new Map<string, number>();
  const byKey = new Map<string, number>();
  let config: ListGeometryConfig = { entries: [], density: "comfortable", paddingTop: 0, headerLength: 0, gap: 0 };
  let offsets: number[] | null = null;

  const heightOf = (index: number): number => {
    const entry = config.entries[index];
    if (!entry) return 0;
    const own = byKey.get(entry.key);
    if (own !== undefined) return own;
    const kind = rowKindOf(entry, config.density);
    return byKind.get(kind) ?? estimates[kind] ?? 100;
  };
  const lengthOf = (index: number) => heightOf(index) + config.gap;

  const ensureOffsets = () => {
    if (offsets) return offsets;
    const out = new Array<number>(config.entries.length);
    // The header is always a cell (even when it renders nothing), so its gap
    // always precedes the first row.
    let cursor = config.paddingTop + config.headerLength + config.gap;
    for (let index = 0; index < config.entries.length; index += 1) {
      out[index] = cursor;
      cursor += lengthOf(index);
    }
    offsets = out;
    return out;
  };

  return {
    configure: (next) => {
      config = next;
      offsets = null;
    },
    report: (entryKey, kind, height) => {
      const rounded = Math.round(height);
      if (rounded <= 0) return false;
      const known = byKind.get(kind);
      let changed = false;
      if (known === undefined) {
        byKind.set(kind, rounded);
        changed = true;
      } else if (known !== rounded) {
        // A row that differs from its kind keeps its own height; the kind's
        // value stays with the first measurement.
        if (byKey.get(entryKey) !== rounded) {
          byKey.set(entryKey, rounded);
          changed = true;
        }
      } else if (byKey.has(entryKey)) {
        byKey.delete(entryKey);
        changed = true;
      }
      if (changed) offsets = null;
      return changed;
    },
    setHeaderLength: (length) => {
      const rounded = Math.round(length);
      if (rounded === config.headerLength) return false;
      config = { ...config, headerLength: rounded };
      offsets = null;
      return true;
    },
    getItemLayout: (index) => ({ length: lengthOf(index), offset: ensureOffsets()[index] ?? 0, index }),
    offsetOf: (index) => ensureOffsets()[index] ?? 0,
    offsets: () => ensureOffsets(),
    contentLength: () => {
      const all = ensureOffsets();
      const last = all.length - 1;
      return last < 0 ? config.paddingTop + config.headerLength + config.gap : all[last]! + lengthOf(last);
    },
  };
}
