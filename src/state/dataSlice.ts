import { StateCreator } from "zustand";
import {
    Workspace,
    Collection,
    SongIdea,
    ClipVersion,
    CustomTagDefinition,
    ActivityEvent,
    ActivityMetric,
    ActivitySource,
    IdeasFilter,
    IdeaSort,
    IdeaStatus,
    ProjectLyrics,
    LyricsVersion,
    LyricsLine,
    ChordPlacement,
    IdeasListState,
    IdeasHiddenDay,
    WorkspaceArchiveState,
    Playlist,
    PlaylistItem,
    WorkspaceListOrder,
    WorkspaceStartupPreference,
    PracticeMarker,
} from "../types";
import { genClipTitle } from "../utils";
import type { SelectionSlice } from "./selectionSlice";
import type { RecordingSlice } from "./recordingSlice";
import type { PlayerSlice } from "./playerSlice";
import { buildRuntimeCleanupPatch } from "./runtimeCleanup";
import {
    collectManagedIdeaAudioUris,
    collectManagedWorkspaceAudioUris,
    deleteManagedArchiveUri,
    deleteManagedAudioUris,
    filterUnreferencedManagedAudioUris,
} from "../services/managedMedia";
import { authorizeIntentionalEmptyStateWrite } from "../services/stateIntegrity";
import { relocateActivityEvents, relocatePlaylists } from "./relocationMetadata";

export type DataSlice = {
    workspaces: Workspace[];
    activityEvents: ActivityEvent[];
    activeWorkspaceId: string | null;
    primaryWorkspaceId: string | null;
    lastUsedWorkspaceId: string | null;
    workspaceStartupPreference: WorkspaceStartupPreference;
    workspaceListOrder: WorkspaceListOrder;
    workspaceLastOpenedAt: Record<string, number>;
    collectionLastOpenedAt: Record<string, number>;
    playlists: Playlist[];
    preferredRecordingInputId: string | null;
    globalCustomClipTags: CustomTagDefinition[];
    setActiveWorkspaceId: (id: string) => void;
    setPrimaryWorkspaceId: (id: string | null) => void;
    setWorkspaceStartupPreference: (value: WorkspaceStartupPreference) => void;
    setWorkspaceListOrder: (value: WorkspaceListOrder) => void;
    markCollectionOpened: (collectionId: string) => void;
    setPreferredRecordingInputId: (id: string | null) => void;
    addWorkspace: (title: string, description?: string) => void;
    updateWorkspace: (id: string, updates: { title?: string; description?: string }) => void;
    deleteWorkspace: (id: string) => void;
    archiveWorkspace: (id: string, isArchived: boolean) => void;
    addCollection: (workspaceId: string, title: string, parentCollectionId?: string | null) => string;
    updateCollection: (workspaceId: string, collectionId: string, updates: { title?: string }) => void;
    moveCollection: (
        collectionId: string,
        targetWorkspaceId: string,
        targetParentCollectionId?: string | null
    ) => { ok: boolean; error?: string };
    deleteCollection: (collectionId: string) => void;
    renameIdeaPreservingActivity: (ideaId: string, nextTitle: string) => void;
    toggleIdeaFavorite: (ideaId: string) => void;
    setClipTags: (ideaId: string, clipId: string, tags: string[]) => void;
    addProjectCustomTag: (ideaId: string, tag: CustomTagDefinition) => void;
    removeProjectCustomTag: (ideaId: string, tagKey: string) => void;
    addGlobalCustomClipTag: (tag: CustomTagDefinition) => void;
    removeGlobalCustomClipTag: (tagKey: string) => void;
    addClipPracticeMarker: (ideaId: string, clipId: string, marker: PracticeMarker) => void;
    removeClipPracticeMarker: (ideaId: string, clipId: string, markerId: string) => void;
    setClipPracticeMarkers: (ideaId: string, clipId: string, markers: PracticeMarker[]) => void;
    logIdeaActivity: (
        ideaId: string,
        metric: ActivityMetric,
        source: ActivitySource,
        clipId?: string | null
    ) => void;
    logActivityEvents: (events: Array<Omit<ActivityEvent, "id">>) => void;

    ideasFilter: IdeasFilter;
    setIdeasFilter: (v: IdeasFilter) => void;
    ideasSort: IdeaSort;
    setIdeasSort: (v: IdeaSort) => void;

    primaryFilter: "all" | IdeaStatus;
    setPrimaryFilter: (v: "all" | IdeaStatus) => void;
    primarySort: IdeaSort;
    setPrimarySort: (v: IdeaSort) => void;
    setIdeasHidden: (collectionId: string, ideaIds: string[], hidden: boolean) => void;
    setTimelineDaysHidden: (collectionId: string, days: IdeasHiddenDay[], hidden: boolean) => void;

    addIdea: (title: string, collectionId: string) => string;
    quickRecordIdea: (title: string, collectionId: string) => string;
    updateIdeas: (updater: (prev: SongIdea[]) => SongIdea[]) => void;
    setClipManualSortOrder: (ideaId: string, orderedClipIds: string[]) => void;
    addClipVersion: (
        targetIdeaId: string,
        override?: { audioUri?: string; durationMs?: number; waveformPeaks?: number[]; parentClipId?: string }
    ) => void;
    addPlaylist: (title: string) => string;
    addItemsToPlaylist: (
        playlistId: string,
        items: Array<Omit<PlaylistItem, "id" | "addedAt">>
    ) => void;
    reorderPlaylistItems: (playlistId: string, orderedItemIds: string[]) => void;
    removePlaylistItem: (playlistId: string, playlistItemId: string) => void;
    deleteIdea: (ideaId: string) => void;
};

const DEFAULT_COLLECTION_TITLE = "Inbox";

