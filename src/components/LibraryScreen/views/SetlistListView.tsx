import { Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import type { Setlist } from "../../../types";
import { useTranslation } from "react-i18next";

export function SetlistListView({
  setlists,
  onCreate,
  onOpen,
}: {
  setlists: Setlist[];
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inputRow}>
        <Button label={t("library.createSetlist")} onPress={onCreate} />
      </View>

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
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.cardMeta}>
              {setlist.entries.length} {setlist.entries.length === 1 ? "song" : "songs"}
            </Text>
          </Pressable>
        ))}

        {setlists.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("library.noSetlists")}</Text>
            <Text style={styles.cardMeta}>
              Build an ordered set of songs — pick the clips and charts each one needs — then share it as a
              ready-to-play file for your band.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
