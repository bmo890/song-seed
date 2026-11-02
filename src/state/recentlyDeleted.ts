import type {
    ActivityEvent,
    ClipVersion,
    Collection,
    CutUpSpark,
    DeletedItem,
    DeletedItemKind,
    DeletedListEntry,
    DeletedSpark,
    MagpieSpark,
    Note,
    Playlist,
    PlaylistItem,
    Setlist,
    SetlistEntry,
    SongIdea,
    Songbook,
    SongbookItem,
    WordLadderExercise,
    Workspace,
} from "../types";
import { firstWritableWorkspaceId, isReadOnlyWorkspace } from "../domain/workspaceVisibility";
import { genId } from "../utils";

/**
 * Recently deleted (founder decision A, 2026-11-02): one place that keeps every
 * deleted thing whole for 30 days, audio included, with Restore, Delete
 * permanently and Empty. Pure state logic lives here: what a delete keeps (the
 * record with its ids, and what pointed at it) and how Restore puts it back.
 * The store wiring and the files are in `recentlyDeletedActions.ts`.
 */

export const RECENTLY_DELETED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENTLY_DELETED_MS = RECENTLY_DELETED_DAYS * DAY_MS;

const KINDS: ReadonlySet<DeletedItemKind> = new Set([
    "idea",
    "takes",
    "collection",
    "workspace",
    "setlist",
    "songbook",
    "playlist",
    "note",
    "spark",
]);

/** Whole days left before a record is purged (0 on its last day's end, never above 30). */
export function deletedItemDaysLeft(item: Pick<DeletedItem, "deletedAt">, now: number = Date.now()): number {
    const left = Math.ceil((item.deletedAt + RECENTLY_DELETED_MS - now) / DAY_MS);
    return Math.max(0, Math.min(RECENTLY_DELETED_DAYS, left));
}

export function isDeletedItemExpired(item: Pick<DeletedItem, "deletedAt">, now: number = Date.now()): boolean {
    return now - item.deletedAt >= RECENTLY_DELETED_MS;
}

export function buildDeletedItemId() {
    return genId("deleted");
}

/** The shape every capture and restore reads: the library plus what points into it. */
export type RecentlyDeletedState = {
    workspaces: Workspace[];
    activityEvents: ActivityEvent[];
    playlists: Playlist[];
    songbooks: Songbook[];
    setlists: Setlist[];
    notes: Note[];
    wordLadders: WordLadderExercise[];
    cutUpSparks: CutUpSpark[];
    magpieSparks: MagpieSpark[];
    primaryWorkspaceId: string | null;
    primaryCollectionIdByWorkspace: Record<string, string | null>;
    recentlyDeleted: DeletedItem[];
};

type CaptureState = Pick<
    RecentlyDeletedState,
    "workspaces" | "activityEvents" | "playlists" | "songbooks" | "setlists" | "primaryCollectionIdByWorkspace"
>;

function listEntries<T extends { id: string }>(
    lists: Array<{ id: string } & Record<string, unknown>>,
    key: "items" | "entries",
    keep: (entry: T) => boolean
): DeletedListEntry<T>[] {
    const out: DeletedListEntry<T>[] = [];
    for (const list of lists) {
        const entries = (list[key] as T[] | undefined) ?? [];
        entries.forEach((entry, index) => {
            if (keep(entry)) out.push({ listId: list.id, index, entry });
        });
    }
    return out;
}

/** Leave out empty side lists so a record stays small. */
function compact(item: DeletedItem): DeletedItem {
    const next: Record<string, unknown> = { ...item };
    for (const [key, value] of Object.entries(next)) {
        if (value === undefined || (Array.isArray(value) && value.length === 0 && key !== "clips" && key !== "ideas")) {
            delete next[key];
        }
    }
    return next as DeletedItem;
}