function buildCollectionId(prefix = "col") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildActivityEventId() {
    return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPlaylistId() {
    return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPlaylistItemId() {
    return `playlist-item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function countTotalIdeas(workspaces: Workspace[]) {
    return workspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0);
}

function ensureAtLeastOneActiveWorkspace(workspaces: Workspace[]) {
    if (workspaces.some((workspace) => !workspace.isArchived)) {
        return workspaces;
    }

    // Deleting the final active workspace should not strand the app without a
    // valid browse context. Seed a fresh empty workspace instead of blocking.
    return [createInitialWorkspace(), ...workspaces];
}

export const createInitialWorkspace = (): Workspace => ({
    id: `ws-${Date.now()}`,
    title: "Main",
    collections: [],
    ideas: [],
});

export const createEmptyProjectLyrics = (): ProjectLyrics => ({
    versions: [],
});

export const createEmptyWorkspaceIdeasListState = (): IdeasListState => ({
    hiddenIdeaIds: [],
    hiddenDays: [],
});

export const createCollection = (
    workspaceId: string,
    title: string,
    parentCollectionId: string | null = null
): Collection => {
    const now = Date.now();
    return {
        id: buildCollectionId(),
        title,
        workspaceId,
        parentCollectionId,
        createdAt: now,
        updatedAt: now,
        ideasListState: createEmptyWorkspaceIdeasListState(),
    };
};

function getIdeaCreatedTimestamp(idea: SongIdea) {
    if (idea.clips.length === 0) {
        return idea.createdAt;
    }
    return idea.clips.reduce((minTs, clip) => Math.min(minTs, clip.createdAt), Number.POSITIVE_INFINITY);
}

function deriveIdeaLastActivityTimestamp(idea: SongIdea) {
    let lastTs = getIdeaCreatedTimestamp(idea);

    for (const clip of idea.clips) {
        lastTs = Math.max(lastTs, clip.createdAt);
    }

    if (idea.kind === "project") {
        for (const version of idea.lyrics?.versions ?? []) {
            lastTs = Math.max(lastTs, version.updatedAt || version.createdAt);
        }
    }

    if (typeof idea.lastActivityAt === "number") {
        lastTs = Math.max(lastTs, idea.lastActivityAt);
    }

    return lastTs;
}

function normalizeChordPlacement(chord: ChordPlacement | undefined, lineIndex: number, chordIndex: number): ChordPlacement {
    return {
        id: chord?.id || `chord-${lineIndex + 1}-${chordIndex + 1}`,
        chord: chord?.chord ?? "",
        at: Number.isFinite(chord?.at) ? chord!.at : 0,
    };
}

function normalizeLyricsLine(line: LyricsLine | undefined, lineIndex: number): LyricsLine {
    return {
        id: line?.id || `line-${lineIndex + 1}`,
        text: line?.text ?? "",
        chords: Array.isArray(line?.chords)
            ? line!.chords.map((chord, chordIndex) => normalizeChordPlacement(chord, lineIndex, chordIndex))
            : [],
    };
}

function normalizeLyricsVersion(version: LyricsVersion | undefined, versionIndex: number): LyricsVersion {
    const createdAt =
        typeof version?.createdAt === "number" ? version.createdAt : Date.now() + versionIndex;
    return {
        id: version?.id || `lyrics-version-${versionIndex + 1}`,
        createdAt,
        updatedAt: typeof version?.updatedAt === "number" ? version.updatedAt : createdAt,
        document: {
            lines: Array.isArray(version?.document?.lines)
                ? version!.document.lines.map((line, lineIndex) => normalizeLyricsLine(line, lineIndex))
                : [],
        },
    };
}

function isNormalizedProjectLyrics(lyrics: ProjectLyrics) {
    return lyrics.versions.every((version) =>
        typeof version?.id === "string" &&
        typeof version?.createdAt === "number" &&
        typeof version?.updatedAt === "number" &&
        Array.isArray(version?.document?.lines) &&
        version.document.lines.every((line) =>
            typeof line?.id === "string" &&
            typeof line?.text === "string" &&
            Array.isArray(line?.chords) &&
            line.chords.every((chord) =>
                typeof chord?.id === "string" &&
                typeof chord?.chord === "string" &&
                typeof chord?.at === "number"
            )
        )
    );
}

function normalizeProjectLyrics(lyrics?: ProjectLyrics): ProjectLyrics {
    if (!lyrics || !Array.isArray(lyrics.versions)) {
        return createEmptyProjectLyrics();
    }

    if (isNormalizedProjectLyrics(lyrics)) {
        return lyrics;
    }

    return {
        versions: lyrics.versions.map((version, index) => normalizeLyricsVersion(version, index)),
    };
}

function normalizeOptionalTimestamp(value: unknown) {
    return Number.isFinite(value) ? Number(value) : undefined;
}

function normalizeClip(clip: ClipVersion): ClipVersion {
    return {
        ...clip,
        importedAt: normalizeOptionalTimestamp(clip.importedAt),
        sourceCreatedAt: normalizeOptionalTimestamp(clip.sourceCreatedAt),
    };
}

function normalizeIdea(idea: SongIdea): SongIdea {
    if (idea.kind !== "project") {
        const normalizedClips = idea.clips.map(normalizeClip);
        const derivedLastActivityAt = deriveIdeaLastActivityTimestamp(idea);
        const normalizedIdea: SongIdea = {
            ...idea,
            clips: normalizedClips,
            importedAt: normalizeOptionalTimestamp(idea.importedAt),
            sourceCreatedAt: normalizeOptionalTimestamp(idea.sourceCreatedAt),
        };
        return normalizedIdea.lastActivityAt === derivedLastActivityAt
            ? normalizedIdea
            : { ...normalizedIdea, lastActivityAt: derivedLastActivityAt };
    }

    const normalizedLyrics = normalizeProjectLyrics(idea.lyrics);
    let normalizedIdea: SongIdea = {
        ...idea,
        clips: idea.clips.map(normalizeClip),
        importedAt: normalizeOptionalTimestamp(idea.importedAt),
        sourceCreatedAt: normalizeOptionalTimestamp(idea.sourceCreatedAt),
    };

    if (idea.lyrics !== normalizedLyrics) {
        normalizedIdea = { ...normalizedIdea, lyrics: normalizedLyrics };
    }

    if (normalizedIdea.clips.length === 1) {
        const onlyClip = normalizedIdea.clips[0];
        if (onlyClip && !onlyClip.isPrimary) {
            normalizedIdea = {
                ...normalizedIdea,
                clips: [{ ...onlyClip, isPrimary: true }],
            };
        }
    }

    const derivedLastActivityAt = deriveIdeaLastActivityTimestamp(normalizedIdea);
    if (normalizedIdea.lastActivityAt !== derivedLastActivityAt) {
        normalizedIdea = { ...normalizedIdea, lastActivityAt: derivedLastActivityAt };
    }

    return normalizedIdea;
}

function normalizeWorkspaceIdeasListState(
    ideasListState: IdeasListState | undefined,
    ideas: SongIdea[]
): IdeasListState {
    const ideaIdSet = new Set(ideas.map((idea) => idea.id));
    const hiddenIdeaIds = Array.isArray(ideasListState?.hiddenIdeaIds)
        ? Array.from(new Set(ideasListState.hiddenIdeaIds.filter((id) => ideaIdSet.has(id))))
        : [];

    const hiddenDayMap = new Map<string, IdeasHiddenDay>();
    for (const hiddenDay of ideasListState?.hiddenDays ?? []) {
        if (
            (hiddenDay?.metric === "created" || hiddenDay?.metric === "updated") &&
            Number.isFinite(hiddenDay?.dayStartTs)
        ) {
            hiddenDayMap.set(`${hiddenDay.metric}:${hiddenDay.dayStartTs}`, {
                metric: hiddenDay.metric,
                dayStartTs: hiddenDay.dayStartTs,
            });
        }
    }

    return {
        hiddenIdeaIds,
        hiddenDays: Array.from(hiddenDayMap.values()),
    };
}

function normalizeWorkspaceCollectionVisibility<T extends Workspace>(workspace: T): T {
    return {
        ...workspace,
        collections: workspace.collections.map((collection) => {
            const collectionIdeas = workspace.ideas.filter(
                (idea) => idea.collectionId === collection.id
            );
            return {
                ...collection,
                ideasListState: normalizeWorkspaceIdeasListState(
                    collection.ideasListState,
                    collectionIdeas
                ),
            };
        }),
    };
}

function normalizeIdeas(ideas: SongIdea[]) {
    return ideas.map(normalizeIdea);
}

function normalizeWorkspaceArchiveState(archiveState: WorkspaceArchiveState | undefined): WorkspaceArchiveState | undefined {
    if (!archiveState || typeof archiveState !== "object") {
        return undefined;
    }

    if (
        !Number.isFinite(archiveState.schemaVersion) ||
        !Number.isFinite(archiveState.archivedAt) ||
        typeof archiveState.archiveUri !== "string" ||
        !Number.isFinite(archiveState.packageSizeBytes) ||
        !Number.isFinite(archiveState.originalAudioBytes) ||
        !Number.isFinite(archiveState.originalMetadataBytes) ||
        !Number.isFinite(archiveState.archivedMetadataBytes) ||
        !Number.isFinite(archiveState.savingsBytes) ||
        !Number.isFinite(archiveState.audioFileCount) ||
        !Number.isFinite(archiveState.missingFileCount)
    ) {
        return undefined;
    }

    return {
        schemaVersion: archiveState.schemaVersion,
        archivedAt: archiveState.archivedAt,
        archiveUri: archiveState.archiveUri,
        packageSizeBytes: archiveState.packageSizeBytes,
        originalAudioBytes: archiveState.originalAudioBytes,
        originalMetadataBytes: archiveState.originalMetadataBytes,
        archivedMetadataBytes: archiveState.archivedMetadataBytes,
        savingsBytes: archiveState.savingsBytes,
        audioFileCount: archiveState.audioFileCount,
        missingFileCount: archiveState.missingFileCount,
    };
}

function findWorkspaceWithCollection(workspaces: Workspace[], collectionId: string) {
    return workspaces.find((workspace) =>
        workspace.collections.some((collection) => collection.id === collectionId)
    ) ?? null;
}

function getCollectionChildren(collections: Collection[], collectionId: string) {
    return collections.filter((collection) => collection.parentCollectionId === collectionId);
}

function getCollectionDescendantIds(collections: Collection[], collectionId: string) {
    const ids = new Set<string>();
    const walk = (targetId: string) => {
        for (const collection of collections) {
            if (collection.parentCollectionId === targetId && !ids.has(collection.id)) {
                ids.add(collection.id);
                walk(collection.id);
            }
        }
    };
    walk(collectionId);
    return ids;
}

function normalizeActivityEvents(events: ActivityEvent[] | undefined) {
    if (!Array.isArray(events)) return [];

    return events
        .filter((event): event is ActivityEvent => {
            if (!event || typeof event !== "object") return false;
            return (
                typeof event.id === "string" &&
                Number.isFinite(event.at) &&
                typeof event.workspaceId === "string" &&
                typeof event.collectionId === "string" &&
                typeof event.ideaId === "string" &&
                (event.ideaKind === "song" || event.ideaKind === "clip") &&
                typeof event.ideaTitle === "string" &&
                (event.metric === "created" || event.metric === "updated") &&
                [
                    "recording",
                    "import",
                    "song-save",
                    "lyrics-save",
                    "audio-edit",
                    "history-seed",
                ].includes(event.source)
            );
        })
        .sort((a, b) => b.at - a.at);
}

function normalizePlaylistItems(items: PlaylistItem[] | undefined) {
    if (!Array.isArray(items)) return [];

    return items.filter((item): item is PlaylistItem => {
        if (!item || typeof item !== "object") return false;
        return (
            typeof item.id === "string" &&
            (item.kind === "song" || item.kind === "clip") &&
            typeof item.workspaceId === "string" &&
            typeof item.collectionId === "string" &&
            typeof item.ideaId === "string" &&
            (item.clipId == null || typeof item.clipId === "string") &&
            Number.isFinite(item.addedAt)
        );
    });
}

export function normalizePlaylists(playlists: Playlist[] | undefined) {
    if (!Array.isArray(playlists)) return [];

    return playlists
        .filter((playlist): playlist is Playlist => {
            if (!playlist || typeof playlist !== "object") return false;
            return (
                typeof playlist.id === "string" &&
                typeof playlist.title === "string" &&
                Number.isFinite(playlist.createdAt) &&
                Number.isFinite(playlist.updatedAt)
            );
        })
        .map((playlist) => ({
            ...playlist,
            title: playlist.title.trim() || "Untitled Playlist",
            items: normalizePlaylistItems(playlist.items),
        }));
}

export function normalizeWorkspaces(workspaces: Workspace[]) {
    return workspaces.map((workspace) => {
        const normalizedArchiveState = normalizeWorkspaceArchiveState(workspace.archiveState);
        const existingCollections = Array.isArray(workspace.collections) ? workspace.collections : [];
        const migratedDefaultCollection =
            existingCollections.length === 0 && workspace.ideas.length > 0
                ? createCollection(workspace.id, DEFAULT_COLLECTION_TITLE, null)
                : null;
        const collections = (migratedDefaultCollection ? [migratedDefaultCollection] : existingCollections).map(
            (collection) => ({
                ...collection,
                workspaceId: workspace.id,
                parentCollectionId:
                    typeof collection.parentCollectionId === "string" ? collection.parentCollectionId : null,
                ideasListState: collection.ideasListState,
            })
        );
        const fallbackCollectionId = collections[0]?.id ?? "";
        const normalizedIdeas = normalizeIdeas(
            workspace.ideas.map((idea) => ({
                ...idea,
                collectionId:
                    typeof idea.collectionId === "string" && idea.collectionId.length > 0
                        ? idea.collectionId
                        : fallbackCollectionId,
            }))
        );
        const archivedIdeas =
            normalizedArchiveState
                ? normalizedIdeas.map((idea) => ({
                    ...idea,
                    clips: idea.clips.map((clip) => ({
                        ...clip,
                        audioUri: undefined,
                        sourceAudioUri: undefined,
                        waveformPeaks: undefined,
                    })),
                }))
                : normalizedIdeas;
        const ideaIdsByCollection = new Map<string, SongIdea[]>();
        for (const idea of archivedIdeas) {
            const bucket = ideaIdsByCollection.get(idea.collectionId) ?? [];
            bucket.push(idea);
            ideaIdsByCollection.set(idea.collectionId, bucket);
        }
        const legacyWorkspaceListState = normalizeWorkspaceIdeasListState(workspace.ideasListState, archivedIdeas);
        const normalizedCollections = collections.map((collection, index) => {
            const collectionIdeas = ideaIdsByCollection.get(collection.id) ?? [];
            const sourceListState =
                index === 0 && migratedDefaultCollection ? legacyWorkspaceListState : collection.ideasListState;
            return {
                ...collection,
                ideasListState: normalizeWorkspaceIdeasListState(sourceListState, collectionIdeas),
            };
        });
        return {
            ...workspace,
            isArchived: Boolean(workspace.isArchived || normalizedArchiveState),
            archiveState: normalizedArchiveState,
            collections: normalizedCollections,
            ideas: archivedIdeas,
        };
    });
}

export const createDataSlice: StateCreator<
    DataSlice & SelectionSlice & RecordingSlice & PlayerSlice,
    [],
    [],
    DataSlice
> = (set, get) => ({
    workspaces: [createInitialWorkspace()],
    activityEvents: [],
    activeWorkspaceId: null,
    primaryWorkspaceId: null,
    lastUsedWorkspaceId: null,
    workspaceStartupPreference: "last-used",
    workspaceListOrder: "last-worked",
    workspaceLastOpenedAt: {},
    collectionLastOpenedAt: {},
    playlists: [],
    preferredRecordingInputId: null,
    globalCustomClipTags: [],

    setActiveWorkspaceId: (id) =>
        set((state) => {
            if (!state.workspaces.some((workspace) => workspace.id === id)) return state;
            const now = Date.now();
            return {
                activeWorkspaceId: id,
                lastUsedWorkspaceId: id,
                workspaceLastOpenedAt: {
                    ...state.workspaceLastOpenedAt,
                    [id]: now,
                },
            };
        }),
    setPrimaryWorkspaceId: (id) =>
        set((state) => {
            if (id === null) {
                return { primaryWorkspaceId: null };
            }

            const targetWorkspace = state.workspaces.find(
                (workspace) => workspace.id === id && !workspace.isArchived
            );
            if (!targetWorkspace) return state;
            return { primaryWorkspaceId: id };
        }),
    setWorkspaceStartupPreference: (value) => set({ workspaceStartupPreference: value }),
    setWorkspaceListOrder: (value) => set({ workspaceListOrder: value }),
    markCollectionOpened: (collectionId) =>
        set((state) => {
            const workspace = findWorkspaceWithCollection(state.workspaces, collectionId);
            if (!workspace) return state;
            const now = Date.now();
            return {
                lastUsedWorkspaceId: workspace.id,
                workspaceLastOpenedAt: {
                    ...state.workspaceLastOpenedAt,
                    [workspace.id]: now,
                },
                collectionLastOpenedAt: {
                    ...state.collectionLastOpenedAt,
                    [collectionId]: now,
                },
            };
        }),
    setPreferredRecordingInputId: (id) => set({ preferredRecordingInputId: id }),

    addWorkspace: (title, description) => {
        const workspaceId = `ws-${Date.now()}`;
        set((state) => ({
                workspaces: [
                {
                    id: workspaceId,
                    title,
                    description,
                    collections: [],
                    ideas: [],
                },
                ...state.workspaces,
            ],
        }));
        get().markRecentlyAdded([workspaceId]);
    },

    addCollection: (workspaceId, title, parentCollectionId = null) => {
        const collection = createCollection(workspaceId, title, parentCollectionId);
        set((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id === workspaceId
                    ? { ...workspace, collections: [collection, ...workspace.collections] }
                    : workspace
            ),
        }));
        get().markRecentlyAdded([collection.id]);
        return collection.id;
    },

    updateCollection: (workspaceId, collectionId, updates) => {
        const nextTitle = updates.title?.trim();
        if (!nextTitle) return;

        set((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id !== workspaceId
                    ? workspace
                    : {
                        ...workspace,
                        collections: workspace.collections.map((collection) =>
                            collection.id === collectionId
                                ? { ...collection, title: nextTitle, updatedAt: Date.now() }
                                : collection
                        ),
                    }
            ),
        }));
    },

    moveCollection: (collectionId, targetWorkspaceId, targetParentCollectionId = null) => {
        const state = get();
        const sourceWorkspace = findWorkspaceWithCollection(state.workspaces, collectionId);
        const targetWorkspace = state.workspaces.find((workspace) => workspace.id === targetWorkspaceId) ?? null;

        if (!sourceWorkspace || !targetWorkspace) {
            return { ok: false, error: "Collection not found." };
        }

        const movingCollection = sourceWorkspace.collections.find((collection) => collection.id === collectionId) ?? null;
        if (!movingCollection) {
            return { ok: false, error: "Collection not found." };
        }

        const descendantIds = getCollectionDescendantIds(sourceWorkspace.collections, collectionId);
        const hasChildCollections = descendantIds.size > 0;

        if (targetParentCollectionId) {
            if (targetParentCollectionId === collectionId || descendantIds.has(targetParentCollectionId)) {
                return { ok: false, error: "A collection cannot be moved inside itself." };
            }

            const targetParent = targetWorkspace.collections.find(
                (collection) => collection.id === targetParentCollectionId
            ) ?? null;

            if (!targetParent) {
                return { ok: false, error: "Destination collection not found." };
            }

            if (targetParent.parentCollectionId) {
                return { ok: false, error: "Subcollections cannot contain another subcollection." };
            }

            if (hasChildCollections) {
                return {
                    ok: false,
                    error: "A collection with subcollections can only be moved to the top level.",
                };
            }
        }

        if (
            sourceWorkspace.id === targetWorkspace.id &&
            (movingCollection.parentCollectionId ?? null) === (targetParentCollectionId ?? null)
        ) {
            return { ok: true };
        }

        const moveScopeIds = new Set<string>([collectionId, ...descendantIds]);
        const movedCollections = sourceWorkspace.collections
            .filter((collection) => moveScopeIds.has(collection.id))
            .map((collection) => ({
                ...collection,
                workspaceId: targetWorkspace.id,
                parentCollectionId:
                    collection.id === collectionId ? targetParentCollectionId ?? null : collection.parentCollectionId ?? null,
            }));
        const movedIdeas = sourceWorkspace.ideas
            .filter((idea) => moveScopeIds.has(idea.collectionId))
            .map((idea) => idea);
        const movedIdeaRelocations = movedIdeas.map((idea) => ({
            ideaId: idea.id,
            workspaceId: targetWorkspace.id,
            collectionId: idea.collectionId,
            ideaKind: idea.kind === "project" ? "song" as const : "clip" as const,
            ideaTitle: idea.title,
        }));

        set((currentState) => ({
            workspaces: currentState.workspaces.map((workspace) => {
                if (workspace.id === sourceWorkspace.id && workspace.id === targetWorkspace.id) {
                    const remainingCollections = workspace.collections.filter((collection) => !moveScopeIds.has(collection.id));
                    const remainingIdeas = workspace.ideas.filter((idea) => !moveScopeIds.has(idea.collectionId));
                    return {
                        ...workspace,
                        collections: [...movedCollections, ...remainingCollections],
                        ideas: [...movedIdeas, ...remainingIdeas],
                    };
                }

                if (workspace.id === sourceWorkspace.id) {
                    return {
                        ...workspace,
                        collections: workspace.collections.filter((collection) => !moveScopeIds.has(collection.id)),
                        ideas: workspace.ideas.filter((idea) => !moveScopeIds.has(idea.collectionId)),
                    };
                }

                if (workspace.id === targetWorkspace.id) {
                    return {
                        ...workspace,
                        collections: [...movedCollections, ...workspace.collections],
                        ideas: [...movedIdeas, ...workspace.ideas],
                    };
                }

                return workspace;
            }),
            activityEvents: relocateActivityEvents(currentState.activityEvents, {
                ideas: movedIdeaRelocations,
            }),
            playlists: relocatePlaylists(currentState.playlists, {
                ideas: movedIdeaRelocations,
            }),
        }));

        return { ok: true };
    },

    deleteCollection: (collectionId) => {
        let audioUrisToDelete: string[] = [];
        set((state) => {
            const sourceWorkspace = findWorkspaceWithCollection(state.workspaces, collectionId);
            if (!sourceWorkspace) return state;

            const descendantIds = getCollectionDescendantIds(sourceWorkspace.collections, collectionId);
            const deleteScopeIds = new Set<string>([collectionId, ...descendantIds]);
            const deletedIdeas = sourceWorkspace.ideas.filter((idea) => deleteScopeIds.has(idea.collectionId));
            const deletedIdeaIds = new Set(deletedIdeas.map((idea) => idea.id));
            const deletedClipIds = new Set(
                deletedIdeas.flatMap((idea) => idea.clips.map((clip) => clip.id))
            );
            const nextCollectionLastOpenedAt = { ...state.collectionLastOpenedAt };
            deleteScopeIds.forEach((id) => {
                delete nextCollectionLastOpenedAt[id];
            });
            const nextWorkspaces = state.workspaces.map((workspace) =>
                workspace.id !== sourceWorkspace.id
                    ? workspace
                    : {
                          ...workspace,
                          collections: workspace.collections.filter(
                              (collection) => !deleteScopeIds.has(collection.id)
                          ),
                          ideas: workspace.ideas.filter(
                              (idea) => !deleteScopeIds.has(idea.collectionId)
                          ),
                      }
            );

            audioUrisToDelete = filterUnreferencedManagedAudioUris(
                deletedIdeas.flatMap((idea) => Array.from(collectManagedIdeaAudioUris(idea))),
                nextWorkspaces
            );

            if (countTotalIdeas(nextWorkspaces) === 0) {
                // Deleting the final idea is a valid zero-state transition and must
                // explicitly authorize the persist/manifest guards before they block it.
                authorizeIntentionalEmptyStateWrite(6);
            }

            return {
                ...buildRuntimeCleanupPatch(state, {
                    nextWorkspaces,
                    removedCollectionIds: deleteScopeIds,
                    removedIdeaIds: deletedIdeaIds,
                    removedClipIds: deletedClipIds,
                }),
                workspaces: nextWorkspaces,
                collectionLastOpenedAt: nextCollectionLastOpenedAt,
                activityEvents: state.activityEvents.filter(
                    (event) =>
                        event.workspaceId !== sourceWorkspace.id ||
                        (!deleteScopeIds.has(event.collectionId) && !deletedIdeaIds.has(event.ideaId))
                ),
                playlists: state.playlists.map((playlist) => ({
                    ...playlist,
                    items: playlist.items.filter((item) => !deleteScopeIds.has(item.collectionId)),
                })),
            };
        });
        // Delete managed media only after the store no longer references it so file cleanup
        // cannot race ahead of persisted metadata updates and orphan the library state.
        void deleteManagedAudioUris(audioUrisToDelete);
    },

    toggleIdeaFavorite: (ideaId) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId ? { ...idea, isFavorite: !idea.isFavorite } : idea
                ),
            })),
        }));
    },

    setClipTags: (ideaId, clipId, tags) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              clips: idea.clips.map((clip) =>
                                  clip.id === clipId ? { ...clip, tags } : clip
                              ),
                          }
                        : idea
                ),
            })),
        }));
    },

    addProjectCustomTag: (ideaId, tag) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              customTags: [...(idea.customTags ?? []), tag],
                          }
                        : idea
                ),
            })),
        }));
    },

    removeProjectCustomTag: (ideaId, tagKey) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              customTags: (idea.customTags ?? []).filter((t) => t.key !== tagKey),
                          }
                        : idea
                ),
            })),
        }));
    },

    addGlobalCustomClipTag: (tag) => {
        set((state) => ({
            globalCustomClipTags: [...state.globalCustomClipTags, tag],
        }));
    },

    removeGlobalCustomClipTag: (tagKey) => {
        set((state) => ({
            globalCustomClipTags: state.globalCustomClipTags.filter((t) => t.key !== tagKey),
        }));
    },

    addClipPracticeMarker: (ideaId, clipId, marker) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              clips: idea.clips.map((clip) =>
                                  clip.id === clipId
                                      ? {
                                            ...clip,
                                            practiceMarkers: [...(clip.practiceMarkers ?? []), marker],
                                        }
                                      : clip
                              ),
                          }
                        : idea
                ),
            })),
        }));
    },

    removeClipPracticeMarker: (ideaId, clipId, markerId) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              clips: idea.clips.map((clip) =>
                                  clip.id === clipId
                                      ? {
                                            ...clip,
                                            practiceMarkers: (clip.practiceMarkers ?? []).filter((m) => m.id !== markerId),
                                        }
                                      : clip
                              ),
                          }
                        : idea
                ),
            })),
        }));
    },

    setClipPracticeMarkers: (ideaId, clipId, markers) => {
        set((state) => ({
            workspaces: state.workspaces.map((workspace) => ({
                ...workspace,
                ideas: workspace.ideas.map((idea) =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              clips: idea.clips.map((clip) =>
                                  clip.id === clipId ? { ...clip, practiceMarkers: markers } : clip
                              ),
                          }
                        : idea
                ),
            })),
        }));
    },

    renameIdeaPreservingActivity: (ideaId, nextTitle) => {
        const trimmedTitle = nextTitle.trim();
        if (!trimmedTitle) return;

        set((state) => {
            if (!state.activeWorkspaceId) return state;

            return {
                workspaces: state.workspaces.map((workspace) => {
                    if (workspace.id !== state.activeWorkspaceId) return workspace;
                    return {
                        ...workspace,
                        ideas: workspace.ideas.map((idea) => {
                            if (idea.id !== ideaId) return idea;
                            if (idea.kind === "project") {
                                return { ...idea, title: trimmedTitle };
                            }

                            const primaryClipId = idea.clips[0]?.id ?? null;
                            return {
                                ...idea,
                                title: trimmedTitle,
                                clips: idea.clips.map((clip) =>
                                    clip.id === primaryClipId ? { ...clip, title: trimmedTitle } : clip
                                ),
                            };
                        }),
                    };
                }),
            };
        });
    },

    logIdeaActivity: (ideaId, metric, source, clipId = null) => {
        const state = get();
        const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
        const idea = workspace?.ideas.find((item) => item.id === ideaId);
        if (!workspace || !idea) return;

        get().logActivityEvents([
            {
                at: Date.now(),
                workspaceId: workspace.id,
                collectionId: idea.collectionId,
                ideaId: idea.id,
                ideaKind: idea.kind === "project" ? "song" : "clip",
                ideaTitle: idea.title,
                clipId,
                metric,
                source,
            },
        ]);
    },

    logActivityEvents: (events) => {
        const normalizedEvents = normalizeActivityEvents(
            events.map((event) => ({
                ...event,
                id: buildActivityEventId(),
            }))
        );
        if (normalizedEvents.length === 0) return;

        set((state) => ({
            activityEvents: [...normalizedEvents, ...state.activityEvents].sort((a, b) => b.at - a.at),
        }));
    },

    updateWorkspace: (id, updates) => {
        set((state) => ({
            workspaces: state.workspaces.map((ws) => (ws.id === id ? { ...ws, ...updates } : ws)),
        }));
    },

    deleteWorkspace: (id) => {
        let audioUrisToDelete: string[] = [];
        let archiveUriToDelete: string | undefined;
        set((state) => {
            const removedWorkspace = state.workspaces.find((ws) => ws.id === id);
            if (!removedWorkspace) return state;
            const nextWorkspaces = ensureAtLeastOneActiveWorkspace(
                state.workspaces.filter((ws) => ws.id !== id)
            );
            const nextWorkspaceLastOpenedAt = { ...state.workspaceLastOpenedAt };
            delete nextWorkspaceLastOpenedAt[id];
            const nextCollectionLastOpenedAt = { ...state.collectionLastOpenedAt };
            removedWorkspace.collections.forEach((collection) => {
                delete nextCollectionLastOpenedAt[collection.id];
            });

            const removedIdeaIds = new Set(removedWorkspace.ideas.map((idea) => idea.id));
            const removedClipIds = new Set(
                removedWorkspace.ideas.flatMap((idea) => idea.clips.map((clip) => clip.id))
            );
            audioUrisToDelete = filterUnreferencedManagedAudioUris(
                collectManagedWorkspaceAudioUris(removedWorkspace),
                nextWorkspaces
            );
            archiveUriToDelete = removedWorkspace.archiveState?.archiveUri;

            if (countTotalIdeas(nextWorkspaces) === 0) {
                // Workspace deletion can legitimately remove the last remaining idea.
                authorizeIntentionalEmptyStateWrite(6);
            }

            return {
                ...buildRuntimeCleanupPatch(state, {
                    nextWorkspaces,
                    removedWorkspaceIds: [id],
                    removedCollectionIds: removedWorkspace.collections.map((collection) => collection.id),
                    removedIdeaIds,
                    removedClipIds,
                }),
                workspaces: nextWorkspaces,
                workspaceLastOpenedAt: nextWorkspaceLastOpenedAt,
                collectionLastOpenedAt: nextCollectionLastOpenedAt,
                activityEvents: state.activityEvents.filter((event) => event.workspaceId !== id),
                playlists: state.playlists.map((playlist) => ({
                    ...playlist,
                    items: playlist.items.filter((item) => item.workspaceId !== id),
                })),
            };
        });
        // Best-effort storage cleanup happens after references are removed from persisted state.
        void Promise.all([
            deleteManagedAudioUris(audioUrisToDelete),
            deleteManagedArchiveUri(archiveUriToDelete),
        ]);
    },

    archiveWorkspace: (id, isArchived) => {
        set((state) => {
            const spaces = state.workspaces.map((ws) => (ws.id === id ? { ...ws, isArchived } : ws));
            // if we archive the active one, pick the first active one
            let activeId = state.activeWorkspaceId;
            if (id === activeId && isArchived) {
                activeId = spaces.find((w) => !w.isArchived)?.id ?? null;
            }
            const fallbackWorkspaceId = spaces.find((workspace) => !workspace.isArchived)?.id ?? null;
            return {
                workspaces: spaces,
                activeWorkspaceId: activeId,
                primaryWorkspaceId:
                    isArchived && state.primaryWorkspaceId === id ? null : state.primaryWorkspaceId,
                lastUsedWorkspaceId:
                    isArchived && state.lastUsedWorkspaceId === id
                        ? fallbackWorkspaceId
                        : state.lastUsedWorkspaceId,
            };
        });
    },

    ideasFilter: "all",
    setIdeasFilter: (v) => set({ ideasFilter: v }),
    ideasSort: "newest",
    setIdeasSort: (v) => set({ ideasSort: v }),

    primaryFilter: "all",
    setPrimaryFilter: (v) => set({ primaryFilter: v }),
    primarySort: "newest",
    setPrimarySort: (v) => set({ primarySort: v }),
    setIdeasHidden: (collectionId, ideaIds, hidden) => {
        const nextIdeaIds = Array.from(new Set(ideaIds));
        if (nextIdeaIds.length === 0) return;

        set((state) => {
            if (!state.activeWorkspaceId) return state;
            const hideIdSet = new Set(nextIdeaIds);

            return {
                workspaces: state.workspaces.map((workspace) => {
                    if (workspace.id !== state.activeWorkspaceId) return workspace;
                    const collectionIdeas = workspace.ideas.filter((idea) => idea.collectionId === collectionId);

                    return {
                        ...workspace,
                        collections: workspace.collections.map((collection) => {
                            if (collection.id !== collectionId) return collection;
                            const prevState = normalizeWorkspaceIdeasListState(collection.ideasListState, collectionIdeas);
                            const hiddenIdeaIds = hidden
                                ? Array.from(new Set([...prevState.hiddenIdeaIds, ...nextIdeaIds]))
                                : prevState.hiddenIdeaIds.filter((id) => !hideIdSet.has(id));
                            return {
                                ...collection,
                                ideasListState: {
                                    ...prevState,
                                    hiddenIdeaIds,
                                },
                            };
                        }),
                    };
                }),
            };
        });
    },
    setTimelineDaysHidden: (collectionId, days, hidden) => {
        const nextDays = days.filter(
            (day): day is IdeasHiddenDay =>
                !!day &&
                (day.metric === "created" || day.metric === "updated") &&
                Number.isFinite(day.dayStartTs)
        );
        if (nextDays.length === 0) return;

        set((state) => {
            if (!state.activeWorkspaceId) return state;
            const dayKeySet = new Set(nextDays.map((day) => `${day.metric}:${day.dayStartTs}`));

            return {
                workspaces: state.workspaces.map((workspace) => {
                    if (workspace.id !== state.activeWorkspaceId) return workspace;
                    const collectionIdeas = workspace.ideas.filter((idea) => idea.collectionId === collectionId);

                    return {
                        ...workspace,
                        collections: workspace.collections.map((collection) => {
                            if (collection.id !== collectionId) return collection;
                            const prevState = normalizeWorkspaceIdeasListState(collection.ideasListState, collectionIdeas);
                            const hiddenDayMap = new Map<string, IdeasHiddenDay>(
                                prevState.hiddenDays.map((day) => [`${day.metric}:${day.dayStartTs}`, day] as const)
                            );

                            if (hidden) {
                                for (const day of nextDays) {
                                    hiddenDayMap.set(`${day.metric}:${day.dayStartTs}`, day);
                                }
                            } else {
                                for (const key of dayKeySet) {
                                    hiddenDayMap.delete(key);
                                }
                            }

                            return {
                                ...collection,
                                ideasListState: {
                                    ...prevState,
                                    hiddenDays: Array.from(hiddenDayMap.values()),
                                },
                            };
                        }),
                    };
                }),
            };
        });
    },

    setClipManualSortOrder: (ideaId, orderedClipIds) => {
        set((state) => {
            const { activeWorkspaceId, workspaces } = state;
            if (!activeWorkspaceId) return state;
            const orderMap = new Map(orderedClipIds.map((id, index) => [id, index]));
            return {
                workspaces: workspaces.map((ws) =>
                    ws.id !== activeWorkspaceId
                        ? ws
                        : {
                              ...ws,
                              ideas: ws.ideas.map((idea) =>
                                  idea.id !== ideaId
                                      ? idea
                                      : {
                                            ...idea,
                                            clips: idea.clips.map((clip) =>
                                                orderMap.has(clip.id)
                                                    ? { ...clip, manualSortOrder: orderMap.get(clip.id)! }
                                                    : clip
                                            ),
                                        }
                              ),
                          }
                ),
            };
        });
    },

    updateIdeas: (updater) => {
        set((state) => {
            const { activeWorkspaceId, workspaces } = state;
            if (!activeWorkspaceId) return state;

            const now = Date.now();
            return {
                workspaces: workspaces.map((ws) =>
                    ws.id === activeWorkspaceId
                        ? (() => {
                            const prevIdeas = ws.ideas;
                            const prevIdeaMap = new Map(prevIdeas.map((idea) => [idea.id, idea]));
                            const normalizedNextIdeas = normalizeIdeas(updater(prevIdeas)).map((idea) => {
                                const prevIdea = prevIdeaMap.get(idea.id);
                                if (!prevIdea) return idea;
                                if (idea === prevIdea) return idea;
                                if (idea.kind !== "project") return idea;
                                if (idea.lastActivityAt > prevIdea.lastActivityAt) return idea;
                                return { ...idea, lastActivityAt: now };
                            });

                            return {
                                ...ws,
                                ideas: normalizedNextIdeas,
                                collections: ws.collections.map((collection) => ({
                                    ...collection,
                                    ideasListState: normalizeWorkspaceIdeasListState(
                                        collection.ideasListState,
                                        normalizedNextIdeas.filter((idea) => idea.collectionId === collection.id)
                                    ),
                                })),
                            };
                        })()
                        : ws
                ),
            };
        });
    },

    addIdea: (title, collectionId) => {
        const id = `idea-${Date.now()}`;
        const now = Date.now();
        const newProject: SongIdea = {
            id,
            title,
            notes: "",
            status: "seed",
            completionPct: 0,
            kind: "project",
            collectionId,
            clips: [],
            lyrics: createEmptyProjectLyrics(),
            createdAt: now,
            lastActivityAt: now,
            isDraft: true,
        };
        get().updateIdeas((p) => [newProject, ...p]);
        get().markRecentlyAdded([id]);
        return id; // Return ID so caller can select it
    },

    quickRecordIdea: (title, collectionId) => {
        const id = `idea-${Date.now()}`;
        const now = Date.now();
        get().updateIdeas((p) => [
            {
                id,
                title,
                notes: "",
                status: "clip",
                completionPct: 0,
                kind: "clip",
                collectionId,
                clips: [],
                createdAt: now,
                lastActivityAt: now,
            },
            ...p,
        ]);
        get().markRecentlyAdded([id]);
        return id;
    },

    addClipVersion: (targetIdeaId, override) => {
        const state = get();
        const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
        if (!activeWs) return;

        const targetIdea = activeWs.ideas.find((x) => x.id === targetIdeaId);
        if (!targetIdea) return;
        const parentClip = override?.parentClipId
            ? targetIdea.clips.find((clip) => clip.id === override.parentClipId) ?? null
            : null;

        const title = genClipTitle(targetIdea.title, targetIdea.clips.length + 1);

        const clip: ClipVersion = {
            id: `clip-${Date.now()}`,
            title,
            notes: "",
            createdAt: Date.now(),
            isPrimary: targetIdea.clips.length === 0,
            parentClipId: override?.parentClipId,
            audioUri: override?.audioUri,
            durationMs: override?.durationMs,
            waveformPeaks: override?.waveformPeaks,
            tags: parentClip?.tags?.length ? [...parentClip.tags] : undefined,
        };

        get().updateIdeas((p) =>
            p.map((i) => {
                if (i.id !== targetIdeaId) return i;
                return { ...i, clips: [clip, ...i.clips] };
            })
        );
        get().markRecentlyAdded([clip.id]);
    },

    addPlaylist: (title) => {
        const now = Date.now();
        const playlistId = buildPlaylistId();
        const nextPlaylist: Playlist = {
            id: playlistId,
            title: title.trim() || "Untitled Playlist",
            createdAt: now,
            updatedAt: now,
            items: [],
        };

        set((state) => ({
            playlists: [nextPlaylist, ...state.playlists],
        }));

        return playlistId;
    },

    addItemsToPlaylist: (playlistId, items) => {
        if (items.length === 0) return;
        set((state) => {
            const now = Date.now();
            return {
                playlists: state.playlists.map((playlist) =>
                    playlist.id !== playlistId
                        ? playlist
                        : {
                            ...playlist,
                            updatedAt: now,
                            items: [
                                ...playlist.items,
                                ...items.map((item, index) => ({
                                    ...item,
                                    id: `${buildPlaylistItemId()}-${index}`,
                                    addedAt: now + index,
                                })),
                            ],
                        }
                ),
            };
        });
    },

    reorderPlaylistItems: (playlistId, orderedItemIds) => {
        set((state) => ({
            playlists: state.playlists.map((playlist) => {
                if (playlist.id !== playlistId) return playlist;
                const itemMap = new Map(playlist.items.map((item) => [item.id, item]));
                const nextItems = orderedItemIds
                    .map((itemId) => itemMap.get(itemId) ?? null)
                    .filter((item): item is PlaylistItem => !!item);

                if (nextItems.length !== playlist.items.length) {
                    const seenIds = new Set(nextItems.map((item) => item.id));
                    playlist.items.forEach((item) => {
                        if (!seenIds.has(item.id)) {
                            nextItems.push(item);
                        }
                    });
                }

                return {
                    ...playlist,
                    updatedAt: Date.now(),
                    items: nextItems,
                };
            }),
        }));
    },

    removePlaylistItem: (playlistId, playlistItemId) => {
        set((state) => ({
            playlists: state.playlists.map((playlist) =>
                playlist.id !== playlistId
                    ? playlist
                    : {
                        ...playlist,
                        updatedAt: Date.now(),
                        items: playlist.items.filter((item) => item.id !== playlistItemId),
                    }
            ),
        }));
    },

    deleteIdea: (ideaId) => {
        let audioUrisToDelete: string[] = [];
        set((state) => {
            let removedIdea: SongIdea | undefined;
            const nextWorkspaces = state.workspaces.map((workspace) => {
                const nextIdeas = workspace.ideas.filter((idea) => {
                    if (idea.id === ideaId) {
                        removedIdea = idea;
                        return false;
                    }
                    return true;
                });
                if (nextIdeas.length === workspace.ideas.length) {
                    return workspace;
                }
                return normalizeWorkspaceCollectionVisibility({
                    ...workspace,
                    ideas: nextIdeas,
                });
            });

            if (!removedIdea) {
                return state;
            }
            const removedIdeaSnapshot = removedIdea;

            const removedClipIds = new Set(
                removedIdeaSnapshot.clips.map((clip: ClipVersion) => clip.id)
            );
            audioUrisToDelete = filterUnreferencedManagedAudioUris(
                collectManagedIdeaAudioUris(removedIdeaSnapshot),
                nextWorkspaces
            );

            if (countTotalIdeas(nextWorkspaces) === 0) {
                // This explicitly preserves the intentional "delete my final idea" case.
                authorizeIntentionalEmptyStateWrite(6);
            }

            return {
                ...buildRuntimeCleanupPatch(state, {
                    nextWorkspaces,
                    removedIdeaIds: [ideaId],
                    removedClipIds,
                }),
                workspaces: nextWorkspaces,
                activityEvents: state.activityEvents.filter((event) => event.ideaId !== ideaId),
                playlists: state.playlists.map((playlist) => ({
                    ...playlist,
                    items: playlist.items.filter((item) => item.ideaId !== ideaId),
                })),
            };
        });
        // Keep file deletion behind state mutation so a crash cannot erase media before the
        // persisted model forgets the idea.
        void deleteManagedAudioUris(audioUrisToDelete);
    },
});

export { normalizeActivityEvents };
