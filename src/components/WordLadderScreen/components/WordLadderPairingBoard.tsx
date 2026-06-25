import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { getUnpairedWords } from "../../../wordLadder";
import type { WordLadderExercise } from "../../../types";

type Props = {
  exercise: WordLadderExercise;
  armedWord: { column: "a" | "b"; wordId: string } | null;
  onTapWord: (column: "a" | "b", wordId: string) => void;
  onUnpair: (pairingId: string) => void;
  onToggleLock: (pairingId: string) => void;
  onShuffle: () => void;
  onMakeLine: (pairingId: string) => void;
};

/** A tiny deterministic wobble so word scraps feel hand-scattered rather
 * than machine-aligned, without re-randomizing on every render. */
function wobbleFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return ((hash % 9) - 4) * 0.6; // roughly -2.4deg .. 2.4deg
}

export function WordLadderPairingBoard({
  exercise,
  armedWord,
  onTapWord,
  onUnpair,
  onToggleLock,
  onShuffle,
  onMakeLine,
}: Props) {
  const unpairedA = getUnpairedWords(exercise.columnA, exercise.pairings, "a");
  const unpairedB = getUnpairedWords(exercise.columnB, exercise.pairings, "b");

  return (
    <ScrollView style={boardStyles.root} showsVerticalScrollIndicator={false}>
      <View style={boardStyles.toolbar}>
        <Text style={boardStyles.hint}>
          {exercise.pairings.length > 0
            ? `${exercise.pairings.length} pair${exercise.pairings.length === 1 ? "" : "s"} on the board`
            : "Tap a word, then tap one across to connect them"}
        </Text>
        <Pressable
          style={({ pressed }) => [boardStyles.shuffleBtn, pressed ? appStyles.pressDown : null]}
          onPress={onShuffle}
        >
          <Ionicons name="shuffle" size={14} color={colors.onPrimary} />
          <Text style={boardStyles.shuffleBtnText}>Shuffle</Text>
        </Pressable>
      </View>

      {exercise.pairings.length === 0 ? null : (
        <View style={boardStyles.pairingList}>
          {exercise.pairings.map((pairing) => {
            const wordA = exercise.columnA.find((w) => w.id === pairing.columnAWordId);
            const wordB = exercise.columnB.find((w) => w.id === pairing.columnBWordId);
            if (!wordA || !wordB) return null;
            return (
              <View
                key={pairing.id}
                style={[boardStyles.pairRow, pairing.locked ? boardStyles.pairRowLocked : null]}
              >
                <Pressable
                  style={({ pressed }) => [boardStyles.lockBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => onToggleLock(pairing.id)}
                  hitSlop={6}
                >
                  <Ionicons
                    name={pairing.locked ? "lock-closed" : "lock-open-outline"}
                    size={14}
                    color={pairing.locked ? colors.primary : colors.textMuted}
                  />
                </Pressable>

                <Text style={boardStyles.pairWord} numberOfLines={1}>
                  {wordA.text}
                </Text>
                <View style={boardStyles.connector}>
                  <View style={boardStyles.connectorDot} />
                  <View style={boardStyles.connectorDot} />
                  <View style={boardStyles.connectorDot} />
                </View>
                <Text style={[boardStyles.pairWord, boardStyles.pairWordB]} numberOfLines={1}>
                  {wordB.text}
                </Text>

                <Pressable
                  style={({ pressed }) => [boardStyles.lineBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => onMakeLine(pairing.id)}
                  hitSlop={6}
                >
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [boardStyles.unpairBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => onUnpair(pairing.id)}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {unpairedA.length > 0 || unpairedB.length > 0 ? (
        <View style={boardStyles.unpairedSection}>
          <Text style={boardStyles.sectionLabel}>{exercise.columnALabel}</Text>
          <View style={boardStyles.scrapWrap}>
            {unpairedA.map((word) => (
              <Scrap
                key={word.id}
                text={word.text}
                armed={armedWord?.column === "a" && armedWord.wordId === word.id}
                onPress={() => onTapWord("a", word.id)}
              />
            ))}
          </View>

          <Text style={[boardStyles.sectionLabel, boardStyles.sectionLabelSecond]}>Nouns</Text>
          <View style={boardStyles.scrapWrap}>
            {unpairedB.map((word) => (
              <Scrap
                key={word.id}
                text={word.text}
                armed={armedWord?.column === "b" && armedWord.wordId === word.id}
                onPress={() => onTapWord("b", word.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {exercise.columnA.length === 0 && exercise.columnB.length === 0 ? (
        <Text style={boardStyles.emptyHint}>
          Add a few words on the Words tab first — then come back here to pair them up.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Scrap({ text, armed, onPress }: { text: string; armed: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        boardStyles.scrap,
        { transform: [{ rotate: `${wobbleFor(text)}deg` }] },
        armed ? boardStyles.scrapArmed : null,
        pressed ? appStyles.pressDown : null,
      ]}
    >
      <Text style={[boardStyles.scrapText, armed ? boardStyles.scrapTextArmed : null]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const boardStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  hint: {
    ...textTokens.supporting,
    flex: 1,
    fontSize: 12,
  },
  shuffleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  shuffleBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.onPrimary,
  },
  pairingList: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    gap: 6,
    ...shadows.card,
  },
  pairRowLocked: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  lockBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pairWord: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
    textAlign: "right",
  },
  pairWordB: {
    textAlign: "left",
  },
  connector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  connectorDot: {
    width: 3,
    height: 3,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  lineBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  unpairBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  unpairedSection: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...textTokens.annotation,
  },
  sectionLabelSecond: {
    marginTop: spacing.sm,
  },
  scrapWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    ...shadows.card,
  },
  scrapArmed: {
    backgroundColor: colors.primary,
    transform: [{ rotate: "0deg" }],
    ...shadows.cardActive,
  },
  scrapText: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  scrapTextArmed: {
    color: colors.onPrimary,
  },
  emptyHint: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
