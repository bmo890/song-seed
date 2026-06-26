import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors } from "../../../design/tokens";
import type { SongbookDisplayItem } from "../hooks/useSongbookModel";

export function SongbookDetailView({
  items,
  onAddCharts,
  onShare,
  onOpenItem,
  onRemoveItem,
  onDeleteSongbook,
}: {
  items: SongbookDisplayItem[];
  onAddCharts: () => void;
  onShare: () => void;
  onOpenItem: (item: SongbookDisplayItem) => void;
  onRemoveItem: (itemId: string) => void;
  onDeleteSongbook: () => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.rowButtons}>
        <Button label="Add Charts" onPress={onAddCharts} />
        {items.length > 0 ? <Button variant="secondary" label="Share" onPress={onShare} /> : null}
        <Button variant="secondary" label="Delete" onPress={onDeleteSongbook} />
      </View>

      <View style={styles.listContent}>
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.cardTop, pressed && item.available ? styles.pressDown : null]}
              onPress={() => item.onOpen && onOpenItem(item)}
              disabled={!item.available}
            >
              <View style={styles.cardTitleRow}>
                <Ionicons
                  name={item.metaLabel === "CHORDS" ? "grid-outline" : "document-text-outline"}
                  size={18}
                  color={item.available ? "#0f172a" : "#9ca3af"}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => onRemoveItem(item.id)} hitSlop={8} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          </View>
        ))}

        {items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No charts yet</Text>
            <Text style={styles.cardMeta}>Add lyric or chord charts from any song in your workspaces.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
