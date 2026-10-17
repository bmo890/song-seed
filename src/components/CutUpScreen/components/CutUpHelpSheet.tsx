import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpStep } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  step: CutUpStep;
  onClose: () => void;
};

export function CutUpHelpSheet({ visible, step, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={helpStyles.sheetScroll} showsVerticalScrollIndicator={false}>
        {step === "chunk" ? (
          <ChunkHelp />
        ) : step === "board" ? (
          <BoardHelp />
        ) : step === "draft" ? (
          <DraftHelp />
        ) : (
          <SourceHelp />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** One lyric line as the Cut step draws it: scraps of paper with a plain gap
 *  between them (tap to join) and a thin mark between words (tap to cut). */
function CutDiagram() {
  const { t } = useTranslation();
  const words = t("cutUpHelp.example1").split(" ");
  return (
    <View style={helpStyles.paperRow}>
      <View style={helpStyles.scrap}>
        {words.map((word, i) => (
          <View key={i} style={helpStyles.scrapWords}>
            {i > 0 ? <View style={helpStyles.divider} /> : null}
            <Text style={helpStyles.scrapText}>{word}</Text>
          </View>
        ))}
      </View>
      <View style={helpStyles.scrap}>
        <Text style={helpStyles.scrapText}>{t("cutUpHelp.example2")}</Text>
      </View>
      <View style={helpStyles.scrap}>
        <Text style={helpStyles.scrapText}>{t("cutUpHelp.example3")}</Text>
      </View>
    </View>
  );
}

/** The table: faint rules, scraps laid on them. Two on one rule read as one
 *  line; the empty rules below show where a wide gap becomes a blank line. */
function StripsDiagram() {
  const { t } = useTranslation();
  return (
    <View style={helpStyles.boardDiagram}>
      <View style={helpStyles.rule}>
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example3")}</Text>
        </View>
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example1")}</Text>
        </View>
      </View>
      <View style={helpStyles.rule}>
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example2")}</Text>
        </View>
      </View>
    </View>
  );
}

function SourceHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("cutUpHelp.sourceTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("cutUpHelp.sourceBody")}</Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.paper}>
          <Text style={helpStyles.paperLines}>{t("cutUpHelp.sourceText")}</Text>
        </View>
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>{t("cutUpHelp.sourceResult")}</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="document-text-outline" title={t("cutUpHelp.pullTitle")} body={t("cutUpHelp.pullBody")} />
        <HelpPoint icon="copy-outline" title={t("cutUpHelp.copyTitle")} body={t("cutUpHelp.copyBody")} />
        <HelpPoint icon="lock-closed-outline" title={t("cutUpHelp.lockedTitle")} body={t("cutUpHelp.lockedBody")} />
      </View>
    </>
  );
}

function ChunkHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("cutUpHelp.cutTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("cutUpHelp.cutBody")}</Text>

      <View style={helpStyles.diagram}>
        <CutDiagram />
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>{t("cutUpHelp.cutResult")}</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="cut-outline" title={t("cutUpHelp.seamTitle")} body={t("cutUpHelp.seamBody")} />
        <HelpPoint icon="git-merge-outline" title={t("cutUpHelp.slideTitle")} body={t("cutUpHelp.slideBody")} />
        <HelpPoint icon="return-down-back-outline" title={t("cutUpHelp.lineTitle")} body={t("cutUpHelp.lineBody")} />
        <HelpPoint icon="refresh" title={t("cutUpHelp.resetTitle")} body={t("cutUpHelp.resetBody")} />
      </View>
    </>
  );
}

function BoardHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("cutUpHelp.arrangeTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("cutUpHelp.arrangeBody")}</Text>

      <View style={helpStyles.diagram}>
        <StripsDiagram />
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>{t("cutUpHelp.arrangeResult")}</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="reorder-two-outline" title={t("cutUpHelp.gapTitle")} body={t("cutUpHelp.gapBody")} />
        <HelpPoint icon="shuffle-outline" title={t("cutUpHelp.shuffleTitle")} body={t("cutUpHelp.shuffleBody")} />
        <HelpPoint icon="options-outline" title={t("cutUpHelp.lockTitle")} body={t("cutUpHelp.lockBody")} />
        <HelpPoint icon="archive-outline" title={t("cutUpHelp.restoreTitle")} body={t("cutUpHelp.restoreBody")} />
      </View>
    </>
  );
}

function DraftHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("cutUpHelp.draftTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("cutUpHelp.draftBody")}</Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>{t("cutUpHelp.fromShuffled")}</Text>
        <Text style={helpStyles.exampleText}>{t("cutUpHelp.draftExample")}</Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>{t("cutUpHelp.worthKeeping")}</Text>
        <Text style={helpStyles.exampleText}>{t("cutUpHelp.revisedExample")}</Text>
        <Text style={helpStyles.exampleCredit}>{t("cutUpHelp.credit")}</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="shuffle" title={t("cutUpHelp.composeTitle")} body={t("cutUpHelp.composeBody")} />
        <HelpPoint icon="checkmark-circle-outline" title={t("cutUpHelp.saveTitle")} body={t("cutUpHelp.saveBody")} />
      </View>
    </>
  );
}

function HelpPoint({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={helpStyles.point}>
      <View style={helpStyles.pointIcon}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={helpStyles.pointCopy}>
        <Text style={helpStyles.pointTitle}>{title}</Text>
        <Text style={helpStyles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const helpStyles = StyleSheet.create({
  sheetScroll: { maxHeight: 540 },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...textTokens.supporting,
    marginBottom: spacing.lg,
  },
  // Examples sit on the sheet between hairlines, not in grey boxes (2026-10-17).
  diagram: {
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
  },
  paper: {
    paddingVertical: spacing.xs,
  },
  paperLines: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  paperRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  scrapText: {
    fontFamily: "Lora_500Medium",
    fontSize: 14,
    color: colors.textPrimary,
  },
  scrapWords: { flexDirection: "row", alignItems: "center" },
  divider: { width: 1.5, height: 14, borderRadius: 1, backgroundColor: colors.borderMuted, marginHorizontal: 6 },
  boardDiagram: {
    gap: 0,
  },
  rule: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  resultText: {
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
  },
  example: {
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
  },
  exampleLabel: {
    ...textTokens.annotation,
  },
  exampleLabelSecond: {
    marginTop: spacing.md,
  },
  exampleText: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  exampleCredit: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  points: { gap: spacing.md },
  point: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  pointIcon: {
    width: 20,
    paddingTop: 2,
    alignItems: "center",
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 2 },
  pointTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  pointBody: {
    ...textTokens.supporting,
    fontSize: 12,
  },
});
