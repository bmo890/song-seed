import { useMemo } from "react";
import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { useTranslation } from "react-i18next";
import { styles } from "../../../styles";
import { IdeaListSelectionZone } from "../components/IdeaListSelectionZone";
import { PickerFooter } from "../../common/PickerFooter";
import { useLibraryCollectorHandlers } from "../../../hooks/useLibraryCollectorHandlers";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { createEmptyProjectLyrics } from "../../../state/dataSlice";
import { relocateActivityEvents, relocatePlaylists } from "../../../state/relocationMetadata";
import { buildRuntimeCleanupPatch, restorePrunedEntries } from "../../../state/runtimeCleanup";
import { collectManagedIdeaAudioUris } from "../../../services/managedMedia";
import { trashFilesNoLongerUsed } from "../../../state/mediaCleanup";
import { authorizeIntentionalEmptyStateWrite } from "../../../services/stateIntegrity";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle, getBaseClipTitle } from "../../../utils";
import type { ActivityEvent, IdeasHiddenDay, IdeasListState, Playlist, Setlist, SongIdea, Songbook, Workspace } from "../../../types";
import { useStore } from "../../../state/useStore";
import { getDateBucket } from "../../../domain/dateBuckets";
import { getIdeaSortTimestamp } from "../../../domain/ideaSort";
import { buildPlayableQueueFromIdeas } from "../../../domain/clipPresentation";
import { haptic } from "../../../design/haptics";

