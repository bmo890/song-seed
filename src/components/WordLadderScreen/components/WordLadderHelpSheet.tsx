import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { WordLadderStep } from "../../../types";

type Props = {
  visible: boolean;
  step: WordLadderStep;
  onClose: () => void;
};

const VERBS = ["heal", "rush", "listen"];
const NOUNS = ["window", "pillow", "clock"];

/** Tweedy's own example from How to Write One Song (2020): two columns in his
 * listed order, plus the unexpected connections he drew between them. The links
 * map a verb's row index to its connected noun's row index. */
const TWEEDY_VERBS = [
  "examine",
  "thump",
  "prescribe",
  "listen",
  "write",
  "scan",
  "touch",
  "wait",
  "charge",
  "heal",
];
// Noun column is reordered (Tweedy's pairings unchanged) so connected words sit
// near each other — a gentle braid rather than a tangle of full-height lines.
const TWEEDY_NOUNS = [
  "cushion",
  "lightbulb",
  "microphone",
  "window",
  "sunlight",
  "turntable",
  "carpet",
  "drum",
  "guitar",
  "wall",
];
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
        ) : (
          <SetupHelp />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** Two-column verbs/nouns diagram with lines drawn between Tweedy's connections,
 * echoing the Words-step graphic. Pure illustration — never the user's words. */
function SparkDiagram() {
  const height = SPARK_ROW_H * TWEEDY_VERBS.length;
  return (
    <View>
      <View style={helpStyles.sparkHeaderRow}>
        <Text style={[helpStyles.sparkColHeader, helpStyles.sparkColHeaderLeft]}>verbs</Text>
        <View style={helpStyles.sparkLinkSpacer} />
        <Text style={helpStyles.sparkColHeader}>nouns</Text>
      </View>
      <View style={helpStyles.sparkBody}>
        <View style={helpStyles.sparkColumn}>
          {TWEEDY_VERBS.map((verb) => (
            <View key={verb} style={[helpStyles.sparkCell, helpStyles.sparkCellLeft]}>
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
          {TWEEDY_NOUNS.map((noun) => (
            <View key={noun} style={helpStyles.sparkCell}>
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

/** Step 1 — list a job's verbs and a room's nouns, kept even in count. */
function SetupHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Words</Text>
      <Text style={helpStyles.subtitle}>
        You're building two lists that you'll cross together in the next step to spark lines you'd never
        write on purpose.
      </Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.diagramHeaderRow}>
          <View style={helpStyles.diagramHeaderCell}>
            <Ionicons name="briefcase-outline" size={13} color={colors.textSecondary} />
            <Text style={helpStyles.diagramHeaderText}>doctor</Text>
          </View>
          <View style={helpStyles.diagramHeaderCell}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={helpStyles.diagramHeaderText}>bedroom</Text>
          </View>
        </View>

        <View style={helpStyles.diagramBody}>
          <View style={helpStyles.diagramColumn}>
            {VERBS.map((word) => (
              <View key={word} style={helpStyles.diagramChip}>
                <Text style={helpStyles.diagramChipText}>{word}</Text>
              </View>
            ))}
          </View>

          <Svg width={56} height={120} style={helpStyles.diagramLines}>
            <Line x1="0" y1="20" x2="56" y2="60" stroke={colors.borderMuted} strokeWidth={1.5} />
            <Line x1="0" y1="60" x2="56" y2="20" stroke={colors.primary} strokeWidth={2} />
            <Line x1="0" y1="100" x2="56" y2="100" stroke={colors.borderMuted} strokeWidth={1.5} />
          </Svg>

          <View style={helpStyles.diagramColumn}>
            {NOUNS.map((word) => (
              <View key={word} style={helpStyles.diagramChip}>
                <Text style={helpStyles.diagramChipText}>{word}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={helpStyles.diagramResult}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.diagramResultText}>odd, surprising pairs</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="create-outline" title="Name a job & room" body="Any role, any place." />
        <HelpPoint icon="list-outline" title="List words" body="Verbs the job does, nouns in the room." />
        <HelpPoint icon="swap-horizontal-outline" title="Match counts" body="Same number on each side." />
      </View>
    </>
  );
}

/** Step 2 — connect a verb to a noun, then turn the pairs into lines. */
function PairHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Pair</Text>
      <Text style={helpStyles.subtitle}>
        Connect a verb to a noun — the odder the match, the better. Each pair becomes a spark you'll write
        your own line from in the next step.
      </Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.pairScrapsRow}>
          <View style={helpStyles.pairScrap}>
            <Text style={helpStyles.pairScrapText}>heal</Text>
          </View>
          <View style={helpStyles.pairConnector}>
            <View style={helpStyles.connectorDot} />
            <View style={helpStyles.connectorDot} />
            <View style={helpStyles.connectorDot} />
          </View>
          <View style={[helpStyles.pairScrap, helpStyles.pairScrapB]}>
            <Text style={[helpStyles.pairScrapText, helpStyles.pairScrapTextB]}>bottle</Text>
          </View>
        </View>

        <View style={helpStyles.diagramResult}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.diagramResultText}>a line of your own</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="hand-left-outline" title="Tap across" body="Tap a verb, then a noun to connect." />
        <HelpPoint icon="shuffle-outline" title="Shuffle" body="Re-pair everything at random." />
        <HelpPoint icon="lock-closed-outline" title="Lock" body="Keep a pair while the rest reshuffle." />
      </View>
    </>
  );
}

/** Step 3 — write a loose first draft from the pairs, no judgment. */
function DraftHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Draft</Text>
      <Text style={helpStyles.subtitle}>
        Write a quick, loose poem from your pairs. Bend them, reorder them, drop some — don't worry about
        meaning. It's a warm-up, not a finished lyric.
      </Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>Example sparks</Text>
        <SparkDiagram />

        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>Example first draft</Text>
        <Text style={helpStyles.exampleText}>
          the drum is waiting{"\n"}
          by the window listening{"\n"}
          where the sunlight writes{"\n"}
          on the cushions prescribed{"\n"}
          the guitar is healing
        </Text>
        <Text style={helpStyles.exampleCredit}>— Jeff Tweedy, How to Write One Song (2020)</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="sparkles-outline" title="Sparks" body="The pairs are prompts, not rules." />
        <HelpPoint icon="create-outline" title="Loose" body="No meaning, no judging — just play." />
        <HelpPoint icon="arrow-forward-outline" title="Then revise" body="You'll tighten it in the next step." />
      </View>
    </>
  );
}

/** Step 4 — tighten the draft into keepable lines. */
function ReviseHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Revise</Text>
      <Text style={helpStyles.subtitle}>
        Now shape the draft into something you'd actually keep. Cut, reorder, rewrite — you don't have to use
        every word. This is what gets saved as lyrics.
      </Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>The same draft, revised</Text>
        <Text style={helpStyles.exampleText}>
          The drum is waiting by the windowsill{"\n"}
          Where the sunlight writes its will on the rug{"\n"}
          My guitar is healed by the amp charging the wall{"\n"}
          And that's not all, I'm always in love
        </Text>
        <Text style={helpStyles.exampleCredit}>— Jeff Tweedy, How to Write One Song (2020)</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="cut-outline" title="Trim" body="Drop what doesn't earn its place." />
        <HelpPoint icon="create-outline" title="Reshape" body="Reorder and rewrite into real lines." />
        <HelpPoint icon="send-outline" title="Save" body="Send the revision into a song." />
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
  sheetScroll: {
    maxHeight: 540,
  },
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
  diagramHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  diagramHeaderCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 96,
    justifyContent: "center",
  },
  diagramHeaderText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.textStrong,
  },
  diagramBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  diagramColumn: {
    width: 96,
    gap: spacing.xs,
  },
  diagramLines: {
    marginHorizontal: 2,
  },
  diagramChip: {
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  diagramChipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: colors.textPrimary,
  },
  pairScrapsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  pairScrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pairScrapB: {
    backgroundColor: colors.primary,
  },
  pairScrapText: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
  },
  pairScrapTextB: {
    color: colors.onPrimary,
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
  points: {
    gap: spacing.md,
  },
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