function sideRecordsFor(
    state: CaptureState,
    ideaIds: Set<string>,
    extra: { events?: (event: ActivityEvent) => boolean; playlistItems?: (item: PlaylistItem) => boolean } = {}
) {
    return {
        activityEvents: state.activityEvents.filter((event) => ideaIds.has(event.ideaId) || !!extra.events?.(event)),
        playlistItems: listEntries<PlaylistItem>(
            state.playlists as never,
            "items",
            (item) => ideaIds.has(item.ideaId) || !!extra.playlistItems?.(item)
        ),
        songbookItems: listEntries<SongbookItem>(state.songbooks as never, "items", (item) => ideaIds.has(item.ideaId)),
        setlistEntries: listEntries<SetlistEntry>(state.setlists as never, "entries", (entry) => ideaIds.has(entry.ideaId)),
    };
}

/** One record per deleted idea (clip or sketch, every take inside it). An empty draft
 *  never saved is nothing to keep. */
export function captureDeletedIdeas(
    state: CaptureState,
    workspaceId: string,
    ideas: SongIdea[],
    now: number = Date.now()
): DeletedItem[] {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    return ideas
        .filter((idea) => !(idea.isDraft && idea.clips.length === 0))
        .map((idea) => {
            const collection = workspace?.collections.find((candidate) => candidate.id === idea.collectionId);
            const hidden = !!collection?.ideasListState?.hiddenIdeaIds?.includes(idea.id);
            return compact({
                id: buildDeletedItemId(),
                kind: "idea",
                title: idea.title,
                deletedAt: now,
                workspaceId,
                collectionId: idea.collectionId,
                ideas: [idea],
                hiddenIdeaIds: hidden ? [idea.id] : undefined,
                ...sideRecordsFor(state, new Set([idea.id])),
            });
        });
}

/** Takes deleted from inside a sketch (or the clip's older versions). */
export function captureDeletedTakes(
    state: CaptureState,
    workspaceId: string,
    idea: SongIdea,
    clips: ClipVersion[],
    now: number = Date.now()
): DeletedItem | null {
    if (clips.length === 0) return null;
    const clipIds = new Set(clips.map((clip) => clip.id));
    return compact({
        id: buildDeletedItemId(),
        kind: "takes",
        title: clips.length === 1 ? clips[0]!.title : idea.title,
        deletedAt: now,
        workspaceId,
        collectionId: idea.collectionId,
        ideaId: idea.id,
        clips,
        activityEvents: state.activityEvents.filter((event) => !!event.clipId && clipIds.has(event.clipId)),
        playlistItems: listEntries<PlaylistItem>(
            state.playlists as never,
            "items",
            (item) => !!item.clipId && clipIds.has(item.clipId)
        ),
    });
}

function descendantIds(collections: Collection[], rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const collection of collections) {
            if (collection.parentCollectionId && ids.has(collection.parentCollectionId) && !ids.has(collection.id)) {
                ids.add(collection.id);
                grew = true;
            }
        }
    }
    return ids;
}

/** A collection with its child collections and every idea in them. */
export function captureDeletedCollection(
    state: CaptureState,
    workspaceId: string,
    collectionId: string,
    now: number = Date.now()
): DeletedItem | null {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const root = workspace?.collections.find((collection) => collection.id === collectionId);
    if (!workspace || !root) return null;
    const scope = descendantIds(workspace.collections, collectionId);
    const ideas = workspace.ideas.filter((idea) => scope.has(idea.collectionId));
    const ideaIds = new Set(ideas.map((idea) => idea.id));
    const primary = state.primaryCollectionIdByWorkspace[workspaceId];
    return compact({
        id: buildDeletedItemId(),
        kind: "collection",
        title: root.title,
        deletedAt: now,
        workspaceId,
        collectionId: root.parentCollectionId ?? null,
        collections: workspace.collections.filter((collection) => scope.has(collection.id)),
        ideas,
        primaryCollectionId: primary && scope.has(primary) ? primary : undefined,
        ...sideRecordsFor(state, ideaIds, {
            events: (event) => event.workspaceId === workspaceId && scope.has(event.collectionId),
            playlistItems: (item) => item.workspaceId === workspaceId && scope.has(item.collectionId),
        }),
    });
}

