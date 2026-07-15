import { StyleSheet } from "react-native";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";

export const contentStyles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: 16,
  },
  keyboardView: {
    flex: 1,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  missingTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  missingBody: {
    ...textTokens.supporting,
    textAlign: "center",
  },
  seedHeader: {
    marginHorizontal: -spacing.sm,
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  seedLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.textStrong,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  seedInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    marginTop: 5,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: colors.textPrimary,
  },
  seedHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginTop: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotCurrent: {
    backgroundColor: colors.primary,
  },
  progressDotDone: {
    backgroundColor: colors.primary,
  },
  progressNum: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    color: colors.textSecondary,
  },
  progressNumCurrent: {
    color: colors.onPrimary,
  },
  progressLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textMuted,
  },
  progressLabelCurrent: {
    color: colors.textPrimary,
  },
  frozenBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  frozenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  frozenText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    borderRadius: radii.round,
  },
  helpBtnNew: {
    backgroundColor: colors.primary,
    ...shadows.control,
  },
  helpBtnSeen: {
    backgroundColor: "transparent",
  },
  helpBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
  },
  helpBtnTextNew: {
    color: colors.onPrimary,
  },
  helpBtnTextSeen: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.borderMuted,
  },
  setupSpacer: {
    flex: 1,
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  columnsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  wizardFooter: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  footerHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  nextBtnGrow: {
    flex: 1,
  },
  nextBtnDisabled: {
    backgroundColor: colors.borderMuted,
  },
  nextBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
  nextBtnTextDisabled: {
    color: colors.textSecondary,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
  },
  backBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  palette: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paletteHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  paletteLabel: {
    ...textTokens.annotation,
  },
  paletteHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
  },
  paletteScroll: {
    maxHeight: 96,
  },
  paletteWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  sparkChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  sparkChipUsed: {
    backgroundColor: colors.surfaceContainer,
    opacity: 0.6,
  },
  sparkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  sparkTextUsed: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  sparkDot: {
    color: colors.textMuted,
  },
  draftRef: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  draftRefLabel: {
    ...textTokens.annotation,
    marginBottom: spacing.xs,
  },
  draftRefScroll: {
    maxHeight: 150,
  },
  draftRefScrollCompact: {
    maxHeight: 64,
  },
  draftRefText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  reviseHint: {
    ...textTokens.supporting,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  poemCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  poemInput: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
  },
});
