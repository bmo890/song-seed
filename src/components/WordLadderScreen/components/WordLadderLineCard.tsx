import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing } from "../../../design/tokens";
import type { WordLadderLine } from "../../../types";

type Props = {
  line: WordLadderLine;
  isActive?: boolean;
  drag?: () => void;
  onChangeText: (text: string) => void;
  onToggleStar: () => void;
  onDelete: () => void;
};

function wobbleFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return ((hash % 5) - 2) * 0.5; // -1deg .. 1deg, subtle so typing stays legible
}

export function WordLadderLineCard({ line, isActive, drag, onChangeText, onToggleStar, onDelete }: Props) {
  return (
    <View
      style={[
        cardStyles.card,
        line.starred ? cardStyles.cardStarred : null,
        isActive ? cardStyles.cardActive : { transform: [{ rotate: `${wobbleFor(line.id)}deg` }] },
      ]}
    >
      <View style={cardStyles.tornEdge} />
      <View style={cardStyles.row}>
        <TextInput
          style={cardStyles.textInput}
          value={line.text}
          onChangeText={onChangeText}
          multiline
          placeholder="A lyric scrap…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={({ pressed }) => [cardStyles.starBtn, pressed ? appStyles.pressDown : null]} onPress={onToggleStar} hitSlop={6}>
          <Ionicons
            name={line.starred ? "star" : "star-outline"}
            size={18}
            color={line.starred ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={cardStyles.footer}>
        <Pressable
          style={({ pressed }) => [cardStyles.footerBtn, pressed ? appStyles.pressDown : null]}
          onLongPress={drag}
          delayLongPress={120}
          hitSlop={4}
        >
          <Ionicons name="reorder-three" size={15} color={colors.textMuted} />
        </Pressable>
        <View style={cardStyles.footerSpacer} />
        <Pressable style={({ pressed }) => [cardStyles.footerBtn, pressed ? appStyles.pressDown : null]} onPress={onDelete} hitSlop={4}>
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardStarred: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardActive: {
    ...shadows.cardActive,
    transform: [{ rotate: "0deg" }, { scale: 1.02 }],
  },
  tornEdge: {
    position: "absolute",
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 2,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.round,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
    paddingTop: 2,
  },
  starBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  footerBtn: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  footerSpacer: {
    flex: 1,
  },
});