/** A whole workspace (or a received parcel) with everything in it. */
export function captureDeletedWorkspace(
    state: CaptureState,
    workspaceId: string,
    now: number = Date.now()
): DeletedItem | null {
    const index = state.workspaces.findIndex((candidate) => candidate.id === workspaceId);
    const workspace = state.workspaces[index];
    if (!workspace) return null;
    const ideaIds = new Set(workspace.ideas.map((idea) => idea.id));
    return compact({
        id: buildDeletedItemId(),
        kind: "workspace",
        title: workspace.received?.shareTitle ?? workspace.title,
        deletedAt: now,
        workspaceId,
        workspace,
        index,
        primaryCollectionId: state.primaryCollectionIdByWorkspace[workspaceId] ?? undefined,
        ...sideRecordsFor(state, ideaIds, {
            events: (event) => event.workspaceId === workspaceId,
            playlistItems: (item) => item.workspaceId === workspaceId,
        }),
    });
}

export function captureDeletedSetlist(setlist: Setlist, now: number = Date.now()): DeletedItem {
    return { id: buildDeletedItemId(), kind: "setlist", title: setlist.title, deletedAt: now, setlist };
}

export function captureDeletedSongbook(songbook: Songbook, now: number = Date.now()): DeletedItem {
    return { id: buildDeletedItemId(), kind: "songbook", title: songbook.title, deletedAt: now, songbook };
}

export function captureDeletedPlaylist(playlist: Playlist, now: number = Date.now()): DeletedItem {
    return { id: buildDeletedItemId(), kind: "playlist", title: playlist.title, deletedAt: now, playlist };
}

export function captureDeletedNote(note: Note, now: number = Date.now()): DeletedItem {
    return { id: buildDeletedItemId(), kind: "note", title: note.title, deletedAt: now, note };
}

export function captureDeletedSpark(spark: DeletedSpark, title: string, now: number = Date.now()): DeletedItem {
    return { id: buildDeletedItemId(), kind: "spark", title, deletedAt: now, spark };
}

/** Every clip a record holds (for its audio). */
export function deletedItemClips(item: DeletedItem): ClipVersion[] {
    const ideas = [...(item.ideas ?? []), ...(item.workspace?.ideas ?? [])];
    return [...ideas.flatMap((idea) => idea.clips), ...(item.clips ?? [])];
}

/** How many ideas (or takes) a record brings back — the page's meta line. */
export function deletedItemCount(item: DeletedItem): number {
    if (item.kind === "takes") return item.clips?.length ?? 0;
    if (item.kind === "workspace") return item.workspace?.ideas.length ?? 0;
    if (item.kind === "collection") return item.ideas?.length ?? 0;
    if (item.kind === "setlist") return item.setlist?.entries.length ?? 0;
    if (item.kind === "songbook") return item.songbook?.items.length ?? 0;
    if (item.kind === "playlist") return item.playlist?.items.length ?? 0;
    return 1;
}

/** A stored list read back from disk or a backup: anything malformed is dropped. */
export function sanitizeDeletedItems(value: unknown): DeletedItem[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DeletedItem => {
        if (!item || typeof item !== "object") return false;
        const record = item as Partial<DeletedItem>;
        return (
            typeof record.id === "string" &&
            typeof record.kind === "string" &&
            KINDS.has(record.kind as DeletedItemKind) &&
            typeof record.deletedAt === "number" &&
            Number.isFinite(record.deletedAt)
        );
    }).map((item) => ({ ...item, title: typeof item.title === "string" ? item.title : "" }));
}

// ─── Restore ───────────────────────────────────────────────────────────────

export type RestoreOutcome = {
    id: string;
    kind: DeletedItemKind;
    /** restored: back where it was. moved: its place is gone, so it went to `placeTitle`.
     *  skipped: it is already back (or nowhere it can go). */
    status: "restored" | "moved" | "skipped";
    placeTitle?: string;
};

export type RestoreOptions = {
    /** Title of the collection made when a workspace has none to receive an idea. */
    fallbackCollectionTitle: string;
};

type Draft = RecentlyDeletedState;

