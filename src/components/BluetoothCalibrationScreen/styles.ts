import { StyleSheet } from "react-native";
import { colors, radii, spacing, text } from "../../design/tokens";

/**
 * Bluetooth calibration as rows on paper (2026-10-16): the route and the saved
 * calibrations are hairline rows, the measured delays sit on Steppers, and while
 * a pass runs the page is one tonal tap pad.
 */
export const screenStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 36,
  },
  label: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  labelFlex: {
    flex: 1,
  },
  labelMeta: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
    flexShrink: 1,
  },
  savedLabel: {
    paddingTop: 32,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  rowIcon: {
    width: 22,
    alignItems: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  line: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  error: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    paddingBottom: spacing.md,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  loadingText: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  linkRow: {
    alignItems: "center",
    paddingTop: spacing.md,
  },
  delayValue: {
    minWidth: 64,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  noteText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong,
  },
  summary: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
    paddingTop: spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  quietAction: {
    alignSelf: "center",
    marginTop: spacing.sm,
  },
  quietActionText: {
    fontSize: 14,
    color: colors.textStrong,
  },
  passHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  passPercent: {
    ...text.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.borderSubtle,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  // The whole pass is this one target: big enough to hit without looking.
  tapPad: {
    height: 420,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  tapPadLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 20,
    color: colors.primaryDeep,
  },
});
