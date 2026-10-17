import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "../../common/Press";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { durations } from "../../../design/motion";
import { getUnpairedWords } from "../../../domain/wordLadder";
import type { WordLadderExercise } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import { UndoRedoButtons } from "../../common/useUndoHistory";
import { SparkHint } from "../../common/SparkFrame";

type Props = {
  exercise: WordLadderExercise;
  armedWord: { column: "a" | "b"; wordId: string } | null;
  onTapWord: (column: "a" | "b", wordId: string) => void;
  onUnpair: (pairingId: string) => void;
  onToggleLock: (pairingId: string) => void;
  onShuffle: () => void;
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
  /** Opens the method's example (the step's help). */
  onExample: () => void;
};

/**
 * The Pair step (2026-10-17, paper): the words as paper scraps on the page, a
 * picked one outlined on the terracotta wash (never a solid fill), the pairs
 * as rows with an ink lock. Shuffle is an ink key; undo covers pairing,
 * unpairing, locking and shuffling.
 */
export function WordLadderPairingBoard({
  exercise,
  armedWord,
  onTapWord,
  onUnpair,
  onToggleLock,
  onShuffle,
  history,
  onExample,
}: Props) {
  const { t } = useTranslation();
  const { size } = useSparkTextScale();
  const unpairedA = getUnpairedWords(exercise.columnA, exercise.pairings, "a");
  const unpairedB = getUnpairedWords(exercise.columnB, exercise.pairings, "b");
  const hasUnpaired = unpairedA.length > 0 || unpairedB.length > 0;
  const pairCount = exercise.pairings.length;
  const anyLocked = exercise.pairings.some((pairing) => pairing.locked);
  const canShuffle = exercise.columnA.length > 0 && exercise.columnB.length > 0;
  const scrapFont = { fontSize: size - 1 };
  const pairFont = { fontSize: size };

  const hint = !hasUnpaired
    ? t("wordLadder.allPairedHint")
    : armedWord
      ? t(armedWord.column === "a" ? "wordLadder.nowNoun" : "wordLadder.nowVerb")
      : "";


  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false}>
      <View style={s.toolbar}>
        <Text style={s.hint} numberOfLines={1}>
          {hint}
        </Text>
        <InkKey
          glyph={<Ionicons name="shuffle" size={16} color={inkKeyColor(canShuffle ? "idle" : "off")} />}
          label={t("wordLadder.shuffle")}
          tone={canShuffle ? "idle" : "off"}
          onPress={() => {
            if (canShuffle) onShuffle();
          }}
        />
        <View style={s.undoPair}>
          <UndoRedoButtons canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </View>
      </View>

      {hasUnpaired ? (
        <>
          <Text style={s.poolLabel}>{t("wordLadder.verbs")}</Text>
          <View style={s.scrapWrap}>
            {unpairedA.length > 0 ? (
              unpairedA.map((word) => (
                <Scrap
                  key={word.id}
                  text={word.text}
                  fontStyle={scrapFont}
                  armed={armedWord?.column === "a" && armedWord.wordId === word.id}
                  onPress={() => onTapWord("a", word.id)}
                />
              ))
            ) : (
              <Text style={s.poolEmpty}>{t("wordLadder.allPaired")}</Text>
            )}
          </View>

          <Text style={s.poolLabel}>{t("wordLadder.nouns")}</Text>
          <View style={s.scrapWrap}>
            {unpairedB.length > 0 ? (
              unpairedB.map((word) => (
                <Scrap
                  key={word.id}
                  text={word.text}
                  fontStyle={scrapFont}
                  armed={armedWord?.column === "b" && armedWord.wordId === word.id}
                  onPress={() => onTapWord("b", word.id)}
                />
              ))
            ) : (
              <Text style={s.poolEmpty}>{t("wordLadder.allPaired")}</Text>
            )}
          </View>
        </>
      ) : null}

      <View style={s.pairsHeader}>
        <Text style={s.label}>{t("wordLadder.pairs")}</Text>
        <Text style={s.count}>{pairCount}</Text>
      </View>

      {pairCount === 0 ? (
        <SparkHint text={t("wordLadder.noPairs")} onExample={onExample} />
      ) : (
        <View style={s.pairList}>
          {exercise.pairings.map((pairing) => {
            const wordA = exercise.columnA.find((w) => w.id === pairing.columnAWordId);
            const wordB = exercise.columnB.find((w) => w.id === pairing.columnBWordId);
            if (!wordA || !wordB) return null;
            return (
              <Animated.View
                key={pairing.id}
                entering={FadeIn.duration(durations.gentle)}
                exiting={FadeOut.duration(durations.fast)}
                layout={LinearTransition.duration(durations.base)}
                style={s.pairRow}
              >
                <UserText style={[s.pairWord, s.pairWordA, pairFont]} numberOfLines={1}>
                  {wordA.text}
                </UserText>
                <Text style={s.dash}>—</Text>
                <UserText style={[s.pairWord, pairFont]} numberOfLines={1}>
                  {wordB.text}
                </UserText>
                <Press
                  feel="glyph"
                  haptic="light"
                  style={s.rowKey}
                  onPress={() => onToggleLock(pairing.id)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!pairing.locked }}
                  accessibilityLabel={t(pairing.locked ? "wordLadder.unlock" : "wordLadder.lock")}
                >
                  <Ionicons
                    name={pairing.locked ? "lock-closed" : "lock-open-outline"}
                    size={16}
                    color={pairing.locked ? colors.primaryDeep : colors.textMuted}
                  />
                </Press>
                <Press
                  feel="glyph"
                  style={s.rowKey}
                  onPress={() => onUnpair(pairing.id)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("wordLadder.removePair")}
                >
                  <Ionicons name="close" size={15} color={colors.textMuted} />
                </Press>
              </Animated.View>
            );
          })}
          {anyLocked ? <Text style={s.footnote}>{t("wordLadder.lockedStay")}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

/** A word as a scrap of paper. Picked, it sits on the terracotta wash inside a
 *  fine terracotta line: the same quiet "chosen" the rest of the app uses. */
function Scrap({
  text,
  armed,
  fontStyle,
  onPress,
}: {
  text: string;
  armed: boolean;
  fontStyle: { fontSize: number };
  onPress: () => void;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(durations.base)}
      entering={FadeIn.duration(durations.base)}
      exiting={FadeOut.duration(durations.fast)}
    >
      <Press
        // Haptics vocabulary: light, a small state flip, for picking a word up,
        // putting it down and for the pair landing (a pair is a step, not a finish).
        haptic="light"
        onPress={onPress}
        style={[s.scrap, armed ? s.scrapArmed : null]}
        accessibilityRole="button"
        accessibilityState={{ selected: armed }}
        accessibilityLabel={text}
      >
        <UserText style={[s.scrapText, fontStyle, armed ? s.scrapTextArmed : null]} numberOfLines={1}>
          {text}
        </UserText>
      </Press>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  hint: { ...textTokens.supporting, flex: 1 },
  undoPair: { flexDirection: "row", alignItems: "center" },
  poolLabel: { ...textTokens.annotation, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  scrapWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  scrap: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  scrapArmed: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryDeep,
    ...shadows.cardActive,
  },
  scrapText: { fontFamily: "Lora_500Medium", fontSize: 16, color: colors.textPrimary },
  scrapTextArmed: { fontFamily: "Lora_600SemiBold", color: colors.primaryDeep },
  poolEmpty: { ...textTokens.supporting, color: colors.textMuted, paddingVertical: spacing.sm },
  pairsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingTop: spacing.xxl,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  label: { ...textTokens.annotation },
  count: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  pairList: { marginBottom: spacing.lg },
  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  pairWord: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
  },
  pairWordA: { textAlign: "right" },
  dash: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 14, color: colors.textMuted },
  rowKey: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  footnote: { ...textTokens.supporting, fontSize: 12, color: colors.textMuted, paddingTop: spacing.sm },
});
