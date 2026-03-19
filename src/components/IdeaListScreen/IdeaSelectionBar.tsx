import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { shareAudioClips } from "../../services/audioStorage";
import { appActions } from "../../state/actions";

type IdeaSelectionBarProps = {
  selectableIdeaIds: string[];
  disabledIdeaIds?: string[];
  onPlaySelected: () => void;
  onToggleHideSelected: () => void;
  hideActionLabel: "Hide" | "Unhide";
  hideActionDisabled?: boolean;
  onDeleteSelected: () => void;
  onDockLayout?: (height: number) => void;
};

export function IdeaSelectionBar({
  selectableIdeaIds,
  disabledIdeaIds = [],
  onPlaySelected,
  onToggleHideSelected,
  hideActionLabel,
  hideActionDisabled,
  onDeleteSelected,
  onDockLayout,
}: IdeaSelectionBarProps) {
  const [isSharing, setIsSharing] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomOffset = 12 + Math.max(insets.bottom, 12);
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaces = useStore((s) => s.workspaces);
  const replaceListSelection = useStore((s) => s.replaceListSelection);
  const disabledIdeaIdSet = new Set(disabledIdeaIds);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const selectedIdeas = (activeWorkspace?.ideas ?? []).filter((idea) => selectedListIdeaIds.includes(idea.id));
  const interactiveSelectedIdeas = selectedIdeas.filter((idea) => !disabledIdeaIdSet.has(idea.id));
  const selectedClipIdeas = selectedIdeas.filter((idea) => idea.kind === "clip");
  const selectedProjects = selectedIdeas.filter((idea) => idea.kind === "project");

  const playbackQueue = interactiveSelectedIdeas
    .map((idea) => {
      if (idea.kind === "clip") {
        return idea.clips.find((clip) => !!clip.audioUri) ?? null;
      }
      return idea.clips.find((clip) => clip.isPrimary && !!clip.audioUri) ?? idea.clips.find((clip) => !!clip.audioUri) ?? null;
    })
    .filter(Boolean);

  const shareableClips = interactiveSelectedIdeas
    .map((idea) => {
      const clip =
        idea.kind === "clip"
          ? idea.clips.find((candidate) => !!candidate.audioUri) ?? null
          : idea.clips.find((candidate) => candidate.isPrimary && !!candidate.audioUri) ??
            idea.clips.find((candidate) => !!candidate.audioUri) ??
            null;
      if (!clip?.audioUri) return null;
      return {
        title: clip.title || idea.title,
        audioUri: clip.audioUri,
      };
    })
    .filter((clip): clip is { title: string; audioUri: string } => !!clip);

  const allSelectableSelected =
    selectableIdeaIds.length > 0 && selectableIdeaIds.every((id) => selectedListIdeaIds.includes(id));
  const canDeselectAll = allSelectableSelected || (selectableIdeaIds.length === 0 && selectedListIdeaIds.length > 0);

  async function handleShareSelected() {
    if (shareableClips.length === 0 || isSharing) return;

    try {
      setIsSharing(true);
      await shareAudioClips(
        shareableClips,
        activeWorkspace?.title ? `${activeWorkspace.title} Selection` : "SongSeed Selection"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not share the selected items.";
      Alert.alert("Share failed", message);
    } finally {
      setIsSharing(false);
    }
  }

  function handleClipboardAction(mode: "copy" | "move") {
    appActions.startClipboardFromList(mode);
    Alert.alert(
      mode === "copy" ? "Copy ready" : "Move ready",
      mode === "copy"
        ? "Tap \"Paste items here\" in this or another collection to finish copying these items."
        : "Open the destination collection and tap \"Paste items here\" to finish moving these items."
    );
  }

  function confirmDeleteSelection() {
    const projectNames = selectedProjects.map((project) => project.title).slice(0, 4);
    const projectList = projectNames.length > 0 ? `\n\nSongs: ${projectNames.join(", ")}${selectedProjects.length > 4 ? "…" : ""}` : "";
    const message =
      selectedProjects.length > 0
        ? `This will delete ${selectedProjects.length} song${selectedProjects.length === 1 ? "" : "s"} and all contained clips, plus ${selectedClipIdeas.length} standalone clip${selectedClipIdeas.length === 1 ? "" : "s"}.${projectList}`
        : `Are you sure you want to delete ${selectedClipIdeas.length} selected clip${selectedClipIdeas.length === 1 ? "" : "s"}?`;

    Alert.alert("Delete selected items?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDeleteSelected },
    ]);
  }

  return (
    <View
      style={[styles.ideasSelectionDock, { bottom: bottomOffset }]}
      onLayout={(event) => {
        onDockLayout?.(event.nativeEvent.layout.height);
      }}
    >
      <View style={styles.ideasSelectionDockHeader}>
        <Text style={styles.ideasSelectionCount}>{selectedListIdeaIds.length} selected</Text>
        <View style={styles.ideasSelectionHeaderActions}>
          <Pressable
            style={({ pressed }) => [styles.ideasSelectionHeaderBtn, pressed ? styles.pressDown : null]}
            disabled={!canDeselectAll && selectableIdeaIds.length === 0}
            onPress={() => replaceListSelection(canDeselectAll ? [] : selectableIdeaIds)}
          >
            <Text style={styles.ideasSelectionHeaderBtnText}>{canDeselectAll ? "Deselect all" : "Select all"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ideasSelectionHeaderBtn, pressed ? styles.pressDown : null]}
            onPress={() => useStore.getState().cancelListSelection()}
          >
            <Text style={styles.ideasSelectionHeaderBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ideasSelectionActions}
      >
        <Pressable
          style={({ pressed }) => [
            styles.ideasSelectionAction,
            playbackQueue.length === 0 ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          disabled={playbackQueue.length === 0}
          onPress={onPlaySelected}
        >
          <Ionicons name="play" size={15} color="#0f172a" />
          <Text style={styles.ideasSelectionActionText}>{`Play (${playbackQueue.length})`}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.ideasSelectionAction,
            hideActionDisabled ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          disabled={hideActionDisabled}
          onPress={onToggleHideSelected}
        >
          <Ionicons
            name={hideActionLabel === "Unhide" ? "eye-outline" : "eye-off-outline"}
            size={15}
            color="#0f172a"
          />
          <Text style={styles.ideasSelectionActionText}>{hideActionLabel}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.ideasSelectionAction,
            isSharing || shareableClips.length === 0 ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          disabled={isSharing || shareableClips.length === 0}
          onPress={() => {
            void handleShareSelected();
          }}
        >
          <Ionicons name="share-social-outline" size={15} color="#0f172a" />
          <Text style={styles.ideasSelectionActionText}>{isSharing ? "Sharing..." : `Share (${shareableClips.length})`}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ideasSelectionAction, pressed ? styles.pressDown : null]}
          onPress={() => handleClipboardAction("copy")}
        >
          <Ionicons name="copy-outline" size={15} color="#0f172a" />
          <Text style={styles.ideasSelectionActionText}>Copy</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ideasSelectionAction, pressed ? styles.pressDown : null]}
          onPress={() => handleClipboardAction("move")}
        >
          <Ionicons name="arrow-forward-outline" size={15} color="#0f172a" />
          <Text style={styles.ideasSelectionActionText}>Move</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ideasSelectionActionDanger, pressed ? styles.pressDown : null]}
          onPress={confirmDeleteSelection}
        >
          <Ionicons name="trash-outline" size={15} color="#b91c1c" />
          <Text style={styles.ideasSelectionActionDangerText}>Delete</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
