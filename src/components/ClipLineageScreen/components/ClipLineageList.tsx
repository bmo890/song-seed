import { FlatList } from "react-native";
import type { TimelineClipEntry } from "../../../domain/clipGraph";
import type { ClipCardContextProps } from "../../IdeaDetailScreen/ClipCard";
import { LineageClipCard } from "../../IdeaDetailScreen/components/LineageClipCard";
import { styles } from "../styles";

type ClipLineageListProps = {
  clipEntries: TimelineClipEntry[];
  clipCardContext: ClipCardContextProps;
  bottomPadding: number;
};

export function ClipLineageList({
  clipEntries,
  clipCardContext,
  bottomPadding,
}: ClipLineageListProps) {
  return (
    <FlatList
      data={clipEntries}
      keyExtractor={(item) => item.clip.id}
      style={styles.songDetailClipList}
      contentContainerStyle={[
        styles.songDetailClipListContent,
        { paddingBottom: bottomPadding },
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <LineageClipCard entry={item} context={clipCardContext} />}
    />
  );
}
