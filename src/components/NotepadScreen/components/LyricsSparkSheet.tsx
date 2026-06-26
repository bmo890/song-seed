import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  onNewWordLadder: () => void;
  onNewCutUp: () => void;
};

export function LyricsSparkSheet({ visible, onClose, onNewWordLadder, onNewCutUp }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>Lyrics Spark</Text>
      <Text style={sheetStyles.subtitle}>Short exercises to knock loose a line you wouldn't write on purpose.</Text>

      <Pressable
        style={({ pressed }) => [sheetStyles.option, pressed ? appStyles.pressDown : null]}
        onPress={onNewWordLadder}
      >
        <View style={sheetStyles.iconWrap}>
          <Ionicons name="shuffle-outline" size={18} color={colors.primary} />
        </View>
        <View style={sheetStyles.optionCopy}>
          <Text style={sheetStyles.optionTitle}>Word Ladder</Text>
          <Text style={sheetStyles.optionBody}>
            Pair two columns of words to find lyric lines you wouldn't have written on purpose.
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [sheetStyles.option, pressed ? appStyles.pressDown : null]}
        onPress={onNewCutUp}
      >
        <View style={sheetStyles.iconWrap}>
          <Ionicons name="cut-outline" size={18} color={colors.primary} />
        </View>
        <View style={sheetStyles.optionCopy}>
          <Text style={sheetStyles.optionTitle}>Cut-Up</Text>
          <Text style={sheetStyles.optionBody}>
            Slice a stuck lyric into strips, shuffle them, and rebuild it into something new.
          </Text>
        </View>
      </Pressable>
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...textTokens.supporting,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  optionBody: {
    ...textTokens.supporting,
    fontSize: 12,
  },
});
