import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpStep } from "../../../types";

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
  return (
    <View style={helpStyles.paper}>
      <View style={helpStyles.paperRow}>
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>the doctor waits</Text>
        </View>
        <CutMark />
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>by the window</Text>
        </View>
        <CutMark />
        <View style={helpStyles.scrap}>
          <Text style={helpStyles.scrapText}>listening</Text>
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
  return (
    <View style={helpStyles.boardDiagram}>
      <View style={[helpStyles.boardStrip, { transform: [{ rotate: "-3deg" }] }]}>
        <Text style={helpStyles.boardStripText}>listening</Text>
      </View>
      <View style={[helpStyles.boardStrip, helpStyles.boardStripAlt, { transform: [{ rotate: "2deg" }] }]}>
        <Text style={helpStyles.boardStripText}>by the window</Text>
      </View>
      <View style={[helpStyles.boardStrip, { transform: [{ rotate: "-1.5deg" }] }]}>
        <Text style={helpStyles.boardStripText}>the doctor waits</Text>
      </View>
    </View>
  );
}

function SourceHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Source</Text>
      <Text style={helpStyles.subtitle}>
        Start with something you've already written — a stuck verse, an old page, anything. Paste it in or
        pull a page from your Lyrics Pad. You're not starting from scratch; you're remixing your own words.
      </Text>

      <View style={helpStyles.diagram}>
        <View style={helpStyles.paper}>
          <Text style={helpStyles.paperLines}>
            the doctor waits, by the window{"\n"}listening to the rain come down{"\n"}counting all the empty hours
          </Text>
        </View>
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>something to cut apart</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="clipboard-outline" title="Paste anything" body="A draft, a fragment, a whole song." />
        <HelpPoint icon="document-text-outline" title="Or pull a page" body="Choose from your Lyrics Pad." />
        <HelpPoint icon="refresh-outline" title="Not precious" body="This is a copy — the original stays put." />
      </View>
    </>
  );
}

function ChunkHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Cut</Text>
      <Text style={helpStyles.subtitle}>
        Cut the lyric into moveable pieces — right where you want. It starts cut into phrases; a scissor seam
        sits between every word. Tap a seam to cut or join there, or press and slide across a few words to
        bind them into one unit.
      </Text>

      <View style={helpStyles.diagram}>
        <CutDiagram />
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>pieces you can rearrange</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="cut-outline" title="Tap a seam" body="Cut or join between any two words." />
        <HelpPoint icon="resize-outline" title="Press & slide" body="Drag across words to bind them into one piece." />
        <HelpPoint icon="sparkles-outline" title="Reset cuts" body="Snap back to the natural phrase breaks." />
      </View>
    </>
  );
}

function BoardHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Arrange</Text>
      <Text style={helpStyles.subtitle}>
        Now shuffle the strips like cut-outs on a table. Drag them into a new order, shuffle for happy
        accidents, and lock the lines that already feel right so they stay put.
      </Text>

      <View style={helpStyles.diagram}>
        <StripsDiagram />
        <View style={helpStyles.resultRow}>
          <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
          <Text style={helpStyles.resultText}>an order you'd never plan</Text>
        </View>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="shuffle-outline" title="Shuffle" body="Reorder the unlocked strips at random." />
        <HelpPoint icon="lock-closed-outline" title="Lock" body="Pin a strip so shuffles skip it." />
        <HelpPoint icon="trash-outline" title="Remove & restore" body="Set strips aside, bring them back anytime." />
      </View>
    </>
  );
}

function DraftHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Draft</Text>
      <Text style={helpStyles.subtitle}>
        Your arrangement becomes a draft. Now it's yours to finish — add words between strips, fix awkward
        seams, cut what doesn't sing. Save it to your Lyrics Pad when a new direction shows up.
      </Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>From shuffled strips</Text>
        <Text style={helpStyles.exampleText}>
          listening{"\n"}the doctor waits{"\n"}by the window
        </Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>…to a line worth keeping</Text>
        <Text style={helpStyles.exampleText}>
          Listening for the doctor{"\n"}who waits by the window all night
        </Text>
        <Text style={helpStyles.exampleCredit}>after Jeff Tweedy's cut-up method, How to Write One Song (2020)</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="shuffle" title="Compose" body="Shuffle the pieces into varied-length fragment lines — short, mixed, or long." />
        <HelpPoint icon="list-outline" title="Board order" body="Or rebuild plainly, one piece per line." />
        <HelpPoint icon="bookmark-outline" title="Save" body="Send the draft to your Lyrics Pad." />
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
