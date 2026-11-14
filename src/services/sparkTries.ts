import { readDurable, writeDurable } from "./freeMonthClock";

/**
 * How many sparks were started in each word game WITHOUT Pro (founder, 2026-10-25:
 * "they should be allowed to try them for free but then no more, even if they've
 * deleted theirs"). A free user gets one try per game (proCatalog "lyric-spark";
 * founder, 2026-11-14: three in all, was three of each).
 *
 * Counted, never derived from the sparks on hand: deleting a spark gives no try back.
 * Kept where the free month is (the Keychain on iOS), so reinstalling or Erase
 * everything doesn't refill them, and never in the library snapshot, so a restored
 * backup can't either. Sparks started with Pro or during the free month don't count.
 *
 * One exception (founder, 2026-11-14): a spark left with nothing written gives its try
 * back. Opening a game and backing straight out used to cost a try for good. Only the
 * screens' own silent discard of an untouched spark refunds; a delete the person chose
 * never does. The open tries are held in memory, so a try whose spark outlives this
 * launch stays spent.
 */

export type SparkGame = "wordLadder" | "cutUp" | "magpie";

const KEY = "songnook.sparkTries";
const GAMES: SparkGame[] = ["wordLadder", "cutUp", "magpie"];

let tries: Record<SparkGame, number> = { wordLadder: 0, cutUp: 0, magpie: 0 };

function parse(raw: string | null): Record<SparkGame, number> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<SparkGame, unknown>>;
    const out = { wordLadder: 0, cutUp: 0, magpie: 0 };
    for (const game of GAMES) {
      const n = Number(value?.[game]);
      out[game] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    return out;
  } catch {
    return null;
  }
}

/** Once at launch. A try counted before this finished is kept (the higher count wins). */
export async function loadSparkTries(): Promise<void> {
  const stored = parse(await readDurable(KEY).catch(() => null));
  if (!stored) return;
  for (const game of GAMES) tries[game] = Math.max(tries[game], stored[game]);
}

export function sparkTriesUsed(game: SparkGame): number {
  return tries[game];
}

/** Sparks started on a free try in this launch, by spark id. */
const openTries = new Map<string, SparkGame>();

function store(): void {
  void writeDurable(KEY, JSON.stringify(tries)).catch(() => {});
}

/** A spark was started without Pro: one try of that game is used. Pass the spark's id so
 *  the try can come back if the spark is left untouched (`refundSparkTry`). */
export function spendSparkTry(game: SparkGame, sparkId?: string): void {
  tries = { ...tries, [game]: tries[game] + 1 };
  if (sparkId) openTries.set(sparkId, game);
  store();
}

/** The spark was discarded with nothing written: its try comes back. A spark that was not
 *  started on a free try in this launch (Pro, the free month, an older spark) is a no-op. */
export function refundSparkTry(sparkId: string): void {
  const game = openTries.get(sparkId);
  if (!game) return;
  openTries.delete(sparkId);
  tries = { ...tries, [game]: Math.max(0, tries[game] - 1) };
  store();
}
