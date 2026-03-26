import {
    IdeaStatus,
    SongIdea,
    ClipVersion,
    Workspace,
    Collection,
    EditRegion,
    PracticeMarker,
    CustomTagDefinition,
} from "../types";
import { useStore } from "./useStore";
import { createEmptyProjectLyrics, createEmptyWorkspaceIdeasListState } from "./dataSlice";
import { createLyricsVersion, lyricsTextToDocument } from "../lyrics";
import { buildDefaultIdeaTitle, ensureUniqueCountedTitle, ensureUniqueIdeaTitle } from "../utils";
import { archiveWorkspaceToDevice, restoreWorkspaceFromDevice } from "../services/workspaceArchive";
import { findOrphanedAudioFiles, enrichOrphanedClips, buildRecoveredIdeas, findWorkspaceArchives, restoreWorkspaceFromArchive, restoreFromManifest } from "../services/audioRecovery";
import { forceManifestWrite } from "../services/manifestSync";
import { buildPersistedAppStoreSnapshot } from "./useStore";
import { buildRuntimeCleanupPatch } from "./runtimeCleanup";
import {
    collectManagedIdeaAudioUris,
    deleteManagedArchiveUri,
    deleteManagedAudioUris,
    filterUnreferencedManagedAudioUris,
} from "../services/managedMedia";
import {
    clearPendingWorkspaceArchiveOperation,
    upsertPendingWorkspaceArchiveOperation,
} from "../services/workspaceArchiveRecovery";
import { authorizeIntentionalEmptyStateWrite } from "../services/stateIntegrity";
import { relocateActivityEvents, relocatePlaylists } from "./relocationMetadata";

function buildEntityId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildIdeaId() {
    return buildEntityId("idea");
}

function buildClipId() {
    return buildEntityId("clip");
}

function buildCollectionId() {
    return buildEntityId("col");
}

function buildLyricsVersionId() {
    return buildEntityId("lyrics-version");
}

function buildLyricsLineId() {
    return buildEntityId("line");
}

function buildChordPlacementId() {
    return buildEntityId("chord");
}

function cloneClipTags(tags?: string[]) {
    return tags?.length ? [...tags] : undefined;
}

function cloneWaveformPeaks(waveformPeaks?: number[]) {
    return waveformPeaks?.length ? [...waveformPeaks] : undefined;
}

function cloneEditRegions(editRegions?: EditRegion[]) {
    return editRegions?.map((region) => ({ ...region }));
}

function clonePracticeMarkers(practiceMarkers?: PracticeMarker[]) {
    return practiceMarkers?.map((marker) => ({ ...marker }));
}

function cloneCustomTags(customTags?: CustomTagDefinition[]) {
    return customTags?.map((tag) => ({ ...tag }));
}

type ClipTransferSource = {
    clip: ClipVersion;
    sourceIdea?: SongIdea | null;
};

function buildTransferredClip(source: ClipTransferSource) {
    const standaloneIdea = source.sourceIdea?.kind === "clip" ? source.sourceIdea : null;

    return {
        ...source.clip,
        title: standaloneIdea?.title || source.clip.title,
        notes: source.clip.notes || standaloneIdea?.notes || "",
        importedAt: source.clip.importedAt ?? standaloneIdea?.importedAt,
        sourceCreatedAt: source.clip.sourceCreatedAt ?? standaloneIdea?.sourceCreatedAt,
        waveformPeaks: cloneWaveformPeaks(source.clip.waveformPeaks),
        editRegions: cloneEditRegions(source.clip.editRegions),
        tags: cloneClipTags(source.clip.tags),
        practiceMarkers: clonePracticeMarkers(source.clip.practiceMarkers),
    };
}

function cloneClipForCopy(
    source: ClipTransferSource,
    createdAt: number,
    isPrimary: boolean,
    options?: {
        nextId?: string;
        parentIdMap?: Map<string, string>;
        keepExternalParentIds?: boolean;
    }
) {
    const clip = buildTransferredClip(source);
    const originalParentId = clip.parentClipId;
    let nextParentId: string | undefined;

    if (originalParentId) {
        nextParentId = options?.parentIdMap?.get(originalParentId);
        if (!nextParentId && options?.keepExternalParentIds) {
            nextParentId = originalParentId;
        }
    }

    return {
        ...clip,
        id: options?.nextId ?? buildClipId(),
        createdAt,
        isPrimary,
        parentClipId: nextParentId,
    };
}

function cloneProjectClipsForCopy(clips: ClipVersion[], createdAt: number) {
    const nextIdBySourceId = new Map(
        clips.map((clip) => [clip.id, buildClipId()] as const)
    );

    return clips.map((clip, index) =>
        cloneClipForCopy({ clip }, createdAt + index, clip.isPrimary, {
            nextId: nextIdBySourceId.get(clip.id),
            parentIdMap: nextIdBySourceId,
        })
    );
}

function cloneLyricsForCopy(lyrics: SongIdea["lyrics"], baseTime: number) {
    if (!lyrics) return undefined;

    return {
        versions: lyrics.versions.map((version, versionIndex) => {
            const versionTime = baseTime + versionIndex;
            return {
                ...version,
                id: buildLyricsVersionId(),
                createdAt: versionTime,
                updatedAt: versionTime,
                document: {
                    lines: version.document.lines.map((line) => ({
                        ...line,
                        id: buildLyricsLineId(),
                        chords: line.chords.map((chord) => ({
                            ...chord,
                            id: buildChordPlacementId(),
                        })),
                    })),
                },
            };
        }),
    };
}

function cloneIdeaForCopy(idea: SongIdea, collectionId: string): SongIdea {
    const now = Date.now();

    if (idea.kind === "project") {
        return {
            ...idea,
            id: buildIdeaId(),
            collectionId,
            createdAt: now,
            lastActivityAt: now,
            clips: cloneProjectClipsForCopy(idea.clips, now),
            lyrics: cloneLyricsForCopy(idea.lyrics, now),
            customTags: cloneCustomTags(idea.customTags),
        };
    }

    const sourceClip = idea.clips[0];
    return {
        ...idea,
        id: buildIdeaId(),
        collectionId,
        createdAt: now,
        lastActivityAt: now,
        clips: sourceClip ? [cloneClipForCopy({ clip: sourceClip, sourceIdea: idea }, now, true)] : [],
    };
}

function createStandaloneClipIdeaFromMove(source: ClipTransferSource, collectionId: string): SongIdea {
    const clip = buildTransferredClip(source);
    const standaloneIdea = source.sourceIdea?.kind === "clip" ? source.sourceIdea : null;

    return {
        id: clip.id,
        title: standaloneIdea?.title || clip.title,
        notes: standaloneIdea?.notes || clip.notes || "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId,
        createdAt: standaloneIdea?.createdAt ?? clip.createdAt,
        importedAt: standaloneIdea?.importedAt ?? clip.importedAt,
        sourceCreatedAt: standaloneIdea?.sourceCreatedAt ?? clip.sourceCreatedAt,
        lastActivityAt: standaloneIdea?.lastActivityAt ?? clip.createdAt,
        clips: [{ ...clip, isPrimary: true, parentClipId: undefined }],
    };
}

function createStandaloneClipIdeaFromCopy(source: ClipTransferSource, collectionId: string): SongIdea {
    const now = Date.now();
    const clip = buildTransferredClip(source);
    const standaloneIdea = source.sourceIdea?.kind === "clip" ? source.sourceIdea : null;

    return {
        id: buildIdeaId(),
        title: standaloneIdea?.title || clip.title,
        notes: standaloneIdea?.notes || clip.notes || "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId,
        createdAt: now,
        importedAt: standaloneIdea?.importedAt ?? clip.importedAt,
        sourceCreatedAt: standaloneIdea?.sourceCreatedAt ?? clip.sourceCreatedAt,
        lastActivityAt: now,
        clips: [cloneClipForCopy({ clip, sourceIdea: source.sourceIdea }, now, true)],
    };
}

