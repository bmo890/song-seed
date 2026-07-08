import { Pressable, Text, View } from "react-native";
import { styles } from "../../../styles";
import { IdeaListSelectionZone } from "../components/IdeaListSelectionZone";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { createEmptyProjectLyrics } from "../../../state/dataSlice";
import { relocateActivityEvents, relocatePlaylists } from "../../../state/relocationMetadata";
import { buildRuntimeCleanupPatch } from "../../../state/runtimeCleanup";
import {
  collectManagedIdeaAudioUris,
  deleteManagedAudioUris,
  filterUnreferencedManagedAudioUris,
} from "../../../services/managedMedia";
import { authorizeIntentionalEmptyStateWrite } from "../../../services/stateIntegrity";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle, getBaseClipTitle } from "../../../utils";
import type { ActivityEvent, IdeasHiddenDay, IdeasListState, Playlist, SongIdea, Workspace } from "../../../types";
import { useStore } from "../../../state/useStore";
import { getDateBucket } from "../../../dateBuckets";
import { getIdeaSortTimestamp } from "../../../ideaSort";
import { buildPlayableQueueFromIdeas } from "../../../clipPresentation";

type CollectionUndoSnapshot = {
  workspaceId: string;
  collections: Workspace["collections"];
  ideas: SongIdea[];
  activityEvents: ActivityEvent[];
  playlists: Playlist[];
};