function allIdeaIds(workspaces: Workspace[]) {
    return new Set(workspaces.flatMap((workspace) => workspace.ideas.map((idea) => idea.id)));
}

function allCollectionIds(workspaces: Workspace[]) {
    return new Set(workspaces.flatMap((workspace) => workspace.collections.map((collection) => collection.id)));
}

function writable(draft: Draft, workspaceId: string | undefined | null): Workspace | null {
    const workspace = workspaceId ? draft.workspaces.find((candidate) => candidate.id === workspaceId) : undefined;
    return workspace && !isReadOnlyWorkspace(workspace) ? workspace : null;
}

/** Your primary workspace (or the first of your own) — where things go when their place is gone. */
function primaryWorkspace(draft: Draft): Workspace | null {
    return writable(draft, draft.primaryWorkspaceId) ?? writable(draft, firstWritableWorkspaceId(draft.workspaces));
}

function replaceWorkspace(draft: Draft, next: Workspace) {
    draft.workspaces = draft.workspaces.map((workspace) => (workspace.id === next.id ? next : workspace));
}

/** The collection an idea lands in at a workspace's top: its primary, else its first
 *  top-level collection, else a new one. */
function topCollectionFor(draft: Draft, workspace: Workspace, options: RestoreOptions): { workspace: Workspace; collectionId: string } {
    const preferred = draft.primaryCollectionIdByWorkspace[workspace.id];
    const existing =
        workspace.collections.find((collection) => collection.id === preferred) ??
        workspace.collections.find((collection) => !collection.parentCollectionId) ??
        workspace.collections[0];
    if (existing) return { workspace, collectionId: existing.id };
    const now = Date.now();
    const made: Collection = {
        id: genId("collection"),
        title: options.fallbackCollectionTitle,
        workspaceId: workspace.id,
        parentCollectionId: null,
        createdAt: now,
        updatedAt: now,
        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
    };
    const next = { ...workspace, collections: [...workspace.collections, made] };
    replaceWorkspace(draft, next);
    return { workspace: next, collectionId: made.id };
}

/** Where an idea goes back: its own collection, else its workspace's top, else your primary's. */
function placeForIdea(
    draft: Draft,
    workspaceId: string | undefined,
    collectionId: string | null | undefined,
    options: RestoreOptions
): { workspace: Workspace; collectionId: string; moved: boolean } | null {
    const home = writable(draft, workspaceId);
    if (home && collectionId && home.collections.some((collection) => collection.id === collectionId)) {
        return { workspace: home, collectionId, moved: false };
    }
    const target = home ?? primaryWorkspace(draft);
    if (!target) return null;
    return { ...topCollectionFor(draft, target, options), moved: true };
}

function insertAt<T>(list: T[], index: number, value: T): T[] {
    const at = Math.max(0, Math.min(list.length, index));
    return [...list.slice(0, at), value, ...list.slice(at)];
}

function restoreListEntries<L extends { id: string }, T extends { id: string }>(
    lists: L[],
    key: "items" | "entries",
    entries: DeletedListEntry<T>[] | undefined,
    remap: (entry: T) => T
): L[] {
    if (!entries || entries.length === 0) return lists;
    let changed = false;
    const next = lists.map((list) => {
        const mine = entries.filter((candidate) => candidate.listId === list.id).sort((a, b) => a.index - b.index);
        if (mine.length === 0) return list;
        let current = ((list as unknown as Record<string, T[]>)[key] ?? []) as T[];
        const present = new Set(current.map((entry) => entry.id));
        for (const { index, entry } of mine) {
            if (present.has(entry.id)) continue;
            current = insertAt(current, index, remap(entry));
            present.add(entry.id);
            changed = true;
        }
        return { ...list, [key]: current };
    });
    return changed ? next : lists;
}