function ensurePrimaryClip(clips: ClipVersion[]) {
    if (clips.length > 0 && !clips.some((clip) => clip.isPrimary)) {
        clips[0] = { ...clips[0], isPrimary: true };
    }
    return clips;
}

function repairDanglingClipParents(clips: ClipVersion[], removedClipIds: Iterable<string>) {
    const removedSet = new Set(removedClipIds);

    return clips.map((clip) =>
        clip.parentClipId && removedSet.has(clip.parentClipId)
            ? { ...clip, parentClipId: undefined }
            : clip
    );
}

function remapClipParentsForTarget(
    clips: ClipVersion[],
    allowedParentIds: Set<string>,
    parentIdMap?: Map<string, string>
) {
    return clips.map((clip) => {
        const originalParentId = clip.parentClipId;
        if (!originalParentId) {
            return clip;
        }

        const remappedParentId = parentIdMap?.get(originalParentId);
        if (remappedParentId) {
            return remappedParentId === originalParentId
                ? clip
                : { ...clip, parentClipId: remappedParentId };
        }

        if (allowedParentIds.has(originalParentId)) {
            return clip;
        }

        return { ...clip, parentClipId: undefined };
    });
}

function normalizeWorkspaceCollectionVisibility<T extends { collections: Array<{ id: string; ideasListState: { hiddenIdeaIds: string[]; hiddenDays: any[] } }>; ideas: SongIdea[] }>(
    workspace: T
): T {
    return {
        ...workspace,
        collections: workspace.collections.map((collection) => {
            const visibleIdeaIds = new Set(
                workspace.ideas
                    .filter((idea) => idea.collectionId === collection.id)
                    .map((idea) => idea.id)
            );

            return {
                ...collection,
                ideasListState: {
                    ...collection.ideasListState,
                    hiddenIdeaIds: collection.ideasListState.hiddenIdeaIds.filter((ideaId) =>
                        visibleIdeaIds.has(ideaId)
                    ),
                },
            };
        }),
    };
}

function buildIdeaRelocation(idea: SongIdea, workspaceId: string, collectionId = idea.collectionId) {
    return {
        ideaId: idea.id,
        workspaceId,
        collectionId,
        ideaKind: idea.kind === "project" ? "song" as const : "clip" as const,
        ideaTitle: idea.title,
    };
}

function buildClipRelocation(
    clip: ClipVersion,
    idea: SongIdea,
    workspaceId: string,
    collectionId = idea.collectionId
) {
    return {
        clipId: clip.id,
        ...buildIdeaRelocation(idea, workspaceId, collectionId),
    };
}

