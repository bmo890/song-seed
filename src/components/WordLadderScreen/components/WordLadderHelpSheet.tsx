import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { WordLadderStep } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  step: WordLadderStep;
  onClose: () => void;
};

/** Tweedy's own example from How to Write One Song (2020): two columns in his
 * listed order, plus the unexpected connections he drew between them. The words
 * live in i18n (`wordLadderHelp.exampleVerbs` / `exampleNouns`, comma-separated,
 * ten each, in this order). The noun column is reordered (Tweedy's pairings
 * unchanged) so connected words sit near each other — a gentle braid rather than
 * a tangle of full-height lines. The links map a verb's row index to its
 * connected noun's row index. */
const TWEEDY_LINKS: Array<[number, number]> = [
  [0, 1], // examine → lightbulb
  [1, 2], // thump → microphone
  [2, 0], // prescribe → cushion
  [3, 3], // listen → window
  [4, 4], // write → sunlight
  [5, 6], // scan → carpet
  [6, 5], // touch → turntable
  [7, 7], // wait → drum
  [8, 9], // charge → wall
  [9, 8], // heal → guitar
];

const SPARK_ROW_H = 22;
const SPARK_LINK_W = 44;

export function WordLadderHelpSheet({ visible, step, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={helpStyles.sheetScroll} showsVerticalScrollIndicator={false}>
        {step === "pairs" ? (
          <PairHelp />
        ) : step === "draft" ? (
          <DraftHelp />
        ) : step === "revise" ? (
          <ReviseHelp />
        ) : step === "nouns" ? (
          <ListHelp kind="nouns" />
        ) : (
          <ListHelp kind="verbs" />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** Two-column verbs/nouns diagram with lines drawn between Tweedy's connections,
 * echoing the Words-step graphic. Pure illustration — never the user's words. */
function SparkDiagram() {
  const { t } = useTranslation();
  const verbs = t("wordLadderHelp.exampleVerbs").split(", ");
  const nouns = t("wordLadderHelp.exampleNouns").split(", ");
  const height = SPARK_ROW_H * verbs.length;
  return (
    <View>
      <View style={helpStyles.sparkHeaderRow}>
        <Text style={[helpStyles.sparkColHeader, helpStyles.sparkColHeaderLeft]}>{t("wordLadderHelp.verbs")}</Text>
        <View style={helpStyles.sparkLinkSpacer} />
        <Text style={helpStyles.sparkColHeader}>{t("wordLadderHelp.nouns")}</Text>
      </View>
      <View style={helpStyles.sparkBody}>
        <View style={helpStyles.sparkColumn}>
          {verbs.map((verb, i) => (
            <View key={i} style={[helpStyles.sparkCell, helpStyles.sparkCellLeft]}>
              <Text style={helpStyles.sparkWord} numberOfLines={1}>
                {verb}
              </Text>
            </View>
          ))}
        </View>

        <Svg width={SPARK_LINK_W} height={height}>
          {TWEEDY_LINKS.map(([verbIndex, nounIndex]) => (
            <Line
              key={verbIndex}
              x1={0}
              y1={verbIndex * SPARK_ROW_H + SPARK_ROW_H / 2}
              x2={SPARK_LINK_W}
              y2={nounIndex * SPARK_ROW_H + SPARK_ROW_H / 2}
              stroke={colors.borderMuted}
              strokeWidth={1.25}
            />
          ))}
        </Svg>

        <View style={helpStyles.sparkColumn}>
          {nouns.map((noun, i) => (
            <View key={i} style={helpStyles.sparkCell}>
              <Text style={helpStyles.sparkWord} numberOfLines={1}>
                {noun}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Steps 1 and 2 — one list each (2026-10-17: verbs and nouns are written on
 *  separate pages, so each sheet shows only its own list). */
function ListHelp({ kind }: { kind: "verbs" | "nouns" }) {
  const { t } = useTranslation();
  const verbs = kind === "verbs";
  const words = verbs
    ? [t("wordLadderHelp.verb1"), t("wordLadderHelp.verb2"), t("wordLadderHelp.verb3")]
    : [t("wordLadderHelp.noun1"), t("wordLadderHelp.noun2"), t("wordLadderHelp.noun3")];
  return (
    <>
      <Text style={helpStyles.title}>{t(verbs ? "wordLadderHelp.verbsTitle" : "wordLadderHelp.nounsTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t(verbs ? "wordLadderHelp.verbsBody" : "wordLadderHelp.nounsBody")}</Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.listSeed}>
          <Ionicons name={verbs ? "briefcase-outline" : "location-outline"} size={13} color={colors.textSecondary} />
          <Text style={helpStyles.diagramHeaderText}>
            {t(verbs ? "wordLadderHelp.doctor" : "wordLadderHelp.bedroom")}
          </Text>
        </View>
        {words.map((word) => (
          <Text key={word} style={helpStyles.listWord}>
            {word}
          </Text>
        ))}
      </View>

      <View style={helpStyles.points}>
        {verbs ? (
          <>
            <HelpPoint icon="flash-outline" title={t("wordLadderHelp.actionTitle")} body={t("wordLadderHelp.actionBody")} />
            <HelpPoint icon="list-outline" title={t("wordLadderHelp.oneTitle")} body={t("wordLadderHelp.oneBody")} />
            <HelpPoint icon="arrow-forward-outline" title={t("wordLadderHelp.nounsNextTitle")} body={t("wordLadderHelp.nounsNextBody")} />
          </>
        ) : (
          <>
            <HelpPoint icon="cube-outline" title={t("wordLadderHelp.objectsTitle")} body={t("wordLadderHelp.objectsBody")} />
            <HelpPoint icon="swap-horizontal-outline" title={t("wordLadderHelp.matchTitle")} body={t("wordLadderHelp.matchBody")} />
            <HelpPoint icon="arrow-forward-outline" title={t("wordLadderHelp.pairNextTitle")} body={t("wordLadderHelp.pairNextBody")} />
          </>
        )}
      </View>
    </>
  );
}

/** Step 2 — connect a verb to a noun, then turn the pairs into lines. */
function PairHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("wordLadderHelp.pairTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("wordLadderHelp.pairBody")}</Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.pairScrapsRow}>
          <View style={helpStyles.pairScrap}>
            <Text style={helpStyles.pairScrapText}>{t("wordLadderHelp.pairVerb")}</Text>
          </View>
          <View style={helpStyles.pairConnector}>
            <View style={helpStyles.connectorDot} />
            <View style={helpStyles.connectorDot} />
            <View style={helpStyles.connectorDot} />
          </View>
          <View style={[helpStyles.pairScrap, helpStyles.pairScrapB]}>
            <Text style={[helpStyles.pairScrapText, helpStyles.pairScrapTextB]}>{t("wordLadderHelp.pairNoun")}</Text>
          </View>
        </View>

        <View style={helpStyles.diagramResult}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.diagramResultText}>{t("wordLadderHelp.ownLine")}</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="shuffle-outline" title={t("wordLadderHelp.shuffleTitle")} body={t("wordLadderHelp.shuffleBody")} />
        <HelpPoint icon="lock-closed-outline" title={t("wordLadderHelp.lockTitle")} body={t("wordLadderHelp.lockBody")} />
        <HelpPoint icon="remove-circle-outline" title={t("wordLadderHelp.leftoverTitle")} body={t("wordLadderHelp.leftoverBody")} />
      </View>
    </>
  );
}

/** Step 3 — write a loose first draft from the pairs, no judgment. */
function DraftHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("wordLadderHelp.draftTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("wordLadderHelp.draftBody")}</Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>{t("wordLadderHelp.exampleSparks")}</Text>
        <SparkDiagram />

        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>{t("wordLadderHelp.exampleDraft")}</Text>
        <Text style={helpStyles.exampleText}>{t("wordLadderHelp.draftExample")}</Text>
        <Text style={helpStyles.exampleCredit}>{t("wordLadderHelp.credit")}</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="sparkles-outline" title={t("wordLadderHelp.sparksTitle")} body={t("wordLadderHelp.sparksBody")} />
        <HelpPoint icon="create-outline" title={t("wordLadderHelp.looseTitle")} body={t("wordLadderHelp.looseBody")} />
        <HelpPoint icon="arrow-forward-outline" title={t("wordLadderHelp.thenReviseTitle")} body={t("wordLadderHelp.thenReviseBody")} />
      </View>
    </>
  );
}

/** Step 4 — tighten the draft into keepable lines. */
function ReviseHelp() {
  const { t } = useTranslation();
  return (
    <>
      <Text style={helpStyles.title}>{t("wordLadderHelp.reviseTitle")}</Text>
      <Text style={helpStyles.subtitle}>{t("wordLadderHelp.reviseBody")}</Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>{t("wordLadderHelp.revisedLabel")}</Text>
        <Text style={helpStyles.exampleText}>{t("wordLadderHelp.revisedExample")}</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="cut-outline" title={t("wordLadderHelp.trimTitle")} body={t("wordLadderHelp.trimBody")} />
        <HelpPoint icon="create-outline" title={t("wordLadderHelp.reshapeTitle")} body={t("wordLadderHelp.reshapeBody")} />
        <HelpPoint icon="send-outline" title={t("wordLadderHelp.saveTitle")} body={t("wordLadderHelp.saveBody")} />
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
  sheetScroll: {
    maxHeight: 540,
  },
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
  listSeed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingBottom: spacing.xs,
  },
  listWord: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  diagramHeaderText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.textStrong,
  },
  diagramResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  diagramResultText: {
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
  },
  pairScrapsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  // The same scraps as the Pair step: paper, and a picked one outlined on the wash.
  pairScrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  pairScrapB: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryDeep,
  },
  pairScrapText: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  pairScrapTextB: {
    fontFamily: "Lora_600SemiBold",
    color: colors.primaryDeep,
  },
  pairConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  connectorDot: {
    width: 4,
    height: 4,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
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
  sparkHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 2,
  },
  sparkColHeader: {
    flex: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  sparkColHeaderLeft: {
    textAlign: "right",
  },
  sparkLinkSpacer: {
    width: SPARK_LINK_W,
  },
  sparkBody: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sparkColumn: {
    flex: 1,
  },
  sparkCell: {
    height: SPARK_ROW_H,
    justifyContent: "center",
  },
  sparkCellLeft: {
    alignItems: "flex-end",
  },
  sparkWord: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
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
  points: {
    gap: spacing.md,
  },
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
  pointCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pointTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  pointBody: {
    ...textTokens.supporting,
    fontSize: 12,
  },
});
