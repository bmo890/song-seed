/**
 * The note an install leaves where an uninstall can't reach (founder, 2026-11-25:
 * "someone who reinstalls must not think they lost everything"). It never holds the
 * library, only what a fresh install needs to say "welcome back":
 *
 *  - the last backup that finished (when, a file or the backup folder, its name);
 *  - that this person had Pro: founding (kept for good) or bought (restored from the
 *    store account on their tap).
 *
 * Where it lives (services/returnNote.ts): on iPhone the Keychain, which outlives
 * deleting the app; on Android a small file that Android's own Google backup carries
 * back when the app is reinstalled from Play (plugins/withSongNookBackupRules.js).
 * It is never inside a SongNook backup, so restoring someone's backup can't carry it.
 */
export type ReturnNoteBackup = {
    at: number;
    kind: "file" | "folder";
    /** The file's or folder's name, as the person saw it. */
    where: string | null;
    /** Ideas in the library when it was backed up. */
    ideaCount: number;
};

export type ReturnNote = {
    v: 1;
    backup: ReturnNoteBackup | null;
    founding: boolean;
    /** A bought Pro was seen on this install (the store account holds the purchase). */
    pro: boolean;
};

export const EMPTY_RETURN_NOTE: ReturnNote = { v: 1, backup: null, founding: false, pro: false };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

export function parseReturnNote(raw: string | null | undefined): ReturnNote | null {
    if (!raw) return null;
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!value || typeof value !== "object") return null;
    const note = value as Record<string, unknown>;
    if (note.v !== 1) return null;
    const backup = note.backup as Record<string, unknown> | null | undefined;
    return {
        v: 1,
        backup:
            backup && finite(backup.at) && (backup.kind === "file" || backup.kind === "folder")
                ? {
                      at: backup.at,
                      kind: backup.kind,
                      where: typeof backup.where === "string" && backup.where ? backup.where : null,
                      ideaCount: typeof backup.ideaCount === "number" && backup.ideaCount >= 0 ? Math.floor(backup.ideaCount) : 0,
                  }
                : null,
        founding: note.founding === true,
        pro: note.pro === true,
    };
}

/**
 * The note after something happened. Founding and Pro only ever turn on; a backup
 * replaces an older one, never a newer one (a slow run finishing late).
 */
export function mergeReturnNote(
    previous: ReturnNote | null,
    change: { backup?: ReturnNoteBackup; founding?: true; pro?: true }
): ReturnNote {
    const base = previous ?? EMPTY_RETURN_NOTE;
    const backup =
        change.backup && (!base.backup || change.backup.at >= base.backup.at) ? change.backup : base.backup;
    return {
        v: 1,
        backup,
        founding: base.founding || change.founding === true,
        pro: base.pro || change.pro === true,
    };
}

/**
 * Whether a fresh install greets a returning person: the intro has not been seen, the
 * library is empty, and a backup is known. Without a backup there is nothing to offer,
 * and the plain intro (with its own "Restore backup") is the honest start.
 */
export function shouldWelcomeBack(
    note: ReturnNote | null,
    state: { hasSeenWelcome: boolean; ideaCount: number }
): note is ReturnNote & { backup: ReturnNoteBackup } {
    return !!note?.backup && !state.hasSeenWelcome && state.ideaCount === 0;
}

/**
 * A library with nothing a person made or kept: at most the starter workspace, empty,
 * and no notes, lists or sparks. A restore onto it replaces it, so a returning person
 * does not land on an empty "My Songs" beside their restored one (2026-11-25, seen on
 * the simulator). Anything at all of theirs, a received parcel included, makes it not
 * blank, and the restore asks Merge or Replace as before.
 */
export function isBlankLibrary(library: {
    workspaces?: { origin?: string; ideas: unknown[]; collections: unknown[] }[];
    notes?: unknown[];
    playlists?: unknown[];
    songbooks?: unknown[];
    setlists?: unknown[];
    wordLadders?: unknown[];
    cutUpSparks?: unknown[];
    magpieSparks?: unknown[];
}): boolean {
    const workspaces = library.workspaces ?? [];
    if (workspaces.length > 1) return false;
    if (workspaces.some((ws) => (ws.origin ?? "personal") !== "personal" || ws.ideas.length > 0 || ws.collections.length > 1)) {
        return false;
    }
    const lists = [
        library.notes,
        library.playlists,
        library.songbooks,
        library.setlists,
        library.wordLadders,
        library.cutUpSparks,
        library.magpieSparks,
    ];
    return lists.every((list) => (list?.length ?? 0) === 0);
}
