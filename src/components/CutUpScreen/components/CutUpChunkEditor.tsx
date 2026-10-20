import { Fragment, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { UndoRedoButtons } from "../../common/useUndoHistory";
import { SparkHint } from "../../common/SparkFrame";
import { haptic } from "../../../design/haptics";
import { type CutUnit, lineBreakSeams, tokenizeWords, unitGroups } from "../../../domain/cutUp";
import { contentRow, detectTextDirection } from "../../../i18n/direction";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

/**
 * The Cut step, in the same visual language as the Arrange table: the lyric
 * laid out line by line on a faintly ruled page, each strip already a scrap
 * card. Tap the thin mark between two words to cut a card apart; tap the
 * scissors between two cards to tape them back together. Line breaks are
 * structural — each source line keeps its own rule — so what you see here is
 * exactly the set of scraps that lands on the table.
 */
export function CutUpChunkEditor({
  model,
  spark,
  onExample,
}: {
  model: Model;
  spark: CutUpSpark;
  /** Opens the method's example (the step's help). */
  onExample: () => void;
}) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  const rtl = detectTextDirection(spark.sourceText) === "rtl";

  const words = useMemo(() => tokenizeWords(spark.sourceText), [spark.sourceText]);
  // Line-break seams are structural (matching generation), so display groups
  // units with them always cut — no cross-line strip can appear here.
  const rows = useMemo(() => {
    const structural = lineBreakSeams(spark.sourceText, words);
    const structuralSet = new Set(structural);
    const effective = [...new Set([...model.currentSeams, ...structural])].sort((a, b) => a - b);
    const units = unitGroups(words, effective);

    // Group consecutive units by source line; blank source lines = stanza gaps.
    const lineOfWord = (w: { start: number }) =>
      (spark.sourceText.slice(0, w.start).match(/\n/g) ?? []).length;
    const out: Array<{ line: number; stanzaGapBefore: boolean; units: CutUnit[] }> = [];
    for (const unit of units) {
      const line = lineOfWord(unit.words[0]);
      const prev = out.length > 0 ? out[out.length - 1] : null;
      if (prev && prev.line === line) prev.units.push(unit);
      else out.push({ line, stanzaGapBefore: prev !== null && line - prev.line > 1, units: [unit] });
    }
    return { rows: out, structuralSet, count: units.length };
  }, [spark.sourceText, words, model.currentSeams]);

  const toggle = (seam: number) => {
    // Haptics vocabulary: light, a small state flip (a cut made or mended).
    haptic.light();
    model.toggleSeamAt(seam);
  };

  const wordTextStyle = { fontSize: size, lineHeight };

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
        <Text style={styles.count}>{t("cutUp.pieces", { count: rows.count })}</Text>
        <InkKey
          glyph={<Ionicons name="refresh" size={16} color={inkKeyColor("idle")} />}
          label={t("cutUp.recut")}
          onPress={model.resetCuts}
        />
        <View style={styles.undoPair}>
          <UndoRedoButtons
            canUndo={model.cutHistory.canUndo}
            canRedo={model.cutHistory.canRedo}
            onUndo={model.cutHistory.undo}
            onRedo={model.cutHistory.redo}
          />
        </View>
      </View>

      {model.cutHistory.canUndo ? null : <SparkHint text={t("cutUp.cutHint")} onExample={onExample} />}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {rows.rows.map((row) => (
          <View
            key={row.line}
            style={[styles.lineRow, row.stanzaGapBefore ? styles.stanzaGap : null]}
          >
            <View style={[styles.lineStrips, contentRow(rtl ? "rtl" : "ltr")]}>
              {row.units.map((unit, ui) => (
                <Fragment key={unit.startSeam}>
                  {ui > 0 ? (
                    // A plain gap between two cards — the space itself reads as
                    // "cut here"; tap it to tape the cards back together.
                    <Pressable
                      onPress={() => toggle(unit.startSeam)}
                      hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }}
                      style={styles.joinSeam}
                      accessibilityRole="button"
                      accessibilityLabel={t("cutUp.joinPieces")}
                    />
                  ) : null}
                  <View style={[styles.strip, contentRow(rtl ? "rtl" : "ltr")]}>
                    {unit.words.map((word, wi) => (
                      <Fragment key={word.index}>
                        {wi > 0 ? <Divider onPress={() => toggle(word.index)} /> : null}
                        <Text style={[styles.wordText, wordTextStyle]}>{word.text}</Text>
                      </Fragment>
                    ))}
                  </View>
                </Fragment>
              ))}
            </View>
            <View style={styles.rule} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * One strip's words as a tap-to-cut row, reused by the Arrange step's re-cut
 * sheet. Local seams 1..words.length-1 (the seam before word i). A cut seam
 * shows a scissors (tap to mend); a joined seam a faint centered mark.
 */
export function CutSeamRow({
  words,
  isCut,
  onToggle,
  rtl,
  size,
}: {
  words: string[];
  isCut: (seam: number) => boolean;
  onToggle: (seam: number) => void;
  rtl: boolean;
  size: number;
}) {
  return (
    <View style={[styles.seamRow, contentRow(rtl ? "rtl" : "ltr")]}>
      {words.map((text, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            isCut(i) ? (
              <Pressable onPress={() => onToggle(i)} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }} style={styles.cutMark}>
                <Ionicons name="cut" size={12} color={colors.primaryDeep} />
              </Pressable>
            ) : (
              <Divider onPress={() => onToggle(i)} />
            )
          ) : null}
          <Text style={[styles.wordText, { fontSize: size, lineHeight: Math.round(size * 1.55) }]}>{text}</Text>
        </Fragment>
      ))}
    </View>
  );
}

/** The thin, vertically-centered mark between two words within a strip — tap
 * to cut there. */
function Divider({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }} style={styles.divider} accessibilityRole="button">
      <View style={styles.dividerLine} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  count: { ...textTokens.annotation, flex: 1 },
  undoPair: { flexDirection: "row", alignItems: "center" },

  scroll: { flex: 1 },
  page: { paddingBottom: spacing.md },

  // One source line per ruled row; its strips sit on the rule as cards.
  lineRow: { paddingTop: 6 },
  stanzaGap: { marginTop: 26 },
  lineStrips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    opacity: 0.45,
    marginTop: 7,
    marginHorizontal: 2,
  },

  // A strip: the same scrap card as the Arrange table.
  strip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    ...shadows.card,
  },
  wordText: { fontFamily: "Lora_500Medium", color: colors.textPrimary },

  // Within-strip cut mark.
  divider: { width: 15, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  dividerLine: { width: 1.5, height: 15, borderRadius: 1, backgroundColor: colors.borderMuted },
  // Between two strips on the same rule: a plain gap; tap it to tape them back.
  joinSeam: { width: 18, alignSelf: "stretch" },
  cutMark: { width: 22, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  seamRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },

  empty: { ...textTokens.supporting, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },
});