function restoreSideRecords(
    draft: Draft,
    item: DeletedItem,
    remap: { workspaceId?: string; collectionId?: (old: string) => string; ideaId?: (old: string, clipId?: string | null) => string }
) {
    const ws = (old: string) => remap.workspaceId ?? old;
    const col = (old: string) => remap.collectionId?.(old) ?? old;
    const idea = (old: string, clipId?: string | null) => remap.ideaId?.(old, clipId) ?? old;
    if (item.activityEvents?.length) {
        const present = new Set(draft.activityEvents.map((event) => event.id));
        const back = item.activityEvents
            .filter((event) => !present.has(event.id))
            .map((event) => ({
                ...event,
                workspaceId: ws(event.workspaceId),
                collectionId: col(event.collectionId),
                ideaId: idea(event.ideaId, event.clipId),
            }));
        if (back.length > 0) draft.activityEvents = [...draft.activityEvents, ...back].sort((a, b) => b.at - a.at);
    }
    draft.playlists = restoreListEntries(draft.playlists, "items", item.playlistItems, (entry: PlaylistItem) => ({
        ...entry,
        workspaceId: ws(entry.workspaceId),
        collectionId: col(entry.collectionId),
        ideaId: idea(entry.ideaId, entry.clipId),
    }));
    draft.songbooks = restoreListEntries(draft.songbooks, "items", item.songbookItems, (entry: SongbookItem) => ({
        ...entry,
        workspaceId: ws(entry.workspaceId),
    }));
    draft.setlists = restoreListEntries(draft.setlists, "entries", item.setlistEntries, (entry: SetlistEntry) => ({
        ...entry,
        workspaceId: ws(entry.workspaceId),
    }));
}

function restoreIdeaItem(draft: Draft, item: DeletedItem, options: RestoreOptions): RestoreOutcome {
    const present = allIdeaIds(draft.workspaces);
    const ideas = (item.ideas ?? []).filter((idea) => !present.has(idea.id));
    if (ideas.length === 0) return { id: item.id, kind: item.kind, status: "skipped" };
    const place = placeForIdea(draft, item.workspaceId, item.collectionId, options);
    if (!place) return { id: item.id, kind: item.kind, status: "skipped" };
    const back = ideas.map((idea) => (place.moved ? { ...idea, collectionId: place.collectionId } : idea));
    const hidden = new Set(place.moved ? [] : item.hiddenIdeaIds ?? []);
    replaceWorkspace(draft, {
        ...place.workspace,
        ideas: [...place.workspace.ideas, ...back],
        collections: place.workspace.collections.map((collection) =>
            collection.id !== place.collectionId || hidden.size === 0
                ? collection
                : {
                      ...collection,
                      ideasListState: {
                          ...collection.ideasListState,
                          hiddenIdeaIds: Array.from(
                              new Set([...(collection.ideasListState?.hiddenIdeaIds ?? []), ...hidden])
                          ),
                      },
                  }
        ),
    });
    restoreSideRecords(draft, item, place.moved
        ? { workspaceId: place.workspace.id, collectionId: () => place.collectionId }
        : {});
    return {
        id: item.id,
        kind: item.kind,
        status: place.moved ? "moved" : "restored",
        placeTitle: place.moved ? place.workspace.title : undefined,
    };
}

