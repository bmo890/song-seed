/**
 * Leaving a spark (12f F-H3). Every spark autosaves as you type, so Back on a
 * spark you came back to has nothing to discard: it just leaves. Only a spark
 * started on this visit asks "Save as unfinished?", and its Discard sends the
 * spark to Recently deleted, never straight to nothing.
 */

/** A spark made just before its page opened (New spark → page) counts as this visit's. */
export const SPARK_FRESH_MARGIN_MS = 15_000;

export function sparkStartedThisVisit(createdAt: number | undefined, pageOpenedAt: number): boolean {
    return typeof createdAt === "number" && createdAt >= pageOpenedAt - SPARK_FRESH_MARGIN_MS;
}
