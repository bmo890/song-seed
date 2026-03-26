import { Pressable, Text, View } from "react-native";
import { styles } from "../../../styles";
import { IdeaListSelectionZone } from "../components/IdeaListSelectionZone";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { createEmptyProjectLyrics } from "../../../state/dataSlice";
import { buildDefaultIdeaTitle, ensureUniqueIdeaTitle } from "../../../utils";
import type { SongIdea } from "../../../types";
import { useStore } from "../../../state/useStore";
import { getDateBucket } from "../../../dateBuckets";
import { getIdeaSortTimestamp } from "../../../ideaSort";
import { buildPlayableQueueFromIdeas } from "../../../clipPresentation";

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
    useStore.getState().setPlayerQueue(queue, 0, true);
    screen.navigateRoot("Player");
  };

  const deleteSelectedIdeasWithUndo = async () => {
    if (screen.selectedListIdeaIds.length === 0) return;
    const selectedIdeaIds = new Set(screen.selectedListIdeaIds);
    const activeInlineIdeaId = inlinePlayer.inlineTarget?.ideaId;
    const activePlayerIdeaId = useStore.getState().playerTarget?.ideaId;

    if (activeInlineIdeaId && selectedIdeaIds.has(activeInlineIdeaId)) {
      await inlinePlayer.resetInlinePlayer();
    }

    if (activePlayerIdeaId && selectedIdeaIds.has(activePlayerIdeaId)) {
      useStore.getState().requestPlayerClose();
      useStore.getState().clearPlayerQueue();
    }

    const previousIdeas = screen.ideas;
    const deletedCount = screen.selectedListIdeaIds.length;
    appActions.deleteSelectedIdeasFromList();
    selection.showUndo(`Deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}`, () => {
      useStore.getState().updateIdeas(() => previousIdeas);
    });
  };

  const hideIdeasFromList = async (ideaIds: string[]) => {
    if (!screen.collectionId) return;
    const nextIdeaIds = Array.from(new Set(ideaIds));
    if (nextIdeaIds.length === 0) return;
    const activeIdeaId = inlinePlayer.inlineTarget?.ideaId;
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
    const previousIdeas = screen.ideas;
    const projectId = `idea-${Date.now()}`;
    const generatedTitle = ensureUniqueIdeaTitle(
      buildDefaultIdeaTitle(),
      screen.ideas.map((idea) => idea.title)
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
    useStore.getState().updateIdeas((prev) => [
      mergedProject,
      ...prev.filter((idea) => !selectedClipIds.includes(idea.id)),
    ]);
    useStore.getState().cancelListSelection();
    selection.showUndo(`Created song "${generatedTitle}"`, () => {
      useStore.getState().updateIdeas(() => previousIdeas);
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
