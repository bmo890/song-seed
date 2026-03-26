import { FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import type { TimelineClipEntry } from "../../../clipGraph";
import type { ClipCardContextProps } from "../../IdeaDetailScreen/ClipCard";
import { LineageClipCard } from "../../IdeaDetailScreen/components/LineageClipCard";
import { clipLineageStyles, styles } from "../styles";

type SortMode = "chronological" | "custom";

type ClipLineageListProps = {
  sortMode: SortMode;
  clipEntries: TimelineClipEntry[];
  clipCardContext: ClipCardContextProps;
  bottomPadding: number;
  onDragEnd: ({ data }: { data: TimelineClipEntry[] }) => void;
};

export function ClipLineageList({
  sortMode,
  clipEntries,
  clipCardContext,
  bottomPadding,
  onDragEnd,
}: ClipLineageListProps) {
  const contentContainerStyle = [
    styles.songDetailClipListContent,
    { paddingBottom: bottomPadding },
  ];

  if (sortMode === "custom") {
    const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<TimelineClipEntry>) => (
      <View
        style={[
          clipLineageStyles.draggableRow,
          isActive ? clipLineageStyles.draggableRowActive : null,
        ]}
      >
        <LineageClipCard entry={item} context={clipCardContext} />
        <Pressable
          style={({ pressed }) => [
            clipLineageStyles.dragHandle,
            pressed ? styles.pressDown : null,
          ]}
          onLongPress={drag}
          delayLongPress={120}
          hitSlop={10}
        >
          <Ionicons name="reorder-three" size={16} color="#64748b" />
        </Pressable>
      </View>
    );

    return (
      <DraggableFlatList
        data={clipEntries}
        keyExtractor={(item) => item.clip.id}
        renderItem={renderDraggableItem}
        onDragEnd={onDragEnd}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <FlatList
      data={clipEntries}
      keyExtractor={(item) => item.clip.id}
      style={styles.songDetailClipList}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <LineageClipCard entry={item} context={clipCardContext} />}
    />
  );
}