function normalizeIdeasListState(
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

function normalizeCollectionVisibility(workspace: Workspace): Workspace {
  return {
    ...workspace,
    collections: workspace.collections.map((collection) => {
      const collectionIdeas = workspace.ideas.filter((idea) => idea.collectionId === collection.id);
      return {
        ...collection,
        ideasListState: normalizeIdeasListState(collection.ideasListState, collectionIdeas),
      };
    }),
  };
}

function buildCollectionUndoSnapshot(workspace: Workspace): CollectionUndoSnapshot {
  const state = useStore.getState();
  return {
    workspaceId: workspace.id,
    collections: workspace.collections,
    ideas: workspace.ideas,
    activityEvents: state.activityEvents,
    playlists: state.playlists,
  };
}

function restoreCollectionUndoSnapshot(snapshot: CollectionUndoSnapshot) {
  useStore.setState((store) => ({
    workspaces: store.workspaces.map((workspace) =>
      workspace.id === snapshot.workspaceId
        ? {
            ...workspace,
            collections: snapshot.collections,
            ideas: snapshot.ideas,
          }
        : workspace
    ),
    activityEvents: snapshot.activityEvents,
    playlists: snapshot.playlists,
  }));
}

function deleteManagedAudioUrisIfStillUnreferenced(candidateUris: string[]) {
  const urisToDelete = filterUnreferencedManagedAudioUris(
    candidateUris,
    useStore.getState().workspaces
  );
  if (urisToDelete.length === 0) return;
  void deleteManagedAudioUris(urisToDelete).catch((error) => {
    console.warn("[Collection] Deferred managed audio cleanup failed", error);
  });
}

export function CollectionFloatingActions() {
  const { screen, importFlow, selection, editModal, inlinePlayer, store } = useCollectionScreen();

  const isIdeaHiddenByDay = (idea: SongIdea) =>
    screen.activeTimelineMetric
      ? screen.hiddenDayKeySet.has(
          `${screen.activeTimelineMetric}:${getDateBucket(getIdeaSortTimestamp(idea, store.ideasSort)).startTs}`
        )
      : false;
  const isIdeaEffectivelyHidden = (idea: SongIdea) =>
    screen.hiddenIdeaIdsSet.has(idea.id) || isIdeaHiddenByDay(idea);
  const selectedIdeasInList = screen.ideas.filter((idea) => screen.selectedListIdeaIds.includes(idea.id));
  const selectedHiddenIdeaIds = selectedIdeasInList
    .filter((idea) => screen.hiddenIdeaIdsSet.has(idea.id))
    .map((idea) => idea.id);
  const selectedInteractiveIdeas = selectedIdeasInList.filter((idea) => !isIdeaEffectivelyHidden(idea));
  const selectedClipIdeasInList = selectedInteractiveIdeas.filter((idea) => idea.kind === "clip");
  const selectedProjectsInList = selectedIdeasInList.filter((idea) => idea.kind === "project");
  const selectedHiddenOnly =
    selectedIdeasInList.length > 0 &&
    selectedIdeasInList.every((idea) => screen.hiddenIdeaIdsSet.has(idea.id));
  const selectableIdeaIds = screen.listEntries
    .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea")
    .map((entry) => entry.idea.id);

  const playQueueInPlayer = async (queue: Array<{ ideaId: string; clipId: string }>) => {
    if (queue.length === 0) return;
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueueForScreen(queue, 0, true);
  };

  const deleteSelectedIdeasWithUndo = async () => {
    if (screen.selectedListIdeaIds.length === 0) return;
    const selectedIdeaIds = new Set(screen.selectedListIdeaIds);
    const state = useStore.getState();
    const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
    if (!activeWorkspace) return;

    const removedIdeas = activeWorkspace.ideas.filter((idea) => selectedIdeaIds.has(idea.id));
    if (removedIdeas.length === 0) return;

    const activeInlineIdeaId = state.inlineTarget?.ideaId;
    const activePlayerIdeaId = state.playerTarget?.ideaId;

    if (activeInlineIdeaId && selectedIdeaIds.has(activeInlineIdeaId)) {
      await inlinePlayer.resetInlinePlayer();
    }

    if (activePlayerIdeaId && selectedIdeaIds.has(activePlayerIdeaId)) {
      useStore.getState().requestPlayerClose();
      useStore.getState().clearPlayerQueue();
    }

    const previousSnapshot = buildCollectionUndoSnapshot(activeWorkspace);
    const removedClipIds = removedIdeas.flatMap((idea) => idea.clips.map((clip) => clip.id));
    const candidateAudioUris = removedIdeas.flatMap((idea) =>
      Array.from(collectManagedIdeaAudioUris(idea))
    );
    const deletedCount = screen.selectedListIdeaIds.length;
    useStore.setState((storeState) => {
      const nextWorkspaces = storeState.workspaces.map((workspace) =>
        workspace.id !== storeState.activeWorkspaceId
          ? workspace
          : normalizeCollectionVisibility({
              ...workspace,
              ideas: workspace.ideas.filter((idea) => !selectedIdeaIds.has(idea.id)),
            })
      );

      // Multi-delete is an explicit bulk action — it can intentionally clear the final
      // remaining ideas, or just remove a large chunk of the library, so authorize either way.
      authorizeIntentionalEmptyStateWrite(6);

      return {
        ...buildRuntimeCleanupPatch(storeState, {
          nextWorkspaces,
          removedIdeaIds: selectedIdeaIds,
          removedClipIds,
        }),
        workspaces: nextWorkspaces,
        activityEvents: storeState.activityEvents.filter((event) => !selectedIdeaIds.has(event.ideaId)),
        playlists: storeState.playlists.map((playlist) => ({
          ...playlist,
          items: playlist.items.filter((item) => !selectedIdeaIds.has(item.ideaId)),
        })),
      };
    });
    selection.showUndo(`Deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}`, () => {
      restoreCollectionUndoSnapshot(previousSnapshot);
    }, () => deleteManagedAudioUrisIfStillUnreferenced(candidateAudioUris));
  };

  const hideIdeasFromList = async (ideaIds: string[]) => {
    if (!screen.collectionId) return;
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    const activeIdeaId = useStore.getState().inlineTarget?.ideaId;
    if (activeIdeaId && nextIdeaIds.includes(activeIdeaId)) {
      await inlinePlayer.resetInlinePlayer();
    }
    store.setIdeasHidden(screen.collectionId, nextIdeaIds, true);
  };

  const unhideIdeasFromList = (ideaIds: string[]) => {
    if (!screen.collectionId) return;
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    store.setIdeasHidden(screen.collectionId, nextIdeaIds, false);
  };

  const toggleHiddenSelection = async () => {
    if (selectedHiddenOnly) {
      unhideIdeasFromList(selectedHiddenIdeaIds);
      useStore.getState().cancelListSelection();
      return;
    }
    const ideaIdsToHide = selectedInteractiveIdeas.map((idea) => idea.id);
    if (ideaIdsToHide.length === 0) return;
    await hideIdeasFromList(ideaIdsToHide);
    useStore.getState().cancelListSelection();
  };

  const createProjectFromClipIdeas = (targetClips: SongIdea[]) => {
    if (targetClips.length === 0 || !screen.collectionId) return;
    const state = useStore.getState();
    const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
    if (!activeWorkspace) return;
    const previousSnapshot = buildCollectionUndoSnapshot(activeWorkspace);
    const projectId = `idea-${Date.now()}`;
    const convertingIds = new Set(targetClips.map((idea) => idea.id));
    const generatedTitle = ensureUniqueIdeaTitle(
      getBaseClipTitle(targetClips[0].title) || buildDefaultIdeaTitle(),
      screen.ideas.filter((idea) => !convertingIds.has(idea.id)).map((idea) => idea.title)
    );
    const allClips = targetClips.flatMap((idea) => idea.clips).sort((a, b) => b.createdAt - a.createdAt);
    const now = Date.now();

    const mergedProject: SongIdea = {
      id: projectId,
      title: generatedTitle,
      notes: "",
      status: "seed",
      completionPct: 0,
      kind: "project",
      collectionId: screen.collectionId,
      clips: allClips.map((clip, index) => ({ ...clip, isPrimary: index === 0 })),
      lyrics: createEmptyProjectLyrics(),
      createdAt: now,
      lastActivityAt: now,
      isDraft: true,
    };

    const selectedClipIds = targetClips.map((idea) => idea.id);
    const activeInlineIdeaId = state.inlineTarget?.ideaId;
    const activePlayerIdeaId = state.playerTarget?.ideaId;
    if (activeInlineIdeaId && selectedClipIds.includes(activeInlineIdeaId)) {
      useStore.getState().requestInlineStop();
    }
    if (activePlayerIdeaId && selectedClipIds.includes(activePlayerIdeaId)) {
      useStore.getState().requestPlayerClose();
      useStore.getState().clearPlayerQueue();
    }
    const ideaRelocations = targetClips.map((idea) => ({
      ideaId: idea.id,
      workspaceId: activeWorkspace.id,
      collectionId: screen.collectionId!,
      ideaKind: "song" as const,
      ideaTitle: generatedTitle,
    }));
    const clipRelocations = allClips.map((clip) => ({
      clipId: clip.id,
      ideaId: projectId,
      workspaceId: activeWorkspace.id,
      collectionId: screen.collectionId!,
      ideaKind: "song" as const,
      ideaTitle: generatedTitle,
    }));

    useStore.setState((storeState) => ({
      workspaces: storeState.workspaces.map((workspace) =>
        workspace.id !== activeWorkspace.id
          ? workspace
          : normalizeCollectionVisibility({
              ...workspace,
              ideas: [
                mergedProject,
                ...workspace.ideas.filter((idea) => !selectedClipIds.includes(idea.id)),
              ],
            })
      ),
      activityEvents: relocateActivityEvents(storeState.activityEvents, {
        ideas: ideaRelocations,
        clips: clipRelocations,
      }),
      playlists: relocatePlaylists(storeState.playlists, {
        ideas: ideaRelocations,
        clips: clipRelocations,
      }),
    }));
    useStore.getState().cancelListSelection();
    selection.showUndo(`Created song "${generatedTitle}"`, () => {
      restoreCollectionUndoSnapshot(previousSnapshot);
    });
    store.setSelectedIdeaId(projectId);
    screen.navigateRoot("IdeaDetail", { ideaId: projectId });
  };

  const createProjectFromSelection = () => {
    if (selectedClipIdeasInList.length === 0) return;

    if (selectedProjectsInList.length > 0) {
      store.replaceListSelection(selectedClipIdeasInList.map((idea) => idea.id));
      createProjectFromClipIdeas(selectedClipIdeasInList);
      return;
    }

    createProjectFromClipIdeas(selectedClipIdeasInList);
  };

  return (
    <>
      <IdeaListSelectionZone
        listSelectionMode={screen.listSelectionMode}
        selectedHiddenIdeaIds={selectedHiddenIdeaIds}
        selectedClipIdeasCount={selectedClipIdeasInList.length}
        selectableIdeaIds={selectableIdeaIds}
        selectedHiddenOnly={selectedHiddenOnly}
        selectedInteractiveIdeasCount={selectedInteractiveIdeas.length}
        onCreateProjectFromSelection={createProjectFromSelection}
        onPlaySelected={() => {
          void playQueueInPlayer(buildPlayableQueueFromIdeas(selectedInteractiveIdeas));
        }}
        onToggleHideSelected={() => {
          void toggleHiddenSelection();
        }}
        onDeleteSelected={deleteSelectedIdeasWithUndo}
        onEditSelected={() => {
          const targetIdea = selectedInteractiveIdeas[0];
          if (!targetIdea) return;
          if (editModal.quickEditIdea(targetIdea)) return;
          useStore.getState().cancelListSelection();
          store.setSelectedIdeaId(targetIdea.id);
          screen.navigateRoot("IdeaDetail", { ideaId: targetIdea.id, startInEdit: true });
        }}
        onAddProject={() => {
          const createdIdeaId = appActions.addIdea(screen.collectionId!);
          screen.navigateRoot("IdeaDetail", { ideaId: createdIdeaId });
        }}
        onQuickRecord={() => {
          useStore.getState().requestInlineStop();
          useStore.getState().requestPlayerClose();
          appActions.quickRecordIdea(screen.collectionId!);
          screen.navigateRoot("Recording");
        }}
        onImportAudio={() => {
          void importFlow.openImportAudioFlow();
        }}
        onFloatingDockLayout={(height) => {
          screen.setFloatingDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        }}
        onSelectionDockLayout={(height) => {
          screen.setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        }}
      />

      {selection.undoState ? (
        <View style={[styles.ideasUndoWrap, { bottom: screen.floatingStripBottom }]}>
          <View style={styles.ideasUndoCard}>
            <Text style={styles.ideasUndoText} numberOfLines={1}>
              {selection.undoState.message}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ideasUndoBtn, pressed ? styles.pressDown : null]}
              onPress={selection.triggerUndo}
            >
              <Text style={styles.ideasUndoBtnText}>Undo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}
