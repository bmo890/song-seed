/**
 * Unsaved words, kept until the person saves or discards them (data-safety audit
 * 2026-11-02, root cause 4: "editors keep a private copy").
 *
 * An editor that holds typing in React state loses all of it when iOS evicts the
 * app or an update reloads it (04-H3: a whole lyric-writing session). Each editor
 * mirrors its unsaved fields here, keyed by the ITEM it opened on, and offers them
 * back the next time that item's editor opens. A save or an explicit discard
 * clears the entry. Small by design: a handful of strings per item, swept after
 * thirty days, capped in count.
 */

export type EditorDraftKind = "lyrics" | "ideaNotes" | "clipText";

export type EditorDraft = {
  key: string;
  /** The editor's unsaved fields, by name ("text", "notes", "title", …). */
  fields: Record<string, string>;
  /** What the item held when this editing began, in the editor's own terms (for
   *  lyrics: the version id and its updatedAt). A restore uses it to know whether
   *  the item moved on underneath the draft. */
  base?: string;
  /** The workspace that owned the item when the draft was written. */
  workspaceId?: string | null;
  savedAt: number;
};

export const EDITOR_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const EDITOR_DRAFT_LIMIT = 40;

export function editorDraftKey(kind: EditorDraftKind, itemId: string, partId?: string | null): string {
  return partId ? `${kind}:${itemId}:${partId}` : `${kind}:${itemId}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string");
}

/** Keeps the newest `limit` drafts younger than the TTL. */
export function pruneEditorDrafts(
  drafts: Record<string, EditorDraft>,
  now: number,
  limit = EDITOR_DRAFT_LIMIT
): Record<string, EditorDraft> {
  const kept = Object.values(drafts)
    .filter((draft) => now - draft.savedAt <= EDITOR_DRAFT_TTL_MS)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, limit);
  if (kept.length === Object.keys(drafts).length) return drafts;
  return Object.fromEntries(kept.map((draft) => [draft.key, draft]));
}

/** Whatever came off the disk, as drafts (anything malformed is dropped). */
export function sanitizeEditorDrafts(value: unknown, now: number): Record<string, EditorDraft> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const drafts: Record<string, EditorDraft> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<EditorDraft>;
    if (!isStringRecord(candidate.fields)) continue;
    if (!Number.isFinite(candidate.savedAt)) continue;
    drafts[key] = {
      key,
      fields: { ...candidate.fields },
      base: typeof candidate.base === "string" ? candidate.base : undefined,
      workspaceId: typeof candidate.workspaceId === "string" ? candidate.workspaceId : null,
      savedAt: candidate.savedAt as number,
    };
  }
  return pruneEditorDrafts(drafts, now);
}

/** True when the draft holds something the editor isn't already showing. */
export function draftDiffers(draft: EditorDraft | null | undefined, current: Record<string, string>): boolean {
  if (!draft) return false;
  return Object.entries(draft.fields).some(([name, value]) => (current[name] ?? "") !== value);
}

/**
 * Only the fields the person changed since the editor opened. An editor saves this
 * patch onto the item as it is NOW, so a field changed elsewhere meanwhile (a note
 * written in the player while the list's Edit sheet held an older copy, 12c C-H1)
 * survives an edit that never touched it.
 */
export function changedFields<T extends Record<string, string>>(opened: T, draft: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const name of Object.keys(draft) as Array<keyof T>) {
    if (draft[name] !== opened[name]) patch[name] = draft[name];
  }
  return patch;
}