function restoreTakesItem(draft: Draft, item: DeletedItem, options: RestoreOptions): RestoreOutcome {
    const clips = item.clips ?? [];
    const home = writable(draft, item.workspaceId);
    const sketch = home?.ideas.find((idea) => idea.id === item.ideaId);
    if (home && sketch) {
        const presentIds = new Set(sketch.clips.map((clip) => clip.id));
        const back = clips.filter((clip) => !presentIds.has(clip.id));
        if (back.length === 0) return { id: item.id, kind: item.kind, status: "skipped" };
        const knownIds = new Set([...presentIds, ...back.map((clip) => clip.id)]);
        const hasPrimary = sketch.clips.some((clip) => clip.isPrimary);
        const restored = back.map((clip) => ({
            ...clip,
            isPrimary: hasPrimary ? false : clip.isPrimary,
            parentClipId: clip.parentClipId && knownIds.has(clip.parentClipId) ? clip.parentClipId : undefined,
        }));
        const nextClips = [...sketch.clips, ...restored];
        if (!nextClips.some((clip) => clip.isPrimary)) nextClips[0] = { ...nextClips[0]!, isPrimary: true };
        replaceWorkspace(draft, {
            ...home,
            ideas: home.ideas.map((idea) => (idea.id === sketch.id ? { ...idea, clips: nextClips } : idea)),
        });
        restoreSideRecords(draft, item, {});
        return { id: item.id, kind: item.kind, status: "restored" };
    }
    // The sketch is gone: each take comes back as its own clip.
    const place = placeForIdea(draft, item.workspaceId, item.collectionId, options);
    if (!place || clips.length === 0) return { id: item.id, kind: item.kind, status: "skipped" };
    const ideaIdByClip = new Map<string, string>();
    const made: SongIdea[] = clips.map((clip) => {
        const id = genId("idea");
        ideaIdByClip.set(clip.id, id);
        return {
            id,
            title: clip.title,
            notes: clip.notes ?? "",
            status: "clip",
            completionPct: 0,
            kind: "clip",
            collectionId: place.collectionId,
            createdAt: clip.createdAt,
            importedAt: clip.importedAt,
            sourceCreatedAt: clip.sourceCreatedAt,
            lastActivityAt: clip.createdAt,
            clips: [{ ...clip, isPrimary: true, parentClipId: undefined }],
        };
    });
    replaceWorkspace(draft, { ...place.workspace, ideas: [...place.workspace.ideas, ...made] });
    restoreSideRecords(draft, item, {
        workspaceId: place.workspace.id,
        collectionId: () => place.collectionId,
        ideaId: (old, clipId) => (clipId && ideaIdByClip.get(clipId)) || old,
    });
    return { id: item.id, kind: item.kind, status: "moved", placeTitle: place.workspace.title };
}

function restoreCollectionItem(draft: Draft, item: DeletedItem): RestoreOutcome {
    const collections = item.collections ?? [];
    const root = collections.find((collection) => !collections.some((other) => other.id === collection.parentCollectionId));
    const presentCollections = allCollectionIds(draft.workspaces);
    if (!root || presentCollections.has(root.id)) return { id: item.id, kind: item.kind, status: "skipped" };
    const home = writable(draft, item.workspaceId);
    const target = home ?? primaryWorkspace(draft);
    if (!target) return { id: item.id, kind: item.kind, status: "skipped" };
    const parentKept =
        !!home && !!item.collectionId && home.collections.some((collection) => collection.id === item.collectionId);
    const moved = !home || (!!item.collectionId && !parentKept);
    const back = collections
        .filter((collection) => !presentCollections.has(collection.id))
        .map((collection) => ({
            ...collection,
            workspaceId: target.id,
            parentCollectionId:
                collection.id === root.id ? (parentKept ? item.collectionId ?? null : null) : collection.parentCollectionId,
        }));
    const backIds = new Set(back.map((collection) => collection.id));
    const presentIdeas = allIdeaIds(draft.workspaces);
    const ideas = (item.ideas ?? []).filter((idea) => !presentIdeas.has(idea.id) && backIds.has(idea.collectionId));
    replaceWorkspace(draft, {
        ...target,
        collections: [...target.collections, ...back],
        ideas: [...target.ideas, ...ideas],
    });
    if (item.primaryCollectionId && backIds.has(item.primaryCollectionId) && target.id === item.workspaceId) {
        draft.primaryCollectionIdByWorkspace = { ...draft.primaryCollectionIdByWorkspace, [target.id]: item.primaryCollectionId };
    }
    restoreSideRecords(draft, item, target.id === item.workspaceId ? {} : { workspaceId: target.id });
    return { id: item.id, kind: item.kind, status: moved ? "moved" : "restored", placeTitle: moved ? target.title : undefined };
}

function restoreWorkspaceItem(draft: Draft, item: DeletedItem): RestoreOutcome {
    const workspace = item.workspace;
    if (!workspace || draft.workspaces.some((candidate) => candidate.id === workspace.id)) {
        return { id: item.id, kind: item.kind, status: "skipped" };
    }
    draft.workspaces = insertAt(draft.workspaces, item.index ?? draft.workspaces.length, workspace);
    if (item.primaryCollectionId && workspace.collections.some((collection) => collection.id === item.primaryCollectionId)) {
        draft.primaryCollectionIdByWorkspace = { ...draft.primaryCollectionIdByWorkspace, [workspace.id]: item.primaryCollectionId };
    }
    restoreSideRecords(draft, item, {});
    return { id: item.id, kind: item.kind, status: "restored" };
}

