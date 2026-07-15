import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import { ScreenHeader } from "../../common/ScreenHeader";
import { LyricsVersionsPanel } from "../LyricsVersionsPanel";
import { useLyricsScreenModel } from "../hooks/useLyricsScreenModel";
import { LyricsUnavailableState } from "./LyricsUnavailableState";

export function LyricsScreenContent() {
  const { projectIdea, versionCount } = useLyricsScreenModel();
  const navigation = useNavigation<any>();

  if (!projectIdea) return <LyricsUnavailableState />;

  const hasChordSheet = !!projectIdea.chordSheet && projectIdea.chordSheet.sections.length > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Lyrics"
        leftIcon="back"
        rightElement={
          <View style={styles.contextPill}>
            <Ionicons name="book-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.contextPillText}>{versionCount} {versionCount === 1 ? "PAGE" : "PAGES"}</Text>
          </View>
        }
      />

      <Text style={styles.subtitle}>{projectIdea.title}</Text>

      <ScrollView contentContainerStyle={styles.lyricsScreenContent}>
        <Pressable
          style={({ pressed }) => [chordSheetLink.card, pressed ? styles.pressDown : null]}
          onPress={() => navigation.navigate("ChordSheet", { ideaId: projectIdea.id })}
        >
          <View style={chordSheetLink.iconWrap}>
            <Ionicons name="grid-outline" size={18} color={colors.primary} />
          </View>
          <View style={chordSheetLink.copy}>
            <Text style={chordSheetLink.title}>Chord Chart</Text>
            <Text style={chordSheetLink.meta}>
              {hasChordSheet ? "Block chart of chords by section" : "Lay out chords in bars — intro, verse, chorus"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <LyricsVersionsPanel projectIdea={projectIdea} />
      </ScrollView>

    </SafeAreaView>
  );
}

const chordSheetLink = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 15, color: colors.textPrimary },
  meta: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.textSecondary },
});
