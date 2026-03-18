import { IdeaStatus, SongIdea, ClipVersion, Workspace } from "../types";
import { useStore } from "./useStore";
import { createEmptyProjectLyrics } from "./dataSlice";
import { createLyricsVersion, lyricsTextToDocument } from "../lyrics";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle } from "../utils";
import { archiveWorkspaceToDevice, restoreWorkspaceFromDevice } from "../services/workspaceArchive";
import { findOrphanedAudioFiles, enrichOrphanedClips, buildRecoveredIdeas, findWorkspaceArchives, restoreWorkspaceFromArchive } from "../services/audioRecovery";

function buildEntityId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildIdeaId() {
    return buildEntityId("idea");
}

function buildClipId() {
    return buildEntityId("clip");
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

function cloneClipForCopy(clip: ClipVersion, createdAt: number, isPrimary: boolean) {
    return {
        ...clip,
        id: buildClipId(),
        createdAt,
        isPrimary,
        parentClipId: undefined,
        tags: cloneClipTags(clip.tags),
    };
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
            clips: idea.clips.map((clip, index) =>
                cloneClipForCopy(clip, now + index, clip.isPrimary)
            ),
            lyrics: cloneLyricsForCopy(idea.lyrics, now),
        };
    }

    const sourceClip = idea.clips[0];
    return {
        ...idea,
        id: buildIdeaId(),
        collectionId,
        createdAt: now,
        lastActivityAt: now,
        clips: sourceClip ? [cloneClipForCopy(sourceClip, now, true)] : [],
    };
}

function createStandaloneClipIdeaFromMove(clip: ClipVersion, collectionId: string): SongIdea {
    return {
        id: clip.id,
        title: clip.title,
        notes: clip.notes || "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId,
        createdAt: clip.createdAt,
        lastActivityAt: clip.createdAt,
        clips: [{ ...clip, isPrimary: true, tags: cloneClipTags(clip.tags) }],
    };
}

function createStandaloneClipIdeaFromCopy(clip: ClipVersion, collectionId: string): SongIdea {
    const now = Date.now();
    return {
        id: buildIdeaId(),
        title: clip.title,
        notes: clip.notes || "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId,
        createdAt: now,
        lastActivityAt: now,
        clips: [cloneClipForCopy(clip, now, true)],
    };
}