function restoreRecord<T extends { id: string }>(list: T[], record: T | undefined): T[] | null {
    if (!record || list.some((candidate) => candidate.id === record.id)) return null;
    return [record, ...list];
}

function restoreOne(draft: Draft, item: DeletedItem, options: RestoreOptions): RestoreOutcome {
    const skipped: RestoreOutcome = { id: item.id, kind: item.kind, status: "skipped" };
    switch (item.kind) {
        case "idea":
            return restoreIdeaItem(draft, item, options);
        case "takes":
            return restoreTakesItem(draft, item, options);
        case "collection":
            return restoreCollectionItem(draft, item);
        case "workspace":
            return restoreWorkspaceItem(draft, item);
        case "setlist": {
            const next = restoreRecord(draft.setlists, item.setlist);
            if (!next) return skipped;
            draft.setlists = next;
            return { ...skipped, status: "restored" };
        }
        case "songbook": {
            const next = restoreRecord(draft.songbooks, item.songbook);
            if (!next) return skipped;
            draft.songbooks = next;
            return { ...skipped, status: "restored" };
        }
        case "playlist": {
            const next = restoreRecord(draft.playlists, item.playlist);
            if (!next) return skipped;
            draft.playlists = next;
            return { ...skipped, status: "restored" };
        }
        case "note": {
            const next = restoreRecord(draft.notes, item.note);
            if (!next) return skipped;
            draft.notes = next;
            return { ...skipped, status: "restored" };
        }
        case "spark": {
            const spark = item.spark;
            if (!spark) return skipped;
            if (spark.tool === "wordLadder") {
                const next = restoreRecord(draft.wordLadders, spark.record);
                if (!next) return skipped;
                draft.wordLadders = next;
            } else if (spark.tool === "cutUp") {
                const next = restoreRecord(draft.cutUpSparks, spark.record);
                if (!next) return skipped;
                draft.cutUpSparks = next;
            } else {
                const next = restoreRecord(draft.magpieSparks, spark.record);
                if (!next) return skipped;
                draft.magpieSparks = next;
            }
            return { ...skipped, status: "restored" };
        }
        default:
            return skipped;
    }
}

/**
 * Put records back, oldest delete first (a collection before the take deleted out of
 * it later). Ids stay as they were, so setlist entries, lineage and Shelf find them.
 * A record whose place is gone lands in its workspace's top collection, or your
 * primary workspace's. A record already back is dropped from the list.
 */
export function restoreDeletedItems(
    state: RecentlyDeletedState,
    ids: Iterable<string>,
    options: RestoreOptions
): { patch: Partial<RecentlyDeletedState>; outcomes: RestoreOutcome[] } {
    const wanted = new Set(ids);
    const items = state.recentlyDeleted
        .filter((item) => wanted.has(item.id))
        .sort((a, b) => a.deletedAt - b.deletedAt);
    if (items.length === 0) return { patch: {}, outcomes: [] };
    const draft: Draft = { ...state };
    const outcomes = items.map((item) => restoreOne(draft, item, options));
    const done = new Set(outcomes.map((outcome) => outcome.id));
    return {
        patch: {
            workspaces: draft.workspaces,
            activityEvents: draft.activityEvents,
            playlists: draft.playlists,
            songbooks: draft.songbooks,
            setlists: draft.setlists,
            notes: draft.notes,
            wordLadders: draft.wordLadders,
            cutUpSparks: draft.cutUpSparks,
            magpieSparks: draft.magpieSparks,
            primaryCollectionIdByWorkspace: draft.primaryCollectionIdByWorkspace,
            recentlyDeleted: state.recentlyDeleted.filter((item) => !done.has(item.id)),
        },
        outcomes,
    };
}
