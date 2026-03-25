import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock } from "../../common/SelectionDock";
import { styles } from "../styles";
import type { Workspace } from "../../../types";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";
import type { PlaylistPickerState, PlaylistPickerSelection } from "../types";
import { usePlaylistPicker } from "../hooks/usePlaylistPicker";

export function PlaylistPickerView({
  workspaces,
  pickerState,
  onChangePickerState,
  onCancel,
  onConfirm,
}: {
  workspaces: Workspace[];
  pickerState: PlaylistPickerState;
  onChangePickerState: (next: PlaylistPickerState | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const model = usePlaylistPicker({
    workspaces,
    pickerState,
    onChangePickerState,
    onConfirm,
  });

  return (
    <View style={styles.flexFill}>
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={[
          styles.libraryScrollContent,
          {
            paddingBottom:
              pickerState.selectedItems.length > 0 ? model.selectionDockHeight + 24 + 24 : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!model.workspace ? (
          <View style={styles.listContent}>
            {workspaces.map((workspace) => (
              <Pressable
                key={workspace.id}
                style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                onPress={() =>
                  onChangePickerState({
                    ...pickerState,
                    workspaceId: workspace.id,
                    collectionId: null,
                    songIdeaId: null,
                  })
                }
              >
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={getHierarchyIconName("workspace")}
                    size={18}
                    color={getHierarchyIconColor("workspace")}
                  />
                  <Text style={styles.cardTitle}>{workspace.title}</Text>
                </View>
                <Text style={styles.cardMeta}>
                  {workspace.collections.length}{" "}
                  {workspace.collections.length === 1 ? "collection" : "collections"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {model.workspace && !model.collection ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  workspaceId: null,
                  collectionId: null,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>Choose another workspace</Text>
            </Pressable>

            {model.collectionEntries.map((entry) => (
              <Pressable
                key={entry.collection.id}
                style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                onPress={() =>
                  onChangePickerState({
                    ...pickerState,
                    collectionId: entry.collection.id,
                    songIdeaId: null,
                  })
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name={getHierarchyIconName("collection")}
                      size={18}
                      color={getHierarchyIconColor("collection")}
                    />
                    <Text style={styles.cardTitle}>{entry.collection.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </View>
                <Text style={styles.cardMeta}>
                  {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
                </Text>
              </Pressable>
            ))}

            {model.collectionEntries.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No collections yet</Text>
                <Text style={styles.cardMeta}>
                  Create a collection in this workspace before adding items to playlists.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {model.workspace && model.collection && !model.selectedSongIdea ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  collectionId: null,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>{model.workspace.title}</Text>
            </Pressable>

            {model.childCollections.length > 0 ? (
              <View style={styles.libraryPickerSection}>
                <Text style={styles.workspaceBrowseSectionTitle}>Subcollections</Text>
                {model.childCollections.map((child) => (
                  <Pressable
                    key={child.id}
                    style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                    onPress={() =>
                      onChangePickerState({
                        ...pickerState,
                        collectionId: child.id,
                        songIdeaId: null,
                      })
                    }
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleRow}>
                        <Ionicons
                            name={getHierarchyIconName("subcollection")}
                            size={18}
                            color={getHierarchyIconColor("subcollection")}
                        />
                        <Text style={styles.cardTitle}>{child.title}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>
                    <Text style={styles.cardMeta}>{model.workspace!.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.libraryPickerSection}>
              <Text style={styles.workspaceBrowseSectionTitle}>Items</Text>
              {model.collectionIdeas.map((idea) => {
                const selection = model.buildIdeaSelection(idea);
                const selected = model.isSelected(selection);

                return (
                  <View key={idea.id} style={styles.libraryPickerItemRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.libraryPickerItemMain,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => model.toggleSelection(selection)}
                    >
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={selected ? "#0f172a" : "#94a3b8"}
                      />
                      <View style={styles.libraryPickerItemCopy}>
                        <Text style={styles.cardTitle}>{idea.title}</Text>
                        <Text style={styles.cardMeta}>
                          {idea.kind === "project" ? "Song" : "Clip"}
                        </Text>
                      </View>
                    </Pressable>
                    {idea.kind === "project" && idea.clips.length > 0 ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.collectionInlineActionBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() =>
                          onChangePickerState({
                            ...pickerState,
                            songIdeaId: idea.id,
                          })
                        }
                      >
                        <Ionicons name="chevron-forward" size={15} color="#64748b" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}

              {model.collectionIdeas.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>No items in this collection</Text>
                  <Text style={styles.cardMeta}>
                    Try a subcollection or pick a different collection.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {model.workspace && model.collection && model.selectedSongIdea ? (
          <View style={styles.listContent}>
            <Pressable
              style={({ pressed }) => [styles.libraryPickerBackRow, pressed ? styles.pressDown : null]}
              onPress={() =>
                onChangePickerState({
                  ...pickerState,
                  songIdeaId: null,
                })
              }
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
              <Text style={styles.libraryPickerBackText}>{model.selectedSongIdea.title}</Text>
            </Pressable>

            {model.selectedSongIdea.clips.map((clip) => {
              const selection: PlaylistPickerSelection = {
                kind: "clip",
                workspaceId: model.workspace!.id,
                collectionId: model.selectedSongIdea!.collectionId,
                ideaId: model.selectedSongIdea!.id,
                clipId: clip.id,
              };
              const selected = model.isSelected(selection);

              return (
                <Pressable
                  key={clip.id}
                  style={({ pressed }) => [
                    styles.libraryPickerItemRow,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => model.toggleSelection(selection)}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={selected ? "#0f172a" : "#94a3b8"}
                  />
                  <View style={styles.libraryPickerItemCopy}>
                    <Text style={styles.cardTitle}>{clip.title}</Text>
                    <Text style={styles.cardMeta}>
                      {clip.isPrimary ? "Primary take" : "Clip version"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {pickerState.selectedItems.length > 0 ? (
        <>
          <SelectionDock
            count={pickerState.selectedItems.length}
            actions={model.selectionDockActions}
            onDone={onCancel}
            onLayout={(height) => {
              model.setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
            }}
          />
          <SelectionActionSheet
            visible={model.selectionMoreVisible}
            title="Playlist picker actions"
            actions={model.selectionSheetActions}
            onClose={() => model.setSelectionMoreVisible(false)}
          />
        </>
      ) : null}
    </View>
  );
}
