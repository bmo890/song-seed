import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { getHierarchyIconName } from "../../hierarchy";
import { ActionButtons } from "./ActionButtons";
import { IdeaSelectionBar } from "./IdeaSelectionBar";

type IdeaListSelectionZoneProps = {
  listSelectionMode: boolean;
  selectedHiddenIdeaIds: string[];
  selectedClipIdeasCount: number;
  selectedProjectsCount: number;
  selectableIdeaIds: string[];
  selectedHiddenOnly: boolean;
  selectedInteractiveIdeasCount: number;
  onCreateProjectFromSelection: () => void;
  onPlaySelected: () => void;
  onToggleHideSelected: () => void;
  onDeleteSelected: () => void;
  onAddProject: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
  onFloatingDockLayout: (height: number) => void;
  onSelectionDockLayout: (height: number) => void;
};

export function IdeaListSelectionZone({
  listSelectionMode,
  selectedHiddenIdeaIds,
  selectedClipIdeasCount,
  selectedProjectsCount,
  selectableIdeaIds,
  selectedHiddenOnly,
  selectedInteractiveIdeasCount,
  onCreateProjectFromSelection,
  onPlaySelected,
  onToggleHideSelected,
  onDeleteSelected,
  onAddProject,
  onQuickRecord,
  onImportAudio,
  onFloatingDockLayout,
  onSelectionDockLayout,
}: IdeaListSelectionZoneProps) {
  return (
    <>
      {listSelectionMode && selectedHiddenIdeaIds.length === 0 && selectedClipIdeasCount > 0 ? (
        <View style={styles.listRowWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.cardFlex,
              styles.ideasGhostProjectRow,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onCreateProjectFromSelection}
          >
            <View style={styles.ideasListCardRow}>
              <View style={[styles.ideasInlinePlayBtn, styles.ideasGhostProjectIcon]}>
                <Ionicons name={getHierarchyIconName("song")} size={14} color="#166534" />
              </View>
              <View style={styles.ideasListCardMain}>
                <View style={styles.ideasListCardTop}>
                  <View style={styles.ideasListCardTitleRow}>
                    <Ionicons name={getHierarchyIconName("song")} size={14} color="#166534" />
                    <Text style={styles.ideasListCardTitle}>New Song</Text>
                  </View>
                  <Text style={[styles.badge, styles.badgeGhostProject]}>NEW</Text>
                </View>
                <Text style={styles.ideasListCardMeta}>
                  Create a song from {selectedClipIdeasCount} selected clip
                  {selectedClipIdeasCount === 1 ? "" : "s"}.
                  {selectedProjectsCount > 0 ? " Selected songs will be unselected first." : ""}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      {listSelectionMode ? (
        <IdeaSelectionBar
          selectableIdeaIds={selectableIdeaIds}
          disabledIdeaIds={selectedHiddenIdeaIds}
          onPlaySelected={onPlaySelected}
          onToggleHideSelected={onToggleHideSelected}
          hideActionLabel={selectedHiddenOnly ? "Unhide" : "Hide"}
          hideActionDisabled={
            selectedHiddenOnly
              ? selectedHiddenIdeaIds.length === 0
              : selectedInteractiveIdeasCount === 0
          }
          onDeleteSelected={onDeleteSelected}
          onDockLayout={onSelectionDockLayout}
        />
      ) : (
        <ActionButtons
          onAddProject={onAddProject}
          onQuickRecord={onQuickRecord}
          onImportAudio={onImportAudio}
          onDockLayout={onFloatingDockLayout}
        />
      )}
    </>
  );
}