function getFirstActiveWorkspaceId(workspaces: Workspace[], excludedWorkspaceId?: string) {
    return (
        workspaces.find((workspace) => !workspace.isArchived && workspace.id !== excludedWorkspaceId)?.id ?? null
    );
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

async function persistCurrentStoreSnapshot() {
    // Force the manifest/shadow snapshot after critical storage transitions so a crash cannot
    // leave disk files and persisted metadata describing different realities.
    await forceManifestWrite(buildPersistedAppStoreSnapshot(useStore.getState()));
}

function buildWorkspaceArchivalState(
    store: ReturnType<typeof useStore.getState>,
    archivedWorkspace: Workspace
) {
    const archivedIdeaIdSet = new Set(archivedWorkspace.ideas.map((idea) => idea.id));
    const workspaceId = archivedWorkspace.id;
    const selectedIdeaInWorkspace =
        !!store.selectedIdeaId && archivedIdeaIdSet.has(store.selectedIdeaId);
    const editingIdeaInWorkspace =
        !!store.editingIdeaId && archivedIdeaIdSet.has(store.editingIdeaId);
    const recordingIdeaInWorkspace =
        !!store.recordingIdeaId && archivedIdeaIdSet.has(store.recordingIdeaId);
    const quickNamingIdeaInWorkspace =
        !!store.quickNamingIdeaId && archivedIdeaIdSet.has(store.quickNamingIdeaId);
    const playerQueueTouchesWorkspace =
        store.playerQueue.some((item) => archivedIdeaIdSet.has(item.ideaId)) ||
        (!!store.playerTarget && archivedIdeaIdSet.has(store.playerTarget.ideaId));
    const inlineInWorkspace =
        !!store.inlineTarget && archivedIdeaIdSet.has(store.inlineTarget.ideaId);
    const selectedListIdeaIds = store.selectedListIdeaIds.filter((ideaId) => !archivedIdeaIdSet.has(ideaId));
    const clipClipboard = store.clipClipboard?.sourceWorkspaceId === workspaceId ? null : store.clipClipboard;
    const workspaces = store.workspaces.map((workspace) =>
        workspace.id === workspaceId ? archivedWorkspace : workspace
    );

    return {
        workspaces,
        activeWorkspaceId:
            store.activeWorkspaceId === workspaceId
                ? getFirstActiveWorkspaceId(workspaces, workspaceId)
                : store.activeWorkspaceId,
        selectedIdeaId: selectedIdeaInWorkspace ? null : store.selectedIdeaId,
        editingIdeaId: editingIdeaInWorkspace ? null : store.editingIdeaId,
        pendingPrimaryClipId:
            selectedIdeaInWorkspace || editingIdeaInWorkspace ? null : store.pendingPrimaryClipId,
        clipSelectionMode: selectedIdeaInWorkspace ? false : store.clipSelectionMode,
        selectedClipIds: selectedIdeaInWorkspace ? [] : store.selectedClipIds,
        listSelectionMode: selectedListIdeaIds.length > 0 ? store.listSelectionMode : false,
        selectedListIdeaIds,
        clipClipboard,
        movingClipId: selectedIdeaInWorkspace ? null : store.movingClipId,
        playerTarget: playerQueueTouchesWorkspace ? null : store.playerTarget,
        playerQueue: playerQueueTouchesWorkspace ? [] : store.playerQueue,
        playerQueueIndex: playerQueueTouchesWorkspace ? 0 : store.playerQueueIndex,
        playerShouldAutoplay: playerQueueTouchesWorkspace ? false : store.playerShouldAutoplay,
        playerPositionMs: playerQueueTouchesWorkspace ? 0 : store.playerPositionMs,
        playerDurationMs: playerQueueTouchesWorkspace ? 0 : store.playerDurationMs,
        playerIsPlaying: playerQueueTouchesWorkspace ? false : store.playerIsPlaying,
        inlineTarget: inlineInWorkspace ? null : store.inlineTarget,
        inlinePositionMs: inlineInWorkspace ? 0 : store.inlinePositionMs,
        inlineDurationMs: inlineInWorkspace ? 0 : store.inlineDurationMs,
        inlineIsPlaying: inlineInWorkspace ? false : store.inlineIsPlaying,
        recordingIdeaId: recordingIdeaInWorkspace ? null : store.recordingIdeaId,
        recordingParentClipId: recordingIdeaInWorkspace ? null : store.recordingParentClipId,
        quickNamingIdeaId: quickNamingIdeaInWorkspace ? null : store.quickNamingIdeaId,
        quickNameModalVisible: quickNamingIdeaInWorkspace ? false : store.quickNameModalVisible,
    };
}

export const appActions = {
    addIdea: (collectionId: string) => {
        const state = useStore.getState();
        const activeWs = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
        const fallbackTitle = ensureUniqueIdeaTitle(
            buildDefaultIdeaTitle(),
            activeWs?.ideas.map((idea) => idea.title) ?? []
        );
        const createdId = state.addIdea(fallbackTitle, collectionId);

        if (!activeWs) return;

        state.setSelectedIdeaId(createdId);
        state.setEditingIdeaId(createdId);
        state.setPendingPrimaryClipId(null);
        return createdId;
    },

    quickRecordIdea: (collectionId: string) => {
        const state = useStore.getState();
        const activeWs = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
        const fallbackTitle = ensureUniqueIdeaTitle(
            buildDefaultIdeaTitle(),
            activeWs?.ideas.map((idea) => idea.title) ?? []
        );
        const createdId = state.quickRecordIdea(fallbackTitle, collectionId);
        state.setRecordingIdeaId(createdId);
    },

    importClipToCollection: (
        collectionId: string,
        payload: {
            title: string;
            audioUri: string;
            durationMs?: number;
            waveformPeaks?: number[];
            createdAt?: number;
            importedAt?: number;
            sourceCreatedAt?: number;
        }
    ) => {
        const state = useStore.getState();
        const targetWorkspace = state.workspaces.find((workspace) =>
            workspace.collections.some((collection) => collection.id === collectionId)
        );
        if (!targetWorkspace) {
            throw new Error("Target collection not found.");
        }
        const ideaId = buildIdeaId();
        const clipId = buildClipId();
        const importedAt = payload.importedAt ?? Date.now();
        const createdAt = payload.createdAt ?? importedAt;

        const importedIdea: SongIdea = {
            id: ideaId,
            title: payload.title,
            notes: "",
            status: "clip",
            completionPct: 0,
            kind: "clip",
            collectionId,
            createdAt,
            importedAt,
            sourceCreatedAt: payload.sourceCreatedAt,
            lastActivityAt: importedAt,
            clips: [
                {
                    id: clipId,
                    title: payload.title,
                    notes: "",
                    createdAt,
                    importedAt,
                    sourceCreatedAt: payload.sourceCreatedAt,
                    isPrimary: true,
                    audioUri: payload.audioUri,
                    durationMs: payload.durationMs,
                    waveformPeaks: payload.waveformPeaks,
                },
            ],
        };

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) =>
                workspace.id === targetWorkspace.id
                    ? { ...workspace, ideas: [importedIdea, ...workspace.ideas] }
                    : workspace
            ),
        }));
        state.logActivityEvents([
            {
                at: createdAt,
                workspaceId: targetWorkspace.id,
                collectionId,
                ideaId,
                ideaKind: "clip",
                ideaTitle: importedIdea.title,
                clipId,
                metric: "created",
                source: "import",
            },
        ]);
        state.markRecentlyAdded([ideaId]);
        return { ideaId, clipId };
    },

    importProjectToCollection: (
        collectionId: string,
        payload: {
            title: string;
            createdAt?: number;
            importedAt?: number;
            sourceCreatedAt?: number;
            clips: Array<{
                title: string;
                audioUri: string;
                durationMs?: number;
                waveformPeaks?: number[];
                createdAt?: number;
                importedAt?: number;
                sourceCreatedAt?: number;
            }>;
        }
    ) => {
        const state = useStore.getState();
        const targetWorkspace = state.workspaces.find((workspace) =>
            workspace.collections.some((collection) => collection.id === collectionId)
        );
        if (!targetWorkspace) {
            throw new Error("Target collection not found.");
        }
        if (payload.clips.length === 0) {
            throw new Error("No imported audio available for this song.");
        }

        const importedAt = payload.importedAt ?? Date.now();
        const createdAt = payload.createdAt ?? importedAt;
        const ideaId = buildIdeaId();
        const projectTitle = ensureUniqueIdeaTitle(
            payload.title,
            targetWorkspace.ideas.map((idea) => idea.title)
        );
        const clips = payload.clips.map((clip, index) => ({
            id: buildClipId(),
            title: clip.title,
            notes: "",
            createdAt: clip.createdAt ?? createdAt + index,
            importedAt: clip.importedAt ?? importedAt,
            sourceCreatedAt: clip.sourceCreatedAt,
            isPrimary: index === 0,
            audioUri: clip.audioUri,
            durationMs: clip.durationMs,
            waveformPeaks: clip.waveformPeaks,
        }));

        const importedIdea: SongIdea = {
            id: ideaId,
            title: projectTitle,
            notes: "",
            status: "seed",
            completionPct: 0,
            kind: "project",
            collectionId,
            createdAt,
            importedAt,
            sourceCreatedAt: payload.sourceCreatedAt,
            lastActivityAt: importedAt,
            clips,
            lyrics: createEmptyProjectLyrics(),
        };

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) =>
                workspace.id === targetWorkspace.id
                    ? { ...workspace, ideas: [importedIdea, ...workspace.ideas] }
                    : workspace
            ),
        }));
        state.logActivityEvents([
            {
                at: createdAt,
                workspaceId: targetWorkspace.id,
                collectionId,
                ideaId,
                ideaKind: "song",
                ideaTitle: importedIdea.title,
                clipId: clips[0]?.id ?? null,
                metric: "created",
                source: "import",
            },
        ]);
        state.markRecentlyAdded([ideaId]);
        return { ideaId, clipIds: clips.map((clip) => clip.id) };
    },

    importClipToProject: (
        projectId: string,
        payload: {
            title: string;
            audioUri: string;
            durationMs?: number;
            waveformPeaks?: number[];
            isPrimary?: boolean;
            createdAt?: number;
            importedAt?: number;
            sourceCreatedAt?: number;
        }
    ) => {
        const state = useStore.getState();
        const clipId = buildClipId();
        const importedAt = payload.importedAt ?? Date.now();
        const createdAt = payload.createdAt ?? importedAt;

        state.updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== projectId) return idea;

                const nextClips = payload.isPrimary
                    ? idea.clips.map((clip) => ({ ...clip, isPrimary: false }))
                    : idea.clips;

                const importedClip: ClipVersion = {
                    id: clipId,
                    title: payload.title,
                    notes: "",
                    createdAt,
                    importedAt,
                    sourceCreatedAt: payload.sourceCreatedAt,
                    isPrimary: payload.isPrimary ? true : nextClips.length === 0,
                    audioUri: payload.audioUri,
                    durationMs: payload.durationMs,
                    waveformPeaks: payload.waveformPeaks,
                };

                return {
                    ...idea,
                    clips: [importedClip, ...nextClips],
                };
            })
        );
        state.logIdeaActivity(projectId, "updated", "import", clipId);
        state.markRecentlyAdded([clipId]);
        return clipId;
    },

    hydrateClipAudioMetadata: (
        workspaceId: string,
        ideaId: string,
        clipId: string,
        payload: { durationMs?: number; waveformPeaks?: number[] }
    ) => {
        if (!payload.durationMs && !payload.waveformPeaks?.length) return;

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (workspace.id !== workspaceId) return workspace;

                return {
                    ...workspace,
                    ideas: workspace.ideas.map((idea) => {
                        if (idea.id !== ideaId) return idea;

                        return {
                            ...idea,
                            clips: idea.clips.map((clip) =>
                                clip.id !== clipId
                                    ? clip
                                    : {
                                          ...clip,
                                          durationMs: payload.durationMs ?? clip.durationMs,
                                          waveformPeaks: payload.waveformPeaks?.length ? payload.waveformPeaks : clip.waveformPeaks,
                                      }
                            ),
                        };
                    }),
                };
            }),
        }));
    },

    saveEditIdea: (id: string, nextTitle: string) => {
        const state = useStore.getState();
        state.renameIdeaPreservingActivity(id, nextTitle);
        state.setEditingIdeaId(null);
    },

    reorderClipsInSelectedIdea: (clips: ClipVersion[]) => {
        const state = useStore.getState();
        if (!state.selectedIdeaId) return;
        state.updateIdeas((prev) => prev.map((i) => (i.id === state.selectedIdeaId ? { ...i, clips } : i)));
    },

    markBestClip: (clipId: string) => {
        const state = useStore.getState();
        if (!state.selectedIdeaId) return;
        state.updateIdeas((p) =>
            p.map((i) =>
                i.id !== state.selectedIdeaId
                    ? i
                    : { ...i, clips: i.clips.map((c) => ({ ...c, isPrimary: c.id === clipId })) }
            )
        );
    },

    setIdeaStatus: (status: IdeaStatus) => {
        const state = useStore.getState();
        const selectedIdea = state.workspaces.find(w => w.id === state.activeWorkspaceId)?.ideas.find(i => i.id === state.selectedIdeaId);
        if (!selectedIdea || selectedIdea.kind !== "project") return;

        let completionPct = 0;
        if (status === "song") completionPct = 75;
        if (status === "semi") completionPct = 50;
        if (status === "sprout") completionPct = 25;

        state.updateIdeas((prev) => prev.map((i) => (i.id === selectedIdea.id ? { ...i, status, completionPct } : i)));
    },

    setIdeaCompletion: (completionPct: number) => {
        const state = useStore.getState();
        const selectedIdea = state.workspaces.find(w => w.id === state.activeWorkspaceId)?.ideas.find(i => i.id === state.selectedIdeaId);
        if (!selectedIdea || selectedIdea.kind !== "project") return;

        const stepped = Math.max(0, Math.min(100, Math.round(completionPct / 5) * 5));
        let status: IdeaStatus = "seed";
        if (stepped >= 75) status = "song";
        else if (stepped >= 50) status = "semi";
        else if (stepped >= 25) status = "sprout";

        state.updateIdeas((prev) => prev.map((i) => (i.id === selectedIdea.id ? { ...i, completionPct: stepped, status } : i)));
    },

    setIdeaNotes: (notes: string) => {
        const state = useStore.getState();
        if (!state.selectedIdeaId) return;
        const selectedIdea = state.workspaces
            .find((w) => w.id === state.activeWorkspaceId)
            ?.ideas.find((i) => i.id === state.selectedIdeaId);
        if (!selectedIdea || selectedIdea.notes === notes) return;

        state.updateIdeas((prev) => prev.map((i) => (i.id === state.selectedIdeaId ? { ...i, notes } : i)));

        if (selectedIdea.kind === "project") {
            state.logIdeaActivity(selectedIdea.id, "updated", "song-save");
        }
    },

    saveProjectLyrics: (projectId: string, text: string) => {
        const state = useStore.getState();
        state.updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== projectId || idea.kind !== "project") return idea;

                const versions = idea.lyrics?.versions ?? [];
                const latestVersion = versions[versions.length - 1];
                const nextDocument = lyricsTextToDocument(text, latestVersion?.document);

                if (!latestVersion) {
                    return {
                        ...idea,
                        lyrics: { versions: [createLyricsVersion(nextDocument)] },
                    };
                }

                const nextVersion = {
                    ...latestVersion,
                    updatedAt: Date.now(),
                    document: nextDocument,
                };

                return {
                    ...idea,
                    lyrics: {
                        versions: [...versions.slice(0, -1), nextVersion],
                    },
                };
            })
        );
        state.logIdeaActivity(projectId, "updated", "lyrics-save");
    },

    saveProjectLyricsAsNewVersion: (projectId: string, text: string) => {
        const state = useStore.getState();
        state.updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== projectId || idea.kind !== "project") return idea;

                const versions = idea.lyrics?.versions ?? [];
                const latestVersion = versions[versions.length - 1];
                const nextDocument = lyricsTextToDocument(text, latestVersion?.document);

                return {
                    ...idea,
                    lyrics: {
                        versions: [...versions, createLyricsVersion(nextDocument)],
                    },
                };
            })
        );
        state.logIdeaActivity(projectId, "updated", "lyrics-save");
    },

    deleteProjectLyricsVersion: (projectId: string, versionId: string) => {
        appActions.deleteProjectLyricsVersions(projectId, [versionId]);
    },

    deleteProjectLyricsVersions: (projectId: string, versionIds: string[]) => {
        const state = useStore.getState();
        if (versionIds.length === 0) return;
        state.updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== projectId || idea.kind !== "project") return idea;
                return {
                    ...idea,
                    lyrics: {
                        versions: (idea.lyrics?.versions ?? []).filter((version) => !versionIds.includes(version.id)),
                    },
                };
            })
        );
    },

    deleteSelectedIdea: (preserveSelection: boolean = false) => {
        const state = useStore.getState();
        if (!state.selectedIdeaId) return;
        const activeWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        const selectedIdea = activeWs?.ideas.find(i => i.id === state.selectedIdeaId);

        if (selectedIdea?.isDraft && selectedIdea.clips.length > 0) {
            // If discarding a draft project that was created by merging clips,
            // we must extract those clips back into the main list so they aren't lost!
            const extractedClipsAsIdeas: SongIdea[] = selectedIdea.clips.map((clip) =>
                createStandaloneClipIdeaFromMove(
                    { clip, sourceIdea: selectedIdea.kind === "clip" ? selectedIdea : null },
                    selectedIdea.collectionId
                )
            );

            state.updateIdeas((prev) => [...extractedClipsAsIdeas, ...prev.filter(i => i.id !== state.selectedIdeaId)]);
        } else {
            state.deleteIdea(state.selectedIdeaId);
        }

        if (!preserveSelection) {
            state.cancelClipSelection();
            state.setPendingPrimaryClipId(null);
        }
        state.setSelectedIdeaId(null);
    },

    deleteSelectedClips: () => {
        const state = useStore.getState();
        if (!state.selectedIdeaId || state.selectedClipIds.length === 0) return;
        const selectedClipIds = new Set(state.selectedClipIds);
        let audioUrisToDelete: string[] = [];

        useStore.setState((store) => {
            let removedIdeaClips: ClipVersion[] = [];
            const nextWorkspaces = store.workspaces.map((workspace) => {
                if (workspace.id !== store.activeWorkspaceId) return workspace;
                return {
                    ...workspace,
                    ideas: workspace.ideas.map((idea) => {
                        if (idea.id !== store.selectedIdeaId) return idea;
                        removedIdeaClips = idea.clips.filter((clip) => selectedClipIds.has(clip.id));
                        const kept = repairDanglingClipParents(
                            idea.clips.filter((clip) => !selectedClipIds.has(clip.id)),
                            selectedClipIds
                        );
                        if (kept.length > 0 && !kept.some((clip) => clip.isPrimary)) {
                            kept[0] = { ...kept[0], isPrimary: true };
                        }
                        return { ...idea, clips: kept };
                    }),
                };
            });

            if (removedIdeaClips.length === 0) {
                return store;
            }

            audioUrisToDelete = filterUnreferencedManagedAudioUris(
                removedIdeaClips.flatMap((clip) =>
                    Array.from(
                        collectManagedIdeaAudioUris({
                            id: "deleted-clips",
                            title: "",
                            notes: "",
                            status: "clip",
                            completionPct: 0,
                            kind: "clip",
                            collectionId: "",
                            createdAt: 0,
                            lastActivityAt: 0,
                            clips: [clip],
                        })
                    )
                ),
                nextWorkspaces
            );

            return {
                ...buildRuntimeCleanupPatch(store, {
                    nextWorkspaces,
                    removedClipIds: removedIdeaClips.map((clip) => clip.id),
                }),
                workspaces: nextWorkspaces,
                activityEvents: store.activityEvents.filter(
                    (event) => !event.clipId || !selectedClipIds.has(event.clipId)
                ),
                playlists: store.playlists.map((playlist) => ({
                    ...playlist,
                    items: playlist.items.filter(
                        (item) => !item.clipId || !selectedClipIds.has(item.clipId)
                    ),
                })),
            };
        });
        void deleteManagedAudioUris(audioUrisToDelete);
    },

    convertSelectedClipIdeaToProject: () => {
        const state = useStore.getState();
        const selectedIdea = state.workspaces.find(w => w.id === state.activeWorkspaceId)?.ideas.find(i => i.id === state.selectedIdeaId);
        if (!selectedIdea || selectedIdea.kind !== "clip") return;

        const converted: SongIdea = {
            ...selectedIdea,
            kind: "project",
            status: "seed",
            completionPct: 0,
            clips: selectedIdea.clips.map((c, idx) => ({ ...c, isPrimary: idx === 0 })),
            lyrics: createEmptyProjectLyrics(),
        };

        state.updateIdeas((prev) => prev.map((idea) => (idea.id === selectedIdea.id ? converted : idea)));
        state.logIdeaActivity(selectedIdea.id, "created", "song-save");

        state.setEditingIdeaId(selectedIdea.id);
        state.setPendingPrimaryClipId(converted.clips[0]?.id ?? null);
    },

    backToIdeas: () => {
        const state = useStore.getState();
        if (!state.selectedIdeaId) return;

        state.cancelClipSelection();
        state.setPendingPrimaryClipId(null);
        state.setMovingClipId(null);
        state.setSelectedIdeaId(null);
    },



    moveClipToProject: (targetProjectId: string) => {
        const state = useStore.getState();
        const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? null;
        const selectedIdea = activeWorkspace?.ideas.find(i => i.id === state.selectedIdeaId);
        const movingClipId = state.movingClipId;
        if (!selectedIdea || !movingClipId) return;

        const clipToMove = selectedIdea.clips.find((c) => c.id === movingClipId);
        if (!clipToMove) return;
        const targetIdea = activeWorkspace?.ideas.find((idea) => idea.id === targetProjectId) ?? null;
        if (!targetIdea) return;
        const movedClipRelocation = buildClipRelocation(
            {
                ...clipToMove,
                parentClipId: undefined,
            },
            targetIdea,
            activeWorkspace?.id ?? state.activeWorkspaceId ?? "",
            targetIdea.collectionId
        );

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (workspace.id !== store.activeWorkspaceId) return workspace;

                const nextIdeas = workspace.ideas.map((idea) => {
                    if (idea.id === selectedIdea.id) {
                        const kept = ensurePrimaryClip(
                            repairDanglingClipParents(
                                idea.clips.filter((clip) => clip.id !== movingClipId),
                                [movingClipId]
                            )
                        );
                        return { ...idea, clips: kept };
                    }

                    if (idea.id === targetProjectId) {
                        const nextClip = {
                            ...clipToMove,
                            isPrimary: idea.clips.length === 0,
                            parentClipId: undefined,
                        };
                        return { ...idea, clips: [nextClip, ...idea.clips] };
                    }

                    return idea;
                });

                return normalizeWorkspaceCollectionVisibility({
                    ...workspace,
                    ideas: nextIdeas,
                });
            }),
            activityEvents: relocateActivityEvents(store.activityEvents, {
                clips: [movedClipRelocation],
            }),
            playlists: relocatePlaylists(store.playlists, {
                clips: [movedClipRelocation],
            }),
        }));
        state.setMovingClipId(null);
    },

    pasteClipboardToWorkspace: async (workspaceId: string): Promise<string[]> => {
        const state = useStore.getState();
        const targetWorkspace = state.workspaces.find((workspace) => workspace.id === workspaceId);
        const fallbackCollectionId = targetWorkspace?.collections[0]?.id;
        if (!fallbackCollectionId) return [];
        return appActions.pasteClipboardToCollection(fallbackCollectionId);
    },

    copyCollection: (
        collectionId: string,
        targetWorkspaceId: string,
        targetParentCollectionId: string | null = null
    ): { ok: boolean; error?: string; collectionId?: string } => {
        const state = useStore.getState();
        const sourceWorkspace = state.workspaces.find((workspace) =>
            workspace.collections.some((collection) => collection.id === collectionId)
        ) ?? null;
        const targetWorkspace = state.workspaces.find((workspace) => workspace.id === targetWorkspaceId) ?? null;

        if (!sourceWorkspace || !targetWorkspace) {
            return { ok: false, error: "Collection not found." };
        }

        const sourceCollection =
            sourceWorkspace.collections.find((collection) => collection.id === collectionId) ?? null;
        if (!sourceCollection) {
            return { ok: false, error: "Collection not found." };
        }

        const descendantIds = getCollectionDescendantIds(sourceWorkspace.collections, collectionId);
        const hasChildCollections = descendantIds.size > 0;

        if (targetParentCollectionId) {
            const targetParent =
                targetWorkspace.collections.find((collection) => collection.id === targetParentCollectionId) ?? null;

            if (!targetParent) {
                return { ok: false, error: "Destination collection not found." };
            }

            if (targetParent.parentCollectionId) {
                return { ok: false, error: "Subcollections cannot contain another subcollection." };
            }

            if (hasChildCollections) {
                return {
                    ok: false,
                    error: "A collection with subcollections can only be copied to the top level.",
                };
            }
        }

        const copyScopeIds = new Set<string>([collectionId, ...descendantIds]);
        const sourceCollections = sourceWorkspace.collections.filter((collection) =>
            copyScopeIds.has(collection.id)
        );
        const collectionIdMap = new Map(
            sourceCollections.map((collection) => [collection.id, buildCollectionId()] as const)
        );
        const sameLevelTitles = targetWorkspace.collections
            .filter(
                (collection) =>
                    (collection.parentCollectionId ?? null) === (targetParentCollectionId ?? null)
            )
            .map((collection) => collection.title);
        const copiedRootTitle = ensureUniqueCountedTitle(
            `${sourceCollection.title} Copy`,
            sameLevelTitles
        );
        const createdAt = Date.now();
        const copiedCollections = sourceCollections.map((collection) => ({
            ...collection,
            id: collectionIdMap.get(collection.id)!,
            title: collection.id === collectionId ? copiedRootTitle : collection.title,
            workspaceId: targetWorkspaceId,
            parentCollectionId:
                collection.id === collectionId
                    ? targetParentCollectionId ?? null
                    : collection.parentCollectionId
                        ? collectionIdMap.get(collection.parentCollectionId) ?? null
                        : null,
            createdAt,
            updatedAt: createdAt,
            ideasListState: createEmptyWorkspaceIdeasListState(),
        }));

        const copiedIdeas = sourceWorkspace.ideas
            .filter((idea) => copyScopeIds.has(idea.collectionId))
            .map((idea) => cloneIdeaForCopy(idea, collectionIdMap.get(idea.collectionId)!));

        useStore.setState((currentState) => ({
            workspaces: currentState.workspaces.map((workspace) =>
                workspace.id !== targetWorkspaceId
                    ? workspace
                    : {
                        ...workspace,
                        collections: [...copiedCollections, ...workspace.collections],
                        ideas: [...copiedIdeas, ...workspace.ideas],
                    }
            ),
        }));

        useStore.getState().markRecentlyAdded([
            collectionIdMap.get(collectionId)!,
            ...copiedIdeas.map((idea) => idea.id),
        ]);

        return { ok: true, collectionId: collectionIdMap.get(collectionId)! };
    },

    pasteClipboardToCollection: async (collectionId: string): Promise<string[]> => {
        const state = useStore.getState();
        const clipboard = state.clipClipboard;
        if (!clipboard) return [];

        const sourceWs = state.workspaces.find((w) => w.id === clipboard.sourceWorkspaceId);
        if (!sourceWs) return [];
        const targetWorkspace = state.workspaces.find((workspace) =>
            workspace.collections.some((collection) => collection.id === collectionId)
        );
        if (!targetWorkspace) return [];

        if (clipboard.from === "list") {
            const sourceIdeas = sourceWs.ideas.filter((idea) => clipboard.clipIds.includes(idea.id));
            if (sourceIdeas.length === 0) return [];

            if (clipboard.mode === "copy") {
                const copiedIdeas = sourceIdeas.map((idea) => cloneIdeaForCopy(idea, collectionId));
                useStore.setState((store) => ({
                    workspaces: store.workspaces.map((workspace) => {
                        if (workspace.id !== targetWorkspace.id) return workspace;
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: [...copiedIdeas, ...workspace.ideas],
                        });
                    }),
                }));

                state.setClipClipboard(null);
                return copiedIdeas.map((idea) => idea.id);
            }

            const movedIdeas = sourceIdeas.map((idea) => ({
                ...idea,
                collectionId,
            }));
            const movingIds = new Set(sourceIdeas.map((idea) => idea.id));
            const ideaRelocations = movedIdeas.map((idea) =>
                buildIdeaRelocation(idea, targetWorkspace.id, collectionId)
            );

            useStore.setState((store) => ({
                workspaces: store.workspaces.map((workspace) => {
                    if (
                        workspace.id !== clipboard.sourceWorkspaceId &&
                        workspace.id !== targetWorkspace.id
                    ) {
                        return workspace;
                    }

                    if (
                        workspace.id === clipboard.sourceWorkspaceId &&
                        workspace.id === targetWorkspace.id
                    ) {
                        const remainingIdeas = workspace.ideas.filter((idea) => !movingIds.has(idea.id));
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: [...movedIdeas, ...remainingIdeas],
                        });
                    }

                    if (workspace.id === clipboard.sourceWorkspaceId) {
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: workspace.ideas.filter((idea) => !movingIds.has(idea.id)),
                        });
                    }

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [...movedIdeas, ...workspace.ideas],
                    });
                }),
                activityEvents: relocateActivityEvents(store.activityEvents, {
                    ideas: ideaRelocations,
                }),
                playlists: relocatePlaylists(store.playlists, {
                    ideas: ideaRelocations,
                }),
            }));

            state.setClipClipboard(null);
            return movedIdeas.map((idea) => idea.id);
        }

        if (clipboard.from !== "project" || !clipboard.sourceIdeaId) return [];
        const sourceProject = sourceWs.ideas.find((i) => i.id === clipboard.sourceIdeaId);
        if (!sourceProject) return [];
        const clipsToPaste = sourceProject.clips
            .filter((clip) => clipboard.clipIds.includes(clip.id))
            .map((clip) => ({ clip, sourceIdea: sourceProject } as ClipTransferSource));

        if (clipsToPaste.length === 0) return [];

        if (clipboard.mode === "copy") {
            const copiedIdeas = clipsToPaste.map((source) =>
                createStandaloneClipIdeaFromCopy(source, collectionId)
            );
            useStore.setState((store) => ({
                workspaces: store.workspaces.map((workspace) => {
                    if (workspace.id !== targetWorkspace.id) return workspace;
                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [...copiedIdeas, ...workspace.ideas],
                    });
                }),
            }));

            state.setClipClipboard(null);
            return copiedIdeas.map((idea) => idea.id);
        }

        const movedIdeas = clipsToPaste.map((source) =>
            createStandaloneClipIdeaFromMove(source, collectionId)
        );
        const removedClipIds = clipsToPaste.map((source) => source.clip.id);
        const clipRelocations = movedIdeas.map((idea, index) =>
            buildClipRelocation(idea.clips[0]!, idea, targetWorkspace.id, collectionId)
        );

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (
                    workspace.id !== clipboard.sourceWorkspaceId &&
                    workspace.id !== targetWorkspace.id
                ) {
                    return workspace;
                }

                if (
                    workspace.id === clipboard.sourceWorkspaceId &&
                    workspace.id === targetWorkspace.id
                ) {
                    const nextIdeas = workspace.ideas.flatMap((idea) => {
                        if (idea.id === clipboard.sourceIdeaId) {
                            const kept = ensurePrimaryClip(
                                repairDanglingClipParents(
                                    idea.clips.filter((clip) => !clipboard.clipIds.includes(clip.id)),
                                    removedClipIds
                                )
                            );
                            return [{ ...idea, clips: kept }];
                        }
                        return [idea];
                    });

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [...movedIdeas, ...nextIdeas],
                    });
                }

                if (workspace.id === clipboard.sourceWorkspaceId) {
                    const nextIdeas = workspace.ideas.map((idea) => {
                        if (idea.id !== clipboard.sourceIdeaId) return idea;
                        const kept = ensurePrimaryClip(
                            repairDanglingClipParents(
                                idea.clips.filter((clip) => !clipboard.clipIds.includes(clip.id)),
                                removedClipIds
                            )
                        );
                        return { ...idea, clips: kept };
                    });

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: nextIdeas,
                    });
                }

                return normalizeWorkspaceCollectionVisibility({
                    ...workspace,
                    ideas: [...movedIdeas, ...workspace.ideas],
                });
            }),
            activityEvents: relocateActivityEvents(store.activityEvents, {
                clips: clipRelocations,
            }),
            playlists: relocatePlaylists(store.playlists, {
                clips: clipRelocations,
            }),
        }));

        state.setClipClipboard(null);
        return movedIdeas.map((idea) => idea.id);
    },

    pasteClipboardToProject: async (projectId: string): Promise<string[]> => {
        const state = useStore.getState();
        const clipboard = state.clipClipboard;
        if (!clipboard) return [];

        const sourceWs = state.workspaces.find((w) => w.id === clipboard.sourceWorkspaceId);
        if (!sourceWs) return [];
        const targetWorkspace = state.workspaces.find((workspace) =>
            workspace.ideas.some((idea) => idea.id === projectId)
        );
        const targetIdeaSnapshot = targetWorkspace?.ideas.find((idea) => idea.id === projectId) ?? null;
        if (!targetWorkspace || !targetIdeaSnapshot || targetIdeaSnapshot.kind !== "project") {
            return [];
        }

        let clipSources: ClipTransferSource[] = [];
        const movedProjectPrimaryClipIds = new Map<string, string>();
        const movedClipIdeaIds: string[] = [];
        if (clipboard.from === "project" && clipboard.sourceIdeaId) {
            const sourceProject = sourceWs.ideas.find((i) => i.id === clipboard.sourceIdeaId);
            if (!sourceProject) return [];
            clipSources = sourceProject.clips
                .filter((clip) => clipboard.clipIds.includes(clip.id))
                .map((clip) => ({ clip, sourceIdea: sourceProject }));
        } else if (clipboard.from === "list") {
            const sourceIdeas = sourceWs.ideas.filter((idea) => clipboard.clipIds.includes(idea.id));
            clipSources = sourceIdeas.flatMap((idea) => {
                if (idea.kind === "clip") {
                    const clip = idea.clips[0];
                    if (!clip) return [];
                    movedClipIdeaIds.push(idea.id);
                    return [{ clip, sourceIdea: idea }];
                }

                const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0];
                if (!primaryClip) return [];
                movedProjectPrimaryClipIds.set(idea.id, primaryClip.id);
                return [{ clip: primaryClip, sourceIdea: idea }];
            });
        }

        if (clipSources.length === 0) return [];

        const sourceClipIds = clipSources.map((source) => source.clip.id);
        const targetExistingClipIds = new Set(targetIdeaSnapshot.clips.map((clip) => clip.id));

        if (clipboard.mode === "copy") {
            const copyBaseTime = Date.now();
            const copiedClipIds = clipSources.map(() => buildClipId());
            const copiedClipIdMap = new Map(
                clipSources.map((source, index) => [source.clip.id, copiedClipIds[index]!] as const)
            );
            const copiedClips = remapClipParentsForTarget(
                clipSources.map((source, index) =>
                    cloneClipForCopy(source, copyBaseTime + index, false, {
                        nextId: copiedClipIds[index],
                        parentIdMap: copiedClipIdMap,
                        keepExternalParentIds: clipboard.from === "project" && clipboard.sourceIdeaId === projectId,
                    })
                ),
                new Set([...targetExistingClipIds, ...copiedClipIds]),
                copiedClipIdMap
            );

            useStore.setState((store) => ({
                workspaces: store.workspaces.map((workspace) => {
                    if (workspace.id !== targetWorkspace.id) return workspace;

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: workspace.ideas.map((idea) => {
                            if (idea.id !== projectId) return idea;

                            let nextProjectInsertedPrimary = idea.clips.length === 0;
                            const nextCopiedClips = copiedClips.map((clip) => {
                                if (nextProjectInsertedPrimary) {
                                    nextProjectInsertedPrimary = false;
                                    return { ...clip, isPrimary: true };
                                }
                                return clip;
                            });

                            return { ...idea, clips: [...nextCopiedClips, ...idea.clips] };
                        }),
                    });
                }),
            }));

            state.setClipClipboard(null);
            return copiedClipIds;
        }

        const movedClips = remapClipParentsForTarget(
            clipSources.map((source) => ({
                ...buildTransferredClip(source),
                isPrimary: false,
            })),
            new Set([...targetExistingClipIds, ...sourceClipIds])
        );
        const clipRelocations = movedClips.map((clip) =>
            buildClipRelocation(clip, targetIdeaSnapshot, targetWorkspace.id, targetIdeaSnapshot.collectionId)
        );
        const ideaRelocations = movedClipIdeaIds.map((ideaId) => ({
            ideaId,
            workspaceId: targetWorkspace.id,
            collectionId: targetIdeaSnapshot.collectionId,
            ideaKind: "song" as const,
            ideaTitle: targetIdeaSnapshot.title,
        }));

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (
                    workspace.id !== clipboard.sourceWorkspaceId &&
                    workspace.id !== targetWorkspace.id
                ) {
                    return workspace;
                }

                let nextIdeas = workspace.ideas;

                if (workspace.id === clipboard.sourceWorkspaceId) {
                    nextIdeas = nextIdeas
                        .filter((idea) =>
                            clipboard.from === "list" ? !movedClipIdeaIds.includes(idea.id) : true
                        )
                        .map((idea) => {
                            if (clipboard.from === "project" && idea.id === clipboard.sourceIdeaId) {
                                const kept = ensurePrimaryClip(
                                    repairDanglingClipParents(
                                        idea.clips.filter((clip) => !sourceClipIds.includes(clip.id)),
                                        sourceClipIds
                                    )
                                );
                                return { ...idea, clips: kept };
                            }

                            const movedPrimaryClipId = movedProjectPrimaryClipIds.get(idea.id);
                            if (clipboard.from === "list" && movedPrimaryClipId) {
                                const kept = ensurePrimaryClip(
                                    repairDanglingClipParents(
                                        idea.clips.filter((clip) => clip.id !== movedPrimaryClipId),
                                        [movedPrimaryClipId]
                                    )
                                );
                                return { ...idea, clips: kept };
                            }

                            return idea;
                        });
                }

                if (workspace.id === targetWorkspace.id) {
                    nextIdeas = nextIdeas.map((idea) => {
                        if (idea.id !== projectId) return idea;

                        let nextProjectInsertedPrimary = idea.clips.length === 0;
                        const nextMovedClips = movedClips.map((clip) => {
                            if (nextProjectInsertedPrimary) {
                                nextProjectInsertedPrimary = false;
                                return { ...clip, isPrimary: true };
                            }
                            return clip;
                        });

                        return { ...idea, clips: [...nextMovedClips, ...idea.clips] };
                    });
                }

                return normalizeWorkspaceCollectionVisibility({
                    ...workspace,
                    ideas: nextIdeas,
                });
            }),
            activityEvents: relocateActivityEvents(store.activityEvents, {
                ideas: ideaRelocations,
                clips: clipRelocations,
            }),
            playlists: relocatePlaylists(store.playlists, {
                ideas: ideaRelocations,
                clips: clipRelocations,
            }),
        }));

        state.setClipClipboard(null);
        return movedClips.map((clip) => clip.id);
    },

    deleteSelectedIdeasFromList: () => {
        const state = useStore.getState();
        if (state.selectedListIdeaIds.length === 0) return;
        const selectedIdeaIds = new Set(state.selectedListIdeaIds);
        let audioUrisToDelete: string[] = [];

        useStore.setState((store) => {
            const activeWorkspace = store.workspaces.find(
                (workspace) => workspace.id === store.activeWorkspaceId
            );
            if (!activeWorkspace) {
                return store;
            }

            const removedIdeas = activeWorkspace.ideas.filter((idea) => selectedIdeaIds.has(idea.id));
            if (removedIdeas.length === 0) {
                return store;
            }

            const removedClipIds = removedIdeas.flatMap((idea) =>
                idea.clips.map((clip) => clip.id)
            );
            const nextWorkspaces = store.workspaces.map((workspace) =>
                workspace.id !== store.activeWorkspaceId
                    ? workspace
                    : normalizeWorkspaceCollectionVisibility({
                          ...workspace,
                          ideas: workspace.ideas.filter((idea) => !selectedIdeaIds.has(idea.id)),
                      })
            );

            audioUrisToDelete = filterUnreferencedManagedAudioUris(
                removedIdeas.flatMap((idea) => Array.from(collectManagedIdeaAudioUris(idea))),
                nextWorkspaces
            );

            if (nextWorkspaces.reduce((sum, workspace) => sum + workspace.ideas.length, 0) === 0) {
                // Multi-delete can intentionally clear the final remaining ideas from the library.
                authorizeIntentionalEmptyStateWrite(6);
            }

            return {
                ...buildRuntimeCleanupPatch(store, {
                    nextWorkspaces,
                    removedIdeaIds: selectedIdeaIds,
                    removedClipIds,
                }),
                workspaces: nextWorkspaces,
                activityEvents: store.activityEvents.filter(
                    (event) => !selectedIdeaIds.has(event.ideaId)
                ),
                playlists: store.playlists.map((playlist) => ({
                    ...playlist,
                    items: playlist.items.filter((item) => !selectedIdeaIds.has(item.ideaId)),
                })),
            };
        });
        void deleteManagedAudioUris(audioUrisToDelete);
    },

    startClipboardFromList: (mode: "copy" | "move") => {
        const state = useStore.getState();
        if (!state.activeWorkspaceId || state.selectedListIdeaIds.length === 0) return;
        const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
        if (!activeWorkspace) return;

        const selectedIdeas = activeWorkspace.ideas.filter((idea) => state.selectedListIdeaIds.includes(idea.id));
        const hasClip = selectedIdeas.some((idea) => idea.kind === "clip");
        const hasProject = selectedIdeas.some((idea) => idea.kind === "project");
        const itemType = hasClip && hasProject ? "mixed" : hasProject ? "project" : "clip";

        state.setClipClipboard({
            sourceWorkspaceId: state.activeWorkspaceId,
            sourceCollectionId: selectedIdeas[0]?.collectionId,
            sourceIdeaId: undefined,
            clipIds: [...state.selectedListIdeaIds],
            mode,
            itemType,
            from: "list",
        });
        state.cancelListSelection();
    },

    startClipboardFromProject: (mode: "copy" | "move") => {
        const state = useStore.getState();
        if (!state.activeWorkspaceId || !state.selectedIdeaId || state.selectedClipIds.length === 0) return;
        const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
        const selectedIdea = activeWorkspace?.ideas.find((idea) => idea.id === state.selectedIdeaId);
        state.setClipClipboard({
            sourceWorkspaceId: state.activeWorkspaceId,
            sourceCollectionId: selectedIdea?.collectionId,
            sourceIdeaId: state.selectedIdeaId,
            clipIds: [...state.selectedClipIds],
            mode,
            itemType: "clip",
            from: "project",
        });
        state.cancelClipSelection();
    },

    archiveWorkspace: async (workspaceId: string) => {
        const state = useStore.getState();
        const workspace = state.workspaces.find((item) => item.id === workspaceId) ?? null;
        if (!workspace) {
            throw new Error("Workspace not found.");
        }
        if (workspace.isArchived) {
            throw new Error("This workspace is already archived.");
        }
        if (state.workspaces.filter((item) => !item.isArchived).length <= 1) {
            throw new Error("You must keep at least one active workspace.");
        }

        const result = await archiveWorkspaceToDevice(workspace);
        useStore.setState((store) => buildWorkspaceArchivalState(store, result.archivedWorkspace));
        await persistCurrentStoreSnapshot();
        await upsertPendingWorkspaceArchiveOperation({
            kind: "archive-cleanup",
            workspaceId,
            archiveUri: result.archiveState.archiveUri,
            originalAudioUris: result.originalAudioUris,
            createdAt: Date.now(),
        });
        await deleteManagedAudioUris(result.originalAudioUris);
        await clearPendingWorkspaceArchiveOperation(workspaceId);
        return result;
    },

    unarchiveWorkspace: async (workspaceId: string) => {
        const state = useStore.getState();
        const workspace = state.workspaces.find((item) => item.id === workspaceId) ?? null;
        if (!workspace) {
            throw new Error("Workspace not found.");
        }
        if (!workspace.isArchived) {
            throw new Error("This workspace is already active.");
        }

        if (!workspace.archiveState) {
            useStore.setState((store) => ({
                workspaces: store.workspaces.map((item) =>
                    item.id === workspaceId
                        ? { ...item, isArchived: false, archiveState: undefined }
                        : item
                ),
                activeWorkspaceId: store.activeWorkspaceId ?? workspaceId,
            }));
            return {
                restoredWorkspace: { ...workspace, isArchived: false, archiveState: undefined },
                warnings: [
                    "This workspace used the older hidden-only archive flag, so there was no compressed package to restore.",
                ],
            };
        }

        await upsertPendingWorkspaceArchiveOperation({
            kind: "unarchive-restore",
            workspaceId,
            archiveUri: workspace.archiveState.archiveUri,
            createdAt: Date.now(),
        });
        const result = await restoreWorkspaceFromDevice(workspace);
        useStore.setState((store) => ({
            workspaces: store.workspaces.map((item) =>
                item.id === workspaceId ? result.restoredWorkspace : item
            ),
            activeWorkspaceId: store.activeWorkspaceId ?? workspaceId,
        }));
        await persistCurrentStoreSnapshot();
        await upsertPendingWorkspaceArchiveOperation({
            kind: "unarchive-cleanup",
            workspaceId,
            archiveUri: workspace.archiveState.archiveUri,
            createdAt: Date.now(),
        });
        await deleteManagedArchiveUri(workspace.archiveState.archiveUri);
        await clearPendingWorkspaceArchiveOperation(workspaceId);
        return result;
    },

    recoverOrphanedAudio: async (
        onProgress?: (phase: string, done: number, total: number) => void
    ): Promise<{ recoveredCount: number; restoredFromManifest: boolean; archivedWorkspacesRestored: number; orphanedClipsRecovered: number; warnings: string[] }> => {
        const state = useStore.getState();
        const warnings: string[] = [];
        let archivedWorkspacesRestored = 0;
        let orphanedClipsRecovered = 0;

        // Phase 0: Check shadow manifest first (full state restore)
        const currentIdeaCount = state.workspaces.reduce(
            (sum, ws) => sum + ws.ideas.length, 0
        );

        if (currentIdeaCount === 0) {
            onProgress?.("Checking manifest backup...", 0, 1);
            try {
                const manifestResult = await restoreFromManifest();
                if (manifestResult) {
                    const restoredState = manifestResult.restoredState;
                    const restoredIdeaCount = restoredState.workspaces.reduce(
                        (sum, ws) => sum + ws.ideas.length, 0
                    );

                    // Restore the full state from manifest
                    useStore.setState(restoredState);
                    await persistCurrentStoreSnapshot();

                    return {
                        recoveredCount: restoredIdeaCount,
                        restoredFromManifest: true,
                        archivedWorkspacesRestored: 0,
                        orphanedClipsRecovered: 0,
                        warnings: [`Restored ${restoredIdeaCount} ideas from manifest backup (saved ${manifestResult.manifestTimestamp}).`],
                    };
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                warnings.push(`Manifest recovery failed: ${msg}`);
            }
        }

        // Phase 1: Restore any workspace archives found on disk
        onProgress?.("Scanning for workspace archives...", 0, 1);
        try {
            const archives = await findWorkspaceArchives();

            // Only restore archives for workspaces not already present with data
            const existingWorkspaceIds = new Set(
                state.workspaces
                    .filter((ws) => !ws.isArchived && ws.ideas.length > 0)
                    .map((ws) => ws.id)
            );

            const archivesToRestore = archives.filter(
                (a) => !existingWorkspaceIds.has(a.workspaceId)
            );

            for (let i = 0; i < archivesToRestore.length; i++) {
                const archive = archivesToRestore[i];
                onProgress?.(
                    `Restoring workspace "${archive.workspaceTitle}"...`,
                    i,
                    archivesToRestore.length
                );

                try {
                    const result = await restoreWorkspaceFromArchive(
                        archive.archiveUri,
                        (done, total) => {
                            onProgress?.(
                                `Restoring "${archive.workspaceTitle}" (${done}/${total} files)...`,
                                i,
                                archivesToRestore.length
                            );
                        }
                    );

                    // Add or replace the workspace in the store
                    useStore.setState((store) => {
                        const existingIdx = store.workspaces.findIndex(
                            (ws) => ws.id === result.workspace.id
                        );

                        let updatedWorkspaces: Workspace[];
                        if (existingIdx >= 0) {
                            // Replace the empty/archived version with the full restored one
                            updatedWorkspaces = [...store.workspaces];
                            updatedWorkspaces[existingIdx] = result.workspace;
                        } else {
                            // Add as new workspace
                            updatedWorkspaces = [...store.workspaces, result.workspace];
                        }

                        return {
                            workspaces: updatedWorkspaces,
                            activeWorkspaceId: store.activeWorkspaceId ?? result.workspace.id,
                        };
                    });

                    archivedWorkspacesRestored++;
                    warnings.push(...result.warnings);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    warnings.push(`Failed to restore archive "${archive.workspaceTitle}": ${msg}`);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            warnings.push(`Archive scan failed: ${msg}`);
        }

        // Phase 2: Recover orphaned audio files not covered by any workspace
        const freshState = useStore.getState();
        onProgress?.("Scanning for orphaned audio files...", 0, 1);
        const orphans = await findOrphanedAudioFiles(freshState.workspaces);

        if (orphans.length > 0) {
            const enriched = await enrichOrphanedClips(orphans, (done, total) => {
                onProgress?.("Recovering orphaned audio...", done, total);
            });

            // Ensure we have a workspace and a "Recovered" collection
            const activeWs = freshState.workspaces.find((w) => w.id === freshState.activeWorkspaceId)
                ?? freshState.workspaces[0];

            if (activeWs) {
                let recoveredCollection = activeWs.collections.find((c) => c.title === "Recovered");
                if (!recoveredCollection) {
                    const collectionId = buildEntityId("collection");
                    const now = Date.now();
                    recoveredCollection = {
                        id: collectionId,
                        title: "Recovered",
                        workspaceId: activeWs.id,
                        parentCollectionId: null,
                        createdAt: now,
                        updatedAt: now,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    };
                    useStore.setState((store) => ({
                        workspaces: store.workspaces.map((ws) =>
                            ws.id === activeWs.id
                                ? { ...ws, collections: [...ws.collections, recoveredCollection!] }
                                : ws
                        ),
                    }));
                }

                const recoveredIdeas = buildRecoveredIdeas(enriched, recoveredCollection.id);

                useStore.setState((store) => ({
                    workspaces: store.workspaces.map((ws) =>
                        ws.id === activeWs.id
                            ? { ...ws, ideas: [...recoveredIdeas, ...ws.ideas] }
                            : ws
                    ),
                }));

                orphanedClipsRecovered = recoveredIdeas.length;
            }
        }

        const recoveredCount = archivedWorkspacesRestored > 0
            ? useStore.getState().workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0)
            : orphanedClipsRecovered;

        // Force manifest write after recovery to capture any newly restored data
        try {
            const freshState = useStore.getState();
            await forceManifestWrite(buildPersistedAppStoreSnapshot(freshState));
        } catch { /* non-critical */ }

        return { recoveredCount, restoredFromManifest: false, archivedWorkspacesRestored, orphanedClipsRecovered, warnings };
    },
};