type CollectionUndoSnapshot = {
  workspaceId: string;
  collections: Workspace["collections"];
  ideas: SongIdea[];
  activityEvents: ActivityEvent[];
  playlists: Playlist[];
  // A delete prunes the ideas' songbook and setlist entries (runtimeCleanup); undo
  // must put them back where they stood.
  songbooks: Songbook[];
  setlists: Setlist[];
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
    songbooks: state.songbooks,
    setlists: state.setlists,
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

/** Undo for a multi-delete: put back only the ideas (and their activity and playlist
 *  entries) that the delete removed. Anything saved during the undo window stays. */
function restoreDeletedIdeas(snapshot: CollectionUndoSnapshot, removedIdeaIds: Set<string>) {
  useStore.setState((store) => {
    const removedIdeas = snapshot.ideas.filter((idea) => removedIdeaIds.has(idea.id));
    const nextWorkspaces = store.workspaces.map((workspace) => {
      if (workspace.id !== snapshot.workspaceId) return workspace;
      const present = new Set(workspace.ideas.map((idea) => idea.id));
      const hiddenBefore = new Map(snapshot.collections.map((collection) => [collection.id, collection.ideasListState]));
      return normalizeCollectionVisibility({
        ...workspace,
        ideas: [...workspace.ideas, ...removedIdeas.filter((idea) => !present.has(idea.id))],
        // Bring back the deleted ideas' hidden state with them.
        collections: workspace.collections.map((collection) => {
          const before = hiddenBefore.get(collection.id);
          if (!before) return collection;
          const hidden = new Set(collection.ideasListState?.hiddenIdeaIds ?? []);
          for (const id of before.hiddenIdeaIds ?? []) if (removedIdeaIds.has(id)) hidden.add(id);
          return {
            ...collection,
            ideasListState: { hiddenDays: collection.ideasListState?.hiddenDays ?? [], hiddenIdeaIds: [...hidden] },
          };
        }),
      });
    });
    const presentEvents = new Set(store.activityEvents.map((event) => event.id));
    return {
      workspaces: nextWorkspaces,
      activityEvents: [
        ...store.activityEvents,
        ...snapshot.activityEvents.filter((event) => removedIdeaIds.has(event.ideaId) && !presentEvents.has(event.id)),
      ].sort((a, b) => b.at - a.at),
      playlists: store.playlists.map((playlist) => {
        const before = snapshot.playlists.find((candidate) => candidate.id === playlist.id);
        if (!before) return playlist;
        const kept = new Set(playlist.items.map((item) => item.id));
        // The playlist's order from before the delete, minus anything removed since.
        return {
          ...playlist,
          items: [
            ...before.items.filter((item) => kept.has(item.id) || removedIdeaIds.has(item.ideaId)),
            ...playlist.items.filter((item) => !before.items.some((old) => old.id === item.id)),
          ],
        };
      }),
      songbooks: store.songbooks.map((book) => {
        const before = snapshot.songbooks.find((candidate) => candidate.id === book.id);
        return before ? { ...book, items: restorePrunedEntries(book.items, before.items, removedIdeaIds) } : book;
      }),
      setlists: store.setlists.map((set) => {
        const before = snapshot.setlists.find((candidate) => candidate.id === set.id);
        return before ? { ...set, entries: restorePrunedEntries(set.entries, before.entries, removedIdeaIds) } : set;
      }),
    };
  });
}

/** The picker's one chrome on a collection page: ✕ + "Add N" while a
 *  compilation is collecting; ✕ alone while the Lyrics Pad is choosing a song
 *  (a sketch card confirms on tap, so there is nothing to commit down here). */
function CollectionPickerFooter({ onLayout }: { onLayout: (height: number) => void }) {
  const { t } = useTranslation();
  const { screen } = useCollectionScreen();
  const collecting = useStore((s) => s.libraryCollector != null);
  // The whole basket, not this page's share of it: picks accumulate across
  // collections, and "Add 4" must mean four.
  const pickedCount = useStore((s) => s.libraryCollector?.picks.length ?? 0);
  const collectorHandlers = useLibraryCollectorHandlers(screen.navigation);
  if (collecting) {
    return (
      <PickerFooter
        count={pickedCount}
        onAdd={collectorHandlers.onAdd}
        onCancel={collectorHandlers.onCancel}
        cancelLabel={t("common.stopAdding")}
        onLayout={onLayout}
      />
    );
  }
  return (
    <PickerFooter
      onCancel={() => useStore.getState().cancelSongTargetPicking()}
      cancelLabel={t("common.cancel")}
      onLayout={onLayout}
    />
  );
}

export function CollectionFloatingActions() {

  const { t } = useTranslation();
  const { screen, selection, editModal, inlinePlayer, store } = useCollectionScreen();

  // The selection derivations ran on every render of this component (every
  // store write reaching the screen), as O(ideas × selected) `includes` scans,
  // even with nothing selected. Now: a Set, memoized on their inputs, and empty
  // work while nothing is selected (2026-09-30).
  const {
    selectedHiddenIdeaIds,
    selectedInteractiveIdeas,
    orderedSelectedInteractiveIdeas,
    selectedClipIdeasInList,
    selectedProjectsInList,
    selectedHiddenOnly,
    selectableIdeaIds,
  } = useMemo(() => {
    const selectedSet = new Set(screen.selectedListIdeaIds);
    const isIdeaHiddenByDay = (idea: SongIdea) =>
      screen.activeTimelineMetric
        ? screen.hiddenDayKeySet.has(
            `${screen.activeTimelineMetric}:${getDateBucket(getIdeaSortTimestamp(idea, store.ideasSort)).startTs}`
          )
        : false;
    const isIdeaEffectivelyHidden = (idea: SongIdea) =>
      screen.hiddenIdeaIdsSet.has(idea.id) || isIdeaHiddenByDay(idea);
    const selectableIdeaIds = screen.listEntries
      .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea")
      .map((entry) => entry.ideaId);
    if (selectedSet.size === 0) {
      return {
        selectedHiddenIdeaIds: [] as string[],
        selectedInteractiveIdeas: [] as SongIdea[],
        orderedSelectedInteractiveIdeas: [] as SongIdea[],
        selectedClipIdeasInList: [] as SongIdea[],
        selectedProjectsInList: [] as SongIdea[],
        selectedHiddenOnly: false,
        selectableIdeaIds,
      };
    }
    const selectedIdeasInList = screen.ideas.filter((idea) => selectedSet.has(idea.id));
    const selectedHiddenIdeaIds = selectedIdeasInList
      .filter((idea) => screen.hiddenIdeaIdsSet.has(idea.id))
      .map((idea) => idea.id);
    const selectedInteractiveIdeas = selectedIdeasInList.filter((idea) => !isIdeaEffectivelyHidden(idea));
    // Play/queue order must match what's on screen (the sorted, day-grouped list),
    // not raw storage order — "select all → play" should march down the list as
    // shown. listEntries is exactly the rendered order.
    const listIdeaById = new Map(screen.listIdeas.map((idea) => [idea.id, idea]));
    const orderedSelectedInteractiveIdeas = screen.listEntries
      .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea")
      .map((entry) => listIdeaById.get(entry.ideaId))
      .filter((idea): idea is NonNullable<typeof idea> => idea != null)
      .filter((idea) => selectedSet.has(idea.id) && !isIdeaEffectivelyHidden(idea));
    return {
      selectedHiddenIdeaIds,
      selectedInteractiveIdeas,
      orderedSelectedInteractiveIdeas,
      selectedClipIdeasInList: selectedInteractiveIdeas.filter((idea) => idea.kind === "clip"),
      selectedProjectsInList: selectedIdeasInList.filter((idea) => idea.kind === "project"),
      selectedHiddenOnly:
        selectedIdeasInList.length > 0 &&
        selectedIdeasInList.every((idea) => screen.hiddenIdeaIdsSet.has(idea.id)),
      selectableIdeaIds,
    };
  }, [
    screen.activeTimelineMetric,
    screen.hiddenDayKeySet,
    screen.hiddenIdeaIdsSet,
    screen.ideas,
    screen.listEntries,
    screen.listIdeas,
    screen.selectedListIdeaIds,
    store.ideasSort,
  ]);

  const playQueueInPlayer = async (queue: Array<{ ideaId: string; clipId: string }>) => {
    if (queue.length === 0) return;
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueueForScreen(queue, 0, true);
  };

  const deleteSelectedIdeasWithUndo = async () => {
    if (screen.selectedListIdeaIds.length === 0) return;
    const selectedIdeaIds = new Set(screen.selectedListIdeaIds);
    const state = useStore.getState();
    // The page's workspace, not the store's active one: a visited received
    // package is never made active, so its ideas live elsewhere.
    const activeWorkspace = state.workspaces.find((workspace) => workspace.id === screen.activeWorkspaceId);
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
        workspace.id !== activeWorkspace.id
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
    // Same word as the confirm dialog: clips when every one was a clip.
    const allClips = removedIdeas.every((idea) => idea.kind === "clip");
    selection.showUndo(t(allClips ? "collection.deletedClipsUndo" : "collection.deletedUndo", { count: deletedCount }), () => {
      restoreDeletedIdeas(previousSnapshot, selectedIdeaIds);
    }, () => trashFilesNoLongerUsed(candidateAudioUris, "multi-delete"));
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
    // The page's workspace (see deleteSelectedIdeasWithUndo): the sketch must
    // land where its clips and collection are, not in the active workspace.
    const activeWorkspace = state.workspaces.find((workspace) => workspace.id === screen.activeWorkspaceId);
    if (!activeWorkspace) return;
    const previousSnapshot = buildCollectionUndoSnapshot(activeWorkspace);
    const projectId = `idea-${Date.now()}`;
    const convertingIds = new Set(targetClips.map((idea) => idea.id));
    const generatedTitle = ensureUniqueIdeaTitle(
      getBaseClipTitle(targetClips[0].title) || buildDefaultIdeaTitle(),
      screen.ideas.filter((idea) => !convertingIds.has(idea.id)).map((idea) => idea.title)
    );
    // The clips arrive as SEPARATE takes, newest first, the newest primary —
    // never threaded on their own (founder, 2026-10-04: a sketch may gather a
    // chorus's versions AND a verse AND a C part; which ones become one thread is
    // the writer's call, made inside the sketch: select → Thread… → Combine).
    const allClips = targetClips
      .flatMap((idea) => idea.clips)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((clip, index) => ({ ...clip, isPrimary: index === 0 }));
    const now = Date.now();

    const mergedProject: SongIdea = {
      id: projectId,
      title: generatedTitle,
      notes: "",
      status: "seed",
      completionPct: 0,
      kind: "project",
      collectionId: screen.collectionId,
      clips: allClips,
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

    // Folding N clips into one sketch drops N − 1 ideas while every take stays: on a
    // small library that reads as a large loss to the persist guard, which would lock
    // saving for the session (2026-10-23). It is a deliberate gather — authorize it.
    authorizeIntentionalEmptyStateWrite(6);
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
    selection.showUndo(t("collection.madeSketchUndo", { title: generatedTitle }), () => {
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
        pickerFooter={
          screen.pickerMode ? (
            <CollectionPickerFooter
              onLayout={(height) => {
                screen.setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
              }}
            />
          ) : null
        }
        workspaceId={screen.activeWorkspaceId ?? undefined}
        listSelectionMode={screen.listSelectionMode}
        selectedHiddenIdeaIds={selectedHiddenIdeaIds}
        selectedClipIdeasCount={selectedClipIdeasInList.length}
        selectableIdeaIds={selectableIdeaIds}
        orderedIdeaIds={selectableIdeaIds}
        selectedHiddenOnly={selectedHiddenOnly}
        selectedInteractiveIdeasCount={selectedInteractiveIdeas.length}
        onCreateProjectFromSelection={createProjectFromSelection}
        onPlaySelected={() => {
          void playQueueInPlayer(buildPlayableQueueFromIdeas(orderedSelectedInteractiveIdeas));
          // A chosen action ends selection mode — it shouldn't linger after "Play".
          useStore.getState().cancelListSelection();
        }}
        onAddToQueue={() => {
          const additions = buildPlayableQueueFromIdeas(orderedSelectedInteractiveIdeas);
          if (additions.length === 0) return;
          useStore.getState().appendToPlayerQueue(additions);
          useStore.getState().cancelListSelection();
          haptic.success();
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
        onQuickRecord={() => {
          useStore.getState().requestInlineStop();
          useStore.getState().requestPlayerClose();
          appActions.quickRecordIdea(screen.collectionId!);
          screen.navigateRoot("Recording");
        }}
        hideRecord={screen.isReceivedWorkspace}
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
            <Press
              haptic="none"
              style={styles.ideasUndoBtn}
              onPress={selection.triggerUndo}
            >
              <Text style={styles.ideasUndoBtnText}>{t("collectionActions.undo")}</Text>
            </Press>
          </View>
        </View>
      ) : null}
    </>
  );
}
