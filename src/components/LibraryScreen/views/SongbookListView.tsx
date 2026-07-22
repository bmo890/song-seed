import { Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Songbook } from "../../../types";
import { useTranslation } from "react-i18next";

export function SongbookListView({
  songbooks,
  onCreate,
  onOpen,
  scroll,
}: {
  songbooks: Songbook[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  scroll?: ScrollOffset;
}) {
  const { t } = useTranslation();
  const { ref: scrollRef, ...scrollHandlers } = usePersistedScrollView(scroll);
  return (
    <ScrollView
      ref={scrollRef}
      {...scrollHandlers}
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inputRow}>
        <Button label={t("library.createSongbook")} onPress={onCreate} />
      </View>

      <View style={styles.listContent}>
        {songbooks.map((songbook) => (
          <Pressable
            key={songbook.id}
            style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
            onPress={() => onOpen(songbook.id)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="book-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>{songbook.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.cardMeta}>
              {songbook.items.length} {songbook.items.length === 1 ? "chart" : "charts"}
            </Text>
          </Pressable>
        ))}

        {songbooks.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("library.noSongbooks")}</Text>
            <Text style={styles.cardMeta}>
              Collect lyric and chord charts from any workspace into a songbook to keep your written music
              together.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
