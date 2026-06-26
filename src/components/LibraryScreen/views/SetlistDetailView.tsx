import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors } from "../../../design/tokens";
import type { SetlistDisplayEntry } from "../hooks/useSetlistModel";

export function SetlistDetailView({
  entries,
  onAddSong,
  onShare,
  onEditEntry,
  onMoveEntry,
  onRemoveEntry,
  onDeleteSetlist,
}: {
  entries: SetlistDisplayEntry[];
  onAddSong: () => void;
  onShare: () => void;
  onEditEntry: (entryId: string) => void;
  onMoveEntry: (entryId: string, dir: -1 | 1) => void;
  onRemoveEntry: (entryId: string) => void;
  onDeleteSetlist: () => void;
}) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.rowButtons}>
        <Button label="Add Song" onPress={onAddSong} />
        {entries.length > 0 ? <Button variant="secondary" label="Share" onPress={onShare} /> : null}
        <Button variant="secondary" label="Delete" onPress={onDeleteSetlist} />
      </View>

      <View style={styles.listContent}>
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Pressable
                style={{ flex: 1, minWidth: 0 }}
                onPress={() => onEditEntry(entry.id)}
                disabled={!entry.available}
              >
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardMeta, { width: 22 }]}>{index + 1}.</Text>
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
                <Pressable onPress={() => onMoveEntry(entry.id, -1)} hitSlop={6} style={{ padding: 4 }}>
                  <Ionicons name="arrow-up" size={15} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => onMoveEntry(entry.id, 1)} hitSlop={6} style={{ padding: 4 }}>
                  <Ionicons name="arrow-down" size={15} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => onRemoveEntry(entry.id)} hitSlop={6} style={{ padding: 4 }}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {entries.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No songs yet</Text>
            <Text style={styles.cardMeta}>Add a song and choose which clips and charts to include.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
