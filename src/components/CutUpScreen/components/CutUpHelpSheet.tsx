import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
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

/** A "paper" line with dashed scissor cuts between its phrases. */
function CutDiagram() {
  const { t } = useTranslation();
  return (
    <View style={helpStyles.paper}>
      <View style={helpStyles.paperRow}>
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example1")}</Text>
        </View>
        <CutMark />
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example2")}</Text>
        </View>
        <CutMark />
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>{t("cutUpHelp.example3")}</Text>
        </View>
      </View>
    </View>
  );
}

function CutMark() {
  return (
    <View style={helpStyles.cutMark}>
      <Ionicons name="cut-outline" size={12} color={colors.primary} />
      <Svg width={2} height={20}>
        <Line x1={1} y1={0} x2={1} y2={20} stroke={colors.borderMuted} strokeWidth={1.5} strokeDasharray="2 2" />
      </Svg>
    </View>
  );
}

/** Three paper strips at playful angles — the cut-out board. */
function StripsDiagram() {
  const { t } = useTranslation();
  return (
    <View style={helpStyles.boardDiagram}>
      <View style={helpStyles.boardStrip}>
        <Text style={helpStyles.boardStripText}>{t("cutUpHelp.example3")}</Text>
      </View>
      <View style={[helpStyles.boardStrip, helpStyles.boardStripAlt]}>
        <Text style={helpStyles.boardStripText}>{t("cutUpHelp.example2")}</Text>
      </View>
      <View style={helpStyles.boardStrip}>
        <Text style={helpStyles.boardStripText}>{t("cutUpHelp.example1")}</Text>
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
        <HelpPoint icon="clipboard-outline" title={t("cutUpHelp.pasteTitle")} body={t("cutUpHelp.pasteBody")} />
        <HelpPoint icon="document-text-outline" title={t("cutUpHelp.pullTitle")} body={t("cutUpHelp.pullBody")} />
        <HelpPoint icon="bulb-outline" title={t("cutUpHelp.copyTitle")} body={t("cutUpHelp.copyBody")} />
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
        <HelpPoint icon="layers-outline" title={t("cutUpHelp.slideTitle")} body={t("cutUpHelp.slideBody")} />
        <HelpPoint icon="sparkles-outline" title={t("cutUpHelp.resetTitle")} body={t("cutUpHelp.resetBody")} />
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
        <HelpPoint icon="list-outline" title={t("cutUpHelp.boardTitle")} body={t("cutUpHelp.boardBody")} />
        <HelpPoint icon="bookmark-outline" title={t("cutUpHelp.saveTitle")} body={t("cutUpHelp.saveBody")} />
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
        <Ionicons name={icon} size={16} color={colors.primary} />
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
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...textTokens.supporting,
    marginBottom: spacing.lg,
  },
  diagram: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  paper: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  paperLines: {
    fontFamily: "PlayfairDisplay_400Regular",
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
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  scrapText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  cutMark: {
    alignItems: "center",
    gap: 1,
  },
  boardDiagram: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  boardStrip: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: "center",
    minWidth: "70%",
  },
  boardStripAlt: {
    backgroundColor: colors.surfaceContainer,
  },
  boardStripText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  resultText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: colors.textPrimary,
  },
  example: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  exampleLabel: {
    ...textTokens.annotation,
  },
  exampleLabelSecond: {
    marginTop: spacing.md,
  },
  exampleText: {
    fontFamily: "PlayfairDisplay_400Regular",
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
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
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
