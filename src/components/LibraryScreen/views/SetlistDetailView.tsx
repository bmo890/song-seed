import { Pressable, Text, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { SetlistDisplayEntry } from "../hooks/useSetlistModel";

export function SetlistDetailView({
  entries,
  onAddSong,
  onShare,
  onEditEntry,
  onReorder,
  onRemoveEntry,
  onDeleteSetlist,
}: {
  entries: SetlistDisplayEntry[];
  onAddSong: () => void;
  onShare: () => void;
  onEditEntry: (entryId: string) => void;
  onReorder: (orderedEntryIds: string[]) => void;
  onRemoveEntry: (entryId: string) => void;
  onDeleteSetlist: () => void;
}) {
  const header = (
    <View style={styles.rowButtons}>
      <Button label="Add Song" onPress={onAddSong} />
      {entries.length > 0 ? <Button variant="secondary" label="Share" onPress={onShare} /> : null}
      <Button variant="secondary" label="Delete" onPress={onDeleteSetlist} />
    </View>
  );

  if (entries.length === 0) {
    return (
      <View style={[styles.flexFill, styles.libraryScrollContent]}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No songs yet</Text>
          <Text style={styles.cardMeta}>Add a song and choose which clips and charts to include.</Text>
        </View>
      </View>
    );
  }

  return (
    <DraggableFlatList
      data={entries}
      keyExtractor={(entry) => entry.id}
      onDragBegin={haptic.grab}
      onDragEnd={({ data }) => onReorder(data.map((entry) => entry.id))}
      containerStyle={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      renderItem={({ item: entry, drag, isActive, getIndex }: RenderItemParams<SetlistDisplayEntry>) => (
        <View style={[styles.card, isActive ? { opacity: 0.9 } : null]}>
          <View style={styles.cardTop}>
            <Pressable
              style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed ? styles.pressDown : null]}
              onPress={() => onEditEntry(entry.id)}
              disabled={!entry.available}
            >
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardMeta, { width: 22 }]}>{(getIndex() ?? 0) + 1}.</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {entry.subtitle} • {entry.summary}
                  </Text>
                </View>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Pressable onLongPress={drag} delayLongPress={120} hitSlop={6} style={{ padding: 4 }}>
                <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => onRemoveEntry(entry.id)} hitSlop={6} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    />
  );
}
