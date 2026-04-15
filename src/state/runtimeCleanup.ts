import type {
    ActivityEvent,
    ClipClipboard,
    InlineTarget,
    PlaybackQueueItem,
    PlayerTarget,
    Playlist,
    Workspace,
} from "../types";

type RuntimeStoreState = {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
    primaryWorkspaceId: string | null;
    lastUsedWorkspaceId: string | null;
    selectedIdeaId: string | null;
    editingIdeaId: string | null;
    pendingPrimaryClipId: string | null;
    clipSelectionMode: boolean;
    selectedClipIds: string[];
    listSelectionMode: boolean;
    selectedListIdeaIds: string[];
    clipClipboard: ClipClipboard | null;
    movingClipId: string | null;
    playerTarget: PlayerTarget;
    playerQueue: PlaybackQueueItem[];
    playerQueueIndex: number;
    playerShouldAutoplay: boolean;
    playerPositionMs: number;
    playerDurationMs: number;
    playerIsPlaying: boolean;
    playerCloseRequestToken: number;
    inlineTarget: InlineTarget;
    inlinePositionMs: number;
    inlineDurationMs: number;
    inlineIsPlaying: boolean;
    inlineStopRequestToken: number;
    recordingIdeaId: string | null;
    recordingParentClipId: string | null;
    recordingOverdubClipId: string | null;
    recordingGuideMixUri: string | null;
    quickNamingIdeaId: string | null;
    quickNameModalVisible: boolean;
    quickNameDraft: string;
    activityEvents: ActivityEvent[];
    playlists: Playlist[];
};

type CleanupTargets = {
    nextWorkspaces: Workspace[];
    removedWorkspaceIds?: Iterable<string>;
    removedCollectionIds?: Iterable<string>;
    removedIdeaIds?: Iterable<string>;
    removedClipIds?: Iterable<string>;
};

function getFirstActiveWorkspaceId(workspaces: Workspace[]) {
    return workspaces.find((workspace) => !workspace.isArchived)?.id ?? null;
}

function clipboardTouchesRemovedEntity(
    clipClipboard: ClipClipboard | null,
    removedWorkspaceIds: Set<string>,
    removedCollectionIds: Set<string>,
    removedIdeaIds: Set<string>,
    removedClipIds: Set<string>
) {
    if (!clipClipboard) return false;

    if (removedWorkspaceIds.has(clipClipboard.sourceWorkspaceId)) {
        return true;
    }

    if (clipClipboard.sourceCollectionId && removedCollectionIds.has(clipClipboard.sourceCollectionId)) {
        return true;
    }

    if (clipClipboard.sourceIdeaId && removedIdeaIds.has(clipClipboard.sourceIdeaId)) {
        return true;
    }

    if (clipClipboard.from === "list") {
        return clipClipboard.clipIds.some((ideaId) => removedIdeaIds.has(ideaId));
    }

    return clipClipboard.clipIds.some((clipId) => removedClipIds.has(clipId));
}

function targetTouchesRemovedClip(
    target: PlayerTarget | InlineTarget,
    removedIdeaIds: Set<string>,
    removedClipIds: Set<string>
) {
    if (!target) return false;
    return removedIdeaIds.has(target.ideaId) || removedClipIds.has(target.clipId);
}

function queueTouchesRemovedClip(
    playerQueue: PlaybackQueueItem[],
    removedIdeaIds: Set<string>,
    removedClipIds: Set<string>
) {
    return playerQueue.some(
        (item) => removedIdeaIds.has(item.ideaId) || removedClipIds.has(item.clipId)
    );
}

