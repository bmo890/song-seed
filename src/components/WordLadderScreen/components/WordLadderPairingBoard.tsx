import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { COLUMN_A_LABEL, COLUMN_B_LABEL, getUnpairedWords } from "../../../wordLadder";
import type { WordLadderExercise } from "../../../types";

type Props = {
  exercise: WordLadderExercise;
  armedWord: { column: "a" | "b"; wordId: string } | null;
  onTapWord: (column: "a" | "b", wordId: string) => void;
  onUnpair: (pairingId: string) => void;
  onToggleLock: (pairingId: string) => void;
  onShuffle: () => void;
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
}: Props) {
  const unpairedA = getUnpairedWords(exercise.columnA, exercise.pairings, "a");
  const unpairedB = getUnpairedWords(exercise.columnB, exercise.pairings, "b");
  const hasUnpaired = unpairedA.length > 0 || unpairedB.length > 0;
  const pairCount = exercise.pairings.length;
  const canShuffle = exercise.columnA.length > 0 && exercise.columnB.length > 0;

  return (
    <ScrollView style={boardStyles.root} showsVerticalScrollIndicator={false}>
      <View style={boardStyles.toolbar}>
        <Text style={boardStyles.hint}>
          {hasUnpaired
            ? armedWord
              ? "Now tap a word across to connect them"
              : "Tap a word, then its partner across"
            : "All paired — shuffle to remix"}
        </Text>
        <Pressable
          style={({ pressed }) => [
            boardStyles.shuffleBtn,
            !canShuffle ? boardStyles.shuffleBtnDisabled : null,
            pressed && canShuffle ? appStyles.pressDown : null,
          ]}
          onPress={onShuffle}
          disabled={!canShuffle}
        >
          <Ionicons name="shuffle" size={14} color={colors.onPrimary} />
          <Text style={boardStyles.shuffleBtnText}>Shuffle</Text>
        </Pressable>
      </View>

      {hasUnpaired ? (
        <View style={boardStyles.poolsCard}>
          <Text style={boardStyles.sectionLabel}>{COLUMN_A_LABEL}</Text>
          <View style={boardStyles.scrapWrap}>
            {unpairedA.length > 0 ? (
              unpairedA.map((word) => (
                <Scrap
                  key={word.id}
                  text={word.text}
                  armed={armedWord?.column === "a" && armedWord.wordId === word.id}
                  onPress={() => onTapWord("a", word.id)}
                />
              ))
            ) : (
              <Text style={boardStyles.poolEmpty}>all paired</Text>
            )}
          </View>

          <Text style={[boardStyles.sectionLabel, boardStyles.sectionLabelSecond]}>{COLUMN_B_LABEL}</Text>
          <View style={boardStyles.scrapWrap}>
            {unpairedB.length > 0 ? (
              unpairedB.map((word) => (
                <Scrap
                  key={word.id}
                  text={word.text}
                  armed={armedWord?.column === "b" && armedWord.wordId === word.id}
                  onPress={() => onTapWord("b", word.id)}
                />
              ))
            ) : (
              <Text style={boardStyles.poolEmpty}>all paired</Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={boardStyles.pairsHeaderRow}>
        <Text style={boardStyles.sectionLabel}>Pairs</Text>
        <Text style={boardStyles.pairsCount}>{pairCount}</Text>
      </View>

      {pairCount === 0 ? (
        <View style={boardStyles.pairsEmpty}>
          <Ionicons name="git-compare-outline" size={22} color={colors.textMuted} />
          <Text style={boardStyles.pairsEmptyText}>
            No pairs yet. Tap a word above, then its partner across — or hit Shuffle to pair them all at once.
          </Text>
        </View>
      ) : (
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
  shuffleBtnDisabled: {
    backgroundColor: colors.borderMuted,
  },
  shuffleBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.onPrimary,
  },
  poolsCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  pairsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pairsCount: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    lineHeight: 16,
    textAlignVertical: "center",
    includeFontPadding: false,
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    minWidth: 18,
    textAlign: "center",
    borderRadius: radii.round,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  pairsEmpty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  pairsEmptyText: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
  },
  poolEmpty: {
    ...textTokens.supporting,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 6,
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
    lineHeight: 18,
    includeFontPadding: false,
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
  unpairBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
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
});
