import { FlatList, Pressable } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import type { TimelineClipEntry } from "../../../clipGraph";
import type { ClipCardContextProps } from "../../IdeaDetailScreen/ClipCard";
import { LineageClipCard } from "../../IdeaDetailScreen/components/LineageClipCard";
import { styles } from "../styles";

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
      <Pressable
        onLongPress={drag}
        delayLongPress={200}
        disabled={isActive}
        style={isActive ? { opacity: 0.9, transform: [{ scale: 1.02 }] } : undefined}
      >
        <LineageClipCard entry={item} context={clipCardContext} />
      </Pressable>
    );

    return (
      <DraggableFlatList
        data={clipEntries}
        keyExtractor={(item) => item.clip.id}
        renderItem={renderDraggableItem}
        onDragEnd={onDragEnd}
        style={styles.songDetailClipList}
        contentContainerStyle={contentContainerStyle}
      />
    );
  }

  return (
    <FlatList
      data={clipEntries}
      keyExtractor={(item) => item.clip.id}
      style={styles.songDetailClipList}
      contentContainerStyle={contentContainerStyle}
      renderItem={({ item }) => <LineageClipCard entry={item} context={clipCardContext} />}
    />
  );
}
