/**
 * A failed receive rolls back what THAT attempt created, and nothing else. The old
 * cleanup deleted every workspace, setlist, chart book and playlist carrying the
 * parcel's transferId, so re-opening a link after Keep (which removes the package
 * but leaves the kept setlist) and failing the second save deleted the setlist the
 * person kept, reordered and annotated (data-safety audit 04-M4).
 */

type FromParcel = { id: string; received?: { transferId?: string | null } | null };

/** The ids carrying this transfer before the attempt began: snapshot, then pass to
 *  `createdByAttempt` on failure. */
export function idsFromTransfer(items: readonly FromParcel[], transferId: string): Set<string> {
  return new Set(items.filter((item) => item.received?.transferId === transferId).map((item) => item.id));
}

/** The ids this attempt created: carrying the transfer now, absent from the snapshot. */
export function createdByAttempt(
  items: readonly FromParcel[],
  transferId: string,
  before: ReadonlySet<string>
): string[] {
  return items
    .filter((item) => item.received?.transferId === transferId && !before.has(item.id))
    .map((item) => item.id);
}
