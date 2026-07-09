import type { PersistedAppStore } from "../state/storeTypes";
import type { ClipVersion, SongIdea, Workspace } from "../types";

/**
 * Merge-restore ("keep newer items"): combine a restored backup snapshot with the CURRENT
 * library instead of replacing it.
 *
 * Semantics — chosen so a restore can bring back lost work without destroying anything
 * created since the backup:
 * - Union by ID at every level (workspace → collection / idea → clip, plus the top-level
 *   collections: notes, playlists, songbooks, setlists, word ladders, cut-up sparks,
 *   activity events).
 * - On an ID collision the CURRENT version wins — a collision means the same item exists
 *   in both (IDs are random at creation), and the current copy is the newer state. We
 *   still recurse into collided containers so backup-only children come back (e.g. a clip
 *   deleted after the backup returns into its still-existing song).
 * - Scalar settings (active workspace, metronome, filters, reminders…) keep their current
 *   values; keyed records keep current values per key and gain restored-only keys.
 *
 * Media invariant: restored-only items reference token-scoped restored files (already
 * rewritten by prepareDisasterRecoverySnapshot); current items keep their live files. In
 * merge mode NOTHING is displaced, so no current media is quarantined.
 *
 * Deliberately NOT re-IDing collided items: since IDs are random at creation, a collision
 * is the same item — re-IDing would duplicate the entire unchanged library.
 */
export function mergeRestoredLibrary(
    restored: PersistedAppStore,
    current: PersistedAppStore
): PersistedAppStore {
    return {
        ...restored,
        // Scalars + keyed records: current (newer) wins; restored-only keys survive.
        ...current,
        primaryCollectionIdByWorkspace: {
            ...restored.primaryCollectionIdByWorkspace,
            ...current.primaryCollectionIdByWorkspace,
        },
        workspaceLastOpenedAt: {
            ...restored.workspaceLastOpenedAt,
            ...current.workspaceLastOpenedAt,
        },
        collectionLastOpenedAt: {
            ...restored.collectionLastOpenedAt,
            ...current.collectionLastOpenedAt,
        },
        workspaces: mergeWorkspaces(current.workspaces ?? [], restored.workspaces ?? []),
        activityEvents: unionById(current.activityEvents, restored.activityEvents),
        playlists: unionById(current.playlists, restored.playlists),
        songbooks: unionById(current.songbooks, restored.songbooks),
        setlists: unionById(current.setlists, restored.setlists),
        notes: unionById(current.notes, restored.notes),
        wordLadders: unionById(current.wordLadders, restored.wordLadders),
        cutUpSparks: unionById(current.cutUpSparks, restored.cutUpSparks),
    };
}

/**
 * Current entries in their order, then restored-only entries appended. Tolerates missing
 * arrays: older backups predate some collections, and validation only guarantees workspaces.
 */
function unionById<T extends { id: string }>(
    currentValue: T[] | undefined,
    restoredValue: T[] | undefined
): T[] {
    const current = currentValue ?? [];
    const restored = restoredValue ?? [];
    const currentIds = new Set(current.map((item) => item.id));
    const restoredOnly = restored.filter((item) => !currentIds.has(item.id));
    return restoredOnly.length === 0 ? current : [...current, ...restoredOnly];
}

function mergeWorkspaces(current: Workspace[], restored: Workspace[]): Workspace[] {
    const restoredById = new Map(restored.map((workspace) => [workspace.id, workspace]));
    const merged = current.map((workspace) => {
        const restoredWorkspace = restoredById.get(workspace.id);
        if (!restoredWorkspace) return workspace;
        const collections = unionById(workspace.collections, restoredWorkspace.collections);
        const ideas = mergeIdeas(workspace.ideas, restoredWorkspace.ideas);
        if (
            collections === workspace.collections &&
            ideas === workspace.ideas
        ) {
            return workspace;
        }
        // Current wins the workspace's own fields; only container children merge.
        return { ...workspace, collections, ideas };
    });
    const currentIds = new Set(current.map((workspace) => workspace.id));
    const restoredOnly = restored.filter((workspace) => !currentIds.has(workspace.id));
    return restoredOnly.length === 0 ? merged : [...merged, ...restoredOnly];
}

function mergeIdeas(current: SongIdea[], restored: SongIdea[]): SongIdea[] {
    const restoredById = new Map(restored.map((idea) => [idea.id, idea]));
    let changed = false;
    const merged = current.map((idea) => {
        const restoredIdea = restoredById.get(idea.id);
        if (!restoredIdea) return idea;
        const clips = mergeClips(idea.clips, restoredIdea.clips);
        if (clips === idea.clips) return idea;
        changed = true;
        return { ...idea, clips };
    });
    const currentIds = new Set(current.map((idea) => idea.id));
    const restoredOnly = restored.filter((idea) => !currentIds.has(idea.id));
    if (restoredOnly.length === 0) return changed ? merged : current;
    return [...merged, ...restoredOnly];
}

function mergeClips(current: ClipVersion[], restored: ClipVersion[]): ClipVersion[] {
    const currentIds = new Set(current.map((clip) => clip.id));
    const restoredOnly = restored.filter((clip) => !currentIds.has(clip.id));
    if (restoredOnly.length === 0) return current;
    // A song can only have one primary take: the current library's choice stands, so
    // returning backup-only clips must not bring a competing primary flag with them.
    const currentHasPrimary = current.some((clip) => clip.isPrimary);
    const appended = currentHasPrimary
        ? restoredOnly.map((clip) => (clip.isPrimary ? { ...clip, isPrimary: false } : clip))
        : restoredOnly;
    return [...current, ...appended];
}
