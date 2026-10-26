import { StyleSheet } from "react-native";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";

// Word Ladder on paper (2026-10-17, founder picked A): labels and hairlines on
// the app's paper, one white page to write on. No grey panels.
export const contentStyles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: 16,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    ...textTokens.annotation,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  labelHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  // ── Words ──
  columnsRow: {
    flex: 1,
    flexDirection: "row",
    gap: 18,
  },
  seedField: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: spacing.sm,
    paddingStart: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceContainer,
  },
  seedInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  seedDice: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Pair ──
  frozenBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  frozenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  frozenText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  frozenDot: {
    width: 3,
    height: 3,
    borderRadius: radii.round,
    backgroundColor: colors.textMuted,
  },
  stepBody: {
    flex: 1,
  },
  // ── Draft ──
  palette: {
    marginBottom: spacing.md,
  },
  paletteScroll: {
    maxHeight: 108,
  },
  paletteWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.lg,
    paddingTop: 6,
  },
  sparkToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 34,
  },
  // A pair still to use: a terracotta dot. Used: the dot empties and the words
  // are struck through, the same ink a finished line gets on paper.
  sparkDot: {
    width: 7,
    height: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    borderWidth: 1.25,
    borderColor: colors.primary,
  },
  sparkDotUsed: {
    backgroundColor: "transparent",
    borderColor: colors.textMuted,
  },
  sparkText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.textPrimary,
  },
  sparkTextUsed: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  // ── Revise ──
  draftRef: {
    marginBottom: spacing.md,
  },
  copyKey: {
    minHeight: 28,
  },
  draftRefScroll: {
    maxHeight: 120,
    marginTop: spacing.sm,
  },
  draftRefScrollCompact: {
    maxHeight: 56,
  },
  draftRefText: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  // ── The page ──
  poemCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  poemInput: {
    flex: 1,
    fontFamily: "Lora_500Medium",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textStrong,
  },
});
