import type { PersistedAppStore } from "../state/storeTypes";
import type { ClipOverdubStem, ClipVersion, LyricsVersion, SongIdea, Workspace } from "../types";

/**
 * Merge-restore ("keep newer items"): combine a restored backup snapshot with the CURRENT
 * library instead of replacing it.
 *
 * Semantics — chosen so a restore can bring back lost work without destroying anything
 * created since the backup:
 * - Union by ID at every level (workspace → collection / idea → clip, plus the top-level
 *   collections: notes, playlists, songbooks, setlists, word ladders, cut-up sparks,
 *   magpie sparks, activity events).
 * - On an ID collision the CURRENT version wins — a collision means the same item exists
 *   in both (IDs are random at creation), and the current copy is the newer state. We
 *   still recurse into collided containers so backup-only children come back (e.g. a clip
 *   deleted after the backup returns into its still-existing song). That reaches inside
 *   a take too (founder, 2026-10-20): a layer deleted since the backup comes back to its
 *   take MUTED, so the take's rendered mix (which leaves muted layers out) stays true
 *   until the person unmutes it; a lyric version deleted since comes back in date order,
 *   never as the latest page.
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
        workspaces: mergeWorkspaces(current.workspaces ?? [], restored.workspaces ?? [], indexIds(current.workspaces ?? [])),
        activityEvents: unionById(current.activityEvents, restored.activityEvents),
        playlists: unionById(current.playlists, restored.playlists),
        songbooks: unionById(current.songbooks, restored.songbooks),
        setlists: unionById(current.setlists, restored.setlists),
        notes: unionById(current.notes, restored.notes),
        wordLadders: unionById(current.wordLadders, restored.wordLadders),
        cutUpSparks: unionById(current.cutUpSparks, restored.cutUpSparks),
        magpieSparks: unionById(current.magpieSparks, restored.magpieSparks),
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

/**
 * Every collection, idea and clip id anywhere in the current library. An item moved
 * since the backup (an idea to another workspace, a take to another sketch) is
 * "restored-only" in its old place; it must not come back there as a second copy with
 * the same id (overnight check 2026-10-20).
 */
type LibraryIds = {
    collections: Set<string>;
    ideas: Set<string>;
    clips: Set<string>;
    stems: Set<string>;
    lyricVersions: Set<string>;
};

function indexIds(workspaces: Workspace[]): LibraryIds {
    const ids: LibraryIds = {
        collections: new Set(),
        ideas: new Set(),
        clips: new Set(),
        stems: new Set(),
        lyricVersions: new Set(),
    };
    for (const workspace of workspaces) {
        for (const collection of workspace.collections) ids.collections.add(collection.id);
        for (const idea of workspace.ideas) {
            ids.ideas.add(idea.id);
            for (const version of idea.lyrics?.versions ?? []) ids.lyricVersions.add(version.id);
            for (const clip of idea.clips) {
                ids.clips.add(clip.id);
                for (const stem of clip.overdub?.stems ?? []) ids.stems.add(stem.id);
            }
        }
    }
    return ids;
}

/** A restored-only idea, minus takes that now live elsewhere; null when nothing of it is left. */
function restorableIdea(idea: SongIdea, taken: LibraryIds): SongIdea | null {
    if (taken.ideas.has(idea.id)) return null;
    const clips = idea.clips.filter((clip) => !taken.clips.has(clip.id));
    if (clips.length === idea.clips.length) return idea;
    // Every take moved on (into another sketch): the idea went with them.
    if (clips.length === 0) return null;
    // The primary take may have been one that moved: the first one left leads.
    const hasPrimary = clips.some((clip) => clip.isPrimary);
    return {
        ...idea,
        clips: hasPrimary ? clips : clips.map((clip, index) => (index === 0 ? { ...clip, isPrimary: true } : clip)),
    };
}

function restorableWorkspace(workspace: Workspace, taken: LibraryIds): Workspace {
    return {
        ...workspace,
        collections: workspace.collections.filter((collection) => !taken.collections.has(collection.id)),
        ideas: workspace.ideas.flatMap((idea) => restorableIdea(idea, taken) ?? []),
    };
}

