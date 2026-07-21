import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { tokenizeWords, unitIndexByWord } from "../../../domain/cutUp";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

const PAGE_BG = "#FBF6EC";
// Two warm strip tints alternate per piece so neighbours read apart.
const STRIP_A = "#FFFDF7";
const STRIP_B = "#F1E7D3";

/**
 * The Cut step — one gesture, plainly. The lyric is laid out as connected
 * "strips" (a piece = a run of words sharing a tint and rounded ends). Between
 * every two words is a seam you tap: a joined seam is a faint divider (tap to
 * snip), a cut seam is a visible gap with scissors (tap to mend). The old
 * long-press-and-slide "bind" gesture is gone — every grouping is reachable by
 * choosing where to cut.
 */
export function CutUpChunkEditor({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const { t } = useTranslation();
  const words = useMemo(() => tokenizeWords(spark.sourceText), [spark.sourceText]);
  const seams = model.currentSeams;
  const seamSet = useMemo(() => new Set(seams), [seams]);
  const units = useMemo(() => unitIndexByWord(words, seams), [words, seams]);
  const unitCount = words.length === 0 ? 0 : units[units.length - 1] + 1;

  const toggle = (seam: number) => {
    haptic.light();
    model.toggleSeamAt(seam);
  };

  if (words.length === 0) {
    return (
      <View style={styles.body}>
        <Text style={styles.empty}>{t("cutUp.noWords")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{t("cutUp.pieces", { count: unitCount })}</Text>
        <Pressable
          style={({ pressed }) => [styles.resetBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.light();
            model.resetCuts();
          }}
          hitSlop={6}
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.resetText}>{t("cutUp.resetCuts")}</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>{t("cutUp.cutHint")}</Text>

      <View style={styles.page}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.mat}
          showsVerticalScrollIndicator={false}
        >
          {words.map((word, i) => {
            const cutBefore = i > 0 && seamSet.has(i);
            const cutAfter = seamSet.has(i + 1);
            const firstOfPiece = i === 0 || cutBefore;
            const lastOfPiece = i === words.length - 1 || cutAfter;
            const tint = units[i] % 2 === 0 ? STRIP_A : STRIP_B;
            return (
              <View key={word.index} style={styles.cluster}>
                {i > 0 ? (
                  <Seam cut={cutBefore} onPress={() => toggle(i)} />
                ) : null}
                <View
                  style={[
                    styles.word,
                    { backgroundColor: tint },
                    firstOfPiece ? styles.wordFirst : styles.wordInnerLeft,
                    lastOfPiece ? styles.wordLast : styles.wordInnerRight,
                  ]}
                >
                  <Text style={styles.wordText}>{word.text}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function Seam({ cut, onPress }: { cut: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      style={[styles.seam, cut ? styles.seamCut : styles.seamJoin]}
      accessibilityRole="button"
    >
      {cut ? (
        <View style={styles.seamCutMark}>
          <Ionicons name="cut" size={11} color={colors.primaryDeep} />
        </View>
      ) : (
        <View style={styles.joinLine} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  count: { ...textTokens.annotation },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  resetText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  hint: { ...textTokens.supporting, fontSize: 11.5, marginBottom: spacing.sm },
  page: { flex: 1, backgroundColor: PAGE_BG, borderRadius: radii.xl, ...shadows.card, overflow: "hidden" },
  scroll: { flex: 1 },
  mat: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", alignContent: "flex-start", padding: spacing.md },
  cluster: { flexDirection: "row", alignItems: "center" },

  // seams
  seam: { height: 34, alignItems: "center", justifyContent: "center" },
  seamJoin: { width: 9 },
  seamCut: { width: 20 },
  joinLine: { width: 1, height: 18, backgroundColor: colors.borderMuted, borderRadius: 1 },
  seamCutMark: {
    width: 18,
    height: 18,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.control,
  },

  // words (as connected strips)
  // Logical (start/end) radii + padding so a piece's rounded caps land on the
  // leading/trailing edge in both LTR and RTL (Hebrew) source text.
  word: { paddingVertical: 7, paddingHorizontal: 3, marginVertical: 3 },
  wordText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 17, color: colors.textPrimary },
  wordFirst: { borderTopStartRadius: radii.md, borderBottomStartRadius: radii.md, paddingStart: 8 },
  wordLast: { borderTopEndRadius: radii.md, borderBottomEndRadius: radii.md, paddingEnd: 8 },
  wordInnerLeft: {},
  wordInnerRight: {},

  empty: { ...textTokens.supporting, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },
});
