import { Pressable, Text, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import type { Playlist } from "../../../types";
import type { PlaylistDisplayItem } from "../types";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";

function getPlaylistItemTypeIcon(kind: Playlist["items"][number]["kind"]) {
  return kind === "song" ? getHierarchyIconName("song") : getHierarchyIconName("clip");
}

export function PlaylistDetailView({
  playlist,
  displayItems,
  onAddItems,
  onOpenItem,
  onRemoveItem,
  onReorderItems,
}: {
  playlist: Playlist;
  displayItems: PlaylistDisplayItem[];
  onAddItems: () => void;
  onOpenItem: (item: PlaylistDisplayItem) => void;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (orderedItemIds: string[]) => void;
}) {
  return (
    <DraggableFlatList
      data={displayItems}
      keyExtractor={(item) => item.id}
      onDragEnd={({ data }) => onReorderItems(data.map((item) => item.id))}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.libraryDetailHeader}>
          <View style={styles.settingsSummaryPanel}>
            <Text style={styles.settingsSummaryTitle}>{playlist.title}</Text>
            <Text style={styles.settingsSummaryMeta}>
              {playlist.items.length} saved {playlist.items.length === 1 ? "item" : "items"}.
              Long press and drag the handle to reorder them. This playlist stays separate from the queue.
            </Text>
            <View style={styles.settingsActionRow}>
              <Button label="Add Items" onPress={onAddItems} />
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Playlist is empty</Text>
          <Text style={styles.cardMeta}>
            Add songs or clips to start organizing listening groups here.
          </Text>
        </View>
      }
      renderItem={({ item, drag, isActive }) => (
        <View
          style={[
            styles.libraryPlaylistItemRow,
            isActive ? styles.libraryPlaylistItemRowActive : null,
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.libraryPlaylistItemMain,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => onOpenItem(item)}
            disabled={!item.available}
          >
            <View style={styles.libraryPlaylistItemTitleRow}>
              <View style={styles.libraryPlaylistItemTypePill}>
                <Ionicons
                  name={getPlaylistItemTypeIcon(item.kind)}
                  size={11}
                  color={getHierarchyIconColor(item.kind === "song" ? "song" : "clip")}
                />
                <Text style={styles.libraryPlaylistItemTypeText}>{item.metaLabel}</Text>
              </View>
              {!item.available ? (
                <View style={styles.libraryPlaylistItemUnavailablePill}>
                  <Text style={styles.libraryPlaylistItemUnavailableText}>Missing</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.subtitle}</Text>
          </Pressable>

          <View style={styles.libraryPlaylistItemActions}>
            <Pressable
              style={({ pressed }) => [
                styles.collectionInlineActionBtn,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onRemoveItem(item.id)}
            >
              <Ionicons name="close" size={14} color="#64748b" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.collectionInlineActionBtn,
                pressed ? styles.pressDown : null,
              ]}
              onLongPress={drag}
              delayLongPress={120}
            >
              <Ionicons name="reorder-three" size={15} color="#64748b" />
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}