export function buildRuntimeCleanupPatch(
    store: RuntimeStoreState,
    {
        nextWorkspaces,
        removedWorkspaceIds = [],
        removedCollectionIds = [],
        removedIdeaIds = [],
        removedClipIds = [],
    }: CleanupTargets
) {
    const removedWorkspaceIdSet = new Set(removedWorkspaceIds);
    const removedCollectionIdSet = new Set(removedCollectionIds);
    const removedIdeaIdSet = new Set(removedIdeaIds);
    const removedClipIdSet = new Set(removedClipIds);
    const fallbackWorkspaceId = getFirstActiveWorkspaceId(nextWorkspaces);

    const selectedIdeaRemoved =
        !!store.selectedIdeaId && removedIdeaIdSet.has(store.selectedIdeaId);
    const editingIdeaRemoved =
        !!store.editingIdeaId && removedIdeaIdSet.has(store.editingIdeaId);
    const recordingIdeaRemoved =
        !!store.recordingIdeaId && removedIdeaIdSet.has(store.recordingIdeaId);
    const quickNamingIdeaRemoved =
        !!store.quickNamingIdeaId && removedIdeaIdSet.has(store.quickNamingIdeaId);
    const playerQueueTouchesRemoved =
        targetTouchesRemovedClip(store.playerTarget, removedIdeaIdSet, removedClipIdSet) ||
        queueTouchesRemovedClip(store.playerQueue, removedIdeaIdSet, removedClipIdSet);
    const inlineTouchesRemoved = targetTouchesRemovedClip(
        store.inlineTarget,
        removedIdeaIdSet,
        removedClipIdSet
    );
    const nextSelectedListIdeaIds = store.selectedListIdeaIds.filter(
        (ideaId) => !removedIdeaIdSet.has(ideaId)
    );
    const nextSelectedClipIds = selectedIdeaRemoved
        ? []
        : store.selectedClipIds.filter((clipId) => !removedClipIdSet.has(clipId));
    const nextClipboard = clipboardTouchesRemovedEntity(
        store.clipClipboard,
        removedWorkspaceIdSet,
        removedCollectionIdSet,
        removedIdeaIdSet,
        removedClipIdSet
    )
        ? null
        : store.clipClipboard;

    return {
        activeWorkspaceId:
            store.activeWorkspaceId && removedWorkspaceIdSet.has(store.activeWorkspaceId)
                ? fallbackWorkspaceId
                : store.activeWorkspaceId,
        primaryWorkspaceId:
            store.primaryWorkspaceId && removedWorkspaceIdSet.has(store.primaryWorkspaceId)
                ? null
                : store.primaryWorkspaceId,
        lastUsedWorkspaceId:
            store.lastUsedWorkspaceId && removedWorkspaceIdSet.has(store.lastUsedWorkspaceId)
                ? fallbackWorkspaceId
                : store.lastUsedWorkspaceId,
        selectedIdeaId: selectedIdeaRemoved ? null : store.selectedIdeaId,
        editingIdeaId: editingIdeaRemoved ? null : store.editingIdeaId,
        pendingPrimaryClipId:
            selectedIdeaRemoved ||
            editingIdeaRemoved ||
            (!!store.pendingPrimaryClipId && removedClipIdSet.has(store.pendingPrimaryClipId))
                ? null
                : store.pendingPrimaryClipId,
        clipSelectionMode: nextSelectedClipIds.length > 0 ? store.clipSelectionMode : false,
        selectedClipIds: nextSelectedClipIds,
        listSelectionMode: nextSelectedListIdeaIds.length > 0 ? store.listSelectionMode : false,
        selectedListIdeaIds: nextSelectedListIdeaIds,
        clipClipboard: nextClipboard,
        movingClipId:
            selectedIdeaRemoved ||
            (!!store.movingClipId && removedClipIdSet.has(store.movingClipId))
                ? null
                : store.movingClipId,
        playerTarget: playerQueueTouchesRemoved ? null : store.playerTarget,
        playerQueue: playerQueueTouchesRemoved ? [] : store.playerQueue,
        playerQueueIndex: playerQueueTouchesRemoved ? 0 : store.playerQueueIndex,
        playerShouldAutoplay: playerQueueTouchesRemoved ? false : store.playerShouldAutoplay,
        playerPositionMs: playerQueueTouchesRemoved ? 0 : store.playerPositionMs,
        playerDurationMs: playerQueueTouchesRemoved ? 0 : store.playerDurationMs,
        playerIsPlaying: playerQueueTouchesRemoved ? false : store.playerIsPlaying,
        playerCloseRequestToken:
            playerQueueTouchesRemoved
                ? store.playerCloseRequestToken + 1
                : store.playerCloseRequestToken,
        inlineTarget: inlineTouchesRemoved ? null : store.inlineTarget,
        inlinePositionMs: inlineTouchesRemoved ? 0 : store.inlinePositionMs,
        inlineDurationMs: inlineTouchesRemoved ? 0 : store.inlineDurationMs,
        inlineIsPlaying: inlineTouchesRemoved ? false : store.inlineIsPlaying,
        inlineStopRequestToken:
            inlineTouchesRemoved
                ? store.inlineStopRequestToken + 1
                : store.inlineStopRequestToken,
        recordingIdeaId: recordingIdeaRemoved ? null : store.recordingIdeaId,
        recordingParentClipId:
            recordingIdeaRemoved ||
            (!!store.recordingParentClipId && removedClipIdSet.has(store.recordingParentClipId))
                ? null
                : store.recordingParentClipId,
        recordingOverdubClipId:
            recordingIdeaRemoved ||
            (!!store.recordingOverdubClipId && removedClipIdSet.has(store.recordingOverdubClipId))
                ? null
                : store.recordingOverdubClipId,
        recordingGuideMixUri:
            recordingIdeaRemoved ||
            (!!store.recordingOverdubClipId && removedClipIdSet.has(store.recordingOverdubClipId))
                ? null
                : store.recordingGuideMixUri,
        quickNamingIdeaId: quickNamingIdeaRemoved ? null : store.quickNamingIdeaId,
        quickNameModalVisible:
            quickNamingIdeaRemoved ? false : store.quickNameModalVisible,
        quickNameDraft: quickNamingIdeaRemoved ? "" : store.quickNameDraft,
    };
}
