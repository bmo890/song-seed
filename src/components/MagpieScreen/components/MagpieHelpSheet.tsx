import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { MagpieStep } from "../../../types";

type Props = {
  visible: boolean;
  step: MagpieStep;
  onClose: () => void;
};

export function MagpieHelpSheet({ visible, step, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={helpStyles.sheetScroll} showsVerticalScrollIndicator={false}>
        {step === "build" ? <BuildHelp /> : <PageHelp />}
      </ScrollView>
    </BottomSheet>
  );
}

function PageHelp() {
  return (
    <>
      <Text style={helpStyles.title}>The page</Text>
      <Text style={helpStyles.subtitle}>
        Magpie opens a real book to a random page. Hum a melody to yourself, then tap the words and phrases
        that sound good against it — not the ones that make sense, the ones that ring. Tap a run of words to
        keep them together, tap again to let one go.
      </Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>Tap what catches your ear</Text>
        <Text style={helpStyles.exampleText}>
          …the <Text style={helpStyles.exampleMark}>harbour light</Text> was low, and no one{" "}
          <Text style={helpStyles.exampleMark}>answered</Text>…
        </Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>…into your pile</Text>
        <Text style={helpStyles.exampleText}>harbour light · answered</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="refresh" title="New page" body="Same book, a different page." />
        <HelpPoint icon="shuffle" title="New book" body="Draw a fresh book — curated, or the whole library." />
        <HelpPoint icon="albums-outline" title="Your pile keeps" body="Collected words stay as you turn pages and books." />
      </View>

      <Text style={helpStyles.credit}>after Jeff Tweedy's "steal words from a book", How to Write One Song (2020)</Text>
    </>
  );
}

function BuildHelp() {
  return (
    <>
      <Text style={helpStyles.title}>Build</Text>
      <Text style={helpStyles.subtitle}>
        Now the pile is yours to shape. Drag the words into an order, split a phrase back into single words,
        or tap a word to edit it — bend a tense, change a name — until the lines start to sing.
      </Text>

      <View style={helpStyles.example}>
        <Text style={helpStyles.exampleLabel}>From loose fragments</Text>
        <Text style={helpStyles.exampleText}>harbour light{"\n"}answered{"\n"}low</Text>
        <Text style={[helpStyles.exampleLabel, helpStyles.exampleLabelSecond]}>…to a line worth keeping</Text>
        <Text style={helpStyles.exampleText}>the harbour light burned low{"\n"}and no one answering</Text>
      </View>

      <View style={helpStyles.points}>
        <HelpPoint icon="reorder-three" title="Reorder" body="Drag words into new arrangements." />
        <HelpPoint icon="cut-outline" title="Split" body="Break a phrase into single words." />
        <HelpPoint icon="bookmark-outline" title="Save" body="Send the draft to your Lyrics Pad as a page." />
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
  title: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 19, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { ...textTokens.supporting, marginBottom: spacing.lg },
  example: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  exampleLabel: { ...textTokens.annotation },
  exampleLabelSecond: { marginTop: spacing.md },
  exampleText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  exampleMark: { backgroundColor: "#E4B7A6", color: "#5C2E1E" },
  credit: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  points: { gap: spacing.md },
  point: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 2 },
  pointTitle: { ...textTokens.body, fontFamily: "PlusJakartaSans_700Bold" },
  pointBody: { ...textTokens.supporting, fontSize: 12 },
});
