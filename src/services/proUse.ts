import type { ProFeature } from "../domain/proCatalog";
import { readDurable, writeDurable } from "./freeMonthClock";

/**
 * What a person used during their free month (founder, 2026-11-14): when the month
 * ends, the Pro page can say "Word Finder 14 · Layers 6" instead of listing tools they
 * never opened. The page reminds; it does not push.
 *
 * Counted on the phone and kept on the phone: nothing here is ever sent anywhere, and
 * it is not in the library, so it rides no backup, Send parcel or export.
 *
 * A "use" is a sitting, not a tap: one group counts at most once per `SITTING_MS`, so
 * stepping a capo five frets or nudging speed ten times is one use. Only the free
 * month counts (the caller checks): a Pro member is not being sold anything, and a
 * free person's allowance (one Send link, one try of a game) is not a Pro use.
 */

/** The groups the Pro page names, in its own words (`pro.used.<group>`). */
export type ProUseGroup = "wordFinder" | "lyricSpark" | "practice" | "stage" | "send" | "layers";

export const PRO_USE_GROUPS: readonly ProUseGroup[] = ["wordFinder", "lyricSpark", "practice", "stage", "send", "layers"];

/** Which group a gate belongs to; a gate with no group on the page is not counted. */
const GROUP_OF: Partial<Record<ProFeature, ProUseGroup>> = {
  "word-finder-full": "wordFinder",
  "lyric-spark": "lyricSpark",
  "practice-suite": "practice",
  "full-editor": "practice",
  "stage-tools": "stage",
  "pdf-export": "stage",
  send: "send",
  "overdub-layers": "layers",
};

export const SITTING_MS = 30 * 60 * 1000;

const KEY = "songnook.proUse";

type Counts = Record<ProUseGroup, number>;
const zero = (): Counts => ({ wordFinder: 0, lyricSpark: 0, practice: 0, stage: 0, send: 0, layers: 0 });

let counts: Counts = zero();
const lastAt: Partial<Record<ProUseGroup, number>> = {};
const listeners = new Set<() => void>();

function parse(raw: string | null): Counts | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<ProUseGroup, unknown>>;
    const out = zero();
    for (const group of PRO_USE_GROUPS) {
      const n = Number(value?.[group]);
      out[group] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    return out;
  } catch {
    return null;
  }
}

function changed(): void {
  counts = { ...counts };
  listeners.forEach((listener) => listener());
}

/** Once at launch. A use counted before this finished is kept (the higher count wins). */
export async function loadProUse(): Promise<void> {
  const stored = parse(await readDurable(KEY).catch(() => null));
  if (!stored) return;
  for (const group of PRO_USE_GROUPS) counts[group] = Math.max(counts[group], stored[group]);
  changed();
}

/** A Pro tool was used during the free month. No-op for a gate the page does not name. */
export function noteProUse(feature: ProFeature, now = Date.now()): void {
  const group = GROUP_OF[feature];
  if (!group) return;
  const last = lastAt[group];
  if (last != null && now - last < SITTING_MS && now >= last) return;
  lastAt[group] = now;
  counts[group] += 1;
  changed();
  void writeDurable(KEY, JSON.stringify(counts)).catch(() => {});
}

/** The groups that were used, most used first; ties keep the page's own order. */
export function proUseRanking(limit = 3): { group: ProUseGroup; count: number }[] {
  return PRO_USE_GROUPS.map((group) => ({ group, count: counts[group] }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** For `useSyncExternalStore`: the snapshot object changes only when a count does. */
export const proUse = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (): Counts => counts,
};

/** Dev only: put sample counts on the page so it can be seen without living a month. */
export function setDevProUse(sample: Partial<Counts>): void {
  if (!__DEV__) return;
  counts = { ...zero(), ...sample };
  changed();
}
