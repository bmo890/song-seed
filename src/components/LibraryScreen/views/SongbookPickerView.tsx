import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors } from "../../../design/tokens";
import type { SongbookChartChoice } from "../hooks/useSongbookModel";

type PickerWorkspace = { id: string; title: string; songs: Array<{ id: string; title: string }> };
type ChartRow = { key: string; label: string; choice: SongbookChartChoice };

export function SongbookPickerView({
  ideaId,
  songTitle,
  workspaces,
  charts,
  selectedKeys,
  onSelectSong,
  onToggle,
  onConfirm,
}: {
  ideaId: string | null;
  songTitle: string | null;
  workspaces: PickerWorkspace[];
  charts: ChartRow[];
  selectedKeys: Set<string>;
  onSelectSong: (workspaceId: string, ideaId: string) => void;
  onToggle: (choice: SongbookChartChoice) => void;
  onConfirm: () => void;
}) {
  if (!ideaId) {
    return (
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.libraryScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardMeta}>Pick a song, then choose which charts to add.</Text>
        <View style={styles.listContent}>
          {workspaces.map((workspace) => (
            <View key={workspace.id}>
              <Text style={[styles.cardMeta, { marginTop: 12, marginBottom: 4 }]}>{workspace.title}</Text>
              {workspace.songs.map((song) => (
                <Pressable
                  key={song.id}
                  style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                  onPress={() => onSelectSong(workspace.id, song.id)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="musical-notes-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {song.title}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          {workspaces.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>No songs with charts yet.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  const selectedCount = charts.filter((c) => selectedKeys.has(c.key)).length;

  return (
    <View style={styles.flexFill}>
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.libraryScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardTitle}>{songTitle}</Text>
        <Text style={[styles.cardMeta, { marginBottom: 8 }]}>Choose charts to add to the songbook.</Text>
        <View style={styles.listContent}>
          {charts.map((chart) => {
            const checked = selectedKeys.has(chart.key);
            return (
              <Pressable
                key={chart.key}
                style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
                onPress={() => onToggle(chart.choice)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name={chart.choice.kind === "chordChart" ? "grid-outline" : "document-text-outline"}
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text style={styles.cardTitle}>{chart.label}</Text>
                  </View>
                  <Ionicons
                    name={checked ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={checked ? colors.primary : colors.borderMuted}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.inputRow}>
        <Button label={selectedCount > 0 ? `Add ${selectedCount}` : "Done"} onPress={onConfirm} />
      </View>
    </View>
  );
}