function mergeWorkspaces(current: Workspace[], restored: Workspace[], taken: LibraryIds): Workspace[] {
    const restoredById = new Map(restored.map((workspace) => [workspace.id, workspace]));
    const merged = current.map((workspace) => {
        const restoredWorkspace = restoredById.get(workspace.id);
        if (!restoredWorkspace) return workspace;
        const collections = unionById(
            workspace.collections,
            restoredWorkspace.collections.filter(
                (collection) => !taken.collections.has(collection.id)
            )
        );
        const ideas = mergeIdeas(workspace.ideas, restoredWorkspace.ideas, taken);
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
    const restoredOnly = restored
        .filter((workspace) => !currentIds.has(workspace.id))
        .map((workspace) => restorableWorkspace(workspace, taken));
    return restoredOnly.length === 0 ? merged : [...merged, ...restoredOnly];
}

function mergeIdeas(current: SongIdea[], restored: SongIdea[], taken: LibraryIds): SongIdea[] {
    const restoredById = new Map(restored.map((idea) => [idea.id, idea]));
    let changed = false;
    const merged = current.map((idea) => {
        const restoredIdea = restoredById.get(idea.id);
        if (!restoredIdea) return idea;
        const clips = mergeClips(idea.clips, restoredIdea.clips, taken);
        const lyrics = mergeLyrics(idea, restoredIdea, taken);
        if (clips === idea.clips && lyrics === idea.lyrics) return idea;
        changed = true;
        return { ...idea, clips, lyrics };
    });
    const restoredOnly = restored.flatMap((idea) => restorableIdea(idea, taken) ?? []);
    if (restoredOnly.length === 0) return changed ? merged : current;
    return [...merged, ...restoredOnly];
}

function mergeClips(currentValue: ClipVersion[], restored: ClipVersion[], taken: LibraryIds): ClipVersion[] {
    const restoredById = new Map(restored.map((clip) => [clip.id, clip]));
    let layersChanged = false;
    const withLayers = currentValue.map((clip) => {
        const restoredClip = restoredById.get(clip.id);
        if (!restoredClip) return clip;
        const merged = mergeLayers(clip, restoredClip, taken);
        if (merged !== clip) layersChanged = true;
        return merged;
    });
    const current = layersChanged ? withLayers : currentValue;
    const restoredOnly = restored.filter((clip) => !taken.clips.has(clip.id));
    if (restoredOnly.length === 0) return current;
    // A song can only have one primary take: the current library's choice stands, so
    // returning backup-only clips must not bring a competing primary flag with them.
    const currentHasPrimary = current.some((clip) => clip.isPrimary);
    const appended = currentHasPrimary
        ? restoredOnly.map((clip) => (clip.isPrimary ? { ...clip, isPrimary: false } : clip))
        : restoredOnly;
    return [...current, ...appended];
}

/** Layers deleted from a take since the backup, returned muted (see the header). */
function mergeLayers(clip: ClipVersion, restoredClip: ClipVersion, taken: LibraryIds): ClipVersion {
    const restoredOnly = (restoredClip.overdub?.stems ?? []).filter(
        (stem) => !taken.stems.has(stem.id) && !!stem.audioUri
    );
    if (restoredOnly.length === 0) return clip;
    const returned: ClipOverdubStem[] = restoredOnly.map((stem) => ({ ...stem, isMuted: true }));
    return {
        ...clip,
        overdub: {
            ...clip.overdub,
            stems: [...(clip.overdub?.stems ?? []), ...returned],
        },
    };
}

/** Lyric versions deleted since the backup, back in date order behind the current
 *  latest page (the last version is the one every reader opens). */
function mergeLyrics(idea: SongIdea, restoredIdea: SongIdea, taken: LibraryIds): SongIdea["lyrics"] {
    const restoredOnly = (restoredIdea.lyrics?.versions ?? []).filter(
        (version) => !taken.lyricVersions.has(version.id)
    );
    if (restoredOnly.length === 0) return idea.lyrics;
    const current = idea.lyrics?.versions ?? [];
    if (current.length === 0) return { ...idea.lyrics, versions: restoredOnly };
    // Current versions keep their order; each returned one slots in before the first
    // earlier version made after it (ties stay behind), never past the latest.
    const latest = current[current.length - 1]!;
    const versions: LyricsVersion[] = current.slice(0, -1);
    for (const version of [...restoredOnly].sort((x, y) => x.createdAt - y.createdAt)) {
        const at = versions.findIndex((existing) => existing.createdAt > version.createdAt);
        versions.splice(at < 0 ? versions.length : at, 0, version);
    }
    return { ...idea.lyrics, versions: [...versions, latest] };
}
