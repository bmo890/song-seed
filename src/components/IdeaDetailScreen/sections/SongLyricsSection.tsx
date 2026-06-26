import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LyricsVersionsPanel } from "../../LyricsScreen/LyricsVersionsPanel";
import { styles } from "../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongLyricsSection() {
  const { screen } = useSongScreen();
  const navigation = useNavigation<any>();
  const idea = screen.selectedIdea;
  if (idea?.kind !== "project" || screen.isEditMode || screen.songTab !== "lyrics") {
    return null;
  }

  const hasChordSheet = !!idea.chordSheet && idea.chordSheet.sections.length > 0;

  return (
    <CollapsingTabStage
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
    >
      <Pressable
        style={({ pressed }) => [chordCard.card, pressed ? { opacity: 0.85 } : null]}
        onPress={() => navigation.navigate("ChordSheet", { ideaId: idea.id })}
      >
        <View style={chordCard.iconWrap}>
          <Ionicons name="grid-outline" size={18} color={colors.primary} />
        </View>
        <View style={chordCard.copy}>
          <Text style={chordCard.title}>Chord Chart</Text>
          <Text style={chordCard.meta}>
            {hasChordSheet
              ? "Block chart of chords by section"
              : "Lay out chords in bars — intro, verse, chorus"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <LyricsVersionsPanel projectIdea={idea} />
    </CollapsingTabStage>
  );
}

const chordCard = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
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