function ensurePrimaryClip(clips: ClipVersion[]) {
    if (clips.length > 0 && !clips.some((clip) => clip.isPrimary)) {
        clips[0] = { ...clips[0], isPrimary: true };
    }
    return clips;
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

function getFirstActiveWorkspaceId(workspaces: Workspace[], excludedWorkspaceId?: string) {
    return (
        workspaces.find((workspace) => !workspace.isArchived && workspace.id !== excludedWorkspaceId)?.id ?? null
    );
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
            const extractedClipsAsIdeas: SongIdea[] = selectedIdea.clips.map(clip => ({
                id: clip.id,
                title: clip.title,
                notes: clip.notes || "",
                status: "seed",
                completionPct: 0,
                kind: "clip",
                collectionId: selectedIdea.collectionId,
                clips: [{ ...clip, isPrimary: true }],
                createdAt: clip.createdAt,
                lastActivityAt: clip.createdAt,
            }));

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

        state.updateIdeas((prev) =>
            prev.map((idea) => {
                if (idea.id !== state.selectedIdeaId) return idea;
                const kept = idea.clips.filter((clip) => !state.selectedClipIds.includes(clip.id));
                if (kept.length > 0 && !kept.some((c) => c.isPrimary)) kept[0] = { ...kept[0], isPrimary: true };
                return { ...idea, clips: kept };
            })
        );
        state.cancelClipSelection();
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
        const selectedIdea = state.workspaces.find(w => w.id === state.activeWorkspaceId)?.ideas.find(i => i.id === state.selectedIdeaId);
        const movingClipId = state.movingClipId;
        if (!selectedIdea || !movingClipId) return;

        const clipToMove = selectedIdea.clips.find((c) => c.id === movingClipId);
        if (!clipToMove) return;

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (workspace.id !== store.activeWorkspaceId) return workspace;

                const nextIdeas = workspace.ideas.map((idea) => {
                    if (idea.id === selectedIdea.id) {
                        const kept = ensurePrimaryClip(
                            idea.clips.filter((clip) => clip.id !== movingClipId)
                        );
                        return { ...idea, clips: kept };
                    }

                    if (idea.id === targetProjectId) {
                        const nextClip = {
                            ...clipToMove,
                            isPrimary: idea.clips.length === 0,
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

            const nextIdeaIds =
                clipboard.mode === "copy"
                    ? sourceIdeas.map((idea) => cloneIdeaForCopy(idea, collectionId).id)
                    : sourceIdeas.map((idea) => idea.id);

            useStore.setState((store) => ({
                workspaces: store.workspaces.map((workspace) => {
                    if (
                        workspace.id !== clipboard.sourceWorkspaceId &&
                        workspace.id !== targetWorkspace.id
                    ) {
                        return workspace;
                    }

                    if (clipboard.mode === "copy") {
                        if (workspace.id !== targetWorkspace.id) return workspace;
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: [
                                ...sourceIdeas.map((idea) => cloneIdeaForCopy(idea, collectionId)),
                                ...workspace.ideas,
                            ],
                        });
                    }

                    if (
                        workspace.id === clipboard.sourceWorkspaceId &&
                        workspace.id === targetWorkspace.id
                    ) {
                        const movingIds = new Set(sourceIdeas.map((idea) => idea.id));
                        const movedIdeas = sourceIdeas.map((idea) => ({
                            ...idea,
                            collectionId,
                        }));
                        const remainingIdeas = workspace.ideas.filter((idea) => !movingIds.has(idea.id));
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: [...movedIdeas, ...remainingIdeas],
                        });
                    }

                    if (workspace.id === clipboard.sourceWorkspaceId) {
                        const movingIds = new Set(sourceIdeas.map((idea) => idea.id));
                        return normalizeWorkspaceCollectionVisibility({
                            ...workspace,
                            ideas: workspace.ideas.filter((idea) => !movingIds.has(idea.id)),
                        });
                    }

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [
                            ...sourceIdeas.map((idea) => ({
                                ...idea,
                                collectionId,
                            })),
                            ...workspace.ideas,
                        ],
                    });
                }),
            }));

            state.setClipClipboard(null);
            return nextIdeaIds;
        }

        let clipsToPaste: ClipVersion[] = [];
        if (clipboard.from !== "project" || !clipboard.sourceIdeaId) return [];
        const sourceProject = sourceWs.ideas.find((i) => i.id === clipboard.sourceIdeaId);
        if (!sourceProject) return [];
        clipsToPaste = sourceProject.clips.filter((c) => clipboard.clipIds.includes(c.id));

        if (clipsToPaste.length === 0) return [];

        const nextIdeaIds =
            clipboard.mode === "copy"
                ? clipsToPaste.map((clip) => createStandaloneClipIdeaFromCopy(clip, collectionId).id)
                : clipsToPaste.map((clip) => clip.id);

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (
                    workspace.id !== clipboard.sourceWorkspaceId &&
                    workspace.id !== targetWorkspace.id
                ) {
                    return workspace;
                }

                if (clipboard.mode === "copy") {
                    if (workspace.id !== targetWorkspace.id) return workspace;
                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [
                            ...clipsToPaste.map((clip) => createStandaloneClipIdeaFromCopy(clip, collectionId)),
                            ...workspace.ideas,
                        ],
                    });
                }

                if (
                    workspace.id === clipboard.sourceWorkspaceId &&
                    workspace.id === targetWorkspace.id
                ) {
                    const nextIdeas = workspace.ideas.flatMap((idea) => {
                        if (idea.id === clipboard.sourceIdeaId) {
                            const kept = ensurePrimaryClip(
                                idea.clips.filter((clip) => !clipboard.clipIds.includes(clip.id))
                            );
                            return [{ ...idea, clips: kept }];
                        }
                        return [idea];
                    });

                    return normalizeWorkspaceCollectionVisibility({
                        ...workspace,
                        ideas: [
                            ...clipsToPaste.map((clip) => createStandaloneClipIdeaFromMove(clip, collectionId)),
                            ...nextIdeas,
                        ],
                    });
                }

                if (workspace.id === clipboard.sourceWorkspaceId) {
                    const nextIdeas = workspace.ideas.map((idea) => {
                        if (idea.id !== clipboard.sourceIdeaId) return idea;
                        const kept = ensurePrimaryClip(
                            idea.clips.filter((clip) => !clipboard.clipIds.includes(clip.id))
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
                    ideas: [
                        ...clipsToPaste.map((clip) => createStandaloneClipIdeaFromMove(clip, collectionId)),
                        ...workspace.ideas,
                    ],
                });
            }),
        }));

        state.setClipClipboard(null);
        return nextIdeaIds;
    },

    pasteClipboardToProject: async (projectId: string): Promise<string[]> => {
        const state = useStore.getState();
        const clipboard = state.clipClipboard;
        if (!clipboard) return [];

        const sourceWs = state.workspaces.find((w) => w.id === clipboard.sourceWorkspaceId);
        if (!sourceWs) return [];

        let clipsToPaste: ClipVersion[] = [];
        const movedProjectPrimaryClipIds = new Map<string, string>();
        const movedClipIdeaIds: string[] = [];
        if (clipboard.from === "project" && clipboard.sourceIdeaId) {
            const sourceProject = sourceWs.ideas.find((i) => i.id === clipboard.sourceIdeaId);
            if (!sourceProject) return [];
            clipsToPaste = sourceProject.clips.filter((c) => clipboard.clipIds.includes(c.id));
        } else if (clipboard.from === "list") {
            const sourceIdeas = sourceWs.ideas.filter((idea) => clipboard.clipIds.includes(idea.id));
            clipsToPaste = sourceIdeas.flatMap((idea) => {
                if (idea.kind === "clip") {
                    const clip = idea.clips[0];
                    if (!clip) return [];
                    movedClipIdeaIds.push(idea.id);
                    return [clip];
                }

                const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0];
                if (!primaryClip) return [];
                movedProjectPrimaryClipIds.set(idea.id, primaryClip.id);
                return [primaryClip];
            });
        }

        if (clipsToPaste.length === 0) return [];

        const nextClipIds =
            clipboard.mode === "copy"
                ? clipsToPaste.map(() => buildClipId())
                : clipsToPaste.map((clip) => clip.id);

        useStore.setState((store) => ({
            workspaces: store.workspaces.map((workspace) => {
                if (workspace.id !== clipboard.sourceWorkspaceId) return workspace;

                const targetIdea = workspace.ideas.find((idea) => idea.id === projectId);
                const targetHasNoClips = !!targetIdea && targetIdea.clips.length === 0;
                let nextProjectInsertedPrimary = targetHasNoClips;

                const projectMoveClipMap =
                    clipboard.mode === "copy"
                        ? new Map(
                              clipsToPaste.map((clip, index) => [
                                  clip.id,
                                  {
                                      ...cloneClipForCopy(clip, Date.now() + index, false),
                                      id: nextClipIds[index]!,
                                  },
                              ])
                          )
                        : new Map(
                              clipsToPaste.map((clip) => [
                                  clip.id,
                                  {
                                      ...clip,
                                      isPrimary: false,
                                  },
                              ])
                          );

                const nextIdeas = workspace.ideas
                    .filter((idea) =>
                        clipboard.mode === "move" && clipboard.from === "list"
                            ? !movedClipIdeaIds.includes(idea.id)
                            : true
                    )
                    .map((idea) => {
                        if (clipboard.mode === "move" && clipboard.from === "project" && idea.id === clipboard.sourceIdeaId) {
                            const kept = ensurePrimaryClip(
                                idea.clips.filter((clip) => !clipboard.clipIds.includes(clip.id))
                            );
                            return { ...idea, clips: kept };
                        }

                        if (clipboard.mode === "move" && clipboard.from === "list") {
                            const movedPrimaryClipId = movedProjectPrimaryClipIds.get(idea.id);
                            if (movedPrimaryClipId) {
                                const kept = ensurePrimaryClip(
                                    idea.clips.filter((clip) => clip.id !== movedPrimaryClipId)
                                );
                                return { ...idea, clips: kept };
                            }
                        }

                        if (idea.id === projectId) {
                            const movedClips = clipsToPaste.map((clip) => {
                                const nextClip = projectMoveClipMap.get(clip.id)!;
                                if (nextProjectInsertedPrimary) {
                                    nextProjectInsertedPrimary = false;
                                    return { ...nextClip, isPrimary: true };
                                }
                                return nextClip;
                            });
                            return { ...idea, clips: [...movedClips, ...idea.clips] };
                        }

                        return idea;
                    });

                return normalizeWorkspaceCollectionVisibility({
                    ...workspace,
                    ideas: nextIdeas,
                });
            }),
        }));

        state.setClipClipboard(null);
        return nextClipIds;
    },

    deleteSelectedIdeasFromList: () => {
        const state = useStore.getState();
        if (state.selectedListIdeaIds.length === 0) return;
        state.updateIdeas((prev) => prev.filter((idea) => !state.selectedListIdeaIds.includes(idea.id)));
        state.cancelListSelection();
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

        const result = await restoreWorkspaceFromDevice(workspace);
        useStore.setState((store) => ({
            workspaces: store.workspaces.map((item) =>
                item.id === workspaceId ? result.restoredWorkspace : item
            ),
            activeWorkspaceId: store.activeWorkspaceId ?? workspaceId,
        }));
        return result;
    },

    recoverOrphanedAudio: async (
        onProgress?: (phase: string, done: number, total: number) => void
    ): Promise<{ recoveredCount: number; archivedWorkspacesRestored: number; orphanedClipsRecovered: number; warnings: string[] }> => {
        const state = useStore.getState();
        const warnings: string[] = [];
        let archivedWorkspacesRestored = 0;
        let orphanedClipsRecovered = 0;

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

        return { recoveredCount, archivedWorkspacesRestored, orphanedClipsRecovered, warnings };
    },
};
