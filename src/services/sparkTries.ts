import { readDurable, writeDurable } from "./freeMonthClock";

/**
 * How many sparks were started in each word game WITHOUT Pro (founder, 2026-10-25:
 * "they should be allowed to try them for free but then no more, even if they've
 * deleted theirs"). A free user gets three tries per game (proCatalog "lyric-spark").
 *
 * Counted, never derived from the sparks on hand: deleting a spark gives no try back.
 * Kept where the free month is (the Keychain on iOS), so reinstalling or Erase
 * everything doesn't refill them, and never in the library snapshot, so a restored
 * backup can't either. Sparks started with Pro or during the free month don't count.
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

/** A spark was started without Pro: one try of that game is used, for good. */
export function spendSparkTry(game: SparkGame): void {
  tries = { ...tries, [game]: tries[game] + 1 };
  void writeDurable(KEY, JSON.stringify(tries)).catch(() => {});
}
