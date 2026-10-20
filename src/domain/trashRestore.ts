/**
 * The trash safety net (overnight check, 2026-10-20). Deleted audio waits 14 days in
 * the trash, but nothing ever brought it back: a file trashed by mistake while the
 * library still pointed at it was silently lost on day 14. On every launch the library's
 * references are checked; any file that is missing from its place but sits in the trash
 * moves back.
 *
 * Trash names are `<trashedAtMs>-<random>-<original filename>` (managedMedia
 * trashFileIfManaged), so a trashed file is matched to its reference by filename. Pure:
 * the caller lists the trash and checks which references exist.
 */

export type TrashRestore = { trashName: string; to: string };

const TRASH_NAME = /^(\d{10,})-[a-z0-9]+-(.+)$/i;

/** The original filename and trash time of a trash entry, or null for a name we didn't write. */
export function parseTrashName(trashName: string): { trashedAt: number; filename: string } | null {
  const match = TRASH_NAME.exec(trashName);
  if (!match) return null;
  return { trashedAt: Number(match[1]), filename: match[2] };
}

function filenameOf(uri: string): string {
  return uri.split("?")[0].split("/").pop() ?? "";
}

/**
 * Which trash entries to move back, and where. `missing` are the library's references
 * whose file is not at its place. When the trash holds several copies of one filename,
 * the most recently trashed wins (it is the newest version of that file). A trash entry
 * is used at most once.
 */
export function planTrashRestores(missing: Iterable<string>, trashNames: Iterable<string>): TrashRestore[] {
  const newestByFilename = new Map<string, { trashName: string; trashedAt: number }>();
  for (const trashName of trashNames) {
    const parsed = parseTrashName(trashName);
    if (!parsed) continue;
    const current = newestByFilename.get(parsed.filename);
    if (!current || parsed.trashedAt > current.trashedAt) {
      newestByFilename.set(parsed.filename, { trashName, trashedAt: parsed.trashedAt });
    }
  }

  const plan: TrashRestore[] = [];
  const used = new Set<string>();
  for (const uri of new Set(missing)) {
    const entry = newestByFilename.get(filenameOf(uri));
    if (!entry || used.has(entry.trashName)) continue;
    used.add(entry.trashName);
    plan.push({ trashName: entry.trashName, to: uri });
  }
  return plan;
}
