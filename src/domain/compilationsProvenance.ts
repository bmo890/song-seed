import type { ReceivedMeta } from "../types";

/**
 * Provenance for compilations (setlists, songbooks). A compilation that came
 * from someone else carries the same `received` block a received package
 * does; Compilations tags those "from <sender>" and can fold them away.
 */
type WithProvenance = { received?: ReceivedMeta };

export function isFromOthers(item: WithProvenance): boolean {
  return item.received != null;
}

export function hasFromOthers(items: readonly WithProvenance[]): boolean {
  return items.some(isFromOthers);
}
