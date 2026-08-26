import { Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { Button } from "../../common/Button";
import { EmptyState } from "../../common/EmptyState";
import { styles } from "../styles";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Setlist } from "../../../types";
import { useTranslation } from "react-i18next";

export function SetlistListView({
  setlists,
  onCreate,
  onOpen,
  scroll,
}: {
  setlists: Setlist[];
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
      {setlists.length > 0 ? (
        <View style={styles.inputRow}>
          <Button label={t("library.createSetlist")} onPress={onCreate} />
        </View>
      ) : null}

      <View style={styles.listContent}>
        {setlists.map((setlist) => (
          <Pressable
            key={setlist.id}
            style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
            onPress={() => onOpen(setlist.id)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="albums-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>{setlist.title}</Text>
              </View>
              <Ionicons name={dirIcon("chevron-forward")} size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.cardMeta}>
              {t("library.songs", { count: setlist.entries.length })}
            </Text>
          </Pressable>
        ))}

        {setlists.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title={t("library.noSetlists")}
            body={t("library.setlistEmptyBody")}
            actionLabel={t("library.createSetlist")}
            onAction={onCreate}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
