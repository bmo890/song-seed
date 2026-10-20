import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../design/tokens";

/** The body fills the expandable sheet card (see BottomSheet `expandable`): at
 * the collapsed rest stop only the top peeks; pulling the sheet up reveals more
 * of the results area, which flexes to fill. The sheet deliberately does NOT
 * avoid the keyboard — it stays put and the keyboard overlays the results; the
 * search/theme/mode controls at the top stay visible. */
export const finderStyles = StyleSheet.create({
  body: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  themeLine: {
    height: 32,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  themeScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  themeAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
  themeAddText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textMuted,
  },
  themePlusBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // A committed theme word: ink, with its own small ✕ (2026-10-18; was a solid
  // terracotta pill — colour is for THE action and state, not a filter's words).
  themeWord: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  themeWordText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  themeAddKey: {
    minHeight: 28,
    justifyContent: "center",
  },
  themeAddKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primaryDeep,
  },
  themeInput: {
    minWidth: 90,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  toolBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    minHeight: 32,
    marginTop: spacing.sm,
  },
  toolBarText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  toolGroup: {
    marginBottom: spacing.md,
  },
  toolGroupTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  toolRowText: {
    flex: 1,
    gap: 1,
  },
  toolRowLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  toolRowDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultsArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  stateCenter: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  stateText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
    paddingBottom: spacing.sm,
  },
  syllableGroup: {
    marginBottom: spacing.xs,
  },
  syllableLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  // A found word: ink on the paper (2026-10-18; was a filled stadium chip, a
  // shape the button language retired). The gap between words is the grouping.
  word: {
    minHeight: 38,
    justifyContent: "center",
  },
  wordText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
  },
  moreText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  hintRow: {
    height: 18,
    justifyContent: "center",
  },
  hint: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textAlign: "center",
  },
  // ── Definition preview (takes over the body) ──────────────────────────────
  previewFill: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  previewWord: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 26,
    color: colors.textPrimary,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  previewMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  previewDefs: {
    gap: spacing.md,
  },
  previewDefRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  previewPos: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: "uppercase",
    paddingTop: 2,
    minWidth: 52,
  },
  previewDefText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  previewActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewAction: {
    flex: 1,
    alignSelf: "stretch",
  },
  // ── Hebrew rhymes: nikud-reading picker ────────────────────────────────────
  // Shown only when the plain spelling is ambiguous (e.g. שמיים → שָׁמַיִם /
  // שֵׁמִיִּים). A label + hairline set it apart from the result chips below, and
  // the pills are outlined (a chooser) rather than solid (insertable results).
  vocalBlock: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    marginTop: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  vocalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  vocalLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  vocalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.lg,
    rowGap: spacing.xs,
  },
  // A reading in the ink-tab voice: full ink over a 2 pt rule when chosen.
  reading: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  readingText: {
    fontFamily: "SongNookHebrewSansSemiBold",
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
  },
  readingTextActive: {
    color: colors.textStrong,
  },
  readingRule: {
    alignSelf: "stretch",
    height: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  readingRuleActive: {
    backgroundColor: colors.primary,
  },
  // ── On-demand (Hebrew LLM) trigger + coming-soon composition ───────────────
  triggerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  triggerEyebrow: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: 6,
    textAlign: "center",
  },
  // The looked-up word is always Hebrew here (Hebrew-only routes), so pin the
  // Hebrew serif (Frank Ruhl Libre) explicitly — the Lora alias only
  // maps to it when the whole UI is RTL, but a bilingual writer may be in an
  // English UI. This keeps the display serif for the word regardless.
  triggerWord: {
    fontFamily: "SongNookHebrewSerifSemiBold",
    fontSize: 30,
    color: colors.textPrimary,
    textAlign: "center",
  },
  triggerWordMuted: {
    fontFamily: "SongNookHebrewSerifSemiBold",
    fontSize: 30,
    color: colors.textMuted,
    textAlign: "center",
  },
  triggerBtn: {
    marginTop: spacing.lg,
    alignSelf: "center",
  },
  triggerSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  triggerSubFaint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
});
